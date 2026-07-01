import { redirect } from 'next/navigation'

// The dossier manager now lives in the account profile.
export default function MesDossiers() {
    redirect('/profil')
}
