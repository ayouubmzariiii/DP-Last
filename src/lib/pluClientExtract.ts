'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Browser-side règlement extraction. The browser fetches + parses the PLU PDF reliably (it's the
// same fetch that powers the on-page viewer), so doing it here avoids the server-side PDF parsing
// that fails in the Next server bundle. Returns clean text for text PDFs, or rendered page images
// for scanned / image-only règlements (fed to a vision model server-side for OCR).
// ─────────────────────────────────────────────────────────────────────────────

const MIN_TEXT_CHARS = 600
const MAX_TEXT_CHARS = 120_000
const MAX_OCR_PAGES = 8
const OCR_SCALE = 1.6

export interface ClientReglement {
    text?: string
    images?: string[]
    error?: string
}

let pdfjsPromise: Promise<any> | null = null
async function getPdfjs(): Promise<any> {
    if (!pdfjsPromise) {
        pdfjsPromise = (async () => {
            const pdfjs = await import('pdfjs-dist')
            // Worker served from /public (copied from pdfjs-dist, version-pinned). Bundling the worker
            // via `new URL(...import.meta.url)` makes webpack choke on the minified module, so we load
            // it as a static asset instead.
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
            return pdfjs
        })()
    }
    return pdfjsPromise
}

export async function extractReglementClient(url: string): Promise<ClientReglement> {
    try {
        const pdfjs = await getPdfjs()
        const buf = await (await fetch(url)).arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise

        // 1) Try text extraction.
        let text = ''
        const textPages = Math.min(pdf.numPages, 500)
        for (let i = 1; i <= textPages; i++) {
            const page = await pdf.getPage(i)
            const tc = await page.getTextContent()
            text += tc.items.map((it: any) => (typeof it?.str === 'string' ? it.str : '')).join(' ') + '\n'
            if (text.length > MAX_TEXT_CHARS) break
        }
        if (text.trim().length >= MIN_TEXT_CHARS) {
            return { text: text.slice(0, MAX_TEXT_CHARS) }
        }

        // 2) Scanned / image-only → render the first pages to JPEG data URLs for vision-OCR.
        const images: string[] = []
        const n = Math.min(pdf.numPages, MAX_OCR_PAGES)
        for (let i = 1; i <= n; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: OCR_SCALE })
            const canvas = document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            const ctx = canvas.getContext('2d')
            if (!ctx) continue
            await page.render({ canvasContext: ctx, viewport }).promise
            images.push(canvas.toDataURL('image/jpeg', 0.7))
        }
        return images.length ? { images } : { error: 'PDF illisible (ni texte ni image exploitable).' }
    } catch (e: any) {
        return { error: e?.message || 'Lecture du PDF impossible.' }
    }
}
