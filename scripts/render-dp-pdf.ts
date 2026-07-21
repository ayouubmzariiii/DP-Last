// Generate a real dossier PDF (server code path) and rasterise its pages so we can
// eyeball the DP3 page with the embedded coupe.
//   npx tsx -r dotenv/config scripts/render-dp-pdf.ts <dossierId> dotenv_config_path=.env.local
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { createCanvas } from '@napi-rs/canvas'
import { db, dossiers } from '../src/lib/db'
import { generateDPDocument } from '../src/lib/dpDocGenerator'

class NodeCanvasFactory {
    create(w: number, h: number) { const canvas = createCanvas(w, h); return { canvas, context: canvas.getContext('2d') } }
    reset(cc: any, w: number, h: number) { cc.canvas.width = w; cc.canvas.height = h }
    destroy(cc: any) { cc.canvas.width = 0; cc.canvas.height = 0 }
}

const id = process.argv[2]
const outDir = process.env.OUT_DIR || '.'

async function main() {
    const [row] = await db.select({ data: dossiers.data, title: dossiers.title }).from(dossiers).where(eq(dossiers.id, id))
    if (!row) { console.error('dossier not found'); process.exit(1) }
    console.log('dossier:', row.title, '· travaux:', (row.data as any)?.travaux?.type, '· dp3_coupe:', !!(row.data as any)?.plans?.dp3_coupe)

    const bytes = await generateDPDocument(row.data as any, { dossierId: id })
    const pdfPath = path.join(outDir, 'dossier.pdf')
    writeFileSync(pdfPath, Buffer.from(bytes))
    console.log('PDF written:', pdfPath, bytes.length, 'bytes')

    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), useSystemFonts: true, disableWorker: true, canvasFactory: new NodeCanvasFactory() }).promise
    console.log('pages:', doc.numPages)
    for (const n of [2, 3, 4]) {
        if (n > doc.numPages) continue
        const page = await doc.getPage(n)
        const vp = page.getViewport({ scale: 2 })
        const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
        const ctx = canvas.getContext('2d') as any
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        const f = path.join(outDir, `pdf-page-${n}.png`)
        writeFileSync(f, canvas.toBuffer('image/png'))
        console.log('page', n, '→', f)
    }
    process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
