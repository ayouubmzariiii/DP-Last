import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/site'

// ─────────────────────────────────────────────────────────────────────────────
// Seules les pages marketing et les guides /dp sont destinées aux moteurs. Tout
// ce qui relève de l'application — espace client, assistant, back-office, API,
// écrans d'authentification — est exclu de l'exploration.
//
// Trois niveaux de protection, du plus faible au plus fort :
//   1. robots.txt (ce fichier) — une demande, respectée par les robots sérieux.
//   2. X-Robots-Tag: noindex (middleware.ts) — la directive qui interdit
//      réellement l'indexation, y compris des réponses JSON des API.
//   3. La porte d'authentification (middleware.ts) — la seule protection
//      effective contre un aspirateur qui ignore les deux premières : sans
//      cookie de session valide, il n'y a tout simplement rien à lire.
// ─────────────────────────────────────────────────────────────────────────────

/** Tout ce qui n'est ni l'accueil, ni /dp. Aligné sur isIndexable() du middleware. */
const PRIVE = [
    '/api/',
    '/admin',
    '/admin/',
    '/etape/',
    '/mes-dossiers',
    '/profil',
    '/checkout',
    '/login',
    '/register',
    '/reinitialiser',
    '/mot-de-passe-oublie',
]

// Robots d'IA et d'aspiration de contenu. Ils ne sont PAS bannis du site : être
// cité par une recherche assistée par IA sur « déclaration préalable abri de
// jardin » est un canal d'acquisition, pas une fuite. Ils sont simplement soumis
// aux mêmes exclusions que les autres sur les pages privées.
// Pour les bannir totalement, remplacer `allow` par `disallow: '/'` ci-dessous.
const ROBOTS_IA = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
    'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
    'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'Applebot-Extended', 'meta-externalagent',
    'CCBot', 'Bytespider', 'Amazonbot', 'Diffbot', 'omgili', 'Timpibot',
]

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/', disallow: PRIVE },
            { userAgent: ROBOTS_IA, allow: ['/', '/dp'], disallow: PRIVE },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    }
}
