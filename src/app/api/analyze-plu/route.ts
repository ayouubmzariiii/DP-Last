import { NextRequest, NextResponse } from 'next/server'
import { acquirePluContent } from '@/lib/pluExtractor'
import { DPFormData } from '@/lib/models'
import { getTravauxDef } from '@/lib/travauxRegistry'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Models (override via env). Default to OpenRouter's free auto-router, which is vision-capable
// and works with any OpenRouter key (no credits required). For higher accuracy on legal text /
// scanned règlements, set OPENROUTER_PLU_MODEL (and optionally OPENROUTER_VISION_MODEL) to a
// stronger model your key can access, e.g. 'google/gemini-3.5-flash'.
const PLU_MODEL = process.env.OPENROUTER_PLU_MODEL || 'openrouter/free'
const PLU_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || PLU_MODEL

// In-memory extraction cache keyed by document URL + zone (règlements change rarely → big
// reliability/latency/cost win for repeat addresses in the same zone).
type CachedExtraction = { report: string; extractedRules: any; pdfType: string; source?: string; at: number }
const extractionCache = new Map<string, CachedExtraction>()
const CACHE_TTL_MS = 24 * 3600 * 1000

async function callOpenRouter(apiKey: string, model: string, content: any, maxTokens = 2400): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ayouubmzariiii/DP-Last',
            'X-Title': 'DP Travaux PLU Scanner',
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            temperature: 0.15,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
        }),
    })
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
    roof: { max_height_m: 9, allowed_materials: ['tuile', 'ardoise'], forbidden_materials: [], allowed_slopes: 'Respect des pentes locales', excerpts: ['Article R. 111-27'] },
    window_openings: { allowed: true, conditions: "Respect de l'aspect général des baies existantes", excerpts: [] },
    heritage_override: { ABF_review: false, excerpts: [] },
}

// Accent- and case-insensitive normalisation for robust keyword matching.
const norm = (s: any): string => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const normList = (arr: any): string[] => (Array.isArray(arr) ? arr : []).map(norm).filter(Boolean)

// What the project actually proposes, per work type — so the rules apply to EVERY type, not just
// menuiseries/isolation. Returns raw strings (for messages) + normalised strings (for matching).
function proposedAspects(travaux: any) {
    const t = travaux.type
    let facadeRaw = '', colorRaw = '', roofRaw = ''
    let isPV = false, pvVisible = false, fenceHeight = 0, openingVisible = false
    if (t === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        facadeRaw = m.materiau || ''
        colorRaw = `${m.couleur || ''}${m.couleur_ral ? ` (RAL ${m.couleur_ral})` : ''}`.trim()
    } else if (t === 'isolation' && travaux.isolation) {
        const iso = travaux.isolation
        facadeRaw = `${(iso.type_finition || '').replace(/_/g, ' ')} ${iso.materiau_isolant || ''}`.trim()
        colorRaw = iso.couleur || ''
    } else if (t === 'photovoltaique' && travaux.photovoltaique) {
        const pv = travaux.photovoltaique
        isPV = true
        pvVisible = norm(pv.integration) === 'surimposition' || /rue|visible|voie|public/.test(norm(pv.description))
    } else if (t === 'cloture' && travaux.cloture) {
        const c = travaux.cloture
        facadeRaw = `${c.materiau || ''} ${(c.type_cloture || '').replace(/_/g, ' ')}`.trim()
        colorRaw = c.couleur || ''
        fenceHeight = parseFloat((c.hauteur || '0').toString().replace(',', '.')) || 0
    } else if (t === 'ravalement' && travaux.ravalement) {
        const r = travaux.ravalement
        facadeRaw = `${r.finition || ''} ${r.materiau || ''}`.trim()
        colorRaw = r.couleur || ''
    } else if (t === 'toiture' && travaux.toiture) {
        roofRaw = travaux.toiture.materiau_couverture || ''
        colorRaw = travaux.toiture.couleur || ''
    } else if (t === 'ouverture' && travaux.ouverture) {
        openingVisible = /rue|voie|visible|facade|toit/.test(norm(travaux.ouverture.facade))
    }
    return {
        facadeRaw, colorRaw, roofRaw,
        facade: norm(facadeRaw), color: norm(colorRaw), roof: norm(roofRaw),
        isPV, pvVisible, fenceHeight, openingVisible,
    }
}

function evaluateProject(travaux: any, rules: any, overlays: any) {
    // Dedupe violations by category so the règlement-based and heritage checks never double-count.
    const V = new Map<string, string>()
    const warnings: string[] = []
    const violate = (cat: string, msg: string) => { if (!V.has(cat)) V.set(cat, msg) }
    let decision = 'DECLARATION_PREALABLE_OK'

    const heritage = !!(overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0))
    const a = proposedAspects(travaux)

    // ── 1. Surfaces (extension) ──────────────────────────────────────────────
    const creeeSurface = parseFloat(travaux.surfaces?.creee || '0')
    const maxArea = rules?.extension?.max_area_m2 || 20
    if (creeeSurface > 0) {
        if (creeeSurface > 150) {
            decision = 'PERMIS_CONSTRUIRE'
            violate('surface', `La surface de plancher créée porte le total au-delà de 150 m² : un Permis de Construire avec recours à un architecte est requis (au-delà de la Déclaration Préalable).`)
        } else if (creeeSurface > maxArea) {
            decision = 'PERMIS_CONSTRUIRE'
            violate('surface', `La surface créée (${creeeSurface} m²) dépasse le seuil de la Déclaration Préalable pour cette zone (${maxArea} m²) : un Permis de Construire est requis.`)
        }
    }

    // ── 2. Façade / menuiserie material — heritage proscriptions are RELIABLE (overlays), so they
    //       yield HARD violations even when the règlement PDF couldn't be read. ──────────────────
    const heritageProscribedMat = ['pvc', 'tole', 'bac acier', 'bardage metal', 'aluminium brut', 'fibrociment', 'beton brut', 'plastique']
    if (a.facade) {
        if (heritage && heritageProscribedMat.some(x => a.facade.includes(x))) {
            violate('facade_mat', `Matériau « ${a.facadeRaw} » proscrit en secteur protégé (SPR / PSMV / abords de Monument Historique) : l'ABF impose des matériaux traditionnels (bois, pierre, enduit à la chaux). Refus très probable en l'état.`)
        } else if (normList(rules?.facade?.forbidden_materials).some(x => a.facade.includes(x))) {
            violate('facade_mat', `Matériau « ${a.facadeRaw} » interdit par le règlement de la zone.`)
        }
    }

    // ── 3. Colour — bright/vivid teintes are proscribed in protected sectors ──────────────────────
    if (a.color) {
        const bright = ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'rose', 'violet', 'turquoise', 'fuchsia', 'fluo', 'flashy', 'vif']
        const neutral = ['fonce', 'sombre', 'pastel', 'sable', 'naturel', 'anthracite', 'ardoise', 'taupe', 'gris', 'beige', 'blanc', 'creme', 'ecru', 'pierre', 'bois']
        const isBright = a.color.includes('vif') || (bright.some(b => a.color.includes(b)) && !neutral.some(n => a.color.includes(n)))
        if (heritage && isBright) {
            violate('color', `Teinte « ${a.colorRaw} » proscrite en secteur protégé : seules les teintes sobres de la palette locale, validées par l'ABF, sont admises.`)
        } else if (normList(rules?.facade?.forbidden_colors).some(x => a.color.includes(x))) {
            violate('color', `Teinte « ${a.colorRaw} » interdite par le règlement de la zone.`)
        }
    }

    // ── 4. Roof covering ─────────────────────────────────────────────────────
    if (a.roof) {
        const badRoof = ['bac acier', 'tole', 'zinc', 'fibrociment', 'bardeau', 'shingle', 'plastique']
        if (heritage && badRoof.some(x => a.roof.includes(x))) {
            violate('roof', `Couverture « ${a.roofRaw} » proscrite en secteur protégé : les toitures doivent être en tuile ou lauze traditionnelle. Refus très probable de l'ABF.`)
        } else if (normList(rules?.roof?.forbidden_materials).some(x => a.roof.includes(x))) {
            violate('roof', `Matériau de couverture « ${a.roofRaw} » interdit par le règlement de la zone.`)
        }
    }

    // ── 5. Photovoltaïque visible / ouverture visible / hauteur de clôture ───────────────────────
    if (a.isPV && heritage && a.pvVisible) {
        violate('pv', `Panneaux photovoltaïques en surimposition visibles depuis l'espace public : généralement refusés en secteur protégé (SPR / abords de Monument Historique). Une pose non visible depuis la rue, ou intégrée, est requise.`)
    }
    if (a.openingVisible && heritage) {
        violate('opening', `Création / modification d'ouverture sur une façade ou un versant de toiture visible depuis la rue, en secteur protégé : soumise à l'avis conforme de l'ABF et généralement refusée lorsqu'elle altère la composition d'origine (ex. fenêtre de toit sur le versant donnant sur rue).`)
    }
    if (a.fenceHeight > 2) {
        warnings.push(`Hauteur de clôture (${a.fenceHeight} m) supérieure au plafond usuel (≈ 2 m) en centre ancien : à confirmer avec le règlement communal.`)
    }

    // ── 6. Overlays (heritage / flood / seismic) ─────────────────────────────
    if (heritage) {
        if (decision !== 'PERMIS_CONSTRUIRE') decision = 'DECLARATION_PREALABLE_ABF'
        warnings.push(`Projet en secteur sauvegardé (SPR / PSMV) ou aux abords d'un Monument Historique : l'avis conforme de l'Architecte des Bâtiments de France (ABF) est obligatoire (délai d'instruction porté à 2 mois).`)
    }
    if (overlays?.hasFloodRisk || overlays?.hasPPRN) {
        warnings.push(`Le terrain est concerné par un risque d'inondation / un Plan de Prévention des Risques Naturels (PPRN) : les prescriptions de sécurité correspondantes devront être respectées.`)
    }
    if (overlays?.seismicZone && parseInt(overlays.seismicZone) >= 3) {
        warnings.push(`Commune en zone de sismicité ${overlays.seismicClass} : les normes de construction parasismiques s'appliquent.`)
    }

    const violations = Array.from(V.values())
    const status = violations.length ? 'NON CONFORME' : 'PROBABLEMENT CONFORME'
    return { status, decision, violations, warnings }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { plu, travaux, description_projet } = body

        if (!travaux || !travaux.type) {
            return NextResponse.json({ error: 'Travaux details are required' }, { status: 400 })
        }

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'AI API key not configured' }, { status: 503 })
        }

        const docUrl: string | undefined = plu?.zone?.url_doc
        const zoneLibelle: string | undefined = plu?.zone?.libelle

        // Fast path: serve a cached extraction (rules change rarely) WITHOUT re-downloading or
        // re-OCR'ing the règlement. Only the deterministic evaluation re-runs (cheap).
        const cacheKeyEarly = `${docUrl || 'rnu'}|${zoneLibelle || ''}`
        const hit = !plu?.isRnu && extractionCache.get(cacheKeyEarly)
        if (hit && (Date.now() - hit.at) < CACHE_TTL_MS) {
            const evaluationResult = evaluateProject(travaux, hit.extractedRules, plu?.overlays)
            return NextResponse.json({
                report: (hit.report || '').trim(), extractedRules: hit.extractedRules, evaluationResult,
                pdfType: hit.pdfType, verified: true, textLength: 0, extractedText: '', cached: true,
            }, { status: 200 })
        }

        // Acquire the règlement content: clean text (text PDF) or page images (scanned PDF /
        // image) for vision-OCR. Never invent rules if unreadable.
        let pdfType: 'text' | 'scanned' | 'missing' | 'error' = 'missing'
        let pdfText = ''
        let pluImages: string[] = []
        if (docUrl && !plu?.isRnu) {
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
            pdfContextPrompt = `TEXTE DU RÈGLEMENT PLU DE LA ZONE EXTRAIT DU DOCUMENT PDF :\n${pdfText}\n`
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
       "allowed_slopes": string | null,
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
  }
}`

        // ── Run extraction (cached by document+zone), or use RNU template ───────
        const cacheKey = `${docUrl || 'rnu'}|${zoneLibelle || ''}`
        let report = ''
        let extractedRules: any = null
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

            let parsed: { report?: string; rules?: any } | null = null
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
            }
            if (extractedRules) extractionCache.set(cacheKey, { report, extractedRules, pdfType, source, at: Date.now() })
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
                roof: { max_height_m: 9, allowed_materials: [], forbidden_materials: [], allowed_slopes: null, excerpts: [] },
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
            extractedRules.heritage_override = { ...(extractedRules.heritage_override || {}), ABF_review: true }
        }

        const evaluationResult = evaluateProject(travaux, extractedRules, plu?.overlays)
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

        return NextResponse.json({
            report: report.trim(),
            extractedRules,
            evaluationResult,
            pdfType,
            verified,
            source,
            textLength: pdfText.length,
            extractedText: pdfText,
        }, { status: 200 })

    } catch (err: any) {
        console.error('Error in analyze-plu:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
