import { NextRequest, NextResponse } from 'next/server'
import { acquirePluContent, targetZoneChapter } from '@/lib/pluExtractor'
import { resolvePluDocUrl } from '@/lib/pluDoc'
import { DPFormData } from '@/lib/models'
import { getTravauxDef } from '@/lib/travauxRegistry'
import { norm, evaluateProject } from '@/lib/pluEvaluate'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// tencent/hy3 is a reasoning model — accurate but slow (a real règlement takes ~1–2 min). Cap the
// règlement text fed to it so the reasoning stays bounded, and time-box each call so a slow/hung
// model can never exhaust the route (the deterministic verdict is returned regardless).
const PLU_TEXT_CAP = 18000
const PLU_CALL_TIMEOUT_MS = 100_000

// Models (override via env). Default to OpenRouter's free auto-router, which is vision-capable
// and works with any OpenRouter key (no credits required). For higher accuracy on legal text /
// scanned règlements, set OPENROUTER_PLU_MODEL (and optionally OPENROUTER_VISION_MODEL) to a
// stronger model your key can access, e.g. 'google/gemini-3.5-flash'.
// openrouter/free auto-routes to an appropriate free model based on need (fast, vision-capable).
// We don't force json_object (some routed models reject it) — the JSON is parsed from the reply.
// Override with OPENROUTER_PLU_MODEL / OPENROUTER_VISION_MODEL for higher accuracy.
const PLU_MODEL = process.env.OPENROUTER_PLU_MODEL || 'openrouter/free'
const PLU_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'openrouter/free'

// In-memory extraction cache keyed by document URL + zone (règlements change rarely → big
// reliability/latency/cost win for repeat addresses in the same zone).
type CachedExtraction = { report: string; extractedRules: any; pdfType: string; source?: string; text?: string; aiProposalRaw?: any; at: number }
const extractionCache = new Map<string, CachedExtraction>()
const CACHE_TTL_MS = 24 * 3600 * 1000

async function callOpenRouter(apiKey: string, model: string, content: any, maxTokens = 8000): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PLU_CALL_TIMEOUT_MS)
    let res: Response
    try {
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/ayouubmzariiii/DP-Last',
                'X-Title': 'DP Travaux PLU Scanner',
            },
            // No response_format: reasoning models (tencent/hy3) reject json_object; the JSON is parsed
            // out of the reply by parseRulesJson. max_tokens must be large enough for the reasoning
            // chain PLUS the JSON output, otherwise the reply is truncated with an empty content.
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content }],
                temperature: 0.15,
                max_tokens: maxTokens,
            }),
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timer)
    }
    if (!res.ok) throw new Error(`OpenRouter Error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
}

// Robust JSON extraction (handles ```json fences and surrounding prose).
function parseRulesJson(raw: string): { report?: string; rules?: any } | null {
    let clean = (raw || '').trim()
    if (clean.startsWith('```')) clean = clean.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
    const first = clean.indexOf('{'), last = clean.lastIndexOf('}')
    if (first !== -1 && last !== -1 && last > first) clean = clean.slice(first, last + 1)
    try { return JSON.parse(clean) } catch { return null }
}

const RNU_RULES = {
    zone_code: 'RNU',
    facade: { allowed: true, allowed_materials: ['bois', 'aluminium', 'pvc', 'pierre'], forbidden_materials: [], allowed_colors: [], forbidden_colors: [], color_restrictions: 'Harmonie paysagère locale requise.', excerpts: ["Article R. 111-27 du Code de l'Urbanisme"] },
    extension: { max_area_m2: 20, max_height_m: 9, allowed: true, permit_required_if_exceed: true, excerpts: ["Article L. 111-3 du Code de l'Urbanisme"] },
    roof: { max_height_m: 9, allowed_materials: ['tuile', 'ardoise'], forbidden_materials: [], allowed_colors: [], forbidden_colors: [], allowed_slopes: 'Respect des pentes locales', excerpts: ['Article R. 111-27'] },
    fence: { max_height_m: 2, allowed_materials: [], forbidden_materials: [], excerpts: ['Usage local constant (RNU)'] },
    window_openings: { allowed: true, conditions: "Respect de l'aspect général des baies existantes", excerpts: [] },
    heritage_override: { ABF_review: false, excerpts: [] },
}

// Editable fields (and their allowed values) per work type. Given to the AI so its proposed patch
// targets real form fields, and used to SANITISE the AI's proposal (drop unknown fields, snap enum
// values to the allowed set) before it can touch the form.
const FIELD_SPEC: Record<string, { fields: Record<string, { enum?: string[]; label: string }> }> = {
    menuiseries: { fields: { materiau: { enum: ['pvc', 'aluminium', 'bois', 'mixte'], label: 'matériau' }, couleur: { label: 'couleur' }, couleur_ral: { label: 'code RAL' } } },
    isolation: { fields: { type_finition: { enum: ['enduit', 'bardage_bois', 'bardage_metal', 'bardage_composite'], label: 'finition' }, couleur: { label: 'couleur' }, materiau_isolant: { label: 'isolant' } } },
    photovoltaique: { fields: { integration: { enum: ['surimposition', 'integration'], label: 'intégration' }, orientation: { label: 'orientation' } } },
    cloture: { fields: { type_cloture: { enum: ['mur', 'mur_bahut', 'grillage', 'panneaux', 'claire_voie'], label: 'type' }, materiau: { label: 'matériau' }, couleur: { label: 'couleur' }, hauteur: { label: 'hauteur (m)' } } },
    ravalement: { fields: { finition: { enum: ['enduit', 'peinture', 'pierre_apparente', 'bardage'], label: 'finition' }, couleur: { label: 'couleur' }, materiau: { label: 'matériau' } } },
    toiture: { fields: { operation: { enum: ['refection_identique', 'changement_materiau'], label: 'opération' }, materiau_couverture: { label: 'matériau de couverture' }, couleur: { label: 'couleur' } } },
    ouverture: { fields: { type_ouverture: { enum: ['fenetre', 'porte', 'porte_fenetre', 'fenetre_toit'], label: 'type' }, operation: { enum: ['creation', 'agrandissement', 'suppression'], label: 'opération' }, facade: { label: 'façade concernée' } } },
}
function fieldSpecPrompt(type: string): string {
    const spec = FIELD_SPEC[type]
    if (!spec) return '  (aucun champ modifiable)'
    return Object.entries(spec.fields).map(([k, d]) =>
        `  - "${k}" (${d.label})${d.enum ? ` : valeurs autorisées ${d.enum.map(e => `"${e}"`).join(', ')}` : ' : texte libre'}`
    ).join('\n')
}
// Validate + coerce the AI's proposal so its suggested values only ever hit known fields with
// allowed enum values. Returns the sanitised patch (may be partial/empty), the "why" bullets and the
// rewritten description — the editable proposal is assembled by buildEditableProposal.
function sanitizeProposal(ai: any, type: string): { patch: Record<string, any>; fields: string[]; description: string } | null {
    const spec = FIELD_SPEC[type]
    if (!ai || typeof ai !== 'object' || !spec) return null
    const src = (ai.patch && typeof ai.patch === 'object') ? ai.patch : ai
    const patch: Record<string, any> = {}
    for (const [key, def] of Object.entries(spec.fields)) {
        const v = src[key]
        if (v == null || v === '') continue
        if (def.enum) {
            const nv = def.enum.find(e => norm(e) === norm(v)) || def.enum.find(e => norm(String(v)).includes(norm(e)))
            if (nv) patch[key] = nv
        } else {
            patch[key] = String(v).slice(0, 160)
        }
    }
    const description = typeof ai.description === 'string' ? ai.description.trim().slice(0, 600) : ''
    const fields = Array.isArray(ai.fields) ? ai.fields.map((x: any) => String(x).slice(0, 220)).slice(0, 5) : []
    return { patch, fields, description }
}

// Which editable field(s) each violation category maps to, per work type. This is DERIVED from the
// actual non-conformities (not a hardcoded fix) — the values are filled by the analysing AI.
function fieldsForViolations(type: string, categories: string[]): string[] {
    const has = (c: string) => categories.includes(c)
    const keys = new Set<string>()
    if (has('facade_mat')) {
        if (type === 'menuiseries') keys.add('materiau')
        else if (type === 'isolation') keys.add('type_finition')
        else if (type === 'cloture') { keys.add('type_cloture'); keys.add('materiau') }
        else if (type === 'ravalement') keys.add('finition')
    }
    if (has('color')) keys.add('couleur')
    if (has('roof')) keys.add('materiau_couverture')
    if (has('pv')) keys.add('integration')
    if (has('opening')) keys.add('facade')
    if (has('fence_height')) keys.add('hauteur')
    return Array.from(keys).filter(k => FIELD_SPEC[type]?.fields[k])
}

// Conforming fallback value for an editable field when the model didn't supply one (e.g. the
// estimation path). Keeps the proposal CONCRETE and the "Appliquer" button functional — an empty
// field would be skipped on apply, leaving the user stuck on a non-conforming project.
function defaultFieldValue(type: string, key: string, def: { enum?: string[] }, rules: any): string {
    if (key === 'couleur') {
        const pal = rules?.facade?.color_palette
        if (Array.isArray(pal) && pal.length) return String(pal[0])
        if (typeof pal === 'string' && pal.trim()) return pal.split(/[,;]/)[0].trim()
        return 'Ton pierre'
    }
    if (def.enum) {
        // Pick the most traditional / ABF-friendly option available for this field.
        const pref = ['bois', 'enduit', 'pierre_apparente', 'mur_bahut', 'integration', 'refection_identique', 'mixte']
        return pref.find(p => def.enum!.includes(p)) || def.enum[0]
    }
    if (key === 'materiau') return type === 'ravalement' ? 'Enduit à la chaux' : 'Bois'
    if (key === 'materiau_couverture') return 'Tuile (identique à l’existant)'
    if (key === 'facade') return 'Façade arrière (non visible depuis la rue)'
    if (key === 'hauteur') {
        const maxH = Number(rules?.fence?.max_height_m)
        return maxH > 0 ? String(maxH) : '1.80'
    }
    return ''
}

// Build the counter-proposal shown on Étape 4: for every field the violations point to, an editable
// control pre-filled with the AI's suggested value (or a conforming default), plus the AI's "why"
// bullets and rewritten description. Nothing is hardcoded — fields come from the actual violations,
// values from the model (with a safe default fallback), hints from the extracted règlement.
function buildEditableProposal(type: string, categories: string[], aiPatch: any, aiFields: string[], aiDescription: string, rules: any) {
    const spec = FIELD_SPEC[type]
    if (!spec) return null
    const keys = fieldsForViolations(type, categories)
    if (!keys.length) return null
    const editableFields = keys.map((key) => {
        const def = spec.fields[key]
        let value = aiPatch && aiPatch[key] != null ? String(aiPatch[key]) : ''
        if (def.enum && value && !def.enum.includes(value)) value = ''
        if (!value) value = defaultFieldValue(type, key, def, rules)
        const hint = key === 'couleur'
            ? (rules?.facade?.color_restrictions || 'Teinte sobre de la palette locale, validée par l’ABF')
            : null
        return { key, label: def.label, value, options: def.enum || null, hint }
    })
    return {
        target: type,
        editableFields,
        why: Array.isArray(aiFields) ? aiFields.map((x) => String(x)).slice(0, 5) : [],
        description: (aiDescription || '').trim(),
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        // reglementText / reglementImages: the règlement already extracted in the BROWSER (pdfjs) —
        // the browser fetches + parses the PDF reliably even when the server can't, so we prefer it.
        const { plu, travaux, description_projet, coords, reglementText, reglementImages } = body

        if (!travaux || !travaux.type) {
            return NextResponse.json({ error: 'Travaux details are required' }, { status: 400 })
        }

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'AI API key not configured' }, { status: 503 })
        }

        let docUrl: string | undefined = plu?.zone?.url_doc
        const zoneLibelle: string | undefined = plu?.zone?.libelle
        // Recover the règlement URL if fetch-plu couldn't resolve it (apicarto is intermittently
        // flaky). Without this the analysis silently degrades to a rules-free "estimation".
        if (!docUrl && !plu?.isRnu && coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
            docUrl = await resolvePluDocUrl(coords.lat, coords.lon)
        }

        // Fast path: serve a cached extraction (rules change rarely) WITHOUT re-downloading or
        // re-OCR'ing the règlement. Only the deterministic evaluation re-runs (cheap).
        const cacheKeyEarly = `${docUrl || 'rnu'}|${zoneLibelle || ''}`
        const hit = !plu?.isRnu && extractionCache.get(cacheKeyEarly)
        if (hit && (Date.now() - hit.at) < CACHE_TTL_MS) {
            // strict = the rules come from the actual règlement text (not an estimation), so
            // whitelist misses (materials/colours outside the allowed lists) are hard violations.
            const evaluationResult = evaluateProject(travaux, hit.extractedRules, plu?.overlays, hit.source === 'reglement')
            // Rebuild the editable counter-proposal on cache hits too — otherwise re-analysing a
            // still-non-conforming project would silently drop the proposal + Apply button.
            if (evaluationResult.violations.length > 0) {
                const ai = sanitizeProposal(hit.aiProposalRaw, travaux.type)
                ;(evaluationResult as any).proposal = buildEditableProposal(
                    travaux.type, evaluationResult.categories, ai?.patch, ai?.fields || [], ai?.description || '', hit.extractedRules,
                )
            } else {
                (evaluationResult as any).proposal = null
            }
            // Report the règlement text length honestly: prefer the copy the browser just extracted,
            // fall back to the cached copy — so the UI never claims "0 caractères" over a readable PDF.
            const shownText = (typeof reglementText === 'string' && reglementText.trim().length > 400)
                ? targetZoneChapter(reglementText, zoneLibelle).text
                : (hit.text || '')
            return NextResponse.json({
                report: (hit.report || '').trim(), extractedRules: hit.extractedRules, evaluationResult,
                pdfType: hit.pdfType, verified: hit.source !== 'estimation', source: hit.source,
                textLength: shownText.length, extractedText: shownText,
                docUrl: docUrl || plu?.zone?.url_doc || '', cached: true,
            }, { status: 200 })
        }

        // Acquire the règlement content: clean text (text PDF) or page images (scanned PDF /
        // image) for vision-OCR. Never invent rules if unreadable.
        let pdfType: 'text' | 'scanned' | 'missing' | 'error' = 'missing'
        let pdfText = ''
        let pluImages: string[] = []
        if (!plu?.isRnu && typeof reglementText === 'string' && reglementText.trim().length > 400) {
            // Text extracted in the browser → zone-scope it and use it directly.
            pdfType = 'text'; pdfText = targetZoneChapter(reglementText, zoneLibelle).text
        } else if (!plu?.isRnu && Array.isArray(reglementImages) && reglementImages.length > 0) {
            // Scanned/image règlement rasterised in the browser → vision-OCR.
            pdfType = 'scanned'; pluImages = reglementImages.filter((u: any) => typeof u === 'string' && u.startsWith('data:')).slice(0, 10)
        } else if (docUrl && !plu?.isRnu) {
            const content = await acquirePluContent(docUrl, zoneLibelle)
            if (content.kind === 'text') { pdfType = 'text'; pdfText = content.text }
            else if (content.kind === 'images') { pdfType = 'scanned'; pluImages = content.images }
            else { pdfType = 'error' }
        }

        // Format description
        let worksDescription = ''
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            const m = travaux.menuiseries
            worksDescription = `Remplacement ou installation de menuiseries:
- Type de menuiserie: ${m.type}
- Matériau: ${m.materiau}
- Couleur: ${m.couleur} ${m.couleur_ral ? `(RAL ${m.couleur_ral})` : ''}
- Nombre d'éléments: ${m.nombre}
- Dimensions: ${m.largeur}x${m.hauteur} cm
- Mode: ${m.remplacement ? 'Remplacement' : 'Nouvelle création'}
- Description complémentaire: ${m.description || 'Aucune'}`
        } else if (travaux.type === 'isolation' && travaux.isolation) {
            const iso = travaux.isolation
            worksDescription = `Isolation Thermique Extérieure (ITE):
- Type de finition: ${iso.type_finition}
- Couleur: ${iso.couleur}
- Matériau isolant: ${iso.materiau_isolant}
- Épaisseur: ${iso.epaisseur_isolant} cm
- Façades concernées: ${iso.facades_concernees?.join(', ') || 'toutes'}
- Description complémentaire: ${iso.description || 'Aucune'}`
        } else if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
            const pv = travaux.photovoltaique
            worksDescription = `Installation photovoltaïque:
- Nombre de panneaux: ${pv.nombre_panneaux}
- Surface totale: ${pv.surface_totale} m²
- Puissance: ${pv.puissance_kw} kWc
- Intégration: ${pv.integration}
- Orientation: ${pv.orientation}
- Inclinaison: ${pv.inclinaison}°
- Description complémentaire: ${pv.description || 'Aucune'}`
        }
        // Registry-driven fallback for work types without a bespoke block above (clôture,
        // ravalement, toiture, ouverture…) so the PLU analysis always receives a works description.
        if (!worksDescription) {
            const def = getTravauxDef(travaux.type)
            if (def) {
                worksDescription = `${def.natureLabel}:
- ${def.worksLabel({ travaux } as DPFormData)}
- Description complémentaire: ${travaux.description_projet || 'Aucune'}`
            }
        }

        const zoneText = plu?.zone 
            ? `Zone PLU: ${plu.zone.libelle} (${plu.zone.nomzone || ''} - ${plu.zone.libelong || ''})
URL Règlement complet: ${plu.zone.url_doc || 'Non fourni'}`
            : 'Zone PLU non détectée (règles générales applicables).'

        const prescriptionsText = plu?.prescriptions && plu.prescriptions.length > 0
            ? plu.prescriptions.map((p: any) => `- ${p.libelle} (Type: ${p.typepresc})`).join('\n')
            : 'Aucune prescription ou servitude patrimoniale/environnementale spécifique détectée.'

        // Reliable contraintes — these come from independent APIs (Géorisques, data.culture,
        // APICarto SUP) and are available EVEN WHEN the règlement PDF isn't. Always feed them in.
        const ov = plu?.overlays || {}
        const overlaysText = [
            `Zone de sismicité : ${ov.seismicClass || 'inconnue'}`,
            `Risque inondation / PPRN : ${ov.hasFloodRisk || ov.hasPPRN ? 'OUI' : 'non détecté'}`,
            `Site Patrimonial Remarquable (SPR) : ${ov.hasSPR ? `OUI${ov.sprName ? ' — ' + ov.sprName : ''}` : 'non'}`,
            `Monuments Historiques dans un rayon de 500 m : ${(ov.monumentsWithin500m?.length || 0)}${(ov.monumentsWithin500m?.length || 0) > 0 ? ' (avis ABF requis)' : ''}`,
        ].join('\n')

        // `estimation` = the official règlement could not be read; we still produce a useful,
        // clearly-indicative analysis from the zone TYPE + national rules + the real contraintes.
        let source: 'reglement' | 'estimation' | 'rnu' = 'reglement'
        let pdfContextPrompt = ''
        if (plu?.isRnu) {
            source = 'rnu'
            pdfContextPrompt = `ATTENTION : La commune n'est pas couverte par un plan local d'urbanisme (PLU) mais est régie directement par le RÈGLEMENT NATIONAL D'URBANISME (RNU).
Tu dois te baser sur les règles nationales d'urbanisme (RNU), notamment l'article L. 111-1-2 (constructibilité limitée), l'article R. 111-21 (aspect extérieur et insertion paysagère) pour formuler ton analyse.`
        } else if (pdfType === 'text') {
            pdfContextPrompt = `TEXTE DU RÈGLEMENT PLU DE LA ZONE EXTRAIT DU DOCUMENT PDF :\n${pdfText.slice(0, PLU_TEXT_CAP)}\n`
        } else if (pdfType === 'scanned') {
            pdfContextPrompt = `IMPORTANT : Le règlement PLU est un document scanné — ses pages sont JOINTES EN IMAGES à ce message. Lis attentivement ces images (OCR), repère le chapitre de la zone ${plu?.zone?.libelle || ''}, et extrais-en les règles réelles (matériaux, couleurs, toiture, ouvertures). Ne te contente pas de généralités : cite les passages lus.`
        } else {
            // Tier 2/4 — règlement indisponible : ESTIMATION par type de zone.
            source = 'estimation'
            const zt = plu?.zone?.libelle || plu?.zone?.typezone || 'urbaine (U)'
            pdfContextPrompt = `ATTENTION : Le règlement écrit de la commune n'a pas pu être récupéré ni lu automatiquement.
Tu dois produire une ESTIMATION INDICATIVE (et non l'extrait verbatim du règlement communal), fondée sur :
- le TYPE de zone détecté (« ${zt} ») et les règles standards typiques de ce type de zone en France ;
- les règles nationales d'urbanisme applicables à défaut (Code de l'urbanisme, art. R.111-27 sur l'aspect extérieur et l'insertion paysagère) ;
- les CONTRAINTES réellement détectées ci-dessous (sismicité, inondation, SPR, Monuments Historiques) — celles-ci sont fiables et doivent primer.
Dans le rapport, indique clairement qu'il s'agit d'une estimation à confirmer avec le règlement de la commune. Renseigne quand même des valeurs réalistes typiques dans "rules" (matériaux/couleurs/extension/toiture) pour ce type de zone, et mets des "excerpts" génériques (ex: « Estimation — règle type pour zone ${zt} »).`
        }

        const fieldSpecText = fieldSpecPrompt(travaux.type)

        const prompt = `Tu es un expert d'élite en urbanisme français et instructeur de dossiers de déclaration préalable (DP).
Ton rôle est d'analyser le règlement du Plan Local d'Urbanisme (PLU) fourni, d'en extraire les règles clés de manière structurée et de rédiger une notice descriptive synthétique.

PROJET DE TRAVAUX PROPOSÉ :
${worksDescription}
Description globale du projet : ${description_projet || 'Non renseignée'}

CONTEXTE URBANISTIQUE (GÉOPORTAIL) :
${zoneText}

PRESCRIPTIONS / SERVITUDES CONSTATÉES :
${prescriptionsText}

CONTRAINTES DÉTECTÉES (sources officielles indépendantes — fiables) :
${overlaysText}

${pdfContextPrompt}

Tu dois retourner obligatoirement un objet JSON unique (sans texte d'introduction ni de conclusion, pas de bla-bla, juste le JSON). Si tu utilises des blocs de code markdown pour entourer le JSON, utilise uniquement \`\`\`json et \`\`\`.

Le JSON doit respecter exactement ce schéma :
{
  "report": string, // Rédige ici un rapport au format Markdown structuré comme suit :
                    // ### STATUT DE CONFORMITÉ
                    // Explique le statut général du projet par rapport aux règles d'urbanisme.
                    // ### DÉCRYPTAGE DE LA ZONE D'URBANISME
                    // Explication claire de la zone d'urbanisme.
                    // ### RÈGLES PLU CLÉS À CONSEILLER
                    // Énumère 3 à 4 règles clés de cette zone.
                    // ### RISQUES ET ALERTES PATRIMONIALES
                    // Analyse des servitudes patrimoniales (Monuments Historiques, SPR, ABF).
                    // ### RECOMMANDATIONS CONSTRUCTIVES
                    // Conseils pratiques pour maximiser les chances d'acceptation.
  
  "rules": {
    "zone_code": string, // Code de la zone d'urbanisme (ex: "UA", "UB", "RNU")
     "facade": {
        "allowed": boolean,
        "allowed_materials": string[],
        "forbidden_materials": string[],
        "allowed_colors": string[], // Liste des couleurs autorisées si mentionnées explicitement (ex: ["blanc", "gris"]), sinon tableau vide []
        "forbidden_colors": string[], // Liste des couleurs interdites si mentionnées explicitement (ex: ["rouge", "noir"]), sinon tableau vide []
        "color_restrictions": string | null,
        "excerpts": string[]
     },
    "extension": {
       "max_area_m2": number, // Nombre entier ou décimal (ex: 20 ou 40). Si non mentionné ou RNU, mettre 20.
       "max_height_m": number, // Hauteur maximale autorisée (ex: 9). Si non spécifié, mettre 9.
       "allowed": boolean,
       "permit_required_if_exceed": boolean,
       "excerpts": string[]
    },
    "roof": {
       "max_height_m": number,
       "allowed_materials": string[],
       "forbidden_materials": string[],
       "allowed_colors": string[], // Teintes de couverture autorisées si mentionnées explicitement, sinon []
       "forbidden_colors": string[], // Teintes de couverture interdites si mentionnées explicitement, sinon []
       "allowed_slopes": string | null,
       "excerpts": string[]
    },
    "fence": {
       "max_height_m": number | null, // Hauteur maximale de clôture si le règlement en fixe une (ex: 1.6), sinon null
       "allowed_materials": string[], // Matériaux de clôture autorisés si mentionnés explicitement, sinon []
       "forbidden_materials": string[], // Matériaux de clôture interdits si mentionnés explicitement, sinon []
       "excerpts": string[]
    },
    "window_openings": {
       "allowed": boolean,
       "conditions": string | null,
       "excerpts": string[]
    },
    "heritage_override": {
       "ABF_review": boolean, // Mettre true si le règlement du PLU mentionne des contraintes de monument historique spécifiques à cette zone
       "excerpts": string[]
    }
  },
  "proposal": null // À REMPLIR UNIQUEMENT si le projet n'est PAS conforme (sinon null). Propose une
                   // correction CONCRÈTE, réaliste et FONDÉE sur le règlement et le contexte
                   // patrimonial ci-dessus, sous la forme :
                   // {
                   //   "fields": string[],   // 1 à 4 puces en français décrivant le CHANGEMENT vers la
                   //                          // nouvelle valeur conforme (jamais l'état actuel), ex:
                   //                          // "Teinte → « ton pierre » : les teintes vives sont proscrites en secteur sauvegardé"
                   //   "patch": object,      // objet { champ: valeur } donnant des VALEURS CONCRÈTES conformes.
                   //                          // Pour un champ texte libre (ex: couleur), propose une teinte PRÉCISE
                   //                          // (ex: "Ton pierre" ou "RAL 1015"), JAMAIS la valeur actuelle non conforme.
                   //                          // N'UTILISE STRICTEMENT QUE ces champs et valeurs autorisés :
${fieldSpecText}
                   //   "description": string // nouvelle description du projet (français), conforme, prête à figurer sur la déclaration
                   // }
}`

        // ── Run extraction (cached by document+zone), or use RNU template ───────
        const cacheKey = `${docUrl || 'rnu'}|${zoneLibelle || ''}`
        let report = ''
        let extractedRules: any = null
        let aiProposalRaw: any = null   // règlement-grounded proposal from the model (project-specific)
        let verified = true

        const cached = !plu?.isRnu && extractionCache.get(cacheKey)
        if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
            report = cached.report
            extractedRules = cached.extractedRules
            pdfType = cached.pdfType as typeof pdfType
            if (cached.source) source = cached.source as typeof source
        } else if (plu?.isRnu) {
            extractedRules = RNU_RULES
            try { report = parseRulesJson(await callOpenRouter(apiKey, PLU_MODEL, prompt))?.report || '' } catch (e) { console.error('RNU report failed:', e) }
            if (!report) report = '### STATUT DE CONFORMITÉ\nCommune en RNU — analyse fondée sur le Règlement National d’Urbanisme (articles R.111-27 et L.111-3).'
        } else {
            // Build the model content: prompt text, plus scanned pages as images when applicable.
            const buildContent = (extra = '') => pluImages.length > 0
                ? [{ type: 'text', text: prompt + extra }, ...pluImages.map(u => ({ type: 'image_url', image_url: { url: u } }))]
                : prompt + extra
            const model = pluImages.length > 0 ? PLU_VISION_MODEL : PLU_MODEL

            let parsed: { report?: string; rules?: any; proposal?: any } | null = null
            try { parsed = parseRulesJson(await callOpenRouter(apiKey, model, buildContent())) }
            catch (e) { console.error('PLU model call failed:', e) }
            if (!parsed || !parsed.rules) {
                // One retry with an explicit JSON-only nudge.
                try { parsed = parseRulesJson(await callOpenRouter(apiKey, model, buildContent('\n\nRappel: réponds UNIQUEMENT avec l’objet JSON valide demandé, sans aucun texte autour.'))) }
                catch (e) { console.error('PLU retry failed:', e) }
            }
            if (parsed) {
                report = parsed.report || ''
                extractedRules = parsed.rules || null
                aiProposalRaw = parsed.proposal ?? null
            }
            if (extractedRules) extractionCache.set(cacheKey, { report, extractedRules, pdfType, source, text: pdfText, aiProposalRaw, at: Date.now() })
        }

        // An estimation (règlement not read) is never "verified", even when the model returned rules.
        if (source === 'estimation') verified = false

        // Last resort — even the estimation model call failed entirely (rare). Keep an honest note.
        let unreadable = false
        if (!extractedRules) {
            verified = false
            unreadable = true
            source = 'estimation'
            extractedRules = {
                zone_code: zoneLibelle || 'Inconnue', _unverified: true,
                facade: { allowed: true, allowed_materials: [], forbidden_materials: [], allowed_colors: [], forbidden_colors: [], color_restrictions: null, excerpts: [] },
                extension: { max_area_m2: 20, max_height_m: 9, allowed: true, permit_required_if_exceed: true, excerpts: [] },
                roof: { max_height_m: 9, allowed_materials: [], forbidden_materials: [], allowed_colors: [], forbidden_colors: [], allowed_slopes: null, excerpts: [] },
                fence: { max_height_m: null, allowed_materials: [], forbidden_materials: [], excerpts: [] },
                window_openings: { allowed: true, conditions: null, excerpts: [] },
                heritage_override: { ABF_review: false, excerpts: [] },
            }
            if (!report) report = '### STATUT DE CONFORMITÉ\nL’analyse automatique n’a pas pu aboutir. Vérifiez la conformité directement à partir du règlement de la commune et des contraintes détectées ci-dessus.'
        }

        // In a protected sector the aspect rules are known regardless of whether the règlement PDF
        // was read — reflect them in the DISPLAYED rules so the "Comparatif" shows real restrictions
        // (not "Non restreint"). The verdict itself is computed deterministically in evaluateProject.
        const inHeritage = !!(plu?.overlays?.hasSPR || (plu?.overlays?.monumentsWithin500m?.length || 0) > 0)
        if (inHeritage && extractedRules?.facade) {
            const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)))
            extractedRules.facade.forbidden_materials = uniq([...(extractedRules.facade.forbidden_materials || []), 'PVC', 'tôle', 'bardage métal', 'aluminium brut'])
            extractedRules.facade.forbidden_colors = uniq([...(extractedRules.facade.forbidden_colors || []), 'teintes vives'])
            if (!extractedRules.facade.color_restrictions) extractedRules.facade.color_restrictions = "Teintes sobres de la palette locale, validées par l'ABF (secteur protégé)."
            extractedRules.roof = extractedRules.roof || { max_height_m: 9, allowed_materials: [], forbidden_materials: [], allowed_slopes: null, excerpts: [] }
            extractedRules.roof.forbidden_materials = uniq([...(extractedRules.roof.forbidden_materials || []), 'bac acier', 'tôle', 'zinc', 'fibrociment'])
            extractedRules.fence = extractedRules.fence || { max_height_m: null, allowed_materials: [], forbidden_materials: [], excerpts: [] }
            extractedRules.fence.forbidden_materials = uniq([...(extractedRules.fence.forbidden_materials || []), 'PVC', 'plaque de béton'])
            extractedRules.heritage_override = { ...(extractedRules.heritage_override || {}), ABF_review: true }
        }

        const evaluationResult = evaluateProject(travaux, extractedRules, plu?.overlays, source === 'reglement')
        if (!verified) {
            // An ESTIMATION is uncertain — but hard violations (esp. heritage ones, derived from the
            // reliable SPR/MH overlays) must stand. Only soften a verdict that found no violation.
            if (evaluationResult.violations.length === 0 && !/NON.?CONFORME/i.test(evaluationResult.status)) {
                evaluationResult.status = 'CONFORMITÉ INCERTAINE'
            }
            evaluationResult.warnings.push(
                unreadable
                    ? 'Le règlement PLU n’a pas pu être analysé automatiquement : confirmez la conformité manuellement à partir du document officiel.'
                    : 'Analyse ESTIMATIVE : le règlement écrit de la commune n’a pas pu être récupéré. Les règles ci-dessus sont une estimation fondée sur le type de zone et les règles nationales (art. R.111-27) ; les contraintes détectées (sismicité, inondation, SPR, Monuments Historiques) sont en revanche fiables. À confirmer avec le règlement officiel de la commune.'
            )
        }

        // Prefer the model's règlement-grounded proposal (sanitised to valid form fields/values) over
        // the deterministic fallback — but only when there IS a non-conformity to correct.
        if (evaluationResult.violations.length > 0) {
            const ai = sanitizeProposal(aiProposalRaw, travaux.type)
            ;(evaluationResult as any).proposal = buildEditableProposal(
                travaux.type, evaluationResult.categories, ai?.patch, ai?.fields || [], ai?.description || '', extractedRules,
            )
        } else {
            (evaluationResult as any).proposal = null
        }

        return NextResponse.json({
            report: report.trim(),
            extractedRules,
            evaluationResult,
            pdfType,
            verified,
            source,
            textLength: pdfText.length,
            extractedText: pdfText,
            docUrl: docUrl || plu?.zone?.url_doc || '',   // resolved URL, so the client can show the PDF
        }, { status: 200 })

    } catch (err: any) {
        console.error('Error in analyze-plu:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
