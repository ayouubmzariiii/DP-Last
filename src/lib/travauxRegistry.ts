/**
 * Travaux registry — the single source of truth for each type of works.
 *
 * Adding a new work type means adding ONE entry here (plus its detail sub-form in Étape 3 and its
 * data interface in models). Everything cross-cutting — the Étape 3 card, the human/works labels on
 * the DP plans, the CERFA §4.1 nature box, whether a plan de coupe (DP3) is required, the AI
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
    // ── CERFA §4.1 nature of works + volume/surface semantics ─────────
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

export const MATERIAU_LABEL: Record<string, string> = {
    pvc: 'PVC', aluminium: 'aluminium', bois: 'bois', mixte: 'mixte bois-aluminium',
}
const FINITION_LABEL: Record<string, string> = {
    enduit: 'enduit', bardage_bois: 'bardage bois', bardage_metal: 'bardage metal', bardage_composite: 'bardage composite',
}
const CLOTURE_LABEL: Record<string, string> = {
    mur: 'Mur plein', mur_bahut: 'Mur-bahut surmonté d’une grille', grillage: 'Grillage',
    panneaux: 'Panneaux rigides', claire_voie: 'Clôture à claire-voie',
}
const RAVALEMENT_LABEL: Record<string, string> = {
    enduit: 'enduit', peinture: 'peinture', pierre_apparente: 'pierre apparente', bardage: 'bardage',
}
const OUVERTURE_LABEL: Record<string, string> = {
    fenetre: 'fenêtre', porte: 'porte', porte_fenetre: 'porte-fenêtre', fenetre_toit: 'fenêtre de toit (velux)',
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

    cloture: {
        id: 'cloture',
        icon: '🧱',
        title: 'Clôture',
        subtitle: 'Mur, grillage, panneaux',
        desc: 'Édification ou modification d’une clôture (mur, mur-bahut, grillage, panneaux) sur rue ou en limite séparative',
        color: 'stone',
        descLabel: 'Détails de la clôture (matériau, hauteur, couleur, implantation) :',
        descPlaceholder: 'Ex: Mur-bahut de 0,60 m surmonté d’un grillage rigide gris anthracite, hauteur totale 1,80 m, sur rue.',
        cerfaNature: 'cloture',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Édification / modification d’une clôture',
        worksLabel: (data) => {
            const c = data.travaux.cloture
            if (!c) return TRAVAUX_REGISTRY.cloture.natureLabel
            const t = CLOTURE_LABEL[c.type_cloture] || 'Clôture'
            const mat = c.materiau ? ` ${c.materiau.toLowerCase()}` : ''
            const h = c.hauteur ? `, hauteur ${c.hauteur} m` : ''
            return `${t}${mat}${h}`.trim()
        },
        aiDescription: (data) => {
            const c = data.travaux.cloture
            if (!c) return ''
            const t = (CLOTURE_LABEL[c.type_cloture] || 'clôture').toLowerCase()
            return `Installation d’une clôture de type « ${t} »${c.materiau ? ' en ' + c.materiau : ''}${c.couleur ? ' ' + c.couleur : ''} en limite de propriété${c.sur_voie ? ' sur rue' : ''}, hauteur ${c.hauteur || '1,80'} m.`
        },
        validate: (data) => {
            const c = data.travaux.cloture
            const out: TravauxWarning[] = []
            if (!c) return out
            if (!c.type_cloture) out.push({ id: 'clo_type', message: 'Type de clôture non précisé.', field: 'type_cloture' })
            if (blank(c.hauteur)) out.push({ id: 'clo_haut', message: 'Hauteur de la clôture non précisée (souvent plafonnée par le PLU).', field: 'hauteur' })
            return out
        },
    },

    ravalement: {
        id: 'ravalement',
        icon: '🎨',
        title: 'Ravalement de façade',
        subtitle: 'Enduit, peinture, pierre',
        desc: 'Ravalement ou réfection de l’aspect des façades (enduit, peinture, pierre apparente) sans modifier les ouvertures',
        color: 'clay',
        descLabel: 'Détails du ravalement (finition, teinte, façades concernées) :',
        descPlaceholder: 'Ex: Ravalement de la façade sur rue, enduit gratté ton pierre (teinte RAL 1015).',
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Ravalement de façade',
        worksLabel: (data) => {
            const r = data.travaux.ravalement
            if (!r) return TRAVAUX_REGISTRY.ravalement.natureLabel
            const fin = RAVALEMENT_LABEL[r.finition] || 'enduit'
            const col = r.couleur ? ` ${r.couleur.toLowerCase()}` : ''
            return `Ravalement de façade - ${fin}${col}`
        },
        aiDescription: (data) => {
            const r = data.travaux.ravalement
            if (!r) return ''
            const fin = RAVALEMENT_LABEL[r.finition] || 'enduit'
            return `Ravalement des façades : ${fin}${r.couleur ? ' teinte ' + r.couleur : ''}. Façades concernées : ${r.facades_concernees?.join(', ') || 'toutes les façades'}. Ne pas modifier les ouvertures ni la volumétrie du bâti.`
        },
        validate: (data) => {
            const r = data.travaux.ravalement
            const out: TravauxWarning[] = []
            if (!r) return out
            if (blank(r.couleur)) out.push({ id: 'rav_col', message: 'Teinte du ravalement non précisée (souvent imposée par le nuancier communal).', field: 'couleur' })
            return out
        },
    },

    toiture: {
        id: 'toiture',
        icon: '🏘️',
        title: 'Toiture',
        subtitle: 'Réfection, couverture',
        desc: 'Réfection de toiture ou changement du matériau de couverture (tuile, ardoise, zinc) sans modifier le volume',
        color: 'terracotta',
        descLabel: 'Détails de la toiture (matériau de couverture, teinte, opération) :',
        descPlaceholder: 'Ex: Réfection de la toiture à l’identique en tuiles canal terre cuite ton rouge nuancé.',
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Réfection / modification de toiture',
        worksLabel: (data) => {
            const t = data.travaux.toiture
            if (!t) return TRAVAUX_REGISTRY.toiture.natureLabel
            const op = t.operation === 'changement_materiau' ? 'Changement de couverture' : 'Réfection de toiture'
            const mat = t.materiau_couverture ? ` - ${t.materiau_couverture.toLowerCase()}` : ''
            const col = t.couleur ? ` ${t.couleur.toLowerCase()}` : ''
            return `${op}${mat}${col}`
        },
        aiDescription: (data) => {
            const t = data.travaux.toiture
            if (!t) return ''
            return `Réfection de la toiture${t.materiau_couverture ? ' en ' + t.materiau_couverture : ''}${t.couleur ? ' teinte ' + t.couleur : ''}, à l’identique de la pente et du volume existants.`
        },
        validate: (data) => {
            const t = data.travaux.toiture
            const out: TravauxWarning[] = []
            if (!t) return out
            if (blank(t.materiau_couverture)) out.push({ id: 'toit_mat', message: 'Matériau de couverture non précisé (souvent imposé par le PLU).', field: 'materiau_couverture' })
            return out
        },
    },

    ouverture: {
        id: 'ouverture',
        icon: '🚪',
        title: 'Création d’ouverture',
        subtitle: 'Fenêtre, porte, velux',
        desc: 'Création, agrandissement ou suppression d’une ouverture en façade ou en toiture (fenêtre, porte, fenêtre de toit)',
        color: 'blue',
        descLabel: 'Détails de l’ouverture (type, dimensions, façade concernée) :',
        descPlaceholder: 'Ex: Création d’une fenêtre de toit (velux) 78×98 cm sur le pan de toiture arrière.',
        cerfaNature: 'existante',
        createsSurface: false,
        requiresDP3: false,
        natureLabel: 'Création / modification d’une ouverture',
        worksLabel: (data) => {
            const o = data.travaux.ouverture
            if (!o) return TRAVAUX_REGISTRY.ouverture.natureLabel
            const op = o.operation === 'agrandissement' ? 'Agrandissement' : o.operation === 'suppression' ? 'Suppression' : 'Création'
            const type = OUVERTURE_LABEL[o.type_ouverture] || 'ouverture'
            const nb = o.nombre ? `${o.nombre} ` : ''
            return `${op} de ${nb}${type}`
        },
        aiDescription: (data) => {
            const o = data.travaux.ouverture
            if (!o) return ''
            const type = OUVERTURE_LABEL[o.type_ouverture] || 'ouverture'
            const op = o.operation === 'agrandissement' ? 'Agrandissement' : o.operation === 'suppression' ? 'Suppression' : 'Création'
            const dim = o.largeur && o.hauteur ? ` (${o.largeur}×${o.hauteur} cm)` : ''
            return `${op} de ${o.nombre || 'une'} ${type}${dim}${o.facade ? ' sur ' + o.facade : ''}, en cohérence avec les proportions des baies existantes.`
        },
        validate: (data) => {
            const o = data.travaux.ouverture
            const out: TravauxWarning[] = []
            if (!o) return out
            if (!o.type_ouverture) out.push({ id: 'ouv_type', message: 'Type d’ouverture non précisé.', field: 'type_ouverture' })
            if (!o.operation) out.push({ id: 'ouv_op', message: 'Opération (création / agrandissement / suppression) non précisée.', field: 'operation' })
            return out
        },
    },

    // ── Tier 2 : projets modifiant le profil du terrain / le volume → plan de coupe (DP3) ──────────
    piscine: {
        id: 'piscine',
        icon: '🏊',
        title: 'Piscine',
        subtitle: 'Bassin enterré 10–100 m²',
        desc: 'Création d’une piscine enterrée ou semi-enterrée : le creusement modifie le profil du terrain (plan de coupe requis)',
        color: 'blue',
        descLabel: 'Détails du bassin (dimensions, profondeur, implantation) :',
        descPlaceholder: 'Ex : Piscine enterrée 8 × 4 m, profondeur 1,50 m, à 3 m de la maison et 4 m de la limite.',
        cerfaNature: 'nouvelle',
        createsSurface: false,
        requiresDP3: true,
        natureLabel: 'Création d’une piscine enterrée',
        worksLabel: (data) => {
            const p = data.travaux.piscine
            if (!p) return TRAVAUX_REGISTRY.piscine.natureLabel
            const dim = p.longueur && p.largeur ? ` ${p.longueur} × ${p.largeur} m` : ''
            return `Piscine enterrée${dim}`.trim()
        },
        aiDescription: (data) => {
            const p = data.travaux.piscine
            if (!p) return ''
            return p.description || `Création d’une piscine enterrée de ${p.longueur || '8'} × ${p.largeur || '4'} m, profondeur ${p.profondeur || '1,5'} m.`
        },
        validate: (data) => {
            const p = data.travaux.piscine
            const out: TravauxWarning[] = []
            if (!p) return out
            if (blank(p.longueur) || blank(p.largeur)) out.push({ id: 'pis_dim', message: 'Dimensions du bassin non précisées.', field: 'longueur' })
            if (blank(p.profondeur)) out.push({ id: 'pis_prof', message: 'Profondeur du bassin non précisée (indispensable au plan de coupe).', field: 'profondeur' })
            const area = parseFloat(p.longueur) * parseFloat(p.largeur)
            if (Number.isFinite(area) && area > 100) out.push({ id: 'pis_pc', message: 'Bassin > 100 m² : un permis de construire est requis (hors périmètre DP).', field: 'longueur' })
            return out
        },
    },

    extension: {
        id: 'extension',
        icon: '🏗️',
        title: 'Extension',
        subtitle: 'Agrandissement ≤ 40 m²',
        desc: 'Extension de la construction (véranda, pièce en plus) créant de la surface — profil du terrain et volume modifiés',
        color: 'terracotta',
        descLabel: 'Détails de l’extension (emprise, hauteurs, adossement) :',
        descPlaceholder: 'Ex : Extension 4 × 5 m adossée au pignon Est, toit mono-pente, égout 2,60 m, faîtage 4,10 m.',
        cerfaNature: 'nouvelle',
        createsSurface: true,
        requiresDP3: true,
        natureLabel: 'Extension de la construction existante',
        worksLabel: (data) => {
            const e = data.travaux.extension
            if (!e) return TRAVAUX_REGISTRY.extension.natureLabel
            const surf = e.largeur && e.profondeur ? ` (${(parseFloat(e.largeur) * parseFloat(e.profondeur)).toFixed(0)} m²)` : ''
            return `Extension${surf}`.trim()
        },
        aiDescription: (data) => {
            const e = data.travaux.extension
            if (!e) return ''
            return e.description || `Extension de ${e.largeur || '4'} × ${e.profondeur || '5'} m, finition ${e.materiau || 'enduit'}.`
        },
        validate: (data) => {
            const e = data.travaux.extension
            const out: TravauxWarning[] = []
            if (!e) return out
            if (blank(e.largeur) || blank(e.profondeur)) out.push({ id: 'ext_dim', message: 'Dimensions de l’extension non précisées.', field: 'largeur' })
            if (blank(e.hauteur_faitage)) out.push({ id: 'ext_h', message: 'Hauteur au faîtage non précisée (plan de coupe).', field: 'hauteur_faitage' })
            const area = parseFloat(e.largeur) * parseFloat(e.profondeur)
            if (Number.isFinite(area) && area > 40) out.push({ id: 'ext_pc', message: 'Surface créée > 40 m² : permis de construire requis (architecte ≥ 150 m² au total).', field: 'largeur' })
            return out
        },
    },

    abri: {
        id: 'abri',
        icon: '🏚️',
        title: 'Abri / garage',
        subtitle: 'Annexe 5–20 m²',
        desc: 'Abri de jardin, garage ou carport créant une emprise au sol — nouvelle construction avec volume',
        color: 'stone',
        descLabel: 'Détails de l’annexe (emprise, hauteurs, matériau) :',
        descPlaceholder: 'Ex : Abri de jardin bois 3 × 4 m, toit deux pans, faîtage 2,50 m.',
        cerfaNature: 'nouvelle',
        createsSurface: true,
        requiresDP3: true,
        natureLabel: 'Construction d’une annexe (abri / garage)',
        worksLabel: (data) => {
            const a = data.travaux.abri
            if (!a) return TRAVAUX_REGISTRY.abri.natureLabel
            const surf = a.largeur && a.profondeur ? ` (${(parseFloat(a.largeur) * parseFloat(a.profondeur)).toFixed(0)} m²)` : ''
            return `Annexe${surf}`.trim()
        },
        aiDescription: (data) => {
            const a = data.travaux.abri
            if (!a) return ''
            return a.description || `Construction d’un abri de ${a.largeur || '3'} × ${a.profondeur || '4'} m en ${a.materiau || 'bois'}.`
        },
        validate: (data) => {
            const a = data.travaux.abri
            const out: TravauxWarning[] = []
            if (!a) return out
            if (blank(a.largeur) || blank(a.profondeur)) out.push({ id: 'abri_dim', message: 'Dimensions de l’annexe non précisées.', field: 'largeur' })
            const area = parseFloat(a.largeur) * parseFloat(a.profondeur)
            if (Number.isFinite(area) && area > 20) out.push({ id: 'abri_pc', message: 'Emprise > 20 m² : permis de construire requis.', field: 'largeur' })
            return out
        },
    },

    terrassement: {
        id: 'terrassement',
        icon: '⛰️',
        title: 'Terrassement',
        subtitle: 'Déblai / remblai, soutènement',
        desc: 'Mouvement de terre (déblai / remblai) ou mur de soutènement modifiant le profil du terrain',
        color: 'clay',
        descLabel: 'Détails du terrassement (type, hauteur, soutènement) :',
        descPlaceholder: 'Ex : Décaissement de 1,20 m sur 10 m avec mur de soutènement.',
        cerfaNature: 'nouvelle',
        createsSurface: false,
        requiresDP3: true,
        natureLabel: 'Terrassement / modification du profil du terrain',
        worksLabel: (data) => {
            const tr = data.travaux.terrassement
            if (!tr) return TRAVAUX_REGISTRY.terrassement.natureLabel
            const m = tr.type_mouvement === 'remblai' ? 'Remblai' : tr.type_mouvement === 'mixte' ? 'Déblai / remblai' : 'Déblai'
            return `${m}${tr.hauteur ? ` ${tr.hauteur} m` : ''}`.trim()
        },
        aiDescription: (data) => {
            const tr = data.travaux.terrassement
            if (!tr) return ''
            return tr.description || `Modification du profil du terrain (${tr.type_mouvement || 'déblai'}) sur une hauteur de ${tr.hauteur || '1'} m.`
        },
        validate: (data) => {
            const tr = data.travaux.terrassement
            const out: TravauxWarning[] = []
            if (!tr) return out
            if (blank(tr.hauteur)) out.push({ id: 'ter_h', message: 'Hauteur de déblai / remblai non précisée (plan de coupe).', field: 'hauteur' })
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

/** The proposed material + colour for the SELECTED work type (type-aware) — used by the PLU
 *  "Comparatif" so it never shows another type's value (e.g. isolation's colour on a ravalement). */
export function travauxAspect(data: DPFormData): { color: string; material: string } {
    const tr = data.travaux
    switch (tr.type) {
        case 'menuiseries': return { color: `${tr.menuiseries?.couleur || ''}${tr.menuiseries?.couleur_ral ? ` (RAL ${tr.menuiseries.couleur_ral})` : ''}`.trim(), material: tr.menuiseries?.materiau || '' }
        case 'isolation': return { color: tr.isolation?.couleur || '', material: (tr.isolation?.type_finition || '').replace(/_/g, ' ') }
        case 'cloture': return { color: tr.cloture?.couleur || '', material: tr.cloture?.materiau || '' }
        case 'ravalement': return { color: tr.ravalement?.couleur || '', material: tr.ravalement?.finition || '' }
        case 'toiture': return { color: tr.toiture?.couleur || '', material: tr.toiture?.materiau_couverture || '' }
        default: return { color: '', material: '' }
    }
}

/** Type-specific "Description du projet" sentence for the selected works: the sub-form's own
 *  description when filled, else a generated one. Used to pre-fill Étape 3's description field so
 *  it reflects the chosen type instead of a stale one from a previously-selected type. */
export function travauxDescription(data: DPFormData): string {
    const def = getTravauxDef(data.travaux.type)
    if (!def) return ''
    const sub = (data.travaux as unknown as Record<string, { description?: string } | undefined>)[def.id]
    const own = sub?.description?.trim()
    return own || def.worksLabel(data)
}
