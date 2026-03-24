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
- DO NOT ADD ANY NEW ELEMENTS. You must not add windows, doors, shutters, chimneys, or any architectural features that were not present in the original photo.
- DO NOT REMOVE OR MOVE EXISTING ELEMENTS. Keep all existing windows, doors, and structural features in their exact same positions, shapes, and sizes. The number of windows and doors MUST NOT change.
- KEEP THE PHOTO IDENTICAL. The existing walls (unless specifically being re-rendered by request), roof structure, garden, driveway, surroundings, lighting, sky, and camera angle MUST remain 100% unchanged.
- ONLY IMPLEMENT REQUESTED CHANGES. If the request is for "painting the door", ONLY change the color of the door. Do not touch the windows. If the request is for "cladding", only apply cladding to the specified areas.
- CLEAR THE VIEW. Remove any temporary obstacles, people, cars, or objects that might be in front of the areas being modified (like windows or walls) to ensure the changes are clearly visible.
- ZERO CREATIVITY FOR UNMENTIONED AREAS. Do not invent new structures or alter the architectural style of unmentioned elements.
- Ensure a photorealistic architectural result without any text, borders, or artificial artifacts.`
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

export interface ResizedImage {
    base64: string
    width: number
    height: number
}

// ── Resize an image to OpenAI compatible size while preserving ratio ─────────
export async function resizeImageForOpenAI(dataUrl: string): Promise<ResizedImage> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            // OpenAI DALL-E 2 (edits) supports 256x256, 512x512, or 1024x1024 (square)
            // DALL-E 3 (generations) supports 1024x1024, 1024x1792, 1792x1024
            // Since we use 'gpt-image-1' (proxy for DALL-E 3), we'll aim for 1024x1024, 1792x1024 or 1024x1792
            
            let targetW, targetH;
            if (img.width > img.height) {
                targetW = 1792;
                targetH = 1024;
            } else if (img.height > img.width) {
                targetW = 1024;
                targetH = 1792;
            } else {
                targetW = 1024;
                targetH = 1024;
            }
            
            const canvas = document.createElement('canvas')
            canvas.width = targetW
            canvas.height = targetH
            const ctx = canvas.getContext('2d')!
            
            // Draw original image on the target canvas, preserving its ratio (cover fit)
            const scale = Math.max(targetW / img.width, targetH / img.height)
            const w = img.width * scale, h = img.height * scale
            ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h)
            
            resolve({
                base64: canvas.toDataURL('image/png').split(',')[1],
                width: targetW,
                height: targetH
            })
        }
        img.onerror = () => reject(new Error('Failed to load image for resizing'))
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
        const { base64, width, height } = await resizeImageForOpenAI(payload.imageBase64)
        const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([byteArray], { type: 'image/png' })

        const form = new FormData()
        form.append('model', 'gpt-image-1')
        form.append('prompt', payload.prompt)
        form.append('n', '1')
        form.append('size', `${width}x${height}`)
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
                size: '1024x1024',
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
