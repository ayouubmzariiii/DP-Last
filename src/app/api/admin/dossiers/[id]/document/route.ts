import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, dossiers } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'
import { generateCerfaPdf } from '@/lib/pdfGenerator'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { generatePanneauPdf } from '@/lib/panneauGenerator'
import { validateDPForm, fatalIssues } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const KINDS = ['cerfa', 'dp', 'panneau'] as const
type Kind = typeof KINDS[number]
const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v)

// GET /api/admin/dossiers/:id/document?kind=cerfa|dp|panneau[&dl=1]
//
// Régénère à la demande, côté serveur, le document qu'obtiendrait le client — pour que
// l'admin voie les FICHIERS et pas seulement les données. Rien n'est stocké : le PDF est
// reconstruit depuis le `data` en base à chaque appel, donc il reflète toujours l'état actuel.
//
// Deux différences volontaires avec les routes client :
//  • AUCUN effet de bord de facturation (pas de `consumeDossier`) — inspecter un dossier ne
//    doit jamais consommer le quota ni un crédit du client.
//  • La validation n'est pas bloquante : sur un brouillon, l'admin veut justement voir l'état
//    du document. Les manques sont signalés par l'en-tête `X-Dossier-Fatals`.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const kind = (new URL(req.url).searchParams.get('kind') || '').toLowerCase()
    if (!isKind(kind)) return NextResponse.json({ error: 'Type de document inconnu.' }, { status: 400 })
    const download = new URL(req.url).searchParams.get('dl') === '1'

    const [row] = await db.select().from(dossiers).where(eq(dossiers.id, params.id)).limit(1)
    if (!row) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    const data = row.data
    const nom = (data?.demandeur?.nom || 'dossier').replace(/[^\w\-]+/g, '_')
    const fatals = (() => {
        try { return fatalIssues(validateDPForm(data)).length } catch { return -1 }
    })()

    try {
        let pdf: Uint8Array
        let filename: string
        if (kind === 'cerfa') {
            pdf = await generateCerfaPdf(data)
            filename = `CERFA_16702_${nom}.pdf`
        } else if (kind === 'dp') {
            pdf = await generateDPDocument(data, { dossierId: row.id })
            filename = `Dossier_DP_${nom}.pdf`
        } else {
            pdf = await generatePanneauPdf({
                data,
                numeroDp: row.numeroDp,
                submittedAt: row.submittedAt?.toISOString() ?? null,
                decision: row.decision,
                decisionAt: row.decisionAt?.toISOString() ?? null,
                affichageAt: row.affichageAt?.toISOString() ?? null,
                abf: row.summary?.summary?.abf,
            })
            filename = `Panneau_affichage_${nom}.pdf`
        }

        console.log(`[admin] ${admin.email} generated ${kind} for dossier ${row.id}`)
        return new NextResponse(Buffer.from(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
                'Cache-Control': 'no-store',
                'X-Dossier-Fatals': String(fatals),
            },
        })
    } catch (e) {
        console.error(`[admin] ${kind} generation failed for ${row.id}:`, e)
        return NextResponse.json(
            { error: 'Génération impossible — le dossier est probablement trop incomplet pour ce document.' },
            { status: 500 },
        )
    }
}
