'use client'

// Suivi automatique des vues de page. Monté une seule fois dans le layout racine :
// c'est ce qui permet de mesurer l'entonnoir complet de l'assistant (étapes 1 à 7)
// SANS avoir instrumenté une seule des pages d'étape.
//
// `usePathname` est volontairement la seule dépendance de navigation utilisée :
// `useSearchParams` forcerait un rendu dynamique et ferait perdre le pré-rendu
// statique des pages SEO. La query string est lue depuis window dans l'effet.
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { track, normalizePath } from '@/lib/track'

export default function Analytics() {
    const pathname = usePathname()
    const last = useRef<string | null>(null)

    useEffect(() => {
        if (!pathname) return
        const key = normalizePath(pathname)
        // React 18 monte deux fois en développement : on évite le doublon.
        if (last.current === key) return
        last.current = key
        track('page_view')
    }, [pathname])

    return null
}
