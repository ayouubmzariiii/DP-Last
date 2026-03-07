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

// ── Client-side function called from Step 5 ───────────────────────────────────
export async function generateAIAfterImage(data: DPFormData): Promise<string> {
    const prompt = buildAIAfterImagePrompt(data)
    const imageBase64 = data.photos.facade_avant  // pass before photo for image edit

    console.group('%c🤖 AI Facade Generation – gpt-image-1', 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cPrompt:', 'font-weight:bold;color:#60a5fa')
    console.log(prompt)
    console.log('%cBefore image provided:', 'font-weight:bold;color:#34d399', !!imageBase64)
    console.groupEnd()

    // Only pass the image if it's a real uploaded photo (data URL), not a placeholder URL
    const realImage = imageBase64?.startsWith('data:') ? imageBase64 : undefined

    const res = await fetch('/api/generate-after-facade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64: realImage }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `API error ${res.status}`)
    }

    const result = await res.json()

    // API returns either imageBase64 (data:image/png;base64,...) or imageUrl
    if (result.imageBase64) return result.imageBase64
    if (result.imageUrl) return result.imageUrl

    throw new Error('No image returned from API')
}
