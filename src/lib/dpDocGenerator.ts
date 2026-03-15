import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFPage, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, fillAndStroke, setFillingColor, setStrokingColor, setLineWidth, endPath, stroke } from 'pdf-lib'
import { DPFormData } from './models'
import * as fs from 'fs'
import * as path from 'path'
import { geocodeAddress, getIGNMapUrl, getVectorMapData } from './ignMaps'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    black: rgb(0, 0, 0),
    nearBlack: rgb(0.1, 0.1, 0.1),
    dark: rgb(0.25, 0.25, 0.25),
    mid: rgb(0.5, 0.5, 0.5),
    light: rgb(0.75, 0.75, 0.75),
    pale: rgb(0.88, 0.88, 0.88),
    offWhite: rgb(0.96, 0.96, 0.96),
    white: rgb(1, 1, 1),
    blue: rgb(0, 0.4, 1), // Blue for section titles
    red: rgb(0.9, 0.1, 0.1), // Used in the logo
}

const MARGIN = 25   // Outer physical margin (was 45)
const M_INNER = 55  // Margin inside the frame
const FOOT_H = 80   // Footer zone height
const FRAME_PAD = 25 // Distance from frame to content

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

// ─── Helpers: Fonts & Colors ──────────────────────────────────────────────────
function tx(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = C.nearBlack) {
    const safe = san(text)
    if (!safe.trim()) return
    try { page.drawText(safe, { x, y, size, font, color }) } catch { /* ignore */ }
}

function txCentered(page: PDFPage, text: string, xCentersOn: number, y: number, size: number, font: PDFFont, color = C.nearBlack) {
    const safe = san(text)
    if (!safe.trim()) return
    const textWidth = font.widthOfTextAtSize(safe, size)
    tx(page, safe, xCentersOn - textWidth / 2, y, size, font, color)
}

function ln(page: PDFPage, x1: number, y1: number, x2: number, y2: number, w = 1, color = C.black) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color })
}

function box(page: PDFPage, x: number, y: number, w: number, h: number,
    fill: ReturnType<typeof rgb> | undefined, border?: ReturnType<typeof rgb>, bw = 1) {
    const opts: any = { x, y, width: w, height: h }
    if (fill) opts.color = fill
    if (border) { opts.borderColor = border; opts.borderWidth = bw }
    page.drawRectangle(opts)
}

// ─── Design Language Elements ─────────────────────────────────────────────────

/** Draws the global 1px black frame around the page payload */
function drawFrame(page: PDFPage) {
    const { width, height } = page.getSize()
    box(page, MARGIN, MARGIN, width - MARGIN * 2, height - MARGIN * 2, undefined, C.black, 1)
}

/** Header for all DP pages containing the disclaimer */
function drawDesignHeader(page: PDFPage, fontOblique: PDFFont): number {
    const { width, height } = page.getSize()
    const disclaimer = "Les presents plans sont exclusivement destines a l'instruction administrative dans le cadre d'un dossier de declaration prealable. Ils ne peuvent etre utilises pour toute autre fin, ni pour l'execution des travaux."
    const startY = height - MARGIN - 16
    // Single line with reduced font size to fit across the page
    tx(page, disclaimer, MARGIN + FRAME_PAD, startY, 7.8, fontOblique, C.mid)
    return startY - 40 // Increased padding (was -18)
}

/** Professional heading: Black, Bold, Underlined, with wrapping */
function drawTitleProfessional(page: PDFPage, bold: PDFFont, label: string, x: number, y: number, size: number = 18): number {
    const safe = san(label)
    const lines = wrapText(safe, 80)
    let curY = y
    for (const line of lines) {
        tx(page, line, x, curY, size, bold, C.black)
        const textWidth = bold.widthOfTextAtSize(line, size)
        ln(page, x, curY - 4, x + textWidth, curY - 4, 1.5, C.black)
        curY -= size + 8
    }
    return curY
}

/** 5-Column Custom Footer specific to the Professional design style */
function drawDesignFooter(page: PDFPage, font: PDFFont, bold: PDFFont, data: DPFormData, dpNum: string, dpTitle: string, scale = 'Sans') {
    const { width } = page.getSize()
    const fw = width - MARGIN * 2
    const yFoot = MARGIN // bottom of the frame
    const hFoot = FOOT_H

    // Separator line (Main Footer Top)
    ln(page, MARGIN, yFoot + hFoot, width - MARGIN, yFoot + hFoot, 1.5, C.black)

    let curX = MARGIN

    // ── Col 1: Maitre d'ouvrage ─────────────────────────────────────
    const w1 = fw * 0.18
    ln(page, curX + w1, yFoot, curX + w1, yFoot + hFoot, 1.5, C.black)
    ln(page, curX, yFoot + hFoot / 2, curX + w1, yFoot + hFoot / 2, 1, C.black)

    // Vertically centered labels and values
    txCentered(page, "Maitre d'ouvrage", curX + w1 / 2, yFoot + hFoot * 0.75 - 5, 9, bold, C.black)
    const maitre = san(`${data.demandeur.prenom || ''} ${data.demandeur.nom || ''}`.trim())
    txCentered(page, maitre.substring(0, 30).toUpperCase(), curX + w1 / 2, yFoot + hFoot * 0.25 - 5, 11, font, C.nearBlack)

    // ── Col 2: Projet / Adresse ─────────────────────────────────────
    curX += w1
    const w2 = fw * 0.40
    ln(page, curX + w2, yFoot, curX + w2, yFoot + hFoot, 1.5, C.black)
    ln(page, curX, yFoot + hFoot / 2, curX + w2, yFoot + hFoot / 2, 1, C.black)

    txCentered(page, natureLabel(data), curX + w2 / 2, yFoot + hFoot * 0.75 - 5, 9, font, C.nearBlack)

    const addr = data.terrain.meme_adresse ? data.demandeur.adresse : data.terrain.adresse
    const com = data.terrain.meme_adresse ? data.demandeur.commune : data.terrain.commune
    const cp = data.terrain.meme_adresse ? data.demandeur.code_postal : data.terrain.code_postal
    const fullAddr = san(`${addr || ''}, ${cp || ''} ${com || ''}`)
    const addrLines = wrapText(fullAddr, 50)

    // Center address lines vertically within the bottom half
    const lineH = 10
    let ay = yFoot + (hFoot / 2 + addrLines.length * lineH) / 2 - lineH
    for (let i = 0; i < Math.min(addrLines.length, 3); i++) {
        txCentered(page, addrLines[i], curX + w2 / 2, ay, 9, font, C.mid)
        ay -= lineH
    }

    // ── Col 3: DP Page Number ───────────────────────────────────────
    curX += w2
    const w3 = fw * 0.12
    ln(page, curX + w3, yFoot, curX + w3, yFoot + hFoot, 1.5, C.black)
    // Perfectly centered vertically
    txCentered(page, dpNum, curX + w3 / 2, yFoot + (hFoot - 28) / 2, 28, bold, C.black)

    // ── Col 4: Titre ───────────────────────────────────────────────
    curX += w3
    const w4 = fw * 0.18
    ln(page, curX + w4, yFoot, curX + w4, yFoot + hFoot, 1.5, C.black)
    const titleLines = wrapText(dpTitle.toUpperCase(), 25)
    // Perfectly centered vertically
    const tLineH = 12
    let ty = yFoot + (hFoot + titleLines.length * tLineH) / 2 - tLineH
    for (const line of titleLines) {
        txCentered(page, line, curX + w4 / 2, ty, 11, font, C.black)
        ty -= tLineH
    }

    // ── Col 5: Scale & Date ─────────────────────────────────────────
    curX += w4
    const w5 = fw - w1 - w2 - w3 - w4
    ln(page, curX, yFoot + hFoot / 2, curX + w5, yFoot + hFoot / 2, 1, C.black)
    ln(page, curX + w5 / 2, yFoot, curX + w5 / 2, yFoot + hFoot, 1, C.black)

    // Headers (Top Row) - Vertically centered in top half
    txCentered(page, 'Echelle :', curX + w5 / 4, yFoot + hFoot * 0.75 - 4, 9, font, C.nearBlack)
    txCentered(page, 'Date :', curX + (w5 * 3) / 4, yFoot + hFoot * 0.75 - 4, 9, font, C.nearBlack)

    // Values (Bottom Row) - Vertically centered in bottom half
    txCentered(page, scale, curX + w5 / 4, yFoot + hFoot * 0.25 - 5, 10, font, C.mid)
    const dateStr = new Date().toLocaleDateString('fr-FR')
    txCentered(page, dateStr, curX + (w5 * 3) / 4, yFoot + hFoot * 0.25 - 5, 10, font, C.mid)
}

/** Placeholder box for missing image. */
function placeholder(page: PDFPage, font: PDFFont,
    x: number, y: number, w: number, h: number, label: string) {
    box(page, x, y - h, w, h, C.offWhite, C.pale, 1)
    txCentered(page, san(label), x + w / 2, y - h / 2, 9, font, C.mid)
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

/** Professional 8-point compass rose */
function compassRose(page: PDFPage, bold: PDFFont, cx: number, cy: number, r = 22) {
    const toRad = (d: number) => d * Math.PI / 180
    for (let i = 0; i < 8; i++) {
        const a = toRad(i * 45)
        const isMajor = i % 2 === 0
        const len = isMajor ? r : r * 0.6
        ln(page, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, isMajor ? 1.5 : 0.8, C.dark)
    }
    // N arrow head
    page.drawLine({ start: { x: cx - 3, y: cy + r * 0.5 }, end: { x: cx, y: cy + r + 4 }, thickness: 1.5, color: C.nearBlack })
    page.drawLine({ start: { x: cx + 3, y: cy + r * 0.5 }, end: { x: cx, y: cy + r + 4 }, thickness: 1.5, color: C.nearBlack })
    page.drawCircle({ x: cx, y: cy, size: 3, color: C.dark })
    // Cardinal labels
    const cardinals = [{ a: 90, l: 'N' }, { a: 0, l: 'E' }, { a: 270, l: 'S' }, { a: 180, l: 'O' }]
    for (const { a, l } of cardinals) {
        const rad = toRad(a)
        const lx = cx + Math.cos(rad) * (r + 9)
        const ly = cy + Math.sin(rad) * (r + 9)
        const w = bold.widthOfTextAtSize(l, 7)
        tx(page, l, lx - w / 2, ly - 3, 7, bold, C.nearBlack)
    }
}

/** Draw an architectural dimension arrow (blue) — with arrowheads and extension lines */
function dimLabel(page: PDFPage, font: PDFFont, x1: number, y1: number, x2: number, y2: number, label: string) {
    const blue = rgb(0, 0.27, 0.78)
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 5) return
    const ux = dx / len, uy = dy / len  // unit along line
    const aLen = 5                       // arrowhead half-length
    // Main dimension line
    ln(page, x1, y1, x2, y2, 0.8, blue)
    // Open arrowhead at p1: two ticks pointing inward
    const perpLen = 2.5
    ln(page, x1, y1, x1 + ux * aLen - uy * perpLen, y1 + uy * aLen + ux * perpLen, 0.9, blue)
    ln(page, x1, y1, x1 + ux * aLen + uy * perpLen, y1 + uy * aLen - ux * perpLen, 0.9, blue)
    // Open arrowhead at p2
    ln(page, x2, y2, x2 - ux * aLen - uy * perpLen, y2 - uy * aLen + ux * perpLen, 0.9, blue)
    ln(page, x2, y2, x2 - ux * aLen + uy * perpLen, y2 - uy * aLen - ux * perpLen, 0.9, blue)
    // Label centred on the line with white background
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const tw = font.widthOfTextAtSize(label, 7)
    page.drawRectangle({ x: mx - tw / 2 - 2, y: my - 1, width: tw + 4, height: 10, color: rgb(1, 1, 1) })
    tx(page, label, mx - tw / 2, my + 1.5, 7, font, blue)
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
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique)
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
    const addPage = (): PDFPage => { const p = doc.addPage([1190.55, 841.89]); pages.push(p); return p }
    const PW = 1190.55
    const PH = 841.89
    const CW = PW - MARGIN * 2   // content width on standard pages

    // ══════════════════════ PAGE 0 – COVER ════════════════════════════════
    {
        const page = addPage()
        const M = MARGIN
        const halfW = (PW - M * 2) / 2
        let y = PH - MARGIN

        drawFrame(page)

        // Title Box (Centered Top)
        const titleW = 450
        const titleH = 70
        box(page, (PW - titleW) / 2, y - titleH - 20, titleW, titleH, undefined, C.black, 1.5)
        txCentered(page, "DECLARATION PREALABLE", PW / 2, y - titleH - 20 + 28, 24, bold, C.black)

        // --- Agency / Logo Area (Professional & Minimalist) ---
        const logoX = PW - MARGIN - 320
        const logoY = y - 80
        tx(page, "BUREAU D'ETUDES", logoX, logoY, 28, font, C.black)
        tx(page, "CONCEPTION & URBANISME", logoX, logoY - 35, 18, font, C.mid)
        ln(page, logoX, logoY - 50, PW - MARGIN - 20, logoY - 50, 1, C.black)

        y -= 180

        // Type Label (Black instead of blue)
        const typeLabel = natureLabel(data)
        const labelW = bold.widthOfTextAtSize(san(typeLabel), 26)
        tx(page, san(typeLabel), M + FRAME_PAD, y, 26, font, C.black)
        ln(page, M + FRAME_PAD, y - 6, M + FRAME_PAD + labelW, y - 6, 2, C.black)
        y -= 45

        // Content area layout
        const contentW = PW - M * 2
        const rightTableW = 400
        const leftSideW = contentW - rightTableW - 20
        const imgW = leftSideW
        const maxImgH = 460
        const firstFacade = photos.facades[0]
        const coverImgSrc = (firstFacade?.after || firstFacade?.before) || photos.dp7_vue_proche || '/placeholder.png'
        const coverImg = await embed(doc, coverImgSrc)

        if (coverImg) {
            drawImage(page, coverImg, M, y, imgW, maxImgH)
        } else {
            placeholder(page, font, M, y, imgW, maxImgH, "Image du projet")
        }

        // Right Side: Stacked Tables (Info Box then Revision Table)
        const infoX = PW - M - rightTableW
        const infoW = rightTableW
        const infoH = 260
        const boxY = y - infoH
        box(page, infoX, boxY, infoW, infoH, undefined, C.black, 1)

        // Grid lines - FIXED COORDINATES
        ln(page, infoX + 100, boxY, infoX + 100, boxY + infoH, 1, C.black) // Vertical divider
        ln(page, infoX, boxY + infoH - 60, infoX + infoW, boxY + infoH - 60, 1, C.black) // Row 1 divider
        ln(page, infoX, boxY + infoH - 140, infoX + infoW, boxY + infoH - 140, 1, C.black) // Row 2 divider

        // Row 1: NOM
        tx(page, "NOM", infoX + 15, boxY + infoH - 35, 10, font, C.mid)
        tx(page, san(nomFull).toUpperCase(), infoX + 115, boxY + infoH - 35, 13, bold, C.black)

        // Row 2: ADRESSE
        tx(page, "ADRESSE", infoX + 15, boxY + infoH - 95, 10, font, C.mid)
        textBlock(page, addrTrav, infoX + 115, boxY + infoH - 95, 12, font, 35, 16, C.black)

        // Row 3: TERRAIN
        tx(page, "TERRAIN", infoX + 15, boxY + 60, 10, font, C.mid)
        let tyGrid = boxY + 100
        tx(page, "SECTION :", infoX + 115, tyGrid, 10, font, C.mid); tx(page, san(t.section_cadastrale || '-'), infoX + 185, tyGrid, 12, bold, C.black)
        tyGrid -= 25
        tx(page, "NUMERO :", infoX + 115, tyGrid, 10, font, C.mid); tx(page, san(t.numero_parcelle || '-'), infoX + 185, tyGrid, 12, bold, C.black)
        tyGrid -= 25
        tx(page, "SUPERFICIE :", infoX + 115, tyGrid, 10, font, C.mid);
        const surfVal = t.surface_terrain ? `${t.surface_terrain.toString().replace(/m2/i, '').trim()} m2` : '-'
        tx(page, surfVal, infoX + 185, tyGrid, 12, bold, C.black)

        // ── Revision Table (Stacked below Info Box) ─────────────────────
        const tY = boxY - 140 // Positioned immediately below the info box with a small gap
        const tableW = rightTableW
        const tableX = infoX
        const rowH = 25
        const numRows = 5
        const col1W = 100
        const col2W = 240
        const col3W = 60

        // Table Outline
        box(page, tableX, tY, tableW, rowH * numRows, undefined, C.black, 1)

        // Vertical lines
        ln(page, tableX + col1W, tY, tableX + col1W, tY + rowH * numRows, 1, C.black)
        ln(page, tableX + col1W + col2W, tY, tableX + col1W + col2W, tY + rowH * numRows, 1, C.black)

        // Horizontal lines
        for (let i = 1; i < numRows; i++) {
            ln(page, tableX, tY + i * rowH, tableX + tableW, tY + i * rowH, 1, C.black)
        }

        // Headers (Top row)
        const hy = tY + rowH * (numRows - 1) + 8
        txCentered(page, "DATES", tableX + col1W / 2, hy, 10, font, C.black)
        txCentered(page, "MODIFICATIONS", tableX + col1W + col2W / 2, hy, 10, font, C.black)
        txCentered(page, "INDICES", tableX + col1W + col2W + col3W / 2, hy, 10, font, C.black)

        // First project line
        const ry = tY + rowH * (numRows - 2) + 8
        txCentered(page, dateStr, tableX + col1W / 2, ry, 10, font, C.black)
        txCentered(page, "Creation du dossier de declaration prealable", tableX + col1W + col2W / 2, ry, 10, font, C.black)
        txCentered(page, "A", tableX + col1W + col2W + col3W / 2, ry, 10, font, C.black)
    }

    // ══════════════════════ PAGE 1 – DP1 Plan de situation ════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2

        drawFrame(page)
        let y = drawDesignHeader(page, fontOblique)

        y = drawTitleProfessional(page, bold, 'Plan de situation du terrain', M, y)
        y -= 10

        const isCaptured = plans.dp1_carte_situation?.startsWith('data:image')
        const mapUrl = isCaptured ? plans.dp1_carte_situation : (coords ? getIGNMapUrl('DP1', coords) : null)
        const mapImg = await embed(doc, mapUrl)
        const maxMapH = Math.min(y - FOOT_H - 25, 480)

        if (mapImg && maxMapH > 80) {
            const newY = drawImage(page, mapImg, M, y, cW, maxMapH)
            // Only draw overlays if it's NOT a UI capture (which already has them)
            if (!isCaptured) {
                target(page, M + cW / 2, (y + newY) / 2)
                north(page, bold, M + cW - 26, y - 20)
            }
            y = newY - 10
        } else {
            placeholder(page, font, M, y, cW, Math.max(80, maxMapH), 'Carte IGN non disponible')
            y -= Math.max(80, maxMapH) + 10
        }

        drawDesignFooter(page, font, bold, data, 'DP 1', 'Plan de situation du terrain', '1:10 000')
    }

    // ══════════════════════ PAGE 2 – DP2 Plan de masse ═══════════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2

        drawFrame(page)
        let y = drawDesignHeader(page, fontOblique)

        y = drawTitleProfessional(page, bold, 'Plan de masse des constructions', M, y)
        y -= 10

        const maxMapH = Math.min(y - FOOT_H - 25, 480)

        const isCaptured = plans.dp2_plan_masse?.startsWith('data:image')

        if (isCaptured) {
            const mapImg = await embed(doc, plans.dp2_plan_masse)
            if (mapImg) {
                const newY = drawImage(page, mapImg, M, y, cW, maxMapH)
                y = newY - 20
            } else {
                placeholder(page, font, M, y, cW, Math.max(80, maxMapH), 'Plan de masse non disponible')
                y -= Math.max(80, maxMapH) + 20
            }
        } else {
            // Try to fetch WFS Vector Data for DP2
            let vectorData = null
            if (coords) {
                vectorData = await getVectorMapData(coords, 120) // 120m wide bbox: enough context
            }

        if (vectorData && vectorData.cadastre && vectorData.cadastre.features && maxMapH > 80) {
            // ── Professional architectural plan rendering (Refined) ──────────
            const featuresC = vectorData.cadastre.features || []
            const featuresB = vectorData.bati?.features || []

            const getCoordArrays = (feat: any) => {
                const t = feat.geometry?.type
                if (t === 'Polygon') return feat.geometry.coordinates
                if (t === 'MultiPolygon') return feat.geometry.coordinates.flat(1)
                return []
            }

            // 1. Find target parcel
            let targetParcel: any = null
            let minDist = Infinity
            let cx3857 = 0, cy3857 = 0
            if (coords) {
                const R = 6378137
                cx3857 = R * coords.lon * Math.PI / 180
                cy3857 = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI / 180) / 2))
                
                for (const feat of featuresC) {
                    const rings = getCoordArrays(feat)
                    if (!rings || !rings[0]) continue
                    const ring = rings[0] as number[][]
                    let fx = 0, fy = 0
                    for (const c of ring) { fx += c[0]; fy += c[1] }
                    fx /= ring.length; fy /= ring.length
                    const dist = Math.sqrt((fx - cx3857) ** 2 + (fy - cy3857) ** 2)
                    if (dist < minDist) { minDist = dist; targetParcel = feat }
                }
            }

            // 2. Determine view bbox based on target parcel + context (Matches UI)
            let vMinX: number, vMinY: number, vMaxX: number, vMaxY: number
            if (targetParcel) {
                const ring = getCoordArrays(targetParcel)[0] as number[][]
                let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
                for (const c of ring) {
                    if (c[0] < bMinX) bMinX = c[0]; if (c[0] > bMaxX) bMaxX = c[0]
                    if (c[1] < bMinY) bMinY = c[1]; if (c[1] > bMaxY) bMaxY = c[1]
                }
                const centerX = (bMinX + bMaxX) / 2
                const centerY = (bMinY + bMaxY) / 2
                const w = bMaxX - bMinX
                const h = bMaxY - bMinY
                const span = Math.max(w, h, 80) * 0.8 // Provide about 60-100m context around center
                vMinX = centerX - span; vMaxX = centerX + span
                vMinY = centerY - span; vMaxY = centerY + span
            } else {
                const parts = vectorData.bboxStr.split(',').map(Number)
                vMinX = parts[0]; vMinY = parts[1]; vMaxX = parts[2]; vMaxY = parts[3]
            }

            const mapSrcW = vMaxX - vMinX
            const mapSrcH = vMaxY - vMinY
            const scale = Math.min(cW / mapSrcW, maxMapH / mapSrcH) * 0.98
            const drawW = mapSrcW * scale
            const drawH = mapSrcH * scale
            const startX = M + (cW - drawW) / 2
            const startY = y - drawH

            const mc = (gx: number, gy: number) => ({
                x: startX + (gx - vMinX) * scale,
                y: startY + (gy - vMinY) * scale,
            })

            const drawFillablePolygon = (rings: any, fillColor?: any, strokeColor?: any, width?: number) => {
                if (!rings || !rings.length) return
                for (const ring of rings) {
                    if (!ring || ring.length < 3) continue
                    const points = ring.map((c: any) => mc(c[0], c[1]))
                    
                    page.pushOperators(pushGraphicsState())
                    page.pushOperators(setLineWidth(width ?? 0.8))
                    if (strokeColor) page.pushOperators(setStrokingColor(strokeColor))
                    if (fillColor) page.pushOperators(setFillingColor(fillColor))
                    
                    page.pushOperators(moveTo(points[0].x, points[0].y))
                    for (let i = 1; i < points.length; i++) {
                        page.pushOperators(lineTo(points[i].x, points[i].y))
                    }
                    page.pushOperators(closePath())
                    
                    if (fillColor && strokeColor) page.pushOperators(fillAndStroke())
                    else if (fillColor) page.pushOperators(fillAndStroke()) 
                    else if (strokeColor) page.pushOperators(stroke())
                    else page.pushOperators(stroke())
                    
                    page.pushOperators(popGraphicsState())
                }
            }

            // Render Map with Clipping
            page.pushOperators(pushGraphicsState())
            page.pushOperators(moveTo(startX, startY))
            page.pushOperators(lineTo(startX + drawW, startY))
            page.pushOperators(lineTo(startX + drawW, startY + drawH))
            page.pushOperators(lineTo(startX, startY + drawH))
            page.pushOperators(closePath())
            page.pushOperators(clip())
            page.pushOperators(endPath())

            box(page, startX, startY, drawW, drawH, rgb(0.88, 0.88, 0.88), C.dark, 0.8)

            // Draw Parcelles
            for (const feat of featuresC) {
                const isTarget = feat === targetParcel
                const rings = getCoordArrays(feat)
                drawFillablePolygon(
                    rings, 
                    isTarget ? rgb(0.82, 0.93, 0.72) : rgb(0.96, 0.96, 0.94), 
                    isTarget ? rgb(0, 0.35, 0.8) : rgb(0.65, 0.65, 0.65), 
                    isTarget ? 1.8 : 0.6
                )
            }

            // Draw Buildings
            for (const feat of featuresB) {
                const rings = getCoordArrays(feat)
                drawFillablePolygon(rings, rgb(0.62, 0.62, 0.62), rgb(0.2, 0.2, 0.2), 0.7)
            }
            
            // Pop Clipping
            page.pushOperators(popGraphicsState())

            // Draw Dimensions (Buildings inside target parcel)
            let tpMinX = Infinity, tpMinY = Infinity, tpMaxX = -Infinity, tpMaxY = -Infinity
            if (targetParcel) {
                const ring = getCoordArrays(targetParcel)[0] as number[][]
                for (const c of ring) {
                    if (c[0] < tpMinX) tpMinX = c[0]; if (c[0] > tpMaxX) tpMaxX = c[0]
                    if (c[1] < tpMinY) tpMinY = c[1]; if (c[1] > tpMaxY) tpMaxY = c[1]
                }
            }

            for (const feat of featuresB) {
                const rings = getCoordArrays(feat)
                if (!rings || !rings[0]) continue
                const ring = rings[0] as number[][]
                let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
                for (const c of ring) {
                    if (c[0] < bMinX) bMinX = c[0]; if (c[0] > bMaxX) bMaxX = c[0]
                    if (c[1] < bMinY) bMinY = c[1]; if (c[1] > bMaxY) bMaxY = c[1]
                }
                const bCx = (bMinX + bMaxX) / 2, bCy = (bMinY + bMaxY) / 2
                if (bCx < tpMinX || bCx > tpMaxX || bCy < tpMinY || bCy > tpMaxY) continue
                
                const wM = bMaxX - bMinX, hM = bMaxY - bMinY
                if (wM < 2 || hM < 2) continue

                const bl = mc(bMinX, bMinY), br = mc(bMaxX, bMinY)
                const tr = mc(bMaxX, bMaxY)
                
                dimLabel(page, font, bl.x, bl.y - 12, br.x, br.y - 12, `${wM.toFixed(1)} m`)
                dimLabel(page, font, br.x + 12, br.y, tr.x + 12, tr.y, `${hM.toFixed(1)} m`)
            }

            // Target Crosshair
            target(page, mc(cx3857, cy3857).x, mc(cx3857, cy3857).y, 10)
            compassRose(page, bold, startX + 35, startY + drawH - 35, 20)

            // Legend
            const legX = startX + 10, legY = startY + 10
            box(page, legX, legY, 150, 60, C.white, C.dark, 0.8)
            page.drawRectangle({ x: legX + 8, y: legY + 45, width: 12, height: 8, color: rgb(0.82, 0.93, 0.72), borderColor: rgb(0, 0.35, 0.8), borderWidth: 1.5 })
            tx(page, "Parcelle concernee", legX + 26, legY + 46, 7.5, font)
            page.drawRectangle({ x: legX + 8, y: legY + 31, width: 12, height: 8, color: rgb(0.62, 0.62, 0.62), borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.8 })
            tx(page, "Batiments (BD TOPO)", legX + 26, legY + 32, 7.5, font)
            page.drawRectangle({ x: legX + 8, y: legY + 17, width: 12, height: 8, color: rgb(0.88, 0.88, 0.88), borderColor: C.dark, borderWidth: 0.5 })
            tx(page, "Voiries / Autres", legX + 26, legY + 18, 7.5, font)
            tx(page, "IGN - BD TOPO / Cadastre", legX + 26, legY + 4, 6, fontOblique, C.mid)

            y = startY - 20
        } else {
            // Fallback to IGN WMS image if WFS fails
            const mapUrl = coords ? getIGNMapUrl('DP2', coords) : null
            const mapImg = await embed(doc, mapUrl)
            if (mapImg && maxMapH > 80) {
                const newY = drawImage(page, mapImg, M, y, cW, maxMapH)
                target(page, M + cW / 2, (y + newY) / 2, 18)
                north(page, bold, M + cW - 26, y - 20)
                y = newY - 20
            } else {
                placeholder(page, font, M, y, cW, Math.max(80, maxMapH), 'Plan de masse non disponible')
                y -= Math.max(80, maxMapH) + 20
            }
        }
    }

        drawDesignFooter(page, font, bold, data, 'DP 2', 'Plan de masse des constructions', '1:1 000')
    }



    // ══════════════════════ PAGE 4 – DP4 Notice descriptive ══════════════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2

        drawFrame(page)
        let y = drawDesignHeader(page, fontOblique)

        y = drawTitleProfessional(page, bold, 'Notice descriptive du projet de travaux', M, y)
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

            if (isHeading && !trimmed) continue

            if (isHeading) {
                if (y < FOOT_H + 70) {
                    drawDesignFooter(pdPage, font, bold, data, 'DP 4', 'Notice descriptive du projet', 'Sans')
                    pdPage = addPage()
                    drawFrame(pdPage)
                    y = drawDesignHeader(pdPage, fontOblique)
                }

                y -= 8
                y = drawTitleProfessional(pdPage, bold, trimmed, M, y, 14)
                y -= 8
            } else {
                const wrapped = wrapText(trimmed, 110)
                for (const l of wrapped) {
                    if (y < FOOT_H + 30) {
                        drawDesignFooter(pdPage, font, bold, data, 'DP 4', 'Notice descriptive du projet', 'Sans')
                        pdPage = addPage()
                        drawFrame(pdPage)
                        y = drawDesignHeader(pdPage, fontOblique)
                    }
                    tx(pdPage, l, M, y, 12, font, C.nearBlack)
                    y -= 18
                }
                y -= 10
            }
        }
        drawDesignFooter(pdPage, font, bold, data, 'DP 4', 'Notice descriptive du projet', 'Sans')
    }

    // ══════════════════════ PAGE 5 – DP5 Croquis Architectural ══════════
    {
        const croquisToDraw = photos.facades.filter(f => f.croquis)
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        drawFrame(page)
        let y = drawDesignHeader(page, fontOblique)
        y = drawTitleProfessional(page, bold, 'Plans des facades : Etat projeté (DP 5)', M, y)
        y -= 10

        if (croquisToDraw.length === 0) {
            placeholder(page, font, M, y, cW, 200, 'Croquis architectural non genere')
        } else {
            const count = croquisToDraw.length
            const cols = count > 1 ? 2 : 1
            const rows = Math.ceil(count / cols)
            const cellW = (cW - (cols - 1) * 12) / cols
            const cellH = (y - FOOT_H - 120) / rows
            
            for (let i = 0; i < count; i++) {
                const f = croquisToDraw[i]
                const r = Math.floor(i / cols)
                const c = i % cols
                const cx = M + c * (cellW + 12)
                const cy = y - r * (cellH + 20)
                
                const img = await embed(doc, f.croquis)
                if (img) {
                    const dims = img.scaleToFit(cellW, cellH - 40)
                    const xOff = cx + (cellW - dims.width) / 2
                    box(page, xOff - 2, cy - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.black, 0.8)
                    page.drawImage(img, { x: xOff, y: cy - dims.height, width: dims.width, height: dims.height })
                    tx(page, f.label, cx, cy - dims.height - 15, 10, bold, C.nearBlack)
                } else {
                    placeholder(page, font, cx, cy, cellW, cellH - 40, `Croquis: ${f.label}`)
                }
                if (i >= 3) break 
            }
        }
        
        const note = "Documents presentant les modifications architecturales projetees pour l'ensemble des facades concernées. Ils permettent d'apprecier l'aspect architectural, les proportions et les materiaux mis en oeuvre."
        const noteY = FOOT_H + 50
        box(page, M, noteY, cW, 44, C.offWhite, C.black, 1.2)
        textBlock(page, note, M + 14, noteY + 32, 10, font, 130, 14, C.nearBlack)

        drawDesignFooter(page, font, bold, data, 'DP 5', 'Plans des facades : croquis architectural', 'Sans')
    }

    // ══════════════════════ PAGE 6 – DP6 Insertion Paysagere ══════════════
    {
        const facadesToDraw = photos.facades.filter(f => f.before || f.after)

        if (facadesToDraw.length === 0) {
            const page = addPage()
            const M = M_INNER
            const cW = PW - M * 2
            drawFrame(page)
            let y = drawDesignHeader(page, fontOblique)
            y = drawTitleProfessional(page, bold, 'Insertion paysagere : Comparaison visuelle', M, y)
            y -= 10
            placeholder(page, font, M, y, cW, 200, 'Aucune photo pour l\'insertion paysagere')
            drawDesignFooter(page, font, bold, data, 'DP 6', 'Insertion paysagere : simulation apres travaux', 'Sans')
        } else {
            for (const f of facadesToDraw) {
                const page = addPage()
                const M = M_INNER
                const cW = PW - M * 2

                drawFrame(page)
                let y = drawDesignHeader(page, fontOblique)

                y = drawTitleProfessional(page, bold, `Insertion paysagere : ${f.label}`, M, y)
                y -= 10

                const colW = (cW - 12) / 2
                const maxImgH = Math.min(y - FOOT_H - 120, 420)

                // Column headers
                drawTitleProfessional(page, bold, 'Etat existant (Avant)', M, y, 14)
                drawTitleProfessional(page, bold, 'Apres travaux (Simulation)', M + colW + 12, y, 14)
                y -= 10

                const avImg = await embed(doc, f.before)
                const apImg = await embed(doc, f.after)

                // Avant
                if (avImg) {
                    const dims = avImg.scaleToFit(colW, maxImgH)
                    const xOff = M + (colW - dims.width) / 2
                    box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.black, 1)
                    page.drawImage(avImg, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
                } else {
                    placeholder(page, font, M, y, colW, maxImgH, `Photo ${f.label.toLowerCase()} manquante`)
                }

                // Apres
                if (apImg) {
                    const dims = apImg.scaleToFit(colW, maxImgH)
                    const xOff = M + colW + 12 + (colW - dims.width) / 2
                    box(page, xOff - 2, y - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.black, 1)
                    page.drawImage(apImg, { x: xOff, y: y - dims.height, width: dims.width, height: dims.height })
                } else {
                    placeholder(page, font, M + colW + 12, y, colW, maxImgH, 'Simulation IA non generee')
                }

                y -= maxImgH + 20
                ln(page, M, y, PW - M, y, 1, C.black)
                
                // Note technique block
                const note6 = `Le document DP6 est une insertion graphique permettant d'apprecier l'integration du projet pour la ${f.label.toLowerCase()}. Cette simulation photorealiste montre le futur aspect de la construction.`
                const n6Lines = wrapText(note6, 110)
                const n6H = 35 + n6Lines.length * 16 + 10
                y -= n6H
                box(page, M, y, cW, n6H, C.offWhite, C.black, 1.5)
                tx(page, 'NOTE TECHNIQUE DP 6', M + 14, y + n6H - 24, 12, bold, C.black)
                textBlock(page, note6, M + 14, y + n6H - 44, 11, font, 110, 16, C.nearBlack)

                drawDesignFooter(page, font, bold, data, 'DP 6', `Insertion paysagere (${f.label})`, 'Sans')
            }
        }
    }

    // ══════════════════════ PAGE 7 – DP7 & DP8 Vue proche/lointaine ══════
    {
        const page = addPage()
        const M = M_INNER
        const cW = PW - M * 2
        drawFrame(page)
        let y = drawDesignHeader(page, fontOblique)

        y = drawTitleProfessional(page, bold, 'Photographies de la construction (DP 7 & DP 8)', M, y)
        y -= 10

        const colW = (cW - 12) / 2
        const maxImgH = y - FOOT_H - 140
        
        // DP 7
        drawTitleProfessional(page, bold, 'DP 7 : Vue rapprochee', M, y, 14)
        const img7 = await embed(doc, photos.dp7_vue_proche)
        if (img7) {
            const dims = img7.scaleToFit(colW, maxImgH)
            const xOff = M + (colW - dims.width) / 2
            box(page, xOff - 2, y - 25 - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.black, 1)
            page.drawImage(img7, { x: xOff, y: y - 25 - dims.height, width: dims.width, height: dims.height })
            tx(page, 'Vue rapprochee depuis la voie publique', M, y - 25 - dims.height - 18, 9, fontOblique, C.dark)
        } else {
            placeholder(page, font, M, y - 25, colW, 200, 'Photo DP 7 manquante')
        }

        // DP 8
        drawTitleProfessional(page, bold, 'DP 8 : Vue eloignee', M + colW + 12, y, 14)
        const img8 = await embed(doc, photos.dp8_vue_lointaine)
        if (img8) {
            const dims = img8.scaleToFit(colW, maxImgH)
            const xOff = M + colW + 12 + (colW - dims.width) / 2
            box(page, xOff - 2, y - 25 - dims.height - 2, dims.width + 4, dims.height + 4, C.white, C.black, 1)
            page.drawImage(img8, { x: xOff, y: y - 25 - dims.height, width: dims.width, height: dims.height })
            tx(page, 'Vue d\'ensemble de l\'environnement', M + colW + 12, y - 25 - dims.height - 18, 9, fontOblique, C.dark)
        } else {
            placeholder(page, font, M + colW + 12, y - 25, colW, 200, 'Photo DP 8 manquante')
        }

        drawDesignFooter(page, font, bold, data, 'DP 7/8', 'Photographies de la construction', 'Sans')
    }

    return await doc.save()
}
