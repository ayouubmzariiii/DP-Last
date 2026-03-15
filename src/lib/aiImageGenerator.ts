/**
 * AI Image Generation – "Après Travaux" Facade Simulation
 * Model: gpt-image-1 (OpenAI), landscape 1536×1024
 * Calls OpenAI directly from the browser (no server timeout issues).
 * The API key is vended per-request from /api/image-token after rate-limit checks.
 */
import { DPFormData } from './models'

// ── Lookup maps ───────────────────────────────────────────────────────────────
const MAT_EN: Record<string, string> = {
    pvc: 'white uPVC (polyvinyl chloride)',
    aluminium: 'brushed anodized aluminium',
    bois: 'solid wood with natural grain',
    mixte: 'wood-aluminium composite',
}
const FINITION_EN: Record<string, string> = {
    enduit: 'smooth exterior render / mineral plaster coating',
    bardage_bois: 'horizontal wood cladding boards (bardage bois)',
    bardage_metal: 'flat metal / steel cladding panels',
    bardage_composite: 'composite HPL fiber-cement cladding panels',
}

// ── Prompt builders ───────────────────────────────────────────────────────────
export function buildAIAfterImagePrompt(data: DPFormData, customInstruction?: string): string {
    const { travaux } = data

    let rawDescription = ''

    if (customInstruction) {
        rawDescription = customInstruction
    } else {
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            rawDescription = travaux.menuiseries.description || `Remplacement de menuiseries (${travaux.menuiseries.nombre || 1} ${travaux.menuiseries.type || 'fenêtre'}) en ${travaux.menuiseries.materiau || 'pvc'} ${travaux.menuiseries.couleur || ''}`
        }
        else if (travaux.type === 'isolation' && travaux.isolation) {
            rawDescription = `Isolation thermique par l'extérieur. Finition demandée : ${travaux.isolation.type_finition || 'enduit'} ${travaux.isolation.couleur ? 'couleur ' + travaux.isolation.couleur : ''}. Façades concernées : ${travaux.isolation.facades_concernees?.join(', ') || 'Toutes les façades'}.`
        }
        else if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
            rawDescription = `Installation de ${travaux.photovoltaique.nombre_panneaux || '10'} panneaux photovoltaïques sur la toiture. Orientation : ${travaux.photovoltaique.orientation || 'Sud'}.`
        }
    }

    return `You are an expert architectural visualization AI. Your task is to generate a realistic "after" simulation of a house based on the requested modifications.

REQUESTED CHANGES:
"${rawDescription}"

CONSTRAINTS (strictly enforced):
- YOU MUST KEEP EVERYTHING ELSE EXACTLY AS IN THE ORIGINAL PHOTO.
- The existing walls (unless modified by the request), roof structure, garden, driveway, surroundings, lighting, sky, and camera angle MUST remain 100% unchanged.
- Only apply the specific replacements or additions clearly mentioned in the requested changes. Do not invent new structures or alter the architectural style of unmentioned elements.
- Provide a photorealistic architectural result without any text, borders, or artificial artifacts.`
}

export function buildAICroquisPrompt(data: DPFormData, customInstruction?: string): string {
    const { travaux } = data
    let rawDescription = customInstruction || data.terrain.description_projet || ''

    if (!rawDescription) {
        if (travaux.type === 'menuiseries' && travaux.menuiseries) {
            rawDescription = `Remplacement de menuiseries (${travaux.menuiseries.nombre || 1} ${travaux.menuiseries.type || 'fenêtre'}) en ${travaux.menuiseries.materiau || 'pvc'} ${travaux.menuiseries.couleur || ''}`
        } else if (travaux.type === 'isolation' && travaux.isolation) {
            rawDescription = `Isolation thermique par l'extérieur. Finition : ${travaux.isolation.type_finition || 'enduit'} ${travaux.isolation.couleur || ''}.`
        } else if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
            rawDescription = `Installation de ${travaux.photovoltaique.nombre_panneaux || '10'} panneaux photovoltaïques sur la toiture.`
        }
    }

    return `You are an expert architectural illustrator. Create a professional 2D ARCHITECTURAL ELEVATION DRAWING (Facade) for a French residential building based on the provided image.

The provided image is a photorealistic simulation of the building AFTER works. Your task is to accurately convert this image into a formal architectural CAD drawing.

VISUAL STYLE (MANDATORY):
- Style: Clean 2D technical CAD elevation drawing (not a photo, not a sketch).
- Linework: Very thin, consistent clean black outlines for all structural elements.
- Colors: Muted "architectural" palette. Walls in light beige or warm grey. Roof in dark charcoal or slate grey.
- Shadows: Simple, flat, solid grey shadows at a 45-degree angle to show depth. No gradients.
- Background: Solid white background.
- Details: Include subtle material textures like fine grid for roof tiles.
- Content: Exactly replicate the structure shown in the image.
- ANNOTATIONS: Draw thin black arrows pointing at the key areas of change (e.g., new windows, new pintu, new cladding). Near each arrow, add a small, legibly written technical description in French (e.g., "Nouveau portail", "Menuiseries Aluminium RAL 7016", "Isolation par l'extérieur").
- Professionalism: No people, no trees, no artifacts. Just the building facade with technical annotations on a white background.`
}

// ── Fetch the API key from our secure token endpoint ─────────────────────────
async function fetchApiKey(): Promise<string> {
    const res = await fetch('/api/image-token', { cache: 'no-store' })
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error || `Token fetch failed (${res.status})`)
    }
    const data = await res.json() as { key: string }
    if (!data.key) throw new Error('No key returned')
    return data.key
}

// ── Resize an image to 1536×1024 PNG using browser Canvas ────────────────────
async function resizeImageToBase64(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 1536
            canvas.height = 1024
            const ctx = canvas.getContext('2d')!
            // Cover-fit: scale to fill, centre-crop
            const scale = Math.max(1536 / img.width, 1024 / img.height)
            const w = img.width * scale, h = img.height * scale
            ctx.drawImage(img, (1536 - w) / 2, (1024 - h) / 2, w, h)
            resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = reject
        img.src = dataUrl
    })
}

// ── Core API caller — runs entirely in the browser ────────────────────────────
async function callOpenAIDirect(payload: {
    prompt: string
    imageBase64?: string   // data:image/... for edit, undefined for generate
}): Promise<string> {
    const apiKey = await fetchApiKey()

    let responseData: { data?: Array<{ b64_json?: string; url?: string }> }

    if (payload.imageBase64) {
        // images.edit — multipart/form-data
        const resized = await resizeImageToBase64(payload.imageBase64)
        const base64 = resized.split(',')[1]
        const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([byteArray], { type: 'image/png' })

        const form = new FormData()
        form.append('model', 'gpt-image-1')
        form.append('prompt', payload.prompt)
        form.append('n', '1')
        form.append('size', '1536x1024')
        form.append('image', blob, 'facade.png')

        const res = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
            throw new Error(err.error?.message || `OpenAI error ${res.status}`)
        }
        responseData = await res.json()
    } else {
        // images.generate — JSON
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: payload.prompt,
                n: 1,
                size: '1536x1024',
            }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
            throw new Error(err.error?.message || `OpenAI error ${res.status}`)
        }
        responseData = await res.json()
    }

    const item = responseData.data?.[0]
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
    if (item?.url) return item.url
    throw new Error('No image returned from OpenAI')
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateAIAfterImage(data: DPFormData): Promise<string> {
    const prompt = buildAIAfterImagePrompt(data)
    const imageBase64 = data.photos.facade_avant

    console.group('%c🤖 AI Facade Generation – gpt-image-1 (browser)', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa', prompt)
    console.log('%cBefore image provided:', 'font-weight:bold;color:#34d399', !!imageBase64)
    console.groupEnd()

    const realImage = imageBase64?.startsWith('data:') ? imageBase64 : undefined
    return callOpenAIDirect({ prompt, imageBase64: realImage })
}

export async function generateAICroquis(data: DPFormData, baseImage: string, customInstruction?: string): Promise<string> {
    const prompt = buildAICroquisPrompt(data, customInstruction)
    const realImage = baseImage.startsWith('data:') ? baseImage : undefined

    console.group('%c🤖 AI Croquis Generation – gpt-image-1 (browser)', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa', prompt)
    console.log('%cBase image provided:', 'font-weight:bold;color:#34d399', !!realImage)
    console.groupEnd()

    return callOpenAIDirect({ prompt, imageBase64: realImage })
}
