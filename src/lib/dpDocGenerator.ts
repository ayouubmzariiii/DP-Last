import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFPage } from 'pdf-lib'
import { DPFormData } from './models'
import * as fs from 'fs'
import * as path from 'path'
import { geocodeAddress, getIGNMapUrl } from './ignMaps'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    black: rgb(0, 0, 0),
    nearBlack: rgb(0.08, 0.08, 0.08),
    dark: rgb(0.20, 0.20, 0.20),
    mid: rgb(0.45, 0.45, 0.45),
    light: rgb(0.70, 0.70, 0.70),
    pale: rgb(0.88, 0.88, 0.88),
    offWhite: rgb(0.95, 0.95, 0.95),
    white: rgb(1, 1, 1),
    accent: rgb(0.08, 0.08, 0.08),   // same as nearBlack — accent bar colour
}

const MARGIN = 36   // outer page margin (pt)
const M_INNER = 28   // inner content margin for banner pages
const FOOT_H = 46   // footer zone height
const ROW_PAD = 3    // vertical padding inside a data row (each side)
const SEC_H = 18   // section-header strip height
const BAR_W = 4    // left accent bar width

// ─── Complete French transliteration (no ??? ever) ───────────────────────────
function san(text: string): string {
    const map: Record<string, string> = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'à': 'a', 'â': 'a', 'ä': 'a',
        'ô': 'o', 'ö': 'o', 'û': 'u', 'ù': 'u', 'ü': 'u', 'î': 'i', 'ï': 'i',
        'ç': 'c', 'æ': 'ae', 'œ': 'oe', 'ÿ': 'y',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'À': 'A', 'Â': 'A', 'Ä': 'A',
        'Ô': 'O', 'Ö': 'O', 'Û': 'U', 'Ù': 'U', 'Ü': 'U', 'Î': 'I', 'Ï': 'I',
        'Ç': 'C', 'Æ': 'AE', 'Œ': 'OE',
        '\u2013': '-', '\u2014': '-', '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"',
        '°': 'deg', '²': 'm2', '³': 'm3', '×': 'x', '€': 'EUR', '≈': '~',
        '«': '"', '»': '"', '…': '...', '•': '-', '·': '-',
    }
    return (text || '').replace(/[^\x00-\x7F]/g, c => map[c] ?? (c.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '?'))
}

// ─── Text wrapper ─────────────────────────────────────────────────────────────
/** Split `text` into lines each ≤ `maxCols` characters (word-wrap). */
function wrapText(text: string, maxCols: number): string[] {
    const words = san(text).split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
        if (!cur) { cur = w; continue }
        if ((cur + ' ' + w).length <= maxCols) { cur += ' ' + w }
        else { if (cur) lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
}

// ─── Low-level drawing helpers ────────────────────────────────────────────────
function tx(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = C.nearBlack) {
    const safe = san(text)
    if (!safe.trim()) return
    try { page.drawText(safe, { x, y, size, font, color }) } catch { /* ignore */ }
}

function ln(page: PDFPage, x1: number, y1: number, x2: number, y2: number, w = 0.4, color = C.pale) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color })
}

function box(page: PDFPage, x: number, y: number, w: number, h: number,
    fill: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>, bw = 0.5) {
    page.drawRectangle({
        x, y, width: w, height: h, color: fill,
        ...(border ? { borderColor: border, borderWidth: bw } : {})
    })
}

// ─── Page-level layout blocks ─────────────────────────────────────────────────

/** Full-width header banner. Returns the y cursor just below the banner. */
function drawBanner(page: PDFPage, font: PDFFont, bold: PDFFont,
    code: string, title: string, subtitle: string): number {
    const { width, height } = page.getSize()
    const banH = 56

    // Main black strip
    box(page, 0, height - banH, width, banH, C.nearBlack)
    // Code pill
    box(page, MARGIN, height - banH + 12, 36, 30, C.accent)
    tx(page, code, MARGIN + 6, height - banH + 22, 10, bold, C.white)
    // Title + subtitle
    tx(page, san(title), MARGIN + 46, height - banH + 34, 13, bold, C.white)
    tx(page, san(subtitle).substring(0, 90), MARGIN + 46, height - banH + 18, 7.5, font, C.pale)
    // Thin divider below banner
    ln(page, 0, height - banH - 0.5, width, height - banH - 0.5, 0.6, C.pale)

    return height - banH - 16
}

/** Page footer. */
function drawFooter(page: PDFPage, font: PDFFont, n: number, total: number, ref: string) {
    const { width } = page.getSize()
    ln(page, MARGIN, FOOT_H - 6, width - MARGIN, FOOT_H - 6, 0.5, C.pale)
    tx(page, 'REPUBLIQUE FRANCAISE  |  Demande Prealable de Travaux  |  Cerfa n13703*',
        MARGIN, FOOT_H - 18, 6.5, font, C.light)
    tx(page, san(`Ref. : ${ref}`), MARGIN, FOOT_H - 30, 6, font, C.light)
    tx(page, `${n} / ${total}`, width - MARGIN - 22, FOOT_H - 18, 8, font, C.mid)
}

/** Section header strip. Returns new y below the strip. */
function sec(page: PDFPage, bold: PDFFont, label: string,
    x: number, y: number, w: number): number {
    box(page, x, y - SEC_H, w, SEC_H, C.offWhite)
    box(page, x, y - SEC_H, BAR_W, SEC_H, C.accent)
    tx(page, san(label).toUpperCase(), x + BAR_W + 7, y - SEC_H + 5, 7.5, bold, C.nearBlack)
    return y - SEC_H - 4
}

/** Key-value row. Height adapts to wrapped value text. Returns new y. */
function row(page: PDFPage, font: PDFFont, bold: PDFFont,
    label: string, value: string, x: number, y: number, w: number, shade: boolean): number {
    const valueLines = wrapText(value || '–', 60)
    const lineH = 10   // px per text line
    const rowH = Math.max(16, valueLines.length * lineH + ROW_PAD * 2)

    if (shade) box(page, x, y - rowH, w, rowH, C.offWhite)
    // Label
    tx(page, san(label), x + BAR_W + 5, y - ROW_PAD - 8, 7.5, bold, C.dark)
    // Value (multi-line)
    valueLines.forEach((l, i) => {
        tx(page, l, x + 160, y - ROW_PAD - 8 - i * lineH, 7.5, font, C.nearBlack)
    })
    ln(page, x, y - rowH, x + w, y - rowH, 0.25, C.pale)
    return y - rowH
}

/** Placeholder box for missing image. */
function placeholder(page: PDFPage, font: PDFFont,
    x: number, y: number, w: number, h: number, label: string) {
    box(page, x, y - h, w, h, C.offWhite, C.pale, 0.5)
    for (let i = 0; i < w; i += 20) ln(page, x + i, y, x + i + h, y - h, 0.25, C.pale)
    tx(page, san(label), x + 8, y - h / 2 + 4, 8, font, C.light)
    tx(page, '[ Non fourni ]', x + 8, y - h / 2 - 8, 7, font, C.light)
}

/** Red crosshair target. */
function target(page: PDFPage, cx: number, cy: number, r = 14) {
    page.drawCircle({ x: cx, y: cy, size: r, borderColor: C.mid, borderWidth: 1.2 })
    page.drawCircle({ x: cx, y: cy, size: r / 2, borderColor: C.mid, borderWidth: 0.8 })
    page.drawCircle({ x: cx, y: cy, size: 2.5, color: C.nearBlack })
    ln(page, cx - r * 1.7, cy, cx + r * 1.7, cy, 0.9, C.nearBlack)
    ln(page, cx, cy - r * 1.7, cx, cy + r * 1.7, 0.9, C.nearBlack)
}

/** North arrow. */
function north(page: PDFPage, bold: PDFFont, x: number, y: number) {
    tx(page, 'N', x - 3, y + 10, 8, bold, C.nearBlack)
    ln(page, x, y + 8, x, y - 12, 2, C.nearBlack)
    page.drawLine({ start: { x: x - 4, y: y - 4 }, end: { x, y: y + 8 }, thickness: 1.2, color: C.nearBlack })
    page.drawLine({ start: { x: x + 4, y: y - 4 }, end: { x, y: y + 8 }, thickness: 1.2, color: C.nearBlack })
}

// ─── Image utilities ──────────────────────────────────────────────────────────
async function loadImg(src: string | null): Promise<{ bytes: Uint8Array; isPng: boolean } | null> {
    if (!src) return null
    try {
        if (src.startsWith('data:')) {
            const isPng = src.startsWith('data:image/png')
            return { bytes: new Uint8Array(Buffer.from(src.split(',')[1], 'base64')), isPng }
        }
        if (src.startsWith('/')) {
            const p = path.join(process.cwd(), 'public', src)
            if (fs.existsSync(p)) return { bytes: new Uint8Array(fs.readFileSync(p)), isPng: src.endsWith('.png') }
        }
        if (src.startsWith('http')) {
            const r = await fetch(src)
            const ct = r.headers.get('content-type') ?? ''
            const isPng = src.includes('.png') || ct.includes('png')
            return { bytes: new Uint8Array(await r.arrayBuffer()), isPng }
        }
    } catch (e) { console.warn('[PDF] image load failed:', src, e) }
    return null
}

async function embed(doc: PDFDocument, src: string | null) {
    const d = await loadImg(src)
    if (!d) return null
    try { return d.isPng ? await doc.embedPng(d.bytes) : await doc.embedJpg(d.bytes) }
    catch { return null }
}

// ─── Labels ───────────────────────────────────────────────────────────────────
function natureLabel(data: DPFormData): string {
    const t = data.travaux.type
    if (t === 'menuiseries') return 'Remplacement / installation de menuiseries exterieures'
    if (t === 'isolation') return 'Isolation thermique par l\'exterieur (ITE)'
    if (t === 'photovoltaique') return 'Installation de panneaux photovoltaiques en toiture'
    return 'Non defini'
}

// ─── Multi-line text block renderer ──────────────────────────────────────────
/**
 * Renders a block of text with automatic line wrapping.
 * Returns the new y position after all lines.
 */
function textBlock(page: PDFPage, text: string, x: number, y: number,
    size: number, font: PDFFont, maxCols: number, lineH: number,
    color = C.dark, minY = FOOT_H + 10): number {
    const paragraphs = san(text).split('\n')
    for (const para of paragraphs) {
        if (y < minY) break
        if (!para.trim()) { y -= lineH * 0.6; continue }
        const lines = wrapText(para, maxCols)
        for (const l of lines) {
            if (y < minY) break
            tx(page, l, x, y, size, font, color)
            y -= lineH
        }
    }
    return y
}

// ─── Helper: draw an image with frame, scaled to fit ─────────────────────────
function drawImage(
    page: PDFPage, img: Awaited<ReturnType<typeof embed>>,
    x: number, y: number, maxW: number, maxH: number
): number {
    if (!img) return y
    const dims = img.scaleToFit(maxW, maxH)
    const xOff = x + (maxW - dims.width) / 2
    box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.pale, 0.6)
    page.drawImage(img, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
    return y - dims.height
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateDPDocument(data: DPFormData): Promise<Uint8Array> {
    const { demandeur: d, terrain: t, travaux: tr, photos, plans } = data
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)

    // ── Derived strings ────────────────────────────────────────────────────
    const nomFull = san(`${d.civilite} ${d.nom} ${d.prenom}`.trim())
    const addrDem = san(`${d.adresse || ''}, ${d.code_postal || ''} ${d.commune || ''}`.trim())
    const addr = t.meme_adresse ? d.adresse : t.adresse
    const cp = t.meme_adresse ? d.code_postal : t.code_postal
    const com = t.meme_adresse ? d.commune : t.commune
    const addrTrav = san(`${addr || ''}, ${cp || ''} ${com || ''}`.trim())
    const dateStr = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    const refStr = `DP-${new Date().getFullYear()}-${san(d.nom || 'XX').toUpperCase().substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`

    // ── Geocode for maps ───────────────────────────────────────────────────
    const coords = await geocodeAddress(addr || '', com || '')

    const pages: PDFPage[] = []
    const addPage = (): PDFPage => { const p = doc.addPage(PageSizes.A4); pages.push(p); return p }
    const PW = PageSizes.A4[0]   // ≈ 595 pt
    const PH = PageSizes.A4[1]   // ≈ 842 pt
    const CW = PW - MARGIN * 2   // content width on standard pages

    // ══════════════════════ PAGE 0 – COVER ════════════════════════════════
    {
        const page = addPage()
        const M = MARGIN

        // ── Top black header ────────────────────────────────────────────
        const topH = 130
        box(page, 0, PH - topH, PW, topH, C.nearBlack)

        tx(page, 'REPUBLIQUE FRANCAISE', M, PH - 24, 8.5, font, C.pale)
        tx(page, 'Liberte  -  Egalite  -  Fraternite', M, PH - 37, 7, font, C.light)

        tx(page, 'DEMANDE PREALABLE DE TRAVAUX', M, PH - 66, 20, bold, C.white)
        tx(page, 'Formulaire Cerfa n13703*', M, PH - 88, 9, font, C.pale)
        tx(page, san(`Date : ${dateStr}  |  Ref. dossier : ${refStr}`), M, PH - 105, 7.5, font, C.light)

        // Right accent bar
        box(page, PW - 8, 0, 8, PH, C.nearBlack)

        let y = PH - topH - 24

        // ── Summary card ────────────────────────────────────────────────
        const cardH = 80
        box(page, M, y - cardH, CW, cardH, C.offWhite, C.pale, 0.5)
        box(page, M, y - cardH, BAR_W, cardH, C.accent)

        tx(page, 'IDENTIFICATION DU DOSSIER', M + BAR_W + 8, y - 16, 8, bold, C.nearBlack)
        tx(page, san(`Demandeur : ${nomFull}`), M + BAR_W + 8, y - 32, 8.5, font, C.dark)
        tx(page, san(`Adresse des travaux : ${addrTrav}`), M + BAR_W + 8, y - 46, 8, font, C.dark)
        tx(page, san(`Nature : ${natureLabel(data)}`), M + BAR_W + 8, y - 60, 8, font, C.dark)
        tx(page, san(`Reference : ${refStr}  –  ${dateStr}`), M + BAR_W + 8, y - 74, 7.5, font, C.mid)
        y -= cardH + 20

        // ── Section 1 : Identite ─────────────────────────────────────────
        y = sec(page, bold, '1. Identite du demandeur', M, y, CW)
        const rows1: [string, string][] = [
            ['Civilite', d.civilite || ''],
            ['Nom', d.nom || ''],
            ['Prenom', d.prenom || ''],
            ['Telephone', d.telephone || ''],
            ['Email', d.email || ''],
            ['Adresse', addrDem],
        ]
        rows1.forEach(([l, v], i) => { y = row(page, font, bold, l, v, M, y, CW, i % 2 === 0) })

        y -= 14
        if (y < FOOT_H + 80) y = FOOT_H + 80   // safety clamp before next section

        // ── Section 2 : Terrain ──────────────────────────────────────────
        y = sec(page, bold, '2. Adresse des travaux & references cadastrales', M, y, CW)
        const rows2: [string, string][] = [
            ['Adresse des travaux', addrTrav],
            ['Section cadastrale', t.section_cadastrale || ''],
            ['Numero de parcelle', t.numero_parcelle || ''],
            ['Surface du terrain', t.surface_terrain ? `${t.surface_terrain} m2` : ''],
            ['Surface plancher projetee', t.surface_plancher ? `${t.surface_plancher} m2` : ''],
        ]
        rows2.forEach(([l, v], i) => { y = row(page, font, bold, l, v, M, y, CW, i % 2 === 0) })

        y -= 14
        y = sec(page, bold, '3. Nature des travaux', M, y, CW)
        y = row(page, font, bold, 'Type de travaux', natureLabel(data), M, y, CW, false)

        y -= 14
        y = sec(page, bold, '4. Pieces constituant le dossier', M, y, CW)
        const pieces = [
            'DP1 — Plan de situation du terrain',
            'DP2 — Plan de masse des constructions',
            'DP3 — Plan de coupe du terrain et de la construction',
            'DP4 — Notice descriptive du projet',
            'DP5 — Plans des facades : etat existant et apres travaux',
            'DP7 — Photographie : vue rapprochee de la construction',
            'DP8 — Photographie : vue eloignee de la construction',
        ]
        pieces.forEach((p, i) => {
            const rH = 15
            box(page, M, y - rH, CW, rH, i % 2 === 0 ? C.offWhite : C.white)
            box(page, M, y - rH, BAR_W, rH, C.light)
            tx(page, san(p), M + BAR_W + 7, y - rH + 4, 7.5, font, C.dark)
            page.drawCircle({ x: PW - M - 10, y: y - rH / 2, size: 3.5, borderColor: C.light, borderWidth: 0.8 })
            page.drawCircle({ x: PW - M - 10, y: y - rH / 2, size: 2, color: C.dark })
            y -= rH
        })

        // ── Signature block ──────────────────────────────────────────────
        const sigY = Math.max(y - 8, FOOT_H + 48) // protect from footer
        const sigW = CW / 2 - 8
        box(page, M, sigY - 44, sigW, 44, C.offWhite, C.pale, 0.4)
        tx(page, 'SIGNATURE DU DEMANDEUR', M + 8, sigY - 12, 7, bold, C.dark)
        tx(page, san(`A ……………………  le ${dateStr}`), M + 8, sigY - 28, 7, font, C.mid)
    }

    // ══════════════════════ PAGE 1 – DP1 Plan de situation ════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        let y = drawBanner(page, font, bold, 'DP1', 'Plan de situation du terrain', addrTrav)

        y = sec(page, bold, 'Localisation dans la commune', M, y - 2, cW)
        y = row(page, font, bold, 'Commune', san(com || ''), M, y, cW, false)
        y = row(page, font, bold, 'Adresse projet', addrTrav, M, y, cW, true)
        y -= 10

        const mapUrl = coords ? getIGNMapUrl('DP1', coords) : null
        const mapImg = await embed(doc, mapUrl)
        const maxMapH = y - FOOT_H - 36

        if (mapImg && maxMapH > 80) {
            const newY = drawImage(page, mapImg, M, y, cW, maxMapH)
            target(page, M + cW / 2, (y + newY) / 2)
            north(page, bold, M + cW - 26, y - 20)
            y = newY - 10
        } else {
            placeholder(page, font, M, y, cW, Math.max(80, maxMapH), 'Carte IGN non disponible — verifiez la connexion ou l\'adresse saisie')
            y -= Math.max(80, maxMapH) + 10
        }

        box(page, M, y - 22, cW, 24, C.offWhite, C.pale, 0.4)
        tx(page, 'Source : IGN Geoplateforme / Plan IGN v2  |  Echelle approx. 1:10 000  |  Croix rouge = emplacement du projet', M + 7, y - 14, 6.5, font, C.mid)
    }

    // ══════════════════════ PAGE 2 – DP2 Plan de masse ═══════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        let y = drawBanner(page, font, bold, 'DP2', 'Plan de masse des constructions', addrTrav)

        y = sec(page, bold, 'Implantation et references cadastrales', M, y - 2, cW)
        y = row(page, font, bold, 'Section cadastrale', t.section_cadastrale || '', M, y, cW, false)
        y = row(page, font, bold, 'Numero de parcelle', t.numero_parcelle || '', M, y, cW, true)
        y = row(page, font, bold, 'Surface du terrain', t.surface_terrain ? `${t.surface_terrain} m2` : '', M, y, cW, false)
        y -= 10

        const mapUrl = coords ? getIGNMapUrl('DP2', coords) : null
        const mapImg = await embed(doc, mapUrl)
        const maxMapH = y - FOOT_H - 36

        if (mapImg && maxMapH > 80) {
            const newY = drawImage(page, mapImg, M, y, cW, maxMapH)
            target(page, M + cW / 2, (y + newY) / 2, 18)
            north(page, bold, M + cW - 26, y - 20)
            y = newY - 10
        } else {
            placeholder(page, font, M, y, cW, Math.max(80, maxMapH), 'Plan de masse IGN non disponible')
            y -= Math.max(80, maxMapH) + 10
        }

        box(page, M, y - 22, cW, 24, C.offWhite, C.pale, 0.4)
        tx(page, 'Source : IGN Geoplateforme / Orthophoto + Cadastre  |  Echelle approx. 1:1 000  |  Croix rouge = parcelle projet', M + 7, y - 14, 6.5, font, C.mid)
    }

    // ══════════════════════ PAGE 3 – DP3 Plan de coupe ═══════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        let y = drawBanner(page, font, bold, 'DP3', 'Plan de coupe du terrain et de la construction', addrTrav)

        y = sec(page, bold, 'Coupe verticale transversale — terrain naturel et construction', M, y - 2, cW)
        y -= 8

        const coupeImg = plans.dp3_coupe
            ? await embed(doc, plans.dp3_coupe)
            : await embed(doc, '/dp3-plan-coupe.png')

        const maxCoupeH = Math.min(y - FOOT_H - 80, 320)

        if (coupeImg && maxCoupeH > 60) {
            const newY = drawImage(page, coupeImg, M, y, cW, maxCoupeH)
            y = newY - 14
        } else {
            // Schematic fallback — house silhouette
            const gY = y - 200
            const cx = PW / 2
            ln(page, M, gY, PW - M, gY, 2, C.dark)
            tx(page, 'TNT — Terrain Naturel', M, gY - 14, 7.5, font, C.mid)

            box(page, cx - 80, gY, 160, 75, C.offWhite, C.dark, 1)
            page.drawLine({ start: { x: cx - 90, y: gY + 75 }, end: { x: cx, y: gY + 120 }, thickness: 1.5, color: C.nearBlack })
            page.drawLine({ start: { x: cx + 90, y: gY + 75 }, end: { x: cx, y: gY + 120 }, thickness: 1.5, color: C.nearBlack })
            // Dimension lines
            ln(page, cx + 94, gY, cx + 94, gY + 75, 0.6, C.mid)
            ln(page, cx + 90, gY, cx + 98, gY, 0.6, C.mid)
            ln(page, cx + 90, gY + 75, cx + 98, gY + 75, 0.6, C.mid)
            tx(page, '~3,00 m', cx + 97, gY + 35, 7, font, C.mid)
            ln(page, cx + 94, gY + 75, cx + 94, gY + 120, 0.6, C.mid)
            tx(page, '~5,20 m (faitage)', cx + 97, gY + 95, 7, font, C.mid)
            // Foundation
            box(page, cx - 84, gY - 26, 168, 26, C.pale, C.light, 0.5)
            tx(page, 'Fondations', cx - 28, gY - 16, 7, font, C.mid)

            y = gY - 40
        }

        y = sec(page, bold, 'Caracteristiques indicatives de la construction', M, y - 6, cW)
        const specs: [string, string][] = [
            ['Type de construction', 'Maison individuelle'],
            ['Hauteur a la sabliere', '≈ 3,00 m'],
            ['Hauteur au faitage', '≈ 5,20 m'],
            ['Profondeur fondations', '≈ 0,50 m sous terrain naturel'],
            ['Surface emprise au sol', t.surface_terrain ? `≈ ${Math.round(parseInt(t.surface_terrain || '0') * 0.15)} m2` : 'A completer'],
        ]
        specs.forEach(([l, v], i) => { y = row(page, font, bold, l, v, M, y, cW, i % 2 === 0) })

        if (y > FOOT_H + 30) {
            y -= 10
            box(page, M, y - 24, cW, 26, C.offWhite, C.pale, 0.4)
            box(page, M, y - 24, BAR_W, 26, C.accent)
            tx(page, 'N.B. : Cotes indicatives. Un geometre-expert doit etablir les cotes definitives.', M + BAR_W + 7, y - 14, 7, font, C.dark)
        }
    }

    // ══════════════════════ PAGE 4 – DP4 Notice descriptive ══════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        let y = drawBanner(page, font, bold, 'DP4', 'Notice descriptive du projet de travaux', addrTrav)

        y = sec(page, bold, 'Description detaillee des travaux envisages', M, y - 2, cW)
        y -= 10

        const noticeRaw = plans.dp4_notice || [
            `DESCRIPTION DU PROJET\n`,
            `Demandeur : ${nomFull}`,
            `Adresse des travaux : ${addrTrav}`,
            `Nature des travaux : ${natureLabel(data)}\n`,
            `Le present dossier de demande prealable de travaux concerne :`,
            `${natureLabel(data)}\n`,
            `Les travaux seront realises conformement aux regles de l'art et aux prescriptions locales d'urbanisme.`,
        ].join('\n')

        const lines = san(noticeRaw).split('\n')
        let pdPage = page
        for (const raw of lines) {
            let trimmed = raw.trim()
            if (!trimmed) { y -= 10; continue }

            // Strip strong/bold asterisks
            trimmed = trimmed.replace(/\*\*/g, '').replace(/\*/g, '')

            let isHeading = false
            if (trimmed.startsWith('#')) {
                isHeading = true
                trimmed = trimmed.replace(/^#+\s*/, '').trim()
            } else if (trimmed === trimmed.toUpperCase() && trimmed.replace(/[^A-Za-z]/g, '').length > 3) {
                isHeading = true
            }

            if (isHeading && !trimmed) {
                continue
            }

            if (isHeading) {
                if (y < FOOT_H + 40) {
                    pdPage = addPage()
                    y = PH - MARGIN - 20
                }

                // Add some breathing room before the section
                y -= 4

                // The box starts at y - 16, height is 18
                box(pdPage, M, y - 16, cW, 18, C.offWhite)
                box(pdPage, M, y - 16, BAR_W, 18, C.accent)
                tx(pdPage, trimmed, M + BAR_W + 7, y - 12, 8, bold, C.nearBlack)
                y -= 24
            } else {
                const wrapped = wrapText(trimmed, 88)
                for (const l of wrapped) {
                    if (y < FOOT_H + 16) {
                        pdPage = addPage()
                        y = PH - MARGIN - 20
                    }
                    tx(pdPage, l, M + 6, y, 8, font, C.dark)
                    y -= 12
                }
                y -= 4
            }
        }
    }

    // ══════════════════════ PAGE 5 – DP5 Facades ════════════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        let y = drawBanner(page, font, bold, 'DP5', 'Plans des facades — Etat existant et apres travaux', addrTrav)

        y = sec(page, bold, 'Comparaison avant / apres travaux', M, y - 2, cW)
        y -= 10

        const colW = (cW - 12) / 2
        const maxImgH = Math.min(y - FOOT_H - 60, 280)

        // Column headers
        const drawColHeader = (page: PDFPage, x: number, w: number, label: string) => {
            box(page, x, y - 18, w, 18, C.offWhite)
            box(page, x, y - 18, BAR_W, 18, C.accent)
            tx(page, label, x + BAR_W + 6, y - 12, 7.5, bold, C.dark)
        }
        drawColHeader(page, M, colW, 'ETAT EXISTANT (avant travaux)')
        drawColHeader(page, M + colW + 12, colW, 'APRES TRAVAUX (simulation IA)')
        y -= 24

        const avImg = await embed(doc, photos.facade_avant)
        const apImg = await embed(doc, photos.facade_apres_ai)

        // Avant
        if (avImg) {
            const dims = avImg.scaleToFit(colW, maxImgH)
            const xOff = M + (colW - dims.width) / 2
            box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.pale, 0.5)
            page.drawImage(avImg, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
        } else {
            placeholder(page, font, M, y, colW, maxImgH, 'Photo facade avant')
        }

        // Apres
        if (apImg) {
            const dims = apImg.scaleToFit(colW, maxImgH)
            const xOff = M + colW + 12 + (colW - dims.width) / 2
            box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.pale, 0.5)
            page.drawImage(apImg, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
        } else {
            placeholder(page, font, M + colW + 12, y, colW, maxImgH, 'Simulation IA non generee')
        }

        y -= maxImgH + 14
        ln(page, M, y, PW - M, y, 0.4, C.pale)
        y -= 10

        // Nature label
        box(page, M, y - 18, cW, 20, C.offWhite)
        tx(page, san(`Nature des travaux : ${natureLabel(data)}`), M + 8, y - 12, 8, bold, C.dark)
        y -= 26

        // Extra facades
        const extras = [
            { src: photos.facade_gauche, label: 'Facade laterale gauche' },
            { src: photos.facade_droite, label: 'Facade laterale droite' },
            { src: photos.facade_arriere, label: 'Facade arriere' },
        ].filter(e => !!e.src)

        if (extras.length > 0 && y > FOOT_H + 80) {
            y = sec(page, bold, 'Facades complementaires', M, y - 4, cW)
            y -= 6
            const eH = Math.min(140, y - FOOT_H - 20)
            const eColW = (cW - (extras.length - 1) * 10) / Math.min(extras.length, 3)
            for (let i = 0; i < extras.length && i < 3; i++) {
                const ex = M + i * (eColW + 10)
                const img = await embed(doc, extras[i].src)
                if (img) {
                    const newY = drawImage(page, img, ex, y, eColW, eH)
                    tx(page, san(extras[i].label), ex, newY - 10, 7, font, C.mid)
                } else {
                    placeholder(page, font, ex, y, eColW, eH, san(extras[i].label))
                }
            }
        }
    }

    // ══════════════════════ PAGE 6 – DP7 Vue proche ══════════════════════
    await addPhotoPage(doc, font, bold, 'DP7',
        'Photographie de la construction — Vue rapprochee',
        photos.dp7_vue_proche,
        'Vue rapprochee depuis la voie publique permettant d\'identifier clairement la construction et la facade concernee par les travaux.',
        addrTrav, addPage)

    // ══════════════════════ PAGE 7 – DP8 Vue lointaine ═══════════════════
    await addPhotoPage(doc, font, bold, 'DP8',
        'Photographie de la construction — Vue eloignee',
        photos.dp8_vue_lointaine,
        'Vue d\'ensemble permettant de situer la construction dans son environnement immediat (rue, quartier, paysage bati et non bati).',
        addrTrav, addPage)

    // ── Footers ───────────────────────────────────────────────────────────
    pages.forEach((p, i) => drawFooter(p, font, i + 1, pages.length, refStr))

    return await doc.save()
}

// ─── Photo page helper ────────────────────────────────────────────────────────
async function addPhotoPage(
    doc: PDFDocument, font: PDFFont, bold: PDFFont,
    code: string, title: string, photo: string | null, description: string,
    addrTrav: string, addPage: () => PDFPage
) {
    const page = addPage()
    const M = M_INNER
    const cW = PageSizes.A4[0] - M * 2
    let y = drawBanner(page, font, bold, code, title, san(addrTrav))

    y = sec(page, bold, 'Photographie de la construction', M, y - 2, cW)
    y -= 6

    // Description box
    const descW = wrapText(san(description), 90)
    const descBoxH = Math.max(24, descW.length * 12 + 12)
    box(page, M, y - descBoxH, cW, descBoxH, C.offWhite, C.pale, 0.4)
    descW.forEach((l, i) => tx(page, l, M + 7, y - 14 - i * 12, 7.5, font, C.dark))
    y -= descBoxH + 10

    const img = await embed(doc, photo)
    const maxH = y - FOOT_H - 16
    if (img && maxH > 60) {
        const dims = img.scaleToFit(cW, maxH)
        const xOff = M + (cW - dims.width) / 2
        box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.pale, 0.6)
        page.drawImage(img, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
    } else {
        placeholder(page, font, M, y, cW, Math.max(60, maxH), 'Aucune photographie fournie pour ce document')
    }
}
