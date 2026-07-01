// Regenerate the cached DP5 croquis PNGs as CLEAN, TEXT-FREE architectural elevations.
// The works label is drawn afterwards as pdf-lib vector text in dpDocGenerator.ts, so the
// image model must render no text at all. Requires the dev server running (uses its
// /api/generate-after-facade route + configured image model).
//
//   node scripts/regen-croquis.mjs
//   BASE=http://localhost:3001 node scripts/regen-croquis.mjs
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const BASE = process.env.BASE || 'http://localhost:3000'

// MUST stay in sync with buildAICroquisPrompt() in src/lib/aiImageGenerator.ts (now fully static).
const CROQUIS_PROMPT = `Convert the attached photograph of a French house into a clean, professional 2D ARCHITECTURAL FAÇADE ELEVATION drawing (un plan de façade). Reproduce the exact same building — same number of floors, windows, doors, roof shape and proportions as in the photo.

FRAMING (must stay ALIGNED with the attached image):
- Keep the SAME composition, proportions and viewpoint as the attached photo so the drawing lines up with it one-to-one. Same relative position and size of every window, door, roof line and wall.
- Show the building head-on as a clean FRONTAL orthographic elevation. If the photo is slightly angled, gently straighten it to frontal WITHOUT changing the layout or proportions.
- Frame the COMPLETE façade, centred, with only a small even margin. Do NOT crop off any part of the building, and do NOT zoom out so far that it looks small/distant. Drop only the surrounding street/sky/neighbours, keeping the building at the same scale it has in the photo.
- Large and crisp enough that every window, door and material is clearly legible.

VISUAL STYLE (MANDATORY):
- Clean 2D technical CAD elevation (not a photo, not a loose sketch).
- Crisp, confident black outlines — clearly visible, consistent weight, slightly thicker on the building's outer contour.
- Muted architectural palette: walls light beige/warm grey, roof dark slate/charcoal, joinery in its real colour.
- Simple flat solid grey shadows at 45° for depth. No gradients, no blur.
- Solid pure-white background.
- Subtle material hatching (fine line grid for roof tiles, light texture for cladding).
- A discreet horizontal ground line under the building.

STRICTLY NO TEXT: the drawing must contain ZERO written characters — no labels, no annotations, no leader lines, no dimensions, no title block, no legend, no watermark, no scale text. A separate step adds the labels afterwards.
NO people, no cars, no trees, no photo background.`

const toBuffer = async (src) => {
    if (src.startsWith('data:')) return Buffer.from(src.slice(src.indexOf(',') + 1), 'base64')
    if (src.startsWith('http')) return Buffer.from(await (await fetch(src)).arrayBuffer())
    throw new Error('unexpected image src: ' + src.slice(0, 40))
}

async function regen(slug) {
    process.stdout.write(`→ croquis ${slug} … `)
    const res = await fetch(`${BASE}/api/generate-after-facade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: CROQUIS_PROMPT, imageBase64: `/test/cache/after-${slug}.jpg` }),
    })
    if (!res.ok) throw new Error(`${slug} failed ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const j = await res.json()
    const src = j.imageBase64 || j.imageUrl
    if (!src) throw new Error(`${slug}: no image returned`)
    const buf = await toBuffer(src)
    const out = path.join(process.cwd(), 'public', 'test', 'cache', `croquis-${slug}.png`)
    await writeFile(out, await sharp(buf).resize(1280, 960, { fit: 'inside' }).png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer())
    console.log(`saved ${path.basename(out)}`)
}

for (const slug of ['principale', 'laterale']) await regen(slug)
console.log('\nDone. Re-run: node scripts/gen-test-pdfs.mjs')
