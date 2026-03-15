'use client'

import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'
import { consoleLogAfterPrompt } from '@/lib/aiPromptBuilder'

interface PhotoUploadProps {
    label: string
    sublabel: string
    icon: string
    value: string | null
    onChange: (val: string | null) => void
    required?: boolean
    badge?: string
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

function PhotoUpload({ label, sublabel, icon, value, onChange, required, badge }: PhotoUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File | null) => {
        if (!file) return
        try {
            const compressed = await compressImage(file)
            onChange(compressed)
        } catch (err) {
            console.error('Compression failed', err)
            const reader = new FileReader()
            reader.onload = e => onChange(e.target?.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
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
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>
                        {badge}
                    </span>
                )}
            </div>
            <p className="text-xs mb-2" style={{ color: '#64748b' }}>{sublabel}</p>

            <div
                className={`upload-zone ${value ? 'has-file' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleFile(e.target.files?.[0] || null)}
                />
                {value ? (
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
                        <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-3 border border-slate-700/50 group-hover:bg-slate-700/50 transition-colors">
                            <span className="text-xl">{icon}</span>
                        </div>
                        <p className="text-[13px] font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Glissez une photo ici</p>
                        <p className="text-[11px] mt-1 text-slate-500">ou cliquez pour parcourir</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function Etape4() {
    const router = useRouter()
    const { formData, updatePhotos } = useDPContext()
    const p = formData.photos

    const photosCount = Object.values(p).filter(Boolean).length

    // 🤖 Log full AI prompt whenever we have enough info (at least one facade photo + work type)
    useEffect(() => {
        const hasAnyFacade = formData.photos.facades.some(f => f.before)
        if (hasAnyFacade && formData.travaux.type) {
            consoleLogAfterPrompt(formData, 'Etape 4 – Photos')
        }
    }, [formData.photos.facades, formData.travaux.type, formData])

    const addFacade = () => {
        const newId = (formData.photos.facades.length + 1).toString()
        const newFacades = [
            ...formData.photos.facades,
            { id: newId, label: `Façade ${newId}`, before: null, after: null, croquis: null, type: 'autre' as const }
        ]
        updatePhotos({ facades: newFacades })
    }

    const removeFacade = (id: string) => {
        const newFacades = formData.photos.facades.filter(f => f.id !== id)
        updatePhotos({ facades: newFacades })
    }

    const updateFacadePhoto = (id: string, before: string | null) => {
        const newFacades = formData.photos.facades.map(f =>
            f.id === id ? { ...f, before } : f
        )
        // Also sync legacy fields for the first 4 if they match types
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

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Photos de votre maison</h2>
                        <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
                            Ces photos constituent les pièces DP5, DP7 et DP8 de votre dossier
                        </p>
                    </div>
                    {photosCount > 0 && (
                        <div className="text-sm font-semibold px-3 py-1.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>
                            {photosCount} photo{photosCount > 1 ? 's' : ''} ajoutée{photosCount > 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {/* DP7 & DP8 */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Vues extérieures obligatoires</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PhotoUpload
                                label="Vue proche de la maison"
                                sublabel="Photo prise depuis la voie publique, montrant clairement la façade concernée par les travaux"
                                icon="📷"
                                badge="DP7"
                                value={p.dp7_vue_proche}
                                onChange={v => updatePhotos({ dp7_vue_proche: v })}
                                required
                            />
                            <PhotoUpload
                                label="Vue lointaine / environnement"
                                sublabel="Photo montrant la maison dans son environnement (depuis la rue, un peu plus loin)"
                                icon="🌄"
                                badge="DP8"
                                value={p.dp8_vue_lointaine}
                                onChange={v => updatePhotos({ dp8_vue_lointaine: v })}
                                required
                            />
                        </div>
                    </div>

                    {/* Façades */}
                    <div className="dp-card">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="dp-section-title mb-0 pb-0 border-0">Photos des façades (DP5 – Existant)</h3>
                            <span className="ai-badge">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Vue Après générée par IA
                            </span>
                        </div>
                        <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
                            Uploadez les photos des façades existantes. La vue <strong className="text-white">après travaux</strong> sera générée automatiquement par IA
                            en prenant en compte vos choix de matériaux et couleurs.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {formData.photos.facades.map((f, idx) => (
                                <div key={f.id} className="relative group">
                                    <PhotoUpload
                                        label={f.label}
                                        sublabel={f.type === 'avant' ? "Photo de la façade principale visible depuis la rue" : `Photo de la façade ${f.label.toLowerCase()}`}
                                        icon={f.type === 'avant' ? "🏠" : f.type === 'arriere' ? "🏡" : "📐"}
                                        value={f.before}
                                        onChange={v => updateFacadePhoto(f.id, v)}
                                        required={f.type === 'avant'}
                                    />
                                    {idx > 0 && (
                                        <button
                                            onClick={() => removeFacade(f.id)}
                                            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg"
                                            title="Supprimer cette façade"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={addFacade}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Ajouter une autre façade
                            </button>
                        </div>
                    </div>

                    {/* Info IA */}
                    <div className="info-box info-box-violet rounded-2xl">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">🤖</div>
                            <div>
                                <h4 className="font-semibold mb-1" style={{ color: '#c4b5fd' }}>Génération IA de la vue après travaux</h4>
                                <p className="text-sm" style={{ color: '#a78bfa' }}>
                                    À l'étape suivante, notre IA (DALL-E 3) utilisera vos photos de façade et les détails de vos travaux
                                    ({formData.travaux.type || 'travaux sélectionnés'}) pour générer une simulation réaliste de votre maison après rénovation.
                                    Le prompt sera optimisé avec vos choix de matériaux et couleurs.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push('/etape/3')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button onClick={() => router.push('/etape/5')} className="dp-btn-primary text-base">
                            Générer les plans
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
