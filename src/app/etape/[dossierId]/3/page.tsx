'use client'

import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { TypeTravaux } from '@/lib/models'
import { TRAVAUX_LIST, getTravauxDef } from '@/lib/travauxRegistry'

// Selection cards are derived from the travaux registry — adding a work type there makes its
// card appear here automatically (its detail sub-form is still rendered per-type below).
const TRAVAUX_TYPES = TRAVAUX_LIST.map(d => ({
    id: d.id as TypeTravaux, icon: d.icon, title: d.title, subtitle: d.subtitle, desc: d.desc, color: d.color,
}))

const COLOR_MAP_ACTIVE: Record<string, React.CSSProperties> = {
    blue: { borderColor: 'var(--ac)', background: 'var(--act)', color: 'var(--ac)' },
    emerald: { borderColor: 'var(--ac)', background: 'var(--act)', color: 'var(--acd)' },
    amber: { borderColor: 'var(--ac)', background: 'var(--act)', color: 'var(--acd)' },
}

import React from 'react'
import { issuesForStep, fatalIssues } from '@/lib/validation'

export default function Etape3() {
    const router = useRouter()
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updateTravaux, updateTerrain, updateField } = useDPContext()
    const t = formData.travaux
    const terrain = formData.terrain

    const stepFatals = fatalIssues(issuesForStep(formData, 3))

    const selectType = (type: TypeTravaux) => {
        updateTravaux({ type })
    }

    const updateMen = (data: Partial<typeof t.menuiseries>) => {
        updateTravaux({ menuiseries: { ...t.menuiseries!, ...data } })
    }
    const updateIso = (data: Partial<typeof t.isolation>) => {
        updateTravaux({ isolation: { ...t.isolation!, ...data } })
    }
    const updatePV = (data: Partial<typeof t.photovoltaique>) => {
        updateTravaux({ photovoltaique: { ...t.photovoltaique!, ...data } })
    }
    const updateClo = (data: Partial<typeof t.cloture>) => updateTravaux({ cloture: { ...t.cloture!, ...data } })
    const updateRav = (data: Partial<typeof t.ravalement>) => updateTravaux({ ravalement: { ...t.ravalement!, ...data } })
    const updateToit = (data: Partial<typeof t.toiture>) => updateTravaux({ toiture: { ...t.toiture!, ...data } })
    const updateOuv = (data: Partial<typeof t.ouverture>) => updateTravaux({ ouverture: { ...t.ouverture!, ...data } })

    return (
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head">
                    <div className="dp-eyebrow">Étape 03 / 07 · Travaux</div>
                    <h2 className="dp-page-title">Type de <span className="accent">travaux</span></h2>
                    <p className="dp-page-sub">Sélectionnez le type de travaux concernés par votre demande</p>
                    <div className="dp-rule" />
                </div>

                <div className="space-y-6">
                    {/* Selection des travaux — even 3-column grid; the icon sits inline with the
                        title to keep each card compact while the full description stays visible. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {TRAVAUX_TYPES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => selectType(item.id)}
                                className="travaux-card text-left"
                                style={t.type === item.id ? (COLOR_MAP_ACTIVE[item.color] || COLOR_MAP_ACTIVE.emerald) : {}}
                            >
                                {t.type === item.id && (
                                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--ac)' }}>
                                        <svg className="w-3.5 h-3.5" style={{ color: 'var(--surface)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 mb-2.5" style={{ paddingRight: 22 }}>
                                    <span className="shrink-0" style={{ fontSize: 26, lineHeight: 1 }}>{item.icon}</span>
                                    <div className="min-w-0">
                                        <div className="font-bold t-ink leading-tight">{item.title}</div>
                                        <div className="text-xs font-semibold t-ink2 mt-0.5">{item.subtitle}</div>
                                    </div>
                                </div>
                                <p className="text-xs t-ink2 leading-relaxed">{item.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Sous-formulaire Menuiseries */}
                    {t.type === 'menuiseries' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🪟 Détails des menuiseries</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Type de menuiserie *</label>
                                    <select className="dp-select" value={t.menuiseries?.type || ''} onChange={e => updateMen({ type: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="fenetre">Fenêtre(s)</option>
                                        <option value="porte">Porte(s) extérieure(s)</option>
                                        <option value="volet">Volet(s)</option>
                                        <option value="baie_vitree">Baie(s) vitrée(s)</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Matériau *</label>
                                    <select className="dp-select" value={t.menuiseries?.materiau || ''} onChange={e => updateMen({ materiau: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="pvc">PVC</option>
                                        <option value="aluminium">Aluminium</option>
                                        <option value="bois">Bois</option>
                                        <option value="mixte">Mixte bois/aluminium</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Couleur</label>
                                    <input className="dp-input" placeholder="ex: Blanc RAL 9016" value={t.menuiseries?.couleur || ''} onChange={e => updateMen({ couleur: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Code RAL (optionnel)</label>
                                    <input className="dp-input" placeholder="ex: RAL 7016" value={t.menuiseries?.couleur_ral || ''} onChange={e => updateMen({ couleur_ral: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Nombre d'éléments</label>
                                    <input className="dp-input" placeholder="ex: 4" type="number" value={t.menuiseries?.nombre || ''} onChange={e => updateMen({ nombre: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Remplacement de l'existant ?</label>
                                    <div className="flex gap-3 mt-1">
                                        {[true, false].map(v => (
                                            <button key={String(v)} type="button"
                                                onClick={() => updateMen({ remplacement: v })}
                                                className={`toggle-btn ${t.menuiseries?.remplacement === v ? 'active' : ''}`}>
                                                {v ? 'Oui' : 'Non, création'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Dimensions (largeur × hauteur en cm)</label>
                                    <div className="flex gap-3">
                                        <input className="dp-input" placeholder="Largeur (cm)" type="number" value={t.menuiseries?.largeur || ''} onChange={e => updateMen({ largeur: e.target.value })} />
                                        <span className="flex items-center t-ink2 font-semibold">×</span>
                                        <input className="dp-input" placeholder="Hauteur (cm)" type="number" value={t.menuiseries?.hauteur || ''} onChange={e => updateMen({ hauteur: e.target.value })} />
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Isolation */}
                    {t.type === 'isolation' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🏠 Détails de l'isolation extérieure</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Type de finition *</label>
                                    <select className="dp-select" value={t.isolation?.type_finition || ''} onChange={e => updateIso({ type_finition: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="enduit">Enduit de finition</option>
                                        <option value="bardage_bois">Bardage bois</option>
                                        <option value="bardage_metal">Bardage métal / acier</option>
                                        <option value="bardage_composite">Bardage composite / HPL</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Couleur de finition</label>
                                    <input className="dp-input" placeholder="ex: Beige sablé, Gris anthracite" value={t.isolation?.couleur || ''} onChange={e => updateIso({ couleur: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Matériau isolant</label>
                                    <input className="dp-input" placeholder="ex: Laine de roche, Polystyrène EPS" value={t.isolation?.materiau_isolant || ''} onChange={e => updateIso({ materiau_isolant: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Épaisseur de l'isolant (cm)</label>
                                    <input className="dp-input" placeholder="ex: 14" type="number" value={t.isolation?.epaisseur_isolant || ''} onChange={e => updateIso({ epaisseur_isolant: e.target.value })} />
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Façades concernées</label>
                                    <div className="flex gap-2 flex-wrap mt-1">
                                        {['Façade avant', 'Façade arrière', 'Pignon droit', 'Pignon gauche', 'Toutes les façades'].map(f => {
                                            const selected = t.isolation?.facades_concernees?.includes(f)
                                            return (
                                                <button key={f} type="button"
                                                    onClick={() => {
                                                        const existing = t.isolation?.facades_concernees || []
                                                        updateIso({ facades_concernees: selected ? existing.filter(x => x !== f) : [...existing, f] })
                                                    }}
                                                    className={`toggle-btn ${selected ? 'active' : ''}`}>
                                                    {f}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Photovoltaïque */}
                    {t.type === 'photovoltaique' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">☀️ Détails des panneaux photovoltaïques</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Nombre de panneaux *</label>
                                    <input className="dp-input" placeholder="ex: 12" type="number" value={t.photovoltaique?.nombre_panneaux || ''} onChange={e => updatePV({ nombre_panneaux: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Surface totale (m²)</label>
                                    <input className="dp-input" placeholder="ex: 24" type="number" value={t.photovoltaique?.surface_totale || ''} onChange={e => updatePV({ surface_totale: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Puissance installée (kWc)</label>
                                    <input className="dp-input" placeholder="ex: 6" type="number" value={t.photovoltaique?.puissance_kw || ''} onChange={e => updatePV({ puissance_kw: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Marque / Modèle</label>
                                    <input className="dp-input" placeholder="ex: SunPower SPR-245" value={t.photovoltaique?.marque || ''} onChange={e => updatePV({ marque: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Orientation</label>
                                    <select className="dp-select" value={t.photovoltaique?.orientation || 'Sud'} onChange={e => updatePV({ orientation: e.target.value })}>
                                        <option>Sud</option>
                                        <option>Sud-Est</option>
                                        <option>Sud-Ouest</option>
                                        <option>Est</option>
                                        <option>Ouest</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Inclinaison (degrés)</label>
                                    <input className="dp-input" placeholder="ex: 30" type="number" value={t.photovoltaique?.inclinaison || ''} onChange={e => updatePV({ inclinaison: e.target.value })} />
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Mode d'intégration *</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { val: 'surimposition', label: 'Surimposition', desc: 'Fixés sur la toiture existante' },
                                            { val: 'integration', label: 'Intégration au bâti', desc: 'En remplacement des tuiles/ardoises' },
                                        ].map(opt => (
                                            <button key={opt.val} type="button"
                                                onClick={() => updatePV({ integration: opt.val as 'surimposition' | 'integration' })}
                                                className={`toggle-btn text-left ${t.photovoltaique?.integration === opt.val ? 'active' : ''}`}>
                                                <div className="font-semibold text-sm t-ink">{opt.label}</div>
                                                <div className="text-xs t-ink2 mt-0.5">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Clôture */}
                    {t.type === 'cloture' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🧱 Détails de la clôture</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Type de clôture *</label>
                                    <select className="dp-select" value={t.cloture?.type_cloture || ''} onChange={e => updateClo({ type_cloture: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="mur">Mur plein</option>
                                        <option value="mur_bahut">Mur-bahut + grille / grillage</option>
                                        <option value="grillage">Grillage</option>
                                        <option value="panneaux">Panneaux rigides</option>
                                        <option value="claire_voie">Clôture à claire-voie</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Matériau</label>
                                    <input className="dp-input" placeholder="ex: Aluminium, PVC, bois, maçonnerie" value={t.cloture?.materiau || ''} onChange={e => updateClo({ materiau: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Couleur</label>
                                    <input className="dp-input" placeholder="ex: Gris anthracite RAL 7016" value={t.cloture?.couleur || ''} onChange={e => updateClo({ couleur: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Hauteur (m) *</label>
                                    <input className="dp-input" type="number" step="0.01" placeholder="ex: 1.80" value={t.cloture?.hauteur || ''} onChange={e => updateClo({ hauteur: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Longueur (m)</label>
                                    <input className="dp-input" type="number" placeholder="ex: 15" value={t.cloture?.longueur || ''} onChange={e => updateClo({ longueur: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Implantation</label>
                                    <div className="flex gap-3 mt-1">
                                        {[{ v: true, l: 'Sur rue / voie publique' }, { v: false, l: 'Limite séparative' }].map(o => (
                                            <button key={String(o.v)} type="button" onClick={() => updateClo({ sur_voie: o.v })} className={`toggle-btn ${t.cloture?.sur_voie === o.v ? 'active' : ''}`}>{o.l}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Ravalement */}
                    {t.type === 'ravalement' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🎨 Détails du ravalement</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Finition *</label>
                                    <select className="dp-select" value={t.ravalement?.finition || ''} onChange={e => updateRav({ finition: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="enduit">Enduit</option>
                                        <option value="peinture">Peinture / ravalement peint</option>
                                        <option value="pierre_apparente">Pierre apparente (rejointoiement)</option>
                                        <option value="bardage">Bardage</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Teinte / couleur *</label>
                                    <input className="dp-input" placeholder="ex: Ton pierre, RAL 1015" value={t.ravalement?.couleur || ''} onChange={e => updateRav({ couleur: e.target.value })} />
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Façades concernées</label>
                                    <div className="flex gap-2 flex-wrap mt-1">
                                        {['Façade avant', 'Façade arrière', 'Pignon droit', 'Pignon gauche', 'Toutes les façades'].map(f => {
                                            const selected = t.ravalement?.facades_concernees?.includes(f)
                                            return (
                                                <button key={f} type="button" onClick={() => { const ex = t.ravalement?.facades_concernees || []; updateRav({ facades_concernees: selected ? ex.filter(x => x !== f) : [...ex, f] }) }} className={`toggle-btn ${selected ? 'active' : ''}`}>{f}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Toiture */}
                    {t.type === 'toiture' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🏘️ Détails de la toiture</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Opération *</label>
                                    <select className="dp-select" value={t.toiture?.operation || ''} onChange={e => updateToit({ operation: e.target.value as never })}>
                                        <option value="refection_identique">Réfection à l'identique</option>
                                        <option value="changement_materiau">Changement de matériau de couverture</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Matériau de couverture *</label>
                                    <input className="dp-input" placeholder="ex: Tuile terre cuite, ardoise, zinc, bac acier" value={t.toiture?.materiau_couverture || ''} onChange={e => updateToit({ materiau_couverture: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Teinte / couleur</label>
                                    <input className="dp-input" placeholder="ex: Rouge nuancé, ardoise" value={t.toiture?.couleur || ''} onChange={e => updateToit({ couleur: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sous-formulaire Ouverture */}
                    {t.type === 'ouverture' && (
                        <div className="dp-card animate-fadeIn">
                            <h3 className="dp-section-title">🚪 Détails de l'ouverture</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="dp-form-group">
                                    <label className="dp-label">Type d'ouverture *</label>
                                    <select className="dp-select" value={t.ouverture?.type_ouverture || ''} onChange={e => updateOuv({ type_ouverture: e.target.value as never })}>
                                        <option value="">-- Sélectionner --</option>
                                        <option value="fenetre">Fenêtre</option>
                                        <option value="porte">Porte</option>
                                        <option value="porte_fenetre">Porte-fenêtre</option>
                                        <option value="fenetre_toit">Fenêtre de toit (velux)</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Opération *</label>
                                    <select className="dp-select" value={t.ouverture?.operation || ''} onChange={e => updateOuv({ operation: e.target.value as never })}>
                                        <option value="creation">Création</option>
                                        <option value="agrandissement">Agrandissement</option>
                                        <option value="suppression">Suppression</option>
                                    </select>
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Nombre</label>
                                    <input className="dp-input" type="number" placeholder="ex: 1" value={t.ouverture?.nombre || ''} onChange={e => updateOuv({ nombre: e.target.value })} />
                                </div>
                                <div className="dp-form-group">
                                    <label className="dp-label">Façade concernée</label>
                                    <input className="dp-input" placeholder="ex: Façade arrière, pan de toiture Sud" value={t.ouverture?.facade || ''} onChange={e => updateOuv({ facade: e.target.value })} />
                                </div>
                                <div className="dp-form-group md:col-span-2">
                                    <label className="dp-label">Dimensions (largeur × hauteur en cm)</label>
                                    <div className="flex gap-3">
                                        <input className="dp-input" type="number" placeholder="Largeur (cm)" value={t.ouverture?.largeur || ''} onChange={e => updateOuv({ largeur: e.target.value })} />
                                        <span className="flex items-center t-ink2 font-semibold">×</span>
                                        <input className="dp-input" type="number" placeholder="Hauteur (cm)" value={t.ouverture?.hauteur || ''} onChange={e => updateOuv({ hauteur: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section Commune: Projet & Surfaces */}
                    {t.type && (
                        <div className="dp-card animate-fadeIn mt-6" style={{ borderColor: 'var(--acb)' }}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--act)', color: 'var(--ac)' }}>📝</div>
                                <div>
                                    <h3 className="font-bold t-ink text-lg">Description & Surfaces</h3>
                                    <p className="text-xs t-ink2">Informations générales sur le projet</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="dp-form-group">
                                    <label className="dp-label">
                                        {getTravauxDef(t.type)?.descLabel || 'Courte description de votre projet ou de vos travaux :'}
                                    </label>
                                    <textarea
                                        value={t.description_projet || ''}
                                        onChange={e => updateTravaux({ description_projet: e.target.value })}
                                        rows={4}
                                        className="dp-input"
                                        placeholder={getTravauxDef(t.type)?.descPlaceholder || 'Décrivez succinctement les travaux envisagés...'}
                                    />
                                </div>

                                <div>
                                    <label className="dp-label mb-2 block">Destination du logement</label>
                                    <div className="flex gap-3 mb-5">
                                        {[
                                            { val: 'principale', label: '🏡 Résidence principale' },
                                            { val: 'secondaire', label: '🌅 Résidence secondaire' },
                                        ].map(opt => (
                                            <button key={opt.val} type="button"
                                                onClick={() => updateField('projet_concerne', opt.val)}
                                                className={`toggle-btn flex-1 ${formData.projet_concerne === opt.val ? 'active' : ''}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="dp-label mb-3 block">Surfaces de plancher (en m²)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="rounded-xl p-3" style={{ background: 'var(--field)', border: '1px solid var(--line-3)' }}>
                                            <label className="text-xs t-ink2 font-semibold mb-1.5 block">Existante avant travaux</label>
                                            <input
                                                className="dp-input"
                                                type="number"
                                                value={t.surfaces?.existante || ''}
                                                onChange={e => updateTravaux({ surfaces: { ...t.surfaces, existante: e.target.value } as any })}
                                            />
                                        </div>
                                        <div className="rounded-xl p-3" style={{ background: 'var(--field)', border: '1px solid var(--line-3)' }}>
                                            <label className="text-xs t-ink2 font-semibold mb-1.5 block">Créée</label>
                                            <input
                                                className="dp-input"
                                                type="number"
                                                value={t.surfaces?.creee || ''}
                                                onChange={e => updateTravaux({ surfaces: { ...t.surfaces, creee: e.target.value } as any })}
                                            />
                                        </div>
                                        <div className="rounded-xl p-3" style={{ background: 'var(--field)', border: '1px solid var(--line-3)' }}>
                                            <label className="text-xs t-ink2 font-semibold mb-1.5 block">Supprimée</label>
                                            <input
                                                className="dp-input"
                                                type="number"
                                                value={t.surfaces?.supprimee || ''}
                                                onChange={e => updateTravaux({ surfaces: { ...t.surfaces, supprimee: e.target.value } as any })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Validation summary */}
                    {stepFatals.length > 0 && (
                        <div className="dp-alert is-error">
                            <p className="dp-alert-title">Informations requises avant de continuer</p>
                            <ul className="space-y-1">
                                {stepFatals.map(i => (
                                    <li key={i.id} className="text-sm t-error flex items-start gap-2"><span>✗</span>{i.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push(`/etape/${dossierId}/2`)} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button
                            onClick={() => router.push(`/etape/${dossierId}/4`)}
                            disabled={!t.type || stepFatals.length > 0}
                            className="dp-btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
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
