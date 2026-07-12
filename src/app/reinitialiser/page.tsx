'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'

function ResetForm() {
    const router = useRouter()
    const params = useSearchParams()
    const token = params.get('token') || ''
    const email = params.get('email') || ''

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const linkInvalid = !token || !email

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
        setLoading(true); setError(null)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword: password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : (data.error || 'Une erreur est survenue.'))
                return
            }
            // Token consumed + session created server-side: straight back to the dossiers.
            router.push('/profil')
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
                        <Logo size={66} />
                    </div>
                    <span className="dp-eyebrow">Déclaration Préalable</span>
                    <h1 className="dp-page-title">Nouveau <span className="accent">mot de passe</span></h1>
                    <p className="dp-page-sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                        {email ? <>Pour le compte <strong>{email}</strong>.</> : 'Choisissez votre nouveau mot de passe.'}
                    </p>
                    <div className="dp-rule" style={{ maxWidth: 200, marginLeft: 'auto', marginRight: 'auto' }} />
                </div>

                <div className="dp-card">
                    {linkInvalid ? (
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
                            <p style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>Lien incomplet ou invalide.</p>
                            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                                Ouvrez le lien reçu par email, ou refaites une demande de réinitialisation.
                            </p>
                            <Link href="/mot-de-passe-oublie" className="dp-btn-primary" style={{ display: 'inline-flex', marginTop: 18, textDecoration: 'none' }}>
                                Refaire une demande
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            <div className="dp-form-group" style={{ marginBottom: 20 }}>
                                <label className="dp-label" htmlFor="password">Nouveau mot de passe *</label>
                                <input id="password" type="password" autoComplete="new-password" required className="dp-input"
                                    placeholder="Au moins 8 caractères" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                            <div className="dp-form-group" style={{ marginBottom: 24 }}>
                                <label className="dp-label" htmlFor="confirm">Confirmez le mot de passe *</label>
                                <input id="confirm" type="password" autoComplete="new-password" required className="dp-input"
                                    placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
                            </div>
                            {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
                            <button type="submit" disabled={loading || password.length < 8} className="dp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                {loading ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Mise à jour…</> : 'Définir le mot de passe'}
                            </button>
                        </form>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-2)', marginTop: 24 }}>
                    <Link href="/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>← Retour à la connexion</Link>
                </p>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetForm />
        </Suspense>
    )
}
