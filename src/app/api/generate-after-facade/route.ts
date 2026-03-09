import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { Readable } from 'stream'

export const maxDuration = 300   // 5 min max on Vercel Pro; free tier capped at 60s
export const dynamic = 'force-dynamic'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Security: simple origin / referer guard ────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

function isOriginAllowed(req: NextRequest): boolean {
    if (process.env.NODE_ENV === 'development') return true
    if (ALLOWED_ORIGINS.length === 0) return true  // not configured → open
    const origin = req.headers.get('origin') || req.headers.get('referer') || ''
    return ALLOWED_ORIGINS.some(o => origin.startsWith(o))
}

// ── Rate-limiting: simple in-memory (per-instance) ────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = parseInt(process.env.IMAGE_RATE_LIMIT || '10')     // per window
const RATE_WINDOW_MS = 60_000                                           // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return false
    }
    if (entry.count >= RATE_LIMIT) return true
    entry.count++
    return false
}

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

    return sharp(rawBuffer)
        .rotate()
        .resize(1536, 1024, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
}

export async function POST(req: NextRequest) {
    // Security checks
    if (!isOriginAllowed(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 })
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    try {
        const body = await req.json() as { prompt: string; imageBase64?: string }
        const { prompt, imageBase64 } = body

        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
        if (prompt.length > 4000) return NextResponse.json({ error: 'Prompt too long' }, { status: 400 })

        // ── Streaming response so client stays alive during long generation ─────
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: object) => {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
                }

                try {
                    send({ status: 'generating', message: 'Génération en cours...' })

                    let b64: string | undefined
                    let url: string | undefined

                    if (imageBase64) {
                        const pngBuffer = await base64ToPngBuffer(imageBase64)
                        const nodeStream = Readable.from(pngBuffer)
                        const imageFile = await toFile(nodeStream, 'facade.png', { type: 'image/png' })

                        send({ status: 'generating', message: 'Modification de la façade avec IA...' })
                        const response = await client.images.edit({
                            model: 'gpt-image-1',
                            image: imageFile,
                            prompt,
                            size: '1536x1024' as never,
                            // @ts-ignore
                            input_fidelity: 'high',
                            n: 1,
                        })
                        b64 = response.data?.[0]?.b64_json
                        url = (response.data?.[0] as { url?: string } | undefined)?.url
                    } else {
                        send({ status: 'generating', message: 'Génération de l\'image...' })
                        const response = await client.images.generate({
                            model: 'gpt-image-1',
                            prompt,
                            n: 1,
                            size: '1536x1024' as never,
                        })
                        b64 = response.data?.[0]?.b64_json
                        url = (response.data?.[0] as { url?: string } | undefined)?.url
                    }

                    if (b64) {
                        send({ status: 'done', imageBase64: `data:image/png;base64,${b64}` })
                    } else if (url) {
                        send({ status: 'done', imageUrl: url })
                    } else {
                        send({ status: 'error', error: 'No image returned from AI' })
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    console.error('[generate-after-facade] error:', msg)
                    send({ status: 'error', error: msg })
                } finally {
                    controller.close()
                }
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',   // nginx: disable buffering
            }
        })

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
