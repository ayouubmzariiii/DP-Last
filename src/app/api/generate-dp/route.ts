import { NextRequest, NextResponse } from 'next/server'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { DPFormData } from '@/lib/models'
import { validateDPForm, blockingIssues } from '@/lib/validation'
import { getSession } from '@/lib/auth'
import { consumeDossier } from '@/lib/billing/service'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
        const data: DPFormData = await req.json()

        // Safety net for the graphic dossier : identité/terrain/travaux valides, ET
        // aucun choix INTERDIT par le règlement d'urbanisme. Le 'forbidden' était
        // jusqu'ici ignoré côté serveur : un matériau proscrit par le PLU (PVC en
        // secteur sauvegardé, par exemple) produisait un dossier complet que la
        // mairie n'aurait pu qu'écarter. Le modèle de sévérité prévoyait ce blocage
        // (blockingIssues = fatal + forbidden) ; seule l'interface l'appliquait.
        // La signature d'engagement vit sur le CERFA : les fatals d'étape 7 ne
        // bloquent pas ici.
        const issues = validateDPForm(data)
        const blockers = blockingIssues(issues).filter(i => i.step !== 7)
        if (blockers.length > 0) {
            const forbidden = blockers.filter(i => i.severity === 'forbidden')
            return NextResponse.json(
                {
                    error: forbidden.length > 0
                        ? 'Le projet retient un matériau ou une teinte interdits par le règlement d’urbanisme.'
                        : 'Dossier incomplet',
                    issues: blockers,
                },
                { status: 422 },
            )
        }

        const dossierId = req.nextUrl.searchParams.get('ref') || undefined
        const pdfBytes = await generateDPDocument(data, { dossierId })

        // Billing: record one dossier consumed (quota → credit). Idempotent per dossier
        // and non-blocking — generation is not gated on entitlements for now.
        await consumeDossier(session.userId, dossierId)

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Dossier_DP_${data.demandeur.nom || 'demande'}.pdf"`,
            },
        })
    } catch (err) {
        console.error('Error generating DP document:', err)
        return NextResponse.json({ error: 'Erreur lors de la génération du dossier DP' }, { status: 500 })
    }
}
