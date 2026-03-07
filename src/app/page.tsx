import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10">
                <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-lg">DP Travaux</span>
                    </div>
                    <span className="text-blue-300 text-sm font-medium">Dossier CERFA 13703*</span>
                </div>
            </header>

            {/* Hero */}
            <section className="max-w-5xl mx-auto px-4 py-20 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-sm font-semibold mb-8">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    Générateur IA de Demande Préalable de Travaux
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
                    Votre dossier DP
                    <span className="text-blue-400"> complet</span>
                    <br />en quelques minutes
                </h1>

                <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
                    Remplissez un formulaire simple et obtenez automatiquement le <strong className="text-white">CERFA 13703*</strong> et
                    l'ensemble des pièces obligatoires <strong className="text-white">(DP1 à DP8)</strong> pour votre dépôt en mairie.
                </p>

                <Link
                    href="/etape/1"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-lg transition-all duration-200 shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Commencer mon dossier
                </Link>

                <p className="text-slate-500 text-sm mt-4">Gratuit · Rapide · 100% confidentiel</p>
            </section>

            {/* Travaux types */}
            <section className="max-w-5xl mx-auto px-4 pb-16">
                <h2 className="text-center text-white/70 text-sm font-semibold uppercase tracking-widest mb-8">
                    Types de travaux couverts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        {
                            icon: '🪟',
                            title: 'Menuiseries',
                            desc: 'Changement de fenêtres, portes, volets avec spécifications techniques',
                            color: 'from-blue-600/20 to-blue-800/20',
                            border: 'border-blue-500/30',
                        },
                        {
                            icon: '🏠',
                            title: 'Isolation Extérieure',
                            desc: 'ITE avec enduit ou bardage (bois, métal, composite) et couleur de finition',
                            color: 'from-emerald-600/20 to-emerald-800/20',
                            border: 'border-emerald-500/30',
                        },
                        {
                            icon: '☀️',
                            title: 'Panneaux Photovoltaïques',
                            desc: 'Installation de panneaux PV en toiture, puissance et orientation',
                            color: 'from-amber-600/20 to-amber-800/20',
                            border: 'border-amber-500/30',
                        },
                    ].map((item) => (
                        <div
                            key={item.title}
                            className={`bg-gradient-to-br ${item.color} border ${item.border} rounded-2xl p-6 text-center`}
                        >
                            <div className="text-4xl mb-4">{item.icon}</div>
                            <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                            <p className="text-slate-400 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Documents générés */}
            <section className="max-w-5xl mx-auto px-4 pb-20">
                <h2 className="text-center text-white/70 text-sm font-semibold uppercase tracking-widest mb-8">
                    Documents générés automatiquement
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { code: 'CERFA', label: '13703* Formulaire officiel', icon: '📋' },
                        { code: 'DP1', label: 'Plan de situation', icon: '🗺️' },
                        { code: 'DP2', label: 'Plan de masse', icon: '📐' },
                        { code: 'DP4', label: 'Notice descriptive', icon: '📝' },
                        { code: 'DP5', label: 'Plans des façades', icon: '🎨' },
                        { code: 'DP6', label: 'Insertion graphique', icon: '🖼️' },
                        { code: 'DP7', label: 'Vue proche', icon: '📷' },
                        { code: 'DP8', label: 'Vue lointaine', icon: '🌄' },
                    ].map((doc) => (
                        <div key={doc.code} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                            <div className="text-2xl mb-2">{doc.icon}</div>
                            <div className="text-blue-400 font-bold text-sm">{doc.code}</div>
                            <div className="text-slate-400 text-xs mt-1">{doc.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-6 text-center text-slate-500 text-sm">
                Données traitées localement · Aucune information transmise à des tiers
            </footer>
        </div>
    )
}
