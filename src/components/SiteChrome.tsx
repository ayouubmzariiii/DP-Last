// ─────────────────────────────────────────────────────────────────────────────
// En-tête et pied de page COMMUNS à toutes les pages publiques : l'accueil
// (MarketingSite) et les guides /dp (PublicShell) rendent exactement le même
// markup, la même navigation et les mêmes styles.
//
// Les styles sont portés par le composant lui-même et scopés sur [data-chrome],
// et non sur #site : ils s'appliquent donc identiquement quelle que soit la page
// hôte. C'est ce qui garantit qu'un changement de menu ne peut plus diverger
// entre l'accueil et les guides.
//
// Les ancres (#how, #pricing, #faq, #contact) n'existent que sur l'accueil : le
// paramètre `prefix` vaut '' sur l'accueil (défilement doux en place) et '/'
// ailleurs (navigation vers l'accueil puis défilement).
// ─────────────────────────────────────────────────────────────────────────────

export const CHROME_CSS = `
[data-chrome] [data-nav]:hover{color:var(--ac)!important}
@media (max-width:820px){ [data-chrome] [data-nav-center]{display:none!important} }
@media (max-width:640px){ [data-chrome] [data-foot]{justify-content:flex-start!important} }
@media (max-width:560px){
  [data-chrome] [data-head]{padding-left:16px!important;padding-right:16px!important;gap:12px!important}
  [data-chrome] [data-logosub]{display:none!important}
  [data-chrome] [data-signin]{display:none!important}
}
@media (max-width:400px){ [data-chrome] [data-logotext]{display:none!important} }
`

/** Marque « dp » — même dégradé et mêmes proportions partout. */
function Mark({ size = 40 }: { size?: number }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            width: size, height: size, borderRadius: Math.round(size * 0.275),
            background: 'linear-gradient(155deg,var(--ac),var(--acd))',
            boxShadow: size >= 40 ? '0 6px 16px -8px rgba(45,90,76,.6)' : undefined,
            flexShrink: 0,
        }}>
            <span style={{ fontFamily: 'var(--hf)', fontWeight: 600, fontSize: size * 0.475, lineHeight: 1, letterSpacing: '-.03em', color: '#fff' }}>dp</span>
            <span style={{ width: size * 0.35, height: 1.5, borderRadius: 2, background: 'rgba(255,255,255,.5)' }} />
        </div>
    )
}

const navLink: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', transition: 'color .15s', textDecoration: 'none' }
const footLink: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none' }

export interface ChromeProps {
    /** '' sur l'accueil (ancres locales), '/' sur les autres pages. */
    prefix?: '' | '/'
    /** Bascule le bouton principal vers « Mon espace ». Toujours faux sur les
     *  pages statiques /dp, qui ne lisent pas la session pour rester pré-rendues. */
    authed?: boolean
}

export function SiteHeader({ prefix = '/', authed = false }: ChromeProps) {
    return (
        <header data-chrome style={{ position: 'sticky', top: 0, zIndex: 60, background: 'rgba(241,236,227,.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--line)' }}>
            <div data-head style={{ maxWidth: 1160, margin: '0 auto', padding: '13px 28px', display: 'flex', alignItems: 'center', gap: 22 }}>
                <a href={`${prefix}#top`} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, textDecoration: 'none' }}>
                    <Mark size={40} />
                    <div data-logotext style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, lineHeight: 1.05, color: 'var(--ink)' }}>DP Travaux</div>
                        <div data-logosub style={{ fontFamily: 'var(--mf)', fontSize: 9.5, letterSpacing: '.09em', color: 'var(--muted)', textTransform: 'uppercase' }}>Déclaration préalable</div>
                    </div>
                </a>
                <nav data-nav-center style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
                    <a data-nav href={`${prefix}#how`} style={navLink}>Comment ça marche</a>
                    <a data-nav href="/dp" style={navLink}>Guides</a>
                    <a data-nav href={`${prefix}#pricing`} style={navLink}>Tarifs</a>
                    <a data-nav href={`${prefix}#faq`} style={navLink}>FAQ</a>
                    <a data-nav href={`${prefix}#contact`} style={navLink}>Contact</a>
                </nav>
                <div data-headcta style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginLeft: 'auto' }}>
                    {authed ? (
                        <a href="/profil" className="dp-btn-primary" style={{ padding: '10px 20px', fontSize: 14, textDecoration: 'none' }}>Mon espace</a>
                    ) : (
                        <>
                            <a href="/login" data-nav data-signin style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', transition: 'color .15s', textDecoration: 'none' }}>Se connecter</a>
                            <a href="/register" className="dp-btn-primary" style={{ padding: '10px 20px', fontSize: 14, textDecoration: 'none' }}>Commencer</a>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}

export function SiteFooter({ prefix = '/' }: ChromeProps) {
    return (
        <footer data-chrome style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)' }}>
            <div data-foot style={{ maxWidth: 1160, margin: '0 auto', padding: '44px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Mark size={36} />
                    <div>
                        <div style={{ fontFamily: 'var(--hf)', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>DP Travaux</div>
                        <div style={{ fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.06em', color: 'var(--muted)' }}>Service privé, non affilié à l&apos;administration</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
                    <a data-nav href={`${prefix}#how`} style={footLink}>Comment ça marche</a>
                    <a data-nav href="/dp" style={footLink}>Guides par travaux</a>
                    <a data-nav href={`${prefix}#pricing`} style={footLink}>Tarifs</a>
                    <a data-nav href={`${prefix}#faq`} style={footLink}>FAQ</a>
                    <a data-nav href="/login" style={footLink}>Se connecter</a>
                </div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-2)' }}>
                <div style={{ maxWidth: 1160, margin: '0 auto', padding: '16px 28px', fontFamily: 'var(--mf)', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--faint)' }}>
                    © 2026 DP Travaux — Déclaration préalable de travaux en ligne.
                </div>
            </div>
        </footer>
    )
}
