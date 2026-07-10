'use client'

import { useEffect, useRef, useState } from 'react'

export interface PickedParcel {
    prefixe: string
    section: string
    numero: string
    contenance: number | null
}

interface ParcelPickerProps {
    coords: { lat: number; lon: number }
    /** Currently selected reference (to highlight it). */
    selected?: { section?: string; numero?: string }
    onSelect: (p: PickedParcel) => void
}

const normSec = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '')
const normNum = (n: any) => String(parseInt(String(n || '').replace(/[^0-9]/g, ''), 10) || '')

// Web-Mercator forward projection (EPSG:3857), matching IGN WFS output.
const R = 6378137
const mx = (lon: number) => R * lon * Math.PI / 180
const my = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))

const ringsOf = (f: any): number[][][] => {
    const t = f.geometry?.type
    if (t === 'Polygon') return f.geometry.coordinates
    if (t === 'MultiPolygon') return f.geometry.coordinates.flat(1)
    return []
}

export default function ParcelPicker({ coords, selected, onSelect }: ParcelPickerProps) {
    const [parcels, setParcels] = useState<any[]>([])
    const [bati, setBati] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const reqRef = useRef(0)

    useEffect(() => {
        if (!coords) return
        const seq = ++reqRef.current
        setLoading(true); setError(false)
        const px = mx(coords.lon), py = my(coords.lat)
        const h = 90 // ~125 m box
        const bbox = [px - h, py - h, px + h, py + h].map(v => v.toFixed(2)).join(',')
        const base = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857'
        Promise.all([
            fetch(`${base}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox},EPSG:3857&COUNT=80`).then(r => r.json()).catch(() => null),
            fetch(`${base}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bbox},EPSG:3857&COUNT=120`).then(r => r.json()).catch(() => null),
        ]).then(([cad, bat]) => {
            if (seq !== reqRef.current) return
            const feats = cad?.features || []
            if (!feats.length) setError(true)
            setParcels(feats)
            setBati(bat?.features || [])
        }).finally(() => { if (seq === reqRef.current) setLoading(false) })
    }, [coords?.lat, coords?.lon])

    const VW = 640, VH = 460
    const px = mx(coords.lon), py = my(coords.lat)

    // Frame: centre on the point, span sized to comfortably show the local block. Equal x/y scale
    // (no distortion) with letterbox offsets so the address point sits dead-centre.
    const half = 70 // mercator units (~95 m ground at 46°N)
    const vMinX = px - half, vMaxX = px + half, vMinY = py - half, vMaxY = py + half
    const scale = Math.min(VW / (vMaxX - vMinX), VH / (vMaxY - vMinY))
    const offX = (VW - (vMaxX - vMinX) * scale) / 2
    const offY = (VH - (vMaxY - vMinY) * scale) / 2
    const toSvg = (gx: number, gy: number) => ({ x: offX + (gx - vMinX) * scale, y: VH - (offY + (gy - vMinY) * scale) })
    const toPath = (rings: number[][][]) => {
        let d = ''
        for (const ring of rings) {
            if (!ring || ring.length < 3) continue
            ring.forEach((c, i) => { const p = toSvg(c[0], c[1]); d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
            d += ' Z'
        }
        return d
    }

    const wantSec = normSec(selected?.section), wantNum = normNum(selected?.numero)
    const isSelected = (f: any) => wantSec && wantNum && normSec(f.properties?.section) === wantSec && normNum(f.properties?.numero) === wantNum

    const pick = (f: any) => {
        const p = f.properties || {}
        onSelect({
            prefixe: p.com_abs || '000',
            section: p.section || '',
            numero: p.numero || '',
            contenance: typeof p.contenance === 'number' ? p.contenance : null,
        })
    }

    const pt = toSvg(px, py)

    return (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--ac)' }}><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <span className="text-xs font-semibold t-ink">Vérifiez votre parcelle</span>
                <span className="text-[11px] t-muted ml-auto">Cliquez sur la parcelle concernée par les travaux</span>
            </div>

            <div className="relative bg-[#eceae4]" style={{ aspectRatio: `${VW}/${VH}` }}>
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="dp-spinner dp-spinner-lg" />
                        <p className="text-xs t-muted">Chargement du cadastre…</p>
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                        <p className="text-xs t-ink2 max-w-[240px]">Parcelle cadastrale indisponible à cette adresse. Vous pouvez saisir la référence manuellement ci-dessous.</p>
                    </div>
                ) : (
                    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full">
                        {/* Buildings (context, non-interactive) */}
                        {bati.map((f, i) => {
                            const d = toPath(ringsOf(f)); if (!d) return null
                            return <path key={`b${i}`} d={d} fill="#c8c4bb" stroke="#a8a49b" strokeWidth={0.5} pointerEvents="none" />
                        })}
                        {/* Parcels (clickable) */}
                        {parcels.map((f, i) => {
                            const d = toPath(ringsOf(f)); if (!d) return null
                            const sel = isSelected(f)
                            return (
                                <path
                                    key={`p${i}`}
                                    d={d}
                                    className="parcel-hit"
                                    fill={sel ? 'rgba(45,90,76,0.32)' : 'rgba(255,255,255,0.35)'}
                                    stroke={sel ? '#2D5A4C' : '#9a968d'}
                                    strokeWidth={sel ? 2.2 : 0.8}
                                    style={{ cursor: 'pointer', transition: 'fill .12s' }}
                                    onClick={() => pick(f)}
                                >
                                    <title>{`Parcelle ${f.properties?.section || ''} ${f.properties?.numero || ''} — ${f.properties?.contenance ?? '?'} m²`}</title>
                                </path>
                            )
                        })}
                        {/* Parcel labels (drawn after so they sit on top) */}
                        {parcels.map((f, i) => {
                            const ring = ringsOf(f)[0]; if (!ring || ring.length < 3) return null
                            let cx = 0, cy = 0; for (const c of ring) { cx += c[0]; cy += c[1] }
                            cx /= ring.length; cy /= ring.length
                            const p = toSvg(cx, cy)
                            if (p.x < 6 || p.x > VW - 6 || p.y < 6 || p.y > VH - 6) return null
                            const sel = isSelected(f)
                            return (
                                <text key={`t${i}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                                    fontSize={sel ? 11 : 9} fontWeight={sel ? 700 : 500}
                                    fill={sel ? '#1e3d33' : '#5f5b52'} pointerEvents="none">
                                    {`${f.properties?.section || ''} ${f.properties?.numero || ''}`}
                                </text>
                            )
                        })}
                        {/* Geocoded address point */}
                        <g pointerEvents="none">
                            <circle cx={pt.x} cy={pt.y} r={6} fill="none" stroke="#c0392b" strokeWidth={1.4} />
                            <circle cx={pt.x} cy={pt.y} r={2.2} fill="#c0392b" />
                        </g>
                    </svg>
                )}
            </div>

            <div className="flex items-center gap-4 px-3 py-2 text-[11px] t-muted" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--line)' }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(45,90,76,0.32)', border: '1.5px solid #2D5A4C' }} /> Parcelle sélectionnée</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ border: '1.4px solid #c0392b' }} /> Adresse</span>
                <span className="ml-auto">Source : IGN · Cadastre / BD TOPO</span>
            </div>
        </div>
    )
}
