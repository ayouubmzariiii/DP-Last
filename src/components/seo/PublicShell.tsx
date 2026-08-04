// Coquille des pages publiques indexables (/dp/**). Elle ne définit plus son
// propre en-tête ni son propre pied de page : elle rend le chrome PARTAGÉ avec
// l'accueil (SiteChrome), pour que la navigation soit rigoureusement identique
// d'une page à l'autre. Elle n'ajoute qu'un fil d'Ariane.
//
// Le bouton principal reste en état visiteur : lire la session forcerait un
// rendu dynamique et ferait perdre le pré-rendu statique des milliers de guides.
import Link from 'next/link'
import { SiteHeader, SiteFooter, CHROME_CSS } from '@/components/SiteChrome'

export default function PublicShell({
    children,
    breadcrumb,
}: {
    children: React.ReactNode
    breadcrumb?: { label: string; href?: string }[]
}) {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
            <style dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />
            <SiteHeader prefix="/" />

            {breadcrumb && breadcrumb.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--line-2)', background: 'var(--surface-2)' }}>
                    <nav aria-label="Fil d'Ariane" style={{ maxWidth: 1160, margin: '0 auto', padding: '10px 28px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontFamily: 'var(--mf)', fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
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

            <SiteFooter prefix="/" />
        </div>
    )
}
