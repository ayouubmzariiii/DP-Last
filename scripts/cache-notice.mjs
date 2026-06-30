// Regenerate ONLY the cached DP4 notice (no image calls) and update the committed cache.
import { writeFile } from 'node:fs/promises'
const BASE = 'http://localhost:3000'
const payload = {
  formData: {
    demandeur: { est_societe: false },
    terrain: {
      commune: 'Vienne', code_postal: '38200',
      description_projet: "Remplacement des menuiseries extérieures (fenêtres et porte d'entrée) en aluminium gris anthracite (RAL 7016), sans modification des dimensions ni des proportions des baies existantes. Immeuble situé dans le secteur sauvegardé (SPR) du centre ancien de Vienne.",
    },
    travaux: { type: 'menuiseries' },
  },
  photos: [],
}
const res = await fetch(`${BASE}/api/generate-dp4`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
if (!res.ok) { console.error('failed', res.status, (await res.text()).slice(0, 300)); process.exit(1) }
const { dp4 } = await res.json()
if (!dp4 || dp4.length < 150) { console.error('notice too short:', JSON.stringify(dp4)); process.exit(1) }
await writeFile('public/test/cache/dp4-notice.txt', dp4, 'utf8')
const ts = `// AUTO-GENERATED cached DP4 notice for test mode. Regenerate via\n// GET /api/dev/test-dossier?doc=dp&fresh=1&cache=1\nexport const TEST_DP4_NOTICE = ${JSON.stringify(dp4)}\n`
await writeFile('src/lib/testCache.ts', ts, 'utf8')
console.log('OK notice', dp4.length, 'chars')
console.log(dp4.slice(0, 500))
