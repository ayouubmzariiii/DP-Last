import { NextRequest, NextResponse } from 'next/server'
import { sql, desc, eq, ilike, or } from 'drizzle-orm'
import { db, users, dossiers, subscriptions } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

// GET /api/admin/users?q=&page= — annuaire des comptes avec plan actif et nb de dossiers.
export async function GET(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)

    const filter = q
        ? or(ilike(users.email, `%${q}%`), ilike(users.fullName, `%${q}%`), ilike(users.city, `%${q}%`))
        : undefined

    const base = db.select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        city: users.city,
        phone: users.phone,
        role: users.role,
        credits: users.credits,
        createdAt: users.createdAt,
        dossierCount: sql<number>`(select count(*) from ${dossiers} where ${dossiers.userId} = ${users.id})::int`,
        plan: subscriptions.plan,
        planStatus: subscriptions.status,
        quota: subscriptions.quota,
        used: subscriptions.used,
    }).from(users).leftJoin(subscriptions, eq(subscriptions.userId, users.id))

    const [rows, [{ total }]] = await Promise.all([
        (filter ? base.where(filter) : base).orderBy(desc(users.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
        db.select({ total: sql<number>`count(*)::int` }).from(users).where(filter ?? sql`true`),
    ])

    return NextResponse.json({ users: rows, total, page, pageSize: PAGE_SIZE })
}
