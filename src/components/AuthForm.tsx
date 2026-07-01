'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
    const router = useRouter()
    const params = useSearchParams()
    const next = params.get('next') || '/mes-dossiers'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const isRegister = mode === 'register'

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/auth/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : (data.error || 'Une erreur est survenue.'))
                return
            }
            router.push(next)
            router.refresh()
        } catch {
            setError('Erreur réseau. Réessayez.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="dp-page-head text-center">
                    <span className="dp-eyebrow">Déclaration Préalable</span>
                    <h1 className="dp-page-title">{isRegister ? <>Créer un <span className="accent">compte</span></> : <>Se <span className="accent">connecter</span></>}</h1>
                    <p className="dp-page-sub">
                        {isRegister ? 'Enregistrez et retrouvez vos dossiers sur tous vos appareils.' : 'Accédez à vos dossiers enregistrés.'}
                    </p>
                    <div className="dp-rule" />
                </div>

                <div className="dp-card">
                    <form onSubmit={submit} className="space-y-5">
                        <div className="dp-form-group">
                            <label className="dp-label" htmlFor="email">Email *</label>
                            <input id="email" type="email" autoComplete="email" required className="dp-input"
                                placeholder="vous@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="dp-form-group">
                            <label className="dp-label" htmlFor="password">Mot de passe *</label>
                            <input id="password" type="password" required
                                autoComplete={isRegister ? 'new-password' : 'current-password'}
                                className="dp-input" placeholder={isRegister ? 'Au moins 8 caractères' : '••••••••'}
                                value={password} onChange={e => setPassword(e.target.value)} />
                            {isRegister && <p className="text-xs t-muted mt-1">8 caractères minimum.</p>}
                        </div>

                        {error && <div className="dp-alert is-error">⚠️ {error}</div>}

                        <button type="submit" disabled={loading} className="dp-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading
                                ? <><span className="dp-spinner dp-spinner-sm on-accent" /> {isRegister ? 'Création…' : 'Connexion…'}</>
                                : (isRegister ? 'Créer mon compte' : 'Se connecter')}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm t-ink2 mt-6">
                    {isRegister ? (
                        <>Déjà un compte ? <Link href="/login" className="t-accent font-semibold hover:underline">Se connecter</Link></>
                    ) : (
                        <>Pas encore de compte ? <Link href="/register" className="t-accent font-semibold hover:underline">Créer un compte</Link></>
                    )}
                </p>
            </div>
        </div>
    )
}
