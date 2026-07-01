import { getSession } from '@/lib/auth'
import MarketingSite from '@/components/MarketingSite'

// Public landing page — the marketing site (Accueil / Comment ça marche / Tarifs /
// FAQ / Contact) is shown to everyone. Authenticated visitors get an adapted header
// ("Mon espace" → /profil) instead of being redirected away, so the landing page is
// always reachable at the root domain.
export default async function Home() {
    const session = await getSession()
    return <MarketingSite authed={!!session} />
}
