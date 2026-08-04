import type { MetadataRoute } from 'next'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'
import { COMMUNES, communeParam } from '@/lib/seo/communes'
import { SITE_URL } from '@/lib/seo/site'

// Sitemap des seules pages publiques indexables : accueil, hub des guides, un
// guide par type de travaux, et leur déclinaison par commune. L'application
// (assistant, espace client, back-office) est exclue de l'index (voir robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date()

    const statiques: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
        { url: `${SITE_URL}/dp`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ]

    const guides: MetadataRoute.Sitemap = SEO_TRAVAUX.map(t => ({
        url: `${SITE_URL}/dp/${t.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }))

    // Hubs par commune — point de convergence du maillage interne, donc priorité
    // supérieure aux pages travaux×commune qu'ils distribuent.
    const villes: MetadataRoute.Sitemap = COMMUNES.map((c, i) => ({
        url: `${SITE_URL}/dp/ville/${communeParam(c)}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: i < 60 ? 0.8 : 0.7,
    }))

    // Priorité dégressive : les grandes villes portent le volume de recherche.
    const communes: MetadataRoute.Sitemap = SEO_TRAVAUX.flatMap(t =>
        COMMUNES.map((c, i) => ({
            url: `${SITE_URL}/dp/${t.slug}/${communeParam(c)}`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: i < 40 ? 0.7 : i < 120 ? 0.6 : 0.5,
        })),
    )

    return [...statiques, ...guides, ...villes, ...communes]
}
