import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, events } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events — collecte d'entonnoir, best-effort.
//
// Deux principes non négociables :
//  1. On répond TOUJOURS 204, même en cas d'erreur d'écriture. Un problème de
//     mesure ne doit jamais dégrader un parcours utilisateur.
//  2. Aucune donnée personnelle : un identifiant anonyme de navigateur, un
//     chemin normalisé (les UUID de dossier sont remplacés par ':id' côté
//     client), et des propriétés en liste blanche.
// ─────────────────────────────────────────────────────────────────────────────

const NOM_MAX = 64
const schema = z.object({
    name: z.string().trim().min(1).max(NOM_MAX),
    anonId: z.string().trim().max(64).optional(),
    path: z.string().trim().max(300).optional(),
    referrer: z.string().trim().max(300).optional(),
    source: z.string().trim().max(80).optional(),
    campaign: z.string().trim().max(80).optional(),
    props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
})

const noContent = () => new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null)
        const parsed = schema.safeParse(body)
        if (!parsed.success) return noContent()

        const d = parsed.data
        // La session est optionnelle : les pages publiques (/dp, /beta) émettent
        // des événements anonymes, l'assistant des événements rattachés au compte.
        const session = await getSession().catch(() => null)

        await db.insert(events).values({
            name: d.name,
            anonId: d.anonId || null,
            userId: session?.userId ?? null,
            path: d.path || null,
            referrer: d.referrer || null,
            source: d.source || null,
            campaign: d.campaign || null,
            props: d.props ?? null,
        })
    } catch {
        // Silencieux par conception — voir l'en-tête du fichier.
    }
    return noContent()
}
