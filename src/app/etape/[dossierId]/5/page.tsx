'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { uploadImage, type ImageKind } from '@/lib/uploadImage'
import type { DPFormData } from '@/lib/models'

interface PhotoUploadProps {
    label: string
    sublabel: string
    icon: string
    value: string | null
    onChange: (val: string | null) => void
    dossierId: string
    kind: ImageKind
    facadeId?: string
    required?: boolean
    badge?: string
    note?: string   // small caption under a filled slot (e.g. "réutilise la vue proche")
}

// Higher resolution/quality so DP5–DP8 photos stay legible when printed at A4/300dpi.
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
                if (!ctx) {
                    resolve(event.target?.result as string)
                    return
                }
                ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL('image/jpeg', quality))
            }
            img.onerror = () => resolve(event.target?.result as string)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
    })
}

function PhotoUpload({ label, sublabel, icon, value, onChange, dossierId, kind, facadeId, required, badge, note }: PhotoUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFile = async (file: File | null) => {
        if (!file) return
        setUploading(true)
        setError(null)
        try {
            // Compress client-side, then upload to Blob and store ONLY the returned URL — never
            // base64 (the dossier save endpoint rejects inline data: URLs).
            const compressed = await compressImage(file)
            const url = await uploadImage(dossierId, kind, compressed, { facadeId, previousUrl: value })
            onChange(url)
        } catch (err) {
            console.error('Upload failed', err)
            setError('Téléversement échoué. Vérifiez votre connexion et réessayez.')
        } finally {
            setUploading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (uploading) return
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) handleFile(file)
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <label className="dp-label mb-0">
                    {label}{required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(45,90,76,0.15)', color: '#2D5A4C' }}>
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-xs mb-2 t-muted">{sublabel}</p>

            <div
                className={`upload-zone ${value ? 'has-file' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => { if (!uploading) inputRef.current?.click() }}
                style={uploading ? { opacity: 0.7, pointerEvents: 'none' } : undefined}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFile(e.target.files?.[0] || null)}
                />
                {uploading ? (
                    <div className="py-8 flex flex-col items-center gap-3">
                        <span className="dp-spinner dp-spinner-lg" />
                        <p className="text-[13px] font-medium t-ink2">Téléversement…</p>
                    </div>
                ) : value ? (
                    <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={value} alt={label} className="max-h-48 mx-auto rounded-lg object-cover" />
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onChange(null) }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors text-xs font-bold"
                        >×</button>
                    </div>
                ) : (
                    <div className="py-4">
                        <div className="w-12 h-12 rounded-full t-faint flex items-center justify-center mx-auto mb-3 transition-colors group-hover:bg-[var(--act)]" style={{ border: '1px solid var(--line-3)' }}>
                            <span className="text-xl">{icon}</span>
                        </div>
                        <p className="text-[13px] font-medium t-ink2 transition-colors">Glissez une photo ici</p>
                        <p className="text-[11px] mt-1 t-muted">ou cliquez pour parcourir</p>
                    </div>
                )}
            </div>
            {note && value && <p className="text-[11px] mt-1.5 t-muted flex items-center gap-1">{note}</p>}
            {error && <p className="text-xs t-error mt-1">⚠️ {error}</p>}
        </div>
    )
}

// French label ↔ facade type, and the facades a project actually touches — so we only ask for the
// photos the works need (DP7 doubles as the street-facing façade), instead of a fixed grid of four.
const FACADE_LABEL: Record<'avant' | 'arriere' | 'droite' | 'gauche', string> = {
    avant: 'Façade sur rue (principale)',
    arriere: 'Façade arrière',
    droite: 'Façade latérale droite',
    gauche: 'Façade latérale gauche',
}
type FacadeType = keyof typeof FACADE_LABEL
function concernedFacadeTypes(travaux: DPFormData['travaux']): FacadeType[] {
    // The street-facing façade is always the primary simulation base (reused from the DP7 photo).
    const set = new Set<FacadeType>(['avant'])
    const src: string[] =
        (travaux.type === 'ravalement' && travaux.ravalement?.facades_concernees) ||
        (travaux.type === 'isolation' && travaux.isolation?.facades_concernees) || []
    for (const raw of src) {
        const s = raw.toLowerCase()
        if (s.includes('toutes')) { set.add('arriere'); set.add('droite'); set.add('gauche') }
        if (s.includes('arri')) set.add('arriere')
        if (s.includes('droit')) set.add('droite')
        if (s.includes('gauche')) set.add('gauche')
    }
    // Stable order: front first, then rear, then sides.
    return (['avant', 'arriere', 'droite', 'gauche'] as FacadeType[]).filter(t => set.has(t))
}

export default function Etape5() {
    const router = useRouter()
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updatePhotos } = useDPContext()
    const p = formData.photos
    const dp7 = p.dp7_vue_proche

    // The 2 mandatory "repérage" photos of a DP (DP7 + DP8) — everything else is derived from them.
    const requiredDone = [p.dp7_vue_proche, p.dp8_vue_lointaine].filter(Boolean).length

    // Keep the façade slots in sync with the works: exactly the façades the project touches, and the
    // street-facing one REUSES the DP7 photo — so the client never uploads the same picture twice and
    // never sees façade slots that don't apply to their project.
    useEffect(() => {
        const types = concernedFacadeTypes(formData.travaux)
        const cur = formData.photos.facades || []
        const byType = new Map(cur.map(f => [f.type, f]))
        let next = types.map((t, i) => {
            const ex = byType.get(t)
            return ex
                ? { ...ex, id: String(i + 1), label: FACADE_LABEL[t] }
                : { id: String(i + 1), label: FACADE_LABEL[t], before: null, after: null, croquis: null, type: t }
        })
        const d7 = formData.photos.dp7_vue_proche
        next = next.map(f => (f.type === 'avant' && !f.before && d7) ? { ...f, before: d7 } : f)
        if (JSON.stringify(next) !== JSON.stringify(cur)) updatePhotos({ facades: next })
    }, [formData.travaux, formData.photos.dp7_vue_proche, formData.photos.facades, updatePhotos])

    const updateFacadePhoto = (id: string, before: string | null) => {
        const newFacades = formData.photos.facades.map(f => f.id === id ? { ...f, before } : f)
        const update: Partial<typeof formData.photos> = { facades: newFacades }
        const f = newFacades.find(fac => fac.id === id)
        if (f) {
            if (f.type === 'avant') update.facade_avant = before
            else if (f.type === 'arriere') update.facade_arriere = before
            else if (f.type === 'droite') update.facade_droite = before
            else if (f.type === 'gauche') update.facade_gauche = before
        }
        updatePhotos(update)
    }

    const facades = p.facades || []
    const extras = facades.filter(f => f.type !== 'avant')

    // Exit guard: leaving with concerned façades that have no photo is allowed (the expert may
    // proceed deliberately) but never silent — the first click explains what will be missing.
    const missingFacades = facades.filter(f => !f.before)
    const [ackMissing, setAckMissing] = useState(false)
    const goPlans = () => {
        if (missingFacades.length > 0 && !ackMissing) { setAckMissing(true); return }
        router.push(`/etape/${dossierId}/6`)
    }

    return (
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head flex items-start justify-between">
                    <div>
                        <div className="dp-eyebrow">Étape 05 / 07 · Photos</div>
                        <h2 className="dp-page-title">Photos de votre <span className="accent">maison</span></h2>
                        <p className="dp-page-sub">
                            Deux photos suffisent : une vue proche et une vue lointaine. Nous en déduisons le reste.
                        </p>
                    </div>
                    <div className="text-sm font-semibold px-3 py-1.5 rounded-full"
                        style={{ background: requiredDone === 2 ? 'var(--act)' : 'var(--surface-2)', color: requiredDone === 2 ? 'var(--acd)' : 'var(--ink2)' }}>
                        {requiredDone}/2 obligatoires
                    </div>
                </div>
                <div className="dp-rule" />

                <div className="space-y-6">
                    {/* DP7 & DP8 — the only two photos the client must take */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Photos de repérage <span className="t-muted font-normal">· obligatoires</span></h3>
                        <p className="text-sm mb-5 t-muted">
                            Les deux seules photos exigées par l'administration : une vue rapprochée de la façade
                            concernée, et une vue plus large de la maison dans son environnement.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PhotoUpload
                                label="Vue proche"
                                sublabel="Depuis la rue, montrant clairement la façade concernée par les travaux."
                                icon="📷"
                                badge="DP7"
                                dossierId={dossierId}
                                kind="dp7"
                                value={p.dp7_vue_proche}
                                onChange={v => updatePhotos({ dp7_vue_proche: v })}
                                required
                            />
                            <PhotoUpload
                                label="Vue lointaine"
                                sublabel="La maison dans son environnement (un peu plus en recul)."
                                icon="🌄"
                                badge="DP8"
                                dossierId={dossierId}
                                kind="dp8"
                                value={p.dp8_vue_lointaine}
                                onChange={v => updatePhotos({ dp8_vue_lointaine: v })}
                                required
                            />
                        </div>
                    </div>

                    {/* Façades concernées — derived from the works; the street façade reuses DP7 */}
                    <div className="dp-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="dp-section-title mb-0 pb-0 border-0">Façade{extras.length ? 's' : ''} concernée{extras.length ? 's' : ''}</h3>
                            <span className="ai-badge">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Simulation « après » par IA
                            </span>
                        </div>
                        <p className="text-sm mb-5 t-muted">
                            {extras.length === 0 ? (
                                <>Votre projet ne concerne que la façade sur rue. Nous réutilisons votre <strong className="t-ink">vue proche (DP7)</strong> comme base de la simulation — <strong className="t-ink">aucune photo supplémentaire</strong> n'est nécessaire.</>
                            ) : (
                                <>Votre projet concerne {facades.length} façades. La façade sur rue réutilise votre <strong className="t-ink">vue proche (DP7)</strong> ; ajoutez une photo pour chaque autre façade concernée.</>
                            )}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {facades.map((f) => {
                                const reused = f.type === 'avant' && !!dp7 && f.before === dp7
                                return (
                                    <PhotoUpload
                                        key={f.id}
                                        label={f.label}
                                        sublabel={f.type === 'avant'
                                            ? 'Base de la simulation « après travaux ».'
                                            : `Photo de la ${f.label.toLowerCase()}.`}
                                        icon={f.type === 'avant' ? '🏠' : f.type === 'arriere' ? '🏡' : '📐'}
                                        dossierId={dossierId}
                                        kind="before"
                                        facadeId={f.id}
                                        value={f.before}
                                        onChange={v => updateFacadePhoto(f.id, v)}
                                        note={reused ? '↩ Réutilise votre vue proche — cliquez pour utiliser une autre photo' : undefined}
                                    />
                                )
                            })}
                        </div>
                        {!dp7 && (
                            <p className="text-[11px] mt-4 t-muted">Ajoutez d'abord votre vue proche (DP7) ci-dessus : elle servira automatiquement de base à la simulation.</p>
                        )}
                    </div>

                    {/* Missing-façade warning (shown on first "Générer les plans" attempt) */}
                    {ackMissing && missingFacades.length > 0 && (
                        <div className="dp-alert animate-fadeIn" style={{ background: '#F7EFDC', border: '1px solid #E5D5AC', color: '#7A5C1E' }}>
                            <strong>{missingFacades.length} façade{missingFacades.length > 1 ? 's' : ''} concernée{missingFacades.length > 1 ? 's' : ''} sans photo</strong>
                            {' '}({missingFacades.map(f => f.label.toLowerCase()).join(', ')}).
                            La simulation « après travaux » et la pièce DP5 ne couvriront que les façades photographiées —
                            la mairie peut demander des pièces complémentaires. Ajoutez les photos manquantes,
                            ou cliquez à nouveau sur « Continuer sans ces photos ».
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push(`/etape/${dossierId}/4`)} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button onClick={goPlans} className="dp-btn-primary text-base">
                            {ackMissing && missingFacades.length > 0 ? 'Continuer sans ces photos' : 'Générer les plans'}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
