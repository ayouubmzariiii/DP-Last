'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { issuesForStep, fatalIssues } from '@/lib/validation'

export default function Etape1() {
    const router = useRouter()
    const { formData, updateDemandeur, updateCoDemandeur, updateTerrain, updateField } = useDPContext()
    const d = formData.demandeur
    const t = formData.terrain
    const co = formData.co_demandeur

    const stepFatals = fatalIssues(issuesForStep(formData, 1))

    const [loadingPLU, setLoadingPLU] = useState(false)
    const [pluError, setPluError] = useState<string | null>(null)
    const [showPdfPreview, setShowPdfPreview] = useState(false)

    const fetchPLUForCoords = async (coords: { lat: number; lon: number }) => {
        setLoadingPLU(true)
        setPluError(null)
        try {
            const res = await fetch(`/api/fetch-plu?lat=${coords.lat}&lon=${coords.lon}&commune=${encodeURIComponent(d.commune || '')}`)
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

    // Auto-geocode address if address exists but coords do not (e.g. on default load or reset)
    useEffect(() => {
        const autoGeocode = async () => {
            if (d.adresse && !d.coords && !loadingPLU) {
                setLoadingPLU(true)
                setPluError(null)
                try {
                    const q = `${d.adresse}, ${d.code_postal} ${d.commune}`
                    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`)
                    if (!response.ok) throw new Error("Erreur de géocodage de l'adresse")
                    const data = await response.json()
                    if (data.features && data.features.length > 0) {
                        const feature = data.features[0]
                        const coords = {
                            lat: feature.geometry.coordinates[1],
                            lon: feature.geometry.coordinates[0]
                        }
                        updateDemandeur({ coords })
                        if (t.meme_adresse) {
                            updateTerrain({ coords })
                        }
                        // Now fetch PLU for these coords
                        const res = await fetch(`/api/fetch-plu?lat=${coords.lat}&lon=${coords.lon}&commune=${encodeURIComponent(d.commune || '')}`)
                        if (!res.ok) throw new Error("Erreur de récupération du PLU")
                        const pluData = await res.json()
                        updateTerrain({ plu: pluData })
                    } else {
                        setPluError("Impossible de localiser l'adresse pour le PLU.")
                    }
                } catch (err: any) {
                    console.error("Auto-geocode failed:", err)
                    setPluError(err.message || "Erreur lors de la localisation automatique.")
                } finally {
                    setLoadingPLU(false)
                }
            }
        }
        autoGeocode()
    }, [d.adresse, d.coords, t.meme_adresse])

    // Auto-fetch PLU when coordinates are available but PLU is not yet loaded
    useEffect(() => {
        if (d.coords && t.meme_adresse && !t.plu && !loadingPLU) {
            fetchPLUForCoords(d.coords)
        }
    }, [d.coords, t.meme_adresse, t.plu])

    const handleNext = () => {
        router.push('/etape/2')
    }

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Vos informations personnelles</h2>
                    <p className="text-slate-500 mt-1">Ces informations figureront sur le formulaire CERFA 13703*</p>
                </div>

                <div className="space-y-6">
                    {/* Civilité */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Identité du demandeur</h3>

                        <div className="dp-form-group mb-4">
                            <label className="dp-label">Vous êtes *</label>
                            <div className="flex gap-3 flex-wrap">
                                {['M', 'Mme', 'Société'].map((civ) => (
                                    <button
                                        key={civ}
                                        type="button"
                                        onClick={() => updateDemandeur({
                                            civilite: civ as 'M' | 'Mme' | 'Société',
                                            est_societe: civ === 'Société'
                                        })}
                                        className="toggle-btn"
                                        style={d.civilite === civ ? {
                                            borderColor: '#2D5A4C',
                                            background: 'rgba(45,90,76,0.2)',
                                            color: '#2D5A4C'
                                        } : {}}
                                    >
                                        {civ === 'M' ? 'Monsieur' : civ === 'Mme' ? 'Madame' : '🏢 Société'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {d.est_societe && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 rounded-xl"
                                style={{ background: 'rgba(45,90,76,0.1)', border: '1px solid rgba(45,90,76,0.2)' }}>
                                <div className="dp-form-group">
                                    <label className="dp-label">Dénomination sociale *</label>
                                    <input
                                        className="dp-input"
                                        placeholder="ex: SCI Dupont"
                                        value={d.nom_societe}
                                        onChange={e => updateDemandeur({ nom_societe: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Type de société</label>
                                    <input
                                        className="dp-input"
                                        placeholder="ex: SCI, SARL, SAS"
                                        value={d.type_societe}
                                        onChange={e => updateDemandeur({ type_societe: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 dp-form-group">
                                    <label className="dp-label">SIRET</label>
                                    <input
                                        className="dp-input"
                                        placeholder="ex: 12345678900011"
                                        value={d.siret}
                                        onChange={e => updateDemandeur({ siret: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Représentant légal (Prénom)</label>
                                    <input
                                        className="dp-input"
                                        placeholder="Prénom du représentant"
                                        value={d.representant_prenom}
                                        onChange={e => updateDemandeur({ representant_prenom: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Représentant légal (Nom)</label>
                                    <input
                                        className="dp-input"
                                        placeholder="Nom du représentant"
                                        value={d.representant_nom}
                                        onChange={e => updateDemandeur({ representant_nom: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="dp-form-group">
                                <label className="dp-label">Nom *</label>
                                <input
                                    className="dp-input"
                                    placeholder="Nom de famille"
                                    value={d.nom}
                                    onChange={e => updateDemandeur({ nom: e.target.value })}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Prénom *</label>
                                <input
                                    className="dp-input"
                                    placeholder="Prénom"
                                    value={d.prenom}
                                    onChange={e => updateDemandeur({ prenom: e.target.value })}
                                />
                            </div>
                        </div>

                        {!d.est_societe && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Date de naissance</label>
                                    <input
                                        className="dp-input"
                                        placeholder="JJ/MM/AAAA"
                                        value={d.date_naissance}
                                        onChange={e => updateDemandeur({ date_naissance: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Commune de naissance</label>
                                    <input
                                        className="dp-input"
                                        placeholder="Ex: Lyon"
                                        value={d.lieu_naissance}
                                        onChange={e => updateDemandeur({ lieu_naissance: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Département de naissance</label>
                                    <input
                                        className="dp-input"
                                        placeholder="Ex: 69"
                                        value={d.departement_naissance}
                                        onChange={e => updateDemandeur({ departement_naissance: e.target.value })}
                                    />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Pays de naissance</label>
                                    <input
                                        className="dp-input"
                                        placeholder="Ex: France"
                                        value={d.pays_naissance}
                                        onChange={e => updateDemandeur({ pays_naissance: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Co-déclarant (optionnel) */}
                    <div className="dp-card">
                        <label className="flex items-center gap-3 cursor-pointer mb-1">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-600 bg-slate-800 accent-blue-500 cursor-pointer"
                                checked={!!co?.actif}
                                onChange={e => updateCoDemandeur({ actif: e.target.checked })}
                            />
                            <span className="dp-section-title !mb-0">Ajouter un co-déclarant</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-4">Pour un bien en indivision ou un couple co-propriétaire (rubrique 2BIS du CERFA).</p>

                        {co?.actif && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="flex gap-3 flex-wrap">
                                    {['M', 'Mme', 'Société'].map((civ) => (
                                        <button
                                            key={civ}
                                            type="button"
                                            onClick={() => updateCoDemandeur({ civilite: civ as 'M' | 'Mme' | 'Société', est_societe: civ === 'Société' })}
                                            className="toggle-btn"
                                            style={co.civilite === civ ? { borderColor: '#2D5A4C', background: 'rgba(45,90,76,0.2)', color: '#2D5A4C' } : {}}
                                        >
                                            {civ === 'M' ? 'Monsieur' : civ === 'Mme' ? 'Madame' : '🏢 Société'}
                                        </button>
                                    ))}
                                </div>
                                {!co.est_societe ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="dp-form-group">
                                            <label className="dp-label">Nom</label>
                                            <input className="dp-input" placeholder="Nom de famille" value={co.nom} onChange={e => updateCoDemandeur({ nom: e.target.value })} />
                                        </div>
                                        <div className="dp-form-group">
                                            <label className="dp-label">Prénom</label>
                                            <input className="dp-input" placeholder="Prénom" value={co.prenom} onChange={e => updateCoDemandeur({ prenom: e.target.value })} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="dp-form-group">
                                            <label className="dp-label">Dénomination sociale</label>
                                            <input className="dp-input" placeholder="ex: SCI Dupont" value={co.nom_societe} onChange={e => updateCoDemandeur({ nom_societe: e.target.value })} />
                                        </div>
                                        <div className="dp-form-group">
                                            <label className="dp-label">SIRET</label>
                                            <input className="dp-input" placeholder="14 chiffres" value={co.siret} onChange={e => updateCoDemandeur({ siret: e.target.value })} />
                                        </div>
                                        <div className="dp-form-group">
                                            <label className="dp-label">Représentant (Nom)</label>
                                            <input className="dp-input" value={co.representant_nom} onChange={e => updateCoDemandeur({ representant_nom: e.target.value })} />
                                        </div>
                                        <div className="dp-form-group">
                                            <label className="dp-label">Représentant (Prénom)</label>
                                            <input className="dp-input" value={co.representant_prenom} onChange={e => updateCoDemandeur({ representant_prenom: e.target.value })} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Coordonnées */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Coordonnées</h3>
                        <div className="space-y-4">
                            <div className="dp-form-group mb-4">
                                <label className="dp-label">Recherche d'adresse complète *</label>
                                <AddressAutocomplete
                                    placeholder="Saisissez votre adresse..."
                                    initialValue={d.adresse ? `${d.adresse}, ${d.code_postal} ${d.commune}` : ''}
                                    onAddressSelected={(addr) => {
                                     updateDemandeur({
                                         adresse: addr.adresse,
                                         code_postal: addr.code_postal,
                                         commune: addr.commune,
                                         coords: addr.coords,
                                         pays: 'France',
                                         lieu_dit: '',
                                         boite_postale: '',
                                         cedex: '',
                                         division_territoriale: ''
                                     })
                                     if (formData.terrain.meme_adresse) {
                                         updateTerrain({
                                             adresse: addr.adresse,
                                             code_postal: addr.code_postal,
                                             commune: addr.commune,
                                             coords: addr.coords,
                                             plu: undefined
                                         })
                                     }
                                     // Trigger immediate PLU fetch
                                     fetchPLUForCoords(addr.coords)
                                 }}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="dp-form-group">
                                <label className="dp-label">Voie (extraite)</label>
                                <input className="dp-input bg-slate-900/50 text-slate-400" readOnly value={d.adresse} />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Lieu-dit</label>
                                <input className="dp-input" placeholder="Lieu-dit" value={d.lieu_dit} onChange={e => updateDemandeur({ lieu_dit: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">BP / Boîte Postale</label>
                                    <input className="dp-input" placeholder="Ex: BP 12" value={d.boite_postale} onChange={e => updateDemandeur({ boite_postale: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Cedex</label>
                                    <input className="dp-input" placeholder="Ex: 75001 Cedex" value={d.cedex} onChange={e => updateDemandeur({ cedex: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Code postal</label>
                                    <input className="dp-input bg-slate-900/50 text-slate-400" readOnly value={d.code_postal} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Commune</label>
                                    <input className="dp-input bg-slate-900/50 text-slate-400" readOnly value={d.commune} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="dp-form-group">
                                <label className="dp-label">Pays</label>
                                <input className="dp-input" placeholder="France" value={d.pays} onChange={e => updateDemandeur({ pays: e.target.value })} />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Division territoriale (Étranger)</label>
                                <input className="dp-input" placeholder="État / Province" value={d.division_territoriale} onChange={e => updateDemandeur({ division_territoriale: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="dp-form-group flex gap-2">
                                <div className="w-1/3">
                                    <label className="dp-label">Indicatif</label>
                                    <input className="dp-input" placeholder="+33" value={d.indicatif_etranger} onChange={e => updateDemandeur({ indicatif_etranger: e.target.value })} />
                                </div>
                                <div className="w-2/3">
                                    <label className="dp-label">Téléphone *</label>
                                    <input className="dp-input" placeholder="06 00 00 00 00" type="tel" value={d.telephone} onChange={e => updateDemandeur({ telephone: e.target.value })} />
                                </div>
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Email *</label>
                                <input className="dp-input" placeholder="votre@email.fr" type="email" value={d.email} onChange={e => updateDemandeur({ email: e.target.value })} />
                            </div>
                        </div>

                        {/* Diagnostic PLU */}
                        {(d.coords || loadingPLU || pluError) && (
                            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl mt-4 animate-fadeIn">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <span>🔍</span> Diagnostic d'Urbanisme (PLU/Géoportail)
                                </h4>
                                
                                {loadingPLU && (
                                    <div className="flex flex-col items-center py-4">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                                        <p className="text-[11px] text-slate-400">Interrogation du Géoportail de l'Urbanisme...</p>
                                    </div>
                                )}

                                {pluError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                                        ⚠️ {pluError}
                                    </div>
                                )}

                                {!loadingPLU && !pluError && formData.terrain.plu && (
                                    <div className="space-y-3">
                                        {formData.terrain.plu.zone ? (
                                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white uppercase">
                                                            Zone {formData.terrain.plu.zone.libelle}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                            ({formData.terrain.plu.zone.nomzone})
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 font-medium">
                                                        {formData.terrain.plu.zone.libelong || 'Description indisponible.'}
                                                    </p>
                                                </div>
                                                {formData.terrain.plu.zone.url_doc && (
                                                    <div className="flex gap-2 shrink-0">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setShowPdfPreview(!showPdfPreview)}
                                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] font-bold rounded-lg transition-colors border border-slate-700 inline-flex items-center gap-1"
                                                        >
                                                            {showPdfPreview ? '👁️ Masquer' : '👁️ Consulter'}
                                                        </button>
                                                        <a 
                                                            href={formData.terrain.plu.zone.url_doc} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                                                        >
                                                            📄 Ouvrir
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                                                ℹ️ Aucune zone PLU spécifique détectée sur Géoportail. Le Règlement National d'Urbanisme (RNU) s'applique par défaut.
                                            </div>
                                        )}

                                        {!formData.terrain.plu.zone?.url_doc && (
                                            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <p className="text-xs text-slate-400">
                                                    Le document PDF officiel n'est pas publié sur le Géoportail de l'Urbanisme pour cette commune.
                                                </p>
                                                <a 
                                                    href={`https://www.google.com/search?q=${encodeURIComponent(`PLU ${formData.terrain.commune || ''} reglement pdf`)}`}
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-colors border border-slate-700 inline-flex items-center gap-1 shrink-0"
                                                >
                                                    🔍 Chercher sur Google
                                                </a>
                                            </div>
                                        )}

                                        {showPdfPreview && formData.terrain.plu?.zone?.url_doc && (
                                            <div className="mt-3 border border-slate-750 rounded-xl overflow-hidden bg-slate-950/90">
                                                <div className="bg-slate-900 px-3 py-2 border-b border-slate-750 flex justify-between items-center">
                                                    <span className="text-[11px] text-slate-400">Aperçu du Règlement PDF</span>
                                                </div>
                                                <iframe 
                                                    src={formData.terrain.plu.zone.url_doc} 
                                                    className="w-full h-[450px] border-0" 
                                                    title="Aperçu du règlement d'urbanisme (PLU)"
                                                />
                                            </div>
                                        )}

                                        <div className="mt-3 pt-3 border-t border-slate-800">
                                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <span>⚠️</span> Prescriptions & Contraintes (Servitudes)
                                            </h5>
                                            {formData.terrain.plu.prescriptions && formData.terrain.plu.prescriptions.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {formData.terrain.plu.prescriptions.map((p: any, idx: number) => (
                                                        <div key={idx} className="p-2 bg-slate-800/60 border border-slate-700 rounded-lg flex items-start gap-1.5">
                                                            <span className="text-amber-400 mt-0.5 text-xs">⚠️</span>
                                                            <div>
                                                                <p className="text-[10px] text-white font-semibold leading-tight">{p.libelle}</p>
                                                                <p className="text-[8px] text-slate-500 font-mono mt-0.5">Type: {p.typepresc}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-500 italic">
                                                    Aucune prescription patrimoniale ou environnementale détectée pour ces coordonnées.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                            {/* Dematerialisation (Section 2 addition) */}
                            <div className="mt-6 pt-4 border-t border-slate-700/50">
                                <label className="flex items-start gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                                    <div className="mt-1">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-slate-600 bg-slate-800 accent-blue-500 cursor-pointer"
                                            checked={formData.accord_dematerialisation || false}
                                            onChange={(e) => updateField('accord_dematerialisation', e.target.checked)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-slate-200 block">Accord de communication électronique</span>
                                        <span className="text-sm text-slate-400 block max-w-2xl leading-relaxed">
                                            J’accepte de recevoir à l’adresse électronique communiquée les réponses de l’administration et notamment par lettre recommandée électronique ou par un autre procédé électronique équivalent les documents habituellement notifiés par lettre recommandée avec accusé de réception.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Validation summary */}
                    {stepFatals.length > 0 && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1.5">Informations requises avant de continuer</p>
                            <ul className="space-y-1">
                                {stepFatals.map(i => (
                                    <li key={i.id} className="text-sm text-red-300 flex items-start gap-2"><span>✗</span>{i.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <div />
                        <button onClick={handleNext} disabled={stepFatals.length > 0} className="dp-btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed">
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
