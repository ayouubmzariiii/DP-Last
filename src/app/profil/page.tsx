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
    const initial = (account?.email || '?').charAt(0).toUpperCase()

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
        background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--ink)' : 'var(--muted)',
        boxShadow: active ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none',
    })

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex items-start justify-between gap-4">
                <div className="dp-page-head" style={{ marginBottom: 0 }}>
                    <span className="dp-eyebrow">Mon espace</span>
                    <h1 className="dp-page-title">Mon <span className="accent">profil</span></h1>
                </div>
                <button onClick={logout} className="dp-btn-secondary text-sm shrink-0">Se déconnecter</button>
            </div>

            {/* Tab switcher */}
            <div className="inline-flex gap-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, margin: '16px 0 28px' }}>
                <button onClick={() => setTab('projets')} style={tabStyle(tab === 'projets')}>Mes projets</button>
                <button onClick={() => setTab('params')} style={tabStyle(tab === 'params')}>Paramètres</button>
            </div>

            {error && <div className="dp-alert is-error mb-4">⚠️ {error}</div>}

            {tab === 'projets' ? (
                <>
                    {/* Identity + stats */}
                    <div className="dp-card mb-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-5">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex items-center justify-center shrink-0 text-white font-bold"
                                    style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ac)', fontSize: 24, fontFamily: 'var(--hf)' }}>
                                    {initial}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold t-ink truncate">{account?.fullName || account?.email || '…'}</div>
                                    <div className="text-xs t-muted mt-0.5">{account?.createdAt ? `Membre depuis le ${fmtDate(account.createdAt)}` : 'Compte'}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 md:gap-4 shrink-0">
                                {[{ n: total, l: 'Projets' }, { n: drafts, l: 'Brouillons' }, { n: complete, l: 'Complets' }].map(s => (
                                    <div key={s.l} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                                        <div className="font-bold t-ink text-xl">{s.n}</div>
                                        <div className="dp-meta">{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Projects */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="dp-section-title mb-0 pb-0 border-0">Mes projets</h2>
                        <button onClick={createDossier} disabled={busy} className="dp-btn-primary disabled:opacity-50">
                            {busy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Création…</> : '+ Nouveau projet'}
                        </button>
                    </div>

                    {dossiers === null ? (
                        <div className="dp-card text-center py-16"><span className="dp-spinner dp-spinner-lg" /></div>
                    ) : dossiers.length === 0 ? (
                        <div className="dp-card text-center py-16">
                            <div className="text-4xl mb-3">📁</div>
                            <h3 className="font-bold t-ink">Aucun projet pour le moment</h3>
                            <p className="text-sm t-ink2 mt-1">Créez votre premier dossier de déclaration préalable.</p>
                            <button onClick={createDossier} disabled={busy} className="dp-btn-primary mt-6 mx-auto disabled:opacity-50">+ Nouveau projet</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {dossiers.map(d => (
                                <div key={d.id} className="dp-card flex items-center justify-between gap-4 !py-4">
                                    <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold t-ink truncate">{d.title}</span>
                                            <span className="dp-chip is-ok text-[10px]" style={{ opacity: d.status === 'complete' ? 1 : 0.55 }}>
                                                {d.status === 'complete' ? 'Complet' : 'Brouillon'}
                                            </span>
                                        </div>
                                        <div className="text-xs t-muted mt-1">
                                            Étape {d.lastStep}/7 · {STEP_LABELS[Math.min(d.lastStep, 7) - 1]} · modifié le {fmtDate(d.updatedAt)}
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} className="dp-btn-primary text-xs !px-3 !py-1.5">Ouvrir</button>
                                        <button onClick={() => rename(d)} className="dp-btn-secondary text-xs !px-3 !py-1.5">Renommer</button>
                                        <button onClick={() => remove(d)} className="text-xs t-ink2 hover:text-red-500 px-2 py-1.5 transition-colors" title="Supprimer">🗑️</button>
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

            {msg && <div className={`dp-alert ${msg.kind === 'ok' ? 'is-ok' : 'is-error'} mb-4`}>{msg.kind === 'ok' ? '✓ ' : '⚠️ '}{msg.text}</div>}

            <div className="dp-card mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex gap-3 mt-5 flex-wrap">
                    <button onClick={save} disabled={saving} className="dp-btn-primary disabled:opacity-50">
                        {saving ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Enregistrement…</> : 'Enregistrer les modifications'}
                    </button>
                    <button onClick={() => { setShowPwd(v => !v); setPwdMsg(null) }} className="dp-btn-secondary">Changer le mot de passe</button>
                </div>

                {showPwd && (
                    <div className="animate-fadeIn mt-5 pt-5">
                        <div className="dp-rule" style={{ margin: '0 0 18px', background: 'var(--line-2)' }} />
                        {pwdMsg && <div className={`dp-alert ${pwdMsg.kind === 'ok' ? 'is-ok' : 'is-error'} mb-4`}>{pwdMsg.kind === 'ok' ? '✓ ' : '⚠️ '}{pwdMsg.text}</div>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="dp-form-group"><label className="dp-label">Mot de passe actuel</label><input className="dp-input" type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></div>
                            <div className="dp-form-group"><label className="dp-label">Nouveau mot de passe</label><input className="dp-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" placeholder="Au moins 8 caractères" /></div>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={changePassword} disabled={pwdBusy || !curPwd || newPwd.length < 8} className="dp-btn-primary disabled:opacity-50">
                                {pwdBusy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Mise à jour…</> : 'Mettre à jour le mot de passe'}
                            </button>
                            <button onClick={() => { setShowPwd(false); setCurPwd(''); setNewPwd('') }} className="dp-btn-secondary">Annuler</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Danger zone */}
            <div className="dp-card" style={{ borderColor: '#EBC3BB', background: '#FDF4F1' }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <div style={{ fontWeight: 600, color: '#8F2E22' }}>Supprimer mon compte</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Action irréversible — tous vos dossiers seront définitivement supprimés.</div>
                    </div>
                    <button onClick={deleteAccount} disabled={delBusy} className="dp-btn-outline disabled:opacity-50" style={{ color: '#8F2E22', borderColor: '#EBC3BB' }}>
                        {delBusy ? 'Suppression…' : 'Supprimer'}
                    </button>
                </div>
            </div>
        </div>
    )
}
