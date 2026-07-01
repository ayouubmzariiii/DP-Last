import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { put, del } from '@vercel/blob'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const KINDS = new Set(['before', 'after', 'croquis', 'dp7', 'dp8', 'dp1', 'dp2'])
const EXTS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// POST /api/blob/upload — server upload (all images < 4.5 MB). Auth + ownership guarded.
// FormData: file, dossierId, kind, facadeId?, ext?, previousUrl?
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    // Blob auth is either an explicit read-write token OR — recommended — OIDC on Vercel, where the
    // SDK auto-authenticates from VERCEL_OIDC_TOKEN + BLOB_STORE_ID (both injected when the store is
    // connected to the project). Accept either so a token-less OIDC deployment works.
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
        return NextResponse.json({ error: 'Stockage Blob non configuré (connectez un store Blob au projet, ou définissez BLOB_READ_WRITE_TOKEN).' }, { status: 503 })
    }

    let form: FormData
    try { form = await req.formData() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const file = form.get('file')
    const dossierId = String(form.get('dossierId') || '')
    const kind = String(form.get('kind') || '')
    const facadeId = form.get('facadeId') ? String(form.get('facadeId')) : ''
    const ext = (String(form.get('ext') || 'jpg')).toLowerCase().replace(/[^a-z]/g, '')
    const previousUrl = form.get('previousUrl') ? String(form.get('previousUrl')) : ''

    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 })
    if (!dossierId || !KINDS.has(kind)) return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 })
    if (file.size > 4.4 * 1024 * 1024) return NextResponse.json({ error: 'Image trop volumineuse (max 4,4 Mo).' }, { status: 413 })

    // Ownership: the caller must own the dossier they're writing into.
    const [owned] = await db.select({ id: dossiers.id }).from(dossiers)
        .where(and(eq(dossiers.id, dossierId), eq(dossiers.userId, session.userId))).limit(1)
    if (!owned) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    const safeExt = EXTS[ext] ? ext : 'jpg'
    const pathname = `dossiers/${dossierId}/${kind}${facadeId ? `-${facadeId}` : ''}.${safeExt}`

    try {
        const blob = await put(pathname, file, {
            access: 'public',
            addRandomSuffix: true,           // unique URL → avoids CDN staleness on replace
            contentType: EXTS[safeExt],
        })
        // Best-effort delete of the image this one replaces (only within this dossier's namespace).
        if (previousUrl && previousUrl.includes(`/dossiers/${dossierId}/`)) {
            del(previousUrl).catch(e => console.warn('[blob/upload] previousUrl del failed:', e))
        }
        return NextResponse.json({ url: blob.url })
    } catch (err) {
        console.error('[blob/upload] error:', err)
        return NextResponse.json({ error: 'Échec du téléversement de l’image.' }, { status: 500 })
    }
}
