// ─────────────────────────────────────────────────────────────────────────────
// Edge auth gate. Runs on the EDGE runtime, so it may import ONLY edge-safe code:
// `@/lib/session` (jose). NEVER import bcryptjs / drizzle / @neondatabase here —
// it would break the edge build.
//
// Everything is gated except /login, /register, /api/auth/*, and static assets.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifySessionToken } from '@/lib/session'

export const config = {
    // Skip Next internals and any dotted static asset (e.g. /test/*.jpg, icon.svg).
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|test/|.*\\..*).*)'],
}

function isPublic(pathname: string): boolean {
    if (pathname === '/login' || pathname === '/register') return true
    if (pathname.startsWith('/api/auth/')) return true
    // Dev-only test harness (self-guards against production); keep it usable without a session in dev.
    if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/api/dev/')) return true
    return false
}

export async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl
    if (isPublic(pathname)) return NextResponse.next()

    const session = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value)
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
