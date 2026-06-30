'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { issuesForStep, fatalIssues } from '@/lib/validation'

export default function Etape2() {
    const router = useRouter()
    const { formData, updateTerrain, updateField, updateDemandeur } = useDPContext()
    const t = formData.terrain
    const d = formData.demandeur

    const stepFatals = fatalIssues(issuesForStep(formData, 2))

    const [loadingPLU, setLoadingPLU] = useState(false)
    const [pluError, setPluError] = useState<string | null>(null)

    const fetchPLUForCoords = async (coords: { lat: number; lon: number }) => {
        setLoadingPLU(true)
        setPluError(null)
        try {
            const res = await fetch(`/api/fetch-plu?lat=${coords.lat}&lon=${coords.lon}&commune=${encodeURIComponent(t.commune || d.commune || '')}`)
            if (!res.ok) throw new Error("Erreur de récupération du PLU")
            const data = await res.json()
            updateTerrain({ plu: data })
        } catch (err: any) {
            console.error(err)
            setPluError(err.message || "Impossible de récupérer les données PLU.")
        } finally {
            setLoadingPLU(false)
        }
    }

    // Auto-geocode terrain address if address exists but coords do not
    useEffect(() => {
        const autoGeocodeTerrain = async () => {
            if (t.adresse && !t.coords && !t.meme_adresse && !loadingPLU) {
                setLoadingPLU(true)
                setPluError(null)
                try {
                    const q = `${t.adresse}, ${t.code_postal} ${t.commune}`
                    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`)
                    if (!response.ok) throw new Error("Erreur de géocodage de l'adresse du terrain")
                    const data = await response.json()
                    if (data.features && data.features.length > 0) {
                        const feature = data.features[0]
                        const coords = {
                            lat: feature.geometry.coordinates[1],
                            lon: feature.geometry.coordinates[0]
                        }
                        updateTerrain({ coords })
                        // Now fetch PLU for these coords
                        const res = await fetch(`/api/fetch-plu?lat=${coords.lat}&lon=${coords.lon}&commune=${encodeURIComponent(t.commune || d.commune || '')}`)
                        if (!res.ok) throw new Error("Erreur de récupération du PLU")
                        const pluData = await res.json()
                        updateTerrain({ plu: pluData })
                    } else {
                        setPluError("Impossible de localiser l'adresse du terrain pour le PLU.")
                    }
                } catch (err: any) {
                    console.error("Auto-geocode terrain failed:", err)
                    setPluError(err.message || "Erreur lors de la localisation automatique du terrain.")
                } finally {
                    setLoadingPLU(false)
                }
            }
        }
        autoGeocodeTerrain()
    }, [t.adresse, t.coords, t.meme_adresse])

    // Auto-fetch PLU when coordinates are available but PLU is not yet loaded
    useEffect(() => {
        if (t.coords && !t.plu && !loadingPLU) {
            fetchPLUForCoords(t.coords)
        }
    }, [t.coords, t.plu])

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
                coords: d.coords,
                plu: undefined // reset to trigger auto-fetch for new coords
            })
            if (d.coords) {
                fetchPLUForCoords(d.coords)
            }
        }
    }

    return (
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Étape 02 / 07 · Terrain</span>
                    <h2 className="dp-page-title">Informations sur le terrain</h2>
                    <p className="dp-page-sub">Localisation et références cadastrales du terrain objet des travaux</p>
                    <div className="dp-rule" />
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
                                    className={`toggle-btn flex-1 ${t.meme_adresse === val ? 'active' : ''}`}
                                >
                                    {val ? '📍 Identique à mon adresse' : '🗺️ Adresse différente'}
                                </button>
                            ))}
                        </div>

                        {!t.meme_adresse && (
                            <div className="space-y-4">
                                <div className="dp-form-group mb-4">
                                    <label className="dp-label">Recherche d'adresse complète *</label>
                                    <AddressAutocomplete
                                        placeholder="Ex: 1 avenue du Huit Mai, Les Ponts-de-Cé"
                                        initialValue={t.adresse ? `${t.adresse}, ${t.code_postal} ${t.commune}` : ''}
                                        onAddressSelected={(addr) => {
                                             updateTerrain({
                                                 adresse: addr.adresse,
                                                 code_postal: addr.code_postal,
                                                 commune: addr.commune,
                                                 coords: addr.coords,
                                                 plu: undefined
                                             })
                                             // Fetch PLU immediately
                                             fetchPLUForCoords(addr.coords)
                                         }}
                                    />
                                    <p className="dp-meta mt-1">Recherche certifiée par l'API Adresse du Gouvernement</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="dp-form-group">
                                        <label className="dp-label">Voie (extraite)</label>
                                        <input className="dp-input" readOnly value={t.adresse} />
                                    </div>
                                    <div className="dp-form-group">
                                        <label className="dp-label">Lieu-dit</label>
                                        <input className="dp-input" placeholder="Lieu-dit" value={t.lieu_dit} onChange={e => updateTerrain({ lieu_dit: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="dp-form-group">
                                        <label className="dp-label">Code postal</label>
                                        <input
                                            className="dp-input"
                                            readOnly
                                            value={t.code_postal}
                                        />
                                    </div>
                                    <div className="dp-form-group md:col-span-2">
                                        <label className="dp-label">Commune</label>
                                        <input
                                            className="dp-input"
                                            readOnly
                                            value={t.commune}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {t.meme_adresse && d.adresse && (
                            <div className="info-box info-box-green">
                                📍 {d.adresse}, {d.code_postal} {d.commune}
                            </div>
                        )}
                    </div>

                    {/* Localisation confirmée — the PLU/urbanism analysis runs at l'étape 4 (Analyse PLU),
                        after the works are declared, so the constraints can be checked against the project. */}
                    {t.coords && (
                        <div className="dp-alert is-ok flex items-center gap-2.5">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            <span className="text-sm font-medium">Localisation confirmée. L’analyse du règlement d’urbanisme (PLU) et de ses contraintes se fera à l’étape <strong>Analyse PLU</strong>, une fois vos travaux décrits.</span>
                        </div>
                    )}

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
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                            <label className="text-sm font-medium t-ink2 block mb-3">Parcelles supplémentaires (si le projet s'étend sur plusieurs parcelles)</label>
                            <div className="space-y-3 mb-4">
                                {formData.cadastrales_multiparcelles?.map((parcelle, index) => (
                                    <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end p-3 rounded-lg animate-fadeIn" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', borderWidth: '1px', borderStyle: 'solid' }}>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="text-xs t-ink2 mb-1 block">Préfixe</label>
                                            <input className="dp-input text-sm py-2" placeholder="Ex: 000" value={parcelle.prefixe} onChange={e => updateCadastre(index, 'prefixe', e.target.value)} />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="text-xs t-ink2 mb-1 block">Section</label>
                                            <input className="dp-input text-sm py-2" placeholder="AB" value={parcelle.section} onChange={e => updateCadastre(index, 'section', e.target.value.toUpperCase())} />
                                        </div>
                                        <div className="flex-2 min-w-[150px]">
                                            <label className="text-xs t-ink2 mb-1 block">Numéro</label>
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
                            <button type="button" onClick={addCadastre} className="dp-btn-secondary text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Ajouter une parcelle
                            </button>
                        </div>

                        {/* Lotissement Toggle (Section 3) */}
                        <div className={`dp-check-card mt-5 ${formData.terrain_lotissement ? 'selected' : ''}`}>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded cursor-pointer"
                                    style={{ accentColor: 'var(--ac)' }}
                                    checked={formData.terrain_lotissement || false}
                                    onChange={(e) => updateField('terrain_lotissement', e.target.checked)}
                                />
                                <span className="text-sm font-medium t-ink">
                                    Le terrain est situé dans un lotissement
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Validation summary */}
                    {stepFatals.length > 0 && (
                        <div className="dp-alert is-error">
                            <span className="dp-alert-title">Informations requises avant de continuer</span>
                            <ul className="space-y-1">
                                {stepFatals.map(i => (
                                    <li key={i.id} className="text-sm t-error flex items-start gap-2"><span>✗</span>{i.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push('/etape/1')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button onClick={() => router.push('/etape/3')} disabled={stepFatals.length > 0} className="dp-btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed">
                            Étape suivante
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
