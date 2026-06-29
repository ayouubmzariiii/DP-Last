// ─────────────────────────────────────────────────────────────────────────────
// PLU règlement acquisition — read the zoning regulation for a parcel whatever its
// format, and hand the analyzer either clean text (text PDF) or page images
// (scanned PDF / image règlement, for vision-OCR).
//
// Server-only (uses pdf-parse + pdfjs-dist + @napi-rs/canvas). Every path is
// defensive: any failure degrades to { kind: 'none' } so the analyzer marks the
// rules "non vérifié" instead of crashing or inventing them.
// ─────────────────────────────────────────────────────────────────────────────

export type PluContent =
    | { kind: 'text'; text: string; pages: number; zoneMatched: boolean }
    | { kind: 'images'; images: string[]; pages: number } // images = data URLs (PNG)
    | { kind: 'none'; reason: string }

const MIN_TEXT_CHARS = 600        // below this, treat the PDF as scanned
const MAX_TEXT_CHARS = 120_000    // cap fed to the LLM
const MAX_RASTER_PAGES = 10       // cap pages we OCR via vision
const RASTER_SCALE = 2.0          // ~144 dpi — legible for OCR without huge payloads

// ── Download with a timeout ──────────────────────────────────────────────────
async function download(url: string, timeoutMs = 20_000): Promise<Buffer | null> {
    try {
        const controller = new AbortController()
        const id = setTimeout(() => controller.abort(), timeoutMs)
        const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id))
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch {
        return null
    }
}

// ── Plain-text extraction via pdf-parse v2 (class API: new PDFParse().getText()) ─
async function extractText(buffer: Buffer): Promise<string> {
    try {
        const { PDFParse }: any = await import('pdf-parse')
        const parser = new PDFParse({ data: new Uint8Array(buffer) })
        const result = await parser.getText()
        const text = (result?.text || '').trim()
        try { await parser.destroy?.() } catch { /* ignore */ }
        return text
    } catch (e) {
        console.error('[pluExtractor] extractText failed:', e)
        return ''
    }
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
    // The start of the NEXT zone chapter (to bound the slice) — any "ZONE <CODE>" that differs.
    const nextZoneRe = /\b(zone|chapitre)\b.{0,40}\bzone\s+([0-9A-Z]{1,4})\b/i

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

// ── Rasterize a (scanned) PDF to PNG data URLs via pdf-parse v2's getScreenshot ─
// pdf-parse bundles its own self-consistent pdfjs + image decoders (JBIG2/JPEG2000), so this
// avoids the dual-pdfjs version clash and the worker/wasm wiring that breaks in the Next bundle.
async function rasterize(buffer: Buffer): Promise<string[]> {
    try {
        const { PDFParse }: any = await import('pdf-parse')
        const parser = new PDFParse({ data: new Uint8Array(buffer) })
        const result = await parser.getScreenshot({ scale: RASTER_SCALE })
        try { await parser.destroy?.() } catch { /* ignore */ }
        const pages = (result?.pages || []).slice(0, MAX_RASTER_PAGES)
        return pages.map((p: any) => p?.dataUrl).filter((u: any): u is string => typeof u === 'string' && u.startsWith('data:'))
    } catch (e: any) {
        console.error('[pluExtractor] rasterize failed:', e?.message || e)
        return []
    }
}

// ── Public entry point ───────────────────────────────────────────────────────
export async function acquirePluContent(url: string, zoneLibelle?: string): Promise<PluContent> {
    const buffer = await download(url)
    if (!buffer) return { kind: 'none', reason: 'Document indisponible (téléchargement échoué).' }

    const text = await extractText(buffer)
    if (text.length >= MIN_TEXT_CHARS) {
        const { text: scoped, matched } = targetZoneChapter(text, zoneLibelle)
        return { kind: 'text', text: scoped, pages: 0, zoneMatched: matched }
    }

    // Scanned / image-only règlement → rasterize for vision OCR.
    const images = await rasterize(buffer)
    if (images.length > 0) return { kind: 'images', images, pages: images.length }

    // Last resort: if we got *some* text (just under threshold), still use it.
    if (text.length > 0) {
        const { text: scoped, matched } = targetZoneChapter(text, zoneLibelle)
        return { kind: 'text', text: scoped, pages: 0, zoneMatched: matched }
    }
    return { kind: 'none', reason: 'Règlement illisible (ni texte ni rendu image exploitable).' }
}
