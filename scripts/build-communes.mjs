// ─────────────────────────────────────────────────────────────────────────────
// Génère src/data/communes.json — le socle des pages SEO programmatiques
// /dp/[travaux]/[commune].
//
// Source : geo.api.gouv.fr (API publique, données INSEE). On ne garde que les N
// communes les plus peuplées : une page par village de 200 habitants serait du
// « thin content » que Google déclasse, et le volume de recherche y est nul.
//
//   node scripts/build-communes.mjs            # top 300 (défaut)
//   node scripts/build-communes.mjs --top=600
//
// À relancer une fois par an (recensement INSEE) — le fichier est committé, donc
// le build Next n'a jamais besoin du réseau.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/data/communes.json')

const TOP = Number((process.argv.find(a => a.startsWith('--top=')) || '--top=300').split('=')[1])

/** Slug URL : minuscules, accents retirés, séparateurs → tiret. */
function slugify(s) {
    return s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’]/g, '-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

async function json(url) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`)
    return r.json()
}

const [communes, departements, regions] = await Promise.all([
    json('https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,codeRegion,population,surface&format=json'),
    json('https://geo.api.gouv.fr/departements?fields=nom,code&format=json'),
    json('https://geo.api.gouv.fr/regions?fields=nom,code&format=json'),
])

const deptName = new Map(departements.map(d => [d.code, d.nom]))
const regionName = new Map(regions.map(r => [r.code, r.nom]))

const ranked = communes
    .filter(c => Number.isFinite(c.population) && c.population > 0)
    .sort((a, b) => b.population - a.population)
    .slice(0, TOP)

const rows = ranked.map(c => ({
    insee: c.code,
    nom: c.nom,
    slug: slugify(c.nom),
    cp: (c.codesPostaux || []).slice().sort()[0] || '',
    cps: (c.codesPostaux || []).length,
    dept: c.codeDepartement,
    deptNom: deptName.get(c.codeDepartement) || '',
    region: regionName.get(c.codeRegion) || '',
    population: c.population,
    // surface renvoyée en hectares → km² (2 décimales), utilisé pour la densité.
    surfaceKm2: c.surface ? Math.round((c.surface / 100) * 100) / 100 : null,
}))

// Garde-fou : deux communes homonymes dans le top N produiraient le même slug.
// L'URL portant l'INSEE en suffixe, il n'y a pas de collision d'URL — on le
// signale seulement pour que les libellés restent lisibles.
const bySlug = new Map()
for (const r of rows) bySlug.set(r.slug, [...(bySlug.get(r.slug) || []), r.insee])
const dupes = [...bySlug.entries()].filter(([, v]) => v.length > 1)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(rows, null, 0) + '\n', 'utf8')

console.log(`✓ ${rows.length} communes → src/data/communes.json`)
console.log(`  population min : ${rows[rows.length - 1].population.toLocaleString('fr-FR')} (${rows[rows.length - 1].nom})`)
console.log(`  départements couverts : ${new Set(rows.map(r => r.dept)).size}/101`)
if (dupes.length) console.log(`  homonymes (slug partagé, URL distincte par INSEE) : ${dupes.map(([s]) => s).join(', ')}`)
