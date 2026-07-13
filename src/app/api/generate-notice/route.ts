import { NextRequest, NextResponse } from 'next/server'
import { generateNoticePdf } from '@/lib/noticeGenerator'
import { DPFormData } from '@/lib/models'
import { getSession } from '@/lib/auth'

export const maxDuration = 30

// POST /api/generate-notice — standalone "Notice descriptive (DP4)" PDF.
// The notice is also inside the full dossier, but each DP piece is filed separately,
// so the applicant needs it as its own document.
export async function POST(req: NextRequest) {
    try {
        if (!(await getSession())) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
        const data: DPFormData = await req.json()

        if (!data?.plans?.dp4_notice) {
            return NextResponse.json({ error: 'Aucune notice descriptive : générez-la à l’étape Plans (DP4) avant de la télécharger.' }, { status: 422 })
        }

        const pdfBytes = await generateNoticePdf(data)
        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Notice_descriptive_DP4_${data.demandeur.nom || 'demande'}.pdf"`,
            },
        })
    } catch (err) {
        console.error('Error generating notice PDF:', err)
        return NextResponse.json({ error: 'Erreur lors de la génération de la notice' }, { status: 500 })
    }
}
