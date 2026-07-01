'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useDPContext } from '@/lib/context'
import SealIcon from '@/components/SealIcon'

const STEPS = [
    { num: 1, label: 'Demandeur' },
    { num: 2, label: 'Terrain' },
    { num: 3, label: 'Travaux' },
    { num: 4, label: 'PLU' },
    { num: 5, label: 'Photos' },
    { num: 6, label: 'Plans' },
    { num: 7, label: 'Génération' },
]
const AC = '#2D5A4C'

// This layout PERSISTS across /etape/[dossierId]/* navigations (App Router) — so the header,
// stepper and progress bar never remount; only the page content swaps (see template.tsx).
export default function EtapeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const params = useParams<{ dossierId: string }>()
    const dossierId = params.dossierId
    const { isTestMode, toggleTestMode, loadDossier, setLastStep, currentDossierId } = useDPContext()

    const stepPath = (num: number) => `/etape/${dossierId}/${num}`
    // Current step = trailing numeric segment of the path.
    const currentStep = Number(pathname.split('/').pop()) || 1
    const progress = (Math.max(currentStep, 1) / STEPS.length) * 100

    // Hydrate the active dossier from the DB when the route's id changes (skip in test mode).
    useEffect(() => {
        if (dossierId && !isTestMode && currentDossierId !== dossierId) loadDossier(dossierId)
    }, [dossierId, isTestMode, currentDossierId, loadDossier])

    // Track the last step for autosave, so "Ouvrir" resumes where the user left off.
    useEffect(() => { setLastStep(currentStep) }, [currentStep, setLastStep])

    // Keep the current step centred in the (scrollable) stepper, esp. on mobile.
    const currentRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        currentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, [currentStep])

    return (
        <div className="min-h-screen" style={{ background: '#F1ECE3', color: '#25221E' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(250,247,241,.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E3DCCF' }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', padding: '13px 24px' }} className="flex items-center gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center justify-center text-white" style={{ width: 36, height: 36, borderRadius: 10, background: AC, boxShadow: '0 6px 16px -8px rgba(45,90,76,.6)' }}>
                            <SealIcon size={20} stroke="#fff" strokeWidth={1.5} />
                        </div>
                        <div className="hidden sm:block">
                            <div style={{ fontFamily: 'var(--hf)', fontSize: 15, fontWeight: 600, lineHeight: 1.1 }}>DP Travaux</div>
                            <div style={{ fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.05em', color: '#9A9286', textTransform: 'uppercase' }}>Cerfa 13703*</div>
                        </div>
                    </Link>

                    {/* Stepper — labels always visible; horizontally scrollable on small screens.
                        Completed/current steps are clickable to jump back. */}
                    <nav className="dp-stepper flex-1 flex items-center justify-center" style={{ overflowX: 'auto' }} aria-label="Étapes">
                        <div className="flex items-center" style={{ margin: '0 auto' }}>
                            {STEPS.map((step, i) => {
                                const isDone = step.num < currentStep
                                const isCurrent = step.num === currentStep
                                const reachable = step.num <= currentStep
                                return (
                                    <div key={step.num} className="flex items-center shrink-0">
                                        {i > 0 && <div style={{ width: 16, height: 2, borderRadius: 2, margin: '0 5px', background: isDone || isCurrent ? AC : '#DAD2C4', transition: 'background .3s' }} />}
                                        <button
                                            ref={isCurrent ? currentRef : undefined}
                                            type="button"
                                            onClick={() => reachable && router.push(stepPath(step.num))}
                                            disabled={!reachable}
                                            title={step.label}
                                            className="flex items-center gap-1.5 shrink-0 rounded-full transition-colors"
                                            style={{ padding: '4px 6px', cursor: reachable ? 'pointer' : 'default', background: 'transparent' }}
                                        >
                                            <span className="flex items-center justify-center shrink-0" style={{
                                                width: 24, height: 24, borderRadius: '50%', fontFamily: 'var(--mf)', fontSize: 11, fontWeight: 600, transition: 'all .25s',
                                                ...(isDone || isCurrent
                                                    ? { background: AC, color: '#fff', ...(isCurrent ? { boxShadow: '0 0 0 4px rgba(45,90,76,.16)' } : {}) }
                                                    : { background: '#fff', border: '1px solid #D8D1C4', color: '#B5AEA2' }),
                                            }}>
                                                {isDone
                                                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                    : step.num}
                                            </span>
                                            <span style={{ fontSize: 12.5, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? '#25221E' : isDone ? '#5C564C' : '#A89F90', whiteSpace: 'nowrap' }}>{step.label}</span>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </nav>

                    {/* Test toggle */}
                    <div className="flex items-center gap-2.5 shrink-0" style={{ background: '#F1ECE3', border: '1px solid #E3DCCF', padding: '6px 12px', borderRadius: 100 }}>
                        <span className="hidden sm:inline" style={{ fontFamily: 'var(--mf)', fontSize: 10.5, letterSpacing: '.05em', color: '#8A8378', textTransform: 'uppercase' }}>Test</span>
                        <button onClick={toggleTestMode} aria-label="Mode test"
                            style={{ width: 36, height: 20, borderRadius: 100, position: 'relative', border: 'none', cursor: 'pointer', transition: 'background .2s', background: isTestMode ? AC : '#CFC7B8' }}>
                            <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform .2s', transform: isTestMode ? 'translateX(16px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>
                {/* Progress */}
                <div style={{ height: 3, background: '#E6DFD3' }}>
                    <div className="progress-fill" style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${AC}, #244A3E)` }} />
                </div>
            </header>

            {/* Test-mode banner */}
            {isTestMode && (
                <div style={{ background: '#8A6D1F', color: '#FBF1DC', textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '6px 16px' }}>
                    Mode test — données fictives. Vous pouvez générer le dossier pour prévisualiser le résultat, mais ne le déposez pas en mairie. Désactivez le mode test pour un dossier réel.
                </div>
            )}

            <main style={{ maxWidth: 880, margin: '0 auto', padding: '44px 32px 80px' }}>
                {children}
            </main>
        </div>
    )
}
