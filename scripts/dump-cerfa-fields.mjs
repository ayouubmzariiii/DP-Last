// Dev-only: dump every AcroForm field name (and type) from public/cerfa.pdf
// Usage: node scripts/dump-cerfa-fields.mjs
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const filePath = path.join(process.cwd(), 'public', 'cerfa.pdf')
const bytes = await readFile(filePath)
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
const form = doc.getForm()
const fields = form.getFields()

const rows = fields.map(f => ({ name: f.getName(), type: f.constructor.name }))
rows.sort((a, b) => a.name.localeCompare(b.name))

console.log(`Total fields: ${rows.length}`)
console.log(`Pages: ${doc.getPageCount()}`)
console.log('---')
for (const r of rows) {
    console.log(`${r.type.padEnd(16)} ${r.name}`)
}
