// Render each page of a PDF to PNG using pdfjs-dist + @napi-rs/canvas (both already deps).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const input = process.argv[2] || 'test-output/TEST_Dossier_DP.pdf'
const outDir = process.argv[3] || 'test-output/render'
const scale = Number(process.argv[4] || 1.4)
await mkdir(outDir, { recursive: true })

const data = new Uint8Array(await readFile(input))
const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise
const base = path.basename(input, '.pdf')
for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
    const out = path.join(outDir, `${base}-p${String(i).padStart(2, '0')}.png`)
    await writeFile(out, canvas.toBuffer('image/png'))
    console.log('wrote', out)
}
console.log('done', doc.numPages, 'pages')
