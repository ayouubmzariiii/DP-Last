// ─────────────────────────────────────────────────────────────────────────────
// DP4 — élévation cotée du projet.
//
// Le DP4 réglementaire est « un plan des façades et des toitures » (art. R. 431-10 b).
// Ce que le dossier produisait jusqu'ici pour cette pièce, c'était une photo de l'existant
// à côté d'un croquis IA : deux vues justes sur l'aspect, mais SANS ÉCHELLE ET SANS COTES.
// L'instructeur n'y trouvait aucune des dimensions sur lesquelles se juge la conformité au
// règlement (hauteur au faîtage, hauteur de clôture, dimensions d'une baie).
//
// Ce module reconstruit l'élévation à partir des SEULES dimensions déclarées par le maître
// d'ouvrage — jamais mesurées sur une image générée — et la rend traçable à une échelle
// normalisée (1/20 … 1/200). Ce qui n'est pas déclaré n'est pas dessiné.
//
// Pur : pas de React, pas de DOM, pas de réseau. Le tracé (pdf-lib) vit dans dpDocGenerator ;
// ici on ne calcule que la géométrie et les cotes, ce qui les rend vérifiables isolément.
// ─────────────────────────────────────────────────────────────────────────────

import { DPFormData } from './models'
import { MATERIAU_LABEL } from './travauxRegistry'

/** Parse un champ de saisie en mètres. Accepte la virgule décimale (saisie FR). */
export function num(v: string | undefined | null): number {
    if (!v) return 0
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
}

export type ElevationKind = 'batiment' | 'cloture' | 'baie'

export interface FacadeElevation {
    kind: ElevationKind
    /** Largeur totale de l'objet dessiné, en mètres. */
    widthM: number
    /** Hauteur hors-tout, en mètres (faîtage pour un bâtiment). */
    heightM: number
    /** Hauteur à l'égout (bâtiment uniquement). */
    eaveM?: number
    roof?: 'mono' | 'double' | 'flat'
    /** Côté du bâti existant auquel l'extension s'adosse — dessiné en amorce hachurée. */
    adossement?: 'gauche' | 'droite'
    /** Hauteur au faîtage du bâti existant (m), quand elle a été déclarée à l'étape Terrain.
     *  Absente, l'amorce est coupée par un trait de rupture au lieu d'affirmer un niveau. */
    existantFaitageM?: number
    fence?: { type: 'mur' | 'mur_bahut' | 'grillage' | 'panneaux' | 'claire_voie'; bahutM: number }
    bay?: {
        type: 'fenetre' | 'porte' | 'porte_fenetre' | 'fenetre_toit'
        operation: 'creation' | 'agrandissement' | 'suppression'
        count: number
        vantaux: number
        /** Hauteur d'allège en mètres (0 = non déclarée : la baie n'est pas cotée en hauteur). */
        allegeM: number
    }
    title: string
    /** Cotes déclarées, imprimées telles quelles dans l'encart « dimensions déclarées ». */
    dims: string[]
    /** Matériau / teinte déclarés, s'ils l'ont été. */
    material?: string
    /** Mention à porter sous le dessin quand une dimension usuelle n'a PAS été déclarée. */
    caveats: string[]
}

/** Cote au format français, deux décimales — la convention d'un plan déposé. */
export const f = (n: number) => n.toFixed(2).replace('.', ',')

/** « pvc » → « PVC ». Sans cela le cartouche imprime la valeur brute du formulaire. */
function materiauLabel(m?: string): string {
    if (!m) return ''
    return MATERIAU_LABEL[m] || m
}
/** Le champ RAL est saisi tantôt « 9016 », tantôt « RAL 9016 » : ne pas doubler le préfixe. */
function ralLabel(ral?: string): string {
    const v = (ral || '').trim()
    if (!v) return ''
    return /^ral\b/i.test(v) ? v.toUpperCase().replace(/^RAL\s*/, 'RAL ') : `RAL ${v}`
}
/** Pluriel appliqué au NOM, pas au complément : « fenêtres de toit », jamais « fenêtre de toits ». */
function plural(label: string, n: number): string {
    if (n <= 1) return label
    const i = label.indexOf(' de ')
    return i > 0 ? `${label.slice(0, i)}s${label.slice(i)}` : `${label}s`
}

/**
 * Construit l'élévation à partir des travaux déclarés.
 * Renvoie `null` quand la nature des travaux ne définit aucune géométrie cotable
 * (ravalement, isolation, toiture, photovoltaïque, piscine, terrassement) : mieux vaut
 * pas de dessin coté qu'un dessin dont les cotes seraient inventées.
 */
export function facadeElevation(data: DPFormData): FacadeElevation | null {
    const t = data.travaux
    switch (t.type) {
        case 'extension':
        case 'abri': {
            const s = t.type === 'extension' ? t.extension : t.abri
            if (!s) return null
            const w = num(s.largeur)
            const hE = num(s.hauteur_egout)
            const hF = num(s.hauteur_faitage)
            const h = Math.max(hF, hE)
            if (w <= 0 || h <= 0) return null
            const roof = (s.type_toit || 'double') as 'mono' | 'double' | 'flat'
            const adoss = t.type === 'extension'
                ? (t.extension?.cote_adossement === 'gauche' || t.extension?.cote_adossement === 'droite'
                    ? t.extension.cote_adossement : undefined)
                : undefined
            const dims = [
                `Largeur de façade : ${f(w)} m`,
                `Profondeur : ${f(num(s.profondeur))} m`,
                hE > 0 ? `Hauteur à l'égout : ${f(hE)} m / TN` : '',
                hF > 0 ? `Hauteur au faîtage : ${f(hF)} m / TN` : '',
                // Cotée sur le dessin → listée ici aussi : une cote tracée sans être déclarée
                // au tableau laisse le lecteur deviner d'où elle sort.
                adoss && num(data.terrain.existant_hauteur_faitage) > 0
                    ? `Faîtage du bâti existant : ${f(num(data.terrain.existant_hauteur_faitage))} m / TN` : '',
            ].filter(Boolean)
            const caveats: string[] = []
            if (hE <= 0) caveats.push("Hauteur à l'égout non renseignée")
            if (hF <= 0) caveats.push('Hauteur au faîtage non renseignée')
            const exF = num(data.terrain.existant_hauteur_faitage)
            return {
                kind: 'batiment', widthM: w, heightM: h, eaveM: hE > 0 ? hE : h, roof,
                adossement: adoss,
                existantFaitageM: adoss && exF > 0 ? exF : undefined,
                title: t.type === 'extension' ? "Élévation de l'extension projetée" : "Élévation de l'abri projeté",
                dims, material: [s.materiau, s.couleur].filter(Boolean).join(' — ') || undefined,
                caveats,
            }
        }
        case 'cloture': {
            const c = t.cloture
            if (!c) return null
            const h = num(c.hauteur), l = num(c.longueur)
            if (h <= 0 || l <= 0) return null
            const type = (c.type_cloture || 'grillage') as NonNullable<FacadeElevation['fence']>['type']
            // Mur-bahut : la partie maçonnée fait usuellement le tiers bas. Non déclarée séparément,
            // donc dessinée à titre indicatif et signalée comme telle sous le dessin.
            const bahutM = type === 'mur_bahut' ? Math.min(0.8, h / 3) : 0
            return {
                kind: 'cloture', widthM: l, heightM: h, fence: { type, bahutM },
                title: 'Élévation de la clôture projetée',
                dims: [
                    `Hauteur : ${f(h)} m`,
                    `Longueur : ${f(l)} m`,
                    c.sur_voie ? 'Implantation : sur voie / espace public' : 'Implantation : en limite séparative',
                ],
                material: [c.materiau, c.couleur].filter(Boolean).join(' — ') || undefined,
                caveats: type === 'mur_bahut' ? ['Hauteur du mur bahut indicative (non déclarée)'] : [],
            }
        }
        case 'ouverture':
        case 'menuiseries': {
            const s = t.type === 'ouverture' ? t.ouverture : t.menuiseries
            if (!s) return null
            // Ces deux rubriques se saisissent en CENTIMÈTRES (cf. models.ts).
            const w = num(s.largeur) / 100, h = num(s.hauteur) / 100
            if (w <= 0 || h <= 0) return null
            const count = Math.max(1, Math.round(num(s.nombre)) || 1)
            const rawType = t.type === 'ouverture' ? (t.ouverture?.type_ouverture || 'fenetre') : (t.menuiseries?.type || 'fenetre')
            const type: NonNullable<FacadeElevation['bay']>['type'] =
                rawType === 'porte' ? 'porte'
                    : rawType === 'porte_fenetre' || rawType === 'baie_vitree' ? 'porte_fenetre'
                        : rawType === 'fenetre_toit' ? 'fenetre_toit' : 'fenetre'
            const operation = t.type === 'ouverture'
                ? ((t.ouverture?.operation || 'creation') as 'creation' | 'agrandissement' | 'suppression')
                : 'creation'
            // Partition : une porte a un vantail, une baie large en a deux. C'est aussi ce que
            // le prompt IA impose de conserver (buildAIAfterImagePrompt) — les deux pièces
            // doivent raconter la même chose.
            const vantaux = type === 'porte' ? 1 : w >= 0.9 ? 2 : 1
            // Une porte n'a pas d'allège, et une fenêtre de toit n'en a pas non plus dans une
            // élévation de façade : ne pas coter ce qui n'a pas de sens ici.
            const allegeM = type === 'porte' || type === 'porte_fenetre' || type === 'fenetre_toit'
                ? 0 : num(s.allege) / 100
            const label = type === 'porte' ? 'porte' : type === 'porte_fenetre' ? 'porte-fenêtre'
                : type === 'fenetre_toit' ? 'fenêtre de toit' : 'fenêtre'
            const opLabel = operation === 'suppression' ? 'Suppression' : operation === 'agrandissement' ? 'Agrandissement' : 'Création'
            return {
                kind: 'baie', widthM: w, heightM: h,
                bay: { type, operation, count, vantaux, allegeM },
                title: t.type === 'ouverture'
                    ? `${opLabel} d'ouverture — élévation cotée`
                    : 'Menuiserie remplacée — élévation cotée',
                dims: [
                    `${opLabel} : ${count} ${plural(label, count)}`,
                    `Largeur : ${f(w)} m (${Math.round(w * 100)} cm)`,
                    `Hauteur : ${f(h)} m (${Math.round(h * 100)} cm)`,
                    allegeM > 0 ? `Allège : ${f(allegeM)} m (${Math.round(allegeM * 100)} cm)` : '',
                    t.type === 'ouverture' && t.ouverture?.facade ? `Façade : ${t.ouverture.facade}` : '',
                ].filter(Boolean),
                material: t.type === 'menuiseries'
                    ? [materiauLabel(t.menuiseries?.materiau), ralLabel(t.menuiseries?.couleur_ral) || t.menuiseries?.couleur]
                        .filter(Boolean).join(' — ') || undefined
                    : undefined,
                caveats: (type === 'fenetre' && allegeM <= 0)
                    ? ["Allège (hauteur d'appui) non déclarée : non cotée"] : [],
            }
        }
        default:
            return null
    }
}

/** Échelles normalisées admises sur un plan de façade. */
export const SCALE_LADDER = [5, 10, 20, 25, 50, 100, 200, 500] as const

/**
 * Choisit la plus grande échelle normalisée à laquelle l'élévation tient dans la zone de
 * dessin. Une échelle « ronde » est un impératif du document : elle permet à l'instructeur
 * de re-mesurer les cotes à la règle sur le tirage papier.
 *
 * @param availW/@param availH  zone de dessin, en POINTS PDF (1 pt = 1/72 pouce)
 * @returns { denom, ptPerM }   dénominateur (1/denom) et facteur d'échelle points/mètre
 */
export function pickScale(widthM: number, heightM: number, availW: number, availH: number) {
    const PT_PER_M = 72 / 0.0254   // points par mètre RÉEL sur le papier (2834.6)
    for (const denom of SCALE_LADDER) {
        const ptPerM = PT_PER_M / denom
        if (widthM * ptPerM <= availW && heightM * ptPerM <= availH) return { denom, ptPerM }
    }
    // Au-delà de 1/500 on ne prétend plus à une échelle normalisée : on ajuste et on le dit.
    const ptPerM = Math.min(availW / widthM, availH / heightM)
    return { denom: 0, ptPerM }
}

/** Libellé de cartouche : « 1/50 », ou « Ajustée » hors échelle normalisée. */
export function scaleLabel(denom: number): string {
    return denom > 0 ? `1/${denom}` : 'Ajustée'
}

/** Échelle la plus faible encore utile sur un plan de façade. 1/100 reste l'échelle courante
 *  d'un plan de façade déposé ; au-delà (1/200, 1/500) on ne cote plus rien de sérieux. */
const READABLE_DENOM = 100
/** …et une échelle normalisée ne suffit pas : un ouvrage bas et très long passe à 1/500 tout
 *  en tenant sur la feuille, réduit à un trait de 4 mm. On vise donc aussi une hauteur tracée
 *  confortable (~50 mm) : en deçà, les cotes se chevauchent sur le tirage. */
const COMFORT_H_PT = 140
/** Longueur maximale de clôture réellement tracée. Un linéaire plus long est représenté par
 *  un fragment — l'usage courant du dessin technique, à condition de le DIRE et de coter
 *  la longueur totale à côté (c'est ce que fait `totalNote`). */
const FENCE_FRAGMENT_M = 10

export interface ElevationLayout {
    denom: number
    ptPerM: number
    /** Nombre de baies effectivement tracées (≤ bay.count). */
    bayCount: number
    /** Longueur de clôture effectivement tracée (≤ widthM). */
    drawnLengthM: number
    /** Emprise totale du tracé, en mètres (amorce et entraxes compris). */
    totalW: number
    totalH: number
    /** Mention à porter sous le dessin quand il ne montre qu'une partie de l'ouvrage. */
    fragmentNote?: string
}

export const STUB_M = 1.6        // amorce du bâti existant
export const BAY_GAP_M = 0.5     // entraxe entre deux baies répétées
export const WALL_PAD_M = 0.6    // pan de mur/toiture autour des baies

/**
 * Décide COMBIEN dessiner et À QUELLE ÉCHELLE, pour que la planche reste lisible.
 *
 * Un ouvrage très étendu (clôture de 60 m, série de 5 baies) tient sur la feuille à 1/500,
 * mais s'y réduit à quelques millimètres : la pièce serait formellement présente et
 * pratiquement inutilisable. On préfère donc réduire l'ÉTENDUE représentée pour préserver
 * l'échelle, et signaler explicitement que le tracé est un fragment.
 */
export function layoutElevation(e: FacadeElevation, availW: number, availH: number): ElevationLayout {
    const extent = (bayCount: number, lengthM: number) =>
        e.kind === 'batiment' ? e.widthM + (e.adossement ? STUB_M : 0)
            : e.kind === 'baie' ? bayCount * e.widthM + (bayCount - 1) * BAY_GAP_M + WALL_PAD_M * 2
                : lengthM
    // Hauteur totale à faire tenir sur la planche :
    //  • baie      — le pan de mur doit contenir l'allège déclarée, sinon la baie déborderait
    //                sous le sol dès qu'une allège dépasse la marge forfaitaire ;
    //  • bâtiment  — l'amorce de l'existant peut DÉPASSER le projet (une maison R+1 à 8,20 m
    //                contre une extension à 4,10 m). L'échelle doit être choisie sur le plus
    //                haut des deux, faute de quoi l'existant sortirait de la feuille.
    const totalH = e.kind === 'baie'
        ? e.heightM + Math.max(0.8, (e.bay?.allegeM ?? 0) + 0.5)
        : Math.max(e.heightM, e.existantFaitageM ?? 0)

    // Candidats, du plus complet au plus réduit.
    const candidates: { bayCount: number; lengthM: number }[] = []
    if (e.kind === 'baie') {
        for (let n = Math.min(e.bay?.count ?? 1, 3); n >= 1; n--) candidates.push({ bayCount: n, lengthM: e.widthM })
    } else if (e.kind === 'cloture') {
        candidates.push({ bayCount: 1, lengthM: e.widthM })
        if (e.widthM > FENCE_FRAGMENT_M) candidates.push({ bayCount: 1, lengthM: FENCE_FRAGMENT_M })
    } else {
        candidates.push({ bayCount: 1, lengthM: e.widthM })
    }

    const built = candidates.map(c => {
        const totalW = extent(c.bayCount, c.lengthM)
        const s = pickScale(totalW, totalH, availW, availH)
        return {
            denom: s.denom, ptPerM: s.ptPerM, bayCount: c.bayCount, drawnLengthM: c.lengthM,
            totalW, totalH,
            fragmentNote: c.lengthM < e.widthM
                ? `Fragment représentatif de ${f(c.lengthM)} m — longueur totale déclarée : ${f(e.widthM)} m`
                : (e.bay && c.bayCount < e.bay.count)
                    ? `Baie type — ${e.bay.count} unités identiques (${c.bayCount} représentée${c.bayCount > 1 ? 's' : ''})`
                    : undefined,
        } as ElevationLayout
    })

    // Les candidats sont ordonnés du plus complet au plus réduit. On retient le plus complet
    // qui reste CONFORTABLE à lire ; si aucun ne l'est (ouvrage très bas et très long), on
    // prend simplement celui qui se dessine le plus grand — jamais le plus complet mais illisible.
    const comfortable = built.filter(l => l.denom > 0 && l.denom <= READABLE_DENOM && l.totalH * l.ptPerM >= COMFORT_H_PT)
    if (comfortable.length) return comfortable[0]
    return built.reduce((best, l) => (l.totalH * l.ptPerM > best.totalH * best.ptPerM ? l : best), built[0])
}
