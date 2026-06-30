// ─────────────────────────────────────────────────────────────────────────────
// DP-Last — Dossier validation & completeness engine
//
// Pure, framework-agnostic functions (run on client AND server). Produce a
// structured list of issues for the whole DPFormData so the wizard can:
//   • block "Étape suivante" on fatal field errors per step,
//   • render a completeness checklist on the final step, and
//   • refuse to generate a legally-invalid dossier server-side.
//
// Severity model (chosen with the owner: dossiers are expert-reviewed before
// filing, scope is renovation of an existing maison individuelle):
//   • 'fatal' — legally essential; a dossier missing this is not recevable.
//               Generation is hard-blocked.
//   • 'warn'  — strongly recommended / conditional; surfaced loudly but the
//               reviewing expert may proceed deliberately.
// ─────────────────────────────────────────────────────────────────────────────

import { DPFormData } from './models'

export type Severity = 'fatal' | 'warn'
export type StepId = 1 | 2 | 3 | 4 | 7

export interface ValidationIssue {
    id: string
    step: StepId
    section: string
    field?: string
    severity: Severity
    message: string
}

// ── Format helpers (exported for inline field-level checks in the UI) ────────
export const isValidFrenchDate = (v: string): boolean =>
    /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test((v || '').trim())

export const isValidISODate = (v: string): boolean =>
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test((v || '').trim())

export const isValidDate = (v: string): boolean =>
    isValidFrenchDate(v) || isValidISODate(v)

export const isValidPostal = (v: string): boolean => /^\d{5}$/.test((v || '').trim())

export const isValidEmail = (v: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim())

export const isValidSiret = (v: string): boolean =>
    /^\d{14}$/.test((v || '').replace(/\s/g, ''))

export const isValidPhone = (v: string): boolean =>
    /^\d{9,10}$/.test((v || '').replace(/[\s.\-]/g, ''))

const num = (v: string | undefined): number | null => {
    if (v === undefined || v === null || `${v}`.trim() === '') return null
    const n = Number(`${v}`.replace(',', '.'))
    return Number.isFinite(n) ? n : NaN as unknown as number
}

const blank = (v: string | undefined | null): boolean => !v || `${v}`.trim() === ''

// ─────────────────────────────────────────────────────────────────────────────
// Main validator
// ─────────────────────────────────────────────────────────────────────────────
export function validateDPForm(data: DPFormData): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const add = (
        step: StepId, section: string, severity: Severity, id: string, message: string, field?: string,
    ) => issues.push({ id, step, section, field, severity, message })

    const d = data.demandeur
    const t = data.terrain
    const tr = data.travaux

    // ── Étape 1 — Demandeur ───────────────────────────────────────────────
    if (d.est_societe) {
        if (blank(d.nom_societe)) add(1, 'Demandeur', 'fatal', 'soc_denom', 'Dénomination sociale manquante.', 'nom_societe')
        if (blank(d.siret)) add(1, 'Demandeur', 'warn', 'soc_siret_missing', 'SIRET de la société non renseigné.', 'siret')
        else if (!isValidSiret(d.siret)) add(1, 'Demandeur', 'fatal', 'soc_siret_bad', 'Le SIRET doit comporter 14 chiffres.', 'siret')
        if (blank(d.representant_nom) || blank(d.representant_prenom))
            add(1, 'Demandeur', 'warn', 'soc_rep', 'Représentant légal de la société non renseigné.', 'representant_nom')
    } else {
        if (blank(d.nom)) add(1, 'Demandeur', 'fatal', 'nom', 'Nom du demandeur manquant.', 'nom')
        if (blank(d.prenom)) add(1, 'Demandeur', 'fatal', 'prenom', 'Prénom du demandeur manquant.', 'prenom')
        if (blank(d.date_naissance)) add(1, 'Demandeur', 'warn', 'naiss_date_missing', 'Date de naissance non renseignée.', 'date_naissance')
        else if (!isValidDate(d.date_naissance)) add(1, 'Demandeur', 'warn', 'naiss_date_bad', 'Date de naissance invalide (format JJ/MM/AAAA attendu).', 'date_naissance')
        if (blank(d.lieu_naissance)) add(1, 'Demandeur', 'warn', 'naiss_lieu', 'Commune de naissance non renseignée.', 'lieu_naissance')
    }

    if (blank(d.adresse)) add(1, 'Demandeur', 'fatal', 'adr', 'Adresse du demandeur manquante.', 'adresse')
    if (blank(d.code_postal)) add(1, 'Demandeur', 'fatal', 'cp_missing', 'Code postal du demandeur manquant.', 'code_postal')
    else if (!isValidPostal(d.code_postal)) add(1, 'Demandeur', 'fatal', 'cp_bad', 'Code postal invalide (5 chiffres).', 'code_postal')
    if (blank(d.commune)) add(1, 'Demandeur', 'fatal', 'commune', 'Commune du demandeur manquante.', 'commune')

    if (blank(d.telephone)) add(1, 'Demandeur', 'warn', 'tel_missing', 'Téléphone non renseigné.', 'telephone')
    else if (!isValidPhone(d.telephone)) add(1, 'Demandeur', 'warn', 'tel_bad', 'Numéro de téléphone invalide.', 'telephone')

    // Email becomes fatal when the applicant accepted electronic notification.
    if (blank(d.email)) {
        add(1, 'Demandeur', data.accord_dematerialisation ? 'fatal' : 'warn', 'email_missing',
            data.accord_dematerialisation
                ? 'Email obligatoire : vous avez accepté la communication électronique.'
                : 'Email non renseigné.', 'email')
    } else if (!isValidEmail(d.email)) {
        add(1, 'Demandeur', 'warn', 'email_bad', 'Adresse email invalide.', 'email')
    }

    // ── Étape 2 — Terrain ─────────────────────────────────────────────────
    const terrAddr = t.meme_adresse ? d.adresse : t.adresse
    const terrCommune = t.meme_adresse ? d.commune : t.commune
    if (blank(terrAddr)) add(2, 'Terrain', 'fatal', 'terr_adr', 'Adresse du terrain manquante.', 'adresse')
    if (blank(terrCommune)) add(2, 'Terrain', 'fatal', 'terr_commune', 'Commune du terrain manquante.', 'commune')
    if (blank(t.section_cadastrale)) add(2, 'Terrain', 'fatal', 'cad_section', 'Section cadastrale manquante.', 'section_cadastrale')
    if (blank(t.numero_parcelle)) add(2, 'Terrain', 'fatal', 'cad_numero', 'Numéro de parcelle cadastrale manquant.', 'numero_parcelle')
    if (blank(t.surface_terrain)) add(2, 'Terrain', 'warn', 'cad_surface', 'Superficie du terrain non renseignée.', 'surface_terrain')
    if (data.terrain_lotissement && blank((data as any).lot_numero))
        add(2, 'Terrain', 'warn', 'lot', 'Terrain en lotissement : précisez le numéro/nom de lot pour la mairie.', 'lot_numero')

    // ── Étape 3 — Travaux & surfaces ──────────────────────────────────────
    if (blank(tr.type)) {
        add(3, 'Travaux', 'fatal', 'trav_type', 'Type de travaux non sélectionné.', 'type')
    } else {
        if (tr.type === 'menuiseries' && tr.menuiseries) {
            if (blank(tr.menuiseries.materiau)) add(3, 'Travaux', 'warn', 'men_mat', 'Matériau des menuiseries non précisé.', 'materiau')
            if (blank(tr.menuiseries.couleur)) add(3, 'Travaux', 'warn', 'men_col', 'Couleur des menuiseries non précisée (souvent exigée par le PLU).', 'couleur')
        } else if (tr.type === 'isolation' && tr.isolation) {
            if (blank(tr.isolation.type_finition)) add(3, 'Travaux', 'warn', 'iso_fin', 'Type de finition de l’ITE non précisé.', 'type_finition')
            if (blank(tr.isolation.couleur)) add(3, 'Travaux', 'warn', 'iso_col', 'Couleur de finition non précisée.', 'couleur')
        } else if (tr.type === 'photovoltaique' && tr.photovoltaique) {
            if (blank(tr.photovoltaique.nombre_panneaux)) add(3, 'Travaux', 'warn', 'pv_nb', 'Nombre de panneaux non précisé.', 'nombre_panneaux')
            if (blank(tr.photovoltaique.integration)) add(3, 'Travaux', 'warn', 'pv_int', 'Mode d’intégration (surimposition / intégré) non précisé.', 'integration')
        }
    }
    if (blank(tr.description_projet)) add(3, 'Travaux', 'warn', 'trav_desc', 'Description du projet non renseignée.', 'description_projet')

    const sExist = num(tr.surfaces?.existante)
    const sCreee = num(tr.surfaces?.creee)
    const sSuppr = num(tr.surfaces?.supprimee)
    if (sExist === null) add(3, 'Travaux', 'warn', 'surf_exist', 'Surface de plancher existante non renseignée.', 'surfaces')
    else if (Number.isNaN(sExist)) add(3, 'Travaux', 'fatal', 'surf_exist_bad', 'Surface existante non numérique.', 'surfaces')
    if (sCreee !== null && Number.isNaN(sCreee)) add(3, 'Travaux', 'fatal', 'surf_creee_bad', 'Surface créée non numérique.', 'surfaces')
    if (sSuppr !== null && Number.isNaN(sSuppr)) add(3, 'Travaux', 'fatal', 'surf_suppr_bad', 'Surface supprimée non numérique.', 'surfaces')
    if (sExist !== null && sSuppr !== null && !Number.isNaN(sExist) && !Number.isNaN(sSuppr) && sSuppr > sExist)
        add(3, 'Travaux', 'warn', 'surf_incoherent', 'La surface supprimée dépasse la surface existante.', 'surfaces')
    // Permit threshold guard (these works create ≈0 m², but be safe).
    if (sExist !== null && sCreee !== null && !Number.isNaN(sExist) && !Number.isNaN(sCreee) && (sExist + sCreee) > 150)
        add(3, 'Travaux', 'warn', 'surf_seuil_150', 'Surface totale > 150 m² : un permis de construire et le recours à un architecte peuvent être requis.', 'surfaces')
    // Coherence: the existing floor area declared here must match the dwelling's surface de plancher
    // (Étape 2). A mismatch is a classic ground for a demande de pièces complémentaires.
    const sPlancher = num(t.surface_plancher)
    if (sExist !== null && sPlancher !== null && !Number.isNaN(sExist) && !Number.isNaN(sPlancher) && Math.abs(sExist - sPlancher) > 1)
        add(3, 'Travaux', 'fatal', 'surf_mismatch', `Incohérence de surface : surface existante (${sExist} m²) ≠ surface de plancher du terrain (${sPlancher} m²). Harmonisez ces deux valeurs avant de générer le dossier.`, 'surfaces')

    // ── Étape 4 — Conformité PLU ──────────────────────────────────────────
    const ev = t.plu?.evaluationResult
    if (ev) {
        if (ev.decision === 'PERMIS_CONSTRUIRE')
            add(4, 'Conformité PLU', 'warn', 'plu_pc', 'L’analyse PLU indique qu’un permis de construire serait requis (et non une simple DP).')
        if (typeof ev.status === 'string' && ev.status.toUpperCase().includes('NON-CONFORME'))
            add(4, 'Conformité PLU', 'warn', 'plu_nc', 'L’analyse PLU signale un risque de non-conformité — vérifiez les points soulevés.')
        if (Array.isArray(ev.violations) && ev.violations.length > 0)
            add(4, 'Conformité PLU', 'warn', 'plu_viol', `${ev.violations.length} violation(s) potentielle(s) du règlement détectée(s).`)
    }
    if (t.plu?.overlays?.hasSPR || (t.plu?.overlays?.monumentsWithin500m?.length || 0) > 0)
        add(4, 'Conformité PLU', 'warn', 'abf', 'Secteur protégé (SPR / abords de Monument Historique) : avis de l’ABF requis, délai porté à 2 mois.')

    // ── Étape 7 — Engagement ──────────────────────────────────────────────
    const eng = data.engagement
    if (blank(eng?.lieu)) add(7, 'Engagement', 'fatal', 'eng_lieu', 'Lieu de signature manquant.', 'lieu')
    if (blank(eng?.date)) add(7, 'Engagement', 'fatal', 'eng_date', 'Date de signature manquante.', 'date')
    else if (!isValidDate(eng!.date)) add(7, 'Engagement', 'fatal', 'eng_date_bad', 'Date de signature invalide.', 'date')
    if (!eng?.signature) add(7, 'Engagement', 'fatal', 'eng_sign', 'Vous devez attester votre signature pour générer le dossier.', 'signature')

    return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist of required pieces (DP1–DP8) — separate from field validation.
// ─────────────────────────────────────────────────────────────────────────────
export interface PieceStatus {
    code: string
    label: string
    present: boolean
    severity: Severity // fatal = legally required for this dossier
    note?: string
}

/** True when the parcel is in a protected sector (SPR / abords MH) — binding ABF avis applies. */
export function isProtectedSector(data: DPFormData): boolean {
    const plu = data.terrain?.plu
    return !!(plu?.overlays?.hasSPR
        || (plu?.overlays?.monumentsWithin500m?.length || 0) > 0
        || plu?.evaluationResult?.decision === 'DECLARATION_PREALABLE_ABF')
}

export function piecesChecklist(data: DPFormData): PieceStatus[] {
    const plans = data.plans
    const photos = data.photos
    const hasFacade = (photos.facades?.some(f => f.before) ?? false) || !!photos.facade_avant
    const hasCroquis = (photos.facades?.some(f => f.croquis) ?? false) || !!photos.facade_croquis_ai
    const hasAfter = (photos.facades?.some(f => f.after) ?? false) || !!photos.facade_apres_ai
    const protege = isProtectedSector(data)
    // DP2 (plan de masse) is only legally required when built volume changes —
    // not the case for menuiseries/ITE/PV — so it is recommended, not fatal.
    // In a protected sector the ABF examines the projected aspect closely, so DP6 (insertion) and
    // DP8 (vue lointaine) become required, and the DP4 must detail materials/teintes (rôle DP11).
    return [
        { code: 'DP1', label: 'Plan de situation', present: !!plans.dp1_carte_situation, severity: 'fatal', note: 'Seule pièce obligatoire dans tous les cas.' },
        { code: 'DP2', label: 'Plan de masse', present: !!plans.dp2_plan_masse, severity: 'warn', note: 'Requis seulement si le volume bâti change.' },
        { code: 'DP4', label: 'Notice descriptive', present: !!plans.dp4_notice, severity: 'fatal', note: protege ? 'Secteur protégé : détaillez les matériaux et teintes (réf. RAL, profils) — tient lieu de notice de matériaux (DP11).' : undefined },
        { code: 'DP5', label: 'Plan des façades (existant)', present: hasFacade, severity: 'fatal' },
        { code: 'DP6', label: 'Insertion / aspect projeté', present: hasAfter || hasCroquis, severity: protege ? 'fatal' : 'warn', note: protege ? 'Examiné par l’ABF en secteur protégé.' : undefined },
        { code: 'DP7', label: 'Photo environnement proche', present: !!photos.dp7_vue_proche, severity: 'fatal' },
        { code: 'DP8', label: 'Photo environnement lointain', present: !!photos.dp8_vue_lointaine, severity: protege ? 'fatal' : 'warn', note: 'Exigé en secteur protégé.' },
    ]
}

// ── Convenience aggregations ─────────────────────────────────────────────────
export const fatalIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'fatal')
export const warnIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'warn')

export function issuesForStep(data: DPFormData, step: StepId): ValidationIssue[] {
    return validateDPForm(data).filter(i => i.step === step)
}

/** True when the dossier has no fatal field issues AND no fatal missing pieces. */
export function canGenerate(data: DPFormData): boolean {
    const noFatalFields = fatalIssues(validateDPForm(data)).length === 0
    const noFatalPieces = piecesChecklist(data).every(p => p.present || p.severity !== 'fatal')
    return noFatalFields && noFatalPieces
}
