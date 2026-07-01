// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers — NODE-ONLY (bcryptjs + next/headers). Safe for route handlers,
// NEVER for middleware.ts. Session-token primitives live in ./session (edge-safe).
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from './session'

export {
    COOKIE_NAME,
    SESSION_MAX_AGE,
    createSessionToken,
    verifySessionToken,
    sessionCookieOptions,
} from './session'
export type { SessionPayload } from './session'

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

/** Read & verify the session from the request cookies (for use inside route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
    const token = cookies().get(COOKIE_NAME)?.value
    return verifySessionToken(token)
}
