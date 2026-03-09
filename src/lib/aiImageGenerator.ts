/**
 * AI Image Generation – "Après Travaux" Facade Simulation
 * Model: gpt-image-1 (OpenAI), landscape 1536×1024, via /api/generate-after-facade
 */
import { DPFormData } from './models'

// ── Lookup maps ───────────────────────────────────────────────────────────────
const MAT_EN: Record<string, string> = {
    pvc: 'white uPVC (polyvinyl chloride)',
    aluminium: 'brushed anodized aluminium',
    bois: 'solid wood with natural grain',
    mixte: 'wood-aluminium composite',
}
const ELEM_EN: Record<string, string> = {
    fenetre: 'double-glazed windows',
    porte: 'entrance door',
    volet: 'exterior shutters',
    baie_vitree: 'large sliding glazed doors (baie vitrée)',
}
const FINITION_EN: Record<string, string> = {
    enduit: 'smooth exterior render / mineral plaster coating',
    bardage_bois: 'horizontal wood cladding boards (bardage bois)',
    bardage_metal: 'flat metal / steel cladding panels',
    bardage_composite: 'composite HPL fiber-cement cladding panels',
}

// ── Prompt builder ────────────────────────────────────────────────────────────
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
            // Note: Isolation in Step 3 does NOT have a description textarea right now, we use a default based on fields
            rawDescription = `Isolation thermique par l'extérieur. Finition demandée : ${travaux.isolation.type_finition || 'enduit'} ${travaux.isolation.couleur ? 'couleur ' + travaux.isolation.couleur : ''}. Façades concernées : ${travaux.isolation.facades_concernees?.join(', ') || 'Toutes les façades'}.`
        }
        else if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
            // PV in Step 3 also doesn't have a description textarea, fallback to fields
            rawDescription = `Installation de ${travaux.photovoltaique.nombre_panneaux || '10'} panneaux photovoltaïques sur la toiture. Orientation : ${travaux.photovoltaique.orientation || 'Sud'}.`
        }
    }

    // ── Assemble final prompt ─────────────────────────────────────────────────
    const prompt = `You are an expert architectural visualization AI. Your task is to generate a realistic "after" simulation of a house based on the requested modifications.

REQUESTED CHANGES:
"${rawDescription}"

CONSTRAINTS (strictly enforced):
- YOU MUST KEEP EVERYTHING ELSE EXACTLY AS IN THE ORIGINAL PHOTO.
- The existing walls (unless modified by the request), roof structure, garden, driveway, surroundings, lighting, sky, and camera angle MUST remain 100% unchanged.
- Only apply the specific replacements or additions clearly mentioned in the requested changes. Do not invent new structures or alter the architectural style of unmentioned elements.
- Provide a photorealistic architectural result without any text, borders, or artificial artifacts.`

    return prompt
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

    const prompt = `You are an expert architectural illustrator. Create a professional 2D ARCHITECTURAL ELEVATION DRAWING (Facade) for a French residential building based on the provided image.

The provided image is a photorealistic simulation of the building AFTER works. Your task is to accurately convert this image into a formal architectural CAD drawing.

VISUAL STYLE (MANDATORY):
- Style: Clean 2D technical CAD elevation drawing (not a photo, not a sketch).
- Linework: Very thin, consistent clean black outlines for all structural elements.
- Colors: Muted "architectural" palette. Walls in light beige or warm grey. Roof in dark charcoal or slate grey.
- Shadows: Simple, flat, solid grey shadows at a 45-degree angle to show depth. No gradients.
- Background: Solid white background.
- Details: Include subtle material textures like fine grid for roof tiles.
- Content: DO NOT add or remove any architectural features from the provided image. Exactly replicate the structure shown in the image.
- Professionalism: No text, no people, no trees, no artifacts. Just the building facade on a white background.`

    return prompt
}

// ── SSE helper — reads text/event-stream and resolves with the final image ─
async function callImageAPI(payload: { prompt: string; imageBase64?: string }): Promise<string> {
    const res = await fetch('/api/generate-after-facade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || `API error ${res.status}`)
    }

    // Read SSE stream
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process all complete SSE lines in the buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // keep incomplete last line

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
                const msg = JSON.parse(line.slice(6)) as {
                    status: string
                    imageBase64?: string
                    imageUrl?: string
                    error?: string
                    message?: string
                }
                if (msg.status === 'done') {
                    if (msg.imageBase64) return msg.imageBase64
                    if (msg.imageUrl) return msg.imageUrl
                    throw new Error('No image in response')
                }
                if (msg.status === 'error') throw new Error(msg.error || 'AI generation failed')
                // 'generating' status — progress update, keep reading
                if (msg.message) console.log('[AI]', msg.message)
            } catch (parseErr) {
                // ignore malformed SSE lines
            }
        }
    }

    throw new Error('Stream ended without result')
}

// ── Client-side function called from Step 5 ───────────────────────────────────
export async function generateAIAfterImage(data: DPFormData): Promise<string> {
    const prompt = buildAIAfterImagePrompt(data)
    const imageBase64 = data.photos.facade_avant

    console.group('%c🤖 AI Facade Generation – gpt-image-1', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa')
    console.log(prompt)
    console.log('%cBefore image provided:', 'font-weight:bold;color:#34d399', !!imageBase64)
    console.groupEnd()

    const realImage = imageBase64?.startsWith('data:') ? imageBase64 : undefined
    return callImageAPI({ prompt, imageBase64: realImage })
}

export async function generateAICroquis(data: DPFormData, baseImage: string): Promise<string> {
    const prompt = buildAICroquisPrompt(data)
    const realImage = baseImage.startsWith('data:') ? baseImage : undefined

    console.group('%c🤖 AI Croquis Generation – gpt-image-1', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa')
    console.log(prompt)
    console.log('%cBase image provided (from DP6):', 'font-weight:bold;color:#34d399', !!realImage)
    console.groupEnd()

    return callImageAPI({ prompt, imageBase64: realImage })
}
