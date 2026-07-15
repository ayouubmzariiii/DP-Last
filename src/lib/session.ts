// ─────────────────────────────────────────────────────────────────────────────
// Session tokens — EDGE-SAFE. This module imports ONLY `jose` so it can run in
// middleware.ts (edge runtime). Do NOT add bcryptjs / drizzle / neon imports here.
// ─────────────────────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from 'jose'

export const COOKIE_NAME = 'dp_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days (seconds)

export type UserRole = 'user' | 'admin'

export interface SessionPayload {
    userId: string
    email: string
    // Absent from tokens minted before the admin feature → treated as 'user'. The middleware
    // trusts this claim for routing only; /api/admin routes RE-CHECK the role in DB.
    role: UserRole
}

function key(): Uint8Array {
    const secret = process.env.AUTH_SECRET
    if (!secret) throw new Error('AUTH_SECRET is not set')
    return new TextEncoder().encode(secret)
}

export async function createSessionToken(payload: SessionPayload | Omit<SessionPayload, 'role'>): Promise<string> {
    const role: UserRole = 'role' in payload && payload.role === 'admin' ? 'admin' : 'user'
    return new SignJWT({ userId: payload.userId, email: payload.email, role })
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
            // Legacy tokens (pre-admin) have no role claim → 'user'.
            return { userId: payload.userId, email: payload.email, role: payload.role === 'admin' ? 'admin' : 'user' }
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
