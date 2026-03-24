import { DPFormData, Travaux } from './models'

export interface AfterFacadePromptData {
    prompt: string
    negativePrompt: string
    isReady: boolean
    changeSummary: string
}

export function buildAfterFacadePrompt(t: Travaux, overridePrompt?: string, hasBeforeImage: boolean = true): AfterFacadePromptData {
    let userDescription = ''
    let changeSummary = ''

    if (overridePrompt) {
        userDescription = overridePrompt
        changeSummary = 'Modification personnalisée'
    } else {
        if (t.type === 'menuiseries') {
            userDescription = t.menuiseries?.description || `Remplacement de menuiseries (${t.menuiseries?.nombre || 1} ${t.menuiseries?.type || 'fenêtre'}) en ${t.menuiseries?.materiau || 'pvc'} ${t.menuiseries?.couleur || ''}`
            changeSummary = `Menuiseries ${t.menuiseries?.materiau || ''}`
        } else if (t.type === 'isolation') {
            userDescription = `Isolation thermique par l'extérieur. Finition demandée : ${t.isolation?.type_finition || 'enduit'} ${t.isolation?.couleur ? 'couleur ' + t.isolation.couleur : ''}. Façades concernées : ${t.isolation?.facades_concernees?.join(', ') || 'Toutes les façades'}.`
            changeSummary = `ITE ${t.isolation?.type_finition || ''}`
        } else if (t.type === 'photovoltaique') {
            // Materiau couverture doesn't exist on photovoltaique, let's omit it
            userDescription = `Installation de ${t.photovoltaique?.nombre_panneaux || '10'} panneaux photovoltaïques sur la toiture. Orientation : ${t.photovoltaique?.orientation || 'Sud'}.`
            changeSummary = `Panneaux PV (${t.photovoltaique?.nombre_panneaux || 0})`
        } else {
            userDescription = 'Amélioration architecturale de la façade.'
            changeSummary = 'Modifications'
        }
    }

    const prompt = `You are an expert architectural visualization AI. Your task is to generate a realistic "after" simulation of a house based on the requested modifications.

Requested changes:
"${userDescription}"

STRICT INSTRUCTIONS:
1. DO NOT ADD ANY NEW ELEMENTS. You must not add windows, doors, shutters, chimneys, or any architectural features that were not present in the original photo.
2. DO NOT REMOVE OR MOVE EXISTING ELEMENTS. Keep all existing windows, doors, and structural features in their exact same positions, shapes, and sizes. The number of windows and doors MUST NOT change.
3. KEEP THE PHOTO IDENTICAL. The existing walls (unless specifically being re-rendered by request), roof structure, garden, driveway, surroundings, lighting, sky, and camera angle MUST remain 100% unchanged.
4. ONLY IMPLEMENT REQUESTED CHANGES. If the request is for "painting the door", ONLY change the color of the door. Do not touch the windows. If the request is for "cladding", only apply cladding to the specified areas.
5. CLEAR THE VIEW. Remove any temporary obstacles, people, cars, or objects that might be in front of the areas being modified (like windows or walls) to ensure the changes are clearly visible.
6. ZERO CREATIVITY FOR UNMENTIONED AREAS. Do not invent new structures or alter the architectural style of unmentioned elements.
7. Ensure a photorealistic architectural result without any text, borders, or artificial artifacts.`

    return {
        prompt,
        changeSummary,
        negativePrompt: 'extra windows, extra doors, new openings, missing openings, changed architecture, changed walls, different camera angle, changed garden, changed roof, blurry, low quality, cartoon, render, CGI, text, watermark, people, cars, trucks, trash cans, scaffolding, clutter',
        isReady: hasBeforeImage && !!t.type
    }
}

// ── Console logger ────────────────────────────────────────────────────────────
export function consoleLogAfterPrompt(data: DPFormData, stepName = 'Etape 5') {
    const result = buildAfterFacadePrompt(data.travaux, undefined, !!data.photos.facade_avant)
    if (!result.isReady) return

    console.group(`%c🤖 AI Prompt – Après Travaux [${stepName}]`, 'color:#a78bfa;font-weight:bold;font-size:13px')
    console.log('%cChange:', 'font-weight:bold;color:#60a5fa', result.changeSummary)
    console.log('%c\n── PROMPT (pass with before image) ──────────────────────', 'color:#475569')
    console.log(result.prompt)
    console.log('%c\n── NEGATIVE PROMPT ──────────────────────────────────────', 'color:#475569')
    console.log(result.negativePrompt)
    console.log('%c\n── HOW TO CALL ──────────────────────────────────────────', 'color:#475569')
    console.log('POST /v1/images/edits')
    console.log('  model: "dall-e-2" (supports image edits) or gpt-4')
    console.log('  image: formData.photos.facade_avant  (base64 PNG)')
    console.log('  prompt: <above>')
    console.log('  n: 1 | size: "1024x1024"')
    console.groupEnd()
}
