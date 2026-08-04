// ─────────────────────────────────────────────────────────────────────────────
// Choix du formulaire CERFA et correspondance des champs.
//
// Il existe DEUX formulaires de déclaration préalable, et ils coexistent — l'un
// n'a jamais remplacé l'autre :
//
//   • 13703*12 — « DP portant sur une MAISON INDIVIDUELLE et/ou ses annexes ».
//     La notice officielle n°51434#12 est impérative sur ce point :
//     « Lorsque votre projet concerne une maison individuelle existante, vous
//     DEVEZ utiliser le formulaire […] (cerfa n° 13703). »
//
//   • 16702*03 — « DP constructions et travaux non soumis à permis de
//     construire », successeur du 13404. Pour tout ce qui ne porte PAS sur une
//     maison individuelle : immeuble collectif, local commercial ou
//     professionnel, bâtiment agricole, terrain nu.
//
// (Un troisième formulaire couvre les lotissements et divisions foncières :
//  hors périmètre de l'application, qui ne traite pas d'aménagements.)
//
// ── Pourquoi une table de correspondance ─────────────────────────────────────
// Les deux formulaires partagent le même vocabulaire de champs (D1N_nom,
// T2S_section, C2ZD1_description…) : 95 champs communs. Le 13703 est pour
// l'essentiel un sous-ensemble du 16702, à quelques exceptions près, listées
// dans FIELD_MAP ci-dessous. Le générateur écrit donc TOUJOURS dans le
// vocabulaire du 16702, et cette table traduit vers le formulaire retenu.
//
// Chaque correspondance ci-dessous a été établie sur les PDF officiels — par
// comparaison des libellés ET des coordonnées des champs — jamais par
// supposition. Les colonnes du tableau de parcelles du 13703, par exemple, sont
// identifiées par alignement exact (même x, même largeur) avec les champs
// T2F_prefixe / T2S_section / T2N_numero / T2T_superficie de la parcelle
// principale, et confirmées par l'en-tête imprimé « Préfixe : Section :
// Numéro : Superficie de la parcelle cadastrale ».
// ─────────────────────────────────────────────────────────────────────────────
import type { DPFormData } from '@/lib/models'

export type CerfaFormId = '13703' | '16702'

/** Nature du bien support des travaux — c'est elle qui détermine le formulaire. */
export type NatureBien = 'maison_individuelle' | 'autre'

export interface CerfaForm {
    id: CerfaFormId
    /** Nom du PDF dans /public. */
    file: string
    /** Numéro affiché à l'utilisateur, version comprise. */
    numero: string
    /** Intitulé officiel du formulaire. */
    titre: string
    /** Nature de bien qui déclenche ce formulaire. */
    natureBien: NatureBien
    /** Libellé court de cette nature — titre de l'option proposée à l'étape 2. */
    bien: string
    /** Ce que cette nature recouvre — description de l'option. */
    usage: string
    /** Pourquoi ce formulaire, en une phrase — affiché partout où le document
     *  apparaît, pour que le choix ne soit jamais opaque. */
    pourquoi: string
}

export const CERFA_FORMS: Record<CerfaFormId, CerfaForm> = {
    // Le fichier du 16702 s'appelle historiquement cerfa.pdf : conservé tel quel,
    // il est référencé par le chemin public /cerfa.pdf côté navigateur.
    '16702': {
        id: '16702',
        file: 'cerfa.pdf',
        numero: '16702*03',
        titre: 'Déclaration préalable — constructions et travaux non soumis à permis de construire',
        natureBien: 'autre',
        bien: 'Autre bien',
        usage: 'Appartement ou immeuble collectif, local commercial ou professionnel, bâtiment agricole, terrain nu.',
        pourquoi: 'Le projet ne porte pas sur une maison individuelle : c’est le formulaire général de déclaration préalable qui s’applique.',
    },
    '13703': {
        id: '13703',
        file: 'cerfa-13703.pdf',
        numero: '13703*12',
        titre: 'Déclaration préalable — constructions et travaux non soumis à permis de construire portant sur une maison individuelle et/ou ses annexes',
        natureBien: 'maison_individuelle',
        bien: 'Maison individuelle',
        usage: 'Votre maison et ses annexes : abri de jardin, piscine, clôture, façades, toiture, extension.',
        pourquoi: 'Le projet porte sur une maison individuelle : la notice n°51434#12 impose ce formulaire, le formulaire général ne convient pas.',
    },
}

/**
 * Détermine le formulaire à utiliser.
 *
 * Le critère est unique et vient de la notice : le projet porte-t-il sur une
 * maison individuelle (ou l'une de ses annexes) ? Le champ est renseigné par
 * l'utilisateur à l'étape 2 ; en son absence on retient la maison individuelle,
 * qui est le cas de la quasi-totalité des dossiers de l'application — et le
 * seul des deux à être IMPOSÉ par la notice quand il s'applique.
 */
export function chooseCerfaForm(data: DPFormData): CerfaForm {
    return formForNature(data?.nature_bien)
}

/** Même règle, à partir de la seule nature du bien (interfaces, back-office). */
export function formForNature(nature: NatureBien | undefined): CerfaForm {
    return nature === 'autre' ? CERFA_FORMS['16702'] : CERFA_FORMS['13703']
}

/** Les deux formulaires dans l'ordre d'affichage : maison individuelle d'abord,
 *  c'est le cas courant. Sert à construire le choix de l'étape 2 depuis cette
 *  seule source, pour que libellés et règle ne puissent pas diverger. */
export const CERFA_CHOICES: CerfaForm[] = [CERFA_FORMS['13703'], CERFA_FORMS['16702']]

/**
 * Traduction des noms de champs du vocabulaire 16702 vers celui du 13703.
 *   • absent de la table  → même nom sur les deux formulaires (95 cas)
 *   • valeur `null`       → le champ N'EXISTE PAS sur le 13703, on n'écrit rien
 *
 * Le 16702 n'a pas de table : il est le vocabulaire de référence.
 */
const MAP_13703: Record<string, string | null> = {
    // ── Bordereau des pièces jointes ─────────────────────────────────────────
    // Seul DPC1 change d'identifiant ; DPC2 à DPC8 et DPC11 portent le même nom
    // sur les deux formulaires.
    P5PA2: 'P5PA1',

    // ── Parcelles cadastrales supplémentaires ────────────────────────────────
    // Le 16702 offre deux lignes en regard de la parcelle principale (P2, P3) ;
    // le 13703 renvoie vers une fiche complémentaire en page 7, dont le tableau
    // est indexé T5Z{ligne}{colonne} avec colonnes 1=préfixe, 2=section,
    // 3=numéro, 4=superficie.
    T2FP2_prefixe: 'T5ZA1',
    T2SP2_section: 'T5ZA2',
    T2NP2_numero: 'T5ZA3',
    T2TP2_superficie: 'T5ZA4',
    T2FP3_prefixe: 'T5ZB1',
    T2SP3_section: 'T5ZB2',
    T2NP3_numero: 'T5ZB3',
    T2TP3_superficie: 'T5ZB4',

    // ── Lotissement ──────────────────────────────────────────────────────────
    // Le 16702 propose un couple Oui/Non ; le 13703 une case unique que l'on
    // coche uniquement si le terrain est en lotissement.
    T3I_lotoui: 'T2J_lotissement',
    T3L_lotnon: null,

    // ── Surfaces de plancher ─────────────────────────────────────────────────
    // Le 16702 tient un tableau par destination (colonnes A à F : existante,
    // créée, créée par changement de destination, supprimée, supprimée par
    // changement, total). Le 13703, réservé à l'habitation individuelle, se
    // limite à trois cases et ne comporte pas de total à reporter.
    W2LA1: 'C7A_surface',       // surface existante
    W2LB1: 'C7U_creee',         // surface créée
    W2LD1: 'C7K_supprimee',     // surface supprimée
    W2LF1: null,                // total : pas de case sur le 13703
    W2SA1: null,                // ligne « totaux » : sans objet, une seule
    W2SB1: null,                // destination possible sur le 13703 — les
    W2SD1: null,                // valeurs sont déjà portées par C7A/C7U/C7K.
    W2SF1: null,

    // ── Nature des travaux ───────────────────────────────────────────────────
    // Le 13703 ne liste que piscine / garage / véranda / abri : pas de case
    // « autres annexes ». Le cas échéant, la mention reste portée par la
    // description du projet (C2ZD1_description), commune aux deux formulaires.
    C5ZE5_annexes: null,

    // ── Législation connexe ──────────────────────────────────────────────────
    // Le 16702 pose chaque question en Oui / Non (les identifiants en « 0 »
    // étant les cases « Non »). Le 13703 ne propose que des cases à cocher
    // affirmatives : ne rien cocher y signifie « non ». Ces champs sont donc
    // sans objet, et surtout sans perte d'information.
    X1T0_eau: null,
    X1E0_environnement: null,
    X1D0_derogation: null,
    X1C0_classe: null,
    X1A0_ABF: null,
    X1L0_legislation: null,
    X1U0_raccordement: null,
    X1V0_toiture: null,
}

const MAPS: Record<CerfaFormId, Record<string, string | null>> = {
    '16702': {},
    '13703': MAP_13703,
}

/**
 * Nom réel du champ sur le formulaire retenu, ou `null` s'il n'y existe pas.
 * Le générateur ignore silencieusement les `null` : c'est un choix explicite,
 * pas un échec.
 */
export function resolveField(form: CerfaFormId, name: string): string | null {
    const map = MAPS[form]
    return name in map ? map[name] : name
}
