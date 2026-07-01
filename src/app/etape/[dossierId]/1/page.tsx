'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { issuesForStep, fatalIssues } from '@/lib/validation'

export default function Etape1() {
    const router = useRouter()
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updateDemandeur, updateCoDemandeur, updateTerrain, updateField } = useDPContext()
    const d = formData.demandeur
    const t = formData.terrain
    const co = formData.co_demandeur

    const stepFatals = fatalIssues(issuesForStep(formData, 1))

    const [loadingPLU, setLoadingPLU] = useState(false)
    const [pluError, setPluError] = useState<string | null>(null)

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
        router.push(`/etape/${dossierId}/2`)
    }

    return (
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Étape 01 / 07 · Demandeur</span>
                    <h2 className="dp-page-title">Vos informations <span className="accent">personnelles</span></h2>
                    <p className="dp-page-sub">Ces informations figureront sur le formulaire CERFA 13703*.</p>
                    <div className="dp-rule" />
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
                                        className={`toggle-btn ${d.civilite === civ ? 'active' : ''}`}
                                    >
                                        {civ === 'M' ? 'Monsieur' : civ === 'Mme' ? 'Madame' : '🏢 Société'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {d.est_societe && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 rounded-xl"
                                style={{ background: 'var(--act)', border: '1px solid var(--acb)' }}>
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
                                className="w-5 h-5 rounded cursor-pointer"
                                style={{ accentColor: 'var(--ac)' }}
                                checked={!!co?.actif}
                                onChange={e => updateCoDemandeur({ actif: e.target.checked })}
                            />
                            <span className="dp-section-title !mb-0 !pb-0 !border-0">Ajouter un co-déclarant</span>
                        </label>
                        <p className="text-xs t-muted mb-4">Pour un bien en indivision ou un couple co-propriétaire (rubrique 2BIS du CERFA).</p>

                        {co?.actif && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="flex gap-3 flex-wrap">
                                    {['M', 'Mme', 'Société'].map((civ) => (
                                        <button
                                            key={civ}
                                            type="button"
                                            onClick={() => updateCoDemandeur({ civilite: civ as 'M' | 'Mme' | 'Société', est_societe: civ === 'Société' })}
                                            className={`toggle-btn ${co.civilite === civ ? 'active' : ''}`}
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
                                <input className="dp-input" readOnly value={d.adresse} />
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
                                    <input className="dp-input" readOnly value={d.code_postal} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Commune</label>
                                    <input className="dp-input" readOnly value={d.commune} />
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

                            {/* Dematerialisation (Section 2 addition) */}
                            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--line-2)' }}>
                                <label className={`dp-check-card ${formData.accord_dematerialisation ? 'selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.accord_dematerialisation || false}
                                        onChange={(e) => updateField('accord_dematerialisation', e.target.checked)}
                                    />
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium t-ink block">Accord de communication électronique</span>
                                        <span className="text-sm t-ink2 block max-w-2xl leading-relaxed">
                                            J’accepte de recevoir à l’adresse électronique communiquée les réponses de l’administration et notamment par lettre recommandée électronique ou par un autre procédé électronique équivalent les documents habituellement notifiés par lettre recommandée avec accusé de réception.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Validation summary */}
                    {stepFatals.length > 0 && (
                        <div className="dp-alert is-error">
                            <span className="dp-alert-title">Informations requises avant de continuer</span>
                            <ul className="space-y-1">
                                {stepFatals.map(i => (
                                    <li key={i.id} className="flex items-start gap-2"><span>✗</span>{i.message}</li>
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
        </>
    )
}
