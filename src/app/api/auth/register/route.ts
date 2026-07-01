import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { hashPassword, createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const schema = z.object({
    email: z.string().email('Adresse email invalide.'),
    password: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères.'),
})

export async function POST(req: NextRequest) {
    // Fail fast & clearly if the server is misconfigured — BEFORE inserting a user we couldn't
    // then issue a session for (which would leave an orphan row that blocks the email with 409).
    if (!process.env.AUTH_SECRET) {
        return NextResponse.json({ error: 'Configuration serveur incomplète : AUTH_SECRET manquant. Contactez l’administrateur.' }, { status: 503 })
    }

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Données invalides.', issues: parsed.error.issues.map(i => i.message) }, { status: 422 })
    }

    const email = parsed.data.email.toLowerCase().trim()
    try {
        const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
        if (existing.length) return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 })

        const passwordHash = await hashPassword(parsed.data.password)
        const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email })

        const token = await createSessionToken({ userId: user.id, email: user.email })
        const res = NextResponse.json({ user }, { status: 201 })
        res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
        return res
    } catch (err) {
        console.error('[auth/register] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors de la création du compte.' }, { status: 500 })
    }
}
