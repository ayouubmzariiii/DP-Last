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
//   • 'fatal'     — legally essential; a dossier missing this is not recevable.
//                   Generation is hard-blocked.
//   • 'forbidden' — a chosen material/teinte is explicitly PROHIBITED by the
//                   règlement d'urbanisme (not merely risky). Rendered red as
//                   "interdit", blocks generation, and proposes a compliant
//                   alternative.
//   • 'warn'      — strongly recommended / conditional; surfaced loudly but the
//                   reviewing expert may proceed deliberately.
// ─────────────────────────────────────────────────────────────────────────────

import { DPFormData } from './models'
import { getTravauxDef } from './travauxRegistry'
import { buildDetailChecks } from './pluEvaluate'

export type Severity = 'fatal' | 'forbidden' | 'warn'
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
        // Per-type warnings come from the travaux registry (single source of truth).
        const def = getTravauxDef(tr.type)
        if (def) for (const w of def.validate(data)) add(3, 'Travaux', 'warn', w.id, w.message, w.field)
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

    // DP7 et DP8 remplissent deux fonctions distinctes (R. 431-10 d) : situer le
    // terrain dans son environnement PROCHE, puis dans le paysage LOINTAIN. Deux
    // fois le même cliché ne remplit qu'une des deux, et c'est un motif classique
    // de demande de pièces complémentaires.
    const vp = data.photos?.dp7_vue_proche, vl = data.photos?.dp8_vue_lointaine
    if (vp && vl && vp === vl)
        add(7, 'Visuels', 'warn', 'dp7_dp8_identiques', 'Les pièces DP7 et DP8 utilisent la même photographie. Fournissez une vue rapprochée ET une vue éloignée : elles répondent à deux exigences différentes.')

    // Deterministic aspect conflict: the chosen material/teinte is explicitly on the règlement's
    // forbidden list → INTERDIT (severity 'forbidden' = red, blocks generation), with a compliant
    // alternative proposed from the same règlement's allowed list.
    const aspect = pluAspectConflicts(data)
    const alt = pluAspectAlternatives(data)
    if (aspect.material)
        add(4, 'Conformité PLU', 'forbidden', 'plu_mat_forbidden', `Matériau « ${aspect.material.chosen} » INTERDIT par le règlement d’urbanisme (matériaux proscrits : « ${aspect.material.rule} »).${alt.material ? ` Alternative conforme : ${alt.material}.` : ' Choisissez un matériau figurant dans la palette autorisée.'}`, 'materiau')
    if (aspect.color)
        add(4, 'Conformité PLU', 'forbidden', 'plu_col_forbidden', `Teinte « ${aspect.color.chosen} » INTERDITE par le règlement d’urbanisme (teintes proscrites : « ${aspect.color.rule} »).${alt.color ? ` Alternative conforme : ${alt.color}.` : ' Choisissez une teinte de la palette autorisée.'}`, 'couleur')

    // ── Étape 7 — Pièces & engagement ─────────────────────────────────────
    // Concerned façades without a photo: the DP5 (façades) and DP6 (insertion) will only
    // cover what was photographed — a classic ground for a demande de pièces complémentaires.
    const facadesSansPhoto = (data.photos?.facades || []).filter(f => !f.before)
    if ((data.photos?.facades || []).length > 0 && facadesSansPhoto.length > 0)
        add(7, 'Pièces', 'warn', 'facades_photo',
            `${facadesSansPhoto.length} façade(s) concernée(s) sans photo (${facadesSansPhoto.map(f => f.label.toLowerCase()).join(', ')}) : les pièces DP5/DP6 ne couvriront que les façades photographiées.`)

    const eng = data.engagement
    if (blank(eng?.lieu)) add(7, 'Engagement', 'fatal', 'eng_lieu', 'Lieu de signature manquant.', 'lieu')
    if (blank(eng?.date)) add(7, 'Engagement', 'fatal', 'eng_date', 'Date de signature manquante.', 'date')
    else if (!isValidDate(eng!.date)) add(7, 'Engagement', 'fatal', 'eng_date_bad', 'Date de signature invalide.', 'date')
    if (!eng?.signature) add(7, 'Engagement', 'fatal', 'eng_sign', 'Vous devez attester votre signature pour générer le dossier.', 'signature')

    return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist of required pieces (DP1–DP11) — separate from field validation.
// ─────────────────────────────────────────────────────────────────────────────
export interface PieceStatus {
    code: string
    label: string
    present: boolean
    severity: Severity // fatal = legally required for this dossier
    note?: string
}

// ── PLU aspect (material / teinte) conflict detection ────────────────────────
export interface AspectConflict { chosen: string; rule: string }

/** Deterministically detect when a declared material/teinte matches a forbidden entry of the
 *  règlement (or a heritage proscription). DELEGATES to the same engine as the étape-4 analysis
 *  (buildDetailChecks), so the « INTERDIT » card, the step-7 generation gate and the analysis
 *  verdict use one single detection and can never disagree. Covers ALL work types.
 *  Only forbidden-list / heritage matches (check.rule set) block — whitelist misses stay
 *  warnings/violations in the analysis itself. */
export function pluAspectConflicts(data: DPFormData): { material: AspectConflict | null; color: AspectConflict | null } {
    const plu = data.terrain?.plu
    const tr = data.travaux
    if (!plu?.extractedRules || !tr?.type) return { material: null, color: null }
    const checks = buildDetailChecks(tr, plu.extractedRules, plu.overlays, plu.source === 'reglement', plu.source !== 'reglement')
    const pick = (kind: 'material' | 'color'): AspectConflict | null => {
        const hit = checks.find(c => c.kind === kind && c.verdict === 'violation' && c.rule)
        return hit ? { chosen: hit.value, rule: hit.rule! } : null
    }
    return { material: pick('material'), color: pick('color') }
}

/** Compliant alternatives to propose when a material/teinte is forbidden — read from the SAME
 *  règlement's allowed lists (or its free-text colour restriction). Returns short human strings. */
export function pluAspectAlternatives(data: DPFormData): { material: string | null; color: string | null } {
    const facade = data.terrain?.plu?.extractedRules?.facade
    if (!facade) return { material: null, color: null }
    const list = (v: unknown, n = 3): string | null =>
        Array.isArray(v) && v.length ? v.map(String).map(s => s.trim()).filter(Boolean).slice(0, n).join(', ') : null
    const material = list(facade.allowed_materials)
    const color = list(facade.allowed_colors)
        || (typeof facade.color_restrictions === 'string' && facade.color_restrictions.trim() ? facade.color_restrictions.trim() : null)
    return { material, color }
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

    // ── Nomenclature OFFICIELLE du bordereau (Cerfa 13703*12, notice n°51434#12) ──
    // Vérifiée mot pour mot sur le formulaire, qui cite ses propres articles :
    //   DP1  Plan de situation ......................... R. 431-36 a) — SEULE obligatoire, tous les cas
    //   DP2  Plan de masse coté 3D .................... R. 431-36 b) — si création/modification de volume
    //   DP3  Plan en coupe (profil du terrain) ....... R. 431-10 b) — si le profil/l'implantation change
    //   DP4  Plan des façades et des toitures ........ R. 431-10 a) — si le projet les modifie ; inutile pour un ravalement
    //   DP5  Représentation de l'aspect extérieur .... R. 431-36 c) — seulement si DP4 insuffisant
    //   DP6  Document graphique d'insertion .......... R. 431-10 c) — si visible depuis l'espace public ou secteur protégé
    //   DP7  Photo de l'environnement proche ......... R. 431-10 d)
    //   DP8  Photo du paysage lointain ............... R. 431-10 d)
    //   DP11 Notice matériaux et couleurs ............ — surtout en secteur protégé
    // Cette liste DOIT rester alignée avec le bordereau coché par le générateur
    // CERFA (voir pdfGenerator « BORDEREAU DES PIÈCES JOINTES ») : mêmes pièces,
    // mêmes conditions. Toute divergence produit soit une checklist qui valide
    // un dossier incomplet, soit un formulaire qui déclare une pièce absente.
    const def = getTravauxDef(data.travaux?.type)
    const volumeChange = !!def?.requiresDP3 || !!def?.createsSurface || data.nature_travaux === 'nouvelle_construction'
    const modifieFacades = def?.cerfaNature === 'existante' && data.travaux?.type !== 'ravalement'
    const noticePresent = !!plans.dp4_notice && plans.dp4_notice.trim().length > 0

    return [
        { code: 'DP1', label: 'Plan de situation du terrain', present: !!plans.dp1_carte_situation, severity: 'fatal', note: 'Seule pièce obligatoire dans tous les cas (art. R. 431-36 a).' },
        { code: 'DP2', label: 'Plan de masse coté', present: !!plans.dp2_plan_masse, severity: volumeChange ? 'fatal' : 'warn', note: volumeChange ? 'Requis : le projet crée ou modifie un volume bâti.' : 'Requis seulement si le volume bâti change.' },
        ...(def?.requiresDP3 ? [{ code: 'DP3', label: 'Plan en coupe du terrain', present: !!plans.dp3_coupe, severity: 'fatal' as Severity, note: 'Requis : le projet modifie le profil du terrain ou son volume (art. R. 431-10 b).' }] : []),
        { code: 'DP4', label: 'Plan des façades et des toitures', present: hasFacade, severity: modifieFacades ? 'fatal' : 'warn', note: data.travaux?.type === 'ravalement' ? 'Inutile pour un simple ravalement — l’aspect est montré par la représentation (DP5) et les photos.' : undefined },
        { code: 'DP5', label: 'Représentation de l’aspect extérieur', present: hasCroquis || hasAfter, severity: protege ? 'fatal' : 'warn', note: 'À fournir si le plan des façades ne suffit pas à montrer le projet.' },
        { code: 'DP6', label: 'Document graphique d’insertion', present: hasAfter, severity: protege ? 'fatal' : 'warn', note: protege ? 'Examiné par l’ABF en secteur protégé.' : 'Requis si le projet est visible depuis l’espace public.' },
        { code: 'DP7', label: 'Photo de l’environnement proche', present: !!photos.dp7_vue_proche, severity: 'fatal', note: 'Situe le terrain dans son environnement proche (art. R. 431-10 d).' },
        { code: 'DP8', label: 'Photo du paysage lointain', present: !!photos.dp8_vue_lointaine, severity: protege ? 'fatal' : 'warn', note: 'Exigée notamment en secteur protégé, sauf impossibilité justifiée.' },
        { code: 'DP11', label: 'Notice des matériaux et couleurs', present: noticePresent, severity: protege ? 'fatal' : 'warn', note: protege ? 'Secteur protégé : détaillez matériaux et teintes (réf. RAL, profils).' : undefined },
    ]
}

// ── Convenience aggregations ─────────────────────────────────────────────────
export const fatalIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'fatal')
export const forbiddenIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'forbidden')
export const warnIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'warn')
// What hard-blocks generation: missing legal essentials AND règlement-forbidden aspect choices.
export const blockingIssues = (issues: ValidationIssue[]) => issues.filter(i => i.severity === 'fatal' || i.severity === 'forbidden')

export function issuesForStep(data: DPFormData, step: StepId): ValidationIssue[] {
    return validateDPForm(data).filter(i => i.step === step)
}

/** True when the dossier has no blocking field issues (fatal or forbidden) AND no fatal missing pieces. */
export function canGenerate(data: DPFormData): boolean {
    const noBlockingFields = blockingIssues(validateDPForm(data)).length === 0
    const noFatalPieces = piecesChecklist(data).every(p => p.present || p.severity !== 'fatal')
    return noBlockingFields && noFatalPieces
}
