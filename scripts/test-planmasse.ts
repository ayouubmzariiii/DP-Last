// Generate a plan de masse from LIVE IGN data for a real address, to eyeball the output.
//   npx tsx scripts/test-planmasse.ts "12 Rue des Chapeliers, Foix"
import { writeFileSync } from 'node:fs'
import { buildPlanMasseSvg } from '../src/lib/planMasse'

const CANDIDATES = process.argv[2]
    ? [process.argv[2]]
    : [
        '2 Rue de la Préfecture, 09000 Foix',
        '15 Avenue du Général de Gaulle, 24200 Sarlat-la-Canéda',
        '8 Rue Victor Hugo, 26000 Valence',
        '10 Rue de la République, 34000 Montpellier',
    ]

async function geocode(q: string) {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`)
    const d = await r.json()
    const f = d?.features?.[0]
    return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: f.properties?.label } : null
}

async function wfs(lat: number, lon: number) {
    const R = 6378137
    const cx = R * lon * Math.PI / 180
    const cy = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
    const half = 80
    const bbox = [cx - half, cy - half, cx + half, cy + half].map(v => v.toFixed(2)).join(',')
    const base = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857'
    const [cadastre, bati] = await Promise.all([
        fetch(`${base}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox},EPSG:3857`).then(r => r.json()).catch(() => null),
        fetch(`${base}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bbox},EPSG:3857`).then(r => r.json()).catch(() => null),
    ])
    return { cx, cy, cadastre, bati }
}

async function main() {
    for (const q of CANDIDATES) {
        const g = await geocode(q)
        if (!g) { console.log(`geocode failed: ${q}`); continue }
        const { cx, cy, cadastre, bati } = await wfs(g.lat, g.lon)
        const nCad = cadastre?.features?.length || 0
        const nBat = bati?.features?.length || 0
        console.log(`${g.label} → parcelles=${nCad} bâtiments=${nBat}`)
        if (nCad === 0 || nBat === 0) continue

        const svg = buildPlanMasseSvg({
            cadastre, bati, center: [cx, cy],
            worksLabel: 'Ravalement de façade sur rue',
            annotations: ['Terrain : 420 m²', 'Surface créée : 0 m²', 'Aspect : enduit ton pierre'],
        })
        const out = process.env.OUT || 'planmasse.svg'
        writeFileSync(out, svg)
        console.log(`OK — wrote ${out} (${svg.length} bytes) for "${g.label}"`)
        return
    }
    console.log('No candidate returned both parcels and buildings.')
}
main()
