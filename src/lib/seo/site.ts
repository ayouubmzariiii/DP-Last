// Constantes partagées par les pages publiques indexables (guides /dp, sitemap,
// robots, JSON-LD). Une seule source pour l'URL canonique du site.

/** Origine canonique, sans slash final. Surchargeable par env sur Vercel. */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000')
).replace(/\/$/, '')

export const SITE_NAME = 'DP Travaux'

/** Les pages /dp sont indexables ; le reste de l'app est privé (voir robots.ts). */
export const canonical = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** Millésime affiché dans les titres/contenus ("… en 2026"). */
export const ANNEE = new Date().getFullYear()
