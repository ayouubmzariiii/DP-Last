// DP Travaux - Data Models

export type Civilite = 'M' | 'Mme' | 'Société' | ''

export type TypeTravaux = 'menuiseries' | 'isolation' | 'photovoltaique' | ''

export type TypeMenuiserie = 'fenetre' | 'porte' | 'volet' | 'baie_vitree' | ''
export type MateriauMenuiserie = 'pvc' | 'aluminium' | 'bois' | 'mixte' | ''

export type TypeIsolation = 'enduit' | 'bardage_bois' | 'bardage_metal' | 'bardage_composite' | ''

export interface Demandeur {
    civilite: Civilite
    nom: string
    prenom: string
    date_naissance: string
    lieu_naissance: string
    departement_naissance: string
    pays_naissance: string
    adresse: string
    lieu_dit: string
    code_postal: string
    commune: string
    coords?: { lat: number; lon: number }
    boite_postale: string
    cedex: string
    pays: string
    division_territoriale: string
    indicatif_etranger: string
    telephone: string
    email: string
    // Société
    est_societe: boolean
    nom_societe: string
    type_societe: string
    siret: string
    representant_nom: string
    representant_prenom: string
}

export interface Terrain {
    adresse: string
    lieu_dit: string
    code_postal: string
    commune: string
    coords?: { lat: number; lon: number }
    prefixe_cadastral: string
    section_cadastrale: string
    numero_parcelle: string
    surface_terrain: string
    surface_plancher: string
    description_projet: string
    // Identique au demandeur ?
    meme_adresse: boolean
}

export interface TravauxMenuiseries {
    type: TypeMenuiserie
    materiau: MateriauMenuiserie
    couleur: string
    couleur_ral: string
    nombre: string
    largeur: string
    hauteur: string
    remplacement: boolean
    description: string
}

export interface TravauxIsolation {
    type_finition: TypeIsolation
    couleur: string
    epaisseur_isolant: string
    materiau_isolant: string
    facades_concernees: string[]
    description: string
}

export interface TravauxPhotovoltaique {
    nombre_panneaux: string
    surface_totale: string
    puissance_kw: string
    marque: string
    orientation: string
    inclinaison: string
    integration: 'surimposition' | 'integration' | ''
    description: string
}

export interface Travaux {
    type: TypeTravaux
    menuiseries?: TravauxMenuiseries
    isolation?: TravauxIsolation
    photovoltaique?: TravauxPhotovoltaique
    description_projet?: string
    surfaces?: {
        existante: string
        creee: string
        supprimee: string
    }
}

export interface FacadePhoto {
    id: string
    label: string
    before: string | null
    after: string | null
    croquis: string | null
    type: 'avant' | 'arriere' | 'droite' | 'gauche' | 'autre'
}

export interface PhotosUploadees {
    // DP5 - photos facades existantes
    facade_avant: string | null       // base64 (Deprecated: use facades[0])
    facade_droite: string | null
    facade_gauche: string | null
    facade_arriere: string | null

    // Multi-facade support
    facades: FacadePhoto[]

    // DP7/DP8 - photos extérieures
    dp7_vue_proche: string | null
    dp8_vue_lointaine: string | null
    // Apres travaux simulées (via IA)
    facade_apres_ai: string | null    // photorealistic simulation (DP6) (Deprecated: use facades[0].after)
    facade_croquis_ai: string | null  // architectural drawing (DP5) (Deprecated: use facades[0].croquis)
}

export interface PlansSauvegardes {
    dp1_carte_situation: string | null    // URL carte statique
    dp2_plan_masse: string | null         // URL carte statique zoom+
    dp4_notice: string | null            // texte généré
}

export interface ParcelleCadastrale {
    prefixe: string
    section: string
    numero: string
}

export interface CerfaData {
    // 1 - Declarant (Physique)
    declarant_physique: { nom: string; prenom: string; date_naissance: string; commune: string; departement: string; pays: string; };
    // 1.2 - Declarant (Morale)
    declarant_morale: { denomination: string; raison_sociale: string; type_societe: string; representant_nom: string; representant_prenom: string; siret: string; };
    // 2 - Adresse
    adresse: { numero: string; voie: string; lieu_dit: string; localite: string; code_postal: string; boite_postale: string; cedex: string; etranger_pays: string; etranger_division: string; telephone: string; indicatif_etranger: string; email: string; accept_email: boolean; };
    // 2BIS - Co-Declarant
    co_declarant: {
        particulier_nom: string; particulier_prenom: string;
        morale_raison_sociale: string; morale_denomination: string; morale_type_societe: string; morale_representant_nom: string; morale_representant_prenom: string;
        adresse_voie: string; adresse_numero: string; adresse_lieu_dit: string; adresse_localite: string; adresse_code_postal: string;
        etranger_pays: string; etranger_division: string;
        siret: string; telephone: string; telephone_indicatif: string; email: string;
    };
    // 3 - Terrain
    terrain: {
        adresse_numero: string; adresse_voie: string; adresse_lieu_dit: string; adresse_localite: string; adresse_code_postal: string;
        cadastres: { prefixe: string; section: string; numero: string; superficie_m2: string }[];
        si_lotissement: boolean;
    };
    // 4 - Projet
    projet: {
        nouvelle_construction: boolean; piscine: boolean; garage: boolean; veranda: boolean; abri_jardin: boolean;
        construction_existante: boolean; extension: boolean; surelevation: boolean; creation_niveaux: boolean;
        cloture: boolean; nouvelle_construction_autre: string; construction_existante_autre: string;
        description_projet: string; residence_principale: boolean; residence_secondaire: boolean;
    };
    // 4.2 - Surfaces
    surfaces: { existante: string; creee: string; supprimee: string; };
    // 5 - Special declarations
    special: { case_1: boolean; case_2: boolean; case_3: boolean; case_4: boolean; case_5: boolean; case_6: boolean; case_7: boolean; detail: string; };
    // 8 - Declaration
    engagement: { lieu: string; date: string; signature: boolean; };
    // Attachments
    pieces_jointes: Record<string, boolean>; // dynamically mapped dp1 to dp25
}

export interface TaxationDetails {
    logements_crees: string
    stationnement_non_couvert: string
    stationnement_couvert: string
    surface_bassin_piscine: string
    destination_habitation_existante: string
    destination_habitation_creee: string
    destination_habitation_supprimee: string
    financement_ptz: boolean
    financement_pret_social: boolean
}

export interface Engagement {
    lieu: string
    date: string
    signature: boolean
}

export interface DPFormData {
    demandeur: Demandeur
    terrain: Terrain
    travaux: Travaux
    photos: PhotosUploadees
    plans: PlansSauvegardes
    engagement?: Engagement

    // Infos complémentaires Cerfa - Etape 6
    cadastrales_multiparcelles: ParcelleCadastrale[]
    terrain_lotissement: boolean
    nature_travaux: string // 'nouvelle_construction', 'travaux_existante', 'cloture', 'piscine'
    projet_concerne: 'principale' | 'secondaire' | ''
    sous_nature_nouvelle: {
        piscine: boolean
        garage: boolean
        veranda: boolean
        abri_jardin: boolean
        autre: boolean
        autre_desc: string
    }
    sous_nature_existante: {
        extension: boolean
        surelevation: boolean
        creation_niveaux: boolean
        autre: boolean
        autre_desc: string
    }
    zones_specifiques: {
        site_patrimonial: boolean
        abords_monument: boolean
        site_classe: boolean
    }
    taxation: TaxationDetails
    accord_dematerialisation: boolean

    architecte_nom: string
    architecte_inscription: string
    surface_existante: string
    surface_creee: string
    surface_supprimee: string
    date_signature: string
    lieu_signature: string

    // Ultimate CERFA Root
    cerfa: CerfaData
}

export const defaultDemandeur: Demandeur = {
    civilite: 'M',
    nom: 'Martin',
    prenom: 'Pierre',
    date_naissance: '01/01/1980',
    lieu_naissance: 'Lyon',
    departement_naissance: '69',
    pays_naissance: 'France',
    adresse: '14 rue des Tilleuls',
    lieu_dit: 'Les Acacias',
    code_postal: '38200',
    commune: 'Vienne',
    boite_postale: 'BP 123',
    cedex: '38201 Vienne Cedex',
    pays: 'France',
    division_territoriale: 'Auvergne-Rhône-Alpes',
    indicatif_etranger: '',
    telephone: '06 12 34 56 78',
    email: 'pierre.martin@exemple.fr',
    est_societe: false,
    nom_societe: 'Martin & Fils',
    type_societe: 'SARL',
    siret: '12345678900012',
    representant_nom: 'Martin',
    representant_prenom: 'Pierre',
}

export const defaultTerrain: Terrain = {
    adresse: '14 rue des Tilleuls',
    lieu_dit: 'Le Colombier',
    code_postal: '38200',
    commune: 'Vienne',
    prefixe_cadastral: '000',
    section_cadastrale: 'AB',
    numero_parcelle: '0124',
    surface_terrain: '650',
    surface_plancher: '120',
    description_projet: 'Remplacement des menuiseries extérieures (fenêtres et porte d\'entrée) par des éléments en aluminium anthracite. La maison est de plain-pied, construite en 1975.',
    meme_adresse: true,
}

export const defaultTravaux: Travaux = {
    type: 'menuiseries',
    menuiseries: {
        type: 'fenetre',
        materiau: 'aluminium',
        couleur: 'Gris anthracite',
        couleur_ral: 'RAL 7016',
        nombre: '4',
        largeur: '120',
        hauteur: '115',
        remplacement: true,
        description: 'Remplacement des fenêtres existantes par des fenêtres aluminium bicolore (blanc intérieur / anthracite extérieur) avec double vitrage 4/16/4 argon.',
    },
    isolation: {
        type_finition: 'enduit',
        couleur: 'Beige sablé',
        epaisseur_isolant: '14',
        materiau_isolant: 'Laine de roche',
        facades_concernees: ['Façade avant', 'Façade arrière'],
        description: '',
    },
    photovoltaique: {
        nombre_panneaux: '12',
        surface_totale: '24',
        puissance_kw: '6',
        marque: 'SunPower SPR-MAX3-400',
        orientation: 'Sud',
        inclinaison: '30',
        integration: 'surimposition',
        description: '',
    },
    description_projet: 'Rénovation énergétique globale incluant la pose d\'une isolation par l\'extérieur sur les murs Nord et Est. Les teintes choisies sont en adéquation avec le PLU local.',
    surfaces: {
        existante: '110',
        creee: '0',
        supprimee: '0'
    }
}

export const defaultPhotos: PhotosUploadees = {
    facade_avant: '/test-avant1.jpg',    // Façade principale (avant 1)
    facade_droite: '/test-avant2.jpg',   // Façade latérale (avant 2)
    facade_gauche: null,
    facade_arriere: null,
    facades: [
        { id: 'f1', label: 'Façade principale (avant)', before: '/test-avant1.jpg', after: null, croquis: null, type: 'avant' },
        { id: 'f2', label: 'Façade latérale', before: '/test-avant2.jpg', after: null, croquis: null, type: 'droite' }
    ],
    dp7_vue_proche: '/test-avant1.jpg',  // DP7 : vue proche (avant 1)
    dp8_vue_lointaine: '/test-avant2.jpg', // DP8 : vue lointaine (avant 2)
    facade_apres_ai: null, // Simulation IA après travaux (DP6)
    facade_croquis_ai: null, // Croquis IA après travaux (DP5)
}

export const defaultPlans: PlansSauvegardes = {
    dp1_carte_situation: '/test-avant1.jpg',
    dp2_plan_masse: '/test-avant2.jpg',
    dp4_notice: null,
}

export const defaultCerfaData: CerfaData = {
    declarant_physique: { nom: '', prenom: '', date_naissance: '', commune: '', departement: '', pays: '' },
    declarant_morale: { denomination: '', raison_sociale: '', type_societe: '', representant_nom: '', representant_prenom: '', siret: '' },
    adresse: { numero: '', voie: '', lieu_dit: '', localite: '', code_postal: '', boite_postale: '', cedex: '', etranger_pays: '', etranger_division: '', telephone: '', indicatif_etranger: '', email: '', accept_email: false },
    co_declarant: { particulier_nom: '', particulier_prenom: '', morale_raison_sociale: '', morale_denomination: '', morale_type_societe: '', morale_representant_nom: '', morale_representant_prenom: '', adresse_voie: '', adresse_numero: '', adresse_lieu_dit: '', adresse_localite: '', adresse_code_postal: '', etranger_pays: '', etranger_division: '', siret: '', telephone: '', telephone_indicatif: '', email: '' },
    terrain: { adresse_numero: '', adresse_voie: '', adresse_lieu_dit: '', adresse_localite: '', adresse_code_postal: '', cadastres: [{ prefixe: '', section: '', numero: '', superficie_m2: '' }], si_lotissement: false },
    projet: { nouvelle_construction: false, piscine: false, garage: false, veranda: false, abri_jardin: false, construction_existante: false, extension: false, surelevation: false, creation_niveaux: false, cloture: false, nouvelle_construction_autre: '', construction_existante_autre: '', description_projet: '', residence_principale: false, residence_secondaire: false },
    surfaces: { existante: '', creee: '', supprimee: '' },
    special: { case_1: false, case_2: false, case_3: false, case_4: false, case_5: false, case_6: false, case_7: false, detail: '' },
    engagement: { lieu: '', date: '', signature: false },
    pieces_jointes: { dp1: false, dp2: false }
}

export const defaultFormData: DPFormData = {
    demandeur: defaultDemandeur,
    terrain: defaultTerrain,
    travaux: defaultTravaux,
    photos: defaultPhotos,
    plans: defaultPlans,

    // Nouveaux champs Etape 6 (CERFA détaillé)
    cadastrales_multiparcelles: [],
    terrain_lotissement: false,
    nature_travaux: 'travaux_existante',
    projet_concerne: 'principale',
    sous_nature_nouvelle: { piscine: false, garage: false, veranda: false, abri_jardin: false, autre: false, autre_desc: '' },
    sous_nature_existante: { extension: false, surelevation: false, creation_niveaux: false, autre: false, autre_desc: '' },
    zones_specifiques: {
        site_patrimonial: false,
        abords_monument: false,
        site_classe: false
    },
    taxation: {
        logements_crees: '0',
        stationnement_non_couvert: '0',
        stationnement_couvert: '0',
        surface_bassin_piscine: '0',
        destination_habitation_existante: '95',
        destination_habitation_creee: '0',
        destination_habitation_supprimee: '0',
        financement_ptz: false,
        financement_pret_social: false
    },
    accord_dematerialisation: true,

    architecte_nom: '',
    architecte_inscription: '',
    surface_existante: '95',
    surface_creee: '0',
    surface_supprimee: '0',
    date_signature: new Date().toISOString().split('T')[0],
    lieu_signature: 'Vienne',

    engagement: {
        lieu: 'Vienne',
        date: new Date().toISOString().split('T')[0],
        signature: false
    },

    cerfa: defaultCerfaData
}

export const emptyDemandeur: Demandeur = {
    civilite: 'M', nom: '', prenom: '', date_naissance: '', lieu_naissance: '', departement_naissance: '', pays_naissance: '',
    adresse: '', lieu_dit: '', code_postal: '', commune: '', boite_postale: '', cedex: '', pays: 'France', division_territoriale: '', indicatif_etranger: '',
    telephone: '', email: '', est_societe: false, nom_societe: '', type_societe: '', siret: '', representant_nom: '', representant_prenom: '',
}

export const emptyTerrain: Terrain = {
    adresse: '', lieu_dit: '', code_postal: '', commune: '', prefixe_cadastral: '', section_cadastrale: '', numero_parcelle: '',
    surface_terrain: '', surface_plancher: '', description_projet: '', meme_adresse: true,
}

export const emptyTravaux: Travaux = {
    type: 'menuiseries',
    menuiseries: { type: 'fenetre', materiau: 'aluminium', couleur: '', couleur_ral: '', nombre: '', largeur: '', hauteur: '', remplacement: true, description: '' },
    isolation: { type_finition: 'enduit', couleur: '', epaisseur_isolant: '', materiau_isolant: '', facades_concernees: [], description: '' },
    photovoltaique: { nombre_panneaux: '', surface_totale: '', puissance_kw: '', marque: '', orientation: '', inclinaison: '', integration: 'surimposition', description: '' },
    description_projet: '', surfaces: { existante: '', creee: '', supprimee: '' }
}

export const emptyPhotos: PhotosUploadees = {
    facade_avant: null,
    facade_droite: null,
    facade_gauche: null,
    facade_arriere: null,
    facades: [
        { id: '1', label: 'Façade principale (avant)', before: null, after: null, croquis: null, type: 'avant' },
        { id: '2', label: 'Façade arrière', before: null, after: null, croquis: null, type: 'arriere' },
        { id: '3', label: 'Façade latérale droite', before: null, after: null, croquis: null, type: 'droite' },
        { id: '4', label: 'Façade latérale gauche', before: null, after: null, croquis: null, type: 'gauche' },
    ],
    dp7_vue_proche: null,
    dp8_vue_lointaine: null,
    facade_apres_ai: null,
    facade_croquis_ai: null
}
export const emptyPlans: PlansSauvegardes = { dp1_carte_situation: null, dp2_plan_masse: null, dp4_notice: null }

export const emptyCerfaData: CerfaData = {
    declarant_physique: { nom: '', prenom: '', date_naissance: '', commune: '', departement: '', pays: '' },
    declarant_morale: { denomination: '', raison_sociale: '', type_societe: '', representant_nom: '', representant_prenom: '', siret: '' },
    adresse: { numero: '', voie: '', lieu_dit: '', localite: '', code_postal: '', boite_postale: '', cedex: '', etranger_pays: '', etranger_division: '', telephone: '', indicatif_etranger: '', email: '', accept_email: false },
    co_declarant: { particulier_nom: '', particulier_prenom: '', morale_raison_sociale: '', morale_denomination: '', morale_type_societe: '', morale_representant_nom: '', morale_representant_prenom: '', adresse_voie: '', adresse_numero: '', adresse_lieu_dit: '', adresse_localite: '', adresse_code_postal: '', etranger_pays: '', etranger_division: '', siret: '', telephone: '', telephone_indicatif: '', email: '' },
    terrain: { adresse_numero: '', adresse_voie: '', adresse_lieu_dit: '', adresse_localite: '', adresse_code_postal: '', cadastres: [{ prefixe: '', section: '', numero: '', superficie_m2: '' }], si_lotissement: false },
    projet: { nouvelle_construction: false, piscine: false, garage: false, veranda: false, abri_jardin: false, construction_existante: false, extension: false, surelevation: false, creation_niveaux: false, cloture: false, nouvelle_construction_autre: '', construction_existante_autre: '', description_projet: '', residence_principale: false, residence_secondaire: false },
    surfaces: { existante: '', creee: '', supprimee: '' },
    special: { case_1: false, case_2: false, case_3: false, case_4: false, case_5: false, case_6: false, case_7: false, detail: '' },
    engagement: { lieu: '', date: '', signature: false },
    pieces_jointes: { dp1: false, dp2: false }
}

export const emptyFormData: DPFormData = {
    demandeur: emptyDemandeur,
    terrain: emptyTerrain,
    travaux: emptyTravaux,
    photos: emptyPhotos,
    plans: emptyPlans,
    cadastrales_multiparcelles: [], terrain_lotissement: false, nature_travaux: 'travaux_existante', projet_concerne: 'principale',
    sous_nature_nouvelle: { piscine: false, garage: false, veranda: false, abri_jardin: false, autre: false, autre_desc: '' },
    sous_nature_existante: { extension: false, surelevation: false, creation_niveaux: false, autre: false, autre_desc: '' },
    zones_specifiques: { site_patrimonial: false, abords_monument: false, site_classe: false },
    taxation: { logements_crees: '0', stationnement_non_couvert: '0', stationnement_couvert: '0', surface_bassin_piscine: '0', destination_habitation_existante: '0', destination_habitation_creee: '0', destination_habitation_supprimee: '0', financement_ptz: false, financement_pret_social: false },
    accord_dematerialisation: true, architecte_nom: '', architecte_inscription: '', surface_existante: '', surface_creee: '', surface_supprimee: '',
    date_signature: '', lieu_signature: '', engagement: { lieu: '', date: '', signature: false },
    cerfa: emptyCerfaData
}
