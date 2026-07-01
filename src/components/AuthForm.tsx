'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Pixel-matched to the Claude Design prototype ("DP Travaux.dc.html" — Login / Register):
// centred 66px logo tile, dp-page-head, 440px column, 24px padding, centred short rule,
// 20/24px field spacing. Functional bits (submit, error, loading) are layered on top.
export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
    const router = useRouter()
    const params = useSearchParams()
    const next = params.get('next') || '/profil'

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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: 440 }}>
                <div className="dp-page-head" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: 66, height: 66, borderRadius: 18, background: 'linear-gradient(155deg,var(--ac),var(--acd))', boxShadow: '0 18px 36px -14px rgba(45,90,76,.6)' }}>
                            <span style={{ fontFamily: 'var(--hf)', fontWeight: 600, fontSize: 32, lineHeight: 1, letterSpacing: '-.03em', color: '#fff' }}>dp</span>
                            <span style={{ width: 22, height: 2, borderRadius: 2, background: 'rgba(255,255,255,.55)' }} />
                        </div>
                    </div>
                    <span className="dp-eyebrow">Déclaration Préalable</span>
                    <h1 className="dp-page-title">{isRegister ? <>Créer un <span className="accent">compte</span></> : <>Se <span className="accent">connecter</span></>}</h1>
                    <p className="dp-page-sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                        {isRegister ? 'Enregistrez et retrouvez vos dossiers sur tous vos appareils.' : 'Accédez à vos dossiers enregistrés.'}
                    </p>
                    <div className="dp-rule" style={{ maxWidth: 200, marginLeft: 'auto', marginRight: 'auto' }} />
                </div>

                <div className="dp-card">
                    <form onSubmit={submit}>
                        <div className="dp-form-group" style={{ marginBottom: 20 }}>
                            <label className="dp-label" htmlFor="email">Email *</label>
                            <input id="email" type="email" autoComplete="email" required className="dp-input"
                                placeholder="vous@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="dp-form-group" style={{ marginBottom: 24 }}>
                            <label className="dp-label" htmlFor="password">Mot de passe *</label>
                            <input id="password" type="password" required
                                autoComplete={isRegister ? 'new-password' : 'current-password'}
                                className="dp-input" placeholder={isRegister ? 'Au moins 8 caractères' : '••••••••'}
                                value={password} onChange={e => setPassword(e.target.value)} />
                            {isRegister && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>8 caractères minimum.</p>}
                        </div>

                        {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

                        <button type="submit" disabled={loading} className="dp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            {loading
                                ? <><span className="dp-spinner dp-spinner-sm on-accent" /> {isRegister ? 'Création…' : 'Connexion…'}</>
                                : (isRegister ? 'Créer mon compte' : 'Se connecter')}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-2)', marginTop: 24 }}>
                    {isRegister ? (
                        <>Déjà un compte ? <Link href="/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Se connecter</Link></>
                    ) : (
                        <>Pas encore de compte ? <Link href="/register" style={{ color: 'var(--ac)', fontWeight: 600 }}>Créer un compte</Link></>
                    )}
                </p>
            </div>
        </div>
    )
}
