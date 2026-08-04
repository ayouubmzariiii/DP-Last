import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, feedback } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

// POST /api/feedback — le widget flottant, disponible partout dans l'app et sur
// les pages publiques. Fonctionne avec ou sans compte : un visiteur bloqué à
// l'étape 3 doit pouvoir le dire sans créer de compte.

const schema = z.object({
    category: z.enum(['bug', 'confus', 'manque', 'idee', 'autre']).default('autre'),
    message: z.string().trim().min(4, 'Décrivez le problème en quelques mots.').max(4000),
    rating: z.number().int().min(1).max(5).optional(),
    email: z.string().trim().email().max(180).optional().or(z.literal('')),
    path: z.string().trim().max(300).optional(),
    step: z.number().int().min(1).max(7).optional(),
    dossierId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.' }, { status: 422 })
    }

    const d = parsed.data
    const session = await getSession().catch(() => null)

    try {
        await db.insert(feedback).values({
            userId: session?.userId ?? null,
            // Un dossierId n'est retenu que pour un utilisateur connecté : la FK
            // pointe une ligne privée, et un anonyme n'a aucune raison d'en citer un.
            dossierId: session ? (d.dossierId ?? null) : null,
            category: d.category,
            rating: d.rating ?? null,
            message: d.message,
            email: d.email ? d.email.toLowerCase() : null,
            path: d.path ?? null,
            step: d.step ?? null,
            userAgent: (req.headers.get('user-agent') || '').slice(0, 400) || null,
        })
    } catch {
        return NextResponse.json({ error: 'Enregistrement impossible pour le moment.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
