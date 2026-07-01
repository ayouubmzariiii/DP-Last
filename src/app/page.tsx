import { redirect } from 'next/navigation'

// The app is gated behind auth (see src/middleware.ts): only authenticated users reach `/`.
// Send them to their dossier manager, which is the true home of the account experience.
export default function Home() {
    redirect('/mes-dossiers')
}
