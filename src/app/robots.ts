import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site'

// Seules les pages marketing et les guides /dp sont indexables. Tout ce qui
// relève de l'application (assistant, dossiers, compte, back-office, API) est
// exclu : ces routes sont de toute façon gardées par le middleware, mais on
// évite qu'elles apparaissent en SERP ou consomment du budget de crawl.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/admin', '/admin/', '/etape/', '/mes-dossiers', '/profil', '/checkout', '/reinitialiser', '/mot-de-passe-oublie'],
        }],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    }
}
