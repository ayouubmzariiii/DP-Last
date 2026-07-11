/**
 * AI Image Generation – "Après Travaux" Facade Simulation.
 * Prompts are built here; the actual generation runs server-side via
 * /api/generate-after-facade (a cheap OpenRouter image model). No API key ever
 * reaches the browser.
 */
import { DPFormData } from './models'
import { getTravauxDef } from './travauxRegistry'

// Common teinte / RAL codes → a plain-language visual colour. Image models don't reliably know RAL
// codes or French nuancier terms, so we spell out the actual colour — otherwise "RAL 1015 (ton
// pierre)" gets painted an arbitrary grey/blue. Keys are matched case-insensitively as substrings.
const COLOUR_HINTS: Record<string, string> = {
    'ton pierre': 'a warm pale beige / natural sandstone tone (NOT grey, NOT white)',
    'ral 1013': 'oyster white — a very pale warm off-white',
    'ral 1014': 'ivory — a pale warm beige',
    'ral 1015': 'light ivory — a pale creamy warm beige (NOT grey, NOT white)',
    'ral 1001': 'beige',
    'ral 1002': 'sand yellow',
    'ral 9001': 'cream',
    'ral 9010': 'pure white',
    'ral 9016': 'bright white',
    'ral 7016': 'anthracite — a very dark charcoal grey',
    'ral 7030': 'stone grey — a pale warm grey',
    'ral 7035': 'light grey',
    'sable': 'sand beige',
    'ocre': 'warm ochre / golden beige',
    'blanc cassé': 'off-white',
    'blanc casse': 'off-white',
}
function colourGuidance(text: string): string {
    const s = text.toLowerCase()
    for (const [k, v] of Object.entries(COLOUR_HINTS)) if (s.includes(k)) return v
    return ''
}
// The colour the user actually asked for, per work type (couleur field + RAL where relevant).
function intendedColour(data: DPFormData): string {
    const t = data.travaux
    const j = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(' ').trim()
    if (t.type === 'ravalement') return j(t.ravalement?.couleur)
    if (t.type === 'menuiseries') return j(t.menuiseries?.couleur, t.menuiseries?.couleur_ral)
    if (t.type === 'isolation') return j(t.isolation?.couleur)
    if (t.type === 'cloture') return j(t.cloture?.couleur)
    if (t.type === 'toiture') return j(t.toiture?.couleur)
    return ''
}

// Per work type: the ONLY surface allowed to change, and the elements that must stay EXACTLY as in
// the photo. Naming the elements the model tends to wrongly alter (joinery colour, roof, shutters…)
// is far more effective than a generic "change only the requested surface".
const SURFACE_SCOPE: Record<string, { change: string; keep: string }> = {
    ravalement: {
        change: 'the wall render / paint of the façade',
        keep: 'every window, door, shutter, the roof, chimney and gutters — including their exact existing colours and materials',
    },
    isolation: {
        change: 'the exterior wall surface (new render or cladding)',
        keep: 'every window, door, shutter, the roof, chimney and gutters — including their exact existing colours and materials',
    },
    menuiseries: {
        change: 'the windows, doors and/or shutters (their material and colour)',
        keep: 'the wall render and its colour, the roof, and every other surface exactly as in the photo',
    },
    toiture: {
        change: 'the roof covering',
        keep: 'the walls, windows, doors, shutters and their colours exactly as in the photo',
    },
    photovoltaique: {
        change: 'ONLY add the solar panels onto the existing roof',
        keep: 'the walls, windows, doors, the roof shape/slope and every existing surface exactly as in the photo',
    },
    cloture: {
        change: 'the fence / boundary wall',
        keep: 'the house — its walls, windows, doors, roof — and the ground, exactly as in the photo',
    },
    ouverture: {
        change: 'only the single opening described (add / enlarge / remove it)',
        keep: 'every other window and door, the walls, the roof and their colours exactly as in the photo',
    },
}

// ── Prompt builders ───────────────────────────────────────────────────────────
export function buildAIAfterImagePrompt(data: DPFormData, customInstruction?: string): string {
    const { travaux } = data

    let rawDescription = ''

    if (customInstruction) {
        rawDescription = customInstruction
    } else {
        // Per-type "après travaux" description comes from the travaux registry (single source).
        rawDescription = getTravauxDef(travaux.type)?.aiDescription(data) || ''
    }

    // Pin the colour: the description names it (e.g. "RAL 1015 (ton pierre)") but models paint an
    // arbitrary colour unless told exactly what it looks like. Only added when the effective
    // instruction actually references that colour (so a hand-edited instruction isn't overridden).
    const colour = intendedColour(data)
    const guide = colourGuidance(rawDescription) || colourGuidance(colour)
    const mentionsColour = !!colour && rawDescription.toLowerCase().includes(colour.toLowerCase())
    const colourBlock = (mentionsColour || guide)
        ? `\n\nEXACT COLOUR (critical): the treated surface must be ${colour ? `"${colour}"` : 'the colour named above'}${guide ? ` — i.e. ${guide}` : ''}. Reproduce this exact colour uniformly across the whole treated surface. Do NOT invent or approximate a different colour; in particular do NOT default to grey, blue or white unless that is the colour named above.`
        : ''

    const scope = SURFACE_SCOPE[travaux.type]
    const scopeBlock = scope
        ? `\n\nSCOPE — CHANGE ONE THING ONLY:\n- You may change ONLY ${scope.change}.\n- Everything else MUST stay pixel-identical to the photo: ${scope.keep}. Do NOT recolour, replace, clean up or restyle them in any way. If in doubt about an element, leave it EXACTLY as it is in the photo.`
        : ''

    return `Edit the attached photograph in place. Return the SAME photograph with ONLY the requested modification(s) applied. This is an in-place photo edit — NOT a request to imagine, redraw, re-photograph or generate a new building.

CAMERA & FRAMING — DO NOT CHANGE (most important rule):
- Keep the EXACT same camera angle, viewpoint, perspective and rotation as the attached photo. Do NOT rotate the building, do NOT switch to a more frontal/3-quarter view, do NOT change where the camera is.
- Keep the EXACT same zoom, distance and framing. The building must occupy the same area of the frame and be the same size. Do NOT zoom in or out, do NOT crop, do NOT re-centre or re-compose.
- Output the SAME image dimensions and aspect ratio as the input. Keep the background, neighbouring buildings, garden, sky and lighting identical.

REQUESTED MODIFICATION(S) — apply ALL of them (a renovation can change several things at once: material, colour, finish, openings…):
"${rawDescription}"

ABSOLUTE RULES:
- The output MUST be the exact same building — same shape, same number of floors, same number and position of every window and door, same roof, same proportions. Change ONLY the materials/colours/elements named in the modification(s) above; leave everything else identical.
- Do NOT add or remove windows, doors, shutters, chimneys, balconies or any feature that the modification does not explicitly mention.
- Apply each modification only to the relevant surfaces (e.g. "peinture ton pierre" → recolour only the wall render; "menuiseries aluminium noir" → only the window/door frames).
- Remove only transient clutter in front of the edited area (people, parked cars, bins) so the change is clearly visible.
- Photorealistic result, matching the original photo's quality, tone and lighting. No added text, captions, borders, arrows or watermarks.${scopeBlock}${colourBlock}`
}

export function buildAICroquisPrompt(_data: DPFormData, _customInstruction?: string): string {
    // NOTE: the croquis is generated deliberately TEXT-FREE. The image model is unreliable at
    // rendering small printed labels (it produced garbled French like "menusries"/"antchaite"),
    // so the works annotation (leader line + label) is drawn afterwards as crisp pdf-lib vector
    // text in the DP5 renderer (see dpDocGenerator.ts → drawWorksAnnotation). The prompt below
    // therefore forbids ANY written characters in the generated drawing.
    return `Trace the attached photograph of a French house into a clean, professional 2D ARCHITECTURAL FAÇADE ELEVATION drawing (un plan de façade). This is a TRACING task: reproduce EXACTLY the building in the photo — do not redesign, stylise or imagine anything.

FIDELITY (the drawing must match the photo one-to-one — this is the most important rule):
- COUNT the storeys, and every window, door, shutter and roof opening in the photo, and draw EXACTLY that same count — never add, remove, merge or split any opening.
- Keep the EXACT position, size, proportion and spacing of every window, door, wall edge, roof slope and chimney as in the photo. A window that is tall and narrow stays tall and narrow; an off-centre door stays off-centre.
- Preserve the real geometry: roof pitch and overhang, relative widths of wall sections, ground level. Do not "tidy up" into a generic symmetrical house.
- Reproduce the real materials and their real colours (wall render tone, roof covering, joinery colour) exactly as seen.

FRAMING:
- Show the building head-on as a clean FRONTAL orthographic elevation. If the photo is slightly angled, gently straighten it to frontal WITHOUT changing the layout, counts or proportions.
- Frame the COMPLETE façade, centred, small even margin. Do NOT crop any part of the building; do NOT shrink it into the distance. Drop only the surrounding street/sky/neighbours.
- Large and crisp enough that every window, door and material is clearly legible.

VISUAL STYLE (MANDATORY):
- Clean 2D technical CAD elevation (not a photo, not a loose sketch).
- Crisp, confident black outlines — consistent weight, slightly thicker on the building's outer contour.
- Muted architectural palette: walls in their real render tone, roof dark slate/charcoal, joinery in its real colour.
- Simple flat solid grey shadows at 45° for depth. No gradients, no blur.
- Solid pure-white background.
- Subtle material hatching (fine line grid for roof tiles, light texture for cladding).
- A discreet horizontal ground line under the building.

STRICTLY NO TEXT: the drawing must contain ZERO written characters — no labels, no annotations, no leader lines, no dimensions, no title block, no legend, no watermark, no scale text. A separate step adds the labels afterwards.
NO people, no cars, no trees, no photo background.`
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
