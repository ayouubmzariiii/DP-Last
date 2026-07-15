import { NextRequest, NextResponse } from 'next/server'
import { sql, desc, eq, ilike, or, and, isNotNull } from 'drizzle-orm'
import { db, users, dossiers } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

// GET /api/admin/dossiers?q=&status=&page= — tous les dossiers, tous comptes confondus.
// `summary` (dénormalisé) suffit pour l'inspection — on ne charge JAMAIS le jsonb `data`
// complet en liste (photos/plans en Blob URLs, potentiellement lourd).
export async function GET(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || ''       // '', 'draft', 'complete', 'submitted', 'accepted', 'rejected'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)

    const conds = []
    if (q) conds.push(or(ilike(dossiers.title, `%${q}%`), ilike(dossiers.clientName, `%${q}%`), ilike(users.email, `%${q}%`)))
    if (status === 'draft' || status === 'complete') conds.push(eq(dossiers.status, status))
    else if (status === 'submitted') conds.push(isNotNull(dossiers.submittedAt))
    else if (status === 'accepted' || status === 'rejected') conds.push(eq(dossiers.decision, status))
    const filter = conds.length ? and(...conds) : undefined

    const base = db.select({
        id: dossiers.id,
        title: dossiers.title,
        clientName: dossiers.clientName,
        status: dossiers.status,
        lastStep: dossiers.lastStep,
        decision: dossiers.decision,
        submittedAt: dossiers.submittedAt,
        billedAt: dossiers.billedAt,
        archivedAt: dossiers.archivedAt,
        createdAt: dossiers.createdAt,
        updatedAt: dossiers.updatedAt,
        summary: dossiers.summary,
        userId: users.id,
        email: users.email,
    }).from(dossiers).innerJoin(users, eq(dossiers.userId, users.id))

    const countBase = db.select({ total: sql<number>`count(*)::int` }).from(dossiers).innerJoin(users, eq(dossiers.userId, users.id))

    const [rows, [{ total }]] = await Promise.all([
        (filter ? base.where(filter) : base).orderBy(desc(dossiers.updatedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
        filter ? countBase.where(filter) : countBase,
    ])

    return NextResponse.json({ dossiers: rows, total, page, pageSize: PAGE_SIZE })
}
