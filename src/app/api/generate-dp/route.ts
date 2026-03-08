import { NextRequest, NextResponse } from 'next/server'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { DPFormData } from '@/lib/models'

export const maxDuration = 60;

// Need to allow large payloads for base64 images
export const maxBodyLength = 50 * 1024 * 1024; // Used by some environments
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const data: DPFormData = await req.json()
        const pdfBytes = await generateDPDocument(data)

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
