import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import MarketingSite from '@/components/MarketingSite'

// Public landing page. Guests see the marketing site (Accueil / Comment ça marche /
// Tarifs / FAQ / Contact). Authenticated users are sent to their profile — the home
// of the account experience — preserving the pre-existing behaviour.
export default async function Home() {
    const session = await getSession()
    if (session) redirect('/profil')
    return <MarketingSite />
}
