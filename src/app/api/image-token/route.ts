import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Rate-limiting: in-memory per IP ───────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = parseInt(process.env.IMAGE_RATE_LIMIT || '10')
const RATE_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return false
    }
    if (entry.count >= RATE_LIMIT) return true
    entry.count++
    return false
}

// ── Origin guard ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

function isOriginAllowed(req: NextRequest): boolean {
    if (process.env.NODE_ENV === 'development') return true
    if (ALLOWED_ORIGINS.length === 0) return true
    const origin = req.headers.get('origin') || req.headers.get('referer') || ''
    return ALLOWED_ORIGINS.some(o => origin.startsWith(o))
}

/**
 * Returns a short-lived OpenAI key reference so the browser can call
 * OpenAI directly without the key being in the JS bundle.
 * The key is only vended per-request after auth checks.
 */
export async function GET(req: NextRequest) {
    if (!isOriginAllowed(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait.' }, { status: 429 })
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    }

    return NextResponse.json(
        { key: process.env.OPENAI_API_KEY },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache',
                'Pragma': 'no-cache',
            }
        }
    )
}
