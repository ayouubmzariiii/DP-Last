import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { getSession, verifyPassword, hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

const schema = z.object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
    newPassword: z.string().min(8, 'Le nouveau mot de passe doit comporter au moins 8 caractères.'),
})

// POST /api/auth/change-password — verify the current password, then set a new one.
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Données invalides.', issues: parsed.error.issues.map(i => i.message) }, { status: 422 })
    }

    try {
        const [row] = await db.select({ passwordHash: users.passwordHash }).from(users)
            .where(eq(users.id, session.userId)).limit(1)
        if (!row) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

        const ok = await verifyPassword(parsed.data.currentPassword, row.passwordHash)
        if (!ok) return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 403 })

        const passwordHash = await hashPassword(parsed.data.newPassword)
        await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, session.userId))

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[auth/change-password] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors du changement de mot de passe.' }, { status: 500 })
    }
}
