import { NextResponse } from 'next/server'
import { sql, desc, eq, gte } from 'drizzle-orm'
import { db, users, dossiers, subscriptions, payments } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/overview — les chiffres du tableau de bord (une seule requête par bloc).
export async function GET() {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000)

    const [
        [userStats],
        [dossierStats],
        [revenue],
        planRows,
        recentUsers,
        recentDossiers,
    ] = await Promise.all([
        db.select({
            total: sql<number>`count(*)::int`,
            admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
            new30d: sql<number>`count(*) filter (where ${users.createdAt} >= ${since30d})::int`,
        }).from(users),
        db.select({
            total: sql<number>`count(*)::int`,
            drafts: sql<number>`count(*) filter (where ${dossiers.status} = 'draft')::int`,
            complete: sql<number>`count(*) filter (where ${dossiers.status} = 'complete')::int`,
            submitted: sql<number>`count(*) filter (where ${dossiers.submittedAt} is not null)::int`,
            accepted: sql<number>`count(*) filter (where ${dossiers.decision} = 'accepted')::int`,
            rejected: sql<number>`count(*) filter (where ${dossiers.decision} = 'rejected')::int`,
            archived: sql<number>`count(*) filter (where ${dossiers.archivedAt} is not null)::int`,
            new30d: sql<number>`count(*) filter (where ${dossiers.createdAt} >= ${since30d})::int`,
        }).from(dossiers),
        db.select({
            totalCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
            count: sql<number>`count(*)::int`,
            cents30d: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.createdAt} >= ${since30d}), 0)::int`,
        }).from(payments).where(eq(payments.status, 'paid')),
        db.select({
            plan: subscriptions.plan,
            count: sql<number>`count(*)::int`,
        }).from(subscriptions).where(eq(subscriptions.status, 'active')).groupBy(subscriptions.plan),
        db.select({ id: users.id, email: users.email, fullName: users.fullName, city: users.city, createdAt: users.createdAt })
            .from(users).orderBy(desc(users.createdAt)).limit(6),
        db.select({
            id: dossiers.id, title: dossiers.title, status: dossiers.status, decision: dossiers.decision,
            updatedAt: dossiers.updatedAt, email: users.email,
        }).from(dossiers).innerJoin(users, eq(dossiers.userId, users.id)).orderBy(desc(dossiers.updatedAt)).limit(8),
    ])

    return NextResponse.json({
        users: userStats,
        dossiers: dossierStats,
        revenue,
        activePlans: planRows,
        recentUsers,
        recentDossiers,
    })
}
