// Generate DP3 plans de coupe from LIVE IGN RGE ALTI elevations, to eyeball the output.
//   npx tsx scripts/test-plancoupe.ts [lat] [lon]
// Writes piscine + extension variants (override dir with OUT_DIR).
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildPlanCoupeSvg, smoothProfile, type CoupeProfilePoint } from '../src/lib/planCoupe'

const lat = parseFloat(process.argv[2] || '44.89084')
const lon = parseFloat(process.argv[3] || '1.21553')
const LINE_M = 30            // cut line length A → A′ (m), W → E through the parcel
const SAMPLES = 40

/** IGN Géoplateforme altimetry — elevation profile between two points (RGE ALTI). */
async function fetchProfile(): Promise<CoupeProfilePoint[]> {
    const dLon = (LINE_M / 2) / (111320 * Math.cos(lat * Math.PI / 180))
    const a = { lat, lon: lon - dLon }, b = { lat, lon: lon + dLon }
    const url = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json'
        + `?lon=${a.lon}|${b.lon}&lat=${a.lat}|${b.lat}`
        + `&resource=ign_rge_alti_wld&sampling=${SAMPLES}&delimiter=|`
    const res = await fetch(url, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' } })
    if (!res.ok) throw new Error(`elevationLine HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    const pts: { lon: number; lat: number; z: number }[] = data?.elevations || []
    if (!pts.length) throw new Error('elevationLine returned no points: ' + JSON.stringify(data).slice(0, 200))
    // Cumulative ground distance from A (haversine).
    const R = 6371000, rad = Math.PI / 180
    let dist = 0
    return pts.map((p, i) => {
        if (i > 0) {
            const q = pts[i - 1]
            const dφ = (p.lat - q.lat) * rad, dλ = (p.lon - q.lon) * rad
            const h = Math.sin(dφ / 2) ** 2 + Math.cos(q.lat * rad) * Math.cos(p.lat * rad) * Math.sin(dλ / 2) ** 2
            dist += 2 * R * Math.asin(Math.sqrt(h))
        }
        return { d: dist, z: p.z }
    })
}

async function main() {
    const profile = smoothProfile(await fetchProfile())
    const zs = profile.map(p => p.z)
    console.log(`profile: ${profile.length} pts over ${profile[profile.length - 1].d.toFixed(1)} m — z ${Math.min(...zs).toFixed(2)} → ${Math.max(...zs).toFixed(2)} m NGF`)

    const outDir = process.env.OUT_DIR || '.'
    // Parcel ≈ 17.7 m wide → limites at ~6.2 and ~23.9 m along the 30 m line.
    const parcelStartD = 6.2, parcelEndD = 23.9

    const piscine = buildPlanCoupeSvg({
        profile, parcelStartD, parcelEndD,
        project: { kind: 'piscine', startD: 12.5, widthM: 8, depthM: 1.5, margelleM: 0.05 },
        worksLabel: 'Piscine enterrée 8 × 4 m',
        annotations: ['Bassin : 8,00 × 4,00 m', 'Profondeur : 1,50 m', 'Margelle : +0,05 m / TN', 'Surface bassin : 32 m²'],
    })
    writeFileSync(path.join(outDir, 'plancoupe-piscine.svg'), piscine)
    console.log(`OK — plancoupe-piscine.svg (${piscine.length} bytes)`)

    const extension = buildPlanCoupeSvg({
        profile, parcelStartD, parcelEndD,
        project: {
            kind: 'extension', startD: 16.5, widthM: 4.2, roof: 'mono',
            heightEgoutM: 2.6, heightFaitageM: 4.1,
            existing: { startD: 8.5, widthM: 8, heightEgoutM: 5.4, heightFaitageM: 7.8 },
        },
        worksLabel: 'Extension 4,2 m — toit mono-pente',
        annotations: ['Extension : 4,20 × 5,00 m', 'Égout : 2,60 m — Faîtage : 4,10 m', 'Surface créée : 21 m²', 'Adossée au pignon Est'],
    })
    writeFileSync(path.join(outDir, 'plancoupe-extension.svg'), extension)
    console.log(`OK — plancoupe-extension.svg (${extension.length} bytes)`)
}
main().catch(e => { console.error(e.message); process.exit(1) })
