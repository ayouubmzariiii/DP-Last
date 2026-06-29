'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepLayout from '@/components/StepLayout'
import { useDPContext } from '@/lib/context'

export default function Etape4() {
    const router = useRouter()
    const { formData, updateTerrain } = useDPContext()
    const terrain = formData.terrain
    const travaux = formData.travaux

    const [analyzing, setAnalyzing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showExtractedText, setShowExtractedText] = useState(false)

    const plu = terrain.plu
    const hasReport = !!plu?.analysisReport

    const runAnalysis = async () => {
        if (!travaux.type) {
            setError("Veuillez renseigner le type de travaux à l'étape précédente.")
            return
        }
        setAnalyzing(true)
        setError(null)
        try {
            const res = await fetch('/api/analyze-plu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plu: terrain.plu,
                    travaux: travaux,
                    description_projet: terrain.description_projet
                })
            })
            if (!res.ok) throw new Error("Erreur lors de la communication avec l'assistant PLU.")
            const data = await res.json()
            if (data.error) throw new Error(data.error)

            updateTerrain({
                plu: {
                    ...terrain.plu,
                    analysisReport: data.report,
                    extractedRules: data.extractedRules,
                    evaluationResult: data.evaluationResult,
                    pdfType: data.pdfType,
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

    // Auto-run analysis on mount if not already present
    useEffect(() => {
        if (plu && !hasReport && !analyzing && !error) {
            runAnalysis()
        }
    }, [plu, hasReport])

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

    const getVerdictDetails = () => {
        const result = plu?.evaluationResult
        if (!result) {
            // Fallback to old parsing logic if evaluationResult doesn't exist
            const txt = (parsed['STATUT DE CONFORMITÉ'] || '').toUpperCase()
            if (txt.includes('NON-CONFORME')) {
                return {
                    bg: 'bg-red-500/10 border-red-500/30 text-red-400',
                    badge: '❌ PROBABLEMENT NON-CONFORME',
                    sub: 'Le projet semble en infraction avec certaines règles locales.',
                    color: 'text-red-400',
                    border: 'border-red-500/30',
                    icon: '🔴'
                }
            }
            if (txt.includes('INCERTAIN')) {
                return {
                    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                    badge: '⚠️ CONFORMITÉ INCERTAINE',
                    sub: 'Des doutes subsistent quant à la conformité réglementaire.',
                    color: 'text-amber-400',
                    border: 'border-amber-500/30',
                    icon: '🟡'
                }
            }
            return {
                bg: 'bg-green-500/10 border-green-500/30 text-green-400',
                badge: '✅ PROBABLEMENT CONFORME',
                sub: 'Le projet respecte les prescriptions générales identifiées.',
                color: 'text-green-400',
                border: 'border-green-500/30',
                icon: '🟢'
            }
        }

        const { decision, status } = result

        if (decision === 'PERMIS_CONSTRUIRE') {
            return {
                bg: 'bg-red-500/10 border-red-500/30 text-red-400',
                badge: '❌ Permis de Construire Requis',
                sub: 'Le projet dépasse les limites réglementaires de la Déclaration Préalable.',
                color: 'text-red-400',
                border: 'border-red-500/30',
                icon: '🔴'
            }
        }
        if (decision === 'DECLARATION_PREALABLE_ABF') {
            return {
                bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                badge: '🏛️ Déclaration Préalable avec Avis ABF requis',
                sub: 'Le terrain se situe en périmètre patrimonial (SPR ou abords MH). Instruction rallongée à 2 mois.',
                color: 'text-amber-400',
                border: 'border-amber-500/30',
                icon: '🟡'
            }
        }
        if (decision === 'DECLARATION_PREALABLE_RISQUES') {
            return {
                bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                badge: '⚠️ Déclaration Préalable (Zone Inondable)',
                sub: 'Le projet est situé en zone de prévention des risques (PPRN). Respect des prescriptions requis.',
                color: 'text-yellow-400',
                border: 'border-yellow-500/30',
                icon: '🟡'
            }
        }

        if (status === 'PROBABLEMENT NON-CONFORME') {
            return {
                bg: 'bg-red-500/10 border-red-500/30 text-red-400',
                badge: '❌ Probablement Non-Conforme',
                sub: 'Le projet ne respecte pas certaines exigences réglementaires.',
                color: 'text-red-400',
                border: 'border-red-500/30',
                icon: '🔴'
            }
        }

        if (status === 'CONFORMITÉ INCERTAINE') {
            return {
                bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                badge: '⚠️ Conformité Incertaine',
                sub: 'Des pièces ou justifications supplémentaires peuvent être demandées.',
                color: 'text-amber-400',
                border: 'border-amber-500/30',
                icon: '🟡'
            }
        }

        return {
            bg: 'bg-green-500/10 border-green-500/30 text-green-400',
            badge: '✅ Probablement Conforme (DP Simple)',
            sub: 'Le projet respecte les prescriptions d\'aspect et d\'implantation.',
            color: 'text-green-400',
            border: 'border-green-500/30',
            icon: '🟢'
        }
    }

    const verdict = getVerdictDetails()

    return (
        <StepLayout>
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Analyse PLU & Avertissements</h2>
                    <p className="text-slate-500 mt-1">Analyse automatique du règlement d'urbanisme de votre zone</p>
                </div>

                {!plu ? (
                    <div className="dp-card text-center py-8">
                        <span className="text-4xl">📍</span>
                        <h3 className="font-bold text-white mt-4">Aucune coordonnée PLU</h3>
                        <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                            Veuillez renseigner une adresse valide et récupérer les données cadastrales à l'étape 2 (Terrain).
                        </p>
                        <button onClick={() => router.push('/etape/2')} className="dp-btn-primary mt-6 mx-auto">
                            Retour à l'étape 2
                        </button>
                    </div>
                ) : analyzing ? (
                    <div className="dp-card py-16 flex flex-col items-center justify-center text-center">
                        <div className="relative mb-6">
                            <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.2)]" />
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-purple-400">PLU</div>
                        </div>
                        <h3 className="font-bold text-white text-lg animate-pulse">Extraction et analyse du règlement en cours...</h3>
                        <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                            Nous téléchargeons le règlement PDF officiel du Géoportail, convertissons son contenu en texte et interrogeons l'intelligence artificielle pour identifier les contraintes réglementaires.
                        </p>
                    </div>
                ) : error ? (
                    <div className="dp-card border-red-500/20 bg-red-950/5 p-6">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">⚠️</span>
                            <div className="flex-1">
                                <h3 className="font-bold text-white">Échec de l'analyse PLU</h3>
                                <p className="text-sm text-red-400 mt-1">{error}</p>
                                <div className="mt-4 flex gap-3">
                                    <button onClick={runAnalysis} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">
                                        Réessayer l'analyse
                                    </button>
                                    <button onClick={() => router.push('/etape/3')} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-colors">
                                        Retour aux travaux
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* 1. PDF Extractor & Scanner Disclaimer Box */}
                        <div className="dp-card relative overflow-hidden" style={{ borderColor: plu.isRnu ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)', background: plu.isRnu ? 'linear-gradient(180deg, rgba(16,185,129,0.03) 0%, transparent 100%)' : 'linear-gradient(180deg, rgba(59,130,246,0.03) 0%, transparent 100%)' }}>
                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: plu.isRnu ? '#10b981' : '#3b82f6' }}></div>
                            
                            <div className="flex items-start gap-4">
                                <div className="text-3xl">
                                    {plu.isRnu ? '🏛️' : plu.pdfType === 'text' ? '📄' : '⚠️'}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-base">
                                        {plu.isRnu ? 'Commune régie par le Règlement National d\'Urbanisme (RNU)' :
                                         plu.pdfType === 'text' ? 'Règlement PDF converti en texte' : 
                                         plu.pdfType === 'scanned' ? 'Avertissement : Document PDF numérisé (image)' : 
                                         'Avertissement : Règlement de zone indisponible'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        {plu.isRnu ? (
                                            `Le Géoportail de l'Urbanisme indique que cette commune n'a pas de document local d'urbanisme (PLU/POS/CC). Par conséquent, ce sont les règles nationales du Code de l'Urbanisme (RNU) qui s'appliquent directement à votre projet (constructibilité limitée, aspect extérieur, insertion paysagère).`
                                        ) : plu.pdfType === 'text' ? (
                                            `Le règlement de la zone d'urbanisme (${plu.zone?.libelle || 'inconnue'}) a été téléchargé avec succès. Notre système a extrait ${plu.textLength || 0} caractères de texte brut pour l'analyse IA.`
                                        ) : plu.pdfType === 'scanned' ? (
                                            `Le document de règlement fourni par la commune est un scan composé uniquement d'images d'archives. Aucune extraction de texte brut direct n'est possible. L'assistant a formulé son rapport sur la base du code d'urbanisme national (RNU) et des données de zonage.`
                                        ) : (
                                            `Le fichier de règlement n'a pas pu être téléchargé depuis les serveurs du Géoportail de l'Urbanisme. L'analyse s'appuie sur les prescriptions cadastrales globales et les règles générales en vigueur en France.`
                                        )}
                                    </p>

                                    {plu.pdfType === 'text' && plu.extractedText && (
                                        <div className="mt-3">
                                            <button
                                                onClick={() => setShowExtractedText(!showExtractedText)}
                                                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                            >
                                                {showExtractedText ? 'Masquer le texte extrait' : 'Voir un extrait du règlement d\'urbanisme'}
                                                <svg className={`w-3 h-3 transition-transform ${showExtractedText ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showExtractedText && (
                                                <div className="mt-2.5 p-3 bg-black/40 border border-slate-800 rounded-lg text-[11px] text-slate-400 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap leading-normal scrollbar-thin">
                                                    {plu.extractedText.slice(0, 8000)}
                                                    {plu.extractedText.length > 8000 && '\n\n[... LE TEXTE DU DOCUMENT EST TRONQUÉ POUR LE PRÉVIEW ...]'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. Verdict / Compliance Status Card */}
                        <div className={`p-5 rounded-2xl border ${verdict.bg}`}>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                Verdict de conformité réglementaire (Moteur de Décision)
                            </div>
                            <div className="text-base font-bold flex items-center gap-2 mb-1">
                                <span>{verdict.icon}</span>
                                <span>{verdict.badge}</span>
                            </div>
                            <p className="text-xs opacity-90 leading-relaxed text-slate-300 mb-3">
                                {verdict.sub}
                            </p>

                            {/* Violations List */}
                            {plu?.evaluationResult?.violations && plu.evaluationResult.violations.length > 0 && (
                                <div className="mt-3 p-3 bg-red-950/30 border border-red-500/20 rounded-xl space-y-2">
                                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                        🛑 Non-conformités détectées
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-red-300 space-y-1 pl-1">
                                        {plu.evaluationResult.violations.map((violation: string, idx: number) => (
                                            <li key={idx} className="leading-relaxed">{violation}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Warnings List */}
                            {plu?.evaluationResult?.warnings && plu.evaluationResult.warnings.length > 0 && (
                                <div className="mt-3 p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
                                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                        ⚠️ Points d'attention & Alertes
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-amber-300 space-y-1 pl-1">
                                        {plu.evaluationResult.warnings.map((warning: string, idx: number) => (
                                            <li key={idx} className="leading-relaxed">{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* 2.5. Overlays (GeoRisques & Monuments Historiques) */}
                        {plu?.overlays && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Natural Risks Card */}
                                <div className="dp-card border-blue-500/10 bg-blue-950/5">
                                    <h3 className="dp-section-title flex items-center gap-2 text-white">
                                        <span>🌍</span> Surveillance des Risques
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                            <span className="text-slate-400">Zone Sismique :</span>
                                            <span className="font-bold text-slate-200">{plu.overlays.seismicClass || 'inconnue'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                            <span className="text-slate-400">Zone Inondable :</span>
                                            <span className={`font-bold ${plu.overlays.hasFloodRisk ? 'text-blue-400' : 'text-slate-300'}`}>
                                                {plu.overlays.hasFloodRisk ? '⚠️ Oui' : 'Non détectée'}
                                            </span>
                                        </div>
                                        
                                        {plu.overlays.pprnList && plu.overlays.pprnList.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-slate-400 block mb-1">Plans de Prévention (PPRN) :</span>
                                                <ul className="space-y-1 pl-2">
                                                    {plu.overlays.pprnList.map((ppr: any, idx: number) => (
                                                        <li key={idx} className="text-slate-300 text-[11px] font-mono leading-tight">
                                                            • {ppr.libPpr} ({ppr.modeleProcedure})
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {plu.overlays.floodRisks && plu.overlays.floodRisks.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-slate-400 block mb-1">Historique des Inondations (CatNat) :</span>
                                                <div className="max-h-24 overflow-y-auto space-y-1 pl-2 pr-1 scrollbar-thin">
                                                    {plu.overlays.floodRisks.map((fn: any, idx: number) => (
                                                        <div key={idx} className="text-slate-400 text-[10px] leading-tight flex justify-between">
                                                            <span>• {fn.libelle}</span>
                                                            <span className="text-[9px] text-slate-500">{fn.dateEvt}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Heritage & Monument Historique Card */}
                                <div className="dp-card border-amber-500/10 bg-amber-950/5">
                                    <h3 className="dp-section-title flex items-center gap-2 text-white">
                                        <span>🏛️</span> Secteur Patrimoine & ABF
                                    </h3>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                                            <span className="text-slate-400">Site Patrimonial (SPR) :</span>
                                            <span className={`font-bold ${plu.overlays.hasSPR ? 'text-amber-400' : 'text-slate-300'}`}>
                                                {plu.overlays.hasSPR ? 'Oui' : 'Aucun'}
                                            </span>
                                        </div>
                                        {plu.overlays.hasSPR && plu.overlays.sprName && (
                                            <div className="text-[11px] text-amber-300/80 pl-2 leading-relaxed">
                                                Nom : {plu.overlays.sprName}
                                            </div>
                                        )}
                                        
                                        <div>
                                            <span className="text-slate-400 block mb-1">Monuments Historiques (rayon 500m) :</span>
                                            {plu.overlays.monumentsWithin500m && plu.overlays.monumentsWithin500m.length > 0 ? (
                                                <ul className="space-y-1.5 pl-2 max-h-28 overflow-y-auto scrollbar-thin">
                                                    {plu.overlays.monumentsWithin500m.map((mh: any, idx: number) => (
                                                        <li key={idx} className="text-slate-300 text-[11px] leading-snug">
                                                            • <span className="font-bold">{mh.title}</span> <span className="text-slate-500">({mh.distance}m)</span> - <span className="text-amber-400/80 text-[10px]">{mh.protection}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-slate-500 text-[11px] italic pl-2 block">Aucun monument répertorié à moins de 500m.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2.6. Technical Rules Checklist */}
                        {plu?.extractedRules && (
                            <div className="dp-card border-purple-500/10 bg-purple-950/5">
                                <h3 className="dp-section-title flex items-center gap-2 text-white">
                                    <span>📋</span> Comparatif des Règles PLU ({plu.extractedRules.zone_code || 'Zone U'})
                                </h3>
                                <div className="space-y-3 text-xs">
                                    {/* Extension / Surfaces rule */}
                                    {travaux.surfaces && parseFloat(travaux.surfaces.creee || '0') > 0 && (
                                        <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-400">Surface d'extension :</span>
                                                <span className="text-slate-200">Max {plu.extractedRules.extension?.max_area_m2 ?? 20} m²</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Votre projet :</span>
                                                <span className={`font-bold ${parseFloat(travaux.surfaces.creee) > (plu.extractedRules.extension?.max_area_m2 ?? 20) ? 'text-red-400' : 'text-green-400'}`}>
                                                    {travaux.surfaces.creee} m² ({parseFloat(travaux.surfaces.creee) > (plu.extractedRules.extension?.max_area_m2 ?? 20) ? 'Hors limites DP' : 'Conforme'})
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Menuiseries material rule */}
                                    {travaux.type === 'menuiseries' && travaux.menuiseries && (
                                        <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-400">Matériaux Autorisés :</span>
                                                <span className="text-slate-200">{plu.extractedRules.facade?.allowed_materials?.length > 0 ? plu.extractedRules.facade.allowed_materials.join(', ') : 'Non restreint'}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Proposé :</span>
                                                <span className="font-bold text-purple-400">{travaux.menuiseries.materiau}</span>
                                            </div>
                                            {plu.extractedRules.facade?.forbidden_materials?.length > 0 && (
                                                <div className="text-[10px] text-red-400/80">
                                                    Interdits : {plu.extractedRules.facade.forbidden_materials.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Color / Aspects rule */}
                                    {(travaux.menuiseries?.couleur || travaux.isolation?.couleur) && (
                                        <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-400">Teintes & Aspects :</span>
                                                <span className="text-slate-200">
                                                    {plu.extractedRules.facade?.color_restrictions || 
                                                     (plu.extractedRules.facade?.allowed_colors?.length > 0 ? plu.extractedRules.facade.allowed_colors.join(', ') : 'Non restreint')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Proposé :</span>
                                                <span className="font-bold text-purple-400">
                                                    {travaux.type === 'menuiseries' && travaux.menuiseries
                                                        ? `${travaux.menuiseries.couleur} ${travaux.menuiseries.couleur_ral ? `(RAL ${travaux.menuiseries.couleur_ral})` : ''}`
                                                        : travaux.isolation?.couleur}
                                                </span>
                                            </div>
                                            {(plu.extractedRules.facade?.forbidden_colors?.length > 0) && (
                                                <div className="text-[10px] text-red-400/80">
                                                    Interdits : {plu.extractedRules.facade.forbidden_colors.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Photovoltaïque rule */}
                                    {travaux.type === 'photovoltaique' && travaux.photovoltaique && (
                                        <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-slate-400">Hauteur / Aspect Toiture :</span>
                                                <span className="text-slate-200">Max {plu.extractedRules.roof?.max_height_m ?? 9} m de hauteur</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Proposé :</span>
                                                <span className="font-bold text-purple-400">{travaux.photovoltaique.integration} ({travaux.photovoltaique.puissance_kw} kWc)</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Excerpts / Citations */}
                                    {((plu.extractedRules.facade?.excerpts && plu.extractedRules.facade.excerpts.length > 0) || 
                                      (plu.extractedRules.extension?.excerpts && plu.extractedRules.extension.excerpts.length > 0)) && (
                                        <div className="mt-2">
                                            <span className="text-slate-500 block mb-1 text-[10px] uppercase font-bold">Extraits du règlement PLU associés :</span>
                                            <div className="max-h-24 overflow-y-auto space-y-1 pl-2 pr-1 scrollbar-thin bg-black/20 p-2 rounded-lg font-mono text-[10px] text-slate-400">
                                                {[
                                                    ...(plu.extractedRules.facade?.excerpts || []),
                                                    ...(plu.extractedRules.extension?.excerpts || []),
                                                    ...(plu.extractedRules.roof?.excerpts || [])
                                                ].map((exc: string, idx: number) => (
                                                    <div key={idx} className="leading-snug mb-1 border-b border-slate-800/30 pb-1 last:border-b-0">
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
                                <h3 className="dp-section-title flex items-center gap-2 text-white">
                                    <span>🔍</span> Décryptage de la Zone
                                </h3>
                                <div className="text-xs text-slate-300 leading-relaxed">
                                    {parsed["DÉCRYPTAGE DE LA ZONE D'URBANISME"]}
                                </div>
                            </div>
                        )}

                        {/* 4. PLU Rules Card */}
                        {parsed["RÈGLES PLU CLÉS À CONSEILLER"] && (
                            <div className="dp-card">
                                <h3 className="dp-section-title flex items-center gap-2 text-white">
                                    <span>📋</span> Règles PLU Clés à Respecter
                                </h3>
                                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                                    {parsed["RÈGLES PLU CLÉS À CONSEILLER"]}
                                </div>
                            </div>
                        )}

                        {/* 5. Heritage Risks Card (AI-generated text fallback) */}
                        {parsed["RISQUES ET ALERTES PATRIMONIALES"] && !plu.evaluationResult && (
                            <div className={`p-6 rounded-2xl border ${
                                parsed["RISQUES ET ALERTES PATRIMONIALES"].toLowerCase().includes('aucun risque')
                                ? 'bg-slate-900/40 border-slate-800 text-slate-300'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                            }`}>
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
                            <div className="dp-card border-purple-500/15 bg-purple-950/5">
                                <h3 className="dp-section-title flex items-center gap-2 text-white">
                                    <span>💡</span> Conseils de Rédaction du Dossier
                                </h3>
                                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                                    {parsed["RECOMMANDATIONS CONSTRUCTIVES"]}
                                </div>
                            </div>
                        )}

                        {/* 7. Disclaimer Legal Notice */}
                        <div className="rounded-2xl p-4 bg-slate-900/40 border border-slate-800 text-slate-500 text-[10px] leading-relaxed">
                            <span className="font-bold text-slate-400 uppercase tracking-wide block mb-1">Avertissement Légal</span>
                            Les informations et avis de conformité fournis par cet assistant sont générés de manière automatisée à partir de données extraites du Géoportail de l'Urbanisme et de modèles linguistiques d'intelligence artificielle. Ces analyses sont fournies à titre indicatif pour vous guider dans la rédaction de votre déclaration préalable (DP) et ne remplacent en aucun cas l'avis officiel du service urbanisme de votre mairie ou d'un architecte conseil.
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center pt-4">
                            <button onClick={() => router.push('/etape/3')} className="dp-btn-secondary">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Retour
                            </button>
                            <div className="flex items-center gap-3">
                                <button onClick={runAnalysis} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-colors">
                                    🔄 Réanalyser
                                </button>
                                <button onClick={() => router.push('/etape/5')} className="dp-btn-primary text-base">
                                    Étape suivante
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StepLayout>
    )
}
