import Link from 'next/link'
import SealIcon from '@/components/SealIcon'

const STEPS = [
    { num: '01', label: 'Demandeur' },
    { num: '02', label: 'Terrain' },
    { num: '03', label: 'Travaux' },
    { num: '04', label: 'Analyse PLU' },
    { num: '05', label: 'Photos' },
    { num: '06', label: 'Plans' },
    { num: '07', label: 'Génération' },
]

const WORK_TYPES = [
    {
        title: 'Menuiseries',
        desc: 'Changement de fenêtres, portes et volets avec spécifications techniques.',
        icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /><path d="M12 3v18" /></>,
    },
    {
        title: 'Isolation extérieure',
        desc: 'ITE avec enduit ou bardage (bois, métal, composite) et couleur de finition.',
        icon: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
    },
    {
        title: 'Panneaux photovoltaïques',
        desc: 'Installation de panneaux PV en toiture : puissance et orientation.',
        icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
    },
]

const DOCS = [
    { code: 'CERFA', label: '13703* — Formulaire officiel' },
    { code: 'DP1', label: 'Plan de situation' },
    { code: 'DP2', label: 'Plan de masse' },
    { code: 'DP4', label: 'Notice descriptive' },
    { code: 'DP5', label: 'Plans des façades' },
    { code: 'DP6', label: 'Insertion graphique' },
    { code: 'DP7', label: 'Vue proche' },
    { code: 'DP8', label: 'Vue lointaine' },
]

export default function HomePage() {
    return (
        <div className="min-h-screen" style={{ background: '#F1ECE3', color: '#25221E' }}>
            {/* Header */}
            <header style={{ borderBottom: '1px solid #E3DCCF', background: 'rgba(250,247,241,.7)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 40 }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '20px 32px' }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center text-white" style={{ width: 38, height: 38, borderRadius: 10, background: '#2D5A4C', boxShadow: '0 6px 16px -8px rgba(45,90,76,.6)' }}><SealIcon size={21} stroke="#fff" strokeWidth={1.5} /></div>
                        <div style={{ fontFamily: "var(--hf)", fontSize: 18, fontWeight: 600, letterSpacing: '.01em' }}>DP Travaux</div>
                    </div>
                    <div style={{ fontFamily: "var(--mf)", fontSize: 12, letterSpacing: '.06em', color: '#7A7468', textTransform: 'uppercase' }}>Dossier CERFA 13703*</div>
                </div>
            </header>

            {/* Hero */}
            <section style={{ maxWidth: 860, margin: '0 auto', padding: '88px 32px 52px', textAlign: 'center' }} className="animate-fadeIn">
                <div className="inline-flex items-center gap-2.5 mb-8" style={{ padding: '7px 16px', borderRadius: 100, background: '#E8F0EC', border: '1px solid #CFE0D8', color: '#2D5A4C', fontSize: 12.5, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2D5A4C' }} />
                    Générateur assisté par IA — Déclaration Préalable de Travaux
                </div>
                <h1 style={{ fontFamily: "var(--hf)", fontWeight: 500, fontSize: 60, lineHeight: 1.04, letterSpacing: '-.01em', margin: '0 0 26px' }}>
                    Votre dossier DP complet,<br /><span style={{ color: '#2D5A4C', fontStyle: 'italic' }}>en quelques minutes.</span>
                </h1>
                <p style={{ maxWidth: 600, margin: '0 auto 38px', fontSize: 17, lineHeight: 1.65, color: '#5C564C' }}>
                    Un parcours guidé qui vérifie les règles d'urbanisme de votre parcelle et génère le <strong style={{ color: '#25221E', fontWeight: 600 }}>CERFA 13703*</strong> ainsi que les pièces obligatoires <strong style={{ color: '#25221E', fontWeight: 600 }}>(DP1 à DP8)</strong> pour votre dépôt en mairie.
                </p>
                <Link href="/etape/1" className="inline-flex items-center gap-3" style={{ padding: '17px 32px', borderRadius: 13, background: '#2D5A4C', color: '#fff', fontSize: 16, fontWeight: 600, boxShadow: '0 12px 30px -12px rgba(45,90,76,.55)' }}>
                    Commencer mon dossier
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </Link>
                <div className="flex items-center justify-center gap-5 mt-6" style={{ fontSize: 13, color: '#8A8378', fontFamily: "var(--mf)", letterSpacing: '.03em' }}>
                    <span>Gratuit</span><span style={{ opacity: .4 }}>/</span><span>Rapide</span><span style={{ opacity: .4 }}>/</span><span>100% confidentiel</span>
                </div>
            </section>

            {/* 7-step preview */}
            <section style={{ maxWidth: 1120, margin: '0 auto', padding: '8px 32px' }}>
                <div className="flex items-stretch justify-center flex-wrap">
                    {STEPS.map((s, i) => (
                        <div key={s.num} className="flex items-center">
                            <div className="flex flex-col items-center gap-2 text-center" style={{ width: 96 }}>
                                <div className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '1px solid #E0D9CC', color: '#2D5A4C', fontFamily: "var(--mf)", fontSize: 13, fontWeight: 600 }}>{s.num}</div>
                                <span style={{ fontSize: 11.5, color: '#7A7468', lineHeight: 1.3 }}>{s.label}</span>
                            </div>
                            {i < STEPS.length - 1 && <div style={{ width: 22, height: 1, background: '#DAD2C4', margin: '0 2px', alignSelf: 'flex-start', marginTop: 17 }} />}
                        </div>
                    ))}
                </div>
            </section>

            {/* Work types */}
            <section style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 32px 8px' }}>
                <div className="text-center mb-8"><span style={{ fontFamily: "var(--mf)", fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9A9286' }}>Types de travaux couverts</span></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {WORK_TYPES.map((w) => (
                        <div key={w.title} style={{ background: '#fff', border: '1px solid #E5DFD5', borderRadius: 16, padding: 30, boxShadow: '0 1px 2px rgba(37,34,30,.03),0 14px 32px -22px rgba(37,34,30,.2)' }}>
                            <div className="flex items-center justify-center mb-4" style={{ width: 46, height: 46, borderRadius: 12, background: '#E8F0EC', color: '#2D5A4C' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{w.icon}</svg>
                            </div>
                            <h3 style={{ fontFamily: "var(--hf)", fontSize: 21, fontWeight: 600, margin: '0 0 8px' }}>{w.title}</h3>
                            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#6B655B', margin: 0 }}>{w.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Documents */}
            <section style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 32px 72px' }}>
                <div className="text-center mb-8"><span style={{ fontFamily: "var(--mf)", fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9A9286' }}>Documents générés automatiquement</span></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    {DOCS.map((d) => (
                        <div key={d.code} style={{ background: '#FAF7F1', border: '1px solid #E5DFD5', borderRadius: 13, padding: '20px 18px' }}>
                            <div style={{ fontFamily: "var(--mf)", fontSize: 13, fontWeight: 600, letterSpacing: '.04em', color: '#2D5A4C', marginBottom: 6 }}>{d.code}</div>
                            <div style={{ fontSize: 13.5, color: '#6B655B', lineHeight: 1.45 }}>{d.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid #E3DCCF', padding: '26px 32px', textAlign: 'center' }}>
                <div className="inline-flex items-center gap-2.5" style={{ fontSize: 13, color: '#8A8378' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
                    Données traitées localement · Aucune information transmise à des tiers
                </div>
            </footer>
        </div>
    )
}
