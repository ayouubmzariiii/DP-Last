'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Widget de retour flottant, présent sur toute l'application et les pages
// publiques. C'est l'instrument central de la phase de test : sans lui, un
// abandon à l'étape 4 ne laisse qu'une ligne dans l'entonnoir ; avec lui, il
// laisse une phrase exploitable.
//
// Volontairement discret (bouton compact, en bas à droite), il ne se monte pas
// sur /admin et n'apparaît pas à l'impression.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { track, normalizePath } from '@/lib/track'

type Category = 'bug' | 'confus' | 'manque' | 'idee' | 'autre'

const CATEGORIES: { id: Category; label: string }[] = [
    { id: 'bug', label: 'Quelque chose ne marche pas' },
    { id: 'confus', label: 'Je ne comprends pas cette étape' },
    { id: 'manque', label: 'Il manque une information' },
    { id: 'idee', label: 'J’ai une suggestion' },
    { id: 'autre', label: 'Autre' },
]

/** Extrait le numéro d'étape de l'assistant depuis /etape/<uuid>/<n>. */
function stepFromPath(pathname: string): number | undefined {
    const m = /^\/etape\/[^/]+\/(\d)$/.exec(pathname)
    const n = m ? Number(m[1]) : NaN
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : undefined
}

/** Extrait l'identifiant de dossier — envoyé seulement si l'utilisateur est connecté. */
function dossierFromPath(pathname: string): string | undefined {
    const m = /^\/etape\/([0-9a-f-]{36})\//.exec(pathname)
    return m?.[1]
}

export default function FeedbackWidget() {
    const pathname = usePathname() || '/'
    const [open, setOpen] = useState(false)
    const [category, setCategory] = useState<Category>('bug')
    const [message, setMessage] = useState('')
    const [email, setEmail] = useState('')
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [error, setError] = useState('')

    // Le back-office a ses propres outils : pas de widget par-dessus.
    const hidden = pathname === '/admin' || pathname.startsWith('/admin/')

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    // Rouvrir le panneau après un envoi réussi le remet à zéro.
    useEffect(() => {
        if (open && state === 'sent') { setState('idle'); setMessage('') }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    if (hidden) return null

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (message.trim().length < 4) { setError('Décrivez le problème en quelques mots.'); return }
        setState('sending'); setError('')
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    message: message.trim(),
                    email: email.trim() || undefined,
                    path: normalizePath(pathname),
                    step: stepFromPath(pathname),
                    dossierId: dossierFromPath(pathname),
                }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error || 'Envoi impossible.')
            }
            setState('sent')
            track('feedback_submit', { category, step: stepFromPath(pathname) ?? null })
        } catch (err) {
            setState('error')
            setError(err instanceof Error ? err.message : 'Envoi impossible.')
        }
    }

    return (
        <div data-print-hidden style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            {open && (
                <div
                    role="dialog"
                    aria-label="Envoyer un retour"
                    className="dp-card"
                    style={{ width: 'min(370px, calc(100vw - 36px))', padding: 20, boxShadow: '0 2px 4px rgba(37,34,30,.05), 0 28px 56px -22px rgba(37,34,30,.42)' }}
                >
                    {state === 'sent' ? (
                        <div>
                            <p style={{ margin: '0 0 6px', fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Merci, c&apos;est noté.</p>
                            <p style={{ margin: '0 0 16px', fontSize: 14.2, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                                Votre retour arrive directement chez nous. Pendant la phase de test, il est lu tous les jours.
                            </p>
                            <button type="button" onClick={() => setOpen(false)} className="dp-btn-secondary" style={{ padding: '9px 16px', fontSize: 14 }}>Fermer</button>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                <div>
                                    <p style={{ margin: '0 0 3px', fontFamily: 'var(--hf)', fontSize: 17.5, fontWeight: 600, color: 'var(--ink)' }}>Un souci sur cette page ?</p>
                                    <p style={{ margin: 0, fontSize: 13.2, lineHeight: 1.5, color: 'var(--muted)' }}>Dites-le en une phrase — c&apos;est ce qui fait avancer l&apos;outil.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label="Fermer"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: 2 }}
                                >
                                    ×
                                </button>
                            </div>

                            <label className="dp-label" htmlFor="fb-cat">Type de retour</label>
                            <select id="fb-cat" className="dp-select" value={category} onChange={e => setCategory(e.target.value as Category)} style={{ marginBottom: 12 }}>
                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>

                            <label className="dp-label" htmlFor="fb-msg">Votre retour</label>
                            <textarea
                                id="fb-msg"
                                className="dp-input"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Ex : le plan de masse ne se génère pas, le bouton tourne indéfiniment."
                                style={{ minHeight: 92, marginBottom: 12 }}
                                maxLength={4000}
                            />

                            <label className="dp-label" htmlFor="fb-email">Email (facultatif — pour vous répondre)</label>
                            <input
                                id="fb-email"
                                type="email"
                                className="dp-input"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="vous@exemple.fr"
                                style={{ marginBottom: 14 }}
                            />

                            {error && <div className="dp-alert is-error" style={{ marginBottom: 12 }}>{error}</div>}

                            <button type="submit" className="dp-btn-primary" disabled={state === 'sending'} style={{ width: '100%', justifyContent: 'center', padding: '11px 18px', fontSize: 14.5 }}>
                                {state === 'sending' ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Envoi…</> : 'Envoyer'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={() => { setOpen(o => !o); if (!open) track('feedback_open', { path: normalizePath(pathname) }) }}
                aria-expanded={open}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'var(--surface)', border: '1px solid var(--line-3)', color: 'var(--ink-2)',
                    borderRadius: 9999, padding: '9px 15px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 8px 22px -12px rgba(37,34,30,.45)', fontFamily: 'inherit',
                }}
            >
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--ac)' }} />
                {open ? 'Fermer' : 'Un retour ?'}
            </button>
        </div>
    )
}
