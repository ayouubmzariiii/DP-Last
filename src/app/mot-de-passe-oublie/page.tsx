'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true); setError(null)
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { setError(data.error || 'Une erreur est survenue.'); return }
            setSent(true)
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
                    <h1 className="dp-page-title">Mot de passe <span className="accent">oublié</span></h1>
                    <p className="dp-page-sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
                        Indiquez votre email : nous vous enverrons un lien de réinitialisation.
                    </p>
                    <div className="dp-rule" style={{ maxWidth: 200, marginLeft: 'auto', marginRight: 'auto' }} />
                </div>

                <div className="dp-card">
                    {sent ? (
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <div style={{ fontSize: 30, marginBottom: 10 }}>📬</div>
                            <p style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 600, marginBottom: 6 }}>Email envoyé (si un compte existe).</p>
                            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                                Consultez votre boîte de réception : le lien est valable 1 heure.
                                Pensez à vérifier vos courriers indésirables.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={submit}>
                            <div className="dp-form-group" style={{ marginBottom: 24 }}>
                                <label className="dp-label" htmlFor="email">Email *</label>
                                <input id="email" type="email" autoComplete="email" required className="dp-input"
                                    placeholder="vous@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
                            <button type="submit" disabled={loading} className="dp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                {loading ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Envoi…</> : 'Envoyer le lien'}
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
