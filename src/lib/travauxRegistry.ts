/**
 * Travaux registry — the single source of truth for each type of works.
 *
 * Adding a new work type means adding ONE entry here (plus its detail sub-form in Étape 3 and its
 * data interface in models). Everything cross-cutting — the Étape 3 card, the human/works labels on
 * the DP plans, the CERFA 16702 §4.1 nature box, whether a plan de coupe (DP3) is required, the AI
 * "après travaux" description, and the Étape 3 validation warnings — is read from this registry
 * instead of being branched across ~13 files.
 */
import { DPFormData, TypeTravaux } from './models'

export type TravauxId = Exclude<TypeTravaux, ''>

export interface TravauxWarning {
    id: string
    message: string
    field?: string
}

export interface TravauxTypeDef {
    id: TravauxId
    // ── Étape 3 selection card ──────────────────────────────────────────────
    icon: string
    title: string
    subtitle: string
    desc: string
    color: string
    // ── Étape 3 "Description & Surfaces" free-text field ────────────────────
    descLabel: string
    descPlaceholder: string
    // ── CERFA 16702 §4.1 nature of works + volume/surface semantics ─────────
    cerfaNature: 'existante' | 'nouvelle' | 'cloture'
    createsSurface: boolean   // touches surface de plancher / emprise au sol
    requiresDP3: boolean      // modifies terrain profile or built volume → plan de coupe
    // ── Labels shown on the generated DP plans ──────────────────────────────
    natureLabel: string                       // cover / footer / notice title
    worksLabel: (data: DPFormData) => string  // concise label drawn on the DP5 croquis
    // ── AI "après travaux" raw description (facade simulation prompt) ────────
    aiDescription: (data: DPFormData) => string
    // ── Étape 3 validation (warnings) ───────────────────────────────────────
    validate: (data: DPFormData) => TravauxWarning[]
}

const MATERIAU_LABEL: Record<string, string> = {
    pvc: 'PVC', aluminium: 'aluminium', bois: 'bois', mixte: 'mixte bois-aluminium',
}
const FINITION_LABEL: Record<string, string> = {
    enduit: 'enduit', bardage_bois: 'bardage bois', bardage_metal: 'bardage metal', bardage_composite: 'bardage composite',
}

const blank = (v?: string) => !v || !v.trim()

export const TRAVAUX_REGISTRY: Record<TravauxId, TravauxTypeDef> = {
    menuiseries: {
        id: 'menuiseries',
        icon: '🪟',
        title: 'Menuiseries',
        subtitle: 'Fenêtres, portes, volets',
        desc: 'Remplacement ou installation de menuiseries extérieures avec spécification des matériaux et couleurs',
        color: 'blue',
        descLabel: 'Détails des menuiseries (couleurs, matériaux, ouvertures) :',
        descPlaceholder: 'Ex: Remplacement des 4 fenêtres bois par du PVC blanc RAL 9016. Pose en rénovation.',
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Remplacement / installation de menuiseries extérieures',
        worksLabel: (data) => {
            const m = data.travaux.menuiseries
            if (!m) return TRAVAUX_REGISTRY.menuiseries.natureLabel
            const matStr = MATERIAU_LABEL[m.materiau] || m.materiau || ''
            const col = m.couleur ? ` ${m.couleur.toLowerCase()}` : ''
            const ral = m.couleur_ral ? ` (${m.couleur_ral})` : ''
            return `Remplacement des menuiseries${matStr ? ` en ${matStr}` : ''}${col}${ral}`.trim()
        },
        aiDescription: (data) => {
            const m = data.travaux.menuiseries
            if (!m) return ''
            return m.description || `Remplacement de menuiseries (${m.nombre || 1} ${m.type || 'fenêtre'}) en ${m.materiau || 'pvc'} ${m.couleur || ''}`
        },
        validate: (data) => {
            const m = data.travaux.menuiseries
            const out: TravauxWarning[] = []
            if (!m) return out
            if (blank(m.materiau)) out.push({ id: 'men_mat', message: 'Matériau des menuiseries non précisé.', field: 'materiau' })
            if (blank(m.couleur)) out.push({ id: 'men_col', message: 'Couleur des menuiseries non précisée (souvent exigée par le PLU).', field: 'couleur' })
            return out
        },
    },

    isolation: {
        id: 'isolation',
        icon: '🏠',
        title: 'Isolation Thermique Extérieure',
        subtitle: 'Enduit ou bardage',
        desc: "Application d'un système d'isolation par l'extérieur avec finition en enduit, bardage bois, métal ou composite",
        color: 'emerald',
        descLabel: "Détails de la finition (type d'enduit, coloris exact, façades) :",
        descPlaceholder: "Ex: Application d'un enduit grésé ton pierre. Pose de bardage bois naturel sur le pignon droit.",
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: "Isolation thermique par l'extérieur (ITE)",
        worksLabel: (data) => {
            const iso = data.travaux.isolation
            if (!iso) return TRAVAUX_REGISTRY.isolation.natureLabel
            const finStr = FINITION_LABEL[iso.type_finition] || 'enduit'
            const col = iso.couleur ? ` ${iso.couleur.toLowerCase()}` : ''
            return `Isolation par l'extérieur - finition ${finStr}${col}`
        },
        aiDescription: (data) => {
            const iso = data.travaux.isolation
            if (!iso) return ''
            return `Isolation thermique par l'extérieur. Finition demandée : ${iso.type_finition || 'enduit'} ${iso.couleur ? 'couleur ' + iso.couleur : ''}. Façades concernées : ${iso.facades_concernees?.join(', ') || 'Toutes les façades'}.`
        },
        validate: (data) => {
            const iso = data.travaux.isolation
            const out: TravauxWarning[] = []
            if (!iso) return out
            if (blank(iso.type_finition)) out.push({ id: 'iso_fin', message: 'Type de finition de l’ITE non précisé.', field: 'type_finition' })
            if (blank(iso.couleur)) out.push({ id: 'iso_col', message: 'Couleur de finition non précisée.', field: 'couleur' })
            return out
        },
    },

    photovoltaique: {
        id: 'photovoltaique',
        icon: '☀️',
        title: 'Panneaux Photovoltaïques',
        subtitle: 'Installation en toiture',
        desc: 'Pose de panneaux solaires photovoltaïques sur une toiture existante, en surimposition ou intégrés',
        color: 'amber',
        descLabel: "Détails de l'installation (type de pose, visibilité rue) :",
        descPlaceholder: 'Ex: Pose de 12 panneaux noirs en surimposition sur le pan de toiture Sud.',
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Installation de panneaux photovoltaïques en toiture',
        worksLabel: (data) => {
            const pv = data.travaux.photovoltaique
            const nb = pv?.nombre_panneaux
            return `Pose de ${nb ? nb + ' ' : ''}panneaux photovoltaïques en toiture`
        },
        aiDescription: (data) => {
            const pv = data.travaux.photovoltaique
            if (!pv) return ''
            return `Installation de ${pv.nombre_panneaux || '10'} panneaux photovoltaïques sur la toiture. Orientation : ${pv.orientation || 'Sud'}.`
        },
        validate: (data) => {
            const pv = data.travaux.photovoltaique
            const out: TravauxWarning[] = []
            if (!pv) return out
            if (blank(pv.nombre_panneaux)) out.push({ id: 'pv_nb', message: 'Nombre de panneaux non précisé.', field: 'nombre_panneaux' })
            if (blank(pv.integration)) out.push({ id: 'pv_int', message: 'Mode d’intégration (surimposition / intégré) non précisé.', field: 'integration' })
            return out
        },
    },
}

/** Ordered list of definitions (Étape 3 card grid order). */
export const TRAVAUX_LIST: TravauxTypeDef[] = Object.values(TRAVAUX_REGISTRY)

/** Safe lookup by (possibly empty) type. */
export function getTravauxDef(type: TypeTravaux | undefined): TravauxTypeDef | undefined {
    return type ? TRAVAUX_REGISTRY[type as TravauxId] : undefined
}

/** Human label for the works — falls back gracefully when no type is chosen. */
export function travauxNatureLabel(data: DPFormData): string {
    return getTravauxDef(data.travaux.type)?.natureLabel ?? 'Non défini'
}

/** Concise works label drawn on the DP5 croquis. */
export function travauxWorksLabel(data: DPFormData): string {
    const def = getTravauxDef(data.travaux.type)
    return def ? def.worksLabel(data) : travauxNatureLabel(data)
}
