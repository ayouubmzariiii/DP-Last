// ─────────────────────────────────────────────────────────────────────────────
// Mesure d'entonnoir côté client — minimaliste et sans dépendance.
//
// Ce qui est collecté : un identifiant anonyme de navigateur (localStorage), le
// chemin NORMALISÉ (les UUID de dossier deviennent ':id', donc aucun identifiant
// de dossier ne transite), la provenance (utm_source / utm_campaign / referrer)
// et des propriétés scalaires. Aucun cookie tiers, aucun script externe.
//
// Toutes les fonctions sont sans effet côté serveur et n'échouent jamais.
// ─────────────────────────────────────────────────────────────────────────────

const ANON_KEY = 'dp_anon_id'
const ATTR_KEY = 'dp_attribution'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Identifiant anonyme stable par navigateur. Créé à la première mesure. */
export function anonId(): string | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        let id = window.localStorage.getItem(ANON_KEY)
        if (!id) {
            id = (window.crypto?.randomUUID?.() || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`)
            window.localStorage.setItem(ANON_KEY, id)
        }
        return id
    } catch {
        return undefined   // navigation privée / stockage refusé
    }
}

/** `/etape/6f1c…/3` → `/etape/:id/3`. Indispensable pour agréger l'entonnoir. */
export function normalizePath(pathname: string): string {
    return pathname.replace(UUID_RE, ':id')
}

export interface Attribution { source?: string; campaign?: string; referrer?: string }

/**
 * Provenance de la session, en « premier contact » : la première page vue fixe
 * l'attribution, pour que tout l'entonnoir soit crédité au canal d'entrée et non
 * à la dernière page visitée.
 *
 * Une exception nécessaire : si le premier contact n'a rien identifié (arrivée
 * directe, donc attribution vide) et qu'une page suivante porte des paramètres
 * utm explicites, ce clic de campagne l'emporte. Sans cela, une session ouverte
 * sur l'accueil rendrait aveugle tout lien tracké cliqué ensuite.
 */
export function attribution(): Attribution {
    if (typeof window === 'undefined') return {}
    try {
        const q = new URLSearchParams(window.location.search)
        const explicite: Attribution = {
            source: q.get('utm_source') || q.get('ref') || undefined,
            campaign: q.get('utm_campaign') || undefined,
        }

        const stored = window.sessionStorage.getItem(ATTR_KEY)
        if (stored) {
            const prev = JSON.parse(stored) as Attribution
            if (prev.source || !explicite.source) return prev
            // Premier contact non identifié + lien tracké : on enrichit.
            const merged: Attribution = { ...prev, ...explicite }
            window.sessionStorage.setItem(ATTR_KEY, JSON.stringify(merged))
            return merged
        }

        const ref = document.referrer || ''
        const sameHost = ref ? new URL(ref, window.location.href).host === window.location.host : false
        const attr: Attribution = {
            ...explicite,
            referrer: ref && !sameHost ? ref.slice(0, 300) : undefined,
        }
        window.sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr))
        return attr
    } catch {
        return {}
    }
}

export type TrackProps = Record<string, string | number | boolean | null>

/** Envoie un événement. Silencieux, non bloquant, jamais attendu par l'UI. */
export function track(name: string, props?: TrackProps): void {
    if (typeof window === 'undefined') return
    try {
        const attr = attribution()
        const payload = JSON.stringify({
            name,
            anonId: anonId(),
            path: normalizePath(window.location.pathname),
            ...attr,
            props,
        })
        // sendBeacon survit à une navigation immédiate (clic sortant, fermeture
        // d'onglet) là où fetch serait annulé. Repli fetch si indisponible.
        const sent = navigator.sendBeacon?.('/api/events', new Blob([payload], { type: 'application/json' }))
        if (!sent) {
            void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => { })
        }
    } catch {
        // La mesure ne doit jamais interrompre un parcours.
    }
}
