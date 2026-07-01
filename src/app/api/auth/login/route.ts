import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { verifyPassword, createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const schema = z.object({
    email: z.string().email('Adresse email invalide.'),
    password: z.string().min(1, 'Mot de passe requis.'),
})

export async function POST(req: NextRequest) {
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
        const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
        // Do not distinguish "unknown email" from "wrong password" — same 401.
        if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
            return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 })
        }

        const token = await createSessionToken({ userId: row.id, email: row.email })
        const res = NextResponse.json({ user: { id: row.id, email: row.email } }, { status: 200 })
        res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
        return res
    } catch (err) {
        console.error('[auth/login] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors de la connexion.' }, { status: 500 })
    }
}
