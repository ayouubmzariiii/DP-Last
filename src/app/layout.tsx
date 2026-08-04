import type { Metadata } from 'next'
import './globals.css'
import { DPProvider } from '@/lib/context'
import Analytics from '@/components/Analytics'
import FeedbackWidget from '@/components/FeedbackWidget'
import { SITE_URL } from '@/lib/seo/site'

export const metadata: Metadata = {
    // metadataBase rend les canonical/OpenGraph absolus sur les pages /dp.
    metadataBase: new URL(SITE_URL),
    title: 'DP Travaux – Demande Préalable de Travaux',
    description: 'Générez automatiquement vos documents pour votre demande préalable de travaux auprès de la mairie.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="fr">
            {/* Fonts (Spectral / IBM Plex Sans / IBM Plex Mono) are loaded in globals.css.
                Body font-family is set there so the warm-paper theme applies globally. */}
            <body>
                <DPProvider>
                    {children}
                </DPProvider>
                {/* Croissance — strictement passifs : la mesure d'entonnoir et le widget
                    de retour n'interviennent dans aucun parcours produit. */}
                <Analytics />
                <FeedbackWidget />
            </body>
        </html>
    )
}
