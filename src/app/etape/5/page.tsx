'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'
import { generateAICroquis, buildAIAfterImagePrompt, buildAICroquisPrompt, buildAIAfterImagePrompt as buildDP6Prompt } from '@/lib/aiImageGenerator'
import { DPFormData } from '@/lib/models'
import html2canvas from 'html2canvas'

const MAX_IMG_SIZE = 1.5 * 1024 * 1024 // 1.5MB to save bandwidth for Nemotron


function MapCard({
    title, code, address, commune, color = 'blue', zoom, onZoomChange, onCapture, savedImage
}: {
    title: string; code: string; address: string; commune: string; color?: 'blue' | 'green'
    zoom?: number; onZoomChange?: (z: number) => void;
    onCapture?: (img: string) => void;
    savedImage?: string | null;
}) {
    const [mapUrl, setMapUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!commune && !address) return
        setLoading(true)
        setError(false)

        const params = new URLSearchParams({ address, commune })
        if (zoom) params.append('zoom', zoom.toString())
        
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
    }, [address, commune, code, zoom])

    const iconColor = color === 'green' ? '#4ade80' : '#60a5fa'
    const codeColor = color === 'green' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'

    const handleCapture = async () => {
        if (!mapRef.current) return
        setCapturing(true)
        try {
            const canvas = await html2canvas(mapRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff'
            })
            onCapture?.(canvas.toDataURL('image/png'))
        } catch (e) {
            console.error('Capture error:', e)
        } finally {
            setCapturing(false)
        }
    }

    return (
        <div className="dp-card overflow-hidden">
            <div className="flex items-center gap-3 mb-4 px-4 pt-4">
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center"
                    style={{ background: codeColor, color: iconColor }}>{code}</span>
                <div className="flex flex-col">
                    <h3 className="font-semibold text-white leading-tight">{title}</h3>
                    {savedImage && <span className="text-[10px] text-green-400 font-medium">✓ Plan capturé pour le PDF</span>}
                </div>
                <button 
                    onClick={handleCapture}
                    disabled={loading || !mapUrl || capturing}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                        savedImage 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                    }`}
                >
                    {capturing ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Capture...
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 011.664.89l.812 1.22A2 2 0 0010.07 10H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {savedImage ? 'Actualiser capture' : 'PING PONG PDF'}
                        </>
                    )}
                </button>
            </div>

            {code === 'DP1' && onZoomChange && (
                <div className="px-5 pb-4 flex items-center gap-4 bg-white/5 mx-4 mb-4 rounded-xl border border-white/10 py-3">
                    <div className="flex-1">
                        <div className="flex justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Échelle du plan (Zoom)</span>
                            <span className="text-[10px] font-mono text-blue-400">{zoom}m</span>
                        </div>
                        <input 
                            type="range" 
                            min="200" 
                            max="2000" 
                            step="100"
                            value={zoom} 
                            onChange={(e) => onZoomChange(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
            )}

            <div ref={mapRef} className="relative aspect-video bg-white flex items-center justify-center">
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
function Dp2VectorCard({ address, commune, formData, onCapture, savedImage }: { address: string; commune: string; formData: any; onCapture?: (img: string) => void; savedImage?: string | null }) {
    const [geoData, setGeoData] = useState<{ cadastre: any; bati: any; center: number[] } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)

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
                const half = 80 // 160m wide bbox

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

    const handleCapture = async () => {
        if (!mapRef.current) return
        setCapturing(true)
        try {
            const canvas = await html2canvas(mapRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#e0e0e0'
            })
            onCapture?.(canvas.toDataURL('image/png'))
        } catch (e) {
            console.error('Capture error:', e)
        } finally {
            setCapturing(false)
        }
    }

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

        const fB = geoData.bati?.features || []
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
            let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
            for (const c of ring) {
                if (c[0] < bMinX) bMinX = c[0]; if (c[0] > bMaxX) bMaxX = c[0]
                if (c[1] < bMinY) bMinY = c[1]; if (c[1] > bMaxY) bMaxY = c[1]
            }
            if (targetIdx >= 0) {
                const bCx = (bMinX + bMaxX) / 2, bCy = (bMinY + bMaxY) / 2
                if (bCx < tpMinX || bCx > tpMaxX || bCy < tpMinY || bCy > tpMaxY) return
            }
            const wM = bMaxX - bMinX, hM = bMaxY - bMinY
            if (wM < 1 && hM < 1) return
            const tl = toSvg(bMinX, bMaxY), tr = toSvg(bMaxX, bMaxY), bl = toSvg(bMinX, bMinY), br = toSvg(bMaxX, bMinY)
            const svgW = Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2)
            const svgH = Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2)
            if (svgW < 8 && svgH < 8) return

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

        const parcelDimLines: JSX.Element[] = []
        if (targetIdx >= 0) {
            const ring = (getCoords(fC[targetIdx])[0] || []) as number[][]
            const sides: { i: number; distM: number }[] = []
            for (let i = 0; i < ring.length - 1; i++) {
                const dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1]
                const distM = Math.sqrt(dx * dx + dy * dy)
                if (distM >= 3) sides.push({ i, distM })
            }
            sides.sort((a, b) => b.distM - a.distM)
            const topSides = sides.slice(0, 2)
            for (const { i, distM } of topSides) {
                const p1 = toSvg(ring[i][0], ring[i][1]), p2 = toSvg(ring[i + 1][0], ring[i + 1][1])
                const svgLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
                if (svgLen < 8) continue
                const off = 12
                const perpX = -(p2.y - p1.y) / svgLen * off, perpY = (p2.x - p1.x) / svgLen * off
                const ox1 = p1.x + perpX, oy1 = p1.y + perpY, ox2 = p2.x + perpX, oy2 = p2.y + perpY
                const mx = (ox1 + ox2) / 2, my = (oy1 + oy2) / 2
                parcelDimLines.push(
                    <g key={`p${i}`}>
                        <line x1={p1.x} y1={p1.y} x2={ox1} y2={oy1} stroke="#0044cc" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
                        <line x1={p2.x} y1={p2.y} x2={ox2} y2={oy2} stroke="#0044cc" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
                        <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke="#0044cc" strokeWidth={1} />
                        <rect x={mx - 14} y={my - 5} width={28} height={10} fill="white" rx={1} opacity={0.9} />
                        <text x={mx} y={my + 2} textAnchor="middle" fontSize={7} fontWeight="500" fill="#0033cc">{distM.toFixed(1)} m</text>
                    </g>
                )
            }
        }

        const terrain = formData?.terrain || {}, travaux = formData?.travaux || {}, anns: string[] = []
        if (terrain.surface_terrain) anns.push(`Terrain: ${terrain.surface_terrain} m²`)
        if (terrain.surface_plancher) anns.push(`Plancher: ${terrain.surface_plancher} m²`)
        if (travaux.surfaces?.creee) anns.push(`Surface créée: ${travaux.surfaces.creee} m²`)
        if (travaux.surfaces?.existante) anns.push(`Existante: ${travaux.surfaces.existante} m²`)
        if (travaux.menuiseries?.largeur && travaux.menuiseries?.hauteur) anns.push(`Menuiseries: ${travaux.menuiseries.largeur}×${travaux.menuiseries.hauteur} cm`)
        if (travaux.isolation?.epaisseur_isolant) anns.push(`Isolant: e=${travaux.isolation.epaisseur_isolant} cm`)
        if (travaux.photovoltaique?.surface_totale) anns.push(`PV: ${travaux.photovoltaique.surface_totale} m² (${travaux.photovoltaique.nombre_panneaux} pan.)`)

        const annLineH = 13, annBoxW = 145, annBoxH = anns.length > 0 ? anns.length * annLineH + 22 : 0
        const annBoxX = VW - annBoxW - 6, annBoxY = VH - annBoxH - 70

        return (
            <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: '100%', background: '#e0e0e0' }}>
                {fC.map((feat: any, i: number) => {
                    const d = toPath(getCoords(feat))
                    if (!d) return null
                    const isTarget = i === targetIdx
                    return <path key={i} d={d} fill={isTarget ? '#d0ebb8' : '#f5f5f2'} stroke={isTarget ? '#0055cc' : '#aaa'} strokeWidth={isTarget ? 2 : 0.8} />
                })}
                {(geoData.bati?.features || []).map((feat: any, i: number) => {
                    const d = toPath(getCoords(feat))
                    if (!d) return null
                    return <path key={`b${i}`} d={d} fill="#9e9e9e" stroke="#333" strokeWidth={0.8} />
                })}
                {bldDimLines}
                {parcelDimLines}
                {(() => { const c = toSvg(cx, cy); return (<g><circle cx={c.x} cy={c.y} r={7} fill="none" stroke="#444" strokeWidth={0.9} /><circle cx={c.x} cy={c.y} r={2.5} fill="#444" /><line x1={c.x - 12} y1={c.y} x2={c.x + 12} y2={c.y} stroke="#444" strokeWidth={0.8} /><line x1={c.x} y1={c.y - 12} x2={c.x} y2={c.y + 12} stroke="#444" strokeWidth={0.8} /></g>) })()}
                {anns.length > 0 && (
                    <g>
                        <rect x={annBoxX - 1} y={annBoxY - 1} width={annBoxW + 2} height={annBoxH + 2} fill="rgba(0,0,0,0.15)" rx={4} />
                        <rect x={annBoxX} y={annBoxY} width={annBoxW} height={annBoxH} fill="#f0f4ff" stroke="#0044cc" strokeWidth={0.9} rx={3} />
                        <rect x={annBoxX} y={annBoxY} width={annBoxW} height={15} fill="#0044cc" rx={3} />
                        <rect x={annBoxX} y={annBoxY + 10} width={annBoxW} height={5} fill="#0044cc" />
                        <text x={annBoxX + annBoxW / 2} y={annBoxY + 10.5} textAnchor="middle" fontSize={7.5} fontWeight="bold" fill="white">DIMENSIONS DU PROJET</text>
                        {anns.map((ann, i) => <text key={i} x={annBoxX + 8} y={annBoxY + 28 + i * annLineH} fontSize={7.5} fill="#0033aa">• {ann}</text>)}
                    </g>
                )}
                {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
                    const rad = a * Math.PI / 180, r = a % 90 === 0 ? 16 : 10
                    return <line key={a} x1={28} y1={VH - 28} x2={28 + Math.cos(rad) * r} y2={VH - 28 + Math.sin(rad) * r} stroke="#333" strokeWidth={a % 90 === 0 ? 1.4 : 0.8} />
                })}
                <circle cx={28} cy={VH - 28} r={2.5} fill="#333" />
                <text x={28} y={VH - 50} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#111">N</text>
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
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>DP2</span>
                <div className="flex flex-col">
                    <h3 className="font-semibold text-white leading-tight">Plan de masse des constructions</h3>
                    {savedImage && <span className="text-[10px] text-green-400 font-medium">✓ Plan capturé pour le PDF</span>}
                </div>
                <button onClick={handleCapture} disabled={loading || !geoData || capturing} className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${savedImage ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/20'}`}>
                    {capturing ? (<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Capture...</>) : (<><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 011.664.89l.812 1.22A2 2 0 0010.07 10H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{savedImage ? 'Actualiser capture' : 'Capturer plan PDF'}</>)}
                </button>
            </div>
            <div ref={mapRef} className="relative aspect-video bg-[#e0e0e0] flex items-center justify-center overflow-hidden">
                {loading ? (<div className="text-center"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-xs" style={{ color: '#666' }}>Chargement BD TOPO...</p></div>) : geoData ? renderMap() : (<div className="text-center p-6 grayscale opacity-40"><div className="text-4xl mb-2">🗺️</div><p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">{error ? 'Erreur de chargement BD TOPO' : "Renseignez l'adresse pour générer le plan"}</p></div>)}
            </div>
        </div>
    )
}

function downloadImage(dataUrl: string, filename = 'apres-travaux-ia.png') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

function FacadeCard({
    label, before, after, isLoading, badge, onGenerateOrEdit, isGenerating, onRemove, onDelete, canGenerate, hideBefore, isSelected, onSelect, isSimple
}: {
    label: string; before: string | null; after: string | null
    isLoading: boolean; badge: string
    onGenerateOrEdit: (instruction: string) => void; isGenerating: boolean
    onRemove?: () => void; onDelete?: () => void
    canGenerate?: boolean
    hideBefore?: boolean
    isSelected?: boolean
    onSelect?: (val: boolean) => void
    isSimple?: boolean
}) {
    const [prompt, setPrompt] = useState('')
    const [showEditPanel, setShowEditPanel] = useState(false)

    if (isSimple) {
        return (
            <div 
                onClick={() => onSelect?.(!isSelected)}
                className={`dp-card flex flex-col gap-4 cursor-pointer transition-all duration-300 border-2 ${
                    isSelected ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-700 bg-slate-900'
                    }`}>
                        {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <span className="px-2 py-1 bg-slate-800 text-slate-400 font-bold text-[10px] rounded uppercase tracking-wider">{badge}</span>
                    <h3 className="font-bold text-slate-200 text-sm">{label}</h3>
                </div>

                <div className="rounded-xl overflow-hidden bg-slate-100 aspect-[3/2] border border-slate-200/5">
                    {before ? (
                        <img src={before} alt="Avant" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600 italic text-xs">Pas de photo</div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={`dp-card flex flex-col gap-5 transition-all duration-300 ${onSelect ? (isSelected ? 'border-violet-500/50 bg-violet-500/5' : 'border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100') : ''}`}>
            {/* Header */}
            <div className="flex items-center gap-3">
                {onSelect && (
                    <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={(e) => onSelect?.(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-violet-500 transition-all cursor-pointer mr-2"
                    />
                )}
                <span className="px-3 min-w-[3rem] h-10 bg-violet-100 text-violet-700 font-bold text-sm rounded-xl flex items-center justify-center whitespace-nowrap">{badge}</span>
                <h3 className="font-semibold text-slate-100">{label}</h3>
                <span className="ai-badge ml-auto">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    DALL·E 3
                </span>
                {onDelete && (
                    <button
                        onClick={onDelete}
                        title="Supprimer cette façade"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
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
                            <div className="rounded-xl overflow-hidden aspect-[3/2] flex flex-col items-center justify-center p-6 text-center relative border-2 border-dashed border-slate-800 bg-slate-900/40">
                                <div className="w-10 h-10 rounded-full border border-slate-800/50 flex items-center justify-center mb-3">
                                    <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Simulation IA</p>
                                <p className="text-[9px] text-slate-600 mt-1 max-w-[150px]">En attente de génération</p>
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

    // Sub-step management
    const [subStep, setSubStep] = useState(1) // 1: DP1, 2: DP2, 3: DP4, 4: Selection, 5: DP6, 6: DP5
    const [selectedFacades, setSelectedFacades] = useState<string[]>([])
    const [dp1Zoom, setDp1Zoom] = useState(500)
    const [croquisInstructions, setCroquisInstructions] = useState<Record<string, string>>({})
    const [generatingFacades, setGeneratingFacades] = useState<string[]>([])
    const [showModifyInput, setShowModifyInput] = useState<Record<string, 'dp6' | 'dp5' | null>>({})

    // Pre-fill AI instruction if empty
    useEffect(() => {
        if (!aiInstruction && formData.terrain.description_projet) {
            setAiInstruction(formData.terrain.description_projet)
        } else if (!aiInstruction) {
            setAiInstruction("Remplacement des menuiseries par des modèles en aluminium noir.")
        }
    }, [formData.terrain.description_projet])

    // Initialize selection with all facades that have a photo but no simulation yet
    useEffect(() => {
        if (selectedFacades.length === 0 && formData.photos.facades.length > 0) {
            setSelectedFacades(formData.photos.facades.filter(f => f.before && !f.after).map(f => f.id))
        }
    }, [formData.photos.facades])

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

    // Auto-trigger DP5 Technical Sketches when entering subStep 6
    useEffect(() => {
        if (subStep === 6) {
            const needsGeneration = formData.photos.facades.filter(f => f.after && !f.croquis && !generatingFacades.includes(f.id))
            if (needsGeneration.length > 0) {
                handleGenerateAICroquis()
            }
        }
    }, [subStep])

    const handleGenerateAICroquis = async (facadeId?: string, customInstruction?: string) => {
        const facadesToProcess = facadeId 
            ? formData.photos.facades.filter(f => f.id === facadeId && f.after)
            : formData.photos.facades.filter(f => f.after && !f.croquis)
            
        if (facadesToProcess.length === 0) return

        setIsGeneratingCroquis(true)
        setGeneratingFacades(prev => Array.from(new Set([...prev, ...facadesToProcess.map(f => f.id)])))

        try {
            const newFacades = [...formData.photos.facades]
            for (const f of facadesToProcess) {
                const imageUrl = await generateAICroquis(formData, f.after!, customInstruction)
                if (imageUrl) {
                    const compressedUrl = await compressDataURL(imageUrl)
                    const idx = newFacades.findIndex(nf => nf.id === f.id)
                    if (idx !== -1) newFacades[idx].croquis = compressedUrl
                }
                setGeneratingFacades(prev => prev.filter(id => id !== f.id))
            }
            updatePhotos({ facades: newFacades })
            setShowModifyInput({})
        } catch (err: any) {
            alert('Erreur: ' + err.message)
        } finally {
            setIsGeneratingCroquis(false)
            setGeneratingFacades([])
        }
    }

    const handleGenerateAIFirst = async (facadeId?: string, customInstruction?: string) => {
        const facadesToProcess = facadeId 
            ? formData.photos.facades.filter(f => f.id === facadeId && f.before)
            : formData.photos.facades.filter(f => selectedFacades.includes(f.id) && f.before && (!f.after || aiGenerated))
            
        if (facadesToProcess.length === 0) return

        setIsGeneratingAI(true)
        if (!facadeId) setAiGenerated(false)
        
        // Track which facades are actively generating to show local indicators
        setGeneratingFacades(prev => Array.from(new Set([...prev, ...facadesToProcess.map(f => f.id)])))

        try {
            const tokenRes = await fetch('/api/image-token', { cache: 'no-store' })
            if (!tokenRes.ok) throw new Error('Token error')
            const { key } = await tokenRes.json()

            const newFacades = [...formData.photos.facades]
            for (const f of facadesToProcess) {
                const prompt = buildAIAfterImagePrompt(formData, customInstruction || aiInstruction)
                const imageBase64 = f.before!
                let imageUrl: string | undefined

                if (imageBase64.startsWith('data:')) {
                    const resized = await new Promise<string>((resolve, reject) => {
                        const img = new Image(); img.onload = () => {
                            const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024
                            const ctx = canvas.getContext('2d')!
                            const scale = Math.max(1536 / img.width, 1024 / img.height)
                            const w = img.width * scale, h = img.height * scale
                            ctx.drawImage(img, (1536 - w) / 2, (1024 - h) / 2, w, h)
                            resolve(canvas.toDataURL('image/png'))
                        }; img.onerror = reject; img.src = imageBase64
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
                    if (!aiRes.ok) throw new Error('API Error')
                    const aiData = await aiRes.json()
                    imageUrl = aiData.data?.[0]?.b64_json ? `data:image/png;base64,${aiData.data[0].b64_json}` : aiData.data?.[0]?.url
                }

                if (imageUrl) {
                    const compressedUrl = await compressDataURL(imageUrl)
                    const idx = newFacades.findIndex(nf => nf.id === f.id)
                    if (idx !== -1) newFacades[idx].after = compressedUrl
                }
                
                // Remove from local generating set as each one finishes
                setGeneratingFacades(prev => prev.filter(id => id !== f.id))
            }
            updatePhotos({ facades: newFacades })
            if (!facadeId) setAiGenerated(true)
            setShowModifyInput({}) // Close any open modify inputs
        } catch (err: any) {
            alert('Erreur: ' + err.message)
        } finally {
            setIsGeneratingAI(false)
            setGeneratingFacades([])
        }
    }

    const handleEditForFacade = async (facadeId: string, instruction: string, isCroquis: boolean) => {
        const facade = formData.photos.facades.find(f => f.id === facadeId)
        if (!facade) return

        if (isCroquis) {
            setIsEditingCroquis(true)
            try {
                const imageUrl = await generateAICroquis(formData, facade.after!)
                if (imageUrl) {
                    const compressedUrl = imageUrl.startsWith('data:image') ? await compressDataURL(imageUrl) : imageUrl
                    const newFacades = formData.photos.facades.map(f => f.id === facadeId ? { ...f, croquis: compressedUrl } : f)
                    updatePhotos({ facades: newFacades })
                }
            } catch (err: any) { alert('Erreur: ' + err.message) }
            finally { setIsEditingCroquis(false) }
        } else {
            setIsEditingAI(true)
            try {
                const tokenRes = await fetch('/api/image-token', { cache: 'no-store' })
                if (!tokenRes.ok) throw new Error('Token error')
                const { key } = await tokenRes.json()
                
                const prompt = buildAIAfterImagePrompt(formData, instruction)
                const imageBase64 = facade.before!
                
                let newImage: string | undefined

                if (imageBase64 && imageBase64.startsWith('data:')) {
                    const resized = await new Promise<string>((resolve, reject) => {
                        const img = new Image(); img.onload = () => {
                            const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024
                            const ctx = canvas.getContext('2d')!
                            const scale = Math.max(1536 / img.width, 1024 / img.height)
                            const w = img.width * scale, h = img.height * scale
                            ctx.drawImage(img, (1536 - w) / 2, (1024 - h) / 2, w, h)
                            resolve(canvas.toDataURL('image/png'))
                        }; img.onerror = reject; img.src = imageBase64
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
                    if (!aiRes.ok) throw new Error('API error')
                    const aiData = await aiRes.json()
                    const item = aiData.data?.[0]
                    newImage = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
                }

                if (newImage) {
                    const compressedUrl = newImage.startsWith('data:image') ? await compressDataURL(newImage) : newImage
                    const newFacades = formData.photos.facades.map(f => f.id === facadeId ? { ...f, after: compressedUrl } : f)
                    updatePhotos({ facades: newFacades })
                }
            } catch (err: any) { alert('Erreur: ' + err.message) }
            finally { setIsEditingAI(false) }
        }
    }

    const handleGenerateDP4 = async () => {
        setIsGeneratingDP4(true)
        try {
            const photosPayload = []
            // Include all facade photos (all existings)
            for (const f of formData.photos.facades) {
                if (f.before) photosPayload.push(f.before)
                if (f.after) photosPayload.push(f.after)
                if (f.croquis) photosPayload.push(f.croquis)
            }
            if (formData.photos.dp7_vue_proche) photosPayload.push(formData.photos.dp7_vue_proche)
            if (formData.photos.dp8_vue_lointaine) photosPayload.push(formData.photos.dp8_vue_lointaine)

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

    const renderSubStepNavigation = () => {
        const steps = [
            { id: 1, label: 'DP1 : Situation', icon: '🗺️' },
            { id: 2, label: 'DP2 : Masse', icon: '📐' },
            { id: 3, label: 'DP4 : Notice', icon: '📝' },
            { id: 4, label: 'Photos / Sélection', icon: '🖼️' },
            { id: 5, label: 'DP6 : Insertion', icon: '✨' },
            { id: 6, label: 'DP5 : Façades', icon: '🎨' }
        ]

        return (
            <div className="mb-12">
                <div className="flex items-center justify-between relative px-2">
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 w-full h-[1px] bg-slate-800 -translate-y-1/2 z-0" />
                    
                    {steps.map((s, idx) => (
                        <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer" onClick={() => (s.id < subStep || aiGenerated) && setSubStep(s.id)}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                                subStep === s.id ? 'bg-blue-600 border-blue-400 scale-110 shadow-[0_0_20px_rgba(37,99,235,0.4)]' :
                                subStep > s.id ? 'bg-green-500/20 border-green-500/50' : 'bg-slate-900 border-slate-700'
                            }`}>
                                {subStep > s.id ? (
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className={`text-xs font-bold ${subStep === s.id ? 'text-white' : 'text-slate-500'}`}>{s.id}</span>
                                )}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-widest text-center max-w-[80px] leading-tight transition-colors ${
                                subStep === s.id ? 'text-blue-400' : 'text-slate-600'
                            }`}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <StepLayout>
            <div className="animate-fadeIn max-w-5xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">PIÈCES GRAPHIQUES</h2>
                        <p className="text-slate-500 mt-1.5 font-medium">Finalisation et génération du dossier administratif</p>
                    </div>
                </div>

                {renderSubStepNavigation()}

                <div className="space-y-6">
                    {/* SUB-STEP 1: DP1 */}
                    {subStep === 1 && (
                        <div className="space-y-8 animate-slideUp">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 mb-2">
                                <h3 className="text-lg font-bold text-white mb-2">Plan de situation du terrain (DP1)</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Ce plan permet de situer précisément votre terrain dans la commune. Utilisez le curseur pour ajuster le zoom si nécessaire.
                                </p>
                            </div>
                            <MapCard
                                title="Plan de Situation"
                                code="DP1"
                                address={address}
                                commune={commune}
                                color="blue"
                                zoom={dp1Zoom}
                                onZoomChange={setDp1Zoom}
                                onCapture={(img) => updatePlans({ dp1_carte_situation: img })}
                                savedImage={formData.plans.dp1_carte_situation}
                            />
                            <div className="flex justify-end pt-4">
                                <button onClick={() => setSubStep(2)} className="dp-btn-primary px-8">
                                    Confirmer le DP1
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 2: DP2 */}
                    {subStep === 2 && (
                        <div className="space-y-8 animate-slideUp">
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-2">
                                <h3 className="text-lg font-bold text-white mb-2">Plan de masse (DP2)</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Représentation graphique de l'emprise au sol des constructions et des limites du terrain. Les dimensions sont calculées automatiquement.
                                </p>
                            </div>
                            <Dp2VectorCard
                                address={address}
                                commune={commune}
                                formData={formData}
                                onCapture={(img) => updatePlans({ dp2_plan_masse: img })}
                                savedImage={formData.plans.dp2_plan_masse}
                            />
                            <div className="flex justify-between pt-4">
                                <button onClick={() => setSubStep(1)} className="dp-btn-secondary">Retour</button>
                                <button onClick={() => setSubStep(3)} className="dp-btn-primary px-8">
                                    Confirmer le DP2
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 3: NOTICE */}
                    {subStep === 3 && (
                        <div className="space-y-6 animate-slideUp">
                            <div className="dp-card">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="w-12 h-12 bg-violet-500/10 text-violet-400 font-bold text-base rounded-2xl flex items-center justify-center border border-violet-500/20">DP4</span>
                                    <div>
                                        <h3 className="font-bold text-white">Notice descriptive du projet</h3>
                                        <p className="text-xs text-slate-500">Décrit l'état initial et les modifications projetées</p>
                                    </div>
                                    <button
                                        onClick={handleGenerateDP4}
                                        disabled={isGeneratingDP4}
                                        className="ml-auto px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-violet-900/20"
                                    >
                                        {isGeneratingDP4 ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : <span className="text-base">✨</span>}
                                        {isGeneratingDP4 ? 'Rédaction IA...' : 'Rédiger avec l\'IA'}
                                    </button>
                                </div>
                                <textarea
                                    className="dp-input min-h-[400px] resize-y font-mono text-xs p-6 !bg-slate-900/30 border-slate-800"
                                    value={dp4Notice}
                                    disabled={isGeneratingDP4}
                                    onChange={e => {
                                        setDp4Notice(e.target.value)
                                        updatePlans({ dp4_notice: e.target.value })
                                    }}
                                />
                            </div>
                            <div className="flex justify-between pt-4">
                                <button onClick={() => setSubStep(2)} className="dp-btn-secondary">Retour</button>
                                <button onClick={() => setSubStep(4)} className="dp-btn-primary px-8">
                                    Valider la notice
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 4: SELECTION */}
                    {subStep === 4 && (
                        <div className="space-y-8 animate-slideUp">
                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-4">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white tracking-tight">Quelles façades souhaitez-vous transformer ?</h3>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                                    Sélectionnez les photos pour lesquelles vous souhaitez générer une simulation IA (DP6). Toutes les simulations générées seront automatiquement converties en plans techniques (DP5).
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {formData.photos.facades.filter(f => f.before).map((f) => (
                                    <FacadeCard
                                        key={f.id}
                                        label={f.label}
                                        badge="À transformer"
                                        before={f.before}
                                        after={null}
                                        isLoading={false}
                                        isGenerating={false}
                                        isSimple={true}
                                        isSelected={selectedFacades.includes(f.id)}
                                        onSelect={(val) => {
                                            if (val) setSelectedFacades([...selectedFacades, f.id])
                                            else setSelectedFacades(selectedFacades.filter(id => id !== f.id))
                                        }}
                                        onGenerateOrEdit={() => {}}
                                    />
                                ))}
                            </div>

                            <div className="flex justify-between pt-8 border-t border-slate-800/50">
                                <button onClick={() => setSubStep(3)} className="dp-btn-secondary">Retour</button>
                                <button 
                                    onClick={() => setSubStep(5)} 
                                    className="dp-btn-primary px-10"
                                    disabled={selectedFacades.length === 0}
                                >
                                    Valider la sélection ({selectedFacades.length})
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 5: DP6 (IA INSERTION) */}
                    {subStep === 5 && (
                        <div className="space-y-12 animate-slideUp">
                            {/* Simple Generation Board */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <div className="flex flex-col lg:flex-row gap-8 items-start">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">SIMULATION IA (DP6)</h3>
                                            <p className="text-slate-500 text-xs">Décrivez les modifications pour générer l'insertion paysagère</p>
                                        </div>
                                        <textarea
                                            className="w-full min-h-[120px] bg-black/30 border border-slate-700 focus:border-blue-500 rounded-2xl p-5 text-white placeholder-slate-600 transition-all outline-none text-sm"
                                            placeholder="Ex: Remplacer le portail actuel par un modèle en aluminium noir..."
                                            value={aiInstruction}
                                            onChange={e => setAiInstruction(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-full lg:w-[280px] space-y-4">
                                        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 space-y-2">
                                            <div className="flex justify-between text-[11px] font-medium">
                                                <span className="text-slate-500 uppercase tracking-widest">Photos sélectionnées</span>
                                                <span className="text-white font-bold">{selectedFacades.length}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleGenerateAIFirst()}
                                            disabled={isGeneratingAI || selectedFacades.length === 0}
                                            className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
                                        >
                                            {isGeneratingAI ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : <span className="text-xl">✨</span>}
                                            {isGeneratingAI ? 'Génération...' : `Lancer la simulation`}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Spacious Results Display */}
                            <div className="space-y-16">
                                {formData.photos.facades.filter(f => selectedFacades.includes(f.id)).map((f) => (
                                    <div key={f.id} className="group">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-8 w-[2px] bg-blue-500" />
                                            <h4 className="text-xl font-bold text-white tracking-tight">{f.label}</h4>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            {/* Before */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">État Actuel</span>
                                                </div>
                                                <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border border-slate-800 bg-slate-900/50">
                                                    {f.before && <img src={f.before} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700" alt="Avant" />}
                                                </div>
                                            </div>
                                            {/* After */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Projet (Simulation DP6)</span>
                                                    {f.after && <span className="text-[10px] font-bold text-green-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Prêt</span>}
                                                </div>
                                                <div className="relative aspect-[3/2] rounded-[2rem] overflow-hidden transition-all duration-500">
                                                    {generatingFacades.includes(f.id) ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border-2 border-slate-800 rounded-[2rem] animate-pulse">
                                                            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                                                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Génération IA...</span>
                                                        </div>
                                                    ) : f.after ? (
                                                        <div className="relative w-full h-full group/res overflow-hidden rounded-[2rem] border-2 border-blue-500/30">
                                                            <img src={f.after} className="w-full h-full object-cover" alt="Après" />
                                                            
                                                            {/* Result Controls Overlay */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/res:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    <button
                                                                        onClick={() => downloadImage(f.after!, `${f.label}-resultat.png`)}
                                                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-white/20 transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                        Télécharger
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setShowModifyInput({[f.id]: 'dp6'})}
                                                                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/60 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-blue-500/30 transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        Modifier
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            const newFacades = formData.photos.facades.map(nf => nf.id === f.id ? { ...nf, after: null, croquis: null } : nf)
                                                                            updatePhotos({ facades: newFacades })
                                                                        }}
                                                                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/60 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-red-500/30 transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        Supprimer
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Inline Modification Input */}
                                                            {showModifyInput[f.id] === 'dp6' && (
                                                                <div className="absolute inset-x-4 bottom-4 bg-slate-900/95 backdrop-blur-xl border border-blue-500/50 rounded-2xl p-4 animate-slideUp shadow-2xl z-20">
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Modification Simulation</span>
                                                                            <button onClick={() => setShowModifyInput({})} className="text-slate-500 hover:text-white transition-colors">
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            </button>
                                                                        </div>
                                                                        <textarea 
                                                                            autoFocus
                                                                            value={aiInstruction}
                                                                            onChange={(e) => setAiInstruction(e.target.value)}
                                                                            className="bg-black/40 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none transition-all"
                                                                            rows={2}
                                                                            placeholder="Décrivez les changements..."
                                                                        />
                                                                        <button
                                                                            onClick={() => handleGenerateAIFirst(f.id, aiInstruction)}
                                                                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                                                                        >
                                                                            <span className="text-xs">✨</span> Régénérer Simulation
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/40 text-slate-600 transition-colors">
                                                            {isGeneratingAI && selectedFacades.includes(f.id) ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Initialisation...</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="w-12 h-12 rounded-full border border-slate-800/50 flex items-center justify-center mb-4">
                                                                        <svg className="w-6 h-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">En attente de génération</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-12 border-t border-slate-800">
                                <button onClick={() => setSubStep(4)} className="dp-btn-secondary">Retour à la sélection</button>
                                <button 
                                    onClick={() => setSubStep(6)} 
                                    disabled={!formData.photos.facades.some(f => f.after)}
                                    className="dp-btn-primary px-10"
                                >
                                    Suivant : Plans techniques
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 6: DP5 (CROQUIS) */}
                    {subStep === 6 && (
                        <div className="space-y-12 animate-slideUp">
                            <div className="bg-blue-600/10 border border-blue-500/30 rounded-[2rem] p-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                                <div className="max-w-xl">
                                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">PLANS DES FAÇADES (DP5)</h3>
                                    <p className="text-blue-200/70 text-sm leading-relaxed">
                                        Conversion automatique de vos simulations IA en croquis techniques 2D conformes aux exigences administratives.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleGenerateAICroquis()}
                                    disabled={isGeneratingCroquis}
                                    className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/40 transition-all flex items-center gap-3 whitespace-nowrap"
                                >
                                    {isGeneratingCroquis ? (
                                        <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : <span className="text-xl">🎨</span>}
                                    {isGeneratingCroquis ? 'Conversion...' : 'Régénérer les croquis'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-16">
                                {formData.photos.facades.filter(f => f.after).map((f) => (
                                    <div key={f.id} className="space-y-8">
                                        <h4 className="text-xl font-bold text-white border-l-4 border-blue-500 pl-4">{f.label}</h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border border-slate-800 relative bg-slate-900">
                                                <img src={f.after!} className="w-full h-full object-cover opacity-40 grayscale" alt="Base Simulation" />
                                                <div className="absolute top-6 left-6 px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">Base IA</div>
                                            </div>
                                            <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border-2 border-blue-500/30 relative bg-white flex items-center justify-center p-8 group/res">
                                                {generatingFacades.includes(f.id) ? (
                                                    <div className="text-center">
                                                        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rendu Vectoriel...</span>
                                                    </div>
                                                ) : f.croquis ? (
                                                    <>
                                                        <img src={f.croquis} className="max-w-full max-h-full object-contain" alt="Plan Technique" />
                                                        
                                                        {/* Result Controls Overlay */}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/res:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                            <div className="flex flex-wrap gap-2 justify-center">
                                                                <button
                                                                    onClick={() => downloadImage(f.croquis!, `${f.label}-croquis.png`)}
                                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-white/20 transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                    Télécharger
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowModifyInput({[f.id]: 'dp5'})}
                                                                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/60 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-blue-500/30 transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                    Modifier
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const newFacades = formData.photos.facades.map(nf => nf.id === f.id ? { ...nf, croquis: null } : nf)
                                                                        updatePhotos({ facades: newFacades })
                                                                    }}
                                                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/60 backdrop-blur-md text-white rounded-xl text-[10px] font-bold border border-red-500/30 transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                    Supprimer
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Inline Modification Input for DP5 */}
                                                        {showModifyInput[f.id] === 'dp5' && (
                                                            <div className="absolute inset-x-4 bottom-4 bg-slate-900/95 backdrop-blur-xl border border-blue-500/50 rounded-2xl p-4 animate-slideUp shadow-2xl z-20">
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Affinage croquis (DP5)</span>
                                                                        <button onClick={() => setShowModifyInput({})} className="text-slate-500 hover:text-white transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </button>
                                                                    </div>
                                                                    <input 
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="Ex: Préciser 'RAL 7016' sur le texte..."
                                                                        className="bg-black/40 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
                                                                        value={croquisInstructions[f.id] || ''}
                                                                        onChange={(e) => setCroquisInstructions({...croquisInstructions, [f.id]: e.target.value})}
                                                                    />
                                                                    <button
                                                                        onClick={() => handleGenerateAICroquis(f.id, croquisInstructions[f.id])}
                                                                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <span className="text-xs">🎨</span> Régénérer Croquis
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 w-full h-full bg-slate-50">
                                                        {(isGeneratingCroquis || isGeneratingAI) && selectedFacades.includes(f.id) ? (
                                                            <div className="text-center">
                                                                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En attente...</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Croquis en attente</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="absolute top-6 right-6 px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">DP5</div>
                                            </div>
                                        </div>
                                        
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-12 border-t border-slate-800">
                                <button onClick={() => setSubStep(5)} className="dp-btn-secondary">Retour</button>
                                <button onClick={() => router.push('/etape/6')} className="group px-12 py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-green-900/40 transition-all flex items-center gap-3">
                                    Finaliser le dossier
                                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Return navigation */}
                <div className="flex justify-start mt-16 pt-8 border-t border-slate-900">
                    <button onClick={() => router.push('/etape/4')} className="text-slate-600 hover:text-slate-400 text-sm font-bold flex items-center gap-3 transition-colors uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        Retour aux photos
                    </button>
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

