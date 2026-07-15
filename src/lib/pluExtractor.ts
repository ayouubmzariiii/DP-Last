// ─────────────────────────────────────────────────────────────────────────────
// PLU règlement acquisition — read the zoning regulation for a parcel whatever its
// format, and hand the analyzer either clean text (text PDF) or page images
// (scanned PDF / image règlement, for vision-OCR).
//
// Server-only. Uses a SINGLE pdfjs version (pdfjs-dist, the app-wide 6.x) for BOTH
// text extraction and rasterization, with @napi-rs/canvas as the Node canvas backend.
// This deliberately avoids pdf-parse, whose bundled pdfjs (5.x) clashed with the
// app's pdfjs-dist worker (6.x) and broke every scanned règlement with
// "API version 5.4.296 does not match Worker version 6.0.227".
//
// Every path is defensive: any failure degrades to { kind: 'none' } so the analyzer
// marks the rules "non vérifié" instead of crashing or inventing them.
// ─────────────────────────────────────────────────────────────────────────────
import { createCanvas, DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas'

// pdfjs needs these DOM globals in Node; provide them from @napi-rs/canvas before pdfjs loads.
const g = globalThis as any
g.DOMMatrix ??= DOMMatrix
g.Path2D ??= Path2D
g.ImageData ??= ImageData

export type PluContent =
    | { kind: 'text'; text: string; pages: number; zoneMatched: boolean }
    | { kind: 'images'; images: string[]; pages: number } // images = data URLs (PNG)
    | { kind: 'none'; reason: string }

const MIN_TEXT_CHARS = 600        // below this, treat the PDF as scanned
const MAX_TEXT_CHARS = 120_000    // cap fed to the LLM
const MAX_RASTER_PAGES = 10       // cap pages we OCR via vision
const MAX_SCAN_PAGES = 40         // how far to look for content pages when rasterizing
const RASTER_SCALE = 2.0          // ~144 dpi — legible for OCR without huge payloads
const INK_MIN = 0.012             // min fraction of non-white sampled pixels for a "content" page
// Guard against gigantic combined PLUi documents (observed: a 1.17 GB, 4955-page règlement) that
// would exhaust memory or time out a serverless function. The cap admits genuinely large real
// règlements (e.g. La Rochelle's 140 MB PSMV) while killing the gigabyte monsters. Enforced by
// STREAMING the body and aborting once the cap is passed — a content-length check alone misses
// responses sent without that header (exactly how the 1.17 GB doc slipped through and hung).
const MAX_PDF_BYTES = 180 * 1024 * 1024

// Minimal Node canvas factory pdfjs uses to allocate rendering surfaces.
class NodeCanvasFactory {
    create(w: number, h: number) {
        const canvas = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)))
        return { canvas, context: canvas.getContext('2d') }
    }
    reset(cc: any, w: number, h: number) { cc.canvas.width = Math.max(1, Math.ceil(w)); cc.canvas.height = Math.max(1, Math.ceil(h)) }
    destroy(cc: any) { if (cc?.canvas) { cc.canvas.width = 0; cc.canvas.height = 0 } }
}

// ── Download with a timeout, retries and a size guard ─────────────────────────
async function download(url: string, timeoutMs = 60_000, tries = 3): Promise<Buffer | null> {
    for (let attempt = 0; attempt < tries; attempt++) {
        try {
            const controller = new AbortController()
            const id = setTimeout(() => controller.abort(), timeoutMs) // bounds headers AND body read
            try {
                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (DP-Travaux)', 'Accept': 'application/pdf,*/*' },
                })
                if (!res.ok) { console.warn('[pluExtractor] download HTTP', res.status, url); return null }
                // Fast path: reject up-front when the server declares an oversized body.
                const len = Number(res.headers.get('content-length') || 0)
                if (len && len > MAX_PDF_BYTES) {
                    console.warn(`[pluExtractor] PDF too large (${Math.round(len / 1e6)} MB > ${Math.round(MAX_PDF_BYTES / 1e6)} MB), skipping:`, url)
                    return null
                }
                // Stream with a hard byte cap so a body sent WITHOUT content-length can't buffer a gigabyte.
                if (!res.body) return null
                const reader = res.body.getReader()
                const chunks: Uint8Array[] = []
                let received = 0
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    received += value.length
                    if (received > MAX_PDF_BYTES) {
                        console.warn(`[pluExtractor] PDF exceeded ${Math.round(MAX_PDF_BYTES / 1e6)} MB while streaming, aborting:`, url)
                        try { await reader.cancel() } catch { /* ignore */ }
                        return null
                    }
                    chunks.push(value)
                }
                return Buffer.concat(chunks)
            } finally {
                clearTimeout(id) // only after the full read (or early return), so the body is time-bounded too
            }
        } catch (e: any) {
            // Transient socket close / abort → back off and retry (geopf drops big connections).
            console.warn(`[pluExtractor] download failed (try ${attempt + 1}/${tries}):`, e?.message || e)
            await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
        }
    }
    return null
}

// ── Load a pdfjs document (single version, no worker) ─────────────────────────
async function loadDoc(buffer: Buffer): Promise<any> {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    return pdfjs.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
        canvasFactory: new NodeCanvasFactory(),
    }).promise
}

// ── Plain-text extraction from an open document ───────────────────────────────
async function extractText(doc: any): Promise<string> {
    let out = ''
    const max = Math.min(doc.numPages, 500)
    for (let i = 1; i <= max; i++) {
        const page = await doc.getPage(i)
        const tc = await page.getTextContent()
        out += tc.items.map((it: any) => (typeof it?.str === 'string' ? it.str : '')).join(' ') + '\n'
        if (out.length > MAX_TEXT_CHARS) break
    }
    return out.trim()
}

// ── Zone-targeting: isolate the chapter for the parcel's exact zone ───────────
// A règlement covers every zone (U/AU/A/N + subzones). Feeding only the relevant
// chapter (+ a slice of general provisions) makes extraction far more accurate.
export function targetZoneChapter(fullText: string, zoneLibelle?: string): { text: string; matched: boolean } {
    if (!zoneLibelle || zoneLibelle.length < 1 || zoneLibelle.toUpperCase() === 'RNU') {
        return { text: fullText.slice(0, MAX_TEXT_CHARS), matched: false }
    }
    const zone = zoneLibelle.trim().toUpperCase()
    const lines = fullText.split(/\r?\n/)
    // Heading patterns: "ZONE UB", "DISPOSITIONS APPLICABLES A LA ZONE UB", "CHAPITRE ... UB"
    const headingRe = new RegExp(`(zone|chapitre|dispositions).{0,40}\\b${zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

    let start = -1
    for (let i = 0; i < lines.length; i++) {
        if (headingRe.test(lines[i])) { start = i; break }
    }
    if (start === -1) {
        // Fall back to the whole document if we can't find the chapter heading.
        return { text: fullText.slice(0, MAX_TEXT_CHARS), matched: false }
    }
    let end = lines.length
    for (let i = start + 3; i < lines.length; i++) {
        const m = lines[i].match(/\bzone\s+([0-9A-Z]{1,4})\b/i)
        if (m && m[1].toUpperCase() !== zone && /dispositions|zone|chapitre/i.test(lines[i])) { end = i; break }
    }
    const chapter = lines.slice(start, end).join('\n').trim()
    // Prepend a slice of the document head (general provisions often hold colour/material rules).
    const head = fullText.slice(0, 8_000)
    const combined = `${head}\n\n===== CHAPITRE ZONE ${zone} =====\n${chapter}`.slice(0, MAX_TEXT_CHARS)
    return { text: combined, matched: true }
}

// ── Rasterize a (scanned) document to PNG data URLs via pdfjs + @napi-rs/canvas ─
// Skips near-blank pages (covers, separators) so the OCR sees actual rule content.
async function rasterize(doc: any): Promise<string[]> {
    const cf = new NodeCanvasFactory()
    const images: string[] = []
    const scanLimit = Math.min(doc.numPages, MAX_SCAN_PAGES)
    for (let i = 1; i <= scanLimit && images.length < MAX_RASTER_PAGES; i++) {
        try {
            const page = await doc.getPage(i)
            const viewport = page.getViewport({ scale: RASTER_SCALE })
            const cc = cf.create(viewport.width, viewport.height)
            await page.render({ canvasContext: cc.context, viewport, canvasFactory: cf }).promise
            // Measure "ink" (non-near-white sampled pixels); skip pages below the threshold.
            let ink = 0, sampled = 0
            try {
                const { data } = cc.context.getImageData(0, 0, cc.canvas.width, cc.canvas.height)
                for (let p = 0; p < data.length; p += 4 * 24) { sampled++; if (data[p] < 235 || data[p + 1] < 235 || data[p + 2] < 235) ink++ }
            } catch { sampled = 1; ink = 1 } // if pixel read fails, keep the page
            cf.destroy(cc)
            if (sampled > 0 && ink / sampled < INK_MIN) continue
            images.push('data:image/png;base64,' + cc.canvas.toBuffer('image/png').toString('base64'))
        } catch (e: any) {
            console.warn('[pluExtractor] rasterize page', i, 'failed:', e?.message || e)
        }
    }
    return images
}

// ── Public entry point ───────────────────────────────────────────────────────
export async function acquirePluContent(url: string, zoneLibelle?: string): Promise<PluContent> {
    const buffer = await download(url)
    if (!buffer) return { kind: 'none', reason: 'Document indisponible (téléchargement échoué ou trop volumineux).' }

    let doc: any
    try {
        doc = await loadDoc(buffer)
    } catch (e: any) {
        console.error('[pluExtractor] loadDoc failed:', e?.message || e)
        return { kind: 'none', reason: 'Règlement illisible (PDF non exploitable).' }
    }

    try {
        const text = await extractText(doc)
        if (text.length >= MIN_TEXT_CHARS) {
            const { text: scoped, matched } = targetZoneChapter(text, zoneLibelle)
            return { kind: 'text', text: scoped, pages: doc.numPages || 0, zoneMatched: matched }
        }

        // Scanned / image-only règlement → rasterize for vision OCR.
        const images = await rasterize(doc)
        if (images.length > 0) return { kind: 'images', images, pages: images.length }

        // Last resort: if we got *some* text (just under threshold), still use it.
        if (text.length > 0) {
            const { text: scoped, matched } = targetZoneChapter(text, zoneLibelle)
            return { kind: 'text', text: scoped, pages: doc.numPages || 0, zoneMatched: matched }
        }
        return { kind: 'none', reason: 'Règlement illisible (ni texte ni rendu image exploitable).' }
    } finally {
        try { await doc.destroy?.() } catch { /* ignore */ }
    }
}
