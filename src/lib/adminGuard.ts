// ─────────────────────────────────────────────────────────────────────────────
// Admin guard for /api/admin routes — NODE-ONLY (imports the Drizzle client).
//
// The middleware already filters on the JWT role claim (cheap, edge). This guard
// is the source of truth: it re-reads the role from the DATABASE, so a demoted
// admin's still-valid cookie stops working immediately, not at token expiry.
// ─────────────────────────────────────────────────────────────────────────────
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { getSession } from '@/lib/auth'

export interface AdminSession {
    userId: string
    email: string
}

/** Returns the admin session, or null when the caller isn't a (DB-verified) admin. */
export async function requireAdmin(): Promise<AdminSession | null> {
    const session = await getSession()
    if (!session) return null
    const [row] = await db.select({ role: users.role, email: users.email }).from(users).where(eq(users.id, session.userId)).limit(1)
    if (!row || row.role !== 'admin') return null
    return { userId: session.userId, email: row.email }
}
