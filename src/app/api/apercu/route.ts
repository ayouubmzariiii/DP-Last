import { NextRequest, NextResponse } from 'next/server'
import { generateCerfa } from '@/lib/pdfGenerator'
import { generateDPDocument } from '@/lib/dpDocGenerator'
import { stampSpecimen } from '@/lib/pdfSpecimen'
import { defaultFormData, DPFormData } from '@/lib/models'

// ─────────────────────────────────────────────────────────────────────────────
// Aperçu PUBLIC du livrable — le CERFA rempli et le dossier DP complet, produits
// par les MÊMES générateurs que ceux du parcours payant, à partir du jeu d'essai
// (données fictives + visuels de démonstration livrés dans /public/test).
//
// Pourquoi une route dédiée plutôt que /api/generate-dp :
//   • celle-ci exige une session, et un prospect n'en a pas ;
//   • elle refuse par construction tout dossier contenant un visuel de
//     démonstration (garde de sampleAssets) — garde que l'on ne veut surtout pas
//     affaiblir, puisqu'elle protège les VRAIS dossiers. Ici, les visuels de
//     démonstration sont précisément le sujet.
//
// Tout ce qui sort d'ici est estampillé SPÉCIMEN : c'est un document officiel
// portant une adresse réelle, il ne doit jamais pouvoir passer pour un dépôt.
//
//   GET /api/apercu?doc=cerfa           → CERFA rempli (A4)
//   GET /api/apercu?doc=dp              → dossier complet DP1–DP11 (A3)
//   GET /api/apercu?doc=dp&page=2       → la page 2 en JPEG (aperçu affichable partout)
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs'
export const maxDuration = 60
// Pas de `revalidate` ici : la route lit ses paramètres de requête, donc Next la traite
// comme dynamique et l'ignorerait. La mise en cache se joue à deux niveaux, tous deux
// réels : l'en-tête Cache-Control ci-dessous (CDN, une journée) et le mémo par instance
// (le PDF assemblé, réutilisé d'une page de vignette à l'autre).

/** Jeu d'essai prêt à générer : le fixture est livré non signé. */
function sampleData(): DPFormData {
    const d = JSON.parse(JSON.stringify(defaultFormData)) as DPFormData
    if (d.engagement) d.engagement.signature = true
    return d
}

// ── Mémo par instance ────────────────────────────────────────────────────────
// La bande de vignettes demande 4 pages du dossier : sans mémo, chacune ré-assemblerait
// les 4,4 Mo du PDF (≈ 5 s de calcul) pour n'en rendre qu'une image. On garde donc le
// PDF assemblé, et on DÉ-DUPLIQUE les générations concurrentes : quatre requêtes qui
// arrivent ensemble sur une instance froide attendent le même travail, pas quatre.
const TTL_MS = 10 * 60_000
const memo = new Map<string, { at: number; work: Promise<Uint8Array> }>()

function buildPdf(isDP: boolean): Promise<Uint8Array> {
    const key = isDP ? 'dp' : 'cerfa'
    const hit = memo.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.work
    const work = (async () => {
        const data = sampleData()
        const raw = isDP
            ? await generateDPDocument(data, { dossierId: 'apercu-public' })
            : (await generateCerfa(data)).bytes
        return await stampSpecimen(raw)
    })()
    // Un échec ne doit pas être mémorisé : on purge pour que l'appel suivant retente.
    work.catch(() => { if (memo.get(key)?.work === work) memo.delete(key) })
    memo.set(key, { at: Date.now(), work })
    return work
}

export async function GET(req: NextRequest) {
    const doc = (req.nextUrl.searchParams.get('doc') || 'dp').toLowerCase()
    const isDP = doc === 'dp' || doc === 'dossier'
    const download = req.nextUrl.searchParams.get('dl') === '1'

    try {
        const bytes = await buildPdf(isDP)

        // Aperçu image : une page rendue en JPEG. C'est ce que la page d'accueil affiche —
        // une <iframe> PDF laisse un cadre vide sur les navigateurs sans lecteur intégré.
        const pageParam = req.nextUrl.searchParams.get('page')
        if (pageParam) {
            const { renderPdfPage } = await import('@/lib/pdfThumbs')
            const shot = await renderPdfPage(bytes, parseInt(pageParam, 10) || 1, isDP ? 1400 : 900)
            if (!shot) return NextResponse.json({ error: 'Page indisponible.' }, { status: 404 })
            return new NextResponse(new Uint8Array(shot.jpeg), {
                status: 200,
                headers: {
                    'Content-Type': 'image/jpeg',
                    'X-Total-Pages': String(shot.pages),
                    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
                    'X-Robots-Tag': 'noindex',
                },
            })
        }

        const filename = isDP ? 'Exemple_Dossier_DP.pdf' : 'Exemple_CERFA.pdf'
        return new NextResponse(Buffer.from(bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
                'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
                // L'aperçu ne doit pas concurrencer les pages du site dans l'index.
                'X-Robots-Tag': 'noindex',
            },
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[apercu] génération échouée :', msg)
        return NextResponse.json({ error: "L'aperçu n'a pas pu être généré." }, { status: 500 })
    }
}
