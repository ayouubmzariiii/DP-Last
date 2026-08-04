// ─────────────────────────────────────────────────────────────────────────────
// Filigrane « SPÉCIMEN ».
//
// Un PDF d'exemple publié en accès libre finit forcément par être imprimé et déposé
// par quelqu'un : il porte le formulaire officiel, une adresse réelle et une parcelle
// réelle. Le filigrane n'est donc pas décoratif — c'est ce qui empêche une pièce de
// démonstration d'être prise pour un dossier, en mairie comme chez le client.
//
// Tracé en diagonale, en gris très clair, PAR-DESSUS le contenu : lisible sur tirage
// papier comme à l'écran, sans jamais masquer une cote ou une case à cocher.
// ─────────────────────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

export const SPECIMEN_LABEL = 'SPÉCIMEN'

/** Retire les accents que la police WinAnsi de pdf-lib ne sait pas encoder.
 *  Plage échappée plutôt que littérale : des marques combinantes écrites telles quelles
 *  dans le source ne survivent pas à un ré-encodage de fichier. */
const COMBINING = /[\u0300-\u036f]/g
function ascii(text: string): string {
    return text.normalize('NFD').replace(COMBINING, '')
}

/**
 * Estampille chaque page d'un PDF déjà rendu.
 * @param bytes   PDF source
 * @param label   texte du filigrane (défaut « SPÉCIMEN »)
 * @param note    mention discrète ajoutée en pied de chaque page
 */
export async function stampSpecimen(
    bytes: Uint8Array,
    label = SPECIMEN_LABEL,
    note = 'Document de démonstration — données fictives, ne peut pas être déposé.',
): Promise<Uint8Array> {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const safe = ascii(label)
    const safeNote = ascii(note)

    for (const page of doc.getPages()) {
        const { width, height } = page.getSize()
        // Corps du filigrane : dimensionné pour occuper ~70 % de la diagonale, quel que
        // soit le format (le CERFA est en A4 portrait, le dossier en A3 paysage).
        const diag = Math.hypot(width, height)
        const size = Math.min(140, (diag * 0.7) / (safe.length * 0.62))
        const textW = bold.widthOfTextAtSize(safe, size)
        const angle = Math.atan2(height, width)          // pente de la diagonale
        const deg = (angle * 180) / Math.PI
        // Point de départ tel que le texte soit centré sur la page une fois tourné.
        const x = width / 2 - (textW / 2) * Math.cos(angle)
        const y = height / 2 - (textW / 2) * Math.sin(angle)
        page.drawText(safe, {
            x, y, size, font: bold, rotate: degrees(deg),
            color: rgb(0.82, 0.72, 0.66), opacity: 0.38,
        })
        if (safeNote) {
            const nw = font.widthOfTextAtSize(safeNote, 8)
            page.drawText(safeNote, { x: Math.max(6, (width - nw) / 2), y: 8, size: 8, font, color: rgb(0.45, 0.4, 0.36) })
        }
    }
    return await doc.save()
}
