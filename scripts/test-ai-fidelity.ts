// ─────────────────────────────────────────────────────────────────────────────
// Contrôle de fidélité des simulations « après travaux » (DP6), nature par nature.
//
// Le prompt impose des invariants : ne pas changer la partition des fenêtres (vantaux,
// petits bois), ne pas supprimer les volets roulants, ne pas retoucher la clôture ni les
// plantations. Ces règles avaient été validées sur UN seul A/B — or la génération d'image
// est stochastique : une règle peut tenir sur une nature de travaux et lâcher sur une autre.
//
// Ce script rejoue la génération réelle (même route que le parcours) pour plusieurs natures
// et écrit, pour chacune, un montage AVANT | APRÈS à comparer à l'œil.
//
//   npx tsx scripts/test-ai-fidelity.ts <outDir> [nature ...]
//
// Prérequis : le serveur de dev tourne sur :3000 et AUTH_SECRET est chargé (.env.local).
// La route exige une session : on en signe une, comme le ferait le navigateur.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { config } from 'dotenv'
import { defaultFormData, DPFormData } from '../src/lib/models'
import { buildAIAfterImagePrompt } from '../src/lib/aiImageGenerator'

config({ path: '.env.local' })
config({ path: '.env' })

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const outDir = process.argv[2] || 'test-output/ai-fidelity'
const natures = process.argv.slice(3)
const TYPES = natures.length ? natures : ['menuiseries', 'ravalement', 'photovoltaique', 'cloture']

async function sessionCookie(): Promise<string> {
    const { COOKIE_NAME, createSessionToken } = await import('../src/lib/session')
    const token = await createSessionToken({ userId: 'dev-fidelity', email: 'dev@local', role: 'admin' } as any)
    return `${COOKIE_NAME}=${token}`
}

async function toBuffer(src: string): Promise<Buffer> {
    if (src.startsWith('data:')) return Buffer.from(src.slice(src.indexOf(',') + 1), 'base64')
    // Les photos de la fixture sont des chemins publics ("/test/…"), pas des URL absolues.
    const url = src.startsWith('http') ? src : `${BASE}${src}`
    return Buffer.from(await (await fetch(url)).arrayBuffer())
}

async function main() {
    await fs.mkdir(outDir, { recursive: true })
    const cookie = await sessionCookie()

    for (const type of TYPES) {
        const d = JSON.parse(JSON.stringify(defaultFormData)) as DPFormData
        d.travaux.type = type as DPFormData['travaux']['type']
        const facade = d.photos.facades.find(f => f.before)
        if (!facade?.before) { console.log(`${type}: pas de photo « avant » dans la fixture`); continue }

        const prompt = buildAIAfterImagePrompt(d)
        const t0 = Date.now()
        const res = await fetch(`${BASE}/api/generate-after-facade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({ prompt, imageBase64: facade.before }),
        })
        if (!res.ok) { console.log(`${type}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`); continue }
        const j = await res.json()
        const after = j.imageBase64 || j.imageUrl
        if (!after) { console.log(`${type}: aucune image renvoyée`); continue }

        // Montage AVANT | APRÈS, même hauteur : toute dérive de cadrage, de couleur ou de
        // partition saute aux yeux sur une comparaison côte à côte, pas sur deux fichiers.
        const H = 720
        const [b, a] = await Promise.all([
            sharp(await toBuffer(facade.before)).resize({ height: H }).toBuffer(),
            sharp(await toBuffer(after)).resize({ height: H }).toBuffer(),
        ])
        const [mb, ma] = await Promise.all([sharp(b).metadata(), sharp(a).metadata()])
        const W = (mb.width || 0) + (ma.width || 0) + 12
        const file = path.join(outDir, `${type}.jpg`)
        await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
            .composite([{ input: b, left: 0, top: 0 }, { input: a, left: (mb.width || 0) + 12, top: 0 }])
            .jpeg({ quality: 88 }).toFile(file)
        console.log(`${type}: ${file}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
    }
}

main().catch(e => { console.error(e); process.exit(1) })
