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
1. Apply the requested changes as photo-realistically as possible.
2. YOU MUST KEEP EVERYTHING ELSE EXACTLY AS IN THE ORIGINAL PHOTO.
3. The existing walls (unless modified by the request), roof structure, garden, driveway, surroundings, lighting, sky, and camera angle MUST remain 100% unchanged.
4. Only apply the specific replacements or additions clearly mentioned in the requested changes. Do not invent new structures or alter the architectural style of unmentioned elements.
5. Provide a photorealistic architectural result without any text, borders, or artificial artifacts.`

    return {
        prompt,
        changeSummary,
        negativePrompt: 'cartoon, render, CGI, extra openings, missing openings, changed walls, different angle, changed garden, changed roof, blurry, low quality',
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
