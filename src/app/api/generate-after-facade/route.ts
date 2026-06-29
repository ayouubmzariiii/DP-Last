import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { Readable } from 'stream'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build' })

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
const RATE_LIMIT = parseInt(process.env.IMAGE_RATE_LIMIT || '10')
const RATE_WINDOW_MS = 60_000

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
    // ── Security checks ────────────────────────────────────────────────────
    if (!isOriginAllowed(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute.' }, { status: 429 })
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (!openRouterKey && !openaiKey) {
        return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    try {
        const body = await req.json() as { prompt: string; imageBase64?: string }
        const { prompt } = body
        let { imageBase64 } = body

        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
        if (prompt.length > 4000) return NextResponse.json({ error: 'Prompt too long' }, { status: 400 })

        // Resolve a relative public asset (e.g. test photos at /test/...) to a data URL so it can
        // be sent to the model and processed like an uploaded photo.
        if (imageBase64 && imageBase64.startsWith('/')) {
            try {
                const fs = await import('node:fs/promises')
                const path = await import('node:path')
                const file = path.join(process.cwd(), 'public', imageBase64)
                const buf = await fs.readFile(file)
                const ext = (imageBase64.split('.').pop() || 'jpg').toLowerCase()
                const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
                imageBase64 = `data:${mime};base64,${buf.toString('base64')}`
            } catch (e) {
                console.warn('[facade] could not resolve public image, generating without it:', imageBase64)
                imageBase64 = undefined
            }
        }

        // ── OpenRouter Path ───────────────────────────────────────────────
        if (openRouterKey) {
            const contentArray: any[] = [{ type: 'text', text: prompt }]
            
            if (imageBase64) {
                // For image editing/referencing, pass the image directly
                contentArray.push({
                    type: 'image_url',
                    image_url: {
                        url: imageBase64
                    }
                })
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/ayouubmzariiii/DP-Last',
                    'X-Title': 'DP Travaux Facade Generator'
                },
                body: JSON.stringify({
                    // Image generation is the ONE paid step — use a cheap OpenRouter image model
                    // (override via OPENROUTER_IMAGE_MODEL). gemini-2.5-flash-image supports both
                    // image input (editing the "before" photo) and image output, at very low cost.
                    model: process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image',
                    messages: [{ role: 'user', content: contentArray }],
                    modalities: ['image']
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`OpenRouter image model error: ${response.status} ${errText}`)
            }

            const data = await response.json()
            const msg = data.choices?.[0]?.message
            const imageUrl = msg?.images?.[0]?.image_url?.url || msg?.content

            if (imageUrl) {
                if (imageUrl.startsWith('data:')) {
                    return NextResponse.json({ imageBase64: imageUrl })
                }
                return NextResponse.json({ imageUrl })
            }

            throw new Error('No image returned from OpenRouter Grok Imagine')
        }

        // ── OpenAI Fallback Path ──────────────────────────────────────────
        if (imageBase64) {
            const pngBuffer = await base64ToPngBuffer(imageBase64)
            const nodeStream = Readable.from(pngBuffer)
            const imageFile = await toFile(nodeStream, 'facade.png', { type: 'image/png' })

            const response = await client.images.edit({
                model: 'gpt-image-1',
                image: imageFile,
                prompt,
                size: '1536x1024' as never,
                // @ts-ignore
                input_fidelity: 'high',
                n: 1,
            })

            const b64 = response.data?.[0]?.b64_json
            if (b64) return NextResponse.json({ imageBase64: `data:image/png;base64,${b64}` })

            const url = (response.data?.[0] as { url?: string } | undefined)?.url
            if (url) return NextResponse.json({ imageUrl: url })

            return NextResponse.json({ error: 'No image returned from edit' }, { status: 502 })
        }

        const response = await client.images.generate({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1536x1024' as never,
        })

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
