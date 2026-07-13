// ─────────────────────────────────────────────────────────────────────────────
// Suivi d'instruction d'une DP — pure date math, shared by the dashboard UI and
// the panneau generator. References (code de l'urbanisme) :
//   • R*423-23 : délai d'instruction de droit commun d'une DP = 1 mois.
//   • R*423-24 : porté à 2 mois en secteur protégé (avis ABF — SPR / abords MH).
//   • R*423-38 : la mairie peut réclamer les pièces manquantes dans le 1er mois.
//   • L*424-2 / R*424-1 : silence à l'issue du délai = non-opposition tacite.
//   • R*600-2 : recours des tiers = 2 mois à compter du 1er jour d'une période
//               continue de 2 mois d'affichage du panneau sur le terrain.
//   • L*424-5 : retrait possible par l'administration dans les 3 mois de la décision.
//   • R*424-17 : décision valable 3 ans (travaux à commencer avant son terme).
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiviInput {
    submittedAt: string | null
    decision: 'accepted' | 'rejected' | null
    decisionAt: string | null
    affichageAt: string | null
    // true = secteur protégé (délai 2 mois) ; undefined = analyse PLU non disponible.
    abf?: boolean
}

export type MilestoneStatus = 'done' | 'current' | 'upcoming' | 'alert'

export interface Milestone {
    key: string
    label: string
    detail?: string
    date: Date | null
    status: MilestoneStatus
}

export interface SuiviState {
    milestones: Milestone[]
    // Décision effective (expresse ou tacite) et sa date — null tant qu'on est en instruction.
    outcome: 'accepted' | 'rejected' | 'tacite' | null
    outcomeDate: Date | null
    // Date d'acquisition de la non-opposition tacite si la mairie reste silencieuse.
    taciteDate: Date | null
    delaiMois: 1 | 2
}

// Délai "de mois à mois" du droit français : échéance le même quantième du mois
// d'arrivée, ramenée au dernier jour du mois quand celui-ci est plus court.
export function addMonths(d: Date, months: number): Date {
    const out = new Date(d)
    const day = out.getDate()
    out.setDate(1)
    out.setMonth(out.getMonth() + months)
    const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
    out.setDate(Math.min(day, lastDay))
    return out
}

export function computeSuivi(input: SuiviInput, now: Date = new Date()): SuiviState | null {
    if (!input.submittedAt) return null
    const depot = new Date(input.submittedAt)
    if (Number.isNaN(depot.getTime())) return null

    const delaiMois: 1 | 2 = input.abf ? 2 : 1
    const piecesDeadline = addMonths(depot, 1)
    const instructionEnd = addMonths(depot, delaiMois)
    const decisionAt = input.decisionAt ? new Date(input.decisionAt) : null
    const affichage = input.affichageAt ? new Date(input.affichageAt) : null

    // Issue de l'instruction : décision expresse enregistrée, sinon tacite une fois le délai écoulé.
    let outcome: SuiviState['outcome'] = null
    let outcomeDate: Date | null = null
    if (input.decision) {
        outcome = input.decision
        outcomeDate = decisionAt
    } else if (now >= instructionEnd) {
        outcome = 'tacite'
        outcomeDate = instructionEnd
    }

    const ms: Milestone[] = []

    ms.push({ key: 'depot', label: 'Dossier déposé en mairie', date: depot, status: 'done' })

    ms.push({
        key: 'pieces',
        label: 'Demande de pièces complémentaires possible',
        detail: now < piecesDeadline
            ? 'Jusqu’à cette date, la mairie peut réclamer des pièces manquantes (le délai repartirait alors de zéro à leur dépôt).'
            : 'Délai écoulé sans demande : le dossier est réputé complet.',
        date: piecesDeadline,
        status: now < piecesDeadline ? 'current' : 'done',
    })

    if (outcome === 'accepted' || outcome === 'rejected') {
        ms.push({
            key: 'decision',
            label: outcome === 'accepted' ? 'DP acceptée (décision expresse)' : 'DP refusée',
            date: outcomeDate,
            status: outcome === 'rejected' ? 'alert' : 'done',
        })
    } else {
        ms.push({
            key: 'instruction',
            label: outcome === 'tacite' ? 'Non-opposition tacite acquise' : 'Fin du délai d’instruction',
            detail: outcome === 'tacite'
                ? `Sans réponse de la mairie sous ${delaiMois} mois, votre DP est tacitement acceptée. Vous pouvez demander en mairie un certificat de non-opposition (gratuit).`
                : input.abf === undefined
                    ? 'Délai courant : 1 mois (2 mois si secteur protégé — avis ABF).'
                    : input.abf
                        ? 'Délai porté à 2 mois : secteur protégé, avis de l’ABF requis.'
                        : 'Délai de droit commun : 1 mois.',
            date: instructionEnd,
            status: outcome === 'tacite' ? 'done' : 'current',
        })
    }

    // Après acceptation (expresse ou tacite) : affichage → recours → validité → DAACT.
    if (outcome === 'accepted' || outcome === 'tacite') {
        if (affichage) {
            const recoursEnd = addMonths(affichage, 2)
            ms.push({
                key: 'affichage',
                label: 'Panneau affiché sur le terrain',
                detail: 'L’affichage doit rester continu et lisible depuis la voie publique pendant toute la durée du chantier (2 mois minimum).',
                date: affichage,
                status: 'done',
            })
            ms.push({
                key: 'recours',
                label: now >= recoursEnd ? 'Fin du délai de recours des tiers' : 'Délai de recours des tiers en cours',
                detail: now >= recoursEnd
                    ? 'Les voisins ne peuvent plus contester l’autorisation (sous réserve d’un affichage resté continu 2 mois).'
                    : 'Un tiers peut contester l’autorisation jusqu’à cette date (2 mois d’affichage continu). L’administration peut, elle, retirer une décision illégale pendant 3 mois.',
                date: recoursEnd,
                status: now >= recoursEnd ? 'done' : 'current',
            })
        } else {
            ms.push({
                key: 'affichage',
                label: 'Affichez le panneau sur le terrain',
                detail: 'Obligatoire, et indispensable : le délai de recours des voisins (2 mois) ne démarre qu’au premier jour d’un affichage continu. Enregistrez la date ci-dessous dès la pose.',
                date: null,
                status: 'alert',
            })
        }
        if (outcomeDate) {
            ms.push({
                key: 'validite',
                label: 'Commencer les travaux avant',
                detail: 'L’autorisation est périmée si les travaux n’ont pas commencé dans les 3 ans (prorogeable 2 × 1 an sur demande).',
                date: addMonths(outcomeDate, 36),
                status: 'upcoming',
            })
        }
        ms.push({
            key: 'daact',
            label: 'À la fin des travaux : déposer la DAACT',
            detail: 'Déclaration attestant l’achèvement et la conformité des travaux, à déposer en mairie (CERFA 13408).',
            date: null,
            status: 'upcoming',
        })
    }

    return { milestones: ms, outcome, outcomeDate, taciteDate: instructionEnd, delaiMois }
}
