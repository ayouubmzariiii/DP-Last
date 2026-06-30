/**
 * AI Image Generation – "Après Travaux" Facade Simulation.
 * Prompts are built here; the actual generation runs server-side via
 * /api/generate-after-facade (a cheap OpenRouter image model). No API key ever
 * reaches the browser.
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

    return `Edit the attached photograph. Return the SAME photograph, pixel-for-pixel identical, with ONLY the requested modification applied. This is an in-place photo edit — it is NOT a request to imagine, redraw or generate a new building.

REQUESTED MODIFICATION (the only thing you may change):
"${rawDescription}"

ABSOLUTE RULES:
- The output MUST be the exact same building shown in the attached photo — same shape, same number of floors, same number and position of every window and door, same roof, same proportions, same materials (except where the modification explicitly changes them).
- Keep the camera angle, framing, perspective, zoom, background, neighbouring buildings, garden, sky and lighting 100% identical to the attached photo. Do not re-frame or re-compose the shot.
- Do NOT add or remove windows, doors, shutters, chimneys, balconies or any feature. Do NOT invent or substitute a different house.
- Apply the modification ONLY to the relevant surfaces (e.g. "paint the shutters blue" → recolour only the shutters; "exterior insulation render" → re-coat only the wall surfaces). Leave everything else untouched.
- Remove only transient clutter in front of the edited area (people, parked cars, bins) so the change is clearly visible.
- Photorealistic result, matching the original photo's quality and tone. No added text, captions, borders, arrows or watermarks.`
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

    return `Convert the attached photograph of a French house into a clean, professional 2D ARCHITECTURAL FAÇADE ELEVATION drawing (un plan de façade). Reproduce the exact same building — same number of floors, windows, doors, roof shape and proportions as in the photo.

FRAMING (must stay ALIGNED with the attached image):
- Keep the SAME composition, proportions and viewpoint as the attached photo so the drawing lines up with it one-to-one. Same relative position and size of every window, door, roof line and wall.
- Show the building head-on as a clean FRONTAL orthographic elevation. If the photo is slightly angled, gently straighten it to frontal WITHOUT changing the layout or proportions.
- Frame the COMPLETE façade, centred, with only a small even margin. Do NOT crop off any part of the building, and do NOT zoom out so far that it looks small/distant. Drop only the surrounding street/sky/neighbours, keeping the building at the same scale it has in the photo.
- Large and crisp enough that every window, door and material is clearly legible.

VISUAL STYLE (MANDATORY):
- Clean 2D technical CAD elevation (not a photo, not a loose sketch).
- Crisp, confident black outlines — clearly visible, consistent weight, slightly thicker on the building's outer contour.
- Muted architectural palette: walls light beige/warm grey, roof dark slate/charcoal, joinery in its real colour.
- Simple flat solid grey shadows at 45° for depth. No gradients, no blur.
- Solid pure-white background.
- Subtle material hatching (fine line grid for roof tiles, light texture for cladding).
- A discreet horizontal ground line under the building.

ANNOTATIONS: a few thin black leader lines pointing to the modified areas, each with a short, legible French label (e.g. "Menuiseries aluminium RAL 7016", "Isolation par l'extérieur — enduit", "Panneaux photovoltaïques"). Keep labels minimal and readable.
NO people, no cars, no trees, no photo background, no watermark.`
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

// ── Core API caller — redirects to server-side OpenRouter endpoint ────────────
async function callOpenAIDirect(payload: {
    prompt: string
    imageBase64?: string   // data:image/... for edit, undefined for generate
}): Promise<string> {
    const res = await fetch('/api/generate-after-facade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: payload.prompt,
            imageBase64: payload.imageBase64
        })
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error || `Image generation failed (${res.status})`)
    }

    const data = await res.json()
    const imageUrl = data.imageBase64 || data.imageUrl
    if (!imageUrl) throw new Error('No image returned from API')
    return imageUrl
}

// ── Public API ────────────────────────────────────────────────────────────────
// NOTE: per-façade "after" generation is done directly in étape 6 (POST /api/generate-after-facade
// with each facades[i].before). A former generateAIAfterImage(data) helper read the DEPRECATED
// photos.facade_avant single field and was removed — it could silently fall through to a
// from-scratch generation (the "different house" bug) for any façade beyond the first.

export async function generateAICroquis(data: DPFormData, baseImage: string, customInstruction?: string): Promise<string> {
    const prompt = buildAICroquisPrompt(data, customInstruction)
    const realImage = baseImage && /^(data:|https?:|\/)/.test(baseImage) ? baseImage : undefined

    console.group('%c🤖 AI Croquis Generation – gpt-image-1 (browser)', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa', prompt)
    console.log('%cBase image provided:', 'font-weight:bold;color:#34d399', !!realImage)
    console.groupEnd()

    return callOpenAIDirect({ prompt, imageBase64: realImage })
}
