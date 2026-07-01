import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { list, del } from '@vercel/blob'
import { db, users, dossiers } from '@/lib/db'
import { getSession, COOKIE_NAME } from '@/lib/auth'

export const runtime = 'nodejs'

// DELETE /api/auth/account — permanently delete the account and all its dossiers.
// Dossier rows cascade via the FK; we best-effort purge their Blob folders first.
export async function DELETE() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    try {
        // Best-effort blob cleanup for every dossier owned by the user — never block deletion on it.
        if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
            const rows = await db.select({ id: dossiers.id }).from(dossiers).where(eq(dossiers.userId, session.userId))
            for (const r of rows) {
                try {
                    const { blobs } = await list({ prefix: `dossiers/${r.id}/` })
                    if (blobs.length) await del(blobs.map(b => b.url))
                } catch (e) {
                    console.warn('[auth/account] blob cleanup failed for dossier', r.id, e)
                }
            }
        }

        await db.delete(users).where(eq(users.id, session.userId))

        const res = NextResponse.json({ ok: true })
        res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
        return res
    } catch (err) {
        console.error('[auth/account DELETE] error:', err)
        return NextResponse.json({ error: 'Erreur serveur lors de la suppression du compte.' }, { status: 500 })
    }
}
