'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'
import { generateAIAfterImage, generateAICroquis } from '@/lib/aiImageGenerator'

const MAX_IMG_SIZE = 1.5 * 1024 * 1024 // 1.5MB to save bandwidth for Nemotron


function MapCard({
    title, code, address, commune, color = 'blue'
}: {
    title: string; code: string; address: string; commune: string; color?: 'blue' | 'green'
}) {
    const [mapUrl, setMapUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!commune && !address) return
        setLoading(true)
        setError(false)

        const params = new URLSearchParams({ address, commune })
        fetch(`/api/preview-maps?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error)
                setMapUrl(code === 'DP1' ? data.dp1Url : data.dp2Url)
            })
            .catch(err => {
                console.error('Map loading error:', err)
                setError(true)
            })
            .finally(() => setLoading(false))
    }, [address, commune, code])

    const iconColor = color === 'green' ? '#4ade80' : '#60a5fa'
    const codeColor = color === 'green' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'

    return (
        <div className="dp-card overflow-hidden">
            <div className="flex items-center gap-3 mb-4 px-4 pt-4">
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center"
                    style={{ background: codeColor, color: iconColor }}>{code}</span>
                <h3 className="font-semibold text-white">{title}</h3>
                <span className="ml-auto text-[10px] px-2 py-1 rounded-md bg-white/5 text-slate-400 border border-white/10 uppercase tracking-widest">Aperçu IGN</span>
            </div>

            <div className="relative aspect-video bg-white flex items-center justify-center">
                {loading ? (
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Chargement de la carte IGN...</p>
                    </div>
                ) : mapUrl ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mapUrl} alt={title} className="w-full h-full object-cover" />
                        {/* Red Circle Indicator */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 border-2 border-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,1)]" />
                            </div>
                        </div>
                        {/* Attribution */}
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/40 backdrop-blur-sm rounded text-[8px] text-white/70 pointer-events-none">
                            IGN - Plan cadastral & Photo aérienne
                        </div>
                    </>
                ) : (
                    <div className="text-center p-6 grayscale opacity-40">
                        <div className="text-4xl mb-2">🗺️</div>
                        <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                            {error ? "Erreur de chargement des cartes IGN" : "Renseignez l'adresse pour générer les plans"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

/** DP2 vector plan card — fetches BD TOPO & Cadastre GeoJSON and renders as SVG */
function Dp2VectorCard({ address, commune, formData }: { address: string; commune: string; formData: any }) {
    const [geoData, setGeoData] = useState<{ cadastre: any; bati: any; center: number[] } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!commune && !address) return
        setLoading(true)
        setError(false)

        const q = encodeURIComponent(`${address} ${commune} France`)
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
            headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' }
        })
            .then(r => r.json())
            .then(async (nominatim) => {
                if (!nominatim || !nominatim[0]) throw new Error('Geocoding failed')
                const lat = parseFloat(nominatim[0].lat)
                const lon = parseFloat(nominatim[0].lon)

                const R = 6378137
                const cx = R * lon * Math.PI / 180
                const cy = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
                const half = 80 // 160m wide bbox — enough to get the target parcel + neighbors

                const bboxStr = [cx - half, cy - half, cx + half, cy + half].map(v => v.toFixed(2)).join(',')
                const base = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857`

                const [resCad, resBati] = await Promise.all([
                    fetch(`${base}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bboxStr},EPSG:3857`).then(r => r.json()).catch(() => null),
                    fetch(`${base}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bboxStr},EPSG:3857`).then(r => r.json()).catch(() => null)
                ])

                setGeoData({ cadastre: resCad, bati: resBati, center: [cx, cy] })
            })
            .catch(err => {
                console.error('DP2 vector load error:', err)
                setError(true)
            })
            .finally(() => setLoading(false))
    }, [address, commune])

    const renderMap = () => {
        if (!geoData || !geoData.cadastre) return null
        const [cx, cy] = geoData.center
        const VW = 640, VH = 360

        const getCoords = (feat: any) => {
            const t = feat.geometry?.type
            if (t === 'Polygon') return feat.geometry.coordinates
            if (t === 'MultiPolygon') return feat.geometry.coordinates.flat(1)
            return []
        }

        const fC = geoData.cadastre?.features || []

        // 1. Find target parcel
        let targetIdx = -1
        let minDist = Infinity
        for (let i = 0; i < fC.length; i++) {
            const rings = getCoords(fC[i])
            if (!rings || !rings[0]) continue
            const ring = rings[0] as number[][]
            let fx = 0, fy = 0
            for (const c of ring) { fx += c[0]; fy += c[1] }
            fx /= ring.length; fy /= ring.length
            const dist = Math.sqrt((fx - cx) ** 2 + (fy - cy) ** 2)
            if (dist < minDist) { minDist = dist; targetIdx = i }
        }

        // 2. Compute view bbox from target parcel bounds + 20m padding
        let viewMinX = cx - 60, viewMaxX = cx + 60, viewMinY = cy - 60, viewMaxY = cy + 60
        if (targetIdx >= 0) {
            const ring = getCoords(fC[targetIdx])[0] as number[][]
            if (ring) {
                const pad = 20
                let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity
                for (const c of ring) {
                    if (c[0] < pMinX) pMinX = c[0]
                    if (c[1] < pMinY) pMinY = c[1]
                    if (c[0] > pMaxX) pMaxX = c[0]
                    if (c[1] > pMaxY) pMaxY = c[1]
                }
                viewMinX = pMinX - pad; viewMaxX = pMaxX + pad
                viewMinY = pMinY - pad; viewMaxY = pMaxY + pad
            }
        }

        const srcW = viewMaxX - viewMinX, srcH = viewMaxY - viewMinY
        const scale = Math.min(VW / srcW, VH / srcH) * 0.96
        const offX = (VW - srcW * scale) / 2, offY = (VH - srcH * scale) / 2

        const toSvg = (gx: number, gy: number) => ({
            x: (gx - viewMinX) * scale + offX,
            y: VH - ((gy - viewMinY) * scale + offY)
        })

        const toPath = (rings: number[][][]) => {
            if (!rings) return ''
            let d = ''
            for (const ring of rings) {
                if (!ring || ring.length < 3) continue
                for (let i = 0; i < ring.length; i++) {
                    const p = toSvg(ring[i][0], ring[i][1])
                    d += (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                }
                d += ' Z'
            }
            return d
        }

        // ── Building bbox dimensions — only buildings ON the target parcel ────
        const fB = geoData.bati?.features || []

        // Compute target parcel bounding box in world coords for containment check
        let tpMinX = Infinity, tpMinY = Infinity, tpMaxX = -Infinity, tpMaxY = -Infinity
        if (targetIdx >= 0) {
            const tpRing = (getCoords(fC[targetIdx])[0] || []) as number[][]
            for (const c of tpRing) {
                if (c[0] < tpMinX) tpMinX = c[0]; if (c[0] > tpMaxX) tpMaxX = c[0]
                if (c[1] < tpMinY) tpMinY = c[1]; if (c[1] > tpMaxY) tpMaxY = c[1]
            }
        }

        const bldDimLines: JSX.Element[] = []
        fB.forEach((feat: any, bi: number) => {
            const rings = getCoords(feat)
            if (!rings || !rings[0]) return
            const ring = rings[0] as number[][]

            // Compute building bbox
            let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
            for (const c of ring) {
                if (c[0] < bMinX) bMinX = c[0]; if (c[0] > bMaxX) bMaxX = c[0]
                if (c[1] < bMinY) bMinY = c[1]; if (c[1] > bMaxY) bMaxY = c[1]
            }

            // Skip buildings whose centroid is outside the target parcel bbox
            if (targetIdx >= 0) {
                const bCx = (bMinX + bMaxX) / 2, bCy = (bMinY + bMaxY) / 2
                if (bCx < tpMinX || bCx > tpMaxX || bCy < tpMinY || bCy > tpMaxY) return
            }

            const wM = bMaxX - bMinX
            const hM = bMaxY - bMinY
            if (wM < 1 && hM < 1) return

            // Project bbox corners to SVG
            const tl = toSvg(bMinX, bMaxY)
            const tr = toSvg(bMaxX, bMaxY)
            const bl = toSvg(bMinX, bMinY)
            const br = toSvg(bMaxX, bMinY)

            const svgW = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2)
            const svgH = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2)
            if (svgW < 8 && svgH < 8) return

            // Width dimension — below the building
            const wlabel = `${wM.toFixed(1)} m`
            const wmx = (bl.x + br.x) / 2, wmy = (bl.y + br.y) / 2 + 9
            if (svgW >= 8) bldDimLines.push(
                <g key={`w${bi}`}>
                    <line x1={bl.x} y1={bl.y + 8} x2={br.x} y2={br.y + 8} stroke="#222" strokeWidth={0.9} />
                    <line x1={bl.x} y1={bl.y + 4} x2={bl.x} y2={bl.y + 12} stroke="#222" strokeWidth={0.9} />
                    <line x1={br.x} y1={br.y + 4} x2={br.x} y2={br.y + 12} stroke="#222" strokeWidth={0.9} />
                    <rect x={wmx - 14} y={wmy - 5} width={28} height={10} fill="white" rx={1} opacity={0.9} />
                    <text x={wmx} y={wmy + 2} textAnchor="middle" fontSize={7} fontWeight="500" fill="#111">{wlabel}</text>
                </g>
            )

            // Depth dimension — right side of the building
            const hlabel = `${hM.toFixed(1)} m`
            const hmx = (tr.x + br.x) / 2 + 9, hmy = (tr.y + br.y) / 2
            if (svgH >= 8) bldDimLines.push(
                <g key={`h${bi}`}>
                    <line x1={tr.x + 8} y1={tr.y} x2={br.x + 8} y2={br.y} stroke="#222" strokeWidth={0.9} />
                    <line x1={tr.x + 4} y1={tr.y} x2={tr.x + 12} y2={tr.y} stroke="#222" strokeWidth={0.9} />
                    <line x1={br.x + 4} y1={br.y} x2={br.x + 12} y2={br.y} stroke="#222" strokeWidth={0.9} />
                    <rect x={hmx - 14} y={hmy - 5} width={28} height={10} fill="white" rx={1} opacity={0.9} />
                    <text x={hmx} y={hmy + 2} textAnchor="middle" fontSize={7} fontWeight="500" fill="#111">{hlabel}</text>
                </g>
            )
        })

        // ── Parcel boundary: only longest 2 sides ────────────────────────────────
        const parcelDimLines: JSX.Element[] = []
        if (targetIdx >= 0) {
            const ring = (getCoords(fC[targetIdx])[0] || []) as number[][]
            const sides: { i: number; distM: number }[] = []
            for (let i = 0; i < ring.length - 1; i++) {
                const dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1]
                const distM = Math.sqrt(dx * dx + dy * dy)
                if (distM >= 3) sides.push({ i, distM })
            }
            // Keep only the 2 longest sides
            sides.sort((a, b) => b.distM - a.distM)
            const topSides = sides.slice(0, 2)
            for (const { i, distM } of topSides) {
                const p1 = toSvg(ring[i][0], ring[i][1])
                const p2 = toSvg(ring[i + 1][0], ring[i + 1][1])
                const svgLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
                if (svgLen < 8) continue
                const off = 12
                const perpX = -(p2.y - p1.y) / svgLen * off, perpY = (p2.x - p1.x) / svgLen * off
                const ox1 = p1.x + perpX, oy1 = p1.y + perpY
                const ox2 = p2.x + perpX, oy2 = p2.y + perpY
                const mx = (ox1 + ox2) / 2, my = (oy1 + oy2) / 2
                const label = `${distM.toFixed(1)} m`
                parcelDimLines.push(
                    <g key={`p${i}`}>
                        <line x1={p1.x} y1={p1.y} x2={ox1} y2={oy1} stroke="#0044cc" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
                        <line x1={p2.x} y1={p2.y} x2={ox2} y2={oy2} stroke="#0044cc" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
                        <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke="#0044cc" strokeWidth={1} />
                        <rect x={mx - 14} y={my - 5} width={28} height={10} fill="white" rx={1} opacity={0.9} />
                        <text x={mx} y={my + 2} textAnchor="middle" fontSize={7} fontWeight="500" fill="#0033cc">{label}</text>
                    </g>
                )
            }
        }

        // ── Overview card: form dimension annotations ──────────────────────────
        const terrain = formData?.terrain || {}
        const travaux = formData?.travaux || {}
        const anns: string[] = []
        if (terrain.surface_terrain) anns.push(`Terrain: ${terrain.surface_terrain} m²`)
        if (terrain.surface_plancher) anns.push(`Plancher: ${terrain.surface_plancher} m²`)
        if (travaux.surfaces?.creee) anns.push(`Surface créée: ${travaux.surfaces.creee} m²`)
        if (travaux.surfaces?.existante) anns.push(`Existante: ${travaux.surfaces.existante} m²`)
        if (travaux.menuiseries?.largeur && travaux.menuiseries?.hauteur)
            anns.push(`Menuiseries: ${travaux.menuiseries.largeur}×${travaux.menuiseries.hauteur} cm`)
        if (travaux.isolation?.epaisseur_isolant)
            anns.push(`Isolant: e=${travaux.isolation.epaisseur_isolant} cm`)
        if (travaux.photovoltaique?.surface_totale)
            anns.push(`PV: ${travaux.photovoltaique.surface_totale} m² (${travaux.photovoltaique.nombre_panneaux} pan.)`)

        const annLineH = 13
        const annBoxW = 145
        const annBoxH = anns.length > 0 ? anns.length * annLineH + 22 : 0
        const annBoxX = VW - annBoxW - 6
        const annBoxY = VH - annBoxH - 70  // bottom-right, above legend

        return (
            <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: '100%', background: '#e0e0e0' }}>
                {/* Cadastral parcels */}
                {fC.map((feat: any, i: number) => {
                    const d = toPath(getCoords(feat))
                    if (!d) return null
                    const isTarget = i === targetIdx
                    return <path key={i} d={d} fill={isTarget ? '#d0ebb8' : '#f5f5f2'} stroke={isTarget ? '#0055cc' : '#aaa'} strokeWidth={isTarget ? 2 : 0.8} />
                })}
                {/* BD TOPO Buildings */}
                {(geoData.bati?.features || []).map((feat: any, i: number) => {
                    const d = toPath(getCoords(feat))
                    if (!d) return null
                    return <path key={`b${i}`} d={d} fill="#9e9e9e" stroke="#333" strokeWidth={0.8} />
                })}
                {/* Building bbox dimension lines */}
                {bldDimLines}
                {/* Parcel 2 longest sides */}
                {parcelDimLines}
                {/* Target crosshair */}
                {(() => { const c = toSvg(cx, cy); return (<g><circle cx={c.x} cy={c.y} r={7} fill="none" stroke="#444" strokeWidth={0.9} /><circle cx={c.x} cy={c.y} r={2.5} fill="#444" /><line x1={c.x - 12} y1={c.y} x2={c.x + 12} y2={c.y} stroke="#444" strokeWidth={0.8} /><line x1={c.x} y1={c.y - 12} x2={c.x} y2={c.y + 12} stroke="#444" strokeWidth={0.8} /></g>) })()}

                {/* DIMENSIONS DU PROJET overview card — top right */}
                {anns.length > 0 && (
                    <g>
                        <rect x={annBoxX - 1} y={annBoxY - 1} width={annBoxW + 2} height={annBoxH + 2} fill="rgba(0,0,0,0.15)" rx={4} />
                        <rect x={annBoxX} y={annBoxY} width={annBoxW} height={annBoxH} fill="#f0f4ff" stroke="#0044cc" strokeWidth={0.9} rx={3} />
                        <rect x={annBoxX} y={annBoxY} width={annBoxW} height={15} fill="#0044cc" rx={3} />
                        <rect x={annBoxX} y={annBoxY + 10} width={annBoxW} height={5} fill="#0044cc" />
                        <text x={annBoxX + annBoxW / 2} y={annBoxY + 10.5} textAnchor="middle" fontSize={7.5} fontWeight="bold" fill="white">DIMENSIONS DU PROJET</text>
                        {anns.map((ann, i) => (
                            <text key={i} x={annBoxX + 8} y={annBoxY + 28 + i * annLineH} fontSize={7.5} fill="#0033aa">• {ann}</text>
                        ))}
                    </g>
                )}

                {/* Compass rose */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
                    const rad = a * Math.PI / 180
                    const r = a % 90 === 0 ? 16 : 10
                    return <line key={a} x1={28} y1={VH - 28} x2={28 + Math.cos(rad) * r} y2={VH - 28 + Math.sin(rad) * r} stroke="#333" strokeWidth={a % 90 === 0 ? 1.4 : 0.8} />
                })}
                <circle cx={28} cy={VH - 28} r={2.5} fill="#333" />
                <text x={28} y={VH - 50} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#111">N</text>
                {/* Legend */}
                <rect x={8} y={VH - 60} width={130} height={54} fill="white" stroke="#bbb" strokeWidth={0.7} rx={2} />
                <rect x={14} y={VH - 52} width={9} height={7} fill="#d0ebb8" stroke="#0055cc" strokeWidth={1.2} />
                <text x={26} y={VH - 47} fontSize={7} fill="#333">Parcelle concernée</text>
                <rect x={14} y={VH - 42} width={9} height={7} fill="#f5f5f2" stroke="#aaa" strokeWidth={0.7} />
                <text x={26} y={VH - 37} fontSize={7} fill="#333">Autres parcelles</text>
                <rect x={14} y={VH - 32} width={9} height={7} fill="#9e9e9e" stroke="#333" strokeWidth={0.8} />
                <text x={26} y={VH - 27} fontSize={7} fill="#333">Bâtiments BD TOPO</text>
                <rect x={14} y={VH - 22} width={9} height={7} fill="#e0e0e0" stroke="#aaa" strokeWidth={0.5} />
                <text x={26} y={VH - 17} fontSize={7} fill="#333">Voiries</text>
                <text x={VW - 4} y={VH - 3} textAnchor="end" fontSize={5.5} fill="#888">BD TOPO® — Cadastre</text>
            </svg>
        )
    }

    return (
        <div className="dp-card overflow-hidden">
            <div className="flex items-center gap-3 mb-4 px-4 pt-4">
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>DP2</span>
                <h3 className="font-semibold text-white">Plan de masse des constructions</h3>
                <span className="ml-auto text-[10px] px-2 py-1 rounded-md bg-white/5 text-slate-400 border border-white/10 uppercase tracking-widest">BD TOPO</span>
            </div>

            <div className="relative aspect-video bg-[#e0e0e0] flex items-center justify-center overflow-hidden">
                {loading ? (
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs" style={{ color: '#666' }}>Chargement BD TOPO...</p>
                    </div>
                ) : geoData ? (
                    renderMap()
                ) : (
                    <div className="text-center p-6 grayscale opacity-40">
                        <div className="text-4xl mb-2">🗺️</div>
                        <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                            {error ? 'Erreur de chargement BD TOPO' : "Renseignez l'adresse pour générer le plan"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}



function downloadImage(dataUrl: string, filename = 'apres-travaux-ia.png') {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
}

function FacadeCard({
    label, before, after, isLoading, badge, onGenerateOrEdit, isGenerating, onRemove, canGenerate, hideBefore
}: {
    label: string; before: string | null; after: string | null
    isLoading: boolean; badge: string
    onGenerateOrEdit: (instruction: string) => void; isGenerating: boolean
    onRemove?: () => void
    canGenerate?: boolean
    hideBefore?: boolean
}) {
    const [prompt, setPrompt] = useState('')
    const [showEditPanel, setShowEditPanel] = useState(false)

    return (
        <div className="dp-card flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="px-3 min-w-[3rem] h-10 bg-violet-100 text-violet-700 font-bold text-sm rounded-xl flex items-center justify-center whitespace-nowrap">{badge}</span>
                <h3 className="font-semibold text-slate-100">{label}</h3>
                <span className="ai-badge ml-auto">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    DALL·E 3
                </span>
            </div>

            {/* Images Grid */}
            <div className={`grid gap-4 ${hideBefore ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-2'}`}>
                {!hideBefore && (
                    <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Photo Avant</p>
                        <div className="rounded-xl overflow-hidden bg-slate-100 aspect-[3/2] flex items-center justify-center border border-slate-200/5">
                            {before ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={before} alt="Avant" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-slate-300 text-sm">Pas de photo</span>
                            )}
                        </div>
                    </div>
                )}
                <div>
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${hideBefore ? 'text-blue-500' : 'text-violet-500'}`}>{hideBefore ? 'Croquis Architectural' : 'Simulation Après'}</p>
                    {isGenerating ? (
                        <div className="rounded-xl overflow-hidden aspect-[3/2] flex flex-col items-center justify-center relative shadow-inner" style={{ background: 'rgba(139,92,246,0.04)', border: '1px dashed rgba(139,92,246,0.2)' }}>
                            <div className="text-center" style={{ color: '#a78bfa' }}>
                                <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin mx-auto mb-3 shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
                                <span className="text-xs font-medium tracking-wide animate-pulse">Création de l'image en cours...</span>
                            </div>
                        </div>
                    ) : after ? (
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl overflow-hidden aspect-[3/2] flex items-center justify-center relative shadow-inner" style={{ background: '#0f0f0f' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={after} alt="Après" className="w-full h-full object-cover" />
                                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                    <button
                                        onClick={() => downloadImage(after, `${badge}-simulation.png`)}
                                        title="Télécharger l'image"
                                        className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all hover:bg-black/80 text-white"
                                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Télécharger
                                    </button>
                                    {onRemove && (
                                        <button
                                            onClick={onRemove}
                                            title="Supprimer cette image"
                                            className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all hover:bg-red-500/80 text-white"
                                            style={{ background: 'rgba(239,68,68,0.4)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Supprimer
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    onClick={() => setShowEditPanel(!showEditPanel)}
                                    title="Regénérer l'image"
                                    className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all text-white border border-violet-500/30"
                                    style={{
                                        background: showEditPanel ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(139,92,246,0.1)',
                                        boxShadow: showEditPanel ? '0 0 15px rgba(139,92,246,0.3)' : 'none'
                                    }}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {showEditPanel ? 'Fermer' : 'Regénérer image'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl overflow-hidden bg-transparent aspect-[3/2] flex flex-col items-center justify-center p-6 text-center" style={{ border: '2px dashed rgba(139,92,246,0.2)' }}>
                                <div className="text-4xl shadow-sm mb-3 saturate-50 opacity-80 mix-blend-luminosity">🖼️</div>
                                <p className="text-sm font-semibold mb-1" style={{ color: '#a78bfa' }}>Aperçu du projet</p>
                                <p className="text-xs text-slate-500 max-w-[250px]">
                                    L'intelligence artificielle va créer une projection réaliste de votre façade avec les nouveaux aménagements.
                                </p>
                                {isGenerating && (
                                    <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: '#a78bfa' }}>
                                        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                        Génération en cours…
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Instruction Panel (Animated Reveal) */}
            <div
                className={`transition-all duration-300 ease-in-out relative overflow-hidden ${showEditPanel ? 'opacity-100 max-h-[300px] mt-2' : 'opacity-0 max-h-0'}`}
            >
                <div className="rounded-xl p-5 relative" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="absolute top-0 right-10 flex space-x-1 -translate-y-1/2">
                        <div className="w-2 h-2 rounded-full bg-violet-400 opacity-50 shadow-[0_0_5px_rgba(139,92,246,0.5)] animate-pulse" />
                        <div className="w-2 h-2 rounded-full bg-violet-500 opacity-80 shadow-[0_0_5px_rgba(139,92,246,0.5)] animate-pulse delay-75" />
                        <div className="w-2 h-2 rounded-full bg-violet-600 shadow-[0_0_5px_rgba(139,92,246,0.5)] animate-pulse delay-150" />
                    </div>

                    <p className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: '#c4b5fd' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Atelier magique : que souhaitez-vous modifier ?
                    </p>
                    <div className="flex gap-3 items-stretch">
                        <textarea
                            className="dp-input flex-1 min-h-[60px] resize-none text-[13px] text-slate-200 placeholder-slate-500 !bg-black/30 mx-0 border-x-0 border-t-0 !border-b-2 !border-b-violet-500/30 focus:!bg-black/50 focus:!border-b-violet-400 focus:!ring-0 rounded-none rounded-t-xl px-4 py-3"
                            placeholder="Ex : Remplace la porte par une grande baie vitrée."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                        <button
                            onClick={() => {
                                if (prompt.trim()) {
                                    onGenerateOrEdit(prompt.trim())
                                    setShowEditPanel(false)
                                    setPrompt('')
                                }
                            }}
                            disabled={!prompt.trim() || isGenerating}
                            className="px-6 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-40 hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', boxShadow: '0 4px 15px rgba(139,92,246,0.3)' }}
                        >
                            {isGenerating ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>Transformer</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height
                if (width > maxWidth) {
                    height = (maxWidth / width) * height
                    width = maxWidth
                }
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) return resolve(event.target?.result as string)
                ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL('image/jpeg', quality))
            }
            img.onerror = () => resolve(event.target?.result as string)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
    })
}

const compressDataURL = (dataUrl: string, maxWidth: number = 800, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image()
        img.src = dataUrl
        img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height
            if (width > maxWidth) {
                height = (maxWidth / width) * height
                width = maxWidth
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) return resolve(dataUrl)
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.onerror = () => resolve(dataUrl)
    })
}


export default function Etape5() {
    const router = useRouter()
    const { formData, updatePhotos, updatePlans } = useDPContext()
    const [isGeneratingAI, setIsGeneratingAI] = useState(false)
    const [isGeneratingCroquis, setIsGeneratingCroquis] = useState(false)
    const [isEditingAI, setIsEditingAI] = useState(false)
    const [isEditingCroquis, setIsEditingCroquis] = useState(false)
    const [aiGenerated, setAiGenerated] = useState(false)
    const [aiInstruction, setAiInstruction] = useState(formData.terrain.description_projet || '')
    const [dp4Notice, setDp4Notice] = useState(formData.plans.dp4_notice || '')
    // DP4 AI Text Generation
    const [isGeneratingDP4, setIsGeneratingDP4] = useState(false)

    const address = formData.terrain.meme_adresse
        ? formData.demandeur.adresse
        : formData.terrain.adresse
    const commune = formData.terrain.meme_adresse
        ? formData.demandeur.commune
        : formData.terrain.commune

    useEffect(() => {
        // Auto-generate DP4 notice based on work type
        const notice = generateDP4Notice(formData)
        setDp4Notice(notice)
        updatePlans({ dp4_notice: notice })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.travaux.type])

    const handleGenerateAICroquis = async () => {
        // Use the generated simulation (DP 6) as the base
        const dp6Image = formData.photos.facade_apres_ai
        if (!dp6Image) return

        setIsGeneratingCroquis(true)
        try {
            const imageUrl = await generateAICroquis(formData, dp6Image)
            if (imageUrl) {
                const compressedUrl = imageUrl.startsWith('data:image')
                    ? await compressDataURL(imageUrl)
                    : imageUrl;
                updatePhotos({ facade_croquis_ai: compressedUrl })
            }
        } catch (err: any) {
            console.error('Croquis generation failed:', err.message || err)
            alert('Erreur: ' + (err.message || String(err)))
        } finally {
            setIsGeneratingCroquis(false)
        }
    }

    const handleGenerateAIFirst = async () => {
        if (!aiInstruction.trim()) return
        setIsGeneratingAI(true)
        try {
            // Build a system-wrapped prompt directly from user's instruction
            const prompt = `Tu es un IA experte en visualisation architecturale. Ta mission est de générer une simulation réaliste de l'aspect "état après travaux" d'une maison selon les modifications demandées.

MODIFICATIONS DEMANDÉES :
« ${aiInstruction.trim()} »

CONTRAINTES STRICTES :
- Applique les modifications demandées de la manière la plus réaliste possible.
- CONSERVE ABSOLUMENT TOUT LE RESTE DE LA PHOTO ORIGINALE À L'IDENTIQUE.
- Les murs existants (sauf si modifiés par la demande), la toiture, le jardin, l'allée, l'environnement, l'éclairage, le ciel et l'angle de vue DOIVENT rester inchangés à 100%.
- Applique uniquement ce qui est explicitement mentionné dans les modifications. Ne crée pas de nouvelles structures ni ne modifie l'architecture des éléments non mentionnés.
- Rendu photoRéaliste uniquement, sans texte, cadre ou artefact artificiel.`

            const imageBase64 = formData.photos.facade_avant || undefined
            console.log('%cBefore image type:', 'font-weight:bold;color:#34d399', imageBase64 ? (imageBase64.startsWith('data:') ? 'data URL (uploaded)' : 'URL (placeholder)') : 'none')

            console.group('%c🤖 AI Facade Generation – gpt-image-1', 'color:#a78bfa;font-weight:bold;font-size:13px')
            console.log('%cModel:', 'font-weight:bold;color:#60a5fa', 'gpt-image-1')
            console.log('%cSize:', 'font-weight:bold;color:#60a5fa', '1536x1024')
            console.log('%cInput fidelity:', 'font-weight:bold;color:#60a5fa', 'high')
            console.log('%cBefore image:', 'font-weight:bold;color:#34d399', !!imageBase64)
            console.log('%cUser instruction:', 'font-weight:bold;color:#fbbf24', aiInstruction.trim())
            console.log('%cFull prompt sent to API:', 'font-weight:bold;color:#a78bfa')
            console.log(prompt)
            console.groupEnd()

            // -- Call OpenAI directly from browser via token endpoint --
            const tokenRes = await fetch('/api/image-token', { cache: 'no-store' })
            if (!tokenRes.ok) {
                const te = await tokenRes.json().catch(() => ({}))
                throw new Error((te as any).error || `Token error ${tokenRes.status}`)
            }
            const { key } = await tokenRes.json()

            let imageUrl: string | undefined

            if (imageBase64 && imageBase64.startsWith('data:')) {
                // Resize via canvas
                const resized = await new Promise<string>((resolve, reject) => {
                    const img = new Image(); img.onload = () => {
                        const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024
                        const ctx = canvas.getContext('2d')!
                        const scale = Math.max(1536 / img.width, 1024 / img.height)
                        const w = img.width * scale, h = img.height * scale
                        ctx.drawImage(img, (1536 - w) / 2, (1024 - h) / 2, w, h)
                        resolve(canvas.toDataURL('image/png'))
                    }; img.onerror = reject; img.src = imageBase64!
                })
                const b64 = resized.split(',')[1]
                const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
                const blob = new Blob([bytes], { type: 'image/png' })
                const form = new FormData()
                form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('n', '1')
                form.append('size', '1536x1024'); form.append('image', blob, 'facade.png')
                const aiRes = await fetch('https://api.openai.com/v1/images/edits', {
                    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
                })
                if (!aiRes.ok) { const e = await aiRes.json().catch(() => ({})); throw new Error((e as any).error?.message || `OpenAI ${aiRes.status}`) }
                const aiData = await aiRes.json()
                const item = aiData.data?.[0]
                imageUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
            } else {
                const aiRes = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1536x1024' }),
                })
                if (!aiRes.ok) { const e = await aiRes.json().catch(() => ({})); throw new Error((e as any).error?.message || `OpenAI ${aiRes.status}`) }
                const aiData = await aiRes.json()
                const item = aiData.data?.[0]
                imageUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
            }

            if (imageUrl) {
                const compressedUrl = imageUrl.startsWith('data:image') ? await compressDataURL(imageUrl) : imageUrl
                updatePhotos({ facade_apres_ai: compressedUrl })
                setAiGenerated(true)
            } else {
                alert('La génération a échoué: aucune image retournée')
            }
        } catch (err: any) {
            console.error('AI generation failed:', err.message || err)
            alert('Erreur: ' + (err.message || String(err)))
        } finally {
            setIsGeneratingAI(false)
        }
    }

    const handleEditCroquis = async (instruction: string) => {
        // Still use the DP 6 image as base when editing, but pass the instruction (though our backend currently ignores it and uses the hardcoded prompt, this is fine for now as it just replaces it)
        const dp6Image = formData.photos.facade_apres_ai
        if (!dp6Image) return

        setIsEditingCroquis(true)
        try {
            const imageUrl = await generateAICroquis(formData, dp6Image)
            if (imageUrl) {
                const compressedUrl = imageUrl.startsWith('data:image')
                    ? await compressDataURL(imageUrl)
                    : imageUrl;
                updatePhotos({ facade_croquis_ai: compressedUrl })
            }
        } catch (err: any) {
            console.error('Croquis edit failed:', err.message || err)
            alert('Erreur: ' + (err.message || String(err)))
        } finally {
            setIsEditingCroquis(false)
        }
    }

    // Iterative edit — passes current AI image back as input with new instruction
    const handleEditAI = async (instruction: string) => {
        const currentImage = formData.photos.facade_apres_ai
        if (!currentImage) return
        setIsEditingAI(true)
        try {
            const prompt = `Tu es un IA experte en visualisation architecturale. Ta mission est de modifier une simulation de façade existante selon les nouvelles modifications demandées.

MODIFICATIONS DEMANDÉES :
« ${instruction.trim()} »

CONSTRAINTES STRICTES :
- Applique UNIQUEMENT les modifications décrites ci-dessus.
- CONSERVE ABSOLUMENT TOUT LE RESTE DE L'IMAGE ORIGINALE À L'IDENTIQUE.
- Rendu photoRéaliste uniquement, sans texte, cadre ou artefact artificiel.`

            console.group('%c🤖 AI Facade Edit – gpt-image-1', 'color:#a78bfa;font-weight:bold;font-size:13px')
            console.log('%cUser instruction:', 'font-weight:bold;color:#fbbf24', instruction)
            console.log('%cFull prompt sent to API:', 'font-weight:bold;color:#a78bfa')
            console.log(prompt)
            console.groupEnd()

            // -- Call OpenAI directly from browser via token endpoint --
            const tokenRes = await fetch('/api/image-token', { cache: 'no-store' })
            if (!tokenRes.ok) { const te = await tokenRes.json().catch(() => ({})); throw new Error((te as any).error || `Token error ${tokenRes.status}`) }
            const { key } = await tokenRes.json()

            const currentImageB64 = currentImage.startsWith('data:') ? currentImage : undefined
            let newImage: string | undefined

            if (currentImageB64) {
                const resized = await new Promise<string>((resolve, reject) => {
                    const img = new Image(); img.onload = () => {
                        const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024
                        const ctx = canvas.getContext('2d')!
                        const scale = Math.max(1536 / img.width, 1024 / img.height)
                        const w = img.width * scale, h = img.height * scale
                        ctx.drawImage(img, (1536 - w) / 2, (1024 - h) / 2, w, h)
                        resolve(canvas.toDataURL('image/png'))
                    }; img.onerror = reject; img.src = currentImageB64
                })
                const b64 = resized.split(',')[1]
                const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
                const blob = new Blob([bytes], { type: 'image/png' })
                const form = new FormData()
                form.append('model', 'gpt-image-1'); form.append('prompt', prompt); form.append('n', '1')
                form.append('size', '1536x1024'); form.append('image', blob, 'facade.png')
                const aiRes = await fetch('https://api.openai.com/v1/images/edits', {
                    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
                })
                if (!aiRes.ok) { const e = await aiRes.json().catch(() => ({})); throw new Error((e as any).error?.message || `OpenAI ${aiRes.status}`) }
                const aiData = await aiRes.json()
                const item = aiData.data?.[0]
                newImage = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
            }

            if (newImage) {
                const compressedUrl = newImage.startsWith('data:image') ? await compressDataURL(newImage) : newImage
                updatePhotos({ facade_apres_ai: compressedUrl })
            } else {
                alert('La modification a échoué: aucune image retournée')
            }
        } catch (err: any) {
            console.error('AI edit failed:', err.message || err)
            alert('Erreur: ' + (err.message || String(err)))
        } finally {
            setIsEditingAI(false)
        }
    }

    const handleGenerateDP4 = async () => {
        setIsGeneratingDP4(true)
        try {
            const photosPayload = []
            if (formData.photos.facade_avant) photosPayload.push(formData.photos.facade_avant)
            if (formData.photos.facade_arriere) photosPayload.push(formData.photos.facade_arriere)
            if (formData.photos.facade_gauche) photosPayload.push(formData.photos.facade_gauche)
            if (formData.photos.facade_droite) photosPayload.push(formData.photos.facade_droite)
            if (formData.photos.facade_apres_ai) photosPayload.push(formData.photos.facade_apres_ai)

            const res = await fetch('/api/generate-dp4', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData: {
                        demandeur: formData.demandeur,
                        terrain: formData.terrain,
                        travaux: formData.travaux
                    },
                    photos: photosPayload
                }),
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text.includes('504 Gateway Timeout') ? 'Délai dépassé (504).' : text.slice(0, 100))
            }

            const data = await res.json()
            if (data.dp4) {
                setDp4Notice(data.dp4)
                updatePlans({ dp4_notice: data.dp4 })
            } else {
                console.error('Failed to generate DP4:', data.error)
                alert('La génération a échoué: ' + (data.error || 'Erreur inconnue'))
            }
        } catch (err: any) {
            console.error('DP4 generation failed:', err.message || err)
            alert('Erreur: ' + (err.message || String(err)))
        } finally {
            setIsGeneratingDP4(false)
        }
    }

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Plans & Documents générés</h2>
                    <p className="text-slate-500 mt-1">Visualisez l'ensemble des pièces de votre dossier avant téléchargement</p>
                </div>

                <div className="space-y-6">
                    {/* DP1 - Plan de situation */}
                    <MapCard
                        title="Plan de situation du terrain"
                        code="DP1"
                        address={address}
                        commune={commune}
                        color="blue"
                    />

                    {/* DP2 - Plan de masse - BD TOPO Vector */}
                    <Dp2VectorCard
                        address={address}
                        commune={commune}
                        formData={formData}
                    />




                    {/* DP4 - Notice descriptive */}
                    <div className="dp-card">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-10 h-10 text-green-700 font-bold text-sm rounded-xl flex items-center justify-center">DP4</span>
                            <h3 className="font-semibold text-slate-100">Notice descriptive</h3>
                            <button
                                onClick={handleGenerateDP4}
                                disabled={isGeneratingDP4}
                                className="ml-auto px-4 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold rounded-lg border border-green-500/30 transition-all flex items-center gap-2"
                            >
                                {isGeneratingDP4 ? (
                                    <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                                ) : '✨'}
                                {isGeneratingDP4 ? 'Analyse visuelle NVIDIA...' : 'Générer avec l\'IA'}
                            </button>
                        </div>
                        <textarea
                            className="dp-input min-h-[200px] resize-y font-mono text-xs disabled:opacity-50"
                            value={dp4Notice}
                            disabled={isGeneratingDP4}
                            onChange={e => {
                                setDp4Notice(e.target.value)
                                updatePlans({ dp4_notice: e.target.value })
                            }}
                        />
                    </div>

                    {/* DP5 - Façades Avant/Après */}
                    <div className="dp-card">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-3 min-w-[2.5rem] h-10 bg-violet-100 text-violet-700 font-bold text-sm rounded-xl flex items-center justify-center whitespace-nowrap">DP5 & DP6</span>
                            <h3 className="font-semibold text-slate-100">Plans des façades & Simulations</h3>
                        </div>

                        <div className="space-y-6">
                            {/* AI instruction textarea */}
                            <div className="rounded-xl p-5" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                <label className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#a78bfa' }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    Instruction IA – Décrivez les changements souhaités
                                </label>
                                <textarea
                                    className="dp-input min-h-[72px] resize-none text-sm text-slate-200 placeholder-slate-500"
                                    placeholder="Ex : Remplacer 2 des 3 portes par 3 fenêtres en PVC blanc RAL 9016. Garder 1 porte à gauche."
                                    value={aiInstruction}
                                    onChange={e => setAiInstruction(e.target.value)}
                                />
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-xs" style={{ color: '#475569' }}>Ce texte sera envoyé directement à l'IA · Modèle : <span className="font-semibold" style={{ color: '#a78bfa' }}>gpt-image-1</span></p>
                                    <button
                                        onClick={handleGenerateAIFirst}
                                        disabled={!aiInstruction.trim() || isGeneratingAI || isEditingAI}
                                        className="px-5 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', boxShadow: '0 4px 15px rgba(139,92,246,0.3)' }}
                                    >
                                        {(isGeneratingAI && !formData.photos.facade_apres_ai) ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération DP6...</>
                                        ) : (
                                            <><div className="text-base">✨</div> {formData.photos.facade_apres_ai ? 'Regénérer DP6' : 'Générer DP6 (Simulation)'}</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <FacadeCard
                                label="Insertion paysagère (Simulation)"
                                badge="DP6"
                                before={formData.photos.facade_avant}
                                after={formData.photos.facade_apres_ai}
                                isLoading={isGeneratingAI}
                                onGenerateOrEdit={(editInstruction) => {
                                    if (!formData.photos.facade_apres_ai) {
                                        handleGenerateAIFirst()
                                    } else {
                                        handleEditAI(editInstruction)
                                    }
                                }}
                                isGenerating={isGeneratingAI || isEditingAI}
                                onRemove={() => updatePhotos({ facade_apres_ai: null })}
                                canGenerate={!!aiInstruction.trim()}
                            />

                            {/* Show DP 5 generation ONLY after DP 6 is ready */}
                            {formData.photos.facade_apres_ai && (
                                <div className="mt-8 pt-6 border-t border-slate-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-200">Étape suivante : Croquis Architectural</h4>
                                            <p className="text-xs text-slate-400 mt-1">Convertissez la simulation ci-dessus en dessin technique pour le formulaire de mairie.</p>
                                        </div>
                                        <button
                                            onClick={handleGenerateAICroquis}
                                            disabled={isGeneratingCroquis || isEditingCroquis}
                                            className="px-5 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                                        >
                                            {isGeneratingCroquis ? (
                                                <><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Génération...</>
                                            ) : (
                                                <><div className="text-base">📐</div> Générer DP5</>
                                            )}
                                        </button>
                                    </div>

                                    {formData.photos.facade_croquis_ai && (
                                        <FacadeCard
                                            label="Croquis Architectural"
                                            badge="DP5"
                                            before={null} // We don't need the before image here
                                            after={formData.photos.facade_croquis_ai}
                                            isLoading={isGeneratingCroquis}
                                            onGenerateOrEdit={handleEditCroquis}
                                            isGenerating={isGeneratingCroquis || isEditingCroquis}
                                            onRemove={() => updatePhotos({ facade_croquis_ai: null })}
                                            canGenerate={true}
                                            hideBefore={true}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DP7 & DP8 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { code: 'DP7', label: 'Vue proche', img: formData.photos.dp7_vue_proche },
                            { code: 'DP8', label: 'Vue lointaine', img: formData.photos.dp8_vue_lointaine },
                        ].map(item => (
                            <div key={item.code} className="dp-card">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="w-10 h-10 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl flex items-center justify-center">{item.code}</span>
                                    <h3 className="font-semibold text-slate-100">{item.label}</h3>
                                </div>
                                <div className="rounded-xl overflow-hidden bg-slate-100 aspect-video flex items-center justify-center">
                                    {item.img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.img} alt={item.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-slate-400 text-sm">
                                            <div className="text-3xl mb-2">📷</div>
                                            Photo non ajoutée
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push('/etape/4')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button onClick={() => router.push('/etape/6')} className="dp-btn-primary text-base">
                            Génération du Dossier
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </StepLayout>
    )
}

// ─── Auto-generate DP4 Notice ─────────────────────────────────────────────────

function generateDP4Notice(data: DPFormData): string {
    const { demandeur, terrain, travaux } = data
    const nom = demandeur.nom ? `${demandeur.civilite} ${demandeur.nom} ${demandeur.prenom}` : 'Le demandeur'
    const adresse = terrain.commune || 'la commune'
    const parcelle = terrain.section_cadastrale && terrain.numero_parcelle
        ? `section ${terrain.section_cadastrale} parcelle ${terrain.numero_parcelle}`
        : 'la parcelle identifiée'
    const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })

    let travDetail = ''

    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        const typeLabel: Record<string, string> = { fenetre: 'fenêtres', porte: 'portes extérieures', volet: 'volets', baie_vitree: 'baies vitrées' }
        const matLabel: Record<string, string> = { pvc: 'PVC', aluminium: 'aluminium', bois: 'bois', mixte: 'mixte bois/aluminium' }
        travDetail = `
            NATURE DES TRAVAUX :
            Remplacement / installation de ${typeLabel[m.type] || 'menuiseries'} extérieures.

            DESCRIPTION TECHNIQUE :
            - Matériau : ${matLabel[m.materiau] || 'non précisé'}
            - Couleur : ${m.couleur || 'à définir'}${m.couleur_ral ? ` (${m.couleur_ral})` : ''}
            - Nombre d'éléments : ${m.nombre || 'à définir'}
            - Dimensions unitaires : ${m.largeur && m.hauteur ? `${m.largeur} cm × ${m.hauteur} cm` : 'à préciser'}
            - Mode : ${m.remplacement ? 'Remplacement des menuiseries existantes' : 'Création de nouvelle ouverture'}

            INTÉGRATION DANS L'ENVIRONNEMENT :
            Les nouvelles menuiseries sont choisies en harmonie avec l'aspect général de la construction et respectent les couleurs et matériaux en usage dans la commune. L'aspect de la façade est amélioré tout en préservant le caractère architectural du bâtiment.`
    }

    if (travaux.type === 'isolation' && travaux.isolation) {
        const iso = travaux.isolation
        const finLabel: Record<string, string> = { enduit: 'enduit de finition', bardage_bois: 'bardage bois', bardage_metal: 'bardage métal', bardage_composite: 'bardage composite' }
        travDetail = `
            NATURE DES TRAVAUX :
            Application d'un système d'isolation thermique par l'extérieur (ITE).

            DESCRIPTION TECHNIQUE :
            - Type de finition : ${finLabel[iso.type_finition] || 'non précisé'}
            - Couleur de finition : ${iso.couleur || 'à définir'}
            - Matériau isolant : ${iso.materiau_isolant || 'non précisé'}
            - Épaisseur de l'isolant : ${iso.epaisseur_isolant ? iso.epaisseur_isolant + ' cm' : 'à préciser'}
            - Façades concernées : ${iso.facades_concernees?.join(', ') || 'toutes les façades'}

            INTÉGRATION DANS L'ENVIRONNEMENT :
            La teinte de finition choisie s'harmonise avec les constructions avoisinantes et le tissu urbain existant. L'isolation par l'extérieur améliore les performances énergétiques du bâtiment sans modifier significativement son volume ni son aspect général, dans le respect de l'article R.421-17 du code de l'urbanisme.`
    }

    if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
        const pv = travaux.photovoltaique
        const intLabel: Record<string, string> = { surimposition: 'en surimposition sur la toiture existante (cadres aluminium)', integration: 'en intégration au bâti (en remplacement des tuiles)' }
        travDetail = `
            NATURE DES TRAVAUX :
            Installation de panneaux photovoltaïques en toiture.

            DESCRIPTION TECHNIQUE :
            - Nombre de panneaux : ${pv.nombre_panneaux || 'à définir'}
            - Surface totale : ${pv.surface_totale ? pv.surface_totale + ' m²' : 'à préciser'}
            - Puissance installée : ${pv.puissance_kw ? pv.puissance_kw + ' kWc' : 'à préciser'}
            - Marque / Modèle : ${pv.marque || 'à préciser'}
            - Orientation : ${pv.orientation || 'Sud'}
            - Inclinaison : ${pv.inclinaison ? pv.inclinaison + '°' : '30°'}
            - Mode de pose : ${intLabel[pv.integration] || 'à préciser'}

            INTÉGRATION DANS L'ENVIRONNEMENT :
            Les panneaux photovoltaïques sont posés ${intLabel[pv.integration] || 'sur la toiture'} dans le respect de la pente existante. Leur couleur sombre (bleu nuit / noir) s'intègre discrètement à la toiture. Le projet contribue à la transition énergétique dans le respect du PLU de la commune de ${adresse}.`
    }

    return `NOTICE DESCRIPTIVE – DEMANDE PRÉALABLE DE TRAVAUX
            (Pièce DP4 – Cerfa n°13703*)

            Date : ${date}
            Demandeur : ${nom}
            Adresse des travaux : ${terrain.adresse || demandeur.adresse}, ${terrain.code_postal || demandeur.code_postal} ${adresse}
            Références cadastrales : ${parcelle}
            ${terrain.surface_terrain ? 'Surface du terrain : ' + terrain.surface_terrain + ' m²' : ''}

            ─────────────────────────────────────────
            ${travDetail}

            ─────────────────────────────────────────
            SITUATION RÉGLEMENTAIRE :
            Ces travaux sont soumis à déclaration préalable conformément aux articles R.421-9 à R.421-12 du code de l'urbanisme. Ils ne modifient pas la destination de la construction ni la surface de plancher de façon significative.

            Fait à ${demandeur.commune || '.....................'}, le ${new Date().toLocaleDateString('fr-FR')}
            Signature du demandeur : ______________________`
}

// Needed for TypeScript — import DPFormData in same file
import { DPFormData } from '@/lib/models'
