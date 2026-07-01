'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DossierMeta {
    id: string
    title: string
    status: 'draft' | 'complete'
    lastStep: number
    createdAt: string
    updatedAt: string
}
interface Account {
    email: string
    createdAt?: string
    fullName?: string | null
    phone?: string | null
    language?: string
    emailNotifications?: boolean
}

const STEP_LABELS = ['Demandeur', 'Terrain', 'Travaux', 'PLU', 'Photos', 'Plans', 'Génération']

// Pixel-matched to the Claude Design prototype ("DP Travaux.dc.html" — Profil):
// 880px column, 44px padding, Mes projets / Paramètres tabs, identity card with a
// 44px avatar + check badge and mono dp-metric tiles, serif project titles.
export default function ProfilePage() {
    const router = useRouter()
    const [dossiers, setDossiers] = useState<DossierMeta[] | null>(null)
    const [account, setAccount] = useState<Account | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [tab, setTab] = useState<'projets' | 'params'>('projets')

    const load = useCallback(async () => {
        try {
            const [dRes, meRes] = await Promise.all([fetch('/api/dossiers'), fetch('/api/auth/me')])
            if (dRes.status === 401 || meRes.status === 401) { router.push('/login'); return }
            setDossiers((await dRes.json()).dossiers || [])
            if (meRes.ok) setAccount((await meRes.json()).user)
        } catch {
            setError('Impossible de charger votre profil.'); setDossiers([])
        }
    }, [router])

    useEffect(() => { load() }, [load])

    const createDossier = async () => {
        setBusy(true); setError(null)
        try {
            const res = await fetch('/api/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            if (!res.ok) throw new Error()
            const { dossier } = await res.json()
            router.push(`/etape/${dossier.id}/1`)
        } catch { setError('Création impossible.'); setBusy(false) }
    }

    const rename = async (d: DossierMeta) => {
        const title = window.prompt('Nom du projet :', d.title)
        if (title === null || title.trim() === d.title) return
        await fetch(`/api/dossiers/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
        load()
    }

    const remove = async (d: DossierMeta) => {
        if (!window.confirm(`Supprimer « ${d.title} » ? Cette action est irréversible.`)) return
        await fetch(`/api/dossiers/${d.id}`, { method: 'DELETE' })
        load()
    }

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login'); router.refresh()
    }

    const fmtDate = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' } }

    const total = dossiers?.length ?? 0
    const complete = dossiers?.filter(d => d.status === 'complete').length ?? 0
    const drafts = total - complete
    const initial = (account?.fullName || account?.email || '?').charAt(0).toUpperCase()

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
        background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--ink)' : 'var(--muted)',
        boxShadow: active ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none',
    })
    const metricTile: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }
    const metricTileAccent: React.CSSProperties = { background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 12, padding: 16 }

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 880, margin: '0 auto', padding: '44px 24px 80px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
                <div className="dp-page-head" style={{ marginBottom: 0 }}>
                    <span className="dp-eyebrow">Mon espace</span>
                    <h1 className="dp-page-title">Mon <span className="accent">profil</span></h1>
                </div>
                <button onClick={logout} className="dp-btn-secondary" style={{ flexShrink: 0 }}>Se déconnecter</button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, margin: '0 0 28px' }}>
                <button onClick={() => setTab('projets')} style={tabStyle(tab === 'projets')}>Mes projets</button>
                <button onClick={() => setTab('params')} style={tabStyle(tab === 'params')}>Paramètres</button>
            </div>

            {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            {tab === 'projets' ? (
                <>
                    {/* Identity + stats */}
                    <div className="dp-card" style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, background: 'var(--ac)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 16px -8px rgba(45,90,76,.6)' }}>
                                <span style={{ fontFamily: 'var(--hf)', fontSize: 20, fontWeight: 600 }}>{initial}</span>
                                <span style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--acd)', borderRadius: '50%', padding: 2, display: 'flex', border: '2px solid #fff' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                                </span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }} className="truncate">{account?.fullName || account?.email || '…'}</div>
                                <div className="dp-meta" style={{ marginTop: 2 }}>{account?.createdAt ? `Membre depuis le ${fmtDate(account.createdAt)}` : 'Compte'}</div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                            <div className="dp-metric" style={metricTile}><span className="val">{total}</span><span className="key">Projets</span></div>
                            <div className="dp-metric" style={metricTile}><span className="val">{drafts}</span><span className="key">Brouillons</span></div>
                            <div className="dp-metric is-accent" style={metricTileAccent}><span className="val">{complete}</span><span className="key">Complets</span></div>
                        </div>
                    </div>

                    {/* Projects */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <h2 className="dp-section-title" style={{ margin: 0, padding: 0, border: 'none' }}>Mes projets</h2>
                        <button onClick={createDossier} disabled={busy} className="dp-btn-primary">
                            {busy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Création…</> : '+ Nouveau projet'}
                        </button>
                    </div>

                    {dossiers === null ? (
                        <div className="dp-card" style={{ textAlign: 'center', padding: '64px 0' }}><span className="dp-spinner dp-spinner-lg" /></div>
                    ) : dossiers.length === 0 ? (
                        <div className="dp-card" style={{ textAlign: 'center', padding: '56px 0' }}>
                            <div style={{ fontSize: 34, marginBottom: 12 }}>📁</div>
                            <h3 style={{ fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Aucun projet pour le moment</h3>
                            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>Créez votre premier dossier de déclaration préalable.</p>
                            <button onClick={createDossier} disabled={busy} className="dp-btn-primary" style={{ marginTop: 24 }}>+ Nouveau projet</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {dossiers.map(d => (
                                <div key={d.id} className="dp-card" style={{ padding: '16px 18px' }}>
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                        <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} className="w-full sm:flex-1" style={{ minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflowWrap: 'anywhere' }}>{d.title}</span>
                                                <span className={d.status === 'complete' ? 'dp-chip is-ok' : 'dp-chip'}>{d.status === 'complete' ? 'Complet' : 'Brouillon'}</span>
                                            </div>
                                            <div className="dp-meta" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                                                Étape {d.lastStep}/7 · {STEP_LABELS[Math.min(d.lastStep, 7) - 1]} · modifié le {fmtDate(d.updatedAt)}
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                            <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} className="dp-btn-primary flex-1 sm:flex-none justify-center" style={{ padding: '9px 16px', fontSize: 13 }}>Ouvrir</button>
                                            <button onClick={() => rename(d)} className="dp-btn-secondary flex-1 sm:flex-none justify-center" style={{ padding: '9px 14px', fontSize: 13 }}>Renommer</button>
                                            <button onClick={() => remove(d)} className="dp-btn-secondary justify-center shrink-0" style={{ padding: '9px 13px', fontSize: 13 }} title="Supprimer" aria-label="Supprimer">🗑</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <SettingsTab account={account} onSaved={(a) => setAccount(a)} onDeleted={() => { router.push('/'); router.refresh() }} />
            )}
        </div>
    )
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab({ account, onSaved, onDeleted }: {
    account: Account | null
    onSaved: (a: Account) => void
    onDeleted: () => void
}) {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [language, setLanguage] = useState('fr')
    const [notif, setNotif] = useState(true)

    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

    // Change-password sub-form
    const [showPwd, setShowPwd] = useState(false)
    const [curPwd, setCurPwd] = useState('')
    const [newPwd, setNewPwd] = useState('')
    const [pwdBusy, setPwdBusy] = useState(false)
    const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

    const [delBusy, setDelBusy] = useState(false)

    // Hydrate the form once the account loads.
    useEffect(() => {
        if (!account) return
        setFullName(account.fullName || '')
        setEmail(account.email || '')
        setPhone(account.phone || '')
        setLanguage(account.language || 'fr')
        setNotif(account.emailNotifications ?? true)
    }, [account])

    const save = async () => {
        setSaving(true); setMsg(null)
        try {
            const res = await fetch('/api/auth/me', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, fullName, phone, language, emailNotifications: notif }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setMsg({ kind: 'error', text: Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : (data.error || 'Enregistrement impossible.') })
                return
            }
            onSaved(data.user)
            setMsg({ kind: 'ok', text: 'Modifications enregistrées.' })
        } catch {
            setMsg({ kind: 'error', text: 'Erreur réseau. Réessayez.' })
        } finally {
            setSaving(false)
        }
    }

    const changePassword = async () => {
        setPwdBusy(true); setPwdMsg(null)
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setPwdMsg({ kind: 'error', text: Array.isArray(data.issues) && data.issues.length ? data.issues.join(' ') : (data.error || 'Changement impossible.') })
                return
            }
            setPwdMsg({ kind: 'ok', text: 'Mot de passe mis à jour.' })
            setCurPwd(''); setNewPwd('')
            setShowPwd(false)
        } catch {
            setPwdMsg({ kind: 'error', text: 'Erreur réseau. Réessayez.' })
        } finally {
            setPwdBusy(false)
        }
    }

    const deleteAccount = async () => {
        if (!window.confirm('Supprimer définitivement votre compte et tous vos dossiers ? Cette action est irréversible.')) return
        setDelBusy(true)
        try {
            const res = await fetch('/api/auth/account', { method: 'DELETE' })
            if (!res.ok) { setMsg({ kind: 'error', text: 'Suppression impossible.' }); setDelBusy(false); return }
            onDeleted()
        } catch { setMsg({ kind: 'error', text: 'Erreur réseau. Réessayez.' }); setDelBusy(false) }
    }

    const notifCardStyle: React.CSSProperties = {
        borderColor: notif ? 'var(--ac)' : undefined,
        background: notif ? 'var(--act)' : undefined,
    }

    return (
        <div className="animate-fadeIn">
            <h2 className="dp-section-title" style={{ margin: '0 0 18px', padding: 0, border: 'none' }}>
                Paramètres du <span className="accent" style={{ fontStyle: 'normal' }}>compte</span>
            </h2>

            {msg && <div className={`dp-alert ${msg.kind === 'ok' ? 'is-ok' : 'is-error'}`} style={{ marginBottom: 16 }}>{msg.kind === 'ok' ? '✓ ' : '⚠️ '}{msg.text}</div>}

            <div className="dp-card" style={{ marginBottom: 16 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="dp-form-group"><label className="dp-label">Nom complet</label><input className="dp-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Prénom Nom" /></div>
                    <div className="dp-form-group"><label className="dp-label">Email</label><input className="dp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></div>
                    <div className="dp-form-group"><label className="dp-label">Téléphone</label><input className="dp-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" /></div>
                    <div className="dp-form-group"><label className="dp-label">Langue</label>
                        <select className="dp-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            <option value="fr">Français</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>

                <div className="dp-rule" style={{ margin: '20px 0', background: 'var(--line-2)' }} />

                <label className="dp-check-card" style={notifCardStyle}>
                    <input type="checkbox" checked={notif} onChange={e => setNotif(e.target.checked)} />
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Notifications par email</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Suivi de l&apos;instruction en mairie et rappels de dépôt.</div>
                    </div>
                </label>

                <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                    <button onClick={save} disabled={saving} className="dp-btn-primary">
                        {saving ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Enregistrement…</> : 'Enregistrer les modifications'}
                    </button>
                    <button onClick={() => { setShowPwd(v => !v); setPwdMsg(null) }} className="dp-btn-secondary">Changer le mot de passe</button>
                </div>

                {showPwd && (
                    <div className="animate-fadeIn" style={{ marginTop: 20 }}>
                        <div className="dp-rule" style={{ margin: '0 0 18px', background: 'var(--line-2)' }} />
                        {pwdMsg && <div className={`dp-alert ${pwdMsg.kind === 'ok' ? 'is-ok' : 'is-error'}`} style={{ marginBottom: 16 }}>{pwdMsg.kind === 'ok' ? '✓ ' : '⚠️ '}{pwdMsg.text}</div>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="dp-form-group"><label className="dp-label">Mot de passe actuel</label><input className="dp-input" type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></div>
                            <div className="dp-form-group"><label className="dp-label">Nouveau mot de passe</label><input className="dp-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" placeholder="Au moins 8 caractères" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                            <button onClick={changePassword} disabled={pwdBusy || !curPwd || newPwd.length < 8} className="dp-btn-primary">
                                {pwdBusy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Mise à jour…</> : 'Mettre à jour le mot de passe'}
                            </button>
                            <button onClick={() => { setShowPwd(false); setCurPwd(''); setNewPwd('') }} className="dp-btn-secondary">Annuler</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Danger zone */}
            <div className="dp-card" style={{ borderColor: '#EBC3BB', background: '#FDF4F1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: '#8F2E22' }}>Supprimer mon compte</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Action irréversible — tous vos dossiers seront définitivement supprimés.</div>
                    </div>
                    <button onClick={deleteAccount} disabled={delBusy} className="dp-btn-outline" style={{ color: '#8F2E22', borderColor: '#EBC3BB' }}>
                        {delBusy ? 'Suppression…' : 'Supprimer'}
                    </button>
                </div>
            </div>
        </div>
    )
}
