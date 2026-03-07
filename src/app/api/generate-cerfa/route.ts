import { NextRequest, NextResponse } from 'next/server'
import { generateCerfaPdf } from '@/lib/pdfGenerator'
import { DPFormData } from '@/lib/models'

export async function POST(req: NextRequest) {
    try {
        const data: DPFormData = await req.json()
        const pdfBytes = await generateCerfaPdf(data)

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="CERFA_13703_${data.demandeur.nom || 'demande'}.pdf"`,
            },
        })
    } catch (err) {
        console.error('Error generating CERFA:', err)
        return NextResponse.json({ error: 'Erreur lors de la génération du CERFA' }, { status: 500 })
    }
}
