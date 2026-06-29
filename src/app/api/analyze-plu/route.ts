import { NextRequest, NextResponse } from 'next/server'
import * as pdfParser from 'pdf-parse'

export const maxDuration = 60

async function extractTextFromPdfUrl(url: string): Promise<{ text: string; type: 'text' | 'scanned' | 'error' }> {
    try {
        console.log(`Downloading PDF from URL: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
            console.error(`Failed to download PDF: ${response.statusText}`)
            return { text: '', type: 'error' }
        }
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        // @ts-ignore
        const parseFunc = pdfParser.default || pdfParser
        const data = await parseFunc(buffer)
        const text = data.text || ''
        if (text.trim().length < 200) {
            return { text, type: 'scanned' }
        }
        return { text, type: 'text' }
    } catch (error) {
        console.error('Error parsing PDF:', error)
        return { text: '', type: 'error' }
    }
}

function evaluateProject(travaux: any, rules: any, overlays: any) {
    const violations: string[] = []
    const warnings: string[] = []
    let decision = "DECLARATION_PREALABLE_OK"
    let status = "PROBABLEMENT CONFORME"

    // 1. Evaluate surfaces (extension)
    const creeeSurface = parseFloat(travaux.surfaces?.creee || '0')
    const maxArea = rules?.extension?.max_area_m2 || 20

    if (creeeSurface > 0) {
        if (creeeSurface > maxArea) {
            decision = "PERMIS_CONSTRUIRE"
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La surface créée (${creeeSurface} m²) dépasse le seuil maximal de la Déclaration Préalable de ${maxArea} m² pour cette zone (un Permis de Construire est requis).`)
        } else if (creeeSurface > 150) {
            decision = "PERMIS_CONSTRUIRE"
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La surface de plancher totale après travaux dépassera 150 m², ce qui nécessite un Permis de Construire avec recours obligatoire à un architecte.`)
        }
    }

    // 2. Evaluate materials / facade
    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        const material = (m.materiau || '').toLowerCase()
        
        const forbiddenMaterials = (rules?.facade?.forbidden_materials || []).map((x: string) => x.toLowerCase())
        const allowedMaterials = (rules?.facade?.allowed_materials || []).map((x: string) => x.toLowerCase())

        if (forbiddenMaterials.some((fm: string) => material.includes(fm))) {
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`Le matériau proposé (${m.materiau}) est explicitement interdit pour les menuiseries dans cette zone.`)
        } else if (allowedMaterials.length > 0 && !allowedMaterials.some((am: string) => material.includes(am))) {
            status = "CONFORMITÉ INCERTAINE"
            warnings.push(`Le matériau proposé (${m.materiau}) ne fait pas partie de la liste des matériaux recommandés ou autorisés (${rules.facade.allowed_materials.join(', ')}).`)
        }
    }

    // Evaluate colors (applicable to menuiseries & isolation)
    let proposedColor = ""
    let displayColor = ""
    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        displayColor = travaux.menuiseries.couleur + (travaux.menuiseries.couleur_ral ? ` (RAL ${travaux.menuiseries.couleur_ral})` : '')
        proposedColor = (travaux.menuiseries.couleur || '') + ' ' + (travaux.menuiseries.couleur_ral || '')
    } else if (travaux.type === 'isolation' && travaux.isolation) {
        displayColor = travaux.isolation.couleur || ''
        proposedColor = displayColor
    }

    proposedColor = proposedColor.toLowerCase().trim()

    if (proposedColor) {
        const forbiddenColors = (rules?.facade?.forbidden_colors || []).map((x: string) => x.toLowerCase())
        const allowedColors = (rules?.facade?.allowed_colors || []).map((x: string) => x.toLowerCase())

        if (forbiddenColors.some((fc: string) => proposedColor.includes(fc))) {
            status = "PROBABLEMENT NON-CONFORME"
            violations.push(`La couleur proposée (${displayColor}) est explicitement interdite par le règlement de cette zone (${rules.facade.forbidden_colors.join(', ')}).`)
        } else if (allowedColors.length > 0 && !allowedColors.some((ac: string) => proposedColor.includes(ac))) {
            status = "CONFORMITÉ INCERTAINE"
            warnings.push(`La couleur proposée (${displayColor}) ne fait pas partie de la liste des couleurs explicitement autorisées (${rules.facade.allowed_colors.join(', ')}).`)
        }

        // Evaluate general color restrictions (e.g. "teintes claires")
        if (rules?.facade?.color_restrictions) {
            const restrictions = rules.facade.color_restrictions.toLowerCase()
            if (restrictions.includes('clair') && (proposedColor.includes('fonce') || proposedColor.includes('sombre') || proposedColor.includes('noir') || proposedColor.includes('anthracite') || proposedColor.includes('ral 7016'))) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`Le projet propose une teinte foncée (${displayColor}) alors que le PLU préconise des teintes claires ("${rules.facade.color_restrictions}").`)
            }
        }
    }
    // Evaluate heritage override rules deterministically
    const isInHeritageZone = !!(overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0))
    if (isInHeritageZone) {
        // PVC check in historic zones
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            const material = (travaux.menuiseries.materiau || '').toLowerCase()
            if (material.includes('pvc')) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`Le PVC (${travaux.menuiseries.materiau}) est généralement interdit ou fortement déconseillé dans les secteurs sauvegardés (SPR) et abords de Monuments Historiques. Un matériau traditionnel (bois ou aluminium thermolaqué) est vivement recommandé pour éviter un refus de l'ABF.`)
            }
        }

        // Color check in historic zones
        if (proposedColor) {
            const forbiddenHistoricColors = ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange', 'rose', 'fluo', 'brillant']
            const matchesBrightColor = forbiddenHistoricColors.some(c => 
                proposedColor.includes(c) && 
                !proposedColor.includes('fonce') && 
                !proposedColor.includes('sombre') &&
                !proposedColor.includes('sable') &&
                !proposedColor.includes('pastel')
            )
            if (matchesBrightColor) {
                status = "CONFORMITÉ INCERTAINE"
                warnings.push(`La couleur proposée (${displayColor}) semble trop vive ou non conforme aux palettes de teintes historiques. Dans le périmètre de protection (SPR/MH), seules les teintes de la palette locale ou les tons neutres et historiques (gris, beige, terre, bois) sont autorisés.`)
            }
        }
    }

    // 3. Evaluate overlays (Seismic / Flood / Heritage)
    if (overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0)) {
        if (decision !== "PERMIS_CONSTRUIRE") {
            decision = "DECLARATION_PREALABLE_ABF"
        }
        warnings.push(`Le projet se situe dans un secteur sauvegardé (SPR) ou à proximité (<500m) d'un Monument Historique. L'avis conforme de l'Architecte des Bâtiments de France (ABF) est obligatoire, ce qui porte le délai d'instruction légal à 2 mois.`)
    }

    if (overlays?.hasFloodRisk || overlays?.hasPPRN) {
        warnings.push(`Le terrain est assujetti à un Plan de Prévention des Risques Naturels (PPRN) d'inondation. Vous devrez respecter les prescriptions de sécurité requises par ce règlement.`)
    }

    if (overlays?.seismicZone && parseInt(overlays.seismicZone) >= 3) {
        warnings.push(`La commune est classée en zone de sismicité ${overlays.seismicClass}. La construction doit se conformer aux normes de sécurité parasismique applicables.`)
    }

    return {
        status,
        decision,
        violations,
        warnings
    }
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

        let pdfType: 'text' | 'scanned' | 'missing' | 'error' = 'missing'
        let pdfText = ''
        if (plu?.zone?.url_doc) {
            const extractResult = await extractTextFromPdfUrl(plu.zone.url_doc)
            pdfType = extractResult.type
            pdfText = extractResult.text
            if (pdfText.length > 150000) {
                pdfText = pdfText.substring(0, 150000) + '\n[TEXT TRUNCATED DUE TO LENGTH]'
            }
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

        const zoneText = plu?.zone 
            ? `Zone PLU: ${plu.zone.libelle} (${plu.zone.nomzone || ''} - ${plu.zone.libelong || ''})
URL Règlement complet: ${plu.zone.url_doc || 'Non fourni'}`
            : 'Zone PLU non détectée (règles générales applicables).'

        const prescriptionsText = plu?.prescriptions && plu.prescriptions.length > 0
            ? plu.prescriptions.map((p: any) => `- ${p.libelle} (Type: ${p.typepresc})`).join('\n')
            : 'Aucune prescription ou servitude patrimoniale/environnementale spécifique détectée.'

        let pdfContextPrompt = ''
        if (plu?.isRnu) {
            pdfContextPrompt = `ATTENTION : La commune n'est pas couverte par un plan local d'urbanisme (PLU) mais est régie directement par le RÈGLEMENT NATIONAL D'URBANISME (RNU).
Tu dois te baser sur les règles nationales d'urbanisme (RNU), notamment l'article L. 111-1-2 (constructibilité limitée), l'article R. 111-21 (aspect extérieur et insertion paysagère) pour formuler ton analyse.`
        } else if (pdfType === 'text') {
            pdfContextPrompt = `TEXTE DU RÈGLEMENT PLU DE LA ZONE EXTRAIT DU DOCUMENT PDF :\n${pdfText}\n`
        } else if (pdfType === 'scanned') {
            pdfContextPrompt = `ATTENTION : Le document de règlement PDF de la zone est une image numérisée (scannée).
Tu dois te baser sur le libellé de la zone (${plu?.zone?.libelle || 'inconnue'}), sur les prescriptions détectées, et sur tes connaissances expertes des règles d'urbanisme typiques en France pour ce type de zone pour formuler ton analyse.`
        } else {
            pdfContextPrompt = `ATTENTION : Le document de règlement PDF n'est pas disponible.
Tu dois te baser sur les informations du Géoportail (zonage, prescriptions) et sur tes connaissances d'expert des règlements d'urbanisme standards en France.`
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

        const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions'
        const response = await fetch(openrouterUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/ayouubmzariiii/DP-Last',
                'X-Title': 'DP Travaux PLU Scanner'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 2000
            })
        })

        if (!response.ok) {
            const errText = await response.text()
            throw new Error(`OpenRouter Error: ${response.status} ${errText}`)
        }

        const data = await response.json()
        const reportRaw = data.choices?.[0]?.message?.content || 'Erreur lors de la génération du rapport.'

        let report = 'Erreur lors de la génération du rapport.'
        let extractedRules: any = null

        if (plu?.isRnu) {
            extractedRules = {
                zone_code: "RNU",
                facade: {
                    allowed: true,
                    allowed_materials: ["bois", "aluminium", "pvc", "pierre"],
                    forbidden_materials: [],
                    allowed_colors: [],
                    forbidden_colors: [],
                    color_restrictions: "Harmonie paysagère locale requise.",
                    excerpts: ["Article R. 111-21 du Code de l'Urbanisme"]
                },
                extension: {
                    max_area_m2: 20,
                    max_height_m: 9,
                    allowed: true,
                    permit_required_if_exceed: true,
                    excerpts: ["Article L. 111-1-2 du Code de l'Urbanisme (Constructibilité limitée)"]
                },
                roof: {
                    max_height_m: 9,
                    allowed_materials: ["tuile", "ardoise"],
                    forbidden_materials: [],
                    allowed_slopes: "Respect des pentes locales",
                    excerpts: ["Article R. 111-21"]
                },
                window_openings: {
                    allowed: true,
                    conditions: "Respect de l'aspect général des baies existantes",
                    excerpts: []
                },
                heritage_override: {
                    ABF_review: false,
                    excerpts: []
                }
            }
            report = reportRaw 
        } else {
            try {
                let cleanText = reportRaw.trim()
                if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '').trim()
                }
                const parsed = JSON.parse(cleanText)
                report = parsed.report || reportRaw
                extractedRules = parsed.rules || null
            } catch (e) {
                console.error('Failed to parse OpenRouter response as JSON, falling back:', e)
                report = reportRaw
            }
        }

        if (!extractedRules) {
            extractedRules = {
                zone_code: plu?.zone?.libelle || 'Inconnue',
                facade: { allowed: true, allowed_materials: ["bois", "aluminium", "pvc"], forbidden_materials: [], allowed_colors: [], forbidden_colors: [], color_restrictions: null, excerpts: [] },
                extension: { max_area_m2: 20, max_height_m: 9, allowed: true, permit_required_if_exceed: true, excerpts: [] },
                roof: { max_height_m: 9, allowed_materials: ["tuile", "ardoise"], forbidden_materials: [], allowed_slopes: null, excerpts: [] },
                window_openings: { allowed: true, conditions: null, excerpts: [] },
                heritage_override: { ABF_review: false, excerpts: [] }
            }
        }

        const evaluationResult = evaluateProject(travaux, extractedRules, plu?.overlays)

        return NextResponse.json({
            report: report.trim(),
            extractedRules,
            evaluationResult,
            pdfType,
            textLength: pdfText.length,
            extractedText: pdfText
        }, { status: 200 })

    } catch (err: any) {
        console.error('Error in analyze-plu:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
