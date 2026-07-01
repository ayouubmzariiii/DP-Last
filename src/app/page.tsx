import { redirect } from 'next/navigation'

// The app is gated behind auth (see src/middleware.ts): only authenticated users reach `/`.
// Send them to their profile, the home of the account experience (identity + all projects).
export default function Home() {
    redirect('/profil')
}
