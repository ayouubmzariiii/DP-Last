import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { list, del } from '@vercel/blob'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { hasInlineBase64Image } from '@/lib/dossierData'
import { summarizeDossier } from '@/lib/dossierSummary'
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

    let body: {
        data?: DPFormData; lastStep?: number; title?: string; status?: 'draft' | 'complete'
        clientName?: string | null
        archived?: boolean
        submittedAt?: string | null
        decision?: 'accepted' | 'rejected' | null
        numeroDp?: string | null
        affichageAt?: string | null
    }
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
        // Keep the denormalized dashboard summary in sync with every data save.
        const s = summarizeDossier(body.data)
        patch.summary = s
        // Auto-title: while the title is still a default ("Nouveau dossier" or the landing
        // "Projet — …" seed), name the project from what we now know — never overwrites a
        // title the user chose themselves.
        if (body.title === undefined && (s.summary.worksType || s.summary.address)) {
            const [cur] = await db.select({ title: dossiers.title }).from(dossiers)
                .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId))).limit(1)
            if (!cur) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })
            if (cur.title === 'Nouveau dossier' || cur.title.startsWith('Projet — ')) {
                const auto = [s.summary.worksType || 'Projet', s.summary.address].filter(Boolean).join(' — ').slice(0, 120)
                if (auto && auto !== cur.title) patch.title = auto
            }
        }
    }
    if (typeof body.lastStep === 'number') patch.lastStep = body.lastStep
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
    if (body.status === 'draft' || body.status === 'complete') patch.status = body.status

    // Nom du client (usage pro) — chaîne vide ou null pour effacer.
    if (body.clientName !== undefined) {
        patch.clientName = (typeof body.clientName === 'string' && body.clientName.trim())
            ? body.clientName.trim().slice(0, 120) : null
    }
    // Archivage doux.
    if (typeof body.archived === 'boolean') patch.archivedAt = body.archived ? new Date() : null
    // Dépôt en mairie : date ISO pour marquer, null pour annuler (efface aussi la décision et le
    // suivi qui en découle — n° d'enregistrement et affichage n'ont plus de sens sans dépôt).
    if (body.submittedAt !== undefined) {
        if (body.submittedAt === null) {
            patch.submittedAt = null; patch.decision = null; patch.decisionAt = null
            patch.numeroDp = null; patch.affichageAt = null
        } else if (typeof body.submittedAt === 'string' && !Number.isNaN(Date.parse(body.submittedAt))) {
            patch.submittedAt = new Date(body.submittedAt)
        } else {
            return NextResponse.json({ error: 'Champ « submittedAt » invalide.' }, { status: 400 })
        }
    }
    // Décision de la mairie — null pour revenir à "en instruction".
    if (body.decision !== undefined) {
        if (body.decision === 'accepted' || body.decision === 'rejected') {
            patch.decision = body.decision; patch.decisionAt = new Date()
        } else if (body.decision === null) {
            patch.decision = null; patch.decisionAt = null
        } else {
            return NextResponse.json({ error: 'Champ « decision » invalide.' }, { status: 400 })
        }
    }
    // N° d'enregistrement de la DP (récépissé de dépôt) — chaîne vide ou null pour effacer.
    if (body.numeroDp !== undefined) {
        patch.numeroDp = (typeof body.numeroDp === 'string' && body.numeroDp.trim())
            ? body.numeroDp.trim().slice(0, 40) : null
    }
    // Premier jour d'affichage du panneau sur le terrain — null pour effacer.
    if (body.affichageAt !== undefined) {
        if (body.affichageAt === null) {
            patch.affichageAt = null
        } else if (typeof body.affichageAt === 'string' && !Number.isNaN(Date.parse(body.affichageAt))) {
            patch.affichageAt = new Date(body.affichageAt)
        } else {
            return NextResponse.json({ error: 'Champ « affichageAt » invalide.' }, { status: 400 })
        }
    }

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
