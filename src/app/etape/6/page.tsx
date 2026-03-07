'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'

function RecapSection({ title, icon, items }: {
    title: string; icon: string;
    items: { label: string; value: string | undefined | null }[]
}) {
    return (
        <div className="dp-card">
            <h3 className="dp-section-title flex items-center gap-2">
                <span>{icon}</span> {title}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {items.filter(i => i.value).map((item) => (
                    <div key={item.label}>
                        <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.label}</dt>
                        <dd className="text-sm font-medium text-slate-100 mt-0.5">{item.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

export default function Etape6() {
    const router = useRouter()
    const { formData, resetForm, updateField } = useDPContext()
    const { demandeur, terrain, travaux, photos } = formData

    const [generatingCerfa, setGeneratingCerfa] = useState(false)
    const [generatingDP, setGeneratingDP] = useState(false)
    const [cerfaDone, setCerfaDone] = useState(false)
    const [dpDone, setDpDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const photosUploaded = Object.values(photos).filter(Boolean).length

    const downloadCerfa = async () => {
        setGeneratingCerfa(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-cerfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })
            if (!res.ok) throw new Error('Erreur lors de la génération')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `CERFA_13703_${demandeur.nom}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            setCerfaDone(true)
        } catch (e) {
            setError('Erreur lors de la génération du CERFA. Réessayez.')
            console.error(e)
        } finally {
            setGeneratingCerfa(false)
        }
    }

    const downloadDP = async () => {
        setGeneratingDP(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-dp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })
            if (!res.ok) throw new Error('Erreur lors de la génération')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Dossier_DP_${demandeur.nom}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            setDpDone(true)
        } catch (e) {
            setError('Erreur lors de la génération du dossier DP. Réessayez.')
            console.error(e)
        } finally {
            setGeneratingDP(false)
        }
    }

    const getNatureLabel = () => {
        if (travaux.type === 'menuiseries') return '🪟 Changement de menuiseries'
        if (travaux.type === 'isolation') return '🏠 Isolation thermique extérieure'
        if (travaux.type === 'photovoltaique') return '☀️ Panneaux photovoltaïques'
        return 'Non défini'
    }

    const getTravDetail = () => {
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            const m = travaux.menuiseries
            return [
                { label: 'Type', value: m.type },
                { label: 'Matériau', value: m.materiau },
                { label: 'Couleur', value: m.couleur },
                { label: 'Nombre', value: m.nombre },
                { label: 'Dimensions', value: m.largeur && m.hauteur ? `${m.largeur}cm × ${m.hauteur}cm` : undefined },
                { label: 'Mode', value: m.remplacement ? 'Remplacement' : 'Création' },
            ]
        }
        if (travaux.type === 'isolation' && travaux.isolation) {
            const i = travaux.isolation
            return [
                { label: 'Finition', value: i.type_finition },
                { label: 'Couleur', value: i.couleur },
                { label: 'Isolant', value: i.materiau_isolant },
                { label: 'Épaisseur', value: i.epaisseur_isolant ? i.epaisseur_isolant + ' cm' : undefined },
                { label: 'Façades', value: i.facades_concernees?.join(', ') },
            ]
        }
        if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
            const p = travaux.photovoltaique
            return [
                { label: 'Nombre de panneaux', value: p.nombre_panneaux },
                { label: 'Surface totale', value: p.surface_totale ? p.surface_totale + ' m²' : undefined },
                { label: 'Puissance', value: p.puissance_kw ? p.puissance_kw + ' kWc' : undefined },
                { label: 'Orientation', value: p.orientation },
                { label: 'Inclinaison', value: p.inclinaison ? p.inclinaison + '°' : undefined },
                { label: 'Intégration', value: p.integration },
                { label: 'Marque', value: p.marque },
            ]
        }
        return []
    }

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Récapitulatif & Téléchargement</h2>
                    <p className="text-slate-500 mt-1">Vérifiez vos informations, puis téléchargez vos documents</p>
                </div>

                <div className="space-y-6">
                    {/* Résumé info */}
                    <RecapSection
                        title="Demandeur"
                        icon="👤"
                        items={[
                            { label: 'Civilité', value: demandeur.civilite },
                            { label: 'Nom complet', value: `${demandeur.nom} ${demandeur.prenom}` },
                            { label: 'Adresse', value: `${demandeur.adresse}, ${demandeur.code_postal} ${demandeur.commune}` },
                            { label: 'Téléphone', value: demandeur.telephone },
                            { label: 'Email', value: demandeur.email },
                            { label: 'Société', value: demandeur.est_societe ? demandeur.nom_societe : undefined },
                        ]}
                    />

                    <RecapSection
                        title="Terrain"
                        icon="📍"
                        items={[
                            { label: 'Adresse des travaux', value: terrain.meme_adresse ? `${demandeur.adresse}, ${demandeur.commune}` : `${terrain.adresse}, ${terrain.commune}` },
                            { label: 'Section cadastrale', value: terrain.section_cadastrale },
                            { label: 'Numéro de parcelle', value: terrain.numero_parcelle },
                            { label: 'Surface du terrain', value: terrain.surface_terrain ? terrain.surface_terrain + ' m²' : undefined },
                        ]}
                    />

                    <RecapSection
                        title="Travaux"
                        icon="🔨"
                        items={[
                            { label: 'Nature', value: getNatureLabel() },
                            ...getTravDetail(),
                        ]}
                    />

                    {/* Docs status */}
                    <div className="dp-card">
                        <h3 className="dp-section-title flex items-center gap-2">
                            <span>📄</span> Documents joints
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { key: 'dp1_carte_situation', label: 'DP1 Situation', type: 'plan' },
                                { key: 'dp2_plan_masse', label: 'DP2 Masse', type: 'plan' },
                                { key: 'dp3_coupe', label: 'DP3 Coupe', type: 'plan' },
                                { key: 'dp4_notice', label: 'DP4 Notice', type: 'plan' },
                                { key: 'facade_avant', label: 'DP5 Façades (Avant)', type: 'photo' },
                                { key: 'facade_apres_ai', label: 'DP5 Façades (Après)', type: 'photo' },
                                { key: 'dp7_vue_proche', label: 'DP7 Vue proche', type: 'photo' },
                                { key: 'dp8_vue_lointaine', label: 'DP8 Vue lointaine', type: 'photo' },
                            ].map(item => {
                                const has = item.type === 'plan'
                                    ? !!formData.plans[item.key as keyof typeof formData.plans]
                                    : !!formData.photos[item.key as keyof typeof formData.photos]
                                return (
                                    <div key={item.key} className="rounded-xl p-3 text-center text-sm font-semibold border-2"
                                        style={has
                                            ? { borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#86efac' }
                                            : { borderColor: 'rgba(148,163,184,0.15)', background: 'rgba(148,163,184,0.06)', color: '#64748b' }}>
                                        <div className="text-xl mb-1">{has ? '✅' : '⬜'}</div>
                                        {item.label}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Engagement / Signature */}
                    <div className="dp-card relative overflow-hidden" style={{ borderColor: 'rgba(236,72,153,0.3)', background: 'linear-gradient(180deg, rgba(236,72,153,0.05) 0%, transparent 100%)' }}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
                        <h3 className="font-bold text-white mb-5 text-lg">Engagement du Déclarant</h3>
                        <p className="text-sm text-slate-400 mb-5">J'atteste avoir pris connaissance des règles générales de construction et que les informations fournies sont exactes.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 p-5 bg-white/[0.03] border border-white/5 rounded-xl">
                            <div className="dp-form-group">
                                <label className="dp-label">Fait à (Lieu) *</label>
                                <input
                                    className="dp-input"
                                    placeholder="Ex: Paris"
                                    value={formData.engagement?.lieu || ''}
                                    onChange={e => updateField('engagement', { ...formData.engagement, lieu: e.target.value })}
                                />
                            </div>
                            <div className="dp-form-group">
                                <label className="dp-label">Le (Date) *</label>
                                <input
                                    type="date"
                                    className="dp-input"
                                    value={formData.engagement?.date || ''}
                                    onChange={e => updateField('engagement', { ...formData.engagement, date: e.target.value })}
                                />
                            </div>
                        </div>

                        <label className="flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer"
                            style={formData.engagement?.signature
                                ? { borderColor: '#ec4899', background: 'rgba(236,72,153,0.1)' }
                                : { borderColor: 'rgba(148,163,184,0.2)' }}>
                            <div className="pt-1">
                                <input
                                    type="checkbox"
                                    checked={formData.engagement?.signature || false}
                                    onChange={e => updateField('engagement', { ...formData.engagement, signature: e.target.value === 'on' ? true : e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 text-pink-500 focus:ring-0 focus:ring-offset-0 bg-slate-800"
                                />
                            </div>
                            <div>
                                <div className="text-white font-semibold">Je signe cette déclaration</div>
                                <p className="text-xs text-slate-400 mt-1">Cochez cette case pour attester de votre signature sur le formulaire CERFA officiel généré.</p>
                            </div>
                        </label>
                    </div>

                    {/* Download buttons */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">📥 Télécharger vos documents</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            Les documents sont générés directement dans votre navigateur. Aucune donnée n'est transmise à un serveur externe.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CERFA */}
                            <div className="rounded-2xl border p-5" style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>📋</div>
                                    <div>
                                        <div className="font-bold text-white">CERFA n°13703*</div>
                                        <div className="text-xs text-slate-400">Formulaire officiel rempli</div>
                                    </div>
                                    {cerfaDone && <span className="ml-auto text-green-400 text-xl">✅</span>}
                                </div>
                                <p className="text-xs text-slate-400 mb-4">
                                    Formulaire officiel de demande préalable, pré-rempli avec vos informations.
                                </p>
                                <button
                                    onClick={downloadCerfa}
                                    disabled={generatingCerfa}
                                    className="dp-btn-primary w-full justify-center"
                                >
                                    {generatingCerfa ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Génération en cours...
                                        </>
                                    ) : cerfaDone ? '📥 Re-télécharger le CERFA' : '📥 Télécharger le CERFA'}
                                </button>
                            </div>

                            {/* Dossier DP */}
                            <div className="rounded-2xl border p-5" style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.2)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(139,92,246,0.15)' }}>📁</div>
                                    <div>
                                        <div className="font-bold text-white">Dossier DP Complet</div>
                                        <div className="text-xs text-slate-400">DP1 à DP8 – Document technique</div>
                                    </div>
                                    {dpDone && <span className="ml-auto text-green-400 text-xl">✅</span>}
                                </div>
                                <p className="text-xs text-slate-400 mb-4">
                                    PDF complet avec plans de situation, notice descriptive, photos et simulation façades.
                                </p>
                                <button
                                    onClick={downloadDP}
                                    disabled={generatingDP}
                                    className="w-full justify-center inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
                                >
                                    {generatingDP ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Génération en cours...
                                        </>
                                    ) : dpDone ? '📁 Re-télécharger le dossier DP' : '📁 Télécharger le dossier DP'}
                                </button>
                            </div>
                        </div>

                        {(cerfaDone || dpDone) && (
                            <div className="mt-5 rounded-xl px-4 py-3 text-sm text-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}>
                                ✅ Documents générés ! Déposez-les en mairie avec votre dossier complet.
                            </div>
                        )}
                    </div>

                    {/* Instructions dépôt */}
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <h4 className="font-semibold mb-3" style={{ color: '#fcd34d' }}>📮 Dépôt en mairie</h4>
                        <ul className="space-y-2 text-sm" style={{ color: '#fde68a' }}>
                            <li className="flex items-start gap-2">
                                <span className="font-bold mt-0.5">1.</span>
                                <span>Imprimez les documents en <strong>2 exemplaires minimum</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold mt-0.5">2.</span>
                                <span>Signez le formulaire CERFA à la rubrique <em>Signature du demandeur</em></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold mt-0.5">3.</span>
                                <span>Complétez le plan de masse à la main si nécessaire (distances aux limites)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold mt-0.5">4.</span>
                                <span>Déposez le dossier complet en mairie ou envoyez-le par recommandé AR</span>
                            </li>
                        </ul>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push('/etape/5')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button
                            onClick={() => { if (confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ?')) { resetForm(); router.push('/') } }}
                            className="text-sm text-slate-400 hover:text-red-500 transition-colors"
                        >
                            🗑️ Nouveau dossier
                        </button>
                    </div>
                </div>
            </div>
        </StepLayout>
    )
}
