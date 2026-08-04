// Rend en PNG les pages dont le texte contient un motif — pour aller droit à la planche
// qu'on veut inspecter sans rasteriser un dossier de 15 pages.
//   node scripts/tmp/find-page.mjs <pdf> <regex> <outDir> [scale]
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

const input = process.argv[2]
const pattern = new RegExp(process.argv[3] || '.', 'i')
const outDir = process.argv[4] || 'scripts/tmp/render'
const scale = Number(process.argv[5] || 1.6)
await mkdir(outDir, { recursive: true })

const data = new Uint8Array(await readFile(input))
const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise
const base = path.basename(input, '.pdf')
let hits = 0
for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const text = (await page.getTextContent()).items.map(t => t.str).join(' ')
    if (!pattern.test(text)) continue
    hits++
    const vp = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
    const out = path.join(outDir, `${base}-p${String(i).padStart(2, '0')}.png`)
    await writeFile(out, canvas.toBuffer('image/png'))
    console.log(`p${i}: ${out}`)
}
console.log(`${hits}/${doc.numPages} page(s) correspondantes`)
