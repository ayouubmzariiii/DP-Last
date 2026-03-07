'use client'

import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'

export default function Etape2() {
    const router = useRouter()
    const { formData, updateTerrain, updateField, updateDemandeur } = useDPContext()
    const t = formData.terrain
    const d = formData.demandeur

    // Dynamic Cadastre functions migrated from Etape 6
    const addCadastre = () => {
        const current = formData.cadastrales_multiparcelles || []
        updateField('cadastrales_multiparcelles', [...current, { prefixe: '', section: '', numero: '' }])
    }

    const removeCadastre = (index: number) => {
        const current = [...(formData.cadastrales_multiparcelles || [])]
        current.splice(index, 1)
        updateField('cadastrales_multiparcelles', current)
    }

    const updateCadastre = (index: number, field: 'prefixe' | 'section' | 'numero', value: string) => {
        const current = [...(formData.cadastrales_multiparcelles || [])]
        current[index][field] = value
        updateField('cadastrales_multiparcelles', current)
    }

    const handleSameAddress = (same: boolean) => {
        updateTerrain({ meme_adresse: same })
        if (same) {
            updateTerrain({
                adresse: d.adresse,
                code_postal: d.code_postal,
                commune: d.commune,
            })
        }
    }

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Informations sur le terrain</h2>
                    <p className="text-slate-500 mt-1">Localisation et références cadastrales du terrain objet des travaux</p>
                </div>

                <div className="space-y-6">
                    {/* Adresse travaux */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Adresse des travaux</h3>

                        <div className="flex gap-3 mb-5">
                            {[true, false].map((val) => (
                                <button
                                    key={String(val)}
                                    type="button"
                                    onClick={() => handleSameAddress(val)}
                                    className="flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all"
                                    style={t.meme_adresse === val
                                        ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.2)', color: '#93c5fd' }
                                        : { borderColor: 'rgba(148,163,184,0.3)', color: '#94a3b8' }}
                                >
                                    {val ? '📍 Identique à mon adresse' : '🗺️ Adresse différente'}
                                </button>
                            ))}
                        </div>

                        {!t.meme_adresse && (
                            <div className="space-y-4">
                                <div className="dp-form-group mb-4">
                                    <label className="dp-label">Adresse des travaux *</label>
                                    <input className="dp-input" placeholder="Numéro et nom de rue" value={t.adresse} onChange={e => updateTerrain({ adresse: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Lieu-dit</label>
                                    <input className="dp-input" placeholder="Lieu-dit" value={t.lieu_dit} onChange={e => updateTerrain({ lieu_dit: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="dp-form-group">
                                        <label className="dp-label">Code postal *</label>
                                        <input
                                            className="dp-input"
                                            placeholder="75001"
                                            maxLength={5}
                                            value={t.code_postal}
                                            onChange={e => updateTerrain({ code_postal: e.target.value })}
                                        />
                                    </div>
                                    <div className="dp-form-group md:col-span-2">
                                        <label className="dp-label">Commune *</label>
                                        <input
                                            className="dp-input"
                                            placeholder="Paris"
                                            value={t.commune}
                                            onChange={e => updateTerrain({ commune: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {t.meme_adresse && d.adresse && (
                            <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)' }}>
                                📍 {d.adresse}, {d.code_postal} {d.commune}
                            </div>
                        )}
                    </div>

                    {/* Cadastre */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Références cadastrales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="dp-form-group">
                                <label className="dp-label">Préfixe</label>
                                <input
                                    className="dp-input"
                                    placeholder="Ex: 000"
                                    value={t.prefixe_cadastral}
                                    onChange={e => updateTerrain({ prefixe_cadastral: e.target.value })}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Section *</label>
                                <input
                                    className="dp-input"
                                    placeholder="ex: AB"
                                    value={t.section_cadastrale}
                                    onChange={e => updateTerrain({ section_cadastrale: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Numéro *</label>
                                <input
                                    className="dp-input"
                                    placeholder="ex: 0123"
                                    value={t.numero_parcelle}
                                    onChange={e => updateTerrain({ numero_parcelle: e.target.value })}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Surface (m²)</label>
                                <input className="dp-input" placeholder="ex: 500" type="number" value={t.surface_terrain} onChange={e => updateTerrain({ surface_terrain: e.target.value })} />
                            </div>
                        </div>

                        {/* Multi-Parcelles (Section 3 addition) */}
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <label className="text-sm font-medium text-slate-300 block mb-3">Parcelles supplémentaires (si le projet s'étend sur plusieurs parcelles)</label>
                            <div className="space-y-3 mb-4">
                                {formData.cadastrales_multiparcelles?.map((parcelle, index) => (
                                    <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3 rounded-lg bg-slate-800/50 border border-slate-700 animate-fadeIn">
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="text-xs text-slate-400 mb-1 block">Préfixe</label>
                                            <input className="dp-input text-sm py-2" placeholder="Ex: 000" value={parcelle.prefixe} onChange={e => updateCadastre(index, 'prefixe', e.target.value)} />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="text-xs text-slate-400 mb-1 block">Section</label>
                                            <input className="dp-input text-sm py-2" placeholder="AB" value={parcelle.section} onChange={e => updateCadastre(index, 'section', e.target.value.toUpperCase())} />
                                        </div>
                                        <div className="flex-2 min-w-[150px]">
                                            <label className="text-xs text-slate-400 mb-1 block">Numéro</label>
                                            <input className="dp-input text-sm py-2" placeholder="0123" value={parcelle.numero} onChange={e => updateCadastre(index, 'numero', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeCadastre(index)} className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addCadastre} className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 font-medium transition-colors border border-slate-700 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Ajouter une parcelle
                            </button>
                        </div>

                        {/* Lotissement Toggle (Section 3) */}
                        <div className="mt-5 p-4 rounded-xl border border-slate-700 bg-slate-800/30">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 accent-blue-500 cursor-pointer"
                                    checked={formData.terrain_lotissement || false}
                                    onChange={(e) => updateField('terrain_lotissement', e.target.checked)}
                                />
                                <span className="text-sm font-medium text-slate-200">
                                    Le terrain est situé dans un lotissement
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push('/etape/1')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button onClick={() => router.push('/etape/3')} className="dp-btn-primary text-base">
                            Étape suivante
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
