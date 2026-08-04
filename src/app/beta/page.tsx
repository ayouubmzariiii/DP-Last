import type { Metadata } from 'next'
import PublicShell from '@/components/seo/PublicShell'
import BetaLanding from '@/components/BetaLanding'
import { canonical } from '@/lib/seo/site'

export const metadata: Metadata = {
    title: 'Programme de test — votre déclaration préalable montée gratuitement',
    description:
        'Nous cherchons une vingtaine de projets réels pour tester notre outil de déclaration préalable. Dossier complet offert, relecture humaine, corrections illimitées si la mairie demande des pièces.',
    alternates: { canonical: canonical('/beta') },
    // Page de recrutement : indexable, mais elle n'a pas vocation à capter des
    // requêtes génériques — ce sont les guides /dp qui portent le référencement.
    robots: { index: true, follow: true },
}

export default function BetaPage() {
    return (
        <PublicShell breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Programme de test' }]}>
            <BetaLanding />
        </PublicShell>
    )
}
