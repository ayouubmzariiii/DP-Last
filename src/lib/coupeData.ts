// ─────────────────────────────────────────────────────────────────────────────
// DP3 data assembly — turns a dossier (coords + cadastre + travaux) into a
// ready-to-draw plan de coupe, using REAL IGN data:
//   • terrain naturel  ← Géoplateforme altimetry (RGE ALTI, elevationLine)
//   • parcel width + existing house ← cadastre + BD TOPO WFS (same as DP2)
//   • project section  ← parametric, from the Étape 3 travaux sub-form
//
// Runs in the browser (Étape 6) and on the server (PDF) — only global fetch.
// The cut line A→A′ is East→West through the parcel centre (matches the DP2
// north-up map, where A–A′ reads left→right).
// ─────────────────────────────────────────────────────────────────────────────
import type { DPFormData } from './models'
import { buildPlanCoupeSvg, smoothProfile, type CoupeProfilePoint, type PlanCoupeProject } from './planCoupe'
import { getTravauxDef } from './travauxRegistry'

const R = 6378137
const merX = (lon: number) => R * lon * Math.PI / 180
const lonOf = (x: number) => x * 180 / (R * Math.PI)

interface Coords { lat: number; lon: number }

async function fetchElevation(latC: number, lonW: number, lonE: number, samples: number): Promise<CoupeProfilePoint[]> {
    const url = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json'
        + `?lon=${lonW}|${lonE}&lat=${latC}|${latC}&resource=ign_rge_alti_wld&sampling=${samples}&delimiter=|`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`elevationLine HTTP ${res.status}`)
    const data = await res.json()
    const pts: { z: number }[] = data?.elevations || []
    if (pts.length < 2) throw new Error('no elevation points')
    const L = (lonE - lonW) * 111320 * Math.cos(latC * Math.PI / 180)
    return pts.map((p, i) => ({ d: (i / (pts.length - 1)) * L, z: p.z }))
}

async function fetchGeo(latC: number, lonC: number) {
    const cx = merX(lonC), cy = R * Math.log(Math.tan(Math.PI / 4 + (latC * Math.PI / 180) / 2))
    const half = 90
    const bbox = [cx - half, cy - half, cx + half, cy + half].map(v => v.toFixed(2)).join(',')
    const base = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857'
    const [cad, bati] = await Promise.all([
        fetch(`${base}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox},EPSG:3857`).then(r => r.json()).catch(() => null),
        fetch(`${base}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bbox},EPSG:3857`).then(r => r.json()).catch(() => null),
    ])
    return { cad, bati }
}

const ringsOf = (f: any): number[][][] => {
    const t = f?.geometry?.type
    if (t === 'Polygon') return f.geometry.coordinates
    if (t === 'MultiPolygon') return f.geometry.coordinates.flat(1)
    return []
}
const xRange = (f: any) => {
    let mn = Infinity, mx = -Infinity, ymn = Infinity, ymx = -Infinity
    for (const ring of ringsOf(f)) for (const c of ring) { if (c[0] < mn) mn = c[0]; if (c[0] > mx) mx = c[0]; if (c[1] < ymn) ymn = c[1]; if (c[1] > ymx) ymx = c[1] }
    return { mn, mx, ymn, ymx }
}
const num = (v?: string, d = 0) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : d }

export interface CoupeResult { svg: string; spanM: number }

/** Build the DP3 plan de coupe SVG for the current dossier. Returns null if the
 *  works type doesn't require a coupe or the location is unknown. */
export async function generateCoupeSvg(data: DPFormData, opts: { cartoucheRef?: string; date?: string } = {}): Promise<CoupeResult | null> {
    const def = getTravauxDef(data.travaux.type)
    if (!def?.requiresDP3) return null
    const coords: Coords | undefined = data.terrain.meme_adresse ? data.demandeur?.coords : data.terrain.coords
    if (!coords) return null

    // Cut line: 30 m E→W through the centre (A = west, A′ = east).
    const halfL = 15
    const dLon = halfL / (111320 * Math.cos(coords.lat * Math.PI / 180))
    const lonW = coords.lon - dLon, lonE = coords.lon + dLon
    const L = 30

    const [profileRaw, geo] = await Promise.all([
        fetchElevation(coords.lat, lonW, lonE, 40),
        fetchGeo(coords.lat, coords.lon).catch(() => null),
    ])
    const profile = smoothProfile(profileRaw)

    // Distance from A (west) for a given mercator-X.
    const dOf = (x: number) => (lonOf(x) - lonW) * 111320 * Math.cos(coords.lat * Math.PI / 180)

    // Target parcel (by section+numéro, else the one containing the centre) → its width along the cut.
    let parcelStartD: number | undefined, parcelEndD: number | undefined
    const cx = merX(coords.lon), cy = R * Math.log(Math.tan(Math.PI / 4 + (coords.lat * Math.PI / 180) / 2))
    const normSec = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '')
    const normNum = (n: any) => String(parseInt(String(n || '').replace(/[^0-9]/g, ''), 10) || '')
    const feats: any[] = geo?.cad?.features || []
    let target: any = feats.find(f => normSec(f.properties?.section) === normSec(data.terrain.section_cadastrale) && normNum(f.properties?.numero) === normNum(data.terrain.numero_parcelle))
    if (!target && feats.length) {
        // nearest by centroid
        let best = Infinity
        for (const f of feats) { const r = xRange(f); const fx = (r.mn + r.mx) / 2, fy = (r.ymn + r.ymx) / 2; const dd = (fx - cx) ** 2 + (fy - cy) ** 2; if (dd < best) { best = dd; target = f } }
    }
    if (target) { const r = xRange(target); parcelStartD = Math.max(0, dOf(r.mn)); parcelEndD = Math.min(L, dOf(r.mx)) }

    // Existing house = largest BD TOPO footprint whose centroid is inside the target parcel.
    let house: { startD: number; widthM: number } | undefined
    if (target) {
        const tr = xRange(target)
        let bestA = 0
        for (const b of (geo?.bati?.features || [])) {
            const r = xRange(b); const bcx = (r.mn + r.mx) / 2, bcy = (r.ymn + r.ymx) / 2
            if (bcx < tr.mn || bcx > tr.mx || bcy < tr.ymn || bcy > tr.ymx) continue
            const a = (r.mx - r.mn) * (r.ymx - r.ymn)
            if (a > bestA) { bestA = a; house = { startD: Math.max(0, dOf(r.mn)), widthM: Math.max(2, dOf(r.mx) - dOf(r.mn)) } }
        }
    }

    const t = data.travaux
    const centre = ((parcelStartD ?? 8) + (parcelEndD ?? 22)) / 2
    const existing = house ? { startD: house.startD, widthM: house.widthM, heightEgoutM: 2.7, heightFaitageM: 5.4 } : undefined

    let project: PlanCoupeProject
    const anns: string[] = []
    if (t.type === 'piscine') {
        const p = t.piscine!
        const w = num(p.longueur, 8)
        const recul = num(p.recul_maison, 3)
        const ps = parcelStartD ?? 4, pe = parcelEndD ?? (L - 4)
        // Place the bassin in the parcel's clearest span relative to the house. If the cut is fully
        // built-up (dense urban parcel), don't draw the house at all — a false overlap reads worse.
        let startD: number, useExisting = existing
        if (house) {
            const gapLeft = house.startD - ps, gapRight = pe - (house.startD + house.widthM)
            if (gapRight >= w + 0.8) startD = Math.min(pe - w - 0.3, house.startD + house.widthM + recul)
            else if (gapLeft >= w + 0.8) startD = Math.max(ps + 0.3, house.startD - recul - w)
            else { startD = (ps + pe) / 2 - w / 2; useExisting = undefined }  // no room beside the house on this cut
        } else {
            startD = (ps + pe) / 2 - w / 2
        }
        project = { kind: 'piscine', startD, widthM: w, depthM: num(p.profondeur, 1.5), margelleM: num(p.hauteur_margelle, 0.05), existing: useExisting }
        anns.push(`Bassin : ${p.longueur || '?'} × ${p.largeur || '?'} m`, `Profondeur : ${p.profondeur || '?'} m`)
        if (p.recul_maison && useExisting) anns.push(`Recul / maison : ${p.recul_maison} m`)
        const a = num(p.longueur) * num(p.largeur); if (a) anns.push(`Surface bassin : ${a.toFixed(0)} m²`)
    } else if (t.type === 'extension' || t.type === 'abri') {
        const e = (t.type === 'extension' ? t.extension : t.abri)!
        const w = num(e.largeur, 4)
        const onLeft = t.type === 'extension' && t.extension?.cote_adossement === 'droite' ? false : true
        const startD = house ? (onLeft ? house.startD + house.widthM + 0.05 : house.startD - w - 0.05) : centre - w / 2
        project = {
            kind: t.type, startD, widthM: w,
            heightEgoutM: num(e.hauteur_egout, 2.5), heightFaitageM: num(e.hauteur_faitage, 3.5),
            roof: (e.type_toit || 'double') as any, existing,
        }
        anns.push(`Emprise : ${e.largeur || '?'} × ${e.profondeur || '?'} m`, `Égout ${e.hauteur_egout || '?'} m · Faîtage ${e.hauteur_faitage || '?'} m`)
        const a = num(e.largeur) * num(e.profondeur); if (a) anns.push(`Surface créée : ${a.toFixed(0)} m²`)
    } else {
        const tr = t.terrassement!
        const w = num(tr.longueur, 10)
        const dz = (tr.type_mouvement === 'remblai' ? 1 : -1) * num(tr.hauteur, 1)
        project = { kind: 'terrassement', startD: centre - w / 2, widthM: w, deltaZM: dz }
        anns.push(`${tr.type_mouvement === 'remblai' ? 'Remblai' : 'Déblai'} : ${tr.hauteur || '?'} m`)
        if (tr.mur_soutenement) anns.push(`Mur de soutènement : ${tr.hauteur_mur || tr.hauteur || '?'} m`)
    }

    const svg = buildPlanCoupeSvg({
        profile, project, parcelStartD, parcelEndD,
        parcelStartKind: 'sep', parcelEndKind: 'voie',
        worksLabel: def.worksLabel(data),
        cartouche: { piece: 'DP3 · Plan de coupe A–A′', project: def.natureLabel, ref: opts.cartoucheRef, date: opts.date, scale: '1/100' },
        annotations: anns,
    })
    return { svg, spanM: L }
}
