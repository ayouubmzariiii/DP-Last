import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { emptyFormData } from '@/lib/models'

export const runtime = 'nodejs'

// GET /api/dossiers — list the current user's dossiers (metadata only, never `data`).
export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const rows = await db
        .select({
            id: dossiers.id, title: dossiers.title, status: dossiers.status,
            lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
        })
        .from(dossiers)
        .where(eq(dossiers.userId, session.userId))
        .orderBy(desc(dossiers.updatedAt))

    return NextResponse.json({ dossiers: rows })
}

// POST /api/dossiers — create a new (empty) dossier for the current user.
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: { title?: string } = {}
    try { body = await req.json() } catch { /* empty body is fine */ }
    const title = (typeof body.title === 'string' && body.title.trim()) ? body.title.trim().slice(0, 120) : 'Nouveau dossier'

    const [row] = await db.insert(dossiers).values({
        userId: session.userId,
        title,
        data: emptyFormData,
        status: 'draft',
        lastStep: 1,
    }).returning({
        id: dossiers.id, title: dossiers.title, status: dossiers.status,
        lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
    })

    return NextResponse.json({ dossier: row }, { status: 201 })
}
