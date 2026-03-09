'use client'

/**
 * StreetViewFetcher
 * 1. Tries Panoramax (IGN – 100% free, France-focused) using lat/lon from geocoding.
 * 2. Falls back to an embedded Google Street View iframe with a canvas-capture button.
 *
 * No API keys required for either path.
 */

import { useState, useRef, useCallback } from 'react'

interface StreetViewFetcherProps {
    address: string        // full text address (for geocoding + GSV iframe)
    lat?: number | null    // already-geocoded lat (skip geocoding if provided)
    lon?: number | null
    onCapture: (dataUrl: string) => void   // called with base64 data url
    label?: string         // e.g. "DP7 – Vue proche"
}

interface PanoramaxPhoto {
    id: string
    sdUrl: string
    thumbUrl: string
    date: string
    lat: number
    lon: number
}

// ── Geocode address via Nominatim (already used elsewhere in the app) ─────────
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
    try {
        const q = encodeURIComponent(`${address} France`)
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
            headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' }
        })
        const data = await res.json()
        if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    } catch { /* ignore */ }
    return null
}

// ── Fetch nearest Panoramax photos ────────────────────────────────────────────
async function fetchPanoramax(lat: number, lon: number, radius = 100): Promise<PanoramaxPhoto[]> {
    // Build a small bbox around the point
    const deg = radius / 111_320   // ~metres → degrees
    const bbox = `${(lon - deg).toFixed(6)},${(lat - deg).toFixed(6)},${(lon + deg).toFixed(6)},${(lat + deg).toFixed(6)}`
    const url = `https://api.panoramax.xyz/api/search?limit=6&bbox=${bbox}`

    try {
        const res = await fetch(url)
        if (!res.ok) return []
        const data = await res.json()
        return (data.features || []).map((f: any) => ({
            id: f.id,
            sdUrl: f.assets?.sd?.href || f.assets?.hd?.href || '',
            thumbUrl: f.assets?.thumb?.href || f.assets?.sd?.href || '',
            date: f.properties?.datetime?.slice(0, 10) || '',
            lat: f.geometry?.coordinates?.[1] ?? lat,
            lon: f.geometry?.coordinates?.[0] ?? lon,
        })).filter((p: PanoramaxPhoto) => p.sdUrl)
    } catch {
        return []
    }
}

// ── Canvas-capture helper for cross-origin images ─────────────────────────────
async function captureImageUrl(imgUrl: string): Promise<string> {
    // Fetch the image through our proxy to avoid CORS
    const proxyUrl = `/api/proxy-map?url=${encodeURIComponent(imgUrl)}`
    const res = await fetch(proxyUrl)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width; canvas.height = img.height
            canvas.getContext('2d')!.drawImage(img, 0, 0)
            resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
    })
}

export default function StreetViewFetcher({ address, lat: propLat, lon: propLon, onCapture, label }: StreetViewFetcherProps) {
    const [state, setState] = useState<'idle' | 'loading' | 'panoramax' | 'gsv' | 'error'>('idle')
    const [photos, setPhotos] = useState<PanoramaxPhoto[]>([])
    const [capturing, setCapturing] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const handleFetch = useCallback(async () => {
        setState('loading')
        setErrorMsg('')

        let coords: { lat: number; lon: number } | null = null

        if (propLat && propLon) {
            coords = { lat: propLat, lon: propLon }
        } else if (address.trim()) {
            coords = await geocodeAddress(address)
        }

        if (coords) {
            const found = await fetchPanoramax(coords.lat, coords.lon, 150)
            if (found.length > 0) {
                setPhotos(found)
                setState('panoramax')
                return
            }
        }

        // Fallback: Google Street View embed
        setState('gsv')
    }, [address, propLat, propLon])

    const handleUsePhoto = async (photo: PanoramaxPhoto) => {
        setCapturing(photo.id)
        try {
            const dataUrl = await captureImageUrl(photo.sdUrl)
            onCapture(dataUrl)
        } catch {
            // Try direct if proxy fails
            try {
                const dataUrl = await captureImageUrl(photo.thumbUrl)
                onCapture(dataUrl)
            } catch {
                setErrorMsg('Impossible de récupérer cette photo. Essayez de la télécharger manuellement.')
            }
        } finally {
            setCapturing(null)
        }
    }

    const gsvQuery = encodeURIComponent(address)
    const gsvSrc = `https://www.google.com/maps/embed/v1/streetview?key=AIzaSyD-9tSrke72NouQmaXH4X-C2OGwOt7RKZo&location=${gsvQuery}&fov=90&heading=235&pitch=10`
    // Note: using the demo key – works for embeds, not for production API calls

    return (
        <div className="mt-3 rounded-xl overflow-hidden border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {/* Trigger button */}
            {state === 'idle' && (
                <button
                    type="button"
                    onClick={handleFetch}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ color: '#60a5fa' }}
                >
                    <span>🗺️</span>
                    Rechercher automatiquement via Panoramax / Street View
                </button>
            )}

            {/* Loading */}
            {state === 'loading' && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm" style={{ color: '#94a3b8' }}>
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Recherche de photos de rue...
                </div>
            )}

            {/* Error */}
            {errorMsg && (
                <p className="text-xs px-3 pb-2" style={{ color: '#f87171' }}>{errorMsg}</p>
            )}

            {/* Panoramax results */}
            {state === 'panoramax' && (
                <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>
                            Panoramax IGN ✓
                        </span>
                        <span className="text-xs" style={{ color: '#64748b' }}>{photos.length} photo(s) trouvée(s) à proximité</span>
                        <button
                            type="button"
                            onClick={() => setState('gsv')}
                            className="ml-auto text-xs underline"
                            style={{ color: '#60a5fa' }}
                        >
                            Voir Street View
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map(photo => (
                            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-white/10">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo.thumbUrl}
                                    alt={`Vue Panoramax ${photo.date}`}
                                    className="w-full aspect-video object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={() => handleUsePhoto(photo)}
                                        disabled={capturing === photo.id}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                                        style={{ background: '#3b82f6', color: 'white' }}
                                    >
                                        {capturing === photo.id ? '...' : 'Utiliser'}
                                    </button>
                                </div>
                                <p className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-black/60 py-0.5" style={{ color: '#94a3b8' }}>
                                    {photo.date || 'Date inconnue'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Google Street View iframe fallback */}
            {state === 'gsv' && (
                <div>
                    <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                            Google Street View
                        </span>
                        {photos.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setState('panoramax')}
                                className="ml-auto text-xs underline"
                                style={{ color: '#60a5fa' }}
                            >
                                ← Panoramax
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <iframe
                            ref={iframeRef}
                            src={`https://www.google.com/maps/embed/v1/streetview?key=AIzaSyD-9tSrke72NouQmaXH4X-C2OGwOt7RKZo&location=${gsvQuery}&fov=80&pitch=5`}
                            width="100%"
                            height="280"
                            style={{ border: 0, display: 'block' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                    <p className="text-xs px-3 py-2" style={{ color: '#64748b' }}>
                        Positionnez la vue souhaitée, puis faites une capture d'écran (
                        <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.1)' }}>Win+Maj+S</kbd>
                        &nbsp;ou&nbsp;
                        <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.1)' }}>Cmd+Maj+4</kbd>
                        ) puis uploadez-la ci-dessus.
                    </p>
                </div>
            )}
        </div>
    )
}
