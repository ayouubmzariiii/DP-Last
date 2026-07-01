import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { generateCerfaPdf } from '@/lib/pdfGenerator'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { defaultFormData, DPFormData } from '@/lib/models'
import { buildAIAfterImagePrompt, buildAICroquisPrompt } from '@/lib/aiImageGenerator'

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY test harness — regenerate the CERFA and the DP dossier from the built-in
// test fixture (defaultFormData) with a single GET, so the output can be inspected
// instantly after each feature change. NOT available in production.
//
//   GET /api/dev/test-dossier?doc=cerfa            → CERFA 13703 PDF (instant)
//   GET /api/dev/test-dossier?doc=dp               → DP dossier PDF  (instant — uses the CACHED
//                                                     AI pieces baked into the fixture, no AI call)
//   GET /api/dev/test-dossier?doc=dp&fresh=1       → regenerate the DP4 notice + a façade
//                                                     simulation/croquis live via the AI (slow)
//   GET /api/dev/test-dossier?doc=dp&fresh=1&cache=1 → regenerate AND persist them as the new
//                                                     cache assets under public/test/cache/
//   add &dl=1 to force download instead of inline preview.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Deep-clone the fixture and make it generation-ready (the fixture ships unsigned). */
function makeTestData(): DPFormData {
    const d = JSON.parse(JSON.stringify(defaultFormData)) as DPFormData
    if (d.engagement) d.engagement.signature = true
    return d
}

/** Optionally fill the AI-generated pieces (DP4 notice + one façade after/croquis) by
 *  calling the same internal routes the wizard uses — so the test dossier mirrors a real one. */
async function enrichWithAI(req: NextRequest, d: DPFormData): Promise<void> {
    const origin = req.nextUrl.origin
    const post = (path: string, body: unknown) =>
        fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    // EVERY façade that has a "before" photo gets its own photoreal "after" (DP6) and
    // architectural croquis (DP5) — not just the first one found. (Previously this only ever
    // enriched a single façade, which is why "façade latérale" always shipped with a blank
    // "Etat projeté" and an unchecked-in-spirit DP6 for that façade.)
    // Façades that ALREADY have both after+croquis are skipped — the AI's text-rendering
    // inside the croquis annotation is noticeably unreliable run-to-run, so a façade that
    // already has a clean cached result should not be needlessly re-rolled (and risk getting
    // a worse one) just because a sibling façade needed generating for the first time.
    for (const facade of d.photos.facades) {
        if (!facade.before || (facade.after && facade.croquis)) continue
        try {
            const aRes = await post('/api/generate-after-facade', { prompt: buildAIAfterImagePrompt(d), imageBase64: facade.before })
            if (aRes.ok) {
                const aj = await aRes.json()
                const after = aj.imageBase64 || aj.imageUrl
                if (after) {
                    facade.after = after
                    const cRes = await post('/api/generate-after-facade', { prompt: buildAICroquisPrompt(d), imageBase64: after })
                    if (cRes.ok) { const cj = await cRes.json(); facade.croquis = cj.imageBase64 || cj.imageUrl || null }
                }
            }
        } catch (e) { console.warn(`[dev/test-dossier] AI façade step failed for "${facade.id}":`, e) }
    }

    // DP4 descriptive notice.
    try {
        const photosPayload = d.photos.facades.flatMap(f => [f.before, f.after]).filter(Boolean)
        const nRes = await post('/api/generate-dp4', {
            formData: { demandeur: d.demandeur, terrain: d.terrain, travaux: d.travaux },
            photos: photosPayload,
        })
        if (nRes.ok) { const nj = await nRes.json(); if (nj.dp4) d.plans.dp4_notice = nj.dp4 }
    } catch (e) { console.warn('[dev/test-dossier] DP4 notice step failed:', e) }
}

/** Persist freshly-generated AI pieces as the committed cache (so future runs reuse them). */
async function persistCache(d: DPFormData): Promise<void> {
    const dir = path.join(process.cwd(), 'public', 'test', 'cache')
    await fs.mkdir(dir, { recursive: true })
    const toBytes = async (src: string): Promise<Buffer | null> => {
        if (src.startsWith('data:')) return Buffer.from(src.slice(src.indexOf(',') + 1), 'base64')
        if (src.startsWith('http')) return Buffer.from(await (await fetch(src)).arrayBuffer())
        return null
    }
    // Persist EVERY façade that got AI content, not just the first — 'principale'/'laterale' are
    // kept as the historical slugs for the two fixture façades; anything beyond that falls back
    // to the façade's own id so a third façade wouldn't silently overwrite one of the first two.
    const slugFor = (idx: number, id: string) => idx === 0 ? 'principale' : idx === 1 ? 'laterale' : id
    for (let i = 0; i < d.photos.facades.length; i++) {
        const facade = d.photos.facades[i]
        const slug = slugFor(i, facade.id)
        if (facade.after) {
            const b = await toBytes(facade.after)
            if (b) await fs.writeFile(path.join(dir, `after-${slug}.jpg`), await sharp(b).resize(1280, 960, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer())
        }
        if (facade.croquis) {
            const b = await toBytes(facade.croquis)
            if (b) await fs.writeFile(path.join(dir, `croquis-${slug}.png`), await sharp(b).resize(1280, 960, { fit: 'inside' }).png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer())
        }
    }
    if (d.plans.dp4_notice) {
        // Persisted both as text (reference) and as a TS module imported by the fixture.
        await fs.writeFile(path.join(dir, 'dp4-notice.txt'), d.plans.dp4_notice, 'utf8')
        const ts = `// AUTO-GENERATED cached DP4 notice for test mode. Regenerate via\n` +
            `// GET /api/dev/test-dossier?doc=dp&fresh=1&cache=1\nexport const TEST_DP4_NOTICE = ${JSON.stringify(d.plans.dp4_notice)}\n`
        await fs.writeFile(path.join(process.cwd(), 'src', 'lib', 'testCache.ts'), ts, 'utf8')
    }
}

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Dev-only endpoint, disabled in production.' }, { status: 403 })
    }

    const params = req.nextUrl.searchParams
    const doc = (params.get('doc') || 'cerfa').toLowerCase()
    const cache = params.get('cache') === '1'
    // Default: reuse the cached AI pieces baked into the fixture. Only call the AI when explicitly
    // asked (fresh=1, or the legacy ai=1, or cache=1 which implies a regenerate-then-persist).
    const fresh = params.get('fresh') === '1' || params.get('ai') === '1' || cache
    const disposition = params.get('dl') === '1' ? 'attachment' : 'inline'

    try {
        const data = makeTestData()
        if (fresh) await enrichWithAI(req, data)
        if (cache) await persistCache(data)

        const isDP = doc === 'dp' || doc === 'dossier'
        const bytes = isDP ? await generateDPDocument(data) : await generateCerfaPdf(data)
        const filename = isDP ? 'TEST_Dossier_DP.pdf' : 'TEST_CERFA_13703.pdf'

        return new NextResponse(Buffer.from(bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${disposition}; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.error('[dev/test-dossier] generation failed:', msg, stack)
        return NextResponse.json({ error: msg, stack }, { status: 500 })
    }
}
