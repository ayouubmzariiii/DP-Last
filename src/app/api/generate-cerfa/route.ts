import { NextRequest, NextResponse } from 'next/server'
import { generateCerfa } from '@/lib/pdfGenerator'
import { DPFormData } from '@/lib/models'
import { validateDPForm, blockingIssues } from '@/lib/validation'
import { getSession } from '@/lib/auth'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        if (!(await getSession())) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
        const data: DPFormData = await req.json()

        // Filet de sécurité : ne jamais émettre un CERFA juridiquement invalide, même
        // si l'interface est contournée. « blockingIssues » couvre les manques
        // rédhibitoires ET les choix INTERDITS par le règlement d'urbanisme — un
        // CERFA signé qui déclare un matériau proscrit engage le déclarant.
        const blockers = blockingIssues(validateDPForm(data))
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

        const { bytes: pdfBytes, form } = await generateCerfa(data)

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="CERFA_${form.id}_${data.demandeur.nom || 'demande'}.pdf"`,
            },
        })
    } catch (err) {
        console.error('Error generating CERFA:', err)
        return NextResponse.json({ error: 'Erreur lors de la génération du CERFA' }, { status: 500 })
    }
}
