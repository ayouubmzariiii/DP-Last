'use client'

import { usePathname } from 'next/navigation'

const STEPS = [
    { num: 1, label: 'Demandeur', path: '/etape/1' },
    { num: 2, label: 'Terrain', path: '/etape/2' },
    { num: 3, label: 'Travaux', path: '/etape/3' },
    { num: 4, label: 'Photos', path: '/etape/4' },
    { num: 5, label: 'Plans', path: '/etape/5' },
    { num: 6, label: 'Génération', path: '/etape/6' },
]
import { useDPContext } from '@/lib/context'
import Link from 'next/link'

export default function StepLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { isTestMode, toggleTestMode } = useDPContext()

    const currentStep = STEPS.findIndex(s => s.path === pathname) + 1
    const progress = (currentStep / STEPS.length) * 100

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0f172a 60%, #1e1b4b 100%)' }}>
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/10" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)' }}>
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
                        <div className="w-9 h-9 bg-blue-500 group-hover:bg-blue-400 rounded-xl flex items-center justify-center shadow-lg transition-colors">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm font-bold text-white leading-tight tracking-wide">DP Travaux</h1>
                            <p className="text-xs text-blue-300 font-medium">Cerfa 13703*</p>
                        </div>
                    </Link>

                    {/* Desktop steps */}
                    <div className="hidden md:flex items-center gap-1">
                        {STEPS.map((step) => {
                            const isDone = step.num < currentStep
                            const isCurrent = step.num === currentStep
                            return (
                                <div key={step.num} className="flex items-center">
                                    <div className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${isCurrent ? 'bg-blue-600 text-white' : ''}
                    ${isDone ? 'text-green-400' : ''}
                    ${!isCurrent && !isDone ? 'text-slate-500' : ''}
                  `} style={isDone ? { background: 'rgba(34,197,94,0.15)' } : {}}>
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold`}>
                                            {isDone ? '✓' : step.num}
                                        </span>
                                        <span className="hidden lg:inline">{step.label}</span>
                                    </div>
                                    {step.num < STEPS.length && (
                                        <div className="w-4 h-px mx-1" style={{ background: isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)' }} />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="md:hidden text-sm font-semibold text-slate-300">
                            Étape {currentStep}/{STEPS.length}
                        </div>

                        {/* Test Mode Toggle */}
                        <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/5">
                            <span className="text-xs font-semibold text-slate-400">Test Mode</span>
                            <button
                                onClick={toggleTestMode}
                                className={`w-9 h-5 rounded-full relative transition-colors ${isTestMode ? 'bg-amber-500' : 'bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isTestMode ? 'translate-x-4' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-0.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                        className="h-full progress-fill"
                        style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}
                    />
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    )
}
