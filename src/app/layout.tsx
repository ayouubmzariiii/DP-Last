import type { Metadata } from 'next'
import './globals.css'
import { DPProvider } from '@/lib/context'

export const metadata: Metadata = {
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
            </body>
        </html>
    )
}
