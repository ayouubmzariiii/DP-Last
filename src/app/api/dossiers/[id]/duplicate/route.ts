import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { summarizeDossier } from '@/lib/dossierSummary'
import { emptyFormData, DPFormData } from '@/lib/models'

export const runtime = 'nodejs'
// Copying several multi-MB façade photos between Blob namespaces can take a while.
export const maxDuration = 120

type Ctx = { params: { id: string } }

// Duplication modes:
//  - 'full'    → identical copy of everything (photos, plans, simulations included).
//  - 'terrain' → same demandeur + terrain (PLU analysis kept), works/photos/plans reset —
//                the "several DPs on the same property" architect workflow.
type Mode = 'full' | 'terrain'

// ── Blob copy ────────────────────────────────────────────────────────────────
// Uploaded images live under `dossiers/<id>/…`; deleting a dossier purges that whole
// prefix. A duplicate must therefore own COPIES of the source's blobs, not references,
// or deleting the original would break the copy. We walk the cloned data, copy every
// blob that belongs to the source namespace, and rewrite the URLs.

function collectSourceBlobUrls(value: unknown, srcId: string, found: Set<string>) {
    if (typeof value === 'string') {
        if (value.startsWith('https://') && value.includes('.blob.vercel-storage.com/') && value.includes(`/dossiers/${srcId}/`)) {
            found.add(value)
        }
        return
    }
    if (Array.isArray(value)) { for (const v of value) collectSourceBlobUrls(v, srcId, found); return }
    if (value && typeof value === 'object') {
        for (const v of Object.values(value as Record<string, unknown>)) collectSourceBlobUrls(v, srcId, found)
    }
}

function rewriteUrls<T>(value: T, map: Map<string, string>): T {
    if (typeof value === 'string') return (map.get(value) ?? value) as unknown as T
    if (Array.isArray(value)) return value.map(v => rewriteUrls(v, map)) as unknown as T
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = rewriteUrls(v, map)
        return out as unknown as T
    }
    return value
}

async function copyBlobs(data: DPFormData, srcId: string, dstId: string): Promise<DPFormData> {
    // Without Blob credentials (local dev), keep the source URLs — the copy still renders
    // as long as the original dossier exists.
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return data

    const urls = new Set<string>()
    collectSourceBlobUrls(data, srcId, urls)
    if (!urls.size) return data

    const map = new Map<string, string>()
    await Promise.all(Array.from(urls).map(async (url) => {
        try {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`fetch ${res.status}`)
            const buf = await res.arrayBuffer()
            const contentType = res.headers.get('content-type') || 'application/octet-stream'
            // Re-anchor the same file name under the new dossier's namespace.
            const suffix = new URL(url).pathname.split(`/dossiers/${srcId}/`)[1] || 'copy.jpg'
            const blob = await put(`dossiers/${dstId}/${suffix}`, buf, {
                access: 'public', addRandomSuffix: true, contentType,
            })
            map.set(url, blob.url)
        } catch (e) {
            // Best effort: keep the original URL (works until the source dossier is deleted).
            console.warn('[dossiers/duplicate] blob copy failed for', url, e)
        }
    }))
    return map.size ? rewriteUrls(data, map) : data
}

// ── Terrain-only reset ───────────────────────────────────────────────────────
// Keep who + where (and everything derived from the parcel: PLU analysis, cadastre,
// zones), reset what is being built (works, photos, plans, engagement, CERFA root).
function terrainOnly(src: DPFormData): DPFormData {
    const base: DPFormData = JSON.parse(JSON.stringify(emptyFormData))
    return {
        ...base,
        demandeur: src.demandeur,
        co_demandeur: src.co_demandeur,
        terrain: src.terrain,
        cadastrales_multiparcelles: src.cadastrales_multiparcelles ?? base.cadastrales_multiparcelles,
        terrain_lotissement: src.terrain_lotissement ?? base.terrain_lotissement,
        zones_specifiques: src.zones_specifiques ?? base.zones_specifiques,
        accord_dematerialisation: src.accord_dematerialisation ?? base.accord_dematerialisation,
        architecte_nom: src.architecte_nom ?? base.architecte_nom,
        architecte_inscription: src.architecte_inscription ?? base.architecte_inscription,
        surface_existante: src.surface_existante ?? base.surface_existante,
        lieu_signature: src.lieu_signature ?? base.lieu_signature,
    }
}

// POST /api/dossiers/[id]/duplicate — body: { mode?: 'full' | 'terrain', title?: string }
export async function POST(req: NextRequest, { params }: Ctx) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: { mode?: Mode; title?: string } = {}
    try { body = await req.json() } catch { /* defaults below */ }
    const mode: Mode = body.mode === 'terrain' ? 'terrain' : 'full'

    const [src] = await db.select().from(dossiers)
        .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId))).limit(1)
    if (!src) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    const title = (typeof body.title === 'string' && body.title.trim())
        ? body.title.trim().slice(0, 120)
        : `${src.title} (copie)`.slice(0, 120)

    let data: DPFormData = mode === 'terrain'
        ? terrainOnly(src.data)
        : JSON.parse(JSON.stringify(src.data))

    // Insert first so the new id exists, then copy blobs into its namespace and re-save.
    const [row] = await db.insert(dossiers).values({
        userId: session.userId,
        title,
        data,
        summary: summarizeDossier(data),
        status: 'draft',
        // Full copy resumes where the source was; terrain copy jumps to the works step.
        lastStep: mode === 'terrain' ? 3 : (src.lastStep || 1),
        clientName: src.clientName,
    }).returning({
        id: dossiers.id, title: dossiers.title, status: dossiers.status,
        lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
    })

    try {
        const rewritten = await copyBlobs(data, params.id, row.id)
        if (rewritten !== data) {
            data = rewritten
            await db.update(dossiers).set({ data, summary: summarizeDossier(data) })
                .where(eq(dossiers.id, row.id))
        }
    } catch (e) {
        console.warn('[dossiers/duplicate] blob copy pass failed (copy keeps source URLs):', e)
    }

    return NextResponse.json({ dossier: row }, { status: 201 })
}
