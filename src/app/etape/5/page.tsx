'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'
import { generateAIAfterImage } from '@/lib/aiImageGenerator'

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

function downloadImage(dataUrl: string, filename = 'apres-travaux-ia.png') {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
}

function FacadeCard({
    label, before, after, isLoading, badge, onGenerateOrEdit, isGenerating, onRemove, canGenerate
}: {
    label: string; before: string | null; after: string | null
    isLoading: boolean; badge: string
    onGenerateOrEdit: (instruction: string) => void; isGenerating: boolean
    onRemove?: () => void
    canGenerate?: boolean
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
            <div className="grid grid-cols-2 gap-4">
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
                <div>
                    <p className="text-xs font-semibold text-violet-500 mb-2 uppercase tracking-wide">Simulation Après</p>
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

function Dp3Panel({ commune, surface, travaux, value, onChange }: {
    commune: string; surface: string; travaux: string; value: string | null; onChange: (v: string | null) => void
}) {
    const [mode, setMode] = useState<'default' | 'upload' | 'ai'>('default')
    const [aiLoading, setAiLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = (file: File | null) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = e => onChange(e.target?.result as string)
        reader.readAsDataURL(file)
        setMode('upload')
    }

    const handleGenerateAI = async () => {
        setAiLoading(true)
        const prompt = `Technical architectural cross-section drawing for a French residential building in ${commune || 'France'}, plain-pied R+0 (single story). Works: ${travaux === 'isolation' ? 'exterior thermal insulation (ITE)' : travaux === 'menuiseries' ? 'window and door replacement' : 'photovoltaic panels'}. Terrain surface: ${surface || 'unknown'} m2. Show: thick brown ground line labeled "Terrain Naturel (TN)", house cross-section with walls and pitched roof, vertical dimension arrows labeled "Hauteur sabliere approx 3.00m" and "Hauteur faitage approx 5.20m", foundation depth ~0.50m below ground. Title block at bottom: "DP3 - Plan de coupe". Clean white background, black technical drawing lines, blue dimension arrows, French labels. Architectural blueprint style.`
        console.log('\n🤖 PROMPT IA DP3:\n', prompt)
        try {
            const res = await fetch('/api/generate-dp3', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            })
            if (res.ok) {
                const data = await res.json()
                onChange(data.imageUrl)
                setMode('ai')
            } else {
                alert('Génération IA non disponible pour le moment. Prompt affiché dans la console (F12).')
            }
        } catch {
            alert('Génération IA non disponible. Prompt affiché dans la console (F12).')
        } finally {
            setAiLoading(false)
        }
    }

    const preview = value || '/dp3-plan-coupe.png'

    return (
        <div className="mt-4 space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-2">
                <button onClick={() => { setMode('default'); onChange(null) }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
                    style={mode === 'default'
                        ? { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                    📐 Schéma par défaut
                </button>
                <button onClick={() => { setMode('upload'); inputRef.current?.click() }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
                    style={mode === 'upload'
                        ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                    📤 Uploader mon plan
                </button>
                <button onClick={() => setMode('ai')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all"
                    style={mode === 'ai'
                        ? { background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                    ✨ Générer par IA
                </button>
            </div>

            {/* Hidden file input */}
            <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => handleFile(e.target.files?.[0] || null)} />

            {/* Upload hint */}
            {mode === 'upload' && !value && (
                <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
                    style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.05)' }}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}>
                    <div className="text-3xl mb-2">📂</div>
                    <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>Cliquez ou glissez votre plan de coupe</p>
                    <p className="text-xs mt-1" style={{ color: '#475569' }}>JPG, PNG – Dessin à la main ou plan numérique accepté</p>
                </div>
            )}

            {/* AI quality warning */}
            {mode === 'ai' && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>Avertissement qualité</p>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: '#8b7cf6' }}>
                                L'image générée par IA est une <strong>illustration indicative</strong>. Elle ne remplace pas un plan établi par un architecte ou un géomètre.
                                Les mairies acceptent généralement un schéma indicatif pour les travaux simples, mais il est recommandé de vérifier avec votre mairie.
                            </p>
                        </div>
                    </div>
                    <button onClick={handleGenerateAI} disabled={aiLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)', opacity: aiLoading ? 0.7 : 1 }}>
                        {aiLoading ? (
                            <><div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /> Génération en cours...</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Générer le plan de coupe avec l'IA</>
                        )}
                    </button>
                </div>
            )}

            {/* Preview */}
            <div className="relative rounded-xl overflow-hidden bg-white" style={{ aspectRatio: '4/3' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Plan de coupe" className="w-full h-full object-contain" />
                {mode === 'default' && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500/80 text-white text-[10px] rounded font-medium">
                        Illustration par défaut – personnalisez avec upload ou IA
                    </div>
                )}
                {value && (
                    <button onClick={() => { onChange(null); setMode('default') }}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors">
                        ✕
                    </button>
                )}
            </div>
        </div>
    )
}

export default function Etape5() {
    const router = useRouter()
    const { formData, updatePhotos, updatePlans } = useDPContext()
    const [isGeneratingAI, setIsGeneratingAI] = useState(false)
    const [isEditingAI, setIsEditingAI] = useState(false)
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

            const res = await fetch('/api/generate-after-facade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageBase64 }),
            })
            const data = await res.json()
            const imageUrl = data.imageBase64 || data.imageUrl
            if (imageUrl) {
                updatePhotos({ facade_apres_ai: imageUrl })
                setAiGenerated(true)
            } else {
                console.error('AI generation failed:', data.error)
            }
        } catch (err) {
            console.error('AI generation failed:', err)
        } finally {
            setIsGeneratingAI(false)
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

            const res = await fetch('/api/generate-after-facade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    imageBase64: currentImage.startsWith('data:') ? currentImage : undefined,
                }),
            })
            const data = await res.json()
            const newImage = data.imageBase64 || data.imageUrl
            if (newImage) updatePhotos({ facade_apres_ai: newImage })
            else console.error('Edit failed:', data.error)
        } catch (err) {
            console.error('AI edit failed:', err)
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
            const data = await res.json()
            if (data.dp4) {
                setDp4Notice(data.dp4)
                updatePlans({ dp4_notice: data.dp4 })
            } else {
                console.error('Failed to generate DP4:', data.error)
            }
        } catch (err) {
            console.error('DP4 generation failed:', err)
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

                    {/* DP2 - Plan de masse */}
                    <MapCard
                        title="Plan de masse (vue cadastre)"
                        code="DP2"
                        address={address}
                        commune={commune}
                        color="green"
                    />

                    {/* DP3 - Plan de coupe */}
                    <div className="dp-card">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="w-10 h-10 font-bold text-sm rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>DP3</span>
                            <div>
                                <h3 className="font-semibold text-white">Plan de coupe du terrain et de la construction</h3>
                                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                                    Pièce obligatoire — coupe verticale montrant le bâtiment et le terrain naturel
                                </p>
                            </div>
                            <span className="ml-auto text-[10px] px-2 py-1 rounded-md bg-white/5 text-slate-400 border border-white/10 uppercase tracking-widest">
                                {formData.plans.dp3_coupe ? 'Personnalisé' : 'Schéma par défaut'}
                            </span>
                        </div>

                        {/* Mode selector */}
                        <Dp3Panel
                            commune={commune}
                            surface={formData.terrain.surface_terrain || ''}
                            travaux={formData.travaux.type}
                            value={formData.plans.dp3_coupe}
                            onChange={v => updatePlans({ dp3_coupe: v })}
                        />
                    </div>


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
                            <span className="w-10 h-10 bg-violet-100 text-violet-700 font-bold text-sm rounded-xl flex items-center justify-center">DP5</span>
                            <h3 className="font-semibold text-slate-100">Plans des façades – Avant / Après</h3>
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
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération en cours...</>
                                        ) : (
                                            <><div className="text-base">✨</div> Générer la simulation</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <FacadeCard
                                label="Façade principale"
                                badge="DP5-A"
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
                            {formData.photos.facade_arriere && (
                                <FacadeCard
                                    label="Façade arrière"
                                    badge="DP5-B"
                                    before={formData.photos.facade_arriere}
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
                                />
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
