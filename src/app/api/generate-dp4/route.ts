import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        if (!(await getSession())) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
        const { formData, photos } = await req.json()

        let applicantInfo = ''
        if (formData.demandeur.est_societe) {
            applicantInfo = `Le demandeur est une société.`
        } else {
            applicantInfo = `Le demandeur est un particulier.`
        }

        const systemPrompt = `Tu es un expert en urbanisme francais. Rédige une Notice Descriptive (DP4) pour un dossier de Demande Préalable de Travaux.
            
CONTEXTE DU PROJET (Ne pas inclure ces infos mot pour mot dans la réponse) :
${applicantInfo}
La commune du projet est située à: ${formData.terrain.commune || ''} (${formData.terrain.code_postal || ''}).
Le projet concerne: ${formData.travaux.type} (${formData.terrain.description_projet || formData.travaux.description_projet || 'Rénovation extérieure'}).
IMPÉRATIF DE COHÉRENCE : la notice doit décrire EXACTEMENT et UNIQUEMENT les travaux déclarés ci-dessus. N'invente, n'ajoute et ne mentionne AUCUN autre travaux (pas d'isolation par l'extérieur, de réfection de toiture ou de panneaux photovoltaïques) s'ils ne font pas explicitement partie du projet déclaré.

CONSIGNES HYPER STRICTES ET IMPÉRATIVES (POUR L'INTÉGRATION PDF) :
1. NE METS AUCUN TITRE GÉNÉRAL (ex: pas de "NOTICE DESCRIPTIVE", pas de "Dossier n°").
2. NE MENTIONNE PAS le nom du demandeur, l'adresse, ou des informations de contact dans ta réponse. Rédige UNIQUEMENT le contenu technique des 3 rubriques.
3. N'INCLUS AUCUNE phrase d'introduction ni de conclusion. N'inclut aucun "[à compléter]" ni "[X]". Si tu n'as pas l'info exacte, reste général ou omet-le.
4. UTILISE UNIQUEMENT DES MAJUSCULES NORMALES pour les 3 titres obligatoires. NE METS AUCUN ASTÉRISQUE (* ou **) NULLE PART. SANS EXCEPTION.
5. Analyse les photos fournies pour décrire visuellement l'environnement et le projet.

Tu dois produire EXACTEMENT et UNIQUEMENT le texte suivant organisé sous ces 3 titres exacts (sans tirets, sans astérisques) :
ETAT INITIAL DU TERRAIN ET DE SES ABORDS
[Ton texte ici...]

DESCRIPTION DU PROJET
[Ton texte ici...]

INTEGRATION DANS L'ENVIRONNEMENT
[Ton texte ici...]`

        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 503 })
        }
        // A cheap but capable model — the previous 'openrouter/free' produced degenerate output
        // (leaked <pad> tokens, "de de de…" repetition loops). gemini-2.5-flash is a few hundredths
        // of a cent per notice and supports the photo (vision) input. Override via OPENROUTER_DP4_MODEL.
        const model = process.env.OPENROUTER_DP4_MODEL || 'google/gemini-2.5-flash'

        const validPhotos = photos ? photos.filter((p: string) => typeof p === 'string' && p.startsWith('data:image')) : []
        const withImages = validPhotos.length > 0
            ? [{ type: "text", text: systemPrompt }, ...validPhotos.map((p: string) => ({ type: "image_url", image_url: { url: p } }))]
            : systemPrompt

        // Call OpenRouter and robustly extract the text. Returns '' on any failure so the
        // caller can fall back (e.g. retry text-only) instead of crashing on a missing `choices`.
        const callModel = async (content: any): Promise<string> => {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "HTTP-Referer": "https://github.com/ayouubmzariiii/DP-Last",
                    "X-Title": "DP Travaux DP4 Notice"
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: "user", content }],
                    max_tokens: 2048,
                    temperature: 0.15,
                    stream: false
                })
            })
            if (!response.ok) {
                console.error(`[DP4] OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`)
                return ''
            }
            const data = await response.json().catch(() => ({}))
            return sanitizeNotice(data?.choices?.[0]?.message?.content || '')
        }

        // Strip model artifacts (special tokens) and collapse degenerate repetition loops
        // (e.g. "de de de de …") that some cheap models emit.
        const sanitizeNotice = (raw: string): string => {
            let t = (raw || '')
                .replace(/<\/?(pad|unk|s|eos|bos)>/gi, ' ')
                .replace(/<\|[^|>]*\|>/g, ' ')
            // Collapse any word repeated 4+ times in a row down to a single occurrence.
            t = t.replace(/\b(\S{1,15})(?:\s+\1\b){3,}/gi, '$1')
            return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
        }

        // A real notice is substantial and contains the required section headers. The free model
        // sometimes replies with junk (e.g. a moderation string like "User Safety: safe") — reject
        // those so they never reach the dossier/cache.
        const isValidNotice = (t: string): boolean => {
            if (!t || t.trim().length < 150) return false
            const u = t.toUpperCase()
            const headers = ['ETAT INITIAL', 'ÉTAT INITIAL', 'DESCRIPTION DU PROJET', 'INTEGRATION', 'INTÉGRATION']
            return headers.some(h => u.includes(h))
        }

        // Try vision first, then fall back to text-only; retry a couple of times because free
        // routing is flaky and occasionally returns a non-notice response.
        let generatedText = ''
        const attempts = [withImages, systemPrompt, systemPrompt]
        for (const content of attempts) {
            const t = await callModel(content)
            if (isValidNotice(t)) { generatedText = t; break }
            console.warn('[DP4] invalid/empty notice, retrying. Got:', t.slice(0, 80))
        }
        if (!generatedText) {
            return NextResponse.json({ error: 'Le modèle n’a pas renvoyé de notice valide. Réessayez.' }, { status: 502 })
        }

        return NextResponse.json({ dp4: generatedText }, { status: 200 })

    } catch (err: any) {
        console.error('Error generating DP4 Text/Vision:', err)
        return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
    }
}
