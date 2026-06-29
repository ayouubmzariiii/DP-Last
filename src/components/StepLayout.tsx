'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useDPContext } from '@/lib/context'

const STEPS = [
    { num: 1, label: 'Demandeur', path: '/etape/1' },
    { num: 2, label: 'Terrain', path: '/etape/2' },
    { num: 3, label: 'Travaux', path: '/etape/3' },
    { num: 4, label: 'Analyse PLU', path: '/etape/4' },
    { num: 5, label: 'Photos', path: '/etape/5' },
    { num: 6, label: 'Plans', path: '/etape/6' },
    { num: 7, label: 'Génération', path: '/etape/7' },
]

const AC = '#2D5A4C'

export default function StepLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { isTestMode, toggleTestMode } = useDPContext()

    const currentStep = STEPS.findIndex(s => s.path === pathname) + 1
    const progress = (currentStep / STEPS.length) * 100

    return (
        <div className="min-h-screen" style={{ background: '#F1ECE3', color: '#25221E' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(250,247,241,.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E3DCCF' }}>
                <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 28px' }} className="flex items-center justify-between gap-5">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center justify-center text-white" style={{ width: 34, height: 34, borderRadius: 9, background: AC }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
                        </div>
                        <div>
                            <div style={{ fontFamily: 'var(--hf)', fontSize: 15, fontWeight: 600, lineHeight: 1.1 }}>DP Travaux</div>
                            <div style={{ fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.05em', color: '#9A9286', textTransform: 'uppercase' }}>Cerfa 13703*</div>
                        </div>
                    </Link>

                    {/* Steps */}
                    <div className="hidden lg:flex items-center justify-center flex-1">
                        {STEPS.map((step, i) => {
                            const isDone = step.num < currentStep
                            const isCurrent = step.num === currentStep
                            return (
                                <div key={step.num} className="flex items-center">
                                    {i > 0 && <div style={{ width: 18, height: 1, background: '#DAD2C4', margin: '0 4px' }} />}
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center justify-center shrink-0" style={{
                                            width: 24, height: 24, borderRadius: '50%', fontFamily: 'var(--mf)', fontSize: 11, fontWeight: 600,
                                            ...(isDone || isCurrent
                                                ? { background: AC, color: '#fff', ...(isCurrent ? { boxShadow: '0 0 0 4px rgba(45,90,76,.14)' } : {}) }
                                                : { background: '#fff', border: '1px solid #D8D1C4', color: '#B5AEA2' }),
                                        }}>
                                            {isDone
                                                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                : step.num}
                                        </div>
                                        <span className="hidden xl:inline" style={{ fontSize: 12.5, fontWeight: 500, color: '#6B655B', whiteSpace: 'nowrap' }}>{step.label}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <div className="lg:hidden" style={{ fontFamily: 'var(--mf)', fontSize: 12, color: '#6B655B' }}>
                            Étape {currentStep}/{STEPS.length}
                        </div>
                        {/* Test toggle */}
                        <div className="flex items-center gap-2.5" style={{ background: '#F1ECE3', border: '1px solid #E3DCCF', padding: '6px 12px', borderRadius: 100 }}>
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 10.5, letterSpacing: '.05em', color: '#8A8378', textTransform: 'uppercase' }}>Test</span>
                            <button onClick={toggleTestMode} aria-label="Mode test"
                                style={{ width: 36, height: 20, borderRadius: 100, position: 'relative', border: 'none', cursor: 'pointer', transition: 'background .2s', background: isTestMode ? AC : '#CFC7B8' }}>
                                <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform .2s', transform: isTestMode ? 'translateX(16px)' : 'translateX(0)' }} />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Progress */}
                <div style={{ height: 3, background: '#E6DFD3' }}>
                    <div className="progress-fill" style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${AC}, #244A3E)` }} />
                </div>
            </header>

            {/* Test-mode banner */}
            {isTestMode && (
                <div style={{ position: 'sticky', top: 57, zIndex: 39, background: '#8A6D1F', color: '#FBF1DC', textAlign: 'center', fontSize: 12, fontWeight: 600, padding: '6px 16px' }}>
                    Mode test — données fictives. La génération du dossier est désactivée. Désactivez le mode test pour un dossier réel.
                </div>
            )}

            <main style={{ maxWidth: 880, margin: '0 auto', padding: '44px 32px 80px' }}>
                {children}
            </main>
        </div>
    )
}
