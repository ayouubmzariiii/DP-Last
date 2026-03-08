import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const { formData, photos } = await req.json()

        let applicantInfo = ''
        if (formData.demandeur.est_societe && formData.demandeur.nom_societe) {
            applicantInfo = `Le demandeur est une société (${formData.demandeur.type_societe || 'SOCIÉTÉ'}) nommée "${formData.demandeur.nom_societe}", représentée par ${formData.demandeur.civilite} ${formData.demandeur.prenom} ${formData.demandeur.nom}.`
        } else {
            applicantInfo = `Le demandeur est un particulier : ${formData.demandeur.civilite} ${formData.demandeur.prenom} ${formData.demandeur.nom}.`
        }

        const systemPrompt = `Tu es un expert en urbanisme francais. Rédige une Notice Descriptive (DP4) pour un dossier de Demande Préalable de Travaux.
            
CONTEXTE DU PROJET (Ne pas inclure ces infos mot pour mot dans la réponse) :
${applicantInfo}
L'adresse du projet est située à: ${formData.terrain.adresse}, ${formData.terrain.code_postal} ${formData.terrain.commune}.
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

        const content: any[] = [{ type: "text", text: systemPrompt }]

        if (photos && photos.length > 0) {
            for (const photoDataUrl of photos) {
                if (!photoDataUrl.startsWith('data:image')) continue
                content.push({
                    type: "image_url",
                    image_url: {
                        url: photoDataUrl
                    }
                })
            }
        }

        const invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        const response = await fetch(invoke_url, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "model": "mistralai/ministral-14b-instruct-2512",
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
            throw new Error(`NVIDIA API Error: ${response.status} ${errBody}`)
        }

        const data = await response.json()
        const generatedText = data.choices[0]?.message?.content || ''

        return NextResponse.json({ dp4: generatedText.trim() }, { status: 200 })

    } catch (err: any) {
        console.error('Error generating DP4 Text/Vision:', err)
        return NextResponse.json({ error: err.message || 'Erreur interne' }, { status: 500 })
    }
}
