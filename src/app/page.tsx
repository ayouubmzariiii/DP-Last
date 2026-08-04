import { getSession } from '@/lib/auth'
import MarketingSite from '@/components/MarketingSite'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'

// Public landing page — the marketing site (Accueil / Comment ça marche / Tarifs /
// FAQ / Contact) is shown to everyone. Authenticated visitors get an adapted header
// ("Mon espace" → /profil) instead of being redirected away, so the landing page is
// always reachable at the root domain.
export default async function Home() {
    const session = await getSession()
    // Index réduit des guides, projeté ICI (côté serveur) : le module de contenu
    // /lib/seo/travaux reste hors du bundle client de l'accueil.
    const guides = SEO_TRAVAUX.map(t => ({ slug: t.slug, nom: t.nom }))
    return <MarketingSite authed={!!session} guides={guides} />
}
