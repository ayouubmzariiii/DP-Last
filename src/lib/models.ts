// DP Travaux - Data Models
import { TEST_DP4_NOTICE } from './testCache'

export type Civilite = 'M' | 'Mme' | 'Société' | ''

export type TypeTravaux = 'menuiseries' | 'isolation' | 'photovoltaique' | 'cloture' | 'ravalement' | 'toiture' | 'ouverture' | 'piscine' | 'extension' | 'abri' | 'terrassement' | ''

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

// Optional second applicant (co-déclarant) — common for joint owners / couples.
// Maps to CERFA section 2BIS.
export interface CoDemandeur {
    actif: boolean
    est_societe: boolean
    civilite: Civilite
    nom: string
    prenom: string
    // Société
    nom_societe: string
    type_societe: string
    siret: string
    representant_nom: string
    representant_prenom: string
}

export const emptyCoDemandeur: CoDemandeur = {
    actif: false, est_societe: false, civilite: 'M', nom: '', prenom: '',
    nom_societe: '', type_societe: '', siret: '', representant_nom: '', representant_prenom: '',
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
        plu?: {
            zone?: {
                libelle?: string
                typezone?: string
                nomzone?: string
                libelong?: string
                url_doc?: string
            }
            prescriptions?: Array<{
                libelle: string;
                typepresc: string;
            }>;
            fetchedAt?: string
            analysisReport?: string
            verified?: boolean
            source?: 'reglement' | 'estimation' | 'rnu'
            pdfType?: 'text' | 'scanned' | 'missing' | 'error'
            textLength?: number
            extractedText?: string
            isRnu?: boolean
            overlays?: {
                seismicZone?: string;
                seismicClass?: string;
                hasFloodRisk?: boolean;
                floodRisks?: Array<{
                    libelle: string;
                    dateEvt?: string;
                }>;
                hasPPRN?: boolean;
                pprnList?: Array<{
                    idGaspar: string;
                    libPpr: string;
                    modeleProcedure: string;
                }>;
                hasPPRT?: boolean;
                pprtList?: Array<{
                    idGaspar: string;
                    libPpr: string;
                    modeleProcedure: string;
                }>;
                hasSPR?: boolean;
                sprName?: string;
                monumentsWithin500m?: Array<{
                    reference: string;
                    title: string;
                    distance: number;
                    protection: string;
                }>;
            };
            extractedRules?: any;
            evaluationResult?: any;
        }
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

// ── Tier 1 work types (registry-driven; aspect-only, no new surface/volume) ──────────────────────
export interface TravauxCloture {
    type_cloture: 'mur' | 'mur_bahut' | 'grillage' | 'panneaux' | 'claire_voie' | ''
    materiau: string
    couleur: string
    hauteur: string   // mètres
    longueur: string  // mètres
    sur_voie: boolean // clôture implantée sur voie / espace public
    description: string
}
export interface TravauxRavalement {
    finition: 'enduit' | 'peinture' | 'pierre_apparente' | 'bardage' | ''
    couleur: string
    materiau: string
    facades_concernees: string[]
    description: string
}
export interface TravauxToiture {
    operation: 'refection_identique' | 'changement_materiau' | ''
    materiau_couverture: string
    couleur: string
    description: string
}
export interface TravauxOuverture {
    type_ouverture: 'fenetre' | 'porte' | 'porte_fenetre' | 'fenetre_toit' | ''
    operation: 'creation' | 'agrandissement' | 'suppression' | ''
    nombre: string
    largeur: string  // cm
    hauteur: string  // cm
    facade: string
    description: string
}

// ── Tier 2 work types (requiresDP3: modify the terrain profile / built volume) ────────────────────
export interface TravauxPiscine {
    longueur: string            // m
    largeur: string             // m
    profondeur: string          // m (sous le TN)
    hauteur_margelle: string    // m au-dessus du TN (souvent ~0,05)
    recul_maison: string        // m — distance bassin ↔ maison existante (prospect)
    local_technique: boolean
    description: string
}
export interface TravauxExtension {
    largeur: string             // m (dimension le long de la coupe)
    profondeur: string          // m (autre dimension au sol)
    hauteur_egout: string       // m / TN
    hauteur_faitage: string     // m / TN
    type_toit: 'mono' | 'double' | 'flat' | ''
    cote_adossement: 'gauche' | 'droite' | 'independante' | ''  // côté de la maison existante
    materiau: string
    couleur: string
    description: string
}
export interface TravauxAbri {
    largeur: string             // m
    profondeur: string          // m
    hauteur_egout: string       // m / TN
    hauteur_faitage: string     // m / TN
    type_toit: 'mono' | 'double' | 'flat' | ''
    materiau: string
    couleur: string
    description: string
}
export interface TravauxTerrassement {
    longueur: string            // m le long de la coupe
    type_mouvement: 'deblai' | 'remblai' | 'mixte' | ''
    hauteur: string             // m (déblai − / remblai +) — dénivelé max
    mur_soutenement: boolean
    hauteur_mur: string         // m
    description: string
}

export interface Travaux {
    type: TypeTravaux
    menuiseries?: TravauxMenuiseries
    isolation?: TravauxIsolation
    photovoltaique?: TravauxPhotovoltaique
    cloture?: TravauxCloture
    ravalement?: TravauxRavalement
    toiture?: TravauxToiture
    ouverture?: TravauxOuverture
    piscine?: TravauxPiscine
    extension?: TravauxExtension
    abri?: TravauxAbri
    terrassement?: TravauxTerrassement
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
    dp1_ground_m?: number                 // TRUE ground span (m) of the captured DP1 map, for the scale bar
    /** @deprecated Web-Mercator span of the DP1 capture (≈ ground/cos φ). Kept read-only so
     *  dossiers captured before the projection fix still print their real scale. */
    dp1_span_m?: number
    dp2_plan_masse: string | null         // URL carte statique zoom+
    dp2_span_m?: number                   // ground span (m) of the captured DP2 map, for scale bar
    dp3_coupe?: string | null             // plan de coupe (DP3) — captured PNG, only when requiresDP3
    dp4_notice: string | null            // texte généré
}

export interface ParcelleCadastrale {
    prefixe: string
    section: string
    numero: string
    /** Superficie de la parcelle en m². Les deux CERFA la demandent par parcelle
     *  (T2TP2/T2TP3 sur le 16702, colonne 4 du tableau sur le 13703). */
    superficie_m2?: string
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
    co_demandeur?: CoDemandeur
    terrain: Terrain
    travaux: Travaux
    photos: PhotosUploadees
    plans: PlansSauvegardes
    engagement?: Engagement

    // Infos complémentaires Cerfa - Etape 6
    cadastrales_multiparcelles: ParcelleCadastrale[]
    terrain_lotissement: boolean
    // Nature du bien support des travaux. C'est LE critère qui détermine le
    // formulaire CERFA : la notice n°51434#12 impose le 13703 dès que le projet
    // porte sur une maison individuelle ou l'une de ses annexes ; tout le reste
    // (immeuble collectif, local commercial, bâtiment agricole, terrain nu)
    // relève du 16702. Voir lib/cerfaForms.ts.
    nature_bien: 'maison_individuelle' | 'autre'
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
    adresse: '3 Rue de la République',
    lieu_dit: '',
    code_postal: '24200',
    commune: 'Sarlat-la-Canéda',
    coords: { lat: 44.89084, lon: 1.21553 },
    boite_postale: '',
    cedex: '',
    pays: 'France',
    division_territoriale: 'Nouvelle-Aquitaine',
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
    // Real, valid data: 3 Rue de la République, 24200 Sarlat-la-Canéda (INSEE 24520) — real
    // coordinates and a real cadastral parcel (section BH n°0172, 199 m²), in the PSMV (secteur
    // sauvegardé) of Sarlat's medieval centre, ringed by 37 Monuments Historiques < 500 m.
    adresse: '3 Rue de la République',
    lieu_dit: '',
    code_postal: '24200',
    commune: 'Sarlat-la-Canéda',
    coords: { lat: 44.89084, lon: 1.21553 },
    prefixe_cadastral: '000',
    section_cadastrale: 'BH',
    numero_parcelle: '0172',
    surface_terrain: '199',
    surface_plancher: '95',
    description_projet: 'Remplacement des menuiseries extérieures (fenêtres et porte d\'entrée) par des éléments en PVC blanc (RAL 9016). Immeuble situé dans le secteur sauvegardé (PSMV) du centre ancien de Sarlat-la-Canéda.',
    meme_adresse: true,
    // Pre-baked PLU result so TEST MODE stays consistent offline. REAL for this parcel: secteur
    // sauvegardé (PSMV), 37 Monuments Historiques < 500 m — maximum ABF constraints. The declared
    // works (PVC menuiseries) are deliberately NON-CONFORMING so the app flags a violation.
    plu: {
        zone: { libelle: 'PSMV', typezone: 'U', nomzone: 'Secteur sauvegardé — centre ancien', libelong: 'Plan de Sauvegarde et de Mise en Valeur (PSMV) du centre ancien de Sarlat-la-Canéda.', url_doc: '' },
        prescriptions: [],
        fetchedAt: '2026-06-29T00:00:00.000Z',
        isRnu: false,
        verified: true,
        source: 'reglement',
        pdfType: 'text',
        textLength: 24650,
        extractedText: "PSMV — SECTEUR SAUVEGARDÉ — DISPOSITIONS APPLICABLES\n\nAspect extérieur\nLe centre ancien de Sarlat est couvert par un Plan de Sauvegarde et de Mise en Valeur (PSMV) : tous les travaux modifiant l'aspect extérieur sont soumis à l'avis conforme de l'Architecte des Bâtiments de France (ABF). Les menuiseries seront en bois peint ; le PVC est proscrit. Les teintes vives sont interdites ; les tons doivent s'inscrire dans la palette du centre ancien. Les toitures seront en lauze ou en tuile plate de terre cuite ; les couvertures métalliques (bac acier, zinc) sont proscrites. Les clôtures sur rue reprendront les murs de pierre traditionnels. Les panneaux solaires visibles depuis l'espace public sont interdits.\n\nHauteur\nLa hauteur doit respecter celle des constructions voisines.\n[EXTRAIT — DONNÉES DE DÉMONSTRATION]",
        overlays: {
            seismicZone: '1', seismicClass: '1 - TRES FAIBLE',
            hasFloodRisk: false, floodRisks: [],
            hasPPRN: false, pprnList: [],
            hasPPRT: false, pprtList: [],
            hasSPR: true, sprName: 'Secteur sauvegardé de Sarlat-la-Canéda (PSMV)',
            monumentsWithin500m: [
                { reference: 'PA00082904', title: 'Maison de La Boétie', distance: 60, protection: 'Classé MH' },
                { reference: 'PA00082900', title: 'Cathédrale Saint-Sacerdos', distance: 110, protection: 'Classé MH' },
                { reference: 'PA00082906', title: 'Hôtel de Maleville', distance: 90, protection: 'Classé MH' },
            ],
        },
        extractedRules: {
            zone_code: 'PSMV',
            facade: { allowed: true, allowed_materials: ['bois', 'pierre', 'enduit à la chaux'], forbidden_materials: ['pvc', 'tôle', 'bac acier'], allowed_colors: [], forbidden_colors: ['couleurs vives'], color_restrictions: 'Teintes de la palette du centre ancien, validées par l\'ABF ; tons sobres.', excerpts: ['PSMV — avis conforme de l\'ABF obligatoire (secteur sauvegardé).'] },
            extension: { max_area_m2: 20, max_height_m: 9, allowed: true, permit_required_if_exceed: true, excerpts: ['Hauteur en cohérence avec le bâti voisin.'] },
            roof: { max_height_m: 9, allowed_materials: ['lauze', 'tuile plate terre cuite'], forbidden_materials: ['bac acier', 'zinc'], allowed_slopes: 'Fortes pentes traditionnelles (lauze)', excerpts: ['Toitures en lauze ou tuile plate ; couvertures métalliques proscrites.'] },
            window_openings: { allowed: true, conditions: 'Proportions et partitions conformes au bâti ancien ; percements limités sur les versants visibles.', excerpts: [] },
            heritage_override: { ABF_review: true, excerpts: ['PSMV — avis conforme de l\'ABF requis.'] },
        },
        evaluationResult: {
            status: 'NON CONFORME',
            decision: 'REFUS_PROBABLE_ABF',
            violations: [
                'Menuiseries PVC interdites dans le secteur sauvegardé (PSMV) de Sarlat-la-Canéda : le règlement impose le bois peint. Des fenêtres PVC blanc seront très probablement refusées par l\'Architecte des Bâtiments de France.',
            ],
            warnings: [
                'Projet en secteur sauvegardé (PSMV) et à proximité de plusieurs Monuments Historiques : avis conforme de l\'Architecte des Bâtiments de France (ABF) obligatoire, ce qui porte le délai d\'instruction à 2 mois.',
                'Remplacer le PVC par du bois peint d\'une teinte validée par l\'ABF avant tout dépôt pour éviter un refus.',
            ],
        },
        analysisReport: "### STATUT DE CONFORMITÉ\nNON CONFORME. Le projet prévoit des menuiseries en PVC blanc, or le PVC est interdit dans le secteur sauvegardé (PSMV) du centre ancien de Sarlat-la-Canéda. En l'état, la déclaration s'expose à un avis défavorable de l'Architecte des Bâtiments de France (ABF).\n\n### DÉCRYPTAGE DE LA ZONE D'URBANISME\nLe PSMV couvre le centre médiéval de Sarlat, à très forte valeur patrimoniale. Toute modification de l'aspect extérieur y est encadrée par le règlement du secteur sauvegardé et soumise à l'avis conforme de l'ABF.\n\n### RÈGLES PLU CLÉS À CONSEILLER\n- Menuiseries : PVC PROSCRIT ; bois peint imposé.\n- Avis de l'ABF obligatoire (secteur sauvegardé PSMV) — délai 2 mois.\n- Teintes : palette du centre ancien, tons sobres ; teintes vives interdites.\n- Toitures : lauze ou tuile plate de terre cuite ; bac acier / zinc proscrits.\n- Panneaux solaires visibles depuis la rue : interdits.\n\n### RISQUES ET ALERTES PATRIMONIALES\nSecteur sauvegardé (PSMV) de Sarlat-la-Canéda et 37 Monuments Historiques recensés dans un rayon de 500 m (Maison de La Boétie, Cathédrale Saint-Sacerdos, Hôtel de Maleville…). Avis conforme de l'ABF requis. Commune en zone de sismicité très faible (1).\n\n### RECOMMANDATIONS CONSTRUCTIVES\n- Abandonner le PVC : opter pour du bois peint d'une teinte validée par l'ABF.\n- Joindre un nuancier et un détail des profils de menuiseries.\n- Conserver les proportions et partitions des baies existantes.\n- Anticiper le délai d'instruction de 2 mois lié à l'avis de l'ABF.",
    },
}

// TEST FIXTURE — every work type carries DELIBERATELY NON-CONFORMING details for the Sarlat PSMV
// (secteur sauvegardé), so selecting any type shows an "illegal" project the app can flag:
//   menuiseries  PVC (bois peint imposé)           · isolation    bardage métal + teinte vive
//   photovoltaïque  panneaux visibles depuis la rue · clôture      PVC 2,20 m sur rue (mur pierre imposé)
//   ravalement   peinture bleu vif hors nuancier    · toiture      bac acier (lauze/tuile imposée)
//   ouverture    velux sur le versant visible de la rue
export const defaultTravaux: Travaux = {
    type: 'menuiseries',
    menuiseries: {
        type: 'fenetre',
        materiau: 'pvc',
        couleur: 'Blanc',
        couleur_ral: 'RAL 9016',
        nombre: '4',
        largeur: '120',
        hauteur: '115',
        remplacement: true,
        description: 'Remplacement des fenêtres existantes par des fenêtres PVC blanc (RAL 9016), double vitrage 4/16/4 argon.',
    },
    isolation: {
        type_finition: 'bardage_metal',
        couleur: 'Rouge vif',
        epaisseur_isolant: '16',
        materiau_isolant: 'Polystyrène expansé (PSE)',
        facades_concernees: ['Toutes les façades'],
        description: 'ITE avec bardage métallique rouge vif sur la façade en pierre donnant sur rue.',
    },
    photovoltaique: {
        nombre_panneaux: '12',
        surface_totale: '24',
        puissance_kw: '6',
        marque: 'SunPower SPR-MAX3-400',
        orientation: 'Sud',
        inclinaison: '30',
        integration: 'surimposition',
        description: 'Pose de 12 panneaux en surimposition sur le versant de toiture visible depuis la rue.',
    },
    cloture: {
        type_cloture: 'panneaux',
        materiau: 'PVC',
        couleur: 'Blanc',
        hauteur: '2.20',
        longueur: '15',
        sur_voie: true,
        description: 'Clôture en panneaux PVC blancs de 2,20 m de haut en limite sur rue.',
    },
    ravalement: {
        finition: 'peinture',
        couleur: 'Bleu vif',
        materiau: 'Peinture acrylique',
        facades_concernees: ['Façade avant'],
        description: 'Ravalement de la façade sur rue avec une peinture acrylique bleu vif.',
    },
    toiture: {
        operation: 'changement_materiau',
        materiau_couverture: 'Bac acier gris',
        couleur: 'Gris anthracite',
        description: 'Remplacement de la couverture existante par du bac acier gris anthracite.',
    },
    piscine: {
        longueur: '8', largeur: '4', profondeur: '1.5', hauteur_margelle: '0.05', recul_maison: '3',
        local_technique: true,
        description: 'Création d’une piscine enterrée de 8 × 4 m (32 m²), profondeur 1,50 m, margelle au niveau du terrain.',
    },
    extension: {
        largeur: '4', profondeur: '5', hauteur_egout: '2.6', hauteur_faitage: '4.1', type_toit: 'mono', cote_adossement: 'gauche',
        materiau: 'Enduit ton pierre', couleur: 'Ton pierre',
        description: 'Extension de 20 m² adossée au pignon, toiture mono-pente, enduit ton pierre.',
    },
    abri: {
        largeur: '3', profondeur: '4', hauteur_egout: '2', hauteur_faitage: '2.5', type_toit: 'double',
        materiau: 'Bois', couleur: 'Bois naturel',
        description: 'Abri de jardin en bois de 12 m², toiture à deux pans.',
    },
    terrassement: {
        longueur: '10', type_mouvement: 'deblai', hauteur: '1.2', mur_soutenement: true, hauteur_mur: '1.2',
        description: 'Décaissement du terrain sur 10 m avec mur de soutènement de 1,20 m.',
    },
    ouverture: {
        type_ouverture: 'fenetre_toit',
        operation: 'creation',
        nombre: '2',
        largeur: '114',
        hauteur: '140',
        facade: 'Versant de toiture donnant sur la rue',
        description: 'Création de 2 fenêtres de toit (velux) sur le versant visible depuis la rue.',
    },
    // Description shown in "Description & Surfaces" — must equal travauxDescription(menuiseries)
    // (i.e. menuiseries.description) so Étape 3's selectType recognises it as auto and refreshes it
    // when another type is chosen.
    description_projet: 'Remplacement des fenêtres existantes par des fenêtres PVC blanc (RAL 9016), double vitrage 4/16/4 argon.',
    surfaces: {
        existante: '95',
        creee: '0',
        supprimee: '0'
    }
}

export const defaultPhotos: PhotosUploadees = {
    // Real photos served from public/test/ (downloaded), so test mode shows real façades.
    facade_avant: '/test/facade-principale.jpg',
    facade_droite: '/test/facade-laterale.jpg',
    facade_gauche: null,
    facade_arriere: null,
    facades: [
        // Both façades ship with their CACHED AI generations (after-simulation + croquis) so
        // test mode and the test API show a complete dossier instantly, without any AI call.
        // Regenerate via GET /api/dev/test-dossier?doc=dp&fresh=1&cache=1.
        { id: 'f1', label: 'Façade principale (avant)', before: '/test/facade-principale.jpg', after: '/test/cache/after-principale.jpg', croquis: '/test/cache/croquis-principale.png', type: 'avant' },
        { id: 'f2', label: 'Façade latérale', before: '/test/facade-laterale.jpg', after: '/test/cache/after-laterale.jpg', croquis: '/test/cache/croquis-laterale.png', type: 'droite' }
    ],
    dp7_vue_proche: '/test/vue-proche.jpg',
    dp8_vue_lointaine: '/test/vue-lointaine.jpg',
    facade_apres_ai: null, // Simulation IA après travaux (DP6) — generated + cached on demand
    facade_croquis_ai: null, // Croquis IA après travaux (DP5)
}

export const defaultPlans: PlansSauvegardes = {
    // Maps are captured live from IGN at l'étape Plans (not pre-baked).
    dp1_carte_situation: null,
    dp2_plan_masse: null,
    dp4_notice: TEST_DP4_NOTICE, // cached AI notice (see src/lib/testCache.ts)
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
    co_demandeur: emptyCoDemandeur,
    terrain: defaultTerrain,
    travaux: defaultTravaux,
    photos: defaultPhotos,
    plans: defaultPlans,

    // Nouveaux champs Etape 6 (CERFA détaillé)
    cadastrales_multiparcelles: [],
    terrain_lotissement: false,
    nature_bien: 'maison_individuelle',
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
    lieu_signature: 'Sarlat-la-Canéda',

    engagement: {
        lieu: 'Sarlat-la-Canéda',
        date: new Date().toISOString().split('T')[0],
        signature: false
    },

    cerfa: defaultCerfaData
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST-MODE fixture for the wizard UI (the "Mode test" toggle). It is the same demo dossier as
// defaultFormData, but with every AUTOMATICALLY-DERIVED field emptied so you can watch the real
// auto-fill pipeline populate them (and confirm it works) instead of demo values masking it:
//   • coords            ← geocoded from the address (api-adresse)
//   • cadastral ref      ← résolue depuis la parcelle (/api/cadastre)  [préfixe / section / numéro]
//   • surface_terrain    ← contenance officielle de la parcelle (/api/cadastre)
//   • plu                ← zonage + patrimoine + risques (/api/fetch-plu)
// Manually-entered fields (identité, adresse, travaux, photos, surface plancher) stay filled.
// NB: defaultFormData deliberately keeps the FULL data — the offline server harness
// (/api/dev/test-dossier) bypasses these UI effects and must render a complete dossier on its own.
export const testModeFormData: DPFormData = (() => {
    const d = JSON.parse(JSON.stringify(defaultFormData)) as DPFormData
    d.demandeur.coords = undefined
    d.terrain.coords = undefined
    d.terrain.prefixe_cadastral = ''
    d.terrain.section_cadastrale = ''
    d.terrain.numero_parcelle = ''
    d.terrain.surface_terrain = ''
    d.terrain.plu = undefined
    return d
})()

export const emptyDemandeur: Demandeur = {
    civilite: 'M', nom: '', prenom: '', date_naissance: '', lieu_naissance: '', departement_naissance: '', pays_naissance: 'France',
    adresse: '', lieu_dit: '', code_postal: '', commune: '', boite_postale: '', cedex: '', pays: 'France', division_territoriale: '', indicatif_etranger: '',
    telephone: '', email: '', est_societe: false, nom_societe: '', type_societe: '', siret: '', representant_nom: '', representant_prenom: '',
}

export const emptyTerrain: Terrain = {
    adresse: '', lieu_dit: '', code_postal: '', commune: '', prefixe_cadastral: '', section_cadastrale: '', numero_parcelle: '',
    surface_terrain: '', surface_plancher: '', description_projet: '', meme_adresse: true,
    plu: undefined,
}

export const emptyTravaux: Travaux = {
    // No pre-selected works type: the client must choose explicitly at Étape 3 (a silent
    // default risks a DP filed for the wrong works). '' is a valid TypeTravaux.
    type: '',
    menuiseries: { type: 'fenetre', materiau: 'aluminium', couleur: '', couleur_ral: '', nombre: '', largeur: '', hauteur: '', remplacement: true, description: '' },
    isolation: { type_finition: 'enduit', couleur: '', epaisseur_isolant: '', materiau_isolant: '', facades_concernees: [], description: '' },
    photovoltaique: { nombre_panneaux: '', surface_totale: '', puissance_kw: '', marque: '', orientation: '', inclinaison: '', integration: 'surimposition', description: '' },
    cloture: { type_cloture: '', materiau: '', couleur: '', hauteur: '', longueur: '', sur_voie: true, description: '' },
    ravalement: { finition: 'enduit', couleur: '', materiau: '', facades_concernees: [], description: '' },
    toiture: { operation: 'refection_identique', materiau_couverture: '', couleur: '', description: '' },
    ouverture: { type_ouverture: 'fenetre', operation: 'creation', nombre: '', largeur: '', hauteur: '', facade: '', description: '' },
    piscine: { longueur: '', largeur: '', profondeur: '', hauteur_margelle: '0.05', recul_maison: '', local_technique: false, description: '' },
    extension: { largeur: '', profondeur: '', hauteur_egout: '', hauteur_faitage: '', type_toit: '', cote_adossement: '', materiau: '', couleur: '', description: '' },
    abri: { largeur: '', profondeur: '', hauteur_egout: '', hauteur_faitage: '', type_toit: '', materiau: '', couleur: '', description: '' },
    terrassement: { longueur: '', type_mouvement: '', hauteur: '', mur_soutenement: false, hauteur_mur: '', description: '' },
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
    co_demandeur: emptyCoDemandeur,
    terrain: emptyTerrain,
    travaux: emptyTravaux,
    photos: emptyPhotos,
    plans: emptyPlans,
    cadastrales_multiparcelles: [], terrain_lotissement: false, nature_bien: 'maison_individuelle',
    nature_travaux: 'travaux_existante', projet_concerne: 'principale',
    sous_nature_nouvelle: { piscine: false, garage: false, veranda: false, abri_jardin: false, autre: false, autre_desc: '' },
    sous_nature_existante: { extension: false, surelevation: false, creation_niveaux: false, autre: false, autre_desc: '' },
    zones_specifiques: { site_patrimonial: false, abords_monument: false, site_classe: false },
    taxation: { logements_crees: '0', stationnement_non_couvert: '0', stationnement_couvert: '0', surface_bassin_piscine: '0', destination_habitation_existante: '0', destination_habitation_creee: '0', destination_habitation_supprimee: '0', financement_ptz: false, financement_pret_social: false },
    accord_dematerialisation: true, architecte_nom: '', architecte_inscription: '', surface_existante: '', surface_creee: '', surface_supprimee: '',
    date_signature: '', lieu_signature: '', engagement: { lieu: '', date: '', signature: false },
    cerfa: emptyCerfaData
}
