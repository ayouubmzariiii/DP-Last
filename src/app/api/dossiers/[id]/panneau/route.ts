import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, dossiers } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generatePanneauPdf } from '@/lib/panneauGenerator'

export const runtime = 'nodejs'

// GET /api/dossiers/[id]/panneau — PDF du panneau d'affichage réglementaire, pré-rempli
// depuis le dossier (tout est chargé côté serveur : aucun payload client nécessaire).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [row] = await db.select().from(dossiers)
        .where(and(eq(dossiers.id, params.id), eq(dossiers.userId, session.userId))).limit(1)
    if (!row) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    try {
        const pdf = await generatePanneauPdf({
            data: row.data,
            numeroDp: row.numeroDp,
            submittedAt: row.submittedAt?.toISOString() ?? null,
            decision: row.decision,
            decisionAt: row.decisionAt?.toISOString() ?? null,
            affichageAt: row.affichageAt?.toISOString() ?? null,
            abf: row.summary?.summary?.abf,
        })
        return new NextResponse(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Panneau_affichage_DP.pdf"',
                'Cache-Control': 'no-store',
            },
        })
    } catch (e) {
        console.error('[panneau] generation failed:', e)
        return NextResponse.json({ error: 'Échec de la génération du panneau.' }, { status: 500 })
    }
}
