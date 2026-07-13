'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { validateDPForm, piecesChecklist, fatalIssues, forbiddenIssues, warnIssues, isProtectedSector, ValidationIssue } from '@/lib/validation'
import { getTravauxDef } from '@/lib/travauxRegistry'

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
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updateField, isTestMode } = useDPContext()
    const { demandeur, terrain, travaux, photos } = formData

    const [generatingCerfa, setGeneratingCerfa] = useState(false)
    const [generatingDP, setGeneratingDP] = useState(false)
    const [generatingNotice, setGeneratingNotice] = useState(false)
    const [cerfaDone, setCerfaDone] = useState(false)
    const [dpDone, setDpDone] = useState(false)
    const [noticeDone, setNoticeDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ── Completeness & validation gate ────────────────────────────────────
    const issues = validateDPForm(formData)
    const fatals = fatalIssues(issues)
    const forbiddens = forbiddenIssues(issues)   // aspect choices INTERDITS par le règlement (red, blocking)
    const warns = warnIssues(issues)
    const pieces = piecesChecklist(formData)
    const missingFatalPieces = pieces.filter(p => !p.present && p.severity === 'fatal')
    // Test mode no longer blocks generation — it lets you preview the real output with the fictional
    // sample data (the "données fictives" banner makes clear the dossier is not for real filing).
    const blocked = fatals.length > 0 || forbiddens.length > 0 || missingFatalPieces.length > 0

    // The engagement (lieu / date / signature) is an action the user performs ON THIS page, in its
    // own section — so we keep it OUT of the top completeness panel (which would otherwise flag
    // "signature manquante" before the user has even scrolled to the engagement box) and surface it
    // contextually at the engagement section and the download buttons instead.
    const engagementFatals = fatals.filter(i => i.section === 'Engagement')
    const dataFatals = fatals.filter(i => i.section !== 'Engagement')
    const dataReady = dataFatals.length === 0 && forbiddens.length === 0 && missingFatalPieces.length === 0
    const engagementComplete = engagementFatals.length === 0

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
            a.download = `CERFA_16702_${demandeur.nom}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
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
            const res = await fetch(`/api/generate-dp?ref=${encodeURIComponent(dossierId)}`, {
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
            // The full dossier has been generated: promote the project to "complet" so the
            // dashboard can start the suivi d'instruction (dépôt en mairie → décision).
            fetch(`/api/dossiers/${dossierId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'complete' }),
            }).catch(() => { /* non-blocking */ })
        } catch (e) {
            setError('Erreur lors de la génération du dossier DP. Réessayez.')
            console.error(e)
        } finally {
            setGeneratingDP(false)
        }
    }

    // Standalone notice (DP4). Not gated on the engagement signature (the notice is a descriptive
    // piece, not the signed CERFA) — only requires the notice to have been generated at étape Plans.
    const downloadNotice = async () => {
        if (blocked) return
        setGeneratingNotice(true)
        setError(null)
        try {
            const res = await fetch('/api/generate-notice', {
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
            a.download = `Notice_descriptive_DP4_${demandeur.nom}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf`
            a.click()
            URL.revokeObjectURL(url)
            setNoticeDone(true)
        } catch (e) {
            setError('Erreur lors de la génération de la notice. Réessayez.')
            console.error(e)
        } finally {
            setGeneratingNotice(false)
        }
    }

    // Nature of works from the travaux registry (single source of truth) — covers all work types,
    // so newer ones (clôture, ravalement, toiture, ouverture) no longer fall back to "Non défini".
    const getNatureLabel = () => {
        const def = getTravauxDef(travaux.type)
        return def ? `${def.icon} ${def.natureLabel}` : 'Non défini'
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
        if (travaux.type === 'cloture' && travaux.cloture) {
            const c = travaux.cloture
            return [
                { label: 'Type', value: c.type_cloture },
                { label: 'Matériau', value: c.materiau },
                { label: 'Couleur', value: c.couleur },
                { label: 'Hauteur', value: c.hauteur ? c.hauteur + ' m' : undefined },
            ]
        }
        if (travaux.type === 'ravalement' && travaux.ravalement) {
            const r = travaux.ravalement
            return [
                { label: 'Finition', value: r.finition },
                { label: 'Teinte / couleur', value: r.couleur },
                { label: 'Matériau', value: r.materiau },
                { label: 'Façades', value: r.facades_concernees?.join(', ') },
            ]
        }
        if (travaux.type === 'toiture' && travaux.toiture) {
            const t = travaux.toiture
            return [
                { label: 'Opération', value: t.operation },
                { label: 'Matériau de couverture', value: t.materiau_couverture },
                { label: 'Couleur', value: t.couleur },
            ]
        }
        if (travaux.type === 'ouverture' && travaux.ouverture) {
            const o = travaux.ouverture
            return [
                { label: 'Type', value: o.type_ouverture },
                { label: 'Opération', value: o.operation },
                { label: 'Façade concernée', value: o.facade },
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
                    {/* Readiness summary — DATA completeness only. The signature/date live in their own
                        "Engagement" section below, so they're intentionally not flagged up here. */}
                    <div className="dp-card" style={{
                        borderColor: dataReady ? 'var(--acb)' : '#EBC3BB',
                        background: dataReady ? 'var(--act)' : '#FBEAE6',
                    }}>
                        <h3 className="dp-section-title flex items-center gap-2">
                            <span>{dataReady ? '✅' : '⛔'}</span>
                            {dataReady ? 'Votre dossier est complet' : 'Informations à compléter'}
                        </h3>

                        {isTestMode && (
                            <div className="dp-alert is-warn mb-4 font-semibold">
                                Mode Test actif — données fictives. La génération est autorisée pour prévisualiser le résultat, mais ce dossier ne doit pas être déposé en mairie.
                            </div>
                        )}

                        {dataReady ? (
                            <p className="text-sm t-ok">
                                ✓ Toutes les informations obligatoires sont renseignées.{' '}
                                {engagementComplete ? 'Vous pouvez générer vos documents ci-dessous.' : 'Il ne reste plus qu’à signer l’engagement, plus bas.'}
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {dataFatals.map(i => (
                                    <li key={i.id} className="flex items-start gap-2 text-sm t-error">
                                        <span className="mt-0.5">✗</span>
                                        <span><span className="t-muted font-semibold">[{i.section}]</span> {i.message}</span>
                                    </li>
                                ))}
                                {missingFatalPieces.map(p => (
                                    <li key={p.code} className="flex items-start gap-2 text-sm t-error">
                                        <span className="mt-0.5">✗</span>
                                        <span><span className="t-muted font-semibold">[Pièce {p.code}]</span> {p.label} manquant — à générer aux étapes Photos / Plans.</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {forbiddens.length > 0 && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #EBC3BB' }}>
                                <p className="dp-meta t-error mb-2 font-bold">⛔ {forbiddens.length} choix interdit(s) par le règlement d’urbanisme — bloquant</p>
                                <ul className="space-y-1.5">
                                    {forbiddens.map(i => (
                                        <li key={i.id} className="flex items-start gap-2 text-sm t-error font-medium">
                                            <span className="mt-0.5">⛔</span>
                                            <span><span className="t-muted font-semibold">[{i.section}]</span> {i.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {warns.length > 0 && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--line-2)' }}>
                                <p className="dp-meta t-warn mb-2">{warns.length} recommandation(s) — à vérifier, non bloquant</p>
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

                    {/* Pièces du dossier (DP1–DP8) — single unified view (previously duplicated as a
                        chips list inside the status panel AND this grid). */}
                    <div className="dp-card">
                        <h3 className="dp-section-title flex items-center gap-2">
                            <span>📄</span> Pièces du dossier (DP1–DP8)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {pieces.map(pc => (
                                <div key={pc.code} className="rounded-xl p-3 text-center text-sm font-semibold border" title={pc.note || ''}
                                    style={pc.present
                                        ? { borderColor: 'var(--acb)', background: 'var(--act)', color: 'var(--acd)' }
                                        : pc.severity === 'fatal'
                                            ? { borderColor: '#EBC3BB', background: '#FBEAE6', color: '#B4453A' }
                                            : { borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--muted)' }}>
                                    <div className="text-xl mb-1">{pc.present ? '✅' : pc.severity === 'fatal' ? '✗' : '⬜'}</div>
                                    <div className="font-mono text-[11px] opacity-70">{pc.code}</div>
                                    {pc.label}
                                </div>
                            ))}
                        </div>
                        {missingFatalPieces.length > 0 && (
                            <p className="mt-3 text-xs t-error">
                                Pièce(s) obligatoire(s) manquante(s) : {missingFatalPieces.map(p => p.code).join(', ')} — générez-les aux étapes Photos / Plans.
                            </p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="dp-alert is-error whitespace-pre-line">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Engagement / Signature — the final action, with its own completion state */}
                    <div className="dp-card dp-spec relative overflow-hidden" style={{ borderColor: engagementComplete ? 'var(--acb)' : '#EBD9A8' }}>
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: engagementComplete ? 'var(--ac)' : '#D9B44A' }}></div>
                        <h3 className="dp-section-title flex items-center gap-2">
                            <span>{engagementComplete ? '✅' : '✍️'}</span> Engagement du déclarant
                        </h3>
                        <p className="text-sm t-ink2 mb-5">
                            {engagementComplete
                                ? 'Engagement complété. '
                                : 'Dernière étape avant de générer : indiquez le lieu et la date, puis signez. '}
                            J'atteste avoir pris connaissance des règles générales de construction et que les informations fournies sont exactes.
                        </p>

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
                                onChange={e => updateField('engagement', { ...formData.engagement, signature: e.target.checked })}
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
                                        <div className="font-bold t-ink">CERFA n°16702*03</div>
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

                            {/* Notice descriptive (DP4) — standalone */}
                            <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>📝</div>
                                    <div>
                                        <div className="font-bold t-ink">Notice descriptive (DP4)</div>
                                        <div className="text-xs t-ink2">La pièce DP4, en document séparé</div>
                                    </div>
                                    {noticeDone && <span className="ml-auto t-ok text-xl">✅</span>}
                                </div>
                                <p className="text-xs t-ink2 mb-4">
                                    Déjà incluse dans le dossier complet — mais chaque pièce se dépose <strong className="t-ink2">séparément</strong> sur le guichet en ligne (GNAU / AD’AU). Téléchargez-la à part pour la joindre comme fichier DP4 (ou la relire/imprimer seule).
                                </p>
                                <button
                                    onClick={downloadNotice}
                                    disabled={generatingNotice || blocked}
                                    className="dp-btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generatingNotice ? (
                                        <>
                                            <div className="dp-spinner dp-spinner-sm" />
                                            Génération en cours...
                                        </>
                                    ) : noticeDone ? '📝 Re-télécharger la notice' : '📝 Télécharger la notice (DP4)'}
                                </button>
                            </div>
                        </div>

                        {blocked && (
                            <div className="dp-alert is-warn mt-5">
                                {!dataReady
                                    ? 'Complétez les informations manquantes signalées en haut de page pour débloquer la génération.'
                                    : '✍️ Complétez l’engagement ci-dessus (lieu, date et signature) pour débloquer la génération.'}
                            </div>
                        )}
                        {(cerfaDone || dpDone) && (
                            <div className="dp-alert is-ok mt-5 text-center">
                                ✅ Documents générés ! Déposez-les en mairie avec votre dossier complet.
                            </div>
                        )}
                    </div>

                    {/* Guide de dépôt en mairie */}
                    <div className="dp-card dp-spec">
                        <h3 className="dp-section-title">📮 Comment déposer votre dossier en mairie</h3>

                        {isProtectedSector(formData) && (
                            <div className="dp-alert is-warn mb-4">
                                <span className="dp-alert-title">Secteur protégé — avis ABF contraignant</span>
                                Avant de déposer : <strong>pré-consultez l'UDAP</strong> (service de l'ABF), assurez-vous que le CERFA déclare <strong>tous</strong> les travaux et joignez une <strong>notice de matériaux détaillée</strong> (teintes/RAL). Délai d'instruction : <strong>2 mois</strong>.
                            </div>
                        )}

                        {/* Numbered steps — tight, consistent rhythm */}
                        <ol className="space-y-4">
                            {[
                                { t: 'Préparer', c: <>Signez le CERFA (rubrique <em>« Engagement du déclarant »</em>), vérifiez que les pièces DP1–DP8 ci-dessus sont présentes, et complétez à la main les cotes du plan de masse si besoin.</> },
                                { t: 'Déposer — au choix', c: <>
                                    <span className="block"><strong>🖥️ En ligne (recommandé)</strong> — sur le <strong>Guichet Numérique des Autorisations d'Urbanisme (GNAU)</strong> de votre commune, ou via l'assistant officiel <strong>AD'AU</strong>. Accusé de réception électronique immédiat.</span>
                                    <span className="block mt-1"><strong>🏛️ En mairie / courrier</strong> — imprimez le dossier en <strong>2 exemplaires</strong> (plus en secteur ABF), dépôt contre récépissé ou <strong>lettre recommandée avec AR</strong>.</span>
                                </> },
                                { t: 'Délais d\'instruction', c: <><strong>1 mois</strong> en général, <strong>2 mois</strong> en périmètre Monument Historique / Site Patrimonial (avis ABF). La mairie a 1 mois pour réclamer des pièces ; sans réponse, vous obtenez une <strong>décision tacite</strong> (demandez-en le certificat).</> },
                                { t: 'Après acceptation', c: <><strong>Affichez l'autorisation</strong> sur le terrain (panneau visible de la rue) pendant tout le chantier et au moins 2 mois, puis envoyez la <strong>déclaration d'achèvement (DAACT)</strong> en fin de travaux.</> },
                            ].map((s, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="shrink-0 flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--act)', border: '1px solid var(--acb)', color: 'var(--acd)', fontFamily: 'var(--mf)', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                                    <div className="flex-1">
                                        <div className="font-semibold t-ink text-sm leading-6">{s.t}</div>
                                        <p className="text-sm t-ink2 leading-relaxed mt-0.5">{s.c}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>

                        {/* Liens officiels */}
                        <div className="dp-alert is-info mt-5">
                            <span className="dp-alert-title">Liens officiels</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <a href="https://www.service-public.fr/particuliers/vosdroits/F17578" target="_blank" rel="noopener noreferrer" className="t-accent hover:underline font-medium">Déclaration préalable (DP)</a>
                                <a href="https://www.service-public.fr/particuliers/vosdroits/F1992" target="_blank" rel="noopener noreferrer" className="t-accent hover:underline font-medium">Ouverture de chantier (DOC)</a>
                                <a href="https://www.service-public.fr/particuliers/vosdroits/F1997" target="_blank" rel="noopener noreferrer" className="t-accent hover:underline font-medium">Achèvement (DAACT)</a>
                            </div>
                            <p className="mt-2 text-xs">Astuce : cherchez « guichet numérique urbanisme + <em>votre commune</em> » pour le portail de dépôt en ligne local.</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => router.push(`/etape/${dossierId}/6`)} className="dp-btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                        </button>
                        <button
                            onClick={() => router.push('/profil')}
                            className="text-sm t-ink2 hover:t-accent transition-colors"
                        >
                            📁 Mes projets
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
