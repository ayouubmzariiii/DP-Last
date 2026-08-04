import { NextRequest, NextResponse } from 'next/server'
import { sql, desc, eq, gte, and, inArray } from 'drizzle-orm'
import { db, feedback, events, users } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/growth?jours=30 — tout ce qui alimente l'onglet Croissance :
// entonnoir de l'assistant, retours utilisateurs, provenance du trafic.
//
// L'entonnoir compte des VISITEURS DISTINCTS (anon_id) par étape, pas des vues :
// un utilisateur qui revient trois fois sur l'étape 3 ne gonfle pas la marche.

const ETAPES: { path: string; label: string }[] = [
    { path: '/', label: 'Accueil' },
    { path: '/dp', label: 'Guides SEO' },
    { path: '/register', label: 'Inscription' },
    { path: '/etape/:id/1', label: 'Étape 1 — Déclarant' },
    { path: '/etape/:id/2', label: 'Étape 2 — Terrain' },
    { path: '/etape/:id/3', label: 'Étape 3 — Travaux' },
    { path: '/etape/:id/4', label: 'Étape 4 — PLU' },
    { path: '/etape/:id/5', label: 'Étape 5 — Plans' },
    { path: '/etape/:id/6', label: 'Étape 6 — Visuels' },
    { path: '/etape/:id/7', label: 'Étape 7 — Dossier' },
]

export async function GET(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const joursRaw = Number(req.nextUrl.searchParams.get('jours') || 30)
    const jours = Number.isFinite(joursRaw) && joursRaw > 0 && joursRaw <= 365 ? Math.floor(joursRaw) : 30
    const since = new Date(Date.now() - jours * 24 * 3600 * 1000)

    const [
        funnelRows,
        sourceRows,
        feedbackStats,
        feedbackRows,
        eventTotals,
    ] = await Promise.all([
        // Entonnoir — visiteurs distincts par page suivie.
        db.select({
            path: events.path,
            visiteurs: sql<number>`count(distinct coalesce(${events.anonId}, ${events.userId}::text))::int`,
            vues: sql<number>`count(*)::int`,
        })
            .from(events)
            .where(and(eq(events.name, 'page_view'), gte(events.createdAt, since), inArray(events.path, ETAPES.map(e => e.path))))
            .groupBy(events.path),

        // Provenance — d'où viennent les visiteurs (utm_source, sinon referrer).
        db.select({
            source: sql<string>`coalesce(nullif(${events.source}, ''), nullif(${events.referrer}, ''), 'direct')`,
            visiteurs: sql<number>`count(distinct coalesce(${events.anonId}, ${events.userId}::text))::int`,
        })
            .from(events)
            .where(and(eq(events.name, 'page_view'), gte(events.createdAt, since)))
            .groupBy(sql`coalesce(nullif(${events.source}, ''), nullif(${events.referrer}, ''), 'direct')`)
            .orderBy(desc(sql`count(distinct coalesce(${events.anonId}, ${events.userId}::text))`))
            .limit(12),

        db.select({
            total: sql<number>`count(*)::int`,
            ouverts: sql<number>`count(*) filter (where ${feedback.resolved} = false)::int`,
            bugs: sql<number>`count(*) filter (where ${feedback.category} = 'bug')::int`,
            periode: sql<number>`count(*) filter (where ${feedback.createdAt} >= ${since})::int`,
        }).from(feedback),

        db.select({
            id: feedback.id, category: feedback.category, message: feedback.message, rating: feedback.rating,
            email: feedback.email, path: feedback.path, step: feedback.step, resolved: feedback.resolved,
            createdAt: feedback.createdAt, userEmail: users.email,
        }).from(feedback).leftJoin(users, eq(feedback.userId, users.id)).orderBy(desc(feedback.createdAt)).limit(200),

        db.select({
            name: events.name,
            total: sql<number>`count(*)::int`,
        }).from(events).where(gte(events.createdAt, since)).groupBy(events.name).orderBy(desc(sql`count(*)`)),
    ])

    const byPath = new Map(funnelRows.map(r => [r.path, r]))
    const funnel = ETAPES.map(e => ({
        path: e.path,
        label: e.label,
        visiteurs: byPath.get(e.path)?.visiteurs ?? 0,
        vues: byPath.get(e.path)?.vues ?? 0,
    }))

    return NextResponse.json({
        jours,
        funnel,
        sources: sourceRows,
        events: eventTotals,
        feedback: { stats: feedbackStats[0], rows: feedbackRows },
    })
}

// PATCH /api/admin/growth — marque un retour utilisateur comme traité.
export async function PATCH(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const body = await req.json().catch(() => null) as { id: string; resolved: boolean } | null
    if (!body || !body.id) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

    await db.update(feedback).set({ resolved: !!body.resolved }).where(eq(feedback.id, body.id))
    return NextResponse.json({ ok: true })
}
