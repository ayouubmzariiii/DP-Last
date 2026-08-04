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

            <main style={{ flex: 1 }}>
                {/* Fil d'Ariane SANS bandeau : une bande pleine largeur d'une autre
                    teinte coupait la page en deux juste sous l'en-tête. Il est ici
                    posé dans le flux du contenu, aligné au même conteneur (1160 /
                    28px) que l'en-tête et les sections — d'où l'alignement exact
                    avec le titre. */}
                {breadcrumb && breadcrumb.length > 0 && (
                    <nav
                        aria-label="Fil d'Ariane"
                        className="dp-crumbs"
                        style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 28px 14px', display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', fontFamily: 'var(--mf)', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase' }}
                    >
                        {breadcrumb.map((b, i) => (
                            <span key={i} style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                                {i > 0 && <span aria-hidden style={{ color: 'var(--faint)' }}>›</span>}
                                {b.href
                                    ? <Link href={b.href} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{b.label}</Link>
                                    : <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{b.label}</span>}
                            </span>
                        ))}
                    </nav>
                )}
                {children}
            </main>

            <SiteFooter prefix="/" />
        </div>
    )
}
