import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { getSession, createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const PROFILE_COLS = {
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    phone: users.phone,
    language: users.language,
    emailNotifications: users.emailNotifications,
    createdAt: users.createdAt,
}

// GET /api/auth/me — the signed-in account, incl. its editable settings.
export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [row] = await db.select(PROFILE_COLS).from(users).where(eq(users.id, session.userId)).limit(1)
    if (!row) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    return NextResponse.json({ user: row })
}

const patchSchema = z.object({
    email: z.string().email('Adresse email invalide.').optional(),
    fullName: z.string().max(120).nullish(),
    phone: z.string().max(40).nullish(),
    language: z.enum(['fr', 'en']).optional(),
    emailNotifications: z.boolean().optional(),
})

// PATCH /api/auth/me — update the account's profile / settings. Re-issues the
// session cookie when the email changes (the JWT carries the email).
export async function PATCH(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Données invalides.', issues: parsed.error.issues.map(i => i.message) }, { status: 422 })
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    const d = parsed.data
    let nextEmail: string | undefined
    if (d.email !== undefined) {
        nextEmail = d.email.toLowerCase().trim()
        // Reject if another account already uses this email.
        const clash = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.email, nextEmail), ne(users.id, session.userId))).limit(1)
        if (clash.length) return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 })
        patch.email = nextEmail
    }
    if (d.fullName !== undefined) patch.fullName = d.fullName?.trim() || null
    if (d.phone !== undefined) patch.phone = d.phone?.trim() || null
    if (d.language !== undefined) patch.language = d.language
    if (d.emailNotifications !== undefined) patch.emailNotifications = d.emailNotifications

    if (Object.keys(patch).length === 1) {
        return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    try {
        const [row] = await db.update(users).set(patch).where(eq(users.id, session.userId)).returning(PROFILE_COLS)
        if (!row) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

        const res = NextResponse.json({ user: row })
        // Keep the session token in sync with the (possibly) new email.
        if (nextEmail && nextEmail !== session.email) {
            const token = await createSessionToken({ userId: session.userId, email: nextEmail })
            res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
        }
        return res
    } catch (err) {
        console.error('[auth/me PATCH] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors de la mise à jour.' }, { status: 500 })
    }
}
