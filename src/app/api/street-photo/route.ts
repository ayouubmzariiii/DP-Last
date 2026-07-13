import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/ignMaps'

export const runtime = 'nodejs'

// Panoramax — the open-data, IGN + OpenStreetMap-France alternative to Google Street View.
// Photos are Licence Ouverte (Etalab 2.0) / CC-BY-SA, so — unlike Google Street View — they may
// legally be reproduced in a printed administrative dossier, provided the source is credited.
// We hit the federated "xyz" instance, which aggregates the IGN instance covering France.
const PANORAMAX_API = 'https://api.panoramax.xyz/api'
const ATTRIBUTION = 'Panoramax — IGN / contributeurs · Licence Ouverte 2.0'

export interface StreetPhotoCandidate {
    id: string
    thumb: string          // ~500px preview for the picker
    full: string           // ~2048px, stored as the DP photo
    lat: number
    lon: number
    distanceM: number      // distance from the target point
    azimuth: number | null // camera heading (°), for context
    isPano: boolean        // 360° panorama — warps as a flat DP photo, so deprioritised
    date: string | null    // capture date, YYYY-MM-DD
    attribution: string
}

function metersToDeg(lat: number, meters: number) {
    const dLat = meters / 111_320
    const dLon = meters / (111_320 * Math.cos((lat * Math.PI) / 180))
    return { dLat, dLon }
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const R = 6_371_000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(bLat - aLat)
    const dLon = toRad(bLon - aLon)
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
}

// GET /api/street-photo?lat=..&lon=..  (preferred)  |  ?address=..&commune=..
// Returns street-level photos near the terrain, ranked flat-first then nearest. Never throws:
// on any failure it returns an empty list so the UI falls back silently to manual upload.
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    let lat = parseFloat(sp.get('lat') || '')
    let lon = parseFloat(sp.get('lon') || '')

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const address = sp.get('address') || ''
        const commune = sp.get('commune') || ''
        if (!address && !commune) return NextResponse.json({ candidates: [] })
        const coords = await geocodeAddress(address, commune)
        if (!coords) return NextResponse.json({ candidates: [] })
        lat = coords.lat
        lon = coords.lon
    }

    // ~60 m box around the point — a house's street frontage is well within this.
    const { dLat, dLon } = metersToDeg(lat, 60)
    const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map(n => n.toFixed(6)).join(',')

    try {
        const res = await fetch(`${PANORAMAX_API}/search?bbox=${bbox}&limit=50`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return NextResponse.json({ candidates: [], center: { lat, lon } })

        const data = await res.json()
        const feats: unknown[] = Array.isArray(data?.features) ? data.features : []

        const candidates: StreetPhotoCandidate[] = feats
            .map((raw): StreetPhotoCandidate | null => {
                const f = raw as Record<string, any>
                const p = f?.properties || {}
                const assets = f?.assets || {}
                const coords = f?.geometry?.coordinates || []
                const fLon = Number(coords[0])
                const fLat = Number(coords[1])
                const full = assets.sd?.href || assets.hd?.href || assets.thumb?.href
                const id = String(f?.id || '')
                if (!id || !full) return null
                const fov = typeof p['field_of_view'] === 'number' ? p['field_of_view'] : null
                return {
                    id,
                    thumb: assets.thumb?.href || assets.sd?.href || full,
                    full,
                    lat: fLat,
                    lon: fLon,
                    distanceM: (Number.isFinite(fLat) && Number.isFinite(fLon))
                        ? Math.round(haversineM(lat, lon, fLat, fLon))
                        : 99999,
                    azimuth: typeof p['view:azimuth'] === 'number' ? Math.round(p['view:azimuth']) : null,
                    isPano: fov != null ? fov >= 300 : false,
                    date: typeof p.datetime === 'string' ? p.datetime.slice(0, 10) : null,
                    attribution: ATTRIBUTION,
                }
            })
            .filter((c): c is StreetPhotoCandidate => c !== null)

        // Flat pictures first (a 360° pano looks distorted as a DP photo), then closest.
        candidates.sort((a, b) => (Number(a.isPano) - Number(b.isPano)) || (a.distanceM - b.distanceM))

        return NextResponse.json({ candidates: candidates.slice(0, 6), center: { lat, lon } })
    } catch (e) {
        console.error('[street-photo] Panoramax lookup failed:', e)
        return NextResponse.json({ candidates: [], center: { lat, lon } })
    }
}
