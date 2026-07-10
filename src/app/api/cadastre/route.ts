import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ParcelProps = {
    com_abs?: string; section?: string; numero?: string
    contenance?: number; nom_com?: string; code_insee?: string; idu?: string
}

function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(url, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' }, signal: controller.signal })
        .finally(() => clearTimeout(id))
}

function shape(p: ParcelProps) {
    return {
        // `com_abs` is the cadastral préfixe (3-digit, "000" for most communes).
        prefixe: p.com_abs || '000',
        section: p.section || '',
        numero: p.numero || '',
        // Official surface of the parcel (m²) — authoritative superficie du terrain.
        contenance: typeof p.contenance === 'number' ? p.contenance : null,
        commune: p.nom_com || '',
        insee: p.code_insee || '',
        idu: p.idu || '',
    }
}

// ── Primary: IGN apicarto point-in-polygon on the Plan Cadastral Informatisé ──────────────────────
async function viaApicarto(lat: number, lon: number): Promise<ParcelProps | null> {
    const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))
    const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`
    // apicarto is occasionally flaky (a cold call can return 0 features); retry once.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetchWithTimeout(url)
            if (res.ok) {
                const data = await res.json()
                const p = data?.features?.[0]?.properties
                if (p) return p
            }
        } catch { /* fall through to retry / WFS fallback */ }
    }
    return null
}

// ── Fallback: IGN WFS bbox + local point-in-polygon (robust when apicarto hiccups) ────────────────
async function viaWfs(lat: number, lon: number): Promise<ParcelProps | null> {
    const R = 6378137, d2r = Math.PI / 180
    const px = R * lon * d2r
    const py = R * Math.log(Math.tan(Math.PI / 4 + (lat * d2r) / 2))
    const h = 80 // ~110 m box: comfortably covers the parcel the point sits in
    const bbox = [px - h, py - h, px + h, py + h].map(v => v.toFixed(2)).join(',')
    const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox},EPSG:3857&COUNT=50`

    let feats: any[]
    try {
        const res = await fetchWithTimeout(url)
        if (!res.ok) return null
        const data = await res.json()
        feats = data?.features || []
    } catch { return null }
    if (!feats.length) return null

    const ringsOf = (f: any): number[][][] => {
        const t = f.geometry?.type
        if (t === 'Polygon') return f.geometry.coordinates
        if (t === 'MultiPolygon') return f.geometry.coordinates.flat(1)
        return []
    }
    const inRing = (x: number, y: number, r: number[][]) => {
        let inside = false
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
            const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside
        }
        return inside
    }

    // 1) The parcel that actually CONTAINS the point.
    for (const f of feats) {
        for (const ring of ringsOf(f)) {
            if (ring && ring.length > 2 && inRing(px, py, ring)) return f.properties
        }
    }
    // 2) Otherwise the nearest parcel by centroid (point fell on a road/boundary).
    let best: any = null, bestDist = Infinity
    for (const f of feats) {
        const ring = ringsOf(f)[0]
        if (!ring || !ring.length) continue
        let cx = 0, cy = 0
        for (const c of ring) { cx += c[0]; cy += c[1] }
        cx /= ring.length; cy /= ring.length
        const d = (cx - px) ** 2 + (cy - py) ** 2
        if (d < bestDist) { bestDist = d; best = f }
    }
    return best?.properties || null
}

/**
 * Resolve the cadastral parcel at a point (lat/lon) from IGN's authoritative cadastre. Tries the
 * apicarto point-in-polygon service first, then falls back to a WFS bbox + local point-in-polygon
 * so a transient apicarto failure never leaves the reference blank. Used to pre-fill Étape 2.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '')
    const lon = parseFloat(searchParams.get('lon') || '')

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
    }

    try {
        const props = (await viaApicarto(lat, lon)) || (await viaWfs(lat, lon))
        if (!props) return NextResponse.json({ error: 'no parcel at this location' }, { status: 404 })
        return NextResponse.json(shape(props))
    } catch (e: any) {
        console.error('[cadastre] lookup error:', e?.message)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}
