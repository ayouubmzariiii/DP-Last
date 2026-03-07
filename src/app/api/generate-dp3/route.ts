import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json()
        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

        const response = await client.images.generate({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1536x1024',
        })

        const b64 = response.data?.[0]?.b64_json
        if (b64) return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}` })

        const url = (response.data?.[0] as { url?: string } | undefined)?.url
        if (url) return NextResponse.json({ imageUrl: url })

        return NextResponse.json({ error: 'No image in response' }, { status: 502 })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-dp3] error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
