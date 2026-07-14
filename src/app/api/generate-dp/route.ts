import { NextRequest, NextResponse } from 'next/server'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { DPFormData } from '@/lib/models'
import { validateDPForm, fatalIssues } from '@/lib/validation'
import { getSession } from '@/lib/auth'
import { consumeDossier } from '@/lib/billing/service'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
        const data: DPFormData = await req.json()

        // Safety net for the graphic dossier: require valid applicant/terrain/works.
        // The engagement signature lives on the CERFA, so step-7 fatals don't block here.
        const fatals = fatalIssues(validateDPForm(data)).filter(i => i.step !== 7)
        if (fatals.length > 0) {
            return NextResponse.json(
                { error: 'Dossier incomplet', issues: fatals },
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
