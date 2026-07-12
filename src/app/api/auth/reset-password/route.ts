import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, users } from '@/lib/db'
import { hashPassword, createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const schema = z.object({
    email: z.string().email(),
    token: z.string().min(32),
    newPassword: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères.'),
})

// POST /api/auth/reset-password — consumes a valid, non-expired reset token, sets the
// new password and signs the user straight in.
export async function POST(req: NextRequest) {
    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Données invalides.',
            issues: parsed.error.issues.map(i => i.message),
        }, { status: 422 })
    }

    const email = parsed.data.email.toLowerCase().trim()
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')

    const [user] = await db.select({ id: users.id, resetTokenExpires: users.resetTokenExpires })
        .from(users)
        .where(and(eq(users.email, email), eq(users.resetTokenHash, tokenHash)))
        .limit(1)

    if (!user || !user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré. Refaites une demande.' }, { status: 400 })
    }

    await db.update(users).set({
        passwordHash: await hashPassword(parsed.data.newPassword),
        resetTokenHash: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
    }).where(eq(users.id, user.id))

    const token = await createSessionToken({ userId: user.id, email })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
    return res
}
