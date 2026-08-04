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
    // Pages publiques indexables : guides SEO par travaux/commune et recrutement
    // de testeurs. Elles doivent être atteignables sans compte (et par les robots).
    if (pathname === '/dp' || pathname.startsWith('/dp/')) return true
    if (pathname === '/beta') return true
    // Collecte anonyme : entonnoir, retours utilisateurs, candidatures testeurs.
    // Ces routes n'exposent aucune donnée en lecture — elles n'acceptent que POST.
    if (pathname === '/api/events' || pathname === '/api/feedback' || pathname === '/api/beta') return true
    // Dev-only test harness (self-guards against production); keep it usable without a session in dev.
    if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/api/dev/')) return true
    return false
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl
    if (isPublic(pathname)) return NextResponse.next()

    const session = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value)

    // Back-office : réservé au rôle admin. Le claim JWT suffit pour le ROUTAGE (UX) ;
    // chaque route /api/admin re-vérifie le rôle en base (source de vérité).
    if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
        if (session?.role === 'admin') return NextResponse.next()
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: session ? 'Accès réservé aux administrateurs.' : 'Non authentifié.' }, { status: session ? 403 : 401 })
        }
        const url = req.nextUrl.clone()
        if (session) { url.pathname = '/profil'; url.search = '' }           // connecté mais pas admin
        else { url.pathname = '/login'; url.search = ''; url.searchParams.set('next', pathname) }
        return NextResponse.redirect(url)
    }

    if (session) return NextResponse.next()

    // Unauthenticated: JSON 401 for APIs, redirect to /login for pages.
    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + (search || ''))
    return NextResponse.redirect(url)
}
