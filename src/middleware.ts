// ─────────────────────────────────────────────────────────────────────────────
// Edge auth gate. Runs on the EDGE runtime, so it may import ONLY edge-safe code:
// `@/lib/session` (jose). NEVER import bcryptjs / drizzle / @neondatabase here —
// it would break the edge build.
//
// Everything is gated except / (public landing), /login, /register, /api/auth/*,
// and static assets.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifySessionToken } from '@/lib/session'

export const config = {
    // Skip Next internals and any dotted static asset (e.g. /test/*.jpg, icon.svg).
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|test/|.*\\..*).*)'],
}

function isPublic(pathname: string): boolean {
    // Public marketing landing page (guests) — the page itself redirects authed users to /profil.
    if (pathname === '/') return true
    if (pathname === '/login' || pathname === '/register') return true
    if (pathname === '/mot-de-passe-oublie' || pathname === '/reinitialiser') return true
    if (pathname.startsWith('/api/auth/')) return true
    // Pages publiques indexables : guides SEO par travaux et par commune.
    // Elles doivent être atteignables sans compte (et par les robots).
    if (pathname === '/dp' || pathname.startsWith('/dp/')) return true
    // Collecte anonyme : entonnoir et retours utilisateurs.
    // Ces routes n'exposent aucune donnée en lecture — elles n'acceptent que POST.
    if (pathname === '/api/events' || pathname === '/api/feedback') return true
    // Aperçu public du livrable (CERFA + dossier DP) : c'est un argument commercial,
    // il doit s'ouvrir sans compte. La route ne lit AUCUNE donnée client — elle rend
    // le jeu d'essai figé, estampillé SPÉCIMEN.
    if (pathname === '/api/apercu') return true
    // Dev-only test harness (self-guards against production); keep it usable without a session in dev.
    if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/api/dev/')) return true
    return false
}

// ─── Indexation ──────────────────────────────────────────────────────────────
// Liste BLANCHE des pages destinées aux moteurs : l'accueil et les guides /dp.
// Tout le reste — espace client, assistant, back-office,
// API, écrans d'authentification — reçoit un en-tête X-Robots-Tag interdisant
// l'indexation.
//
// Pourquoi un en-tête et pas seulement robots.txt : robots.txt demande de ne pas
// EXPLORER, mais une URL citée ailleurs peut malgré tout être indexée « à vide ».
// X-Robots-Tag est la directive qui interdit l'indexation elle-même, et elle
// s'applique aussi aux réponses JSON des API, qui ne peuvent pas porter de balise
// meta. Les deux sont complémentaires, d'où la double protection.
function isIndexable(pathname: string): boolean {
    return pathname === '/' || pathname === '/dp' || pathname.startsWith('/dp/')
}

const NO_ROBOTS = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

/** Stampe l'interdiction d'indexation sur toute réponse hors liste blanche. */
function stamp(res: NextResponse, pathname: string): NextResponse {
    if (!isIndexable(pathname)) res.headers.set('X-Robots-Tag', NO_ROBOTS)
    return res
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl

    // /beta (ancienne page de recrutement de testeurs) a été retirée. Sans cette
    // règle, le chemin tomberait dans la garde d'authentification et renverrait
    // les visiteurs vers /login. Redirection permanente vers les guides : elle
    // conserve les liens entrants éventuels et mène quelque part d'utile.
    if (pathname === '/beta') {
        const url = req.nextUrl.clone()
        url.pathname = '/dp'
        url.search = ''
        return NextResponse.redirect(url, 308)
    }

    if (isPublic(pathname)) return stamp(NextResponse.next(), pathname)

    const session = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value)

    // Back-office : réservé au rôle admin. Le claim JWT suffit pour le ROUTAGE (UX) ;
    // chaque route /api/admin re-vérifie le rôle en base (source de vérité).
    if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
        if (session?.role === 'admin') return stamp(NextResponse.next(), pathname)
        if (pathname.startsWith('/api/')) {
            return stamp(NextResponse.json({ error: session ? 'Accès réservé aux administrateurs.' : 'Non authentifié.' }, { status: session ? 403 : 401 }), pathname)
        }
        const url = req.nextUrl.clone()
        if (session) { url.pathname = '/profil'; url.search = '' }           // connecté mais pas admin
        else { url.pathname = '/login'; url.search = ''; url.searchParams.set('next', pathname) }
        return stamp(NextResponse.redirect(url), pathname)
    }

    if (session) return stamp(NextResponse.next(), pathname)

    // Unauthenticated: JSON 401 for APIs, redirect to /login for pages.
    if (pathname.startsWith('/api/')) {
        return stamp(NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }), pathname)
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + (search || ''))
    return stamp(NextResponse.redirect(url), pathname)
}
