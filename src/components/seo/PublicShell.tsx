// Coquille des pages publiques indexables (/dp/**, /beta) : en-tête + pied de page
// autonomes, aux tokens du design system « Architect's Dossier ». Volontairement
// séparée de MarketingSite (page d'accueil) pour qu'aucune évolution SEO ne touche
// la landing existante.
import Link from 'next/link'
import Logo from '@/components/Logo'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'

export default function PublicShell({
    children,
    breadcrumb,
}: {
    children: React.ReactNode
    breadcrumb?: { label: string; href?: string }[]
}) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(241,236,227,.88)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
                        <Logo size={34} />
                        <span style={{ fontFamily: 'var(--hf)', fontWeight: 600, fontSize: 18, color: 'var(--ink)', letterSpacing: '-.01em' }}>DP Travaux</span>
                    </Link>
                    <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
                        <Link href="/dp" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>Guides</Link>
                        <Link href="/#how" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>Comment ça marche</Link>
                        <Link href="/#pricing" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>Tarifs</Link>
                        <Link href="/beta" className="dp-btn-primary" style={{ padding: '9px 18px', fontSize: 14, textDecoration: 'none' }}>Tester gratuitement</Link>
                    </nav>
                </div>
            </header>

            {breadcrumb && breadcrumb.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--line-2)', background: 'var(--surface-2)' }}>
                    <nav aria-label="Fil d'Ariane" style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontFamily: 'var(--mf)', fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        {breadcrumb.map((b, i) => (
                            <span key={i} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                                {i > 0 && <span aria-hidden style={{ color: 'var(--faint)' }}>/</span>}
                                {b.href ? <Link href={b.href} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{b.label}</Link> : <span style={{ color: 'var(--ink-2)' }}>{b.label}</span>}
                            </span>
                        ))}
                    </nav>
                </div>
            )}

            <main style={{ flex: 1 }}>{children}</main>

            <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', marginTop: 64 }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 20px 32px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32 }}>
                        <div>
                            <Logo size={32} />
                            <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 260 }}>
                                Le dossier complet de déclaration préalable, constitué à partir du PLU de votre commune.
                            </p>
                        </div>
                        <div>
                            <p className="dp-meta" style={{ marginBottom: 10 }}>Guides par travaux</p>
                            {SEO_TRAVAUX.slice(0, 6).map(t => (
                                <Link key={t.slug} href={`/dp/${t.slug}`} style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0' }}>{t.nom}</Link>
                            ))}
                        </div>
                        <div>
                            <p className="dp-meta" style={{ marginBottom: 10 }}>&nbsp;</p>
                            {SEO_TRAVAUX.slice(6).map(t => (
                                <Link key={t.slug} href={`/dp/${t.slug}`} style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0' }}>{t.nom}</Link>
                            ))}
                            <Link href="/dp" style={{ display: 'block', marginTop: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ac)', textDecoration: 'none', padding: '3px 0' }}>Tous les guides →</Link>
                        </div>
                        <div>
                            <p className="dp-meta" style={{ marginBottom: 10 }}>L&apos;application</p>
                            <Link href="/beta" style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0' }}>Programme de test</Link>
                            <Link href="/login" style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0' }}>Se connecter</Link>
                            <Link href="/register" style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none', padding: '3px 0' }}>Créer un compte</Link>
                        </div>
                    </div>
                    <p style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--line-2)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                        DP Travaux — assistance à la constitution de dossiers de déclaration préalable. Nous ne sommes ni un service de l&apos;État
                        ni un cabinet d&apos;architecture : le déclarant signe et reste responsable de sa déclaration.
                    </p>
                </div>
            </footer>
        </div>
    )
}
