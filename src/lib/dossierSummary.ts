// ─────────────────────────────────────────────────────────────────────────────
// Dossier card summary — the lightweight snapshot shown on the dashboard.
//
// Computed server-side at WRITE time (POST/PUT /api/dossiers*) and stored in the
// `summary` jsonb column, so listing dossiers never has to load the full `data`
// payload. Legacy rows without a summary are self-healed on first list.
// ─────────────────────────────────────────────────────────────────────────────
import type { DPFormData } from '@/lib/models'
import { getTravauxDef } from '@/lib/travauxRegistry'
import { isProtectedSector } from '@/lib/validation'

export interface DossierFilesSummary {
    situation: boolean
    masse: boolean
    notice: boolean
    photos: number
    simulations: number
    croquis: number
}

export interface DossierSummary {
    // "Empty" = nothing but the account-seeded identity (no terrain, works, content or
    // files). Empty dossiers are not shown as real projects on the dashboard.
    empty: boolean
    summary: {
        applicant: string
        address: string
        worksType: string
        files: DossierFilesSummary
        // Secteur protégé (SPR / abords MH) : avis ABF → délai d'instruction porté à 2 mois.
        // Absent (undefined) sur les résumés antérieurs à ce champ — traité comme "inconnu".
        abf?: boolean
        // Vignette du projet : la photo « avant » de la façade principale (ou DP7 à défaut).
        // null = pas de photo ; absent (undefined) = résumé antérieur à ce champ (re-généré au list).
        photo?: string | null
    }
}

// Derive the key identity/works details to show on the profile card, the saved/generated
// files, and whether the dossier is still "empty".
export function summarizeDossier(data: DPFormData): DossierSummary {
    const d = data?.demandeur || ({} as DPFormData['demandeur'])
    const t = data?.terrain || ({} as DPFormData['terrain'])
    const tr = data?.travaux || ({} as DPFormData['travaux'])
    const ph = data?.photos || ({} as DPFormData['photos'])
    const pl = data?.plans || ({} as DPFormData['plans'])
    const facades = ph.facades || []

    const applicant = (d.est_societe ? d.nom_societe : [d.prenom, d.nom].filter(Boolean).join(' ')).trim()
    const fmtAddr = (voie?: string, cp?: string, ville?: string) =>
        [voie, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const address = t.meme_adresse
        ? fmtAddr(d.adresse, d.code_postal, d.commune)
        : fmtAddr(t.adresse, t.code_postal, t.commune)
    const worksType = getTravauxDef(tr.type)?.natureLabel || ''

    const files: DossierFilesSummary = {
        situation: !!pl.dp1_carte_situation,
        masse: !!pl.dp2_plan_masse,
        notice: !!pl.dp4_notice,
        photos: facades.filter(f => f.before).length + (ph.dp7_vue_proche ? 1 : 0) + (ph.dp8_vue_lointaine ? 1 : 0),
        simulations: facades.filter(f => f.after).length,
        croquis: facades.filter(f => f.croquis).length,
    }
    const hasFiles = files.situation || files.masse || files.notice || files.photos > 0 || files.simulations > 0 || files.croquis > 0
    const hasWork = !!tr.type
    const hasTerrain = !!(t.adresse || t.section_cadastrale || t.coords)
    const hasContent = !!(t.description_projet || tr.description_projet)
    const empty = !hasWork && !hasTerrain && !hasContent && !hasFiles

    // Card thumbnail: prefer the main façade's "before" photo, then any façade, then DP7,
    // then the legacy field. Only URLs (blob https or /public paths) — never inline base64,
    // which would bloat the summary column.
    const isUrl = (u?: string | null): u is string => !!u && (u.startsWith('http') || u.startsWith('/'))
    const photo = [
        facades.find(f => f.type === 'avant')?.before,
        facades.find(f => f.before)?.before,
        ph.dp7_vue_proche,
        ph.facade_avant,
    ].find(isUrl) ?? null

    return { empty, summary: { applicant, address, worksType, files, abf: isProtectedSector(data), photo } }
}
