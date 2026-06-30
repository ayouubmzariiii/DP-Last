// Regenerate the test CERFA + DP dossier PDFs from the backend test harness and save them
// to ./test-output/ for instant inspection. Requires the dev server to be running.
//
//   node scripts/gen-test-pdfs.mjs            # CERFA + DP (fast, no AI pieces)
//   node scripts/gen-test-pdfs.mjs --ai       # also generate DP4 notice + a façade simulation/croquis
//   BASE=http://localhost:3001 node scripts/gen-test-pdfs.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:3000'
const ai = process.argv.includes('--ai')
const OUT = path.join(process.cwd(), 'test-output')

async function grab(doc, name) {
    const url = `${BASE}/api/dev/test-dossier?doc=${doc}&dl=1${ai && doc === 'dp' ? '&ai=1' : ''}`
    process.stdout.write(`→ ${doc}${ai && doc === 'dp' ? ' (with AI)' : ''} … `)
    const res = await fetch(url)
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`${doc} failed ${res.status}: ${t.slice(0, 300)}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const file = path.join(OUT, name)
    await writeFile(file, buf)
    console.log(`saved ${name} (${(buf.length / 1024).toFixed(0)} KB)`)
}

;(async () => {
    await mkdir(OUT, { recursive: true })
    await grab('cerfa', 'TEST_CERFA_13703.pdf')
    await grab('dp', 'TEST_Dossier_DP.pdf')
    console.log(`\nDone → ${OUT}`)
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
