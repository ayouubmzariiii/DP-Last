'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useDPContext } from '@/lib/context'
import { isProtectedSector, pluAspectConflicts, pluAspectAlternatives } from '@/lib/validation'
import { travauxAspect } from '@/lib/travauxRegistry'
import { RalHint, RalInline } from '@/components/RalPicker'

export default function Etape4() {
    const router = useRouter()
    const dossierId = useParams<{ dossierId: string }>().dossierId as string
    const { formData, updateTerrain, updateTravaux } = useDPContext()
    const terrain = formData.terrain
    const travaux = formData.travaux

    const [analyzing, setAnalyzing] = useState(false)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showExtractedText, setShowExtractedText] = useState(false)
    const [showPdf, setShowPdf] = useState(false)
    const [ack, setAck] = useState(false)
    const [edits, setEdits] = useState<Record<string, string>>({})
    const [showDetails, setShowDetails] = useState(false)   // technical detail is collapsed by default

    const plu = terrain.plu
    const hasReport = !!plu?.analysisReport

    const runAnalysis = async (travauxArg: typeof travaux = travaux) => {
        if (!travauxArg.type) {
            setError("Veuillez renseigner le type de travaux à l'étape précédente.")
            return
        }
        setAnalyzing(true)
        setError(null)
        try {
            // Extract the règlement in the BROWSER (reliable — same fetch that powers the viewer):
            // clean text for text PDFs, or rendered page images for scanned/image règlements (OCR).
            let reglementText: string | undefined
            let reglementImages: string[] | undefined
            const docUrl = terrain.plu?.zone?.url_doc
            if (docUrl && !terrain.plu?.isRnu) {
                try {
                    const { extractReglementClient } = await import('@/lib/pluClientExtract')
                    const ex = await extractReglementClient(docUrl)
                    reglementText = ex.text
                    reglementImages = ex.images
                } catch { /* server will fall back to its own retrieval */ }
            }

            const res = await fetch('/api/analyze-plu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plu: terrain.plu,
                    travaux: travauxArg,
                    description_projet: travauxArg.description_projet || terrain.description_projet,
                    // Lets the API recover the règlement URL if it wasn't resolved during fetch-plu.
                    coords: terrain.meme_adresse ? formData.demandeur.coords : terrain.coords,
                    reglementText,
                    reglementImages,
                })
            })
            if (!res.ok) throw new Error("Erreur lors de la communication avec l'assistant PLU.")
            const data = await res.json()
            if (data.error) throw new Error(data.error)

            updateTerrain({
                plu: {
                    ...terrain.plu,
                    // Persist the (possibly recovered) règlement URL so the PDF viewer can show it.
                    zone: { ...(terrain.plu?.zone || {}), url_doc: data.docUrl || terrain.plu?.zone?.url_doc },
                    analysisReport: data.report,
                    extractedRules: data.extractedRules,
                    evaluationResult: data.evaluationResult,
                    pdfType: data.pdfType,
                    verified: data.verified,
                    source: data.source,
                    textLength: data.textLength,
                    extractedText: data.extractedText
                }
            })
        } catch (err: any) {
            console.error(err)
            setError(err.message || "Une erreur est survenue lors de l'analyse PLU.")
        } finally {
            setAnalyzing(false)
        }
    }

    // Re-seed the editable proposal inputs whenever a fresh proposal arrives.
    useEffect(() => {
        const ef = (plu?.evaluationResult?.proposal?.editableFields) as { key: string; value: string }[] | undefined
        setEdits(ef ? Object.fromEntries(ef.map(f => [f.key, f.value || ''])) : {})
    }, [plu?.evaluationResult?.proposal])

    // Apply the counter-proposal: take the (possibly edited) suggested values for the offending
    // fields + the new description, patch the work-type details, then re-run the analysis in place.
    const applyProposal = async () => {
        const p: any = plu?.evaluationResult?.proposal
        if (!p?.target) return
        setApplying(true)
        const patch: Record<string, any> = {}
        for (const f of (p.editableFields || [])) {
            const v = (edits[f.key] ?? f.value ?? '').toString().trim()
            if (v) patch[f.key] = v
        }
        if (p.description) patch.description = p.description
        const nextSub = { ...((travaux as Record<string, any>)[p.target] || {}), ...patch }
        const nextDesc = p.description || travaux.description_projet
        const nextTravaux = { ...travaux, [p.target]: nextSub, description_projet: nextDesc } as typeof travaux
        updateTravaux({ [p.target]: nextSub, description_projet: nextDesc } as any)
        try { await runAnalysis(nextTravaux) } finally { setApplying(false) }
    }

    // Analysis is started on demand via the "Analyser avec l'IA" button (below), not automatically —
    // reading the règlement + querying the model is a heavy step the user chooses to run.

    const getParsedSections = () => {
        if (!plu?.analysisReport) return {}
        const sections = plu.analysisReport.split('### ').filter(Boolean)
        const parsed: Record<string, string> = {}
        sections.forEach(sec => {
            const firstLineEnd = sec.indexOf('\n')
            if (firstLineEnd === -1) return
            const title = sec.substring(0, firstLineEnd).trim().toUpperCase()
            const content = sec.substring(firstLineEnd).trim()
            parsed[title] = content
        })
        return parsed
    }

    const parsed = getParsedSections()

    // Returns a warm semantic tone ('error' | 'warn' | 'ok') consumed by the .dp-alert variants.
    const getVerdictDetails = (): { tone: 'error' | 'warn' | 'ok'; badge: string; sub: string; icon: string } => {
        const result = plu?.evaluationResult
        if (!result) {
            // Fallback to old parsing logic if evaluationResult doesn't exist
            const txt = (parsed['STATUT DE CONFORMITÉ'] || '').toUpperCase()
            if (txt.includes('NON-CONFORME')) {
                return { tone: 'error', badge: '❌ PROBABLEMENT NON-CONFORME', sub: 'Le projet semble en infraction avec certaines règles locales.', icon: '🔴' }
            }
            if (txt.includes('INCERTAIN')) {
                return { tone: 'warn', badge: '⚠️ CONFORMITÉ INCERTAINE', sub: 'Des doutes subsistent quant à la conformité réglementaire.', icon: '🟡' }
            }
            return { tone: 'ok', badge: '✅ PROBABLEMENT CONFORME', sub: 'Le projet respecte les prescriptions générales identifiées.', icon: '🟢' }
        }

        const { decision, status } = result

        if (decision === 'PERMIS_CONSTRUIRE') {
            return { tone: 'error', badge: '❌ Permis de Construire Requis', sub: 'Le projet dépasse les limites réglementaires de la Déclaration Préalable.', icon: '🔴' }
        }
        if (decision === 'DECLARATION_PREALABLE_ABF') {
            return { tone: 'warn', badge: '🏛️ Déclaration Préalable avec Avis ABF requis', sub: 'Le terrain se situe en périmètre patrimonial (SPR ou abords MH). Instruction rallongée à 2 mois.', icon: '🟡' }
        }
        if (decision === 'DECLARATION_PREALABLE_RISQUES') {
            return { tone: 'warn', badge: '⚠️ Déclaration Préalable (Zone Inondable)', sub: 'Le projet est situé en zone de prévention des risques (PPRN). Respect des prescriptions requis.', icon: '🟡' }
        }
        if (status === 'PROBABLEMENT NON-CONFORME') {
            return { tone: 'error', badge: '❌ Probablement Non-Conforme', sub: 'Le projet ne respecte pas certaines exigences réglementaires.', icon: '🔴' }
        }
        if (status === 'CONFORMITÉ INCERTAINE') {
            return { tone: 'warn', badge: '⚠️ Conformité Incertaine', sub: 'Des pièces ou justifications supplémentaires peuvent être demandées.', icon: '🟡' }
        }
        return { tone: 'ok', badge: '✅ Probablement Conforme (DP Simple)', sub: 'Le projet respecte les prescriptions d\'aspect et d\'implantation.', icon: '🟢' }
    }

    const verdict = getVerdictDetails()

    // Deterministic aspect conflict — the chosen material/teinte is on the règlement's forbidden
    // list. Flagged inline below AND folded into the acknowledgement gate (near-certain refusal).
    const aspectConflict = pluAspectConflicts(formData)
    const aspectAlt = pluAspectAlternatives(formData)
    const aspect = travauxAspect(formData)

    // A plain-language "are my works allowed here?" answer for the top card — clients who want the
    // technical breakdown open the "détails techniques" toggle underneath.
    const evViolations: string[] = plu?.evaluationResult?.violations || []
    const evWarnings: string[] = plu?.evaluationResult?.warnings || []
    const evProposal: any = plu?.evaluationResult?.proposal
    const reliable = !!plu && plu.source !== 'estimation' && plu.verified !== false && !plu.isRnu
    const plainAnswer: { head: string; sub: string } = (() => {
        if (evViolations.length > 0)
            return { head: 'En l’état, vos travaux ne sont pas conformes', sub: 'Le règlement d’urbanisme de votre zone s’oppose à certains de vos choix. Une solution pour rendre le projet conforme vous est proposée ci-dessous.' }
        if (plu?.evaluationResult?.decision === 'PERMIS_CONSTRUIRE')
            return { head: 'Un permis de construire est nécessaire', sub: 'Votre projet dépasse le cadre d’une simple déclaration préalable.' }
        if (verdict.tone === 'warn')
            return { head: 'Vos travaux sont autorisés, sous conditions', sub: verdict.sub }
        if (verdict.tone === 'error')
            return { head: 'Vos travaux ne sont pas autorisés en l’état', sub: verdict.sub }
        return { head: 'Vos travaux sont autorisés', sub: verdict.sub }
    })()
    const answerColor = verdict.tone === 'ok'
        ? { border: 'var(--acb)', bg: 'var(--act)' }
        : verdict.tone === 'warn'
            ? { border: '#EBD9A8', bg: '#FBF1DC' }
            : { border: '#EBC3BB', bg: '#FBEAE6' }

    return (
        <>
            <div className="animate-fadeIn">
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Étape 04 / 07 · Analyse PLU</span>
                    <h2 className="dp-page-title">Analyse du <span className="accent">règlement d'urbanisme</span></h2>
                    <p className="dp-page-sub">Analyse automatique du règlement d'urbanisme de votre zone.</p>
                    <div className="dp-rule" />
                </div>

                {!plu ? (
                    <div className="dp-card text-center py-8">
                        <span className="text-4xl">📍</span>
                        <h3 className="font-bold t-ink mt-4">Aucune coordonnée PLU</h3>
                        <p className="text-xs t-ink2 mt-2 max-w-sm mx-auto">
                            Veuillez renseigner une adresse valide et récupérer les données cadastrales à l'étape 2 (Terrain).
                        </p>
                        <button onClick={() => router.push(`/etape/${dossierId}/2`)} className="dp-btn-primary mt-6 mx-auto">
                            Retour à l'étape 2
                        </button>
                    </div>
                ) : analyzing ? (
                    <div className="dp-card py-16 flex flex-col items-center justify-center text-center">
                        <div className="relative mb-6 flex items-center justify-center">
                            <div className="dp-spinner dp-spinner-lg" style={{ width: 64, height: 64, borderWidth: 4 }} />
                            <div className="absolute inset-0 flex items-center justify-center font-bold t-accent" style={{ fontFamily: 'var(--mf)', fontSize: 13 }}>PLU</div>
                        </div>
                        <h3 className="font-bold t-ink text-lg animate-pulse">Extraction et analyse du règlement en cours...</h3>
                        <p className="text-xs t-ink2 mt-2 max-w-sm leading-relaxed">
                            Nous téléchargeons le règlement PDF officiel du Géoportail, convertissons son contenu en texte et interrogeons l'intelligence artificielle pour identifier les contraintes réglementaires.
                        </p>
                    </div>
                ) : error ? (
                    <div className="dp-card dp-spec" style={{ borderColor: '#EBC3BB', background: '#FBEAE6' }}>
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">⚠️</span>
                            <div className="flex-1">
                                <h3 className="font-bold t-ink">Échec de l'analyse PLU</h3>
                                <p className="text-sm t-error mt-1">{error}</p>
                                <div className="mt-4 flex gap-3">
                                    <button onClick={() => runAnalysis()} className="dp-btn-primary text-xs !px-4 !py-2">
                                        Réessayer l'analyse
                                    </button>
                                    <button onClick={() => router.push(`/etape/${dossierId}/3`)} className="dp-btn-secondary text-xs !px-4 !py-2">
                                        Retour aux travaux
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !hasReport ? (
                    <div className="dp-card text-center py-12">
                        <span className="text-4xl">🏛️</span>
                        <h3 className="font-bold t-ink mt-4 text-lg">Analyse du règlement d'urbanisme</h3>
                        <p className="text-xs t-ink2 mt-2 max-w-md mx-auto leading-relaxed">
                            Lancez l'analyse : nous lisons le règlement PLU de votre zone, le confrontons à votre projet et détectons les éventuelles non-conformités (avis ABF, matériaux, teintes, toiture…).
                        </p>
                        <button onClick={() => runAnalysis()} className="dp-btn-primary mt-6 mx-auto inline-flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Analyser avec l'IA
                        </button>
                        {plu?.zone?.url_doc && (
                            <a href={plu.zone.url_doc} target="_blank" rel="noopener noreferrer" className="block mt-3 text-[11px] t-ink2 hover:t-accent underline">
                                Consulter le règlement officiel (PDF) ↗
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── CLEAR ANSWER — plain verdict + the suggestion. Technical detail is behind
                            the "détails techniques" toggle further down. ────────────────────────── */}
                        <div className="dp-card" style={{ borderColor: answerColor.border, background: answerColor.bg }}>
                            <div className="flex items-start gap-4">
                                <div className="text-4xl leading-none">{verdict.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="dp-meta" style={{ opacity: .7 }}>Vos travaux à cette adresse</div>
                                    <h3 className="text-lg font-bold t-ink mt-0.5 leading-snug">{plainAnswer.head}</h3>
                                    <p className="text-sm t-ink2 mt-1 leading-relaxed">{plainAnswer.sub}</p>
                                    <p className="text-[11px] mt-2 leading-relaxed" style={{ opacity: .8 }}>
                                        {reliable
                                            ? '✓ Analyse fondée sur le règlement d’urbanisme officiel de votre zone.'
                                            : '⚠️ Analyse estimative : le règlement n’a pas pu être lu automatiquement — à confirmer avec le document officiel (voir les détails techniques).'}
                                    </p>

                                    {/* What blocks the project */}
                                    {evViolations.length > 0 && (
                                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,.6)', border: '1px solid #EBC3BB' }}>
                                            <div className="dp-meta t-error mb-1">Ce qui pose problème</div>
                                            <ul className="list-disc list-inside text-xs t-error space-y-1 pl-1">
                                                {evViolations.map((v: string, i: number) => <li key={i} className="leading-relaxed">{v}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {/* The suggestion — editable, one field per offending choice */}
                                    {evProposal?.editableFields?.length > 0 && (
                                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--acb)' }}>
                                            <div className="dp-meta t-accent flex items-center gap-1 mb-2">💡 Solution proposée</div>
                                            {(evProposal.why || []).length > 0 && (
                                                <ul className="text-[11px] t-ink2 space-y-0.5 mb-2.5 pl-1">
                                                    {evProposal.why.map((w: string, i: number) => (
                                                        <li key={i} className="leading-relaxed flex gap-1.5"><span className="t-accent">✓</span><span>{w}</span></li>
                                                    ))}
                                                </ul>
                                            )}
                                            <div className="space-y-2.5">
                                                {evProposal.editableFields.map((f: any) => (
                                                    <div key={f.key} className="flex flex-col gap-1">
                                                        <label className="text-[11px] font-semibold t-ink2">{f.label}</label>
                                                        {f.options ? (
                                                            <select className="dp-select text-sm" value={edits[f.key] ?? f.value} onChange={e => setEdits(s => ({ ...s, [f.key]: e.target.value }))}>
                                                                <option value="">— choisir —</option>
                                                                {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                                                            </select>
                                                        ) : (
                                                            <input className="dp-input text-sm" placeholder={f.hint || 'Valeur conforme'} value={edits[f.key] ?? f.value} onChange={e => setEdits(s => ({ ...s, [f.key]: e.target.value }))} />
                                                        )}
                                                        <RalHint text={edits[f.key] ?? f.value} />
                                                        {f.hint && !f.options && <span className="text-[10px] t-ink2" style={{ opacity: .7 }}>Suggestion : <RalInline text={f.hint} /></span>}
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={applyProposal} disabled={analyzing || applying} className="dp-btn-primary disabled:opacity-50 mt-3" style={{ padding: '8px 16px', fontSize: 13 }}>
                                                {applying ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Application…</> : 'Appliquer et relancer l\'analyse'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Key conditions (short) */}
                                    {evWarnings.length > 0 && (
                                        <ul className="mt-3 text-xs t-warn space-y-1 pl-1">
                                            {evWarnings.map((w: string, i: number) => (
                                                <li key={i} className="leading-relaxed flex gap-1.5"><span>⚠️</span><span>{w}</span></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── INTERDIT — deterministic aspect conflict (material/teinte on the
                            règlement's forbidden list). Red, explicit, with a compliant alternative. */}
                        {(aspectConflict.material || aspectConflict.color) && (
                            <div className="dp-card" style={{ borderColor: '#E0A4A4', background: '#FBEAE6' }}>
                                <div className="flex items-start gap-3">
                                    <div className="text-3xl leading-none">⛔</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="dp-meta t-error font-bold" style={{ letterSpacing: '.04em' }}>Interdit par le règlement d’urbanisme</div>
                                        <p className="text-sm t-ink2 mt-1">Un ou plusieurs de vos choix figurent explicitement parmi les <strong className="t-error">éléments proscrits</strong> du règlement de votre zone. En l’état, le dépôt serait très probablement refusé.</p>
                                        <ul className="mt-3 space-y-2.5">
                                            {aspectConflict.material && (
                                                <li className="text-sm">
                                                    <div className="t-error font-semibold">✗ Matériau « {aspectConflict.material.chosen} » — interdit (proscrit : « {aspectConflict.material.rule} »)</div>
                                                    <div className="text-[12px] t-accent mt-0.5">→ Alternative conforme : <RalInline text={aspectAlt.material || 'choisissez un matériau de la palette autorisée par le règlement.'} /></div>
                                                </li>
                                            )}
                                            {aspectConflict.color && (
                                                <li className="text-sm">
                                                    <div className="t-error font-semibold">✗ Teinte « <RalInline text={aspectConflict.color.chosen} /> » — interdite (proscrite : « {aspectConflict.color.rule} »)</div>
                                                    <div className="text-[12px] t-accent mt-0.5">→ Alternative conforme : <RalInline text={aspectAlt.color || 'choisissez une teinte sobre de la palette autorisée.'} /></div>
                                                </li>
                                            )}
                                        </ul>
                                        <button onClick={() => router.push(`/etape/${dossierId}/3`)} className="dp-btn-primary mt-4" style={{ padding: '8px 16px', fontSize: 13 }}>
                                            Corriger mes choix (étape Travaux)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Details toggle */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider t-ink2 hover:t-accent transition-all"
                            style={{ border: '1px dashed var(--line-3)', background: 'var(--surface-2)' }}
                        >
                            {showDetails ? 'Masquer les détails techniques' : 'Voir les détails techniques'}
                            <svg className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showDetails && (<div className="space-y-6">
                        {/* 1. PDF Extractor & Scanner Disclaimer Box */}
                        <div className="dp-card relative overflow-hidden" style={{ borderColor: 'var(--acb)', background: 'var(--act)' }}>
                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: 'var(--ac)' }}></div>

                            <div className="flex items-start gap-4">
                                <div className="text-3xl">
                                    {plu.isRnu ? '🏛️' : plu.pdfType === 'text' ? '📄' : '⚠️'}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold t-ink text-base flex items-center gap-2">
                                        {plu.isRnu ? 'Commune régie par le Règlement National d\'Urbanisme (RNU)' :
                                         plu.pdfType === 'text' ? 'Règlement PDF converti en texte' :
                                         plu.pdfType === 'scanned' ? 'Règlement scanné — lecture par vision IA (OCR)' :
                                         (plu.zone?.url_doc ? 'Analyse estimative — règlement non lu automatiquement' : 'Analyse estimative (règlement communal non récupéré)')}
                                        {plu.source === 'estimation' && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FBF1DC', color: '#8A6D1F', border: '1px solid #EBD9A8' }}>ESTIMATION</span>
                                        )}
                                    </h3>
                                    <p className="text-xs t-ink2 mt-1 leading-relaxed">
                                        {plu.isRnu ? (
                                            `Le Géoportail de l'Urbanisme indique que cette commune n'a pas de document local d'urbanisme (PLU/POS/CC). Par conséquent, ce sont les règles nationales du Code de l'Urbanisme (RNU) qui s'appliquent directement à votre projet (constructibilité limitée, aspect extérieur, insertion paysagère).`
                                        ) : plu.pdfType === 'text' ? (
                                            `Le règlement de la zone d'urbanisme (${plu.zone?.libelle || 'inconnue'}) a été téléchargé avec succès. Notre système a extrait ${plu.textLength || 0} caractères de texte brut pour l'analyse IA.`
                                        ) : plu.pdfType === 'scanned' ? (
                                            `Le règlement fourni par la commune est un document scanné (images). Ses pages ont été rasterisées et lues par un modèle de vision (OCR) afin d'en extraire les règles réelles de la zone ${plu.zone?.libelle || ''}.`
                                        ) : plu.zone?.url_doc ? (
                                            `Le règlement de la zone (${plu.zone?.libelle || 'inconnue'}) a bien été trouvé (consultable ci-dessous) mais n'a pas pu être lu automatiquement cette fois. L'analyse s'appuie donc sur le type de zone, les règles nationales (art. R.111-27) et les contraintes patrimoniales/risques détectées (fiables). Relancez l'analyse ou vérifiez directement le PDF ci-dessous.`
                                        ) : (
                                            `Le règlement écrit de la commune n'a pas pu être récupéré. Cette analyse est une estimation fondée sur le type de zone détecté (${plu.zone?.libelle || 'zone urbaine'}), les règles nationales d'urbanisme (art. R.111-27) et les contraintes réellement détectées ci-dessous (sismicité, inondation, SPR, Monuments Historiques — fiables). À confirmer avec le règlement officiel de la commune.`
                                        )}
                                    </p>

                                    {plu.pdfType === 'text' && plu.extractedText && (
                                        <div className="mt-3">
                                            <button
                                                onClick={() => setShowExtractedText(!showExtractedText)}
                                                className="text-[11px] font-bold t-accent hover:underline transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                            >
                                                {showExtractedText ? 'Masquer le texte extrait' : 'Voir un extrait du règlement d\'urbanisme'}
                                                <svg className={`w-3 h-3 transition-transform ${showExtractedText ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showExtractedText && (
                                                <div className="mt-2.5 p-3 rounded-lg text-[11px] t-ink2 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap leading-normal scrollbar-thin" style={{ background: 'var(--field-ro)', border: '1px solid var(--line)' }}>
                                                    {plu.extractedText.slice(0, 8000)}
                                                    {plu.extractedText.length > 8000 && '\n\n[... LE TEXTE DU DOCUMENT EST TRONQUÉ POUR LE PRÉVIEW ...]'}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {plu.zone?.url_doc && !plu.isRnu && (
                                        <div className="mt-3">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <button
                                                    onClick={() => setShowPdf(!showPdf)}
                                                    className="text-[11px] font-bold t-accent hover:underline transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                                >
                                                    {showPdf ? 'Masquer le règlement (PDF)' : 'Afficher le règlement officiel (PDF)'}
                                                    <svg className={`w-3 h-3 transition-transform ${showPdf ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                <a
                                                    href={plu.zone.url_doc}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] font-bold t-ink2 hover:t-accent hover:underline transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                                >
                                                    Ouvrir dans un nouvel onglet
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            </div>
                                            {showPdf && (
                                                <object data={plu.zone.url_doc} type="application/pdf" className="mt-2.5 w-full rounded-lg" style={{ height: 480, border: '1px solid var(--line)' }}>
                                                    <iframe src={plu.zone.url_doc} title="Règlement PLU" className="w-full rounded-lg" style={{ height: 480, border: '1px solid var(--line)' }} />
                                                    <p className="p-3 text-xs t-ink2">Aperçu indisponible — <a href={plu.zone.url_doc} target="_blank" rel="noopener noreferrer" className="t-accent underline">ouvrir le PDF</a>.</p>
                                                </object>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* (The verdict, non-conformités, proposal and warnings now live in the CLEAR
                            ANSWER card at the top — this technical section keeps the supporting detail.) */}

                        {/* 2.4. Protected-sector requirements — deterministic checklist shown whenever the
                            parcel is in an SPR / abords MH (binding ABF avis). Encodes the recevabilité
                            essentials so the dossier is coherent and survives ABF scrutiny. */}
                        {isProtectedSector(formData) && (
                            <div className="dp-card dp-spec" style={{ borderColor: '#EBD9A8', background: '#FBF1DC' }}>
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>🏛️</span> Secteur protégé — à faire avant le dépôt
                                </h3>
                                <p className="text-sm t-warn mb-3">
                                    L'avis de l'Architecte des Bâtiments de France est <strong>conforme (contraignant)</strong> : un avis défavorable bloque l'autorisation. Pour que le dossier soit recevable :
                                </p>
                                <ul className="space-y-2 text-sm" style={{ color: '#6B5512' }}>
                                    <li className="flex items-start gap-2"><span className="mt-0.5">1.</span> <span><strong>Déclarez TOUS les travaux</strong> sur le CERFA (nature du projet) — ils doivent correspondre exactement à la notice et aux plans. Une omission (ITE, toiture, photovoltaïque…) entraîne une demande de pièces complémentaires, voire un refus.</span></li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5">2.</span> <span><strong>Notice de matériaux détaillée</strong> : teintes (références RAL), matériaux, profils et mise en œuvre — justifiés au regard du règlement du SPR (tient lieu de notice DP11).</span></li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5">3.</span> <span><strong>État initial / état futur fidèle</strong> : les vues « avant / après » doivent représenter le <em>même</em> bâtiment (mêmes ouvertures, même toiture, même volume), avec uniquement les travaux déclarés.</span></li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5">4.</span> <span><strong>Pré-consultez l'UDAP</strong> (service de l'ABF de votre département) <em>avant</em> le dépôt : c'est le meilleur moyen d'éviter un avis défavorable.</span></li>
                                    <li className="flex items-start gap-2"><span className="mt-0.5">5.</span> <span>Anticipez un <strong>délai d'instruction de 2 mois</strong> et la fourniture d'exemplaires supplémentaires du dossier.</span></li>
                                </ul>
                            </div>
                        )}

                        {/* 2.5. Overlays (GeoRisques & Monuments Historiques) */}
                        {plu?.overlays && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Natural Risks Card */}
                                <div className="dp-card dp-spec">
                                    <h3 className="dp-section-title flex items-center gap-2">
                                        <span>🌍</span> Surveillance des Risques
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between border-b border-[color:var(--line-2)] pb-1.5">
                                            <span className="t-ink2">Zone Sismique :</span>
                                            <span className="font-bold t-ink">{plu.overlays.seismicClass || 'inconnue'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[color:var(--line-2)] pb-1.5">
                                            <span className="t-ink2">Zone Inondable :</span>
                                            <span className={`font-bold ${plu.overlays.hasFloodRisk ? 't-warn' : 't-ink2'}`}>
                                                {plu.overlays.hasFloodRisk ? '⚠️ Oui' : 'Non détectée'}
                                            </span>
                                        </div>
                                        
                                        {plu.overlays.pprnList && plu.overlays.pprnList.length > 0 && (
                                            <div className="mt-2">
                                                <span className="t-ink2 block mb-1">Plans de Prévention (PPRN) :</span>
                                                <ul className="space-y-1 pl-2">
                                                    {plu.overlays.pprnList.map((ppr: any, idx: number) => (
                                                        <li key={idx} className="t-ink2 text-[11px] font-mono leading-tight">
                                                            • {ppr.libPpr} ({ppr.modeleProcedure})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {plu.overlays.floodRisks && plu.overlays.floodRisks.length > 0 && (
                                            <div className="mt-2">
                                                <span className="t-ink2 block mb-1">Historique des Inondations (CatNat) :</span>
                                                <div className="max-h-24 overflow-y-auto space-y-1 pl-2 pr-1 scrollbar-thin">
                                                    {plu.overlays.floodRisks.map((fn: any, idx: number) => (
                                                        <div key={idx} className="t-ink2 text-[10px] leading-tight flex justify-between">
                                                            <span>• {fn.libelle}</span>
                                                            <span className="text-[9px] t-muted">{fn.dateEvt}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Heritage & Monument Historique Card */}
                                <div className="dp-card dp-spec">
                                    <h3 className="dp-section-title flex items-center gap-2">
                                        <span>🏛️</span> Secteur Patrimoine & ABF
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between border-b border-[color:var(--line-2)] pb-1.5">
                                            <span className="t-ink2">Site Patrimonial (SPR) :</span>
                                            <span className={`font-bold ${plu.overlays.hasSPR ? 't-warn' : 't-ink2'}`}>
                                                {plu.overlays.hasSPR ? 'Oui' : 'Aucun'}
                                            </span>
                                        </div>
                                        {plu.overlays.hasSPR && plu.overlays.sprName && (
                                            <div className="text-[11px] t-warn pl-2 leading-relaxed">
                                                Nom : {plu.overlays.sprName}
                                            </div>
                                        )}
                                        
                                        <div>
                                            <span className="t-ink2 block mb-1">Monuments Historiques (rayon 500m) :</span>
                                            {plu.overlays.monumentsWithin500m && plu.overlays.monumentsWithin500m.length > 0 ? (
                                                <ul className="space-y-1.5 pl-2 max-h-28 overflow-y-auto scrollbar-thin">
                                                    {plu.overlays.monumentsWithin500m.map((mh: any, idx: number) => (
                                                        <li key={idx} className="t-ink2 text-[11px] leading-snug">
                                                            • <span className="font-bold">{mh.title}</span> <span className="t-muted">({mh.distance}m)</span> - <span className="t-warn text-[10px]">{mh.protection}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="t-muted text-[11px] italic pl-2 block">Aucun monument répertorié à moins de 500m.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2.55. Prescriptions / servitudes from the règlement (when the Géoportail returns any) */}
                        {plu?.prescriptions && plu.prescriptions.length > 0 && (
                            <div className="dp-card">
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>📐</span> Prescriptions & servitudes du règlement
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {plu.prescriptions.map((p: any, idx: number) => (
                                        <div key={idx} className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: '#FBF1DC', border: '1px solid #EBD9A8' }}>
                                            <span style={{ color: '#8A6D1F' }}>⚠️</span>
                                            <div>
                                                <p className="text-xs font-semibold leading-tight" style={{ color: '#25221E' }}>{p.libelle}</p>
                                                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#8A8378' }}>Type : {p.typepresc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2.6. Technical Rules Checklist */}
                        {plu?.extractedRules && (
                            <div className="dp-card dp-spec">
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>📋</span> Comparatif des Règles PLU ({plu.extractedRules.zone_code || 'Zone U'})
                                </h3>
                                <div className="space-y-3 text-xs">
                                    {/* Extension / Surfaces rule */}
                                    {travaux.surfaces && parseFloat(travaux.surfaces.creee || '0') > 0 && (
                                        <div className="flex flex-col gap-1 border-b border-[color:var(--line-2)] pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="t-ink2">Surface d'extension :</span>
                                                <span className="t-ink">Max {plu.extractedRules.extension?.max_area_m2 ?? 20} m²</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="t-muted">Votre projet :</span>
                                                <span className={`font-bold ${parseFloat(travaux.surfaces.creee) > (plu.extractedRules.extension?.max_area_m2 ?? 20) ? 't-error' : 't-ok'}`}>
                                                    {travaux.surfaces.creee} m² ({parseFloat(travaux.surfaces.creee) > (plu.extractedRules.extension?.max_area_m2 ?? 20) ? 'Hors limites DP' : 'Conforme'})
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Menuiseries material rule */}
                                    {travaux.type === 'menuiseries' && travaux.menuiseries && (
                                        <div className="flex flex-col gap-1 border-b border-[color:var(--line-2)] pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="t-ink2">Matériaux Autorisés :</span>
                                                <span className="t-ink">{plu.extractedRules.facade?.allowed_materials?.length > 0 ? plu.extractedRules.facade.allowed_materials.join(', ') : 'Non restreint'}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="t-muted">Proposé :</span>
                                                <span className={`font-bold ${aspectConflict.material ? 't-error' : 't-accent'}`}>
                                                    {travaux.menuiseries.materiau}{aspectConflict.material ? ' — ⛔ INTERDIT PAR LE RÈGLEMENT' : ''}
                                                </span>
                                            </div>
                                            {plu.extractedRules.facade?.forbidden_materials?.length > 0 && (
                                                <div className="text-[10px] t-error">
                                                    Interdits : {plu.extractedRules.facade.forbidden_materials.join(', ')}
                                                </div>
                                            )}
                                            {aspectConflict.material && (
                                                <div className="text-[11px] t-error font-semibold mt-0.5">
                                                    Fort risque de refus : ce matériau figure dans la liste des matériaux proscrits. Choisissez un matériau autorisé ou justifiez auprès de la mairie / l’ABF avant dépôt.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Color / Aspects rule — the proposed teinte comes from the SELECTED
                                        work type (aspect), never another type's value. */}
                                    {aspect.color && (
                                        <div className="flex flex-col gap-1 border-b border-[color:var(--line-2)] pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="t-ink2">Teintes & Aspects :</span>
                                                <span className="t-ink">
                                                    {plu.extractedRules.facade?.color_restrictions ||
                                                     (plu.extractedRules.facade?.allowed_colors?.length > 0 ? plu.extractedRules.facade.allowed_colors.join(', ') : 'Non restreint')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="t-muted">Proposé :</span>
                                                <span className={`font-bold ${aspectConflict.color ? 't-error' : 't-accent'}`}>
                                                    {aspect.color}
                                                    {aspectConflict.color ? ' — ⛔ INTERDIT' : ''}
                                                </span>
                                            </div>
                                            {(plu.extractedRules.facade?.forbidden_colors?.length > 0) && (
                                                <div className="text-[10px] t-error">
                                                    Interdits : {plu.extractedRules.facade.forbidden_colors.join(', ')}
                                                </div>
                                            )}
                                            {aspectConflict.color && (
                                                <div className="text-[11px] t-error font-semibold mt-0.5">
                                                    Teinte proscrite par le règlement : à corriger ou confirmer avec la palette autorisée avant dépôt.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Photovoltaïque rule */}
                                    {travaux.type === 'photovoltaique' && travaux.photovoltaique && (
                                        <div className="flex flex-col gap-1 border-b border-[color:var(--line-2)] pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="t-ink2">Hauteur / Aspect Toiture :</span>
                                                <span className="t-ink">Max {plu.extractedRules.roof?.max_height_m ?? 9} m de hauteur</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="t-muted">Proposé :</span>
                                                <span className="font-bold t-accent">{travaux.photovoltaique.integration} ({travaux.photovoltaique.puissance_kw} kWc)</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Excerpts / Citations */}
                                    {((plu.extractedRules.facade?.excerpts && plu.extractedRules.facade.excerpts.length > 0) || 
                                      (plu.extractedRules.extension?.excerpts && plu.extractedRules.extension.excerpts.length > 0)) && (
                                        <div className="mt-2">
                                            <span className="t-muted block mb-1 text-[10px] uppercase font-bold">Extraits du règlement PLU associés :</span>
                                            <div className="max-h-24 overflow-y-auto space-y-1 pl-2 pr-1 scrollbar-thin p-2 rounded-lg font-mono text-[10px] t-ink2" style={{ background: 'var(--field-ro)' }}>
                                                {[
                                                    ...(plu.extractedRules.facade?.excerpts || []),
                                                    ...(plu.extractedRules.extension?.excerpts || []),
                                                    ...(plu.extractedRules.roof?.excerpts || [])
                                                ].map((exc: string, idx: number) => (
                                                    <div key={idx} className="leading-snug mb-1 border-b border-[color:var(--line-2)] pb-1 last:border-b-0">
                                                        {exc}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 3. Zone Decryptage Card */}
                        {parsed["DÉCRYPTAGE DE LA ZONE D'URBANISME"] && (
                            <div className="dp-card">
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>🔍</span> Décryptage de la Zone
                                </h3>
                                <div className="text-xs t-ink2 leading-relaxed">
                                    {parsed["DÉCRYPTAGE DE LA ZONE D'URBANISME"]}
                                </div>
                            </div>
                        )}

                        {/* 4. PLU Rules Card */}
                        {parsed["RÈGLES PLU CLÉS À CONSEILLER"] && (
                            <div className="dp-card">
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>📋</span> Règles PLU Clés à Respecter
                                </h3>
                                <div className="text-xs t-ink2 leading-relaxed whitespace-pre-line">
                                    {parsed["RÈGLES PLU CLÉS À CONSEILLER"]}
                                </div>
                            </div>
                        )}

                        {/* 5. Heritage Risks Card (AI-generated text fallback) */}
                        {parsed["RISQUES ET ALERTES PATRIMONIALES"] && !plu.evaluationResult && (
                            <div className={`dp-alert ${
                                parsed["RISQUES ET ALERTES PATRIMONIALES"].toLowerCase().includes('aucun risque')
                                ? 'is-info'
                                : 'is-warn'
                            }`} style={{ padding: '24px' }}>
                                <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                                    <span>⚠️</span> Alertes & Procédures (ABF / Mairie)
                                </h3>
                                <div className="text-xs leading-relaxed">
                                    {parsed["RISQUES ET ALERTES PATRIMONIALES"]}
                                </div>
                            </div>
                        )}

                        {/* 6. Constructive Recommendations Card */}
                        {parsed["RECOMMANDATIONS CONSTRUCTIVES"] && (
                            <div className="dp-card dp-spec">
                                <h3 className="dp-section-title flex items-center gap-2">
                                    <span>💡</span> Conseils de Rédaction du Dossier
                                </h3>
                                <div className="text-xs t-ink2 leading-relaxed whitespace-pre-line">
                                    {parsed["RECOMMANDATIONS CONSTRUCTIVES"]}
                                </div>
                            </div>
                        )}
                        </div>)}
                        {/* ── end technical details ─────────────────────────────────────────────── */}

                        {/* 7. Disclaimer Legal Notice */}
                        <div className="rounded-2xl p-4 t-muted text-[10px] leading-relaxed" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                            <span className="dp-meta block mb-1">Avertissement Légal</span>
                            Les informations et avis de conformité fournis par cet assistant sont générés de manière automatisée à partir de données extraites du Géoportail de l'Urbanisme et de modèles linguistiques d'intelligence artificielle. Ces analyses sont fournies à titre indicatif pour vous guider dans la rédaction de votre déclaration préalable (DP) et ne remplacent en aucun cas l'avis officiel du service urbanisme de votre mairie ou d'un architecte conseil.
                        </div>

                        {/* Conformity gate: require explicit acknowledgement before continuing
                            when the project is flagged (permit required / non-conforme / non vérifié). */}
                        {(() => {
                            const ev = plu?.evaluationResult
                            const needsAck = !!aspectConflict.material || !!aspectConflict.color || (!!ev && (
                                ev.decision === 'PERMIS_CONSTRUIRE' ||
                                (typeof ev.status === 'string' && ev.status.toUpperCase().includes('NON-CONFORME')) ||
                                plu?.verified === false
                            ))
                            if (!needsAck) return null
                            return (
                                <label className="dp-check-card cursor-pointer" style={{ borderColor: '#EBD9A8', background: '#FBF1DC' }}>
                                    <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ accentColor: '#8A6D1F' }} />
                                    <span className="text-sm t-warn">
                                        Je comprends que l’analyse signale un risque (matériau ou teinte proscrit par le règlement, non-conformité, permis de construire requis, ou règlement non vérifié) et je choisis de continuer en connaissance de cause. Une vérification par un professionnel est recommandée avant dépôt.
                                    </span>
                                </label>
                            )
                        })()}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center pt-4">
                            <button onClick={() => router.push(`/etape/${dossierId}/3`)} className="dp-btn-secondary">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Retour
                            </button>
                            <div className="flex items-center gap-3">
                                <button onClick={() => runAnalysis()} className="dp-btn-secondary text-xs !px-4 !py-2">
                                    🔄 Réanalyser
                                </button>
                                {(() => {
                                    const ev = plu?.evaluationResult
                                    const needsAck = !!aspectConflict.material || !!aspectConflict.color || (!!ev && (
                                        ev.decision === 'PERMIS_CONSTRUIRE' ||
                                        (typeof ev.status === 'string' && ev.status.toUpperCase().includes('NON-CONFORME')) ||
                                        plu?.verified === false
                                    ))
                                    return (
                                        <button onClick={() => router.push(`/etape/${dossierId}/5`)} disabled={needsAck && !ack}
                                            className="dp-btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed">
                                            Étape suivante
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
