import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Resolve the cadastral parcel that CONTAINS a point (lat/lon), using IGN's authoritative
 * apicarto cadastre service. Unlike a nearest-centroid guess, this is a real point-in-polygon
 * lookup on the Plan Cadastral Informatisé, so the reference it returns is the exact parcel at
 * the address. Used to pre-fill the références cadastrales in Étape 2.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '')
    const lon = parseFloat(searchParams.get('lon') || '')

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
    }

    try {
        const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))
        const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`
        const res = await fetch(url, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' } })
        if (!res.ok) return NextResponse.json({ error: 'cadastre lookup failed' }, { status: 502 })

        const data = await res.json()
        const p = data?.features?.[0]?.properties
        if (!p) return NextResponse.json({ error: 'no parcel at this location' }, { status: 404 })

        return NextResponse.json({
            // `com_abs` is the cadastral préfixe (3-digit, "000" for most communes).
            prefixe: p.com_abs || '000',
            section: p.section || '',
            numero: p.numero || '',
            // Official surface of the parcel (m²) — authoritative superficie du terrain.
            contenance: typeof p.contenance === 'number' ? p.contenance : null,
            commune: p.nom_com || '',
            insee: p.code_insee || '',
            idu: p.idu || '',
        })
    } catch (e: any) {
        console.error('[cadastre] lookup error:', e?.message)
        return NextResponse.json({ error: 'internal error' }, { status: 500 })
    }
}
