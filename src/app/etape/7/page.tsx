'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { validateDPForm, piecesChecklist, fatalIssues, warnIssues, ValidationIssue } from '@/lib/validation'

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
                        <dt className="dp-meta">{item.label}</dt>
                        <dd className="text-sm font-medium t-ink mt-1">{item.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

export default function Etape7() {
    const router = useRouter()
    const { formData, resetForm, updateField, isTestMode } = useDPContext()
    const { demandeur, terrain, travaux, photos } = formData

    const [generatingCerfa, setGeneratingCerfa] = useState(false)
    const [generatingDP, setGeneratingDP] = useState(false)
    const [cerfaDone, setCerfaDone] = useState(false)
    const [dpDone, setDpDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Completeness & validation gate ────────────────────────────────────
    const issues = validateDPForm(formData)
    const fatals = fatalIssues(issues)
    const warns = warnIssues(issues)
    const pieces = piecesChecklist(formData)
    const missingFatalPieces = pieces.filter(p => !p.present && p.severity === 'fatal')
    const blocked = isTestMode || fatals.length > 0 || missingFatalPieces.length > 0

    // Surface server-side validation failures (safety-net bypass) cleanly.
    const handleServerIssues = async (res: Response): Promise<boolean> => {
        if (res.status === 422) {
            const body = await res.json().catch(() => ({})) as { issues?: ValidationIssue[] }
            const list = (body.issues || []).map(i => `• ${i.message}`).join('\n')
            setError(`Dossier incomplet — corrigez les points suivants :\n${list}`)
            return true
        }
        return false
    }

    const downloadCerfa = async () => {
        if (blocked) return
        if (warns.length > 0 && !confirm(`${warns.length} avertissement(s) non bloquant(s) subsistent. Générer quand même le CERFA ?`)) return
        setGeneratingCerfa(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-cerfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })
            if (await handleServerIssues(res)) return
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
        if (blocked) return
        if (warns.length > 0 && !confirm(`${warns.length} avertissement(s) non bloquant(s) subsistent. Générer quand même le dossier DP ?`)) return
        setGeneratingDP(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-dp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })
            if (await handleServerIssues(res)) return
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
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Étape 07 / 07 · Génération</span>
                    <h2 className="dp-page-title">Récapitulatif & <span className="accent">téléchargement</span></h2>
                    <p className="dp-page-sub">Vérifiez vos informations, puis téléchargez vos documents.</p>
                    <div className="dp-rule" />
                </div>

                <div className="space-y-6">
                    {/* Completeness & conformity gate */}
                    <div className="dp-card" style={{
                        borderColor: blocked ? '#EBC3BB' : warns.length ? '#EBD9A8' : 'var(--acb)',
                        background: blocked ? '#FBEAE6' : warns.length ? '#FBF1DC' : 'var(--act)',
                    }}>
                        <h3 className="dp-section-title flex items-center gap-2">
                            <span>{blocked ? '⛔' : warns.length ? '⚠️' : '✅'}</span>
                            Contrôle de complétude du dossier
                        </h3>

                        {isTestMode && (
                            <div className="dp-alert is-warn mb-4 font-semibold">
                                Mode Test actif : la génération est désactivée tant que des données fictives sont chargées.
                            </div>
                        )}

                        {/* Required fields */}
                        {fatals.length > 0 ? (
                            <div className="mb-4">
                                <p className="dp-meta t-error mb-2">{fatals.length} information(s) obligatoire(s) manquante(s)</p>
                                <ul className="space-y-1.5">
                                    {fatals.map(i => (
                                        <li key={i.id} className="flex items-start gap-2 text-sm t-error">
                                            <span className="mt-0.5">✗</span>
                                            <span><span className="t-muted font-semibold">[{i.section}]</span> {i.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="mb-4 text-sm t-ok">✓ Toutes les informations obligatoires sont renseignées.</p>
                        )}

                        {/* Warnings */}
                        {warns.length > 0 && (
                            <div className="mb-4">
                                <p className="dp-meta t-warn mb-2">{warns.length} recommandation(s) — à vérifier par l’expert</p>
                                <ul className="space-y-1.5">
                                    {warns.map(i => (
                                        <li key={i.id} className="flex items-start gap-2 text-sm t-warn">
                                            <span className="mt-0.5">⚠️</span>
                                            <span><span className="t-muted font-semibold">[{i.section}]</span> {i.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Pieces checklist */}
                        <div className="pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
                            <p className="dp-meta mb-2">Pièces du dossier (DP1–DP8)</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {pieces.map(p => (
                                    <div key={p.code} className={`dp-chip ${p.present ? 'is-ok' : p.severity === 'fatal' ? 'is-missing' : ''}`}
                                        title={p.note || ''}>
                                        <span>{p.present ? '✅' : p.severity === 'fatal' ? '✗' : '⬜'}</span>
                                        <span className="code">{p.code}</span>
                                        <span className="truncate">{p.label}</span>
                                    </div>
                                ))}
                            </div>
                            {missingFatalPieces.length > 0 && (
                                <p className="mt-2 text-xs t-error">
                                    Pièce(s) obligatoire(s) manquante(s) : {missingFatalPieces.map(p => p.code).join(', ')} — générez-les aux étapes Photos / Plans.
                                </p>
                            )}
                        </div>
                    </div>

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
                                { key: 'dp4_notice', label: 'DP4 Notice', type: 'plan' },
                                { key: 'facade_croquis_ai', label: 'DP5 Croquis', type: 'photo' },
                                { key: 'facade_apres_ai', label: 'DP6 Simulation', type: 'photo' },
                                { key: 'dp7_vue_proche', label: 'DP7 Vue proche', type: 'photo' },
                                { key: 'dp8_vue_lointaine', label: 'DP8 Vue lointaine', type: 'photo' },
                            ].map(item => {
                                const has = item.type === 'plan'
                                    ? !!formData.plans[item.key as keyof typeof formData.plans]
                                    : !!formData.photos[item.key as keyof typeof formData.photos]
                                return (
                                    <div key={item.key} className="rounded-xl p-3 text-center text-sm font-semibold border"
                                        style={has
                                            ? { borderColor: 'var(--acb)', background: 'var(--act)', color: 'var(--acd)' }
                                            : { borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--muted)' }}>
                                        <div className="text-xl mb-1">{has ? '✅' : '⬜'}</div>
                                        {item.label}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="dp-alert is-error whitespace-pre-line">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Engagement / Signature */}
                    <div className="dp-card dp-spec relative overflow-hidden" style={{ borderColor: 'var(--acb)' }}>
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: 'var(--ac)' }}></div>
                        <h3 className="dp-section-title">Engagement du Déclarant</h3>
                        <p className="text-sm t-ink2 mb-5">J'atteste avoir pris connaissance des règles générales de construction et que les informations fournies sont exactes.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 p-5 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
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

                        <label className={`dp-check-card ${formData.engagement?.signature ? 'selected' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.engagement?.signature || false}
                                onChange={e => updateField('engagement', { ...formData.engagement, signature: e.target.value === 'on' ? true : e.target.checked })}
                            />
                            <div>
                                <div className="t-ink font-semibold">Je signe cette déclaration</div>
                                <p className="text-xs t-ink2 mt-1">Cochez cette case pour attester de votre signature sur le formulaire CERFA officiel généré.</p>
                            </div>
                        </label>
                    </div>

                    {/* Download buttons */}
                    <div className="dp-card">
                        <h3 className="dp-section-title">📥 Télécharger vos documents</h3>
                        <p className="text-sm t-ink2 mb-6">
                            Les documents sont générés directement dans votre navigateur. Aucune donnée n'est transmise à un serveur externe.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CERFA */}
                            <div className="rounded-2xl border p-5" style={{ background: 'var(--act)', borderColor: 'var(--acb)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--surface)', border: '1px solid var(--acb)' }}>📋</div>
                                    <div>
                                        <div className="font-bold t-ink">CERFA n°13703*</div>
                                        <div className="text-xs t-ink2">Formulaire officiel rempli</div>
                                    </div>
                                    {cerfaDone && <span className="ml-auto t-ok text-xl">✅</span>}
                                </div>
                                <p className="text-xs t-ink2 mb-4">
                                    Formulaire officiel de demande préalable, pré-rempli avec vos informations.
                                </p>
                                <button
                                    onClick={downloadCerfa}
                                    disabled={generatingCerfa || blocked}
                                    className="dp-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generatingCerfa ? (
                                        <>
                                            <div className="dp-spinner dp-spinner-sm on-accent" />
                                            Génération en cours...
                                        </>
                                    ) : cerfaDone ? '📥 Re-télécharger le CERFA' : '📥 Télécharger le CERFA'}
                                </button>
                            </div>

                            {/* Dossier DP */}
                            <div className="rounded-2xl border p-5" style={{ background: 'var(--act)', borderColor: 'var(--acb)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--surface)', border: '1px solid var(--acb)' }}>📁</div>
                                    <div>
                                        <div className="font-bold t-ink">Dossier DP Complet</div>
                                        <div className="text-xs t-ink2">DP1 à DP8 – Document technique</div>
                                    </div>
                                    {dpDone && <span className="ml-auto t-ok text-xl">✅</span>}
                                </div>
                                <p className="text-xs t-ink2 mb-4">
                                    PDF complet avec plans de situation, notice descriptive, photos et simulation façades.
                                </p>
                                <button
                                    onClick={downloadDP}
                                    disabled={generatingDP || blocked}
                                    className="dp-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generatingDP ? (
                                        <>
                                            <div className="dp-spinner dp-spinner-sm on-accent" />
                                            Génération en cours...
                                        </>
                                    ) : dpDone ? '📁 Re-télécharger le dossier DP' : '📁 Télécharger le dossier DP'}
                                </button>
                            </div>
                        </div>

                        {(cerfaDone || dpDone) && (
                            <div className="dp-alert is-ok mt-5 text-center">
                                ✅ Documents générés ! Déposez-les en mairie avec votre dossier complet.
                            </div>
                        )}
                    </div>

                    {/* Instructions dépôt */}
                    <div className="rounded-2xl p-5" style={{ background: '#FBF1DC', border: '1px solid #EBD9A8' }}>
                        <h4 className="font-semibold mb-3" style={{ color: '#8A6D1F' }}>📮 Dépôt en mairie</h4>
                        <ul className="space-y-2 text-sm" style={{ color: '#6B5512' }}>
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
                        <button onClick={() => router.push('/etape/6')} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button
                            onClick={() => { if (confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ?')) { resetForm(); router.push('/') } }}
                            className="text-sm t-ink2 hover:text-red-500 transition-colors"
                        >
                            🗑️ Nouveau dossier
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
