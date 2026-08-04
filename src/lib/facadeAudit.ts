// ─────────────────────────────────────────────────────────────────────────────
// Contrôle de fidélité de la simulation « après travaux » (DP6).
//
// Pourquoi ce module existe : un contrôle nature par nature a montré que le générateur
// d'image dérive de façons qu'aucune consigne ne rattrape de manière fiable — il a peint
// « Bleu vif » en toutes lettres sur une façade de ravalement, effacé le portail sur une
// clôture, et relevé des volets roulants baissés sur un remplacement de menuiseries.
// Quatre reformulations du prompt ont corrigé les deux premiers cas, jamais le troisième.
//
// Une règle écrite espère ; un contrôle vérifie. On compare donc l'image produite à la
// photo d'origine avec un modèle vision, sur une liste fermée de points, et on régénère
// quand la comparaison échoue. Le détecteur généralise : il aurait attrapé « Bleu vif »
// sans que personne ait eu à écrire une règle sur les noms de couleurs.
//
// Pur : aucune I/O ici. L'appel réseau vit dans /api/generate-after-facade.
// ─────────────────────────────────────────────────────────────────────────────

export type FacadeAuditCode =
    | 'texte_ajoute'        // un mot, un nom de teinte, un code RAL peint sur l'image
    | 'volets_modifies'     // volet roulant supprimé, relevé, ou remplacé par un battant
    | 'ouvertures_modifiees'// fenêtre/porte ajoutée, supprimée ou déplacée
    | 'cadrage_modifie'     // angle, zoom ou recadrage différent
    | 'toiture_modifiee'    // pente, couverture ou cheminée changée sans demande
    | 'abords_modifies'     // clôture, portail, haie ou plantation altérés sans demande

export interface FacadeAuditIssue {
    code: FacadeAuditCode
    detail: string
}

export interface FacadeAudit {
    faithful: boolean
    issues: FacadeAuditIssue[]
}

export const AUDIT_CODES: FacadeAuditCode[] = [
    'texte_ajoute', 'volets_modifies', 'ouvertures_modifiees',
    'cadrage_modifie', 'toiture_modifiee', 'abords_modifies',
]

/** Libellés lisibles, affichés au demandeur dans le parcours. */
export const AUDIT_LABELS: Record<FacadeAuditCode, string> = {
    texte_ajoute: 'du texte a été ajouté sur l’image',
    volets_modifies: 'les volets ont été modifiés',
    ouvertures_modifiees: 'des ouvertures ont été ajoutées, supprimées ou déplacées',
    cadrage_modifie: 'le cadrage a changé',
    toiture_modifiee: 'la toiture a été modifiée',
    abords_modifies: 'la clôture, le portail ou les plantations ont été modifiés',
}

/**
 * Prompt du contrôleur. Deux images sont jointes : [1] l'état existant, [2] la simulation.
 * `worksDescription` dit ce qui ÉTAIT demandé — sans quoi le contrôleur signalerait les
 * travaux eux-mêmes comme des écarts.
 */
export function buildFacadeAuditPrompt(worksDescription: string): string {
    return `You are auditing an architectural "before / after" pair for a French planning application (déclaration préalable). Image 1 is the EXISTING state (a real photograph). Image 2 is a generated simulation of the SAME building after works.

THE WORKS THAT WERE REQUESTED (any difference caused by these is EXPECTED and must NOT be reported):
${worksDescription || '(non précisé)'}

Image 2 was REDRAWN, not copied: textures, grain and lighting will never match pixel for pixel, and small variations of that kind are NOT defects. Report only differences a planning officer would treat as a change of architectural aspect.

Report ONLY differences that were NOT requested. Compare the two images carefully and check each point:

- texte_ajoute: any letter, word, colour name, RAL code, caption or watermark visible in image 2 that is not physically present in image 1 (a shop sign already in the photo is fine; a word painted on the wall is not).
- volets_modifies: a shutter REMOVED, ADDED, swapped for another type (roller ↔ hinged), or whose state flipped — clearly down in image 1 but open/absent in image 2, or the reverse. Count the shutters in both images. A shutter that stays down but hangs a little higher or lower than in image 1 is NOT a defect: do not report a difference of degree.
- ouvertures_modifiees: any window or door added, removed, clearly resized or moved; or a change of glazing subdivision (number of casements, added glazing bars / petits bois).
- cadrage_modifie: a different camera angle, viewpoint, zoom or crop; the building occupying a noticeably different part of the frame. Ignore differences of a few pixels.
- toiture_modifiee: roof pitch, covering, ridge or chimney changed. Ignore differences in tile texture or rendering.
- abords_modifies: fence, gate, garden wall, hedge or planting removed, added or replaced. Ignore differences in foliage detail.

Be strict about substance and forgiving about rendering: report a point only if you can actually see it AND it changes how the façade reads. If everything not requested is substantially unchanged, return an empty issues array.

Answer with STRICT JSON and nothing else, in this exact shape:
{"faithful": true|false, "issues": [{"code": "<one of texte_ajoute|volets_modifies|ouvertures_modifiees|cadrage_modifie|toiture_modifiee|abords_modifies>", "detail": "<one short sentence, in French>"}]}`
}

/** Parse tolérant : les modèles encadrent volontiers le JSON de ```json … ``` ou d'un préambule. */
export function parseFacadeAudit(text: string): FacadeAudit | null {
    if (!text) return null
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    let parsed: unknown
    try { parsed = JSON.parse(text.slice(start, end + 1)) } catch { return null }
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as { faithful?: unknown; issues?: unknown }
    const issues: FacadeAuditIssue[] = Array.isArray(o.issues)
        ? o.issues.flatMap((raw): FacadeAuditIssue[] => {
            const it = raw as { code?: unknown; detail?: unknown }
            const code = String(it?.code || '') as FacadeAuditCode
            if (!AUDIT_CODES.includes(code)) return []
            return [{ code, detail: String(it?.detail || '').slice(0, 240) }]
        })
        : []
    // `faithful` et `issues` peuvent se contredire (le modèle coche « true » puis liste des
    // écarts). La liste fait foi : elle est vérifiable, le booléen ne l'est pas.
    return { faithful: issues.length === 0, issues }
}

/**
 * Prompt de reprise : le prompt initial, augmenté des écarts CONSTATÉS sur l'essai précédent.
 * Nommer ce qui vient d'être raté est nettement plus efficace que de répéter la règle
 * générique que le modèle venait justement d'enfreindre.
 */
export function buildCorrectionPrompt(basePrompt: string, issues: FacadeAuditIssue[]): string {
    if (!issues.length) return basePrompt
    const lines = issues.map(i => `- ${AUDIT_LABELS[i.code]} : ${i.detail}`).join('\n')
    return `${basePrompt}

PREVIOUS ATTEMPT WAS REJECTED — a fidelity check on your last output found these UNREQUESTED changes:
${lines}

Produce the edit again from the ORIGINAL photograph, applying the requested modification(s) but WITHOUT any of the faults listed above. Those elements must come out identical to the original photograph.`
}
