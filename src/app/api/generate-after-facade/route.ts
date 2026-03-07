import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { Readable } from 'stream'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function base64ToPngBuffer(imageBase64: string): Promise<Buffer> {
    let rawBuffer: Buffer

    if (imageBase64.startsWith('data:')) {
        const commaIdx = imageBase64.indexOf(',')
        if (commaIdx === -1) throw new Error('Malformed data URL')
        rawBuffer = Buffer.from(imageBase64.slice(commaIdx + 1), 'base64')
    } else if (imageBase64.startsWith('http')) {
        const resp = await fetch(imageBase64)
        rawBuffer = Buffer.from(await resp.arrayBuffer())
    } else {
        rawBuffer = Buffer.from(imageBase64, 'base64')
    }

    // Pre-pass: normalize any format (WebP, JPEG, AVIF…) to raw pixel data
    // so sharp doesn't choke on unsupported input during resize
    const normalized = await sharp(rawBuffer)
        .rotate()          // auto-orient EXIF
        .ensureAlpha()     // force RGBA so PNG encoder is happy
        .raw()
        .toBuffer({ resolveWithObject: true })

    // gpt-image-1 edit: resize to 1536×1024 landscape, output PNG
    return sharp(normalized.data, {
        raw: {
            width: normalized.info.width,
            height: normalized.info.height,
            channels: normalized.info.channels as 1 | 2 | 3 | 4,
        }
    })
        .resize(1536, 1024, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { prompt: string; imageBase64?: string }
        const { prompt, imageBase64 } = body

        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

        // ── With before image → client.images.edit() ──────────────────────────
        if (imageBase64) {
            const pngBuffer = await base64ToPngBuffer(imageBase64)

            // Convert Buffer → ReadableStream for toFile (as per OpenAI doc)
            const stream = Readable.from(pngBuffer)
            const imageFile = await toFile(stream, 'facade.png', { type: 'image/png' })

            console.log('--- CALLING OPENAI EDIT API ---')
            console.log('Model: gpt-image-1')
            console.log('Size: 1536x1024')
            console.log('Prompt:', prompt)

            const response = await client.images.edit({
                model: 'gpt-image-1',
                image: imageFile,
                prompt,
                size: '1536x1024' as never,
                // @ts-ignore
                input_fidelity: 'high',
                n: 1,
            })

            console.log('--- OPENAI RESPONSE RECEIVED ---')

            const b64 = response.data?.[0]?.b64_json
            if (b64) return NextResponse.json({ imageBase64: `data:image/png;base64,${b64}` })

            const url = (response.data?.[0] as { url?: string } | undefined)?.url
            if (url) return NextResponse.json({ imageUrl: url })

            return NextResponse.json({ error: 'No image returned from edit' }, { status: 502 })
        }

        // ── Without image → client.images.generate() ─────────────────────────
        console.log('--- CALLING OPENAI GENERATE API ---')
        console.log('Model: gpt-image-1')
        console.log('Size: 1536x1024')
        console.log('Prompt:', prompt)

        const response = await client.images.generate({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1536x1024' as never,
        })

        console.log('--- OPENAI RESPONSE RECEIVED ---')

        const b64 = response.data?.[0]?.b64_json
        if (b64) return NextResponse.json({ imageBase64: `data:image/png;base64,${b64}` })

        const url = (response.data?.[0] as { url?: string } | undefined)?.url
        if (url) return NextResponse.json({ imageUrl: url })

        return NextResponse.json({ error: 'No image in response' }, { status: 502 })

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-after-facade] error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
