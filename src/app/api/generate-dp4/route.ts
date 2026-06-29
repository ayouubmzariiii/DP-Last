import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
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
Le projet concerne: ${formData.travaux.type} (${formData.travaux.description_projet || 'Rénovation extérieure'}).

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

        const validPhotos = photos ? photos.filter((p: string) => p.startsWith('data:image')) : []
        const content = validPhotos.length > 0
            ? [{ type: "text", text: systemPrompt }, ...validPhotos.map((p: string) => ({ type: "image_url", image_url: { url: p } }))]
            : systemPrompt

        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 503 })
        }

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
                "model": "openrouter/free",
                "messages": [{ "role": "user", "content": content }],
                "max_tokens": 2048,
                "temperature": 0.15,
                "top_p": 1.00,
                "frequency_penalty": 0.00,
                "presence_penalty": 0.00,
                "stream": false
            })
        })

        if (!response.ok) {
            const errBody = await response.text()
            throw new Error(`OpenRouter API Error: ${response.status} ${errBody}`)
        }

        const data = await response.json()
        const generatedText = data.choices[0]?.message?.content || ''

        return NextResponse.json({ dp4: generatedText.trim() }, { status: 200 })

    } catch (err: any) {
        console.error('Error generating DP4 Text/Vision:', err)
        return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
    }
}
