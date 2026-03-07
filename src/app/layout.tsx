import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { DPProvider } from '@/lib/context'

const inter = Inter({ subsets: ['latin'] })

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
            <body className={inter.className}>
                <DPProvider>
                    {children}
                </DPProvider>
            </body>
        </html>
    )
}
