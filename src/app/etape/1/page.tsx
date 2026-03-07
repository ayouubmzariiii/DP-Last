'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'

export default function Etape1() {
    const router = useRouter()
    const { formData, updateDemandeur, updateField } = useDPContext()
    const d = formData.demandeur

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
                                            borderColor: '#2563eb',
                                            background: 'rgba(37,99,235,0.2)',
                                            color: '#93c5fd'
                                        } : {}}
                                    >
                                        {civ === 'M' ? 'Monsieur' : civ === 'Mme' ? 'Madame' : '🏢 Société'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {d.est_societe && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 rounded-xl"
                                style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
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

                    {/* Coordonnées */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">Coordonnées</h3>
                        <div className="space-y-4">
                            <div className="dp-form-group mb-4">
                                <label className="dp-label">Numéro et voie *</label>
                                <input className="dp-input" placeholder="Numéro et nom de rue" value={d.adresse} onChange={e => updateDemandeur({ adresse: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Lieu-dit</label>
                                    <input className="dp-input" placeholder="Lieu-dit" value={d.lieu_dit} onChange={e => updateDemandeur({ lieu_dit: e.target.value })} />
                                </div>
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
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Code postal / Zip *</label>
                                    <input className="dp-input" placeholder="75001" maxLength={6} value={d.code_postal} onChange={e => updateDemandeur({ code_postal: e.target.value })} />
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Localité / Commune *</label>
                                    <input className="dp-input" placeholder="Paris" value={d.commune} onChange={e => updateDemandeur({ commune: e.target.value })} />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <div />
                        <button onClick={handleNext} className="dp-btn-primary text-base">
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
