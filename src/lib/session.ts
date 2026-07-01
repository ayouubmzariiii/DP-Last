// ─────────────────────────────────────────────────────────────────────────────
// Session tokens — EDGE-SAFE. This module imports ONLY `jose` so it can run in
// middleware.ts (edge runtime). Do NOT add bcryptjs / drizzle / neon imports here.
// ─────────────────────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from 'jose'

export const COOKIE_NAME = 'dp_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days (seconds)

export interface SessionPayload {
    userId: string
    email: string
}

function key(): Uint8Array {
    const secret = process.env.AUTH_SECRET
    if (!secret) throw new Error('AUTH_SECRET is not set')
    return new TextEncoder().encode(secret)
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
    return new SignJWT({ userId: payload.userId, email: payload.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(key())
}

/** Verify a session JWT. Returns the payload, or null on any error (expired/tampered/absent). */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, key())
        if (typeof payload.userId === 'string' && typeof payload.email === 'string') {
            return { userId: payload.userId, email: payload.email }
        }
        return null
    } catch {
        return null
    }
}

/** Cookie flags shared by every auth response. */
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: SESSION_MAX_AGE,
    }
}
