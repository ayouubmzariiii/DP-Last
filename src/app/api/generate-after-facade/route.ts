import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { Readable } from 'stream'
import { getSession } from '@/lib/auth'
import { MAX_IMAGE_ATTEMPTS, ownsDossier, imageAttemptCount, bumpImageAttempt } from '@/lib/imageAttempts'
import { getSetting } from '@/lib/appSettings'
import { buildFacadeAuditPrompt, buildCorrectionPrompt, parseFacadeAudit, type FacadeAudit } from '@/lib/facadeAudit'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Reprises INTERNES quand le contrôle de fidélité rejette la simulation. Elles corrigent nos
// propres ratés : elles ne sont jamais décomptées du quota de générations du demandeur.
const MAX_AUDIT_RETRIES = 2

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

    const session = await getSession()
    if (!session) {
        return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
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
        const body = await req.json() as { prompt: string; imageBase64?: string; dossierId?: string; facadeId?: string; worksDescription?: string; skipAudit?: boolean }
        const { prompt, dossierId, facadeId, worksDescription } = body
        let { imageBase64 } = body

        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })
        // Garde-fou anti-abus sur ce que l'utilisateur peut faire passer, pas sur l'échafaudage
        // fixe : le prompt assemblé par buildAIAfterImagePrompt fait déjà ~3 000–4 400 caractères
        // selon la nature des travaux, et chaque invariant qu'on y ajoute (volets, plantations,
        // interdiction d'écrire sur la façade) le rallonge. Plafond porté à 6 000.
        if (prompt.length > 6000) return NextResponse.json({ error: 'Prompt too long' }, { status: 400 })

        // Per-image generation cap (4 per façade). Enforced when the client identifies the
        // image (dossierId + facadeId) — which étape 6 always does. Check BEFORE the AI call
        // so we never pay for a refused attempt; count only on success (see finish()).
        // Plafond par façade piloté depuis /admin (défaut : MAX_IMAGE_ATTEMPTS).
        const maxAttempts = await getSetting<number>('image_attempts_per_facade').catch(() => MAX_IMAGE_ATTEMPTS)

        const tracked = !!(dossierId && facadeId)
        if (tracked) {
            if (!(await ownsDossier(session.userId, dossierId!))) {
                return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 403 })
            }
            const used = await imageAttemptCount(dossierId!, facadeId!)
            if (used >= maxAttempts) {
                return NextResponse.json({ error: `Limite atteinte : ${maxAttempts} générations maximum pour cette image. Vous pouvez importer votre propre photo « après ».`, limitReached: true, attemptsRemaining: 0 }, { status: 429 })
            }
        }

        // On a successful generation, count the attempt (idempotent per call) and echo how
        // many tries remain, so the UI can warn / disable the regenerate button.
        const finish = async (payload: Record<string, unknown>) => {
            let attemptsRemaining: number | undefined
            if (tracked) {
                const n = await bumpImageAttempt(session.userId, dossierId!, facadeId!)
                attemptsRemaining = Math.max(0, maxAttempts - n)
            }
            return NextResponse.json({ ...payload, attemptsRemaining })
        }

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
            const orCall = (body: unknown) => fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/ayouubmzariiii/DP-Last',
                    'X-Title': 'DP Travaux Facade Generator'
                },
                body: JSON.stringify(body),
            })

            // Image generation is the ONE paid step — the model is admin-configurable
            // (/admin → Règles, repli env OPENROUTER_IMAGE_MODEL). seedream-4.5 supports
            // both image input (editing the "before" photo) and image output.
            const imageModel = await getSetting<string>('image_model').catch(() => process.env.OPENROUTER_IMAGE_MODEL || 'bytedance-seed/seedream-4.5')
            const auditModel = await getSetting<string>('facade_audit_model').catch(() => process.env.OPENROUTER_FACADE_AUDIT_MODEL || 'google/gemini-3.5-flash')
            // Le contrôle ne s'applique qu'à l'édition photo : l'appelant s'y inscrit en fournissant
            // la description des travaux. Le croquis (DP5) passe par la même route mais produit un
            // dessin technique — le comparer à une photo signalerait TOUT comme un écart.
            const auditEnabled = !!worksDescription && !body.skipAudit
                && await getSetting<boolean>('facade_audit_enabled').catch(() => true)

            let lastTextSnippet = ''

            /** Une génération complète, avec les relances propres au modèle qui répond en TEXTE. */
            const generateOnce = async (promptText: string): Promise<string | null> => {
                // The model occasionally answers with TEXT instead of an image (e.g. a refusal or a
                // description). That is NOT a usable result — never fall back to message.content as an
                // "image". Instead retry a couple of times, nudging it to return only the image.
                const MAX_ATTEMPTS = 3
                for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    const text = attempt === 1
                        ? promptText
                        : `${promptText}\n\nIMPORTANT: respond with the edited IMAGE only — do not reply with text or an explanation.`
                    const content: any[] = [{ type: 'text', text }]
                    if (imageBase64) content.push({ type: 'image_url', image_url: { url: imageBase64 } })

                    const response = await orCall({ model: imageModel, messages: [{ role: 'user', content }], modalities: ['image'] })
                    if (!response.ok) {
                        const errText = await response.text()
                        // 4xx (bad request / content policy) won't fix itself — fail fast.
                        if (response.status >= 400 && response.status < 500) {
                            throw new Error(`OpenRouter image model error: ${response.status} ${errText}`)
                        }
                        lastTextSnippet = `${response.status} ${errText}`.slice(0, 200)
                        continue
                    }
                    const data = await response.json()
                    const msg = data.choices?.[0]?.message
                    // ONLY accept a real generated image (a data: URL or http(s) image URL).
                    const img: string | undefined = msg?.images?.[0]?.image_url?.url
                    if (img) return img
                    lastTextSnippet = (typeof msg?.content === 'string' ? msg.content : '').slice(0, 200)
                    console.warn(`[facade] attempt ${attempt}/${MAX_ATTEMPTS} returned no image${lastTextSnippet ? ' — text: ' + lastTextSnippet : ''}`)
                }
                return null
            }

            /** Compare l'image produite à la photo d'origine. `null` = contrôle indisponible. */
            const audit = async (after: string): Promise<FacadeAudit | null> => {
                if (!imageBase64) return null   // sans « avant », il n'y a rien à comparer
                try {
                    const res = await orCall({
                        model: auditModel,
                        messages: [{
                            role: 'user', content: [
                                { type: 'text', text: buildFacadeAuditPrompt(worksDescription || '') },
                                { type: 'image_url', image_url: { url: imageBase64 } },
                                { type: 'image_url', image_url: { url: after } },
                            ],
                        }],
                    })
                    if (!res.ok) { console.warn('[facade/audit] HTTP', res.status); return null }
                    const j = await res.json()
                    const txt = j.choices?.[0]?.message?.content
                    return parseFacadeAudit(typeof txt === 'string' ? txt : '')
                } catch (e) {
                    console.warn('[facade/audit] failed:', e)
                    return null   // un contrôle en panne ne doit jamais bloquer une génération
                }
            }

            // Boucle génération → contrôle → reprise. Ces reprises sont INTERNES : elles corrigent
            // nos propres ratés et ne doivent pas être décomptées du quota du demandeur (finish()
            // n'est appelé qu'une fois, à la sortie).
            let best: { img: string; audit: FacadeAudit | null } | null = null
            let promptText = prompt
            for (let round = 0; round <= MAX_AUDIT_RETRIES; round++) {
                const img = await generateOnce(promptText)
                if (!img) break
                const verdict = auditEnabled ? await audit(img) : null
                if (!best || (best.audit && verdict && verdict.issues.length < best.audit.issues.length)) {
                    best = { img, audit: verdict }
                }
                if (!verdict || verdict.faithful) { best = { img, audit: verdict }; break }
                console.warn(`[facade/audit] round ${round + 1}: ${verdict.issues.map(i => i.code).join(', ')}`)
                promptText = buildCorrectionPrompt(prompt, verdict.issues)
            }

            if (best) {
                // Le verdict repart au client : le parcours peut dire ce qui a été vérifié, et
                // signaler honnêtement un écart résiduel plutôt que de le laisser filer au dossier.
                const payload: Record<string, unknown> = best.img.startsWith('data:')
                    ? { imageBase64: best.img } : { imageUrl: best.img }
                if (best.audit) payload.audit = best.audit
                return await finish(payload)
            }

            return NextResponse.json(
                { error: "Le modèle n'a pas renvoyé d'image (réponse texte). Réessayez." + (lastTextSnippet ? ` Détail : ${lastTextSnippet}` : '') },
                { status: 502 }
            )
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
            if (b64) return await finish({ imageBase64: `data:image/png;base64,${b64}` })

            const url = (response.data?.[0] as { url?: string } | undefined)?.url
            if (url) return await finish({ imageUrl: url })

            return NextResponse.json({ error: 'No image returned from edit' }, { status: 502 })
        }

        const response = await client.images.generate({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1536x1024' as never,
        })

        const b64 = response.data?.[0]?.b64_json
        if (b64) return await finish({ imageBase64: `data:image/png;base64,${b64}` })

        const url = (response.data?.[0] as { url?: string } | undefined)?.url
        if (url) return await finish({ imageUrl: url })

        return NextResponse.json({ error: 'No image in response' }, { status: 502 })

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-after-facade] error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
