import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { list, del } from '@vercel/blob'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hasInlineBase64Image } from '@/lib/dossierData'
import type { DPFormData } from '@/lib/models'

export const runtime = 'nodejs'

type Ctx = { params: { id: string } }

// GET /api/dossiers/[id] — full dossier (incl. data) if owned, else 404.
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [row] = await db.select().from(dossiers)
        .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId))).limit(1)
    if (!row) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    return NextResponse.json({ dossier: row })
}

// PUT /api/dossiers/[id] — save (autosave target). Rejects inline base64 images.
export async function PUT(req: NextRequest, { params }: Ctx) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: { data?: DPFormData; lastStep?: number; title?: string; status?: 'draft' | 'complete' }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const patch: Record<string, unknown> = { updatedAt: new Date() }

    // Full save (with dossier data) — reject inline base64 so rows stay small.
    if (body.data !== undefined) {
        if (typeof body.data !== 'object' || body.data === null) {
            return NextResponse.json({ error: 'Champ « data » invalide.' }, { status: 400 })
        }
        if (hasInlineBase64Image(body.data)) {
            return NextResponse.json({
                error: 'Images non téléversées : une image est encore en base64. Téléversez les images vers le stockage (Blob) avant l’enregistrement.',
                issues: ['Une image est stockée en data: URL au lieu d’une URL Blob.'],
            }, { status: 422 })
        }
        patch.data = body.data
    }
    if (typeof body.lastStep === 'number') patch.lastStep = body.lastStep
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
    if (body.status === 'draft' || body.status === 'complete') patch.status = body.status

    // Nothing meaningful to update (only the updatedAt bump).
    if (Object.keys(patch).length === 1) {
        return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const updated = await db.update(dossiers).set(patch)
        .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId)))
        .returning({ id: dossiers.id, updatedAt: dossiers.updatedAt })
    if (!updated.length) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    return NextResponse.json({ dossier: updated[0] })
}

// DELETE /api/dossiers/[id] — delete the row and best-effort purge its Blob folder.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [row] = await db.select({ id: dossiers.id }).from(dossiers)
        .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId))).limit(1)
    if (!row) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    // Best-effort blob cleanup — never block the row deletion on it.
    try {
        if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
            const { blobs } = await list({ prefix: `dossiers/${params.id}/` })
            if (blobs.length) await del(blobs.map(b => b.url))
        }
    } catch (e) {
        console.warn('[dossiers/delete] blob cleanup failed:', e)
    }

    await db.delete(dossiers).where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId)))
    return NextResponse.json({ ok: true })
}
