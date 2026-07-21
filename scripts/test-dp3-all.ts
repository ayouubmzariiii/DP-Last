// End-to-end DP3 test for ALL FOUR terrain-modifying types, using the SAME code path
// as the app (generateCoupeSvg → live IGN RGE ALTI + cadastre/BD-TOPO). Writes one SVG
// per type. Pick a suburban parcel (detached house + garden) for clean, realistic output.
//   OUT_DIR=... npx tsx scripts/test-dp3-all.ts ["<address>"]
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { generateCoupeSvg } from '../src/lib/coupeData'

const CANDIDATES = process.argv[2] ? [process.argv[2]] : [
    '17 Avenue de Selves, 24200 Sarlat-la-Canéda',
    '3 Allée des Acacias, 24200 Sarlat-la-Canéda',
    '5 Rue Jean Jaurès, 24200 Sarlat-la-Canéda',
    '10 Rue de la République, 40100 Dax',
    '8 Rue des Écoles, 47000 Agen',
]

async function geocode(q: string) {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1&type=housenumber`)
    const d = await r.json(); const f = d?.features?.[0]
    return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: f.properties?.label } : null
}

const TYPES: Record<string, any> = {
    piscine: { piscine: { longueur: '9', largeur: '4', profondeur: '1.6', hauteur_margelle: '0.05', recul_maison: '3', local_technique: true, description: '' } },
    extension: { extension: { largeur: '4', profondeur: '5', hauteur_egout: '2.6', hauteur_faitage: '4.2', type_toit: 'mono', cote_adossement: 'gauche', materiau: 'Enduit ton pierre', couleur: '', description: '' } },
    abri: { abri: { largeur: '3', profondeur: '4', hauteur_egout: '2', hauteur_faitage: '2.6', type_toit: 'double', materiau: 'Bois', couleur: '', description: '' } },
    terrassement: { terrassement: { longueur: '12', type_mouvement: 'deblai', hauteur: '1.4', mur_soutenement: true, hauteur_mur: '1.4', description: '' } },
}

function buildData(coords: any, type: string) {
    return {
        demandeur: { coords }, terrain: { meme_adresse: true, coords, section_cadastrale: '', numero_parcelle: '' },
        travaux: { type, ...TYPES[type] },
    } as any
}

async function main() {
    let coords: any = null, label = ''
    for (const q of CANDIDATES) { const g = await geocode(q); if (g) { coords = { lat: g.lat, lon: g.lon }; label = g.label; break } }
    if (!coords) { console.error('geocode failed for all candidates'); process.exit(1) }
    console.log('Parcel:', label, coords)
    const outDir = process.env.OUT_DIR || '.'
    for (const type of Object.keys(TYPES)) {
        try {
            const res = await generateCoupeSvg(buildData(coords, type), { cartoucheRef: 'DP 024-TEST', date: '21/07/2026' })
            if (!res) { console.log(`${type.padEnd(12)} → NULL (not required / no coords)`); continue }
            const file = path.join(outDir, `dp3-${type}.svg`)
            writeFileSync(file, res.svg)
            const fond = (res.svg.match(/Fond du bassin : [\d.]+ m NGF/) || res.svg.match(/faîtage [\d.]+ m/) || res.svg.match(/Plateforme [\d.]+ m NGF/) || [''])[0]
            console.log(`${type.padEnd(12)} → dp3-${type}.svg (${res.svg.length} b)  ${fond}`)
        } catch (e: any) { console.log(`${type.padEnd(12)} → ERROR ${e.message}`) }
    }
}
main().catch(e => { console.error(e); process.exit(1) })
