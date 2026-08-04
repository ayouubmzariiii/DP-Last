'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { generateAICroquis, buildAIAfterImagePrompt, buildAICroquisPrompt, buildAIAfterImagePrompt as buildDP6Prompt, resizeImageForOpenAI } from '@/lib/aiImageGenerator'
import { getTravauxDef, travauxNatureLabel } from '@/lib/travauxRegistry'
import { DPFormData } from '@/lib/models'
import { uploadImage } from '@/lib/uploadImage'
import html2canvas from 'html2canvas'
import { geocodeAddress, DP1_DEFAULT_GROUND_M } from '@/lib/ignMaps'
import { AUDIT_LABELS, type FacadeAudit } from '@/lib/facadeAudit'
import { buildPlanMasseSvg } from '@/lib/planMasse'
import { generateCoupeSvg } from '@/lib/coupeData'

const MAX_IMG_SIZE = 1.5 * 1024 * 1024 // 1.5MB to save bandwidth for Nemotron

/** Échelle imprimée du DP1, pour informer le choix de l'emprise.
 *  Sur la planche A3 la capture 16:9 est ajustée à 480 pt de haut, soit ≈ 853 pt (301 mm) de large
 *  (cf. dpDocGenerator, page DP1). Estimation arrondie — le cartouche du PDF fait foi. */
function dp1PrintedRatio(groundM: number): number {
    const printedWidthM = (853 / 72) * 0.0254
    return Math.max(100, Math.round(groundM / printedWidthM / 100) * 100)
}


function MapCard({
    title, code, address, commune, color = 'blue', zoom, onZoomChange, onCapture, savedImage, coords
}: {
    title: string; code: string; address: string; commune: string; color?: 'blue' | 'green'
    zoom?: number; onZoomChange?: (z: number) => void;
    onCapture?: (img: string) => void;
    savedImage?: string | null;
    coords?: { lat: number; lon: number };
}) {
    const [mapUrl, setMapUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!commune && !address && !coords) return
        setLoading(true)
        setError(false)

        const params = new URLSearchParams()
        if (address) params.append('address', address)
        if (commune) params.append('commune', commune)
        if (zoom) params.append('zoom', zoom.toString())
        if (coords) {
            params.append('lat', coords.lat.toString())
            params.append('lon', coords.lon.toString())
        }
        
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
    }, [address, commune, code, zoom, coords])

    const iconColor = color === 'green' ? '#4ade80' : '#2D5A4C'
    const codeColor = color === 'green' ? 'rgba(34,197,94,0.2)' : 'rgba(45,90,76,0.2)'

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
                    <h3 className="font-semibold t-ink leading-tight">{title}</h3>
                    {savedImage && <span className="text-[10px] t-ok font-medium">✓ Plan capturé pour le PDF</span>}
                </div>
                <button
                    onClick={handleCapture}
                    disabled={loading || !mapUrl || capturing}
                    className="ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
                    style={savedImage
                        ? { background: '#E8F0EC', color: '#2D5A4C', border: '1px solid #CFE0D8' }
                        : { background: '#2D5A4C', color: '#fff', boxShadow: '0 4px 12px -4px rgba(45,90,76,.5)' }}
                >
                    {capturing ? (
                        <>
                            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            Capture…
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 011.664.89l.812 1.22A2 2 0 0010.07 10H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {savedImage ? 'Actualiser' : 'Capturer pour le PDF'}
                        </>
                    )}
                </button>
            </div>

            {code === 'DP1' && onZoomChange && (
                <div className="px-5 pb-4 flex items-center gap-4 bg-[var(--surface-2)] mx-4 mb-4 rounded-xl border border-white/10 py-3">
                    <div className="flex-1">
                        <div className="flex justify-between mb-1.5">
                            <span className="text-[10px] font-bold t-ink2 uppercase tracking-wider">Emprise du plan</span>
                            {/* Le ratio imprimé, pas seulement l'emprise : c'est lui qui figure au
                                cartouche du PDF, donc c'est lui que l'on choisit ici en connaissance. */}
                            <span className="text-[10px] font-mono t-accent">{zoom} m au sol · ≈ 1/{dp1PrintedRatio(zoom!)}</span>
                        </div>
                        <input
                            type="range"
                            min="300"
                            max="4000"
                            step="100"
                            value={zoom}
                            onChange={(e) => onZoomChange(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-[var(--line-3)] rounded-lg appearance-none cursor-pointer"
                            style={{ accentColor: 'var(--ac)' }}
                        />
                        <p className="text-[10px] t-muted mt-1.5 leading-snug">
                            Le plan doit permettre de situer le terrain <strong>dans la commune</strong> (art. R. 431-36 a).
                        </p>
                    </div>
                </div>
            )}

            <div ref={mapRef} className="relative aspect-video bg-white flex items-center justify-center">
                {loading ? (
                    <div className="text-center">
                        <div className="dp-spinner dp-spinner-lg mx-auto mb-2" />
                        <p className="text-xs t-muted">Chargement de la carte IGN...</p>
                    </div>
                ) : mapUrl ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mapUrl} alt={title} className="w-full h-full object-cover"
                            onLoad={() => { if (onCapture && !savedImage) setTimeout(() => handleCapture(), 400) }} />
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
                        <p className="text-xs t-ink2 max-w-[200px] leading-relaxed">
                            {error ? "Erreur de chargement des cartes IGN" : "Renseignez l'adresse pour générer les plans"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

/** DP2 vector plan card — fetches BD TOPO & Cadastre GeoJSON and renders as SVG */
function Dp2VectorCard({ address, commune, formData, onCapture, savedImage, coords }: { address: string; commune: string; formData: any; onCapture?: (img: string) => void; savedImage?: string | null; coords?: { lat: number; lon: number } }) {
    const [geoData, setGeoData] = useState<{ cadastre: any; bati: any; center: number[] } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const [capturing, setCapturing] = useState(false)
    const mapRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!commune && !address && !coords) return
        setLoading(true)
        setError(false)

        const fetchVector = async (lat: number, lon: number) => {
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
        }

        if (coords) {
            fetchVector(coords.lat, coords.lon)
                .catch(err => {
                    console.error('DP2 vector load error:', err)
                    setError(true)
                })
                .finally(() => setLoading(false))
        } else {
            geocodeAddress(address, commune)
                .then(async (c) => {
                    if (!c) throw new Error('Geocoding failed')
                    return fetchVector(c.lat, c.lon)
                })
                .catch(err => {
                    console.error('DP2 vector load error:', err)
                    setError(true)
                })
                .finally(() => setLoading(false))
        }
    }, [address, commune, coords])

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

    // Auto-capture once the vector plan has rendered, so DP2 is ready without a manual click.
    const autoCapturedRef = useRef(false)
    useEffect(() => {
        if (geoData?.cadastre?.features?.length && !savedImage && !autoCapturedRef.current) {
            autoCapturedRef.current = true
            const t = setTimeout(() => handleCapture(), 700)
            return () => clearTimeout(t)
        }
    }, [geoData, savedImage])

    const renderMap = () => {
        if (!geoData || !geoData.cadastre) return null
        const [cx, cy] = geoData.center
        const terrain = formData?.terrain || {}, travaux = formData?.travaux || {}

        // "Dimensions du projet" box lines — terrain/plancher surfaces + type-specific details.
        const anns: string[] = []
        if (terrain.surface_terrain) anns.push(`Terrain: ${terrain.surface_terrain} m²`)
        if (terrain.surface_plancher) anns.push(`Plancher: ${terrain.surface_plancher} m²`)
        anns.push(`Surface créée: ${travaux.surfaces?.creee || '0'} m²`)
        anns.push(`Existante: ${travaux.surfaces?.existante || '0'} m²`)
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            anns.push(`Menuiseries: ${travaux.menuiseries.largeur || '?'}×${travaux.menuiseries.hauteur || '?'} cm`)
            if (travaux.menuiseries.type) anns.push(`Type: ${String(travaux.menuiseries.type).replace('_', ' ')}`)
        }
        if (travaux.type === 'isolation' && travaux.isolation) anns.push(`Isolant: e=${travaux.isolation.epaisseur_isolant || '?'} cm`)
        if (travaux.type === 'photovoltaique' && travaux.photovoltaique) anns.push(`PV: ${travaux.photovoltaique.surface_totale || '?'} m² (${travaux.photovoltaique.nombre_panneaux || '?'} pan.)`)

        // Delegated to the shared, framework-agnostic generator (also used by the PDF). Adds the
        // "Localisation des travaux" marker + point-in-polygon parcel selection over the old inline SVG.
        const svg = buildPlanMasseSvg({
            cadastre: geoData.cadastre,
            bati: geoData.bati,
            center: [cx, cy],
            wantSection: terrain.section_cadastrale,
            wantNumero: terrain.numero_parcelle,
            worksLabel: travaux.type ? travauxNatureLabel(formData as DPFormData) : undefined,
            annotations: anns,
        })
        return <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    }

    return (
        <div className="dp-card overflow-hidden">
            <div className="flex items-center gap-3 mb-4 px-4 pt-4">
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>DP2</span>
                <div className="flex flex-col">
                    <h3 className="font-semibold t-ink leading-tight">Plan de masse des constructions</h3>
                    {savedImage && <span className="text-[10px] t-ok font-medium">✓ Plan capturé pour le PDF</span>}
                </div>
                <button onClick={handleCapture} disabled={loading || !geoData || capturing} className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${savedImage ? 'bg-[var(--act)] t-ok border border-[color:var(--acb)] hover:bg-green-500/30' : 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/20'}`}>
                    {capturing ? (<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Capture...</>) : (<><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 011.664.89l.812 1.22A2 2 0 0010.07 10H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{savedImage ? 'Actualiser capture' : 'Capturer plan PDF'}</>)}
                </button>
            </div>
            <div ref={mapRef} className="relative aspect-video bg-[#e0e0e0] flex items-center justify-center overflow-hidden">
                {loading ? (<div className="text-center"><div className="dp-spinner dp-spinner-lg mx-auto mb-2" /><p className="text-xs" style={{ color: '#666' }}>Chargement BD TOPO...</p></div>) : geoData ? renderMap() : (<div className="text-center p-6 grayscale opacity-40"><div className="text-4xl mb-2">🗺️</div><p className="text-xs t-ink2 max-w-[200px] leading-relaxed">{error ? 'Erreur de chargement BD TOPO' : "Renseignez l'adresse pour générer le plan"}</p></div>)}
            </div>
        </div>
    )
}

/** DP3 plan de coupe — builds the section from real IGN altimetry + cadastre and captures it. */
function Dp3CoupeCard({ formData, savedImage, onCapture }: { formData: any; savedImage?: string | null; onCapture?: (img: string) => void }) {
    const [svg, setSvg] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [capturing, setCapturing] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)
    const autoRef = useRef(false)

    const tr = formData.travaux
    const key = JSON.stringify({ t: tr.type, p: tr.piscine, e: tr.extension, a: tr.abri, r: tr.terrassement, c: formData.terrain.coords, dc: formData.demandeur?.coords, ma: formData.terrain.meme_adresse, s: formData.terrain.section_cadastrale, n: formData.terrain.numero_parcelle })
    useEffect(() => {
        let cancelled = false
        setLoading(true); setError(null); autoRef.current = false
        generateCoupeSvg(formData, { date: new Date().toLocaleDateString('fr-FR') })
            .then(res => { if (cancelled) return; if (!res) { setError('Coupe indisponible — vérifiez l’adresse du terrain.'); setSvg(null) } else { setSvg(res.svg) } })
            .catch(() => { if (!cancelled) { setError('Chargement de l’altimétrie IGN impossible. Réessayez.'); setSvg(null) } })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    // Rasterize the pure-SVG string directly (Image → canvas). More reliable than html2canvas,
    // which mis-handles the coupe's <clipPath>/earth-hatch and produced a blank capture.
    const handleCapture = async () => {
        if (!svg) return
        setCapturing(true)
        try {
            const sized = svg.replace('<svg ', '<svg width="1280" height="720" ')
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized)
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const img = new Image()
                img.onload = () => {
                    const c = document.createElement('canvas'); c.width = 1280; c.height = 720
                    const ctx = c.getContext('2d'); if (!ctx) return reject(new Error('no 2d context'))
                    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, 1280, 720); ctx.drawImage(img, 0, 0, 1280, 720)
                    resolve(c.toDataURL('image/png'))
                }
                img.onerror = () => reject(new Error('SVG rasterisation failed'))
                img.src = url
            })
            onCapture?.(dataUrl)
        } catch (e) { console.error('DP3 capture error:', e) }
        finally { setCapturing(false) }
    }
    useEffect(() => {
        if (svg && !savedImage && !autoRef.current) { autoRef.current = true; const tmt = setTimeout(handleCapture, 800); return () => clearTimeout(tmt) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [svg, savedImage])

    return (
        <div className="dp-card overflow-hidden">
            <div className="flex items-center gap-3 mb-4 px-4 pt-4">
                <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center" style={{ background: 'rgba(176,85,47,0.15)', color: '#B0552F' }}>DP3</span>
                <div className="flex flex-col">
                    <h3 className="font-semibold t-ink leading-tight">Plan de coupe du terrain et de la construction</h3>
                    {savedImage ? <span className="text-[10px] t-ok font-medium">✓ Coupe capturée pour le PDF</span> : <span className="text-[10px] t-ink2">Profil du terrain naturel depuis l’altimétrie IGN</span>}
                </div>
                <button onClick={handleCapture} disabled={loading || !svg || capturing} className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 ${savedImage ? 'bg-[var(--act)] t-ok border border-[color:var(--acb)]' : 'text-white'}`} style={savedImage ? {} : { background: '#B0552F' }}>
                    {capturing ? (<><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Capture…</>) : (savedImage ? 'Actualiser' : 'Capturer pour le PDF')}
                </button>
            </div>
            <div ref={boxRef} className="relative aspect-video bg-[#fbfaf7] flex items-center justify-center overflow-hidden">
                {loading ? (<div className="text-center"><div className="dp-spinner dp-spinner-lg mx-auto mb-2" /><p className="text-xs t-ink2">Calcul du profil du terrain (IGN RGE ALTI)…</p></div>)
                    : svg ? (<div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg }} />)
                        : (<div className="text-center p-6"><div className="text-4xl mb-2 grayscale opacity-40">📐</div><p className="text-xs t-ink2 max-w-[240px] leading-relaxed">{error || 'Coupe indisponible.'}</p></div>)}
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
                    isSelected ? 'border-[color:var(--acb)] bg-[var(--act)]' : 'border-[color:var(--line)] hover:border-[color:var(--line-3)]'
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-[var(--ac)] border-[color:var(--ac)]' : 'border-[color:var(--line-3)] bg-[var(--surface-2)]'
                    }`}>
                        {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <span className="px-2 py-1 bg-[var(--surface-2)] t-ink2 font-bold text-[10px] rounded uppercase tracking-wider">{badge}</span>
                    <h3 className="font-bold t-ink text-sm">{label}</h3>
                </div>

                <div className="rounded-xl overflow-hidden bg-[var(--surface-2)] aspect-[3/2] border border-[color:var(--line)]">
                    {before ? (
                        <img src={before} alt="Avant" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] t-ink2 italic text-xs">Pas de photo</div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={`dp-card flex flex-col gap-5 transition-all duration-300 ${onSelect ? (isSelected ? 'border-[color:var(--acb)] bg-[var(--act)]' : 'border-[color:var(--line)] hover:border-[color:var(--line-3)] opacity-80 hover:opacity-100') : ''}`}>
            {/* Header */}
            <div className="flex items-center gap-3">
                {onSelect && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect?.(e.target.checked)}
                        className="w-5 h-5 rounded border-[color:var(--line-3)] bg-[var(--surface-2)] focus:ring-2 transition-all cursor-pointer mr-2"
                        style={{ accentColor: 'var(--ac)' }}
                    />
                )}
                <span className="px-3 min-w-[3rem] h-10 bg-[var(--act)] t-accent font-bold text-sm rounded-xl flex items-center justify-center whitespace-nowrap">{badge}</span>
                <h3 className="font-semibold t-ink">{label}</h3>
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
                        className="p-1.5 rounded-lg t-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
                        <p className="text-xs font-semibold t-muted mb-2 uppercase tracking-wide">Photo Avant</p>
                        <div className="rounded-xl overflow-hidden bg-[var(--surface-2)] aspect-[3/2] flex items-center justify-center border border-[color:var(--line)]">
                            {before ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={before} alt="Avant" className="w-full h-full object-cover" />
                            ) : (
                                <span className="t-ink2 text-sm">Pas de photo</span>
                            )}
                        </div>
                    </div>
                )}
                <div>
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${hideBefore ? 't-accent' : 't-accent'}`}>{hideBefore ? 'Croquis Architectural' : 'Simulation Après'}</p>
                    {isGenerating ? (
                        <div className="rounded-xl overflow-hidden aspect-[3/2] flex flex-col items-center justify-center relative shadow-inner" style={{ background: 'rgba(45,90,76,0.04)', border: '1px dashed rgba(45,90,76,0.2)' }}>
                            <div className="text-center" style={{ color: '#2D5A4C' }}>
                                <div className="dp-spinner dp-spinner-lg mx-auto mb-3 shadow-[0_0_15px_rgba(45,90,76,0.3)]" />
                                <span className="text-xs font-medium tracking-wide animate-pulse">Création de l'image en cours...</span>
                            </div>
                        </div>
                    ) : after ? (
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl overflow-hidden aspect-[3/2] flex items-center justify-center relative shadow-inner" style={{ background: 'var(--surface-2)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={after} alt="Après" className="w-full h-full object-cover" />
                                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                    <button
                                        onClick={() => downloadImage(after, `${badge}-simulation.png`)}
                                        title="Télécharger l'image"
                                        className="dp-tool-btn px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all"
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
                                            className="dp-tool-btn is-danger px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all"
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
                                    className="px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all text-white border border-[color:var(--acb)]"
                                    style={{
                                        background: showEditPanel ? 'var(--ac)' : 'rgba(45,90,76,0.1)',
                                        boxShadow: showEditPanel ? '0 0 15px rgba(45,90,76,0.3)' : 'none'
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
                            <div className="rounded-xl overflow-hidden aspect-[3/2] flex flex-col items-center justify-center p-6 text-center relative border-2 border-dashed border-[color:var(--line)] bg-[var(--surface-2)]">
                                <div className="w-10 h-10 rounded-full border border-[color:var(--line)] flex items-center justify-center mb-3">
                                    <svg className="w-5 h-5 t-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest t-muted">Simulation IA</p>
                                <p className="text-[9px] t-ink2 mt-1 max-w-[150px]">En attente de génération</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Instruction Panel (Animated Reveal) */}
            <div
                className={`transition-all duration-300 ease-in-out relative overflow-hidden ${showEditPanel ? 'opacity-100 max-h-[300px] mt-2' : 'opacity-0 max-h-0'}`}
            >
                <div className="rounded-xl p-5 relative" style={{ background: 'linear-gradient(135deg, rgba(45,90,76,0.05), rgba(45,90,76,0.02))', border: '1px solid rgba(45,90,76,0.2)' }}>
                    <div className="absolute top-0 right-10 flex space-x-1 -translate-y-1/2">
                        <div className="w-2 h-2 rounded-full bg-[var(--acb)] opacity-50 shadow-[0_0_5px_rgba(45,90,76,0.5)] animate-pulse" />
                        <div className="w-2 h-2 rounded-full bg-[var(--ac)] opacity-80 shadow-[0_0_5px_rgba(45,90,76,0.5)] animate-pulse delay-75" />
                        <div className="w-2 h-2 rounded-full bg-[var(--acd)] shadow-[0_0_5px_rgba(45,90,76,0.5)] animate-pulse delay-150" />
                    </div>

                    <p className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: '#2D5A4C' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Atelier magique : que souhaitez-vous modifier ?
                    </p>
                    <div className="flex gap-3 items-stretch">
                        <textarea
                            className="dp-input flex-1 min-h-[60px] resize-none text-[13px] t-ink placeholder-[color:var(--faint)] !bg-[var(--field-ro)] mx-0 border-x-0 border-t-0 !border-b-2 !border-b-[color:var(--acb)] focus:!bg-[var(--field)] focus:!border-b-[color:var(--ac)] focus:!ring-0 rounded-none rounded-t-xl px-4 py-3"
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
                            style={{ background: 'linear-gradient(135deg, #2D5A4C, #244A3E)', color: 'white', boxShadow: '0 4px 15px rgba(45,90,76,0.3)' }}
                        >
                            {isGenerating ? (
                                <div className="dp-spinner dp-spinner-sm on-accent" />
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

const compressImage = (file: File, maxWidth: number = 1600, quality: number = 0.85): Promise<string> => {
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

const compressDataURL = (dataUrl: string, maxWidth: number = 1500, quality: number = 0.82): Promise<string> => {
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


export default function Etape6() {
    const router = useRouter()
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updatePhotos, updatePlans, updateTravaux } = useDPContext()
    const [isGeneratingAI, setIsGeneratingAI] = useState(false)
    const [isGeneratingCroquis, setIsGeneratingCroquis] = useState(false)
    const [isEditingAI, setIsEditingAI] = useState(false)
    const [isEditingCroquis, setIsEditingCroquis] = useState(false)
    const [aiGenerated, setAiGenerated] = useState(false)
    const [dp4Notice, setDp4Notice] = useState(formData.plans.dp4_notice || '')
    // DP4 AI Text Generation
    const [isGeneratingDP4, setIsGeneratingDP4] = useState(false)

    // Sub-step management. Ids: 1 DP1 · 2 DP2 · 7 DP3 (only if the works modify the terrain
    // profile) · 3 DP4 · 4 Sélection · 5 DP6 · 6 DP5. The visible ORDER is driven by `flow`
    // so DP3 slots in right after DP2 without renumbering the other blocks.
    const [subStep, setSubStep] = useState(1)
    const dp3Required = !!getTravauxDef(formData.travaux.type)?.requiresDP3
    const flow = dp3Required ? [1, 2, 7, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]
    const goNext = () => { const i = flow.indexOf(subStep); if (i >= 0 && i < flow.length - 1) setSubStep(flow[i + 1]) }
    const goPrev = () => { const i = flow.indexOf(subStep); if (i > 0) setSubStep(flow[i - 1]) }
    const [selectedFacades, setSelectedFacades] = useState<string[]>([])
    // Emprise au sol du plan de situation, en VRAIS mètres. 1200 m ≈ 1/7000 une fois imprimé :
    // le terrain se lit dans sa commune, ce que demande l'art. R. 431-36 a). L'ancien réglage
    // (500 unités Web-Mercator ≈ 350 m au sol) ne montrait guère plus que le pâté de maisons.
    const [dp1Zoom, setDp1Zoom] = useState(DP1_DEFAULT_GROUND_M)
    // Rouvrir un dossier doit rouvrir SON emprise, pas le réglage par défaut : sinon le curseur
    // ment sur ce qui a été capturé, et la moindre recapture change l'échelle sans prévenir.
    const savedDp1Ground = formData.plans.dp1_ground_m
    useEffect(() => { if (savedDp1Ground) setDp1Zoom(savedDp1Ground) }, [savedDp1Ground])
    // Verdict du contrôle de fidélité, par façade. Non persisté : il porte sur LA génération
    // qui vient d'avoir lieu. Le serveur régénère déjà tout seul quand il détecte un écart ;
    // ce qui reste ici, c'est ce qu'il n'a pas réussi à corriger — et le demandeur doit le voir.
    const [facadeAudits, setFacadeAudits] = useState<Record<string, FacadeAudit | null>>({})
    const [croquisInstructions, setCroquisInstructions] = useState<Record<string, string>>({})
    const [generatingFacades, setGeneratingFacades] = useState<string[]>([])
    const [showModifyInput, setShowModifyInput] = useState<Record<string, 'dp6' | 'dp5' | null>>({})
    const [modifyInstruction, setModifyInstruction] = useState('')   // per-façade "modify this simulation" tweak

    // The DP6 simulation is driven by the project's single "description des travaux"
    // (travaux.description_projet, the same field entered at l'étape Travaux) — no separate,
    // duplicated instruction box. When it's empty we fall back to the registry's type-aware
    // description at generation time (see buildAIAfterImagePrompt), so the placeholder shows what
    // will be used. worksDescription is the effective prompt source used everywhere below.
    const worksDescription = (formData.travaux.description_projet || '').trim()
    const worksDescriptionSuggestion = getTravauxDef(formData.travaux.type)?.aiDescription(formData) || ''

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
    const coords = formData.terrain.meme_adresse
        ? formData.demandeur.coords
        : formData.terrain.coords

    // Warm DP1 (IGN static map) and DP2 (cadastre + bâti WFS) in the background as soon as the
    // location is known — so those sub-steps render from cache instead of fetching only when the
    // user arrives. The WFS URLs mirror Dp2VectorCard's exactly, for a browser-cache hit there.
    const preloadedRef = useRef('')
    useEffect(() => {
        const c = coords
        if (!c && !address && !commune) return
        const key = c ? `${c.lat},${c.lon}` : `${address}|${commune}`
        if (preloadedRef.current === key) return
        preloadedRef.current = key

        const params = new URLSearchParams()
        if (address) params.append('address', address)
        if (commune) params.append('commune', commune)
        params.append('zoom', String(dp1Zoom))
        if (c) { params.append('lat', String(c.lat)); params.append('lon', String(c.lon)) }
        fetch(`/api/preview-maps?${params.toString()}`)
            .then(r => r.json())
            .then(d => { if (d?.dp1Url) { const im = new Image(); im.src = d.dp1Url } })
            .catch(() => {})

        if (c) {
            const R = 6378137
            const cx = R * c.lon * Math.PI / 180
            const cy = R * Math.log(Math.tan(Math.PI / 4 + (c.lat * Math.PI / 180) / 2))
            const half = 80
            const bbox = [cx - half, cy - half, cx + half, cy + half].map(v => v.toFixed(2)).join(',')
            const base = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857`
            fetch(`${base}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bbox},EPSG:3857`).catch(() => {})
            fetch(`${base}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bbox},EPSG:3857`).catch(() => {})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, commune, coords])

    useEffect(() => {
        // Seed the DP4 notice with the auto-generated template ONLY when nothing is saved yet.
        // Never overwrite an existing notice — otherwise navigating back into this step would wipe
        // the "Rédiger avec l'IA" result (or the user's manual edits) and restore the default.
        if (formData.plans.dp4_notice) {
            setDp4Notice(formData.plans.dp4_notice)
            return
        }
        const notice = generateDP4Notice(formData)
        setDp4Notice(notice)
        updatePlans({ dp4_notice: notice })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.travaux.type, formData.plans.dp4_notice])

    // Auto-trigger DP5 Technical Sketches when entering subStep 6
    useEffect(() => {
        if (subStep === 6) {
            const needsGeneration = formData.photos.facades.filter(f => f.after && !f.croquis && !generatingFacades.includes(f.id))
            if (needsGeneration.length > 0) {
                handleGenerateAICroquis()
            }
        }
    }, [subStep])

    const handleGenerateAICroquis = async (facadeId?: string, customInstruction?: string, force = false) => {
        // Auto-run (no facadeId, no force) only fills MISSING croquis. A manual "Régénérer les
        // croquis" (force) re-traces every façade that has an "after" — so a croquis is never left
        // tracing a stale/previous projected image.
        const facadesToProcess = facadeId
            ? formData.photos.facades.filter(f => f.id === facadeId && f.after)
            : formData.photos.facades.filter(f => f.after && (force || !f.croquis))

        if (facadesToProcess.length === 0) return

        setIsGeneratingCroquis(true)
        setGeneratingFacades(prev => Array.from(new Set([...prev, ...facadesToProcess.map(f => f.id)])))

        try {
            const newFacades = [...formData.photos.facades]
            for (const f of facadesToProcess) {
                const imageUrl = await generateAICroquis(formData, f.after!, customInstruction)
                if (imageUrl) {
                    const compressedUrl = await compressDataURL(imageUrl)
                    const url = await uploadImage(dossierId, 'croquis', compressedUrl, { facadeId: f.id, previousUrl: f.croquis })
                    const idx = newFacades.findIndex(nf => nf.id === f.id)
                    if (idx !== -1) newFacades[idx].croquis = url
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

    const handleGenerateAIFirst = async (facadeId?: string, customInstruction?: string, force = false) => {
        // By default "Lancer la simulation" generates the selected façades that don't have one yet.
        // But if they ALL already have a simulation (e.g. the user came back to this step), the click
        // must still do something visible — so we regenerate the selected façades instead of no-op'ing.
        // A per-façade regenerate (facadeId) or "Tout régénérer" (force) always re-runs.
        let facadesToProcess = facadeId
            ? formData.photos.facades.filter(f => f.id === facadeId && f.before)
            : formData.photos.facades.filter(f => selectedFacades.includes(f.id) && f.before && (force || !f.after))

        if (!facadeId && !force && facadesToProcess.length === 0) {
            facadesToProcess = formData.photos.facades.filter(f => selectedFacades.includes(f.id) && f.before)
        }

        if (facadesToProcess.length === 0) return

        setIsGeneratingAI(true)
        if (!facadeId) setAiGenerated(false)
        
        // Track which facades are actively generating to show local indicators
        setGeneratingFacades(prev => Array.from(new Set([...prev, ...facadesToProcess.map(f => f.id)])))

        try {
            const newFacades = [...formData.photos.facades]
            for (const f of facadesToProcess) {
                const prompt = buildAIAfterImagePrompt(formData, customInstruction || worksDescription || undefined)
                const imageBase64 = f.before!
                let imageUrl: string | undefined

                if (imageBase64) {
                    const res = await fetch('/api/generate-after-facade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        // worksDescription active le contrôle de fidélité côté serveur : sans lui,
                        // le contrôleur signalerait les travaux eux-mêmes comme des écarts.
                        body: JSON.stringify({ prompt, imageBase64, dossierId, facadeId: f.id, worksDescription })
                    })
                    if (!res.ok) {
                        const errData = await res.json()
                        throw new Error(errData.error || 'Erreur lors de la génération de l\'image')
                    }
                    const data = await res.json()
                    imageUrl = data.imageBase64 || data.imageUrl
                    setFacadeAudits(prev => ({ ...prev, [f.id]: data.audit ?? null }))
                }

                if (imageUrl) {
                    const compressedUrl = await compressDataURL(imageUrl)
                    const url = await uploadImage(dossierId, 'after', compressedUrl, { facadeId: f.id, previousUrl: f.after })
                    const idx = newFacades.findIndex(nf => nf.id === f.id)
                    // Invalidate the derived DP5 croquis: it was traced from the OLD "after", so it
                    // must be re-traced from this new projected image (done at the DP5 sub-step).
                    if (idx !== -1) { newFacades[idx].after = url; newFacades[idx].croquis = null }
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
                    const url = await uploadImage(dossierId, 'croquis', compressedUrl, { facadeId, previousUrl: facade.croquis })
                    const newFacades = formData.photos.facades.map(f => f.id === facadeId ? { ...f, croquis: url } : f)
                    updatePhotos({ facades: newFacades })
                }
            } catch (err: any) { alert('Erreur: ' + err.message) }
            finally { setIsEditingCroquis(false) }
        } else {
            setIsEditingAI(true)
            try {
                const prompt = buildAIAfterImagePrompt(formData, instruction)
                const imageBase64 = facade.before!
                let newImage: string | undefined

                if (imageBase64) {
                    const res = await fetch('/api/generate-after-facade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, imageBase64, dossierId, facadeId: facade.id, worksDescription })
                    })
                    if (!res.ok) {
                        const errData = await res.json()
                        throw new Error(errData.error || 'Erreur lors de la modification de l\'image')
                    }
                    const data = await res.json()
                    newImage = data.imageBase64 || data.imageUrl
                    setFacadeAudits(prev => ({ ...prev, [facadeId]: data.audit ?? null }))
                }

                if (newImage) {
                    const compressedUrl = newImage.startsWith('data:image') ? await compressDataURL(newImage) : newImage
                    const url = await uploadImage(dossierId, 'after', compressedUrl, { facadeId, previousUrl: facade.after })
                    // New "after" → invalidate the derived croquis so DP5 is re-traced from it.
                    const newFacades = formData.photos.facades.map(f => f.id === facadeId ? { ...f, after: url, croquis: null } : f)
                    updatePhotos({ facades: newFacades })
                }
            } catch (err: any) { alert('Erreur: ' + err.message) }
            finally { setIsEditingAI(false) }
        }
    }

    // Alternative à la simulation IA : le client téléverse sa propre image « après »
    // (photomontage, rendu d'architecte, projet déjà visualisé) au lieu d'en générer une.
    const handleUploadAfter = async (facadeId: string, file: File | null) => {
        if (!file) return
        setGeneratingFacades(prev => prev.includes(facadeId) ? prev : [...prev, facadeId])
        try {
            const compressed = await compressImage(file)
            const previousUrl = formData.photos.facades.find(f => f.id === facadeId)?.after || null
            const url = await uploadImage(dossierId, 'after', compressed, { facadeId, previousUrl })
            const newFacades = formData.photos.facades.map(f => f.id === facadeId ? { ...f, after: url } : f)
            updatePhotos({ facades: newFacades })
        } catch (e) {
            console.error('Upload after failed', e)
            alert("Import de l'image « après » échoué. Vérifiez le fichier et réessayez.")
        } finally {
            setGeneratingFacades(prev => prev.filter(id => id !== facadeId))
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
        // Nomenclature officielle du bordereau : DP4 = plan des façades et des toitures,
        // DP5 = représentation de l'aspect extérieur, DP11 = notice. Les libellés annonçaient
        // « DP4 : Notice » et « DP5 : Façades » — soit deux codes intervertis par rapport au
        // dossier effectivement produit, où la notice sort en DP 11 et les façades en DP 4.
        const LABELS: Record<number, { label: string; icon: string }> = {
            1: { label: 'DP1 : Situation', icon: '🗺️' },
            2: { label: 'DP2 : Masse', icon: '📐' },
            7: { label: 'DP3 : Coupe', icon: '📏' },
            3: { label: 'DP11 : Notice', icon: '📝' },
            4: { label: 'Photos / Sélection', icon: '🖼️' },
            5: { label: 'DP6 : Insertion', icon: '✨' },
            6: { label: 'DP5 : Aspect extérieur', icon: '🎨' },
        }
        const steps = flow.map((id, i) => ({ id, num: i + 1, ...LABELS[id] }))
        const curIdx = flow.indexOf(subStep)

        return (
            <div className="mb-12 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                <div className="flex items-center justify-between relative px-2" style={{ minWidth: 560 }}>
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 w-full h-[1px] bg-[var(--line)] -translate-y-1/2 z-0" />

                    {steps.map((s, idx) => {
                        const done = idx < curIdx
                        const current = s.id === subStep
                        return (
                        <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer px-1" onClick={() => (done || aiGenerated) && setSubStep(s.id)}>
                            <div className={`dp-substep ${
                                current ? 'is-current scale-110 shadow-[0_0_20px_rgba(45,90,76,0.4)]' :
                                done ? 'is-done' : ''
                            }`}>
                                {done ? (
                                    <svg className="w-5 h-5 t-ok" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className={`text-xs font-bold ${current ? 'text-white' : 't-muted'}`}>{s.num}</span>
                                )}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-widest text-center max-w-[80px] leading-tight transition-colors ${
                                current ? 't-accent' : 't-ink2'
                            }`}>
                                {s.label}
                            </span>
                        </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="animate-fadeIn max-w-5xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div className="dp-page-head">
                        <div className="dp-eyebrow">Étape 06 / 07 · Plans</div>
                        <h2 className="dp-page-title">Pièces <span className="accent">graphiques</span></h2>
                        <p className="dp-page-sub">Finalisation et génération du dossier administratif</p>
                        <div className="dp-rule" />
                    </div>
                </div>

                {renderSubStepNavigation()}

                <div className="space-y-6">
                    {/* SUB-STEP 1: DP1 */}
                    {subStep === 1 && (
                        <div className="space-y-8 animate-slideUp">
                            <div className="bg-[var(--act)] border border-[color:var(--acb)] rounded-2xl p-6 mb-2">
                                <h3 className="text-lg font-bold t-ink mb-2">Plan de situation du terrain (DP1)</h3>
                                <p className="text-sm t-ink2 leading-relaxed">
                                    Ce plan permet de situer précisément votre terrain dans la commune. Utilisez le curseur pour ajuster le zoom si nécessaire.
                                </p>
                            </div>
                            <MapCard
                                title="Plan de Situation"
                                code="DP1"
                                address={address}
                                commune={commune}
                                coords={coords}
                                color="blue"
                                zoom={dp1Zoom}
                                onZoomChange={setDp1Zoom}
                                onCapture={async (img) => {
                                    try {
                                        const url = await uploadImage(dossierId, 'dp1', img, { previousUrl: formData.plans.dp1_carte_situation })
                                        // dp1_ground_m : vraies mètres au sol (cf. ignMaps.groundToMercator).
                                        // On n'écrit plus dp1_span_m, qui comptait en unités Web-Mercator.
                                        updatePlans({ dp1_carte_situation: url, dp1_ground_m: dp1Zoom, dp1_span_m: undefined })
                                    } catch { alert('Téléversement du plan DP1 échoué. Réessayez.') }
                                }}
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
                            <div className="bg-[var(--act)] border border-[color:var(--acb)] rounded-2xl p-6 mb-2">
                                <h3 className="text-lg font-bold t-ink mb-2">Plan de masse (DP2)</h3>
                                <p className="text-sm t-ink2 leading-relaxed">
                                    Représentation graphique de l'emprise au sol des constructions et des limites du terrain. Les dimensions sont calculées automatiquement.
                                </p>
                            </div>
                            <Dp2VectorCard
                                address={address}
                                commune={commune}
                                coords={coords}
                                formData={formData}
                                onCapture={async (img) => {
                                    try {
                                        const url = await uploadImage(dossierId, 'dp2', img, { previousUrl: formData.plans.dp2_plan_masse })
                                        updatePlans({ dp2_plan_masse: url })
                                    } catch { alert('Téléversement du plan DP2 échoué. Réessayez.') }
                                }}
                                savedImage={formData.plans.dp2_plan_masse}
                            />
                            <div className="flex justify-between pt-4">
                                <button onClick={() => setSubStep(1)} className="dp-btn-secondary">Retour</button>
                                <button onClick={goNext} className="dp-btn-primary px-8">
                                    Confirmer le DP2
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUB-STEP 7: DP3 — plan de coupe (only when the works modify the terrain profile) */}
                    {subStep === 7 && (
                        <div className="space-y-8 animate-slideUp">
                            <div className="bg-[#FBF1EC] border border-[#E4C3B4] rounded-2xl p-6 mb-2">
                                <h3 className="text-lg font-bold t-ink mb-2">Plan de coupe (DP3)</h3>
                                <p className="text-sm t-ink2 leading-relaxed">
                                    Votre projet modifie le profil du terrain : le plan de coupe est requis. Le terrain naturel est tracé depuis l&apos;altimétrie IGN (RGE ALTI, NGF), le projet et ses cotes sont ajoutés automatiquement.
                                </p>
                            </div>
                            <Dp3CoupeCard
                                formData={formData}
                                onCapture={async (img) => {
                                    try {
                                        const url = await uploadImage(dossierId, 'dp3', img, { previousUrl: formData.plans.dp3_coupe })
                                        updatePlans({ dp3_coupe: url })
                                    } catch { alert('Téléversement du plan DP3 échoué. Réessayez.') }
                                }}
                                savedImage={formData.plans.dp3_coupe}
                            />
                            <div className="flex justify-between pt-4">
                                <button onClick={goPrev} className="dp-btn-secondary">Retour</button>
                                <button onClick={goNext} className="dp-btn-primary px-8">
                                    Confirmer le DP3
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
                                    {/* La notice sort en DP 11 dans le dossier généré : la pastille doit
                                        porter le même code, sinon le client cherche une pièce inexistante. */}
                                    <span className="w-12 h-12 bg-[var(--act)] t-accent font-bold text-base rounded-2xl flex items-center justify-center border border-[color:var(--acb)]">DP11</span>
                                    <div>
                                        <h3 className="font-bold t-ink">Notice descriptive du projet</h3>
                                        <p className="text-xs t-muted">Décrit l'état initial et les modifications projetées</p>
                                    </div>
                                    <button
                                        onClick={handleGenerateDP4}
                                        disabled={isGeneratingDP4}
                                        className="dp-btn-primary ml-auto px-5 py-2.5 text-xs"
                                    >
                                        {isGeneratingDP4 ? (
                                            <div className="dp-spinner dp-spinner-sm on-accent" />
                                        ) : <span className="text-base">✨</span>}
                                        {isGeneratingDP4 ? 'Rédaction IA...' : 'Rédiger avec l\'IA'}
                                    </button>
                                </div>
                                <textarea
                                    className="dp-input min-h-[400px] resize-y font-mono text-xs p-6 !bg-[var(--field-ro)] border-[color:var(--line)]"
                                    value={dp4Notice}
                                    disabled={isGeneratingDP4}
                                    onChange={e => {
                                        setDp4Notice(e.target.value)
                                        updatePlans({ dp4_notice: e.target.value })
                                    }}
                                />
                            </div>
                            <div className="flex justify-between pt-4">
                                <button onClick={goPrev} className="dp-btn-secondary">Retour</button>
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
                            <div className="bg-[var(--surface-2)] border border-[color:var(--line)] rounded-3xl p-8 mb-4">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--act)] flex items-center justify-center t-accent">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold t-ink tracking-tight">Quelles façades souhaitez-vous transformer ?</h3>
                                </div>
                                <p className="text-sm t-ink2 leading-relaxed max-w-2xl">
                                    Sélectionnez les photos pour lesquelles vous souhaitez générer une simulation IA (DP6). Toutes les simulations générées seront automatiquement converties en croquis d'aspect extérieur (DP5).
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

                            <div className="flex justify-between pt-8 border-t border-[color:var(--line)]">
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
                            <div className="bg-[var(--surface-2)] border border-[color:var(--line)] rounded-3xl p-8">
                                <div className="flex flex-col lg:flex-row gap-8 items-start">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <h3 className="text-xl font-bold t-ink mb-1">SIMULATION IA (DP6)</h3>
                                            <p className="t-muted text-xs">La simulation utilise votre <strong className="t-ink2">description des travaux</strong> (saisie à l'étape Travaux). Ajustez-la ici si besoin. Vous avez déjà un visuel « après » (rendu, photomontage) ? <strong className="t-ink2">Importez-le directement</strong> sous chaque façade, sans générer.</p>
                                        </div>
                                        <textarea
                                            className="w-full min-h-[120px] bg-[var(--field)] border border-[color:var(--line-3)] focus:border-[color:var(--ac)] rounded-2xl p-5 t-ink placeholder-[color:var(--faint)] transition-all outline-none text-sm"
                                            placeholder={worksDescriptionSuggestion || 'Décrivez les travaux à simuler…'}
                                            value={formData.travaux.description_projet || ''}
                                            onChange={e => updateTravaux({ description_projet: e.target.value })}
                                        />
                                        {!worksDescription && worksDescriptionSuggestion && (
                                            <p className="text-[11px] t-muted">À défaut, nous simulerons : « {worksDescriptionSuggestion} »</p>
                                        )}
                                        {/* Le conflit est structurel : les travaux portent sur les menuiseries,
                                            et un volet baissé les masque. Le générateur relève alors le volet
                                            pour « montrer » le résultat — une modification que personne n'a
                                            demandée, sur la pièce que l'instructeur compare. Mieux vaut le dire
                                            avant la prise de vue que le rattraper après. */}
                                        {(formData.travaux.type === 'menuiseries' || formData.travaux.type === 'ouverture') && (
                                            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--acb)', background: 'var(--act)' }}>
                                                <p className="text-[11px] t-ink2 leading-relaxed">
                                                    <strong className="t-ink">Photographiez volets ouverts.</strong> Vos travaux portent sur les
                                                    menuiseries : si un volet est baissé sur la photo, il masque l’ouverture concernée et la
                                                    simulation ne peut pas montrer le résultat sans le relever — ce qui modifie l’aspect de la
                                                    façade sans que vous l’ayez demandé. Une photo volets ouverts évite entièrement le problème.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full lg:w-[280px] space-y-4">
                                        <div className="bg-[var(--surface-2)] rounded-2xl p-5 border border-[color:var(--line)] space-y-2">
                                            <div className="flex justify-between text-[11px] font-medium">
                                                <span className="t-muted uppercase tracking-widest">Photos sélectionnées</span>
                                                <span className="t-ink font-bold">{selectedFacades.length}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleGenerateAIFirst()}
                                            disabled={isGeneratingAI || selectedFacades.length === 0}
                                            className="dp-btn-primary w-full h-14 justify-center active:scale-95 disabled:opacity-40"
                                        >
                                            {isGeneratingAI ? (
                                                <div className="dp-spinner dp-spinner-sm on-accent" />
                                            ) : <span className="text-xl">✨</span>}
                                            {isGeneratingAI ? 'Génération...' : `Lancer la simulation`}
                                        </button>
                                        {formData.photos.facades.some(f => selectedFacades.includes(f.id) && f.after) && (
                                            <button
                                                onClick={() => handleGenerateAIFirst(undefined, undefined, true)}
                                                disabled={isGeneratingAI}
                                                className="w-full text-xs font-semibold t-muted hover:t-ink2 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                                                title="Régénérer toutes les simulations (sinon les images déjà générées sont conservées)"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                Tout régénérer
                                            </button>
                                        )}
                                        <p className="text-[10px] t-ink2 text-center leading-snug">Les images générées sont conservées ; relancez seulement pour les façades sans simulation.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Spacious Results Display */}
                            <div className="space-y-16">
                                {formData.photos.facades.filter(f => selectedFacades.includes(f.id)).map((f) => (
                                    <div key={f.id} className="group">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="h-8 w-[2px] bg-[var(--acb)]" />
                                            <h4 className="text-xl font-bold t-ink tracking-tight">{f.label}</h4>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            {/* Before */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black t-muted uppercase tracking-widest">État Actuel</span>
                                                </div>
                                                <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border border-[color:var(--line)] bg-[var(--surface-2)]">
                                                    {f.before && <img src={f.before} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700" alt="Avant" />}
                                                </div>
                                            </div>
                                            {/* After */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black t-accent uppercase tracking-widest">Projet (Simulation DP6)</span>
                                                    {f.after && <span className="text-[10px] font-bold t-ok flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Prêt</span>}
                                                </div>
                                                <div className="relative aspect-[3/2] rounded-[2rem] overflow-hidden transition-all duration-500">
                                                    {generatingFacades.includes(f.id) ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--surface-2)] border-2 border-[color:var(--line)] rounded-[2rem] animate-pulse">
                                                            <div className="dp-spinner dp-spinner-lg mb-4" />
                                                            <span className="text-xs font-bold t-accent uppercase tracking-widest">Génération IA...</span>
                                                        </div>
                                                    ) : f.after ? (
                                                        <div className="relative w-full h-full group/res overflow-hidden rounded-[2rem] border-2 border-[color:var(--acb)]">
                                                            <img src={f.after} className="w-full h-full object-cover" alt="Après" />
                                                            
                                                            {/* Result Controls Overlay */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/res:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    <button
                                                                        onClick={() => downloadImage(f.after!, `${f.label}-resultat.png`)}
                                                                        className="dp-tool-btn px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                        Télécharger
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setShowModifyInput({[f.id]: 'dp6'})}
                                                                        className="dp-tool-btn px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        Modifier
                                                                    </button>
                                                                    <label className="dp-tool-btn px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 cursor-pointer">
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                        Importer
                                                                        <input type="file" accept="image/*" className="hidden" onChange={e => { handleUploadAfter(f.id, e.target.files?.[0] || null); e.currentTarget.value = '' }} />
                                                                    </label>
                                                                    <button
                                                                        onClick={() => {
                                                                            const newFacades = formData.photos.facades.map(nf => nf.id === f.id ? { ...nf, after: null, croquis: null } : nf)
                                                                            updatePhotos({ facades: newFacades })
                                                                        }}
                                                                        className="dp-tool-btn is-danger px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        Supprimer
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Inline Modification Input */}
                                                            {showModifyInput[f.id] === 'dp6' && (
                                                                <div className="absolute inset-x-4 bottom-4 backdrop-blur-xl border border-[color:var(--acb)] rounded-2xl p-4 animate-slideUp shadow-2xl z-20" style={{ background: 'var(--surface)' }}>
                                                                    <div className="flex flex-col gap-3">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-[10px] font-black t-accent uppercase tracking-widest">Modification Simulation</span>
                                                                            <button onClick={() => setShowModifyInput({})} className="t-muted hover:t-ink transition-colors">
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            </button>
                                                                        </div>
                                                                        <textarea
                                                                            autoFocus
                                                                            value={modifyInstruction}
                                                                            onChange={(e) => setModifyInstruction(e.target.value)}
                                                                            className="bg-[var(--field)] border border-[color:var(--line)] focus:border-[color:var(--ac)] rounded-xl px-3 py-2 text-xs t-ink outline-none resize-none transition-all"
                                                                            rows={2}
                                                                            placeholder="Ex: teinte plus claire, volets fermés…"
                                                                        />
                                                                        <button
                                                                            onClick={() => handleGenerateAIFirst(f.id, modifyInstruction || undefined)}
                                                                            className="dp-btn-primary w-full py-2 text-[10px] justify-center"
                                                                        >
                                                                            <span className="text-xs">✨</span> Régénérer Simulation
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-[color:var(--line)] rounded-[2rem] bg-[var(--surface-2)] t-ink2 transition-colors">
                                                            {isGeneratingAI && selectedFacades.includes(f.id) ? (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="dp-spinner dp-spinner-lg mb-4" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Initialisation...</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="w-12 h-12 rounded-full border border-[color:var(--line)] flex items-center justify-center mb-4">
                                                                        <svg className="w-6 h-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">En attente de génération</span>
                                                                    <span className="text-[10px] t-ink2 mt-3 mb-1">— ou —</span>
                                                                    <label className="dp-btn-secondary text-xs cursor-pointer" style={{ padding: '7px 14px' }}>
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                        Importer ma propre image
                                                                        <input type="file" accept="image/*" className="hidden" onChange={e => { handleUploadAfter(f.id, e.target.files?.[0] || null); e.currentTarget.value = '' }} />
                                                                    </label>
                                                                    <span className="text-[9px] t-faint mt-1.5 max-w-[180px] text-center normal-case tracking-normal">Photomontage ou rendu que vous avez déjà</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Verdict du contrôle de fidélité. Le serveur régénère déjà seul
                                                    quand il détecte un écart : ce qui s'affiche ici, c'est ce qu'il
                                                    n'a PAS su corriger. Le demandeur doit le savoir avant de déposer,
                                                    plutôt que de le découvrir devant l'instructeur. */}
                                                {f.after && facadeAudits[f.id] !== undefined && (
                                                    facadeAudits[f.id] === null ? null : facadeAudits[f.id]!.faithful ? (
                                                        <p className="text-[10px] t-ok flex items-start gap-1.5 px-1">
                                                            <span>✓</span>
                                                            <span>Simulation vérifiée : aucune modification non demandée détectée par rapport à la photo d’origine.</span>
                                                        </p>
                                                    ) : (
                                                        <div className="dp-alert is-warn !text-[11px] !py-2.5">
                                                            <span className="dp-alert-title !text-[10px]">À vérifier avant dépôt</span>
                                                            <ul className="space-y-0.5">
                                                                {facadeAudits[f.id]!.issues.map((it, i) => (
                                                                    <li key={i}>• {AUDIT_LABELS[it.code]}{it.detail ? ` — ${it.detail}` : ''}</li>
                                                                ))}
                                                            </ul>
                                                            <p className="mt-1.5 opacity-80">Régénérez la simulation, ou importez votre propre image « après ».</p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-12 border-t border-[color:var(--line)]">
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
                            <div className="bg-[var(--act)] border border-[color:var(--acb)] rounded-[2rem] p-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                                <div className="max-w-xl">
                                    <h3 className="text-2xl font-black t-ink mb-3 tracking-tight uppercase">PLANS DES FAÇADES (DP5)</h3>
                                    <p className="t-ink2 text-sm leading-relaxed">
                                        Conversion automatique de vos simulations IA en croquis techniques 2D conformes aux exigences administratives.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleGenerateAICroquis(undefined, undefined, true)}
                                    disabled={isGeneratingCroquis}
                                    className="dp-btn-primary px-10 py-5 whitespace-nowrap"
                                >
                                    {isGeneratingCroquis ? (
                                        <div className="dp-spinner dp-spinner-sm on-accent" />
                                    ) : <span className="text-xl">🎨</span>}
                                    {isGeneratingCroquis ? 'Conversion...' : 'Régénérer les croquis'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-16">
                                {formData.photos.facades.filter(f => f.after).map((f) => (
                                    <div key={f.id} className="space-y-8">
                                        <h4 className="text-xl font-bold t-ink border-l-4 border-[color:var(--acb)] pl-4">{f.label}</h4>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border border-[color:var(--line)] relative bg-[var(--surface-2)]">
                                                <img src={f.after!} className="w-full h-full object-cover opacity-40 grayscale" alt="Base Simulation" />
                                                <div className="absolute top-6 left-6 px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">Base IA</div>
                                            </div>
                                            <div className="aspect-[3/2] rounded-[2rem] overflow-hidden border-2 border-[color:var(--acb)] relative bg-white flex items-center justify-center p-8 group/res">
                                                {generatingFacades.includes(f.id) ? (
                                                    <>
                                                        {/* Faded simulation behind an elegant spinner card, instead of a stark empty box */}
                                                        <img src={f.after!} className="absolute inset-0 w-full h-full object-cover opacity-15 blur-[3px] grayscale" alt="" />
                                                        <div className="relative z-10 flex flex-col items-center text-center gap-3 px-7 py-6 rounded-2xl"
                                                            style={{ background: 'var(--surface)', border: '1px solid var(--acb)', boxShadow: '0 12px 32px -12px rgba(0,0,0,.18)' }}>
                                                            <div className="dp-spinner dp-spinner-lg" />
                                                            <div>
                                                                <div className="text-xs font-bold t-ink uppercase tracking-widest">Rendu du plan…</div>
                                                                <p className="text-[11px] t-muted mt-1">Conversion en plan de façade technique</p>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : f.croquis ? (
                                                    <>
                                                        <img src={f.croquis} className="max-w-full max-h-full object-contain" alt="Plan Technique" />
                                                        
                                                        {/* Result Controls Overlay */}
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/res:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                            <div className="flex flex-wrap gap-2 justify-center">
                                                                <button
                                                                    onClick={() => downloadImage(f.croquis!, `${f.label}-croquis.png`)}
                                                                    className="dp-tool-btn px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                    Télécharger
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowModifyInput({[f.id]: 'dp5'})}
                                                                    className="dp-tool-btn px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                    Modifier
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const newFacades = formData.photos.facades.map(nf => nf.id === f.id ? { ...nf, croquis: null } : nf)
                                                                        updatePhotos({ facades: newFacades })
                                                                    }}
                                                                    className="dp-tool-btn is-danger px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                    Supprimer
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Inline Modification Input for DP5 */}
                                                        {showModifyInput[f.id] === 'dp5' && (
                                                            <div className="absolute inset-x-4 bottom-4 backdrop-blur-xl border border-[color:var(--acb)] rounded-2xl p-4 animate-slideUp shadow-2xl z-20" style={{ background: 'var(--surface)' }}>
                                                                <div className="flex flex-col gap-3">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[10px] font-black t-accent uppercase tracking-widest">Affinage croquis (DP5)</span>
                                                                        <button onClick={() => setShowModifyInput({})} className="t-muted hover:t-ink transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        placeholder="Ex: Préciser 'RAL 7016' sur le texte..."
                                                                        className="bg-[var(--field)] border border-[color:var(--line)] focus:border-[color:var(--ac)] rounded-xl px-3 py-2 text-xs t-ink outline-none transition-all"
                                                                        value={croquisInstructions[f.id] || ''}
                                                                        onChange={(e) => setCroquisInstructions({...croquisInstructions, [f.id]: e.target.value})}
                                                                    />
                                                                    <button
                                                                        onClick={() => handleGenerateAICroquis(f.id, croquisInstructions[f.id])}
                                                                        className="dp-btn-primary w-full py-2 text-[10px] justify-center"
                                                                    >
                                                                        <span className="text-xs">🎨</span> Régénérer Croquis
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-[color:var(--line-2)] rounded-2xl p-8 w-full h-full bg-[var(--surface-2)]">
                                                        {(isGeneratingCroquis || isGeneratingAI) && selectedFacades.includes(f.id) ? (
                                                            <div className="text-center">
                                                                <div className="dp-spinner dp-spinner-lg mx-auto mb-4" />
                                                                <span className="text-[10px] font-bold t-ink2 uppercase tracking-widest">En attente...</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <svg className="w-10 h-10 t-faint mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                <span className="text-[10px] font-black t-faint uppercase tracking-widest">Croquis en attente</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="absolute top-6 right-6 px-3 py-1 bg-[var(--ac)] text-white rounded-lg text-[10px] font-black uppercase tracking-widest">DP5</div>
                                            </div>
                                        </div>
                                        
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-12 border-t border-[color:var(--line)]">
                                <button onClick={() => setSubStep(5)} className="dp-btn-secondary">Retour</button>
                                <button onClick={() => router.push(`/etape/${dossierId}/7`)} className="dp-btn-primary group px-12 py-5">
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
                <div className="flex justify-start mt-16 pt-8 border-t border-[color:var(--line)]">
                    <button onClick={() => router.push(`/etape/${dossierId}/5`)} className="t-ink2 hover:t-ink text-sm font-bold flex items-center gap-3 transition-colors uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        Retour aux photos
                    </button>
                </div>
            </div>
        </>
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
            (Pièce DP4)

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

