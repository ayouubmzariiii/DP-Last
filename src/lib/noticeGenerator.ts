// ─────────────────────────────────────────────────────────────────────────────
// Standalone "Notice descriptive (DP4)" PDF.
//
// The notice is also embedded inside the full DP dossier, but it is an official
// pièce jointe in its own right — on the téléservice (AD'AU / Plat'AU) and at the
// guichet, each piece (DP1, DP2, DP4, DP5…) is uploaded/handed in as a SEPARATE
// document. So the applicant needs the notice as its own file, not only bound
// into the 8-page dossier. This renders plans.dp4_notice as a clean A4 document.
// ─────────────────────────────────────────────────────────────────────────────
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import type { DPFormData } from './models'
import { getTravauxDef } from './travauxRegistry'

const INK = rgb(0.1, 0.1, 0.1)
const DARK = rgb(0.25, 0.25, 0.25)
const MUT = rgb(0.45, 0.45, 0.45)
const LINE = rgb(0.8, 0.8, 0.8)

// Keep chars inside WinAnsi (French accents are fine; map only exotic glyphs).
function safe(t: string): string {
    return (t || '')
        .replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
        .replace(/…/g, '...').replace(/ /g, ' ').replace(/[^\x09\x0a\x0d\x20-\xff]/g, '')
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = []
    for (const para of safe(text).split('\n')) {
        const words = para.split(/\s+/).filter(Boolean)
        if (!words.length) { out.push(''); continue }
        let line = ''
        for (const w of words) {
            const probe = line ? `${line} ${w}` : w
            if (font.widthOfTextAtSize(probe, size) <= maxW) line = probe
            else { if (line) out.push(line); line = w }
        }
        if (line) out.push(line)
    }
    return out
}

export async function generateNoticePdf(data: DPFormData): Promise<Uint8Array> {
    const d = data.demandeur
    const t = data.terrain
    const doc = await PDFDocument.create()
    doc.setTitle('Notice descriptive du projet (DP4)')
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)

    const PW = 595.28, PH = 841.89   // A4 portrait
    const M = 56
    const maxW = PW - M * 2
    const BOTTOM = 64

    const nomFull = (d.est_societe ? d.nom_societe : [d.prenom, d.nom].filter(Boolean).join(' ')).trim()
    const fmtAddr = (voie?: string, cp?: string, ville?: string) =>
        [voie, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const addrTrav = t.meme_adresse
        ? fmtAddr(d.adresse, d.code_postal, d.commune)
        : fmtAddr(t.adresse, t.code_postal, t.commune)
    const nature = getTravauxDef(data.travaux?.type)?.natureLabel || 'Travaux sur construction existante'

    let page = doc.addPage([PW, PH])
    let pageNo = 0
    const tx = (s: string, x: number, y: number, size: number, f: PDFFont = font, color = INK) =>
        page.drawText(safe(s), { x, y, size, font: f, color })

    const footer = () => {
        pageNo++
        page.drawLine({ start: { x: M, y: BOTTOM - 12 }, end: { x: PW - M, y: BOTTOM - 12 }, thickness: 0.5, color: LINE })
        tx('Pièce DP4 — Notice descriptive du projet', M, BOTTOM - 26, 8, oblique, MUT)
        const p = `Page ${pageNo}`
        page.drawText(p, { x: PW - M - font.widthOfTextAtSize(p, 8), y: BOTTOM - 26, size: 8, font, color: MUT })
    }

    // ── Header (first page) ────────────────────────────────────────────────
    let y = PH - M
    tx('DÉCLARATION PRÉALABLE DE TRAVAUX', M, y, 9, bold, MUT)
    y -= 26
    tx('Notice descriptive du projet', M, y, 20, bold, INK)
    y -= 10
    tx('(Pièce DP4 — CERFA 16702*03)', M, y, 9.5, oblique, MUT)
    y -= 16
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: INK })
    y -= 22

    // Identity block
    const row = (label: string, value: string) => {
        if (!value) return
        tx(`${label} :`, M, y, 10, bold, DARK)
        for (const ln of wrap(value, font, 10, maxW - 150)) {
            tx(ln, M + 150, y, 10, font, INK); y -= 14
        }
        y -= 3
    }
    row('Demandeur', nomFull)
    row('Adresse des travaux', addrTrav)
    if (t.section_cadastrale || t.numero_parcelle)
        row('Référence cadastrale', [t.prefixe_cadastral, t.section_cadastrale, t.numero_parcelle].filter(Boolean).join(' '))
    row('Nature des travaux', nature)
    y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: LINE })
    y -= 24

    // ── Body — the saved notice, with heading detection ─────────────────────
    const noticeRaw = data.plans?.dp4_notice
        || `Le présent dossier de déclaration préalable concerne : ${nature}.\nLes travaux seront réalisés conformément aux règles de l'art et aux prescriptions locales d'urbanisme.`

    const ensure = (need: number) => {
        if (y - need < BOTTOM) { footer(); page = doc.addPage([PW, PH]); y = PH - M }
    }

    for (const rawLine of safe(noticeRaw).split('\n')) {
        let s = rawLine.trim().replace(/\*\*/g, '').replace(/\*/g, '')
        if (!s) { y -= 8; continue }

        let heading = false
        if (s.startsWith('#')) { heading = true; s = s.replace(/^#+\s*/, '').trim() }
        else if (s === s.toUpperCase() && s.replace(/[^A-Za-zÀ-ÿ]/g, '').length > 3) heading = true
        if (!s) continue

        if (heading) {
            ensure(30)
            y -= 6
            tx(s, M, y, 12.5, bold, INK)
            y -= 18
        } else {
            for (const ln of wrap(s, font, 10.5, maxW)) {
                ensure(16)
                tx(ln, M, y, 10.5, font, rgb(0.15, 0.15, 0.15))
                y -= 15
            }
            y -= 6
        }
    }
    footer()

    return await doc.save()
}
