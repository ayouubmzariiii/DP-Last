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
                    <div>
                        <div className="text-3xl mb-2">{icon}</div>
                        <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Glissez une photo ici</p>
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>ou cliquez pour parcourir</p>
                        <p className="text-xs mt-1" style={{ color: '#334155' }}>JPG, PNG, HEIC – max 10 Mo</p>
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

    // 🤖 Log full AI prompt whenever we have enough info (facade photo + work type)
    useEffect(() => {
        if (formData.photos.facade_avant && formData.travaux.type) {
            consoleLogAfterPrompt(formData, 'Etape 4 – Photos')
        }
    }, [formData.photos.facade_avant, formData.travaux.type, formData])

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
                            <PhotoUpload
                                label="Façade principale (avant)"
                                sublabel="Photo de la façade principale visible depuis la rue"
                                icon="🏠"
                                value={p.facade_avant}
                                onChange={v => updatePhotos({ facade_avant: v })}
                                required
                            />
                            <PhotoUpload
                                label="Façade arrière"
                                sublabel="Photo de la façade arrière de votre maison"
                                icon="🏡"
                                value={p.facade_arriere}
                                onChange={v => updatePhotos({ facade_arriere: v })}
                            />
                            <PhotoUpload
                                label="Façade latérale droite"
                                sublabel="Pignon droit (optionnel)"
                                icon="📐"
                                value={p.facade_droite}
                                onChange={v => updatePhotos({ facade_droite: v })}
                            />
                            <PhotoUpload
                                label="Façade latérale gauche"
                                sublabel="Pignon gauche (optionnel)"
                                icon="📐"
                                value={p.facade_gauche}
                                onChange={v => updatePhotos({ facade_gauche: v })}
                            />
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
