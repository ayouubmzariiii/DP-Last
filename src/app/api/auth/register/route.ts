import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { hashPassword, createSessionToken, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

// A real identity is required at signup — it feeds the Étape 1 pre-fill AND billing/
// invoicing. French phone: 10 digits (spaces/dots/+33 tolerated); postal code: 5 digits.
const phoneRe = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/
const schema = z.object({
    firstName: z.string().trim().min(1, 'Le prénom est requis.').max(80),
    lastName: z.string().trim().min(1, 'Le nom est requis.').max(80),
    email: z.string().trim().email('Adresse email invalide.'),
    phone: z.string().trim().regex(phoneRe, 'Numéro de téléphone invalide (ex : 06 12 34 56 78).'),
    address: z.string().trim().min(4, 'L’adresse est requise.').max(200),
    postalCode: z.string().trim().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres).'),
    city: z.string().trim().min(1, 'La ville est requise.').max(120),
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

    const d = parsed.data
    const email = d.email.toLowerCase().trim()
    try {
        const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
        if (existing.length) return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 })

        const passwordHash = await hashPassword(d.password)
        const fullName = `${d.firstName} ${d.lastName}`.trim()
        const [user] = await db.insert(users).values({
            email, passwordHash, fullName,
            firstName: d.firstName, lastName: d.lastName,
            phone: d.phone, address: d.address, postalCode: d.postalCode, city: d.city,
        }).returning({ id: users.id, email: users.email })

        const token = await createSessionToken({ userId: user.id, email: user.email })
        const res = NextResponse.json({ user }, { status: 201 })
        res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
        return res
    } catch (err) {
        console.error('[auth/register] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors de la création du compte.' }, { status: 500 })
    }
}
