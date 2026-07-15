'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Back-office /admin — la « salle de contrôle » de DP Travaux.
//
// Quatre onglets : Vue d'ensemble (chiffres + activité récente), Utilisateurs
// (annuaire, crédits, abonnements, rôles), Dossiers (tous comptes confondus),
// Règles de l'app (modèles IA, plafonds, interrupteurs — persistés en base,
// prise d'effet immédiate côté serveur).
//
// L'accès est doublement gardé : middleware (claim JWT) pour le routage, et
// re-vérification du rôle EN BASE par chaque route /api/admin.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'

type Tab = 'apercu' | 'users' | 'dossiers' | 'regles'

// ── API payload types (miroir des routes /api/admin) ─────────────────────────
interface Overview {
    users: { total: number; admins: number; new30d: number }
    dossiers: { total: number; drafts: number; complete: number; submitted: number; accepted: number; rejected: number; archived: number; new30d: number }
    revenue: { totalCents: number; count: number; cents30d: number }
    activePlans: { plan: string; count: number }[]
    recentUsers: { id: string; email: string; fullName: string | null; city: string | null; createdAt: string }[]
    recentDossiers: { id: string; title: string; status: string; decision: string | null; updatedAt: string; email: string }[]
}
interface AdminUser {
    id: string; email: string; fullName: string | null; city: string | null; phone: string | null
    role: string; credits: number; createdAt: string; dossierCount: number
    plan: string | null; planStatus: string | null; quota: number | null; used: number | null
}
interface UserDetail {
    user: { id: string; email: string; role: string; fullName: string | null; phone: string | null; address: string | null; postalCode: string | null; city: string | null; credits: number; createdAt: string }
    subscription: { plan: string; status: string; quota: number; used: number; periodEnd: string } | null
    payments: { id: string; kind: string; label: string; amountCents: number; creditsGranted: number; status: string; createdAt: string }[]
    dossiers: AdminDossier[]
}
interface AdminDossier {
    id: string; title: string; clientName: string | null; status: string; lastStep: number
    decision: string | null; submittedAt: string | null; billedAt: string | null; archivedAt: string | null
    createdAt?: string; updatedAt: string; summary: any; userId?: string; email?: string
}
interface Setting {
    key: string; type: 'string' | 'number' | 'boolean'; label: string; help: string
    group: 'ai' | 'limits' | 'access'; options: string[] | null; envVar: string | null
    value: string | number | boolean; source: 'db' | 'env' | 'default'; default: string | number | boolean
}

const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const euro = (cents: number) => (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: cents % 100 ? 2 : 0 }) + ' €'
const mono: React.CSSProperties = { fontFamily: 'var(--mf)' }
const miniBtn: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5 }

export default function AdminPage() {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('apercu')
    const [me, setMe] = useState<{ email: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
            if (!d?.user) { router.push('/login?next=/admin'); return }
            if (d.user.role !== 'admin') { router.push('/profil'); return }
            setMe({ email: d.user.email })
        }).catch(() => { })
    }, [router])

    useEffect(() => {
        if (!notice) return
        const t = setTimeout(() => setNotice(null), 3500)
        return () => clearTimeout(t)
    }, [notice])

    const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { }); router.push('/'); router.refresh() }

    const tabStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
        background: isActive ? 'var(--surface)' : 'transparent', color: isActive ? 'var(--ink)' : 'var(--muted)',
        boxShadow: isActive ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none',
    })

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 1080, margin: '0 auto', padding: '44px 24px 80px' }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <Link href="/" aria-label="Accueil DP Travaux"><Logo size={46} /></Link>
                    <div className="dp-page-head" style={{ marginBottom: 0 }}>
                        <span className="dp-eyebrow">Back-office</span>
                        <h1 className="dp-page-title">Salle de <span className="accent">contrôle</span></h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {me && <span style={{ fontSize: 12.5, color: 'var(--muted)', ...mono }}>{me.email}</span>}
                    <Link href="/profil" className="dp-btn-secondary" style={{ ...miniBtn, textDecoration: 'none' }}>Mon espace</Link>
                    <button onClick={logout} className="dp-btn-secondary" style={miniBtn}>Se déconnecter</button>
                </div>
            </div>

            {/* Onglets */}
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, margin: '0 0 28px', flexWrap: 'wrap' }}>
                <button onClick={() => setTab('apercu')} style={tabStyle(tab === 'apercu')}>Vue d’ensemble</button>
                <button onClick={() => setTab('users')} style={tabStyle(tab === 'users')}>Utilisateurs</button>
                <button onClick={() => setTab('dossiers')} style={tabStyle(tab === 'dossiers')}>Dossiers</button>
                <button onClick={() => setTab('regles')} style={tabStyle(tab === 'regles')}>Règles de l’app</button>
            </div>

            {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
            {notice && <div className="dp-alert is-ok" style={{ marginBottom: 16 }}>✓ {notice}</div>}

            {tab === 'apercu' && <OverviewTab onError={setError} />}
            {tab === 'users' && <UsersTab onError={setError} onNotice={setNotice} />}
            {tab === 'dossiers' && <DossiersTab onError={setError} />}
            {tab === 'regles' && <ReglesTab onError={setError} onNotice={setNotice} />}
        </div>
    )
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────────
function OverviewTab({ onError }: { onError: (m: string | null) => void }) {
    const [data, setData] = useState<Overview | null>(null)

    useEffect(() => {
        fetch('/api/admin/overview').then(async r => {
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Chargement impossible.')
            setData(await r.json())
        }).catch(e => onError(e.message))
    }, [onError])

    if (!data) return <div style={{ textAlign: 'center', padding: 60 }}><span className="dp-spinner" /></div>

    const d = data.dossiers
    const decided = d.accepted + d.rejected
    const acceptRate = decided > 0 ? Math.round(100 * d.accepted / decided) : null
    const tile: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }
    const tileAccent: React.CSSProperties = { ...tile, background: 'var(--act)', border: '1px solid var(--acb)' }
    const big: React.CSSProperties = { ...mono, fontSize: 26, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }
    const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }
    const sub: React.CSSProperties = { fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }

    return (
        <div className="animate-fadeIn">
            {/* Tuiles de chiffres */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div style={tileAccent}>
                    <div style={lbl}>Comptes</div>
                    <div style={big}>{data.users.total}</div>
                    <div style={sub}>+{data.users.new30d} sur 30 j · {data.users.admins} admin{data.users.admins > 1 ? 's' : ''}</div>
                </div>
                <div style={tile}>
                    <div style={lbl}>Dossiers</div>
                    <div style={big}>{d.total}</div>
                    <div style={sub}>{d.drafts} brouillons · {d.complete} complets · +{d.new30d} / 30 j</div>
                </div>
                <div style={tile}>
                    <div style={lbl}>Instruction en mairie</div>
                    <div style={big}>{d.submitted}</div>
                    <div style={sub}>{d.accepted} acceptés · {d.rejected} refusés{acceptRate !== null ? ` · ${acceptRate} % d’acceptation` : ''}</div>
                </div>
                <div style={tile}>
                    <div style={lbl}>Revenu (mock)</div>
                    <div style={big}>{euro(data.revenue.totalCents)}</div>
                    <div style={sub}>{data.revenue.count} paiement{data.revenue.count > 1 ? 's' : ''} · {euro(data.revenue.cents30d)} / 30 j</div>
                </div>
            </div>

            {/* Plans actifs */}
            <div className="dp-card" style={{ padding: 18, marginBottom: 24 }}>
                <div style={lbl}>Abonnements actifs</div>
                {data.activePlans.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Aucun abonnement actif.</div>
                    : (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                            {data.activePlans.map(p => (
                                <span key={p.plan} className="dp-chip is-ok" style={{ fontSize: 12.5 }}>
                                    <b style={{ textTransform: 'capitalize' }}>{p.plan}</b>&nbsp;× {p.count}
                                </span>
                            ))}
                        </div>
                    )}
            </div>

            {/* Activité récente */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div className="dp-card" style={{ padding: 18 }}>
                    <div style={lbl}>Derniers inscrits</div>
                    {data.recentUsers.map(u => (
                        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fullName || u.email}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', ...mono }}>{u.email}{u.city ? ` · ${u.city}` : ''}</div>
                            </div>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)', flexShrink: 0 }}>{fmtDate(u.createdAt)}</span>
                        </div>
                    ))}
                </div>
                <div className="dp-card" style={{ padding: 18 }}>
                    <div style={lbl}>Derniers dossiers touchés</div>
                    {data.recentDossiers.map(dd => (
                        <div key={dd.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dd.title}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', ...mono }}>{dd.email}</div>
                            </div>
                            <span className="dp-chip" style={{ fontSize: 11, flexShrink: 0, alignSelf: 'center' }}>
                                {dd.decision === 'accepted' ? '✓ acceptée' : dd.decision === 'rejected' ? '✗ refusée' : dd.status === 'complete' ? 'complet' : 'brouillon'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Utilisateurs ──────────────────────────────────────────────────────────────
function UsersTab({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string) => void }) {
    const [rows, setRows] = useState<AdminUser[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(true)
    const [openId, setOpenId] = useState<string | null>(null)
    const [detail, setDetail] = useState<UserDetail | null>(null)
    const [pending, setPending] = useState(false)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const load = useCallback(async (query: string, p: number) => {
        setLoading(true)
        try {
            const r = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&page=${p}`)
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Chargement impossible.')
            const d = await r.json()
            setRows(d.users); setTotal(d.total); setPageSize(d.pageSize)
        } catch (e: any) { onError(e.message) } finally { setLoading(false) }
    }, [onError])

    useEffect(() => { load('', 1) }, [load])
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); load(q, 1) }, 300)
        return () => clearTimeout(t)
    }, [q, load])

    const openDetail = async (id: string) => {
        if (openId === id) { setOpenId(null); setDetail(null); return }
        setOpenId(id); setDetail(null); setConfirmDeleteId(null)
        try {
            const r = await fetch(`/api/admin/users/${id}`)
            if (r.ok) setDetail(await r.json())
        } catch { /* silencieux */ }
    }

    const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
        setPending(true)
        try {
            const r = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const d = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(d?.error || 'Mise à jour impossible.')
            onNotice(okMsg)
            await load(q, page)
            if (openId === id) { const rr = await fetch(`/api/admin/users/${id}`); if (rr.ok) setDetail(await rr.json()) }
        } catch (e: any) { onError(e.message) } finally { setPending(false) }
    }

    const removeUser = async (id: string) => {
        setPending(true)
        try {
            const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
            const d = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(d?.error || 'Suppression impossible.')
            onNotice('Compte supprimé.')
            setOpenId(null); setConfirmDeleteId(null)
            await load(q, page)
        } catch (e: any) { onError(e.message) } finally { setPending(false) }
    }

    const pages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <input className="dp-input" style={{ maxWidth: 340 }} placeholder="Rechercher (email, nom, ville)…" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un compte" />
                <span style={{ fontSize: 12.5, color: 'var(--muted)', ...mono }}>{total} compte{total > 1 ? 's' : ''}</span>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><span className="dp-spinner" /></div> : rows.map(u => (
                <div key={u.id} className="dp-card" style={{ padding: '14px 18px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{u.fullName || u.email}</span>
                                {u.role === 'admin' && <span className="dp-chip is-ok" style={{ fontSize: 10.5 }}>ADMIN</span>}
                                {u.plan && u.planStatus === 'active' && <span className="dp-chip" style={{ fontSize: 10.5, textTransform: 'capitalize' }}>{u.plan}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, ...mono }}>
                                {u.email}{u.city ? ` · ${u.city}` : ''} · inscrit le {fmtDate(u.createdAt)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12.5, color: 'var(--ink-2)', ...mono }}>
                            <span title="Dossiers">📁 {u.dossierCount}</span>
                            <span title="Crédits">🎟 {u.credits}</span>
                            {u.plan && u.planStatus === 'active' && <span title="Quota mensuel">{u.used}/{u.quota === 0 ? '∞' : u.quota}</span>}
                        </div>
                        <button onClick={() => openDetail(u.id)} className="dp-btn-secondary" style={miniBtn} aria-expanded={openId === u.id}>
                            {openId === u.id ? 'Fermer' : 'Gérer'}
                        </button>
                    </div>

                    {openId === u.id && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
                            {!detail ? <div style={{ textAlign: 'center', padding: 16 }}><span className="dp-spinner dp-spinner-sm" /></div> : (
                                <div className="animate-fadeIn">
                                    {/* Actions rapides */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                                        <button disabled={pending} onClick={() => patch(u.id, { addCredits: 1 }, '+1 crédit accordé.')} className="dp-btn-secondary" style={miniBtn}>+1 crédit</button>
                                        <button disabled={pending} onClick={() => patch(u.id, { addCredits: 3 }, '+3 crédits accordés.')} className="dp-btn-secondary" style={miniBtn}>+3 crédits</button>
                                        <button disabled={pending || u.credits === 0} onClick={() => patch(u.id, { credits: 0 }, 'Crédits remis à zéro.')} className="dp-btn-secondary" style={miniBtn}>Crédits → 0</button>
                                        <select className="dp-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }} value={detail.subscription?.status === 'active' ? detail.subscription.plan : 'none'}
                                            disabled={pending}
                                            onChange={e => patch(u.id, { plan: e.target.value }, e.target.value === 'none' ? 'Abonnement résilié.' : `Plan « ${e.target.value} » attribué.`)}
                                            aria-label="Attribuer un plan">
                                            <option value="none">Sans abonnement</option>
                                            <option value="studio">Studio (5/mois)</option>
                                            <option value="cabinet">Cabinet (12/mois)</option>
                                            <option value="agence">Agence (illimité)</option>
                                        </select>
                                        <button disabled={pending} onClick={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'Rôle admin retiré.' : 'Promu administrateur.')} className="dp-btn-secondary" style={miniBtn}>
                                            {u.role === 'admin' ? 'Retirer admin' : 'Promouvoir admin'}
                                        </button>
                                        {u.role !== 'admin' && (
                                            <button disabled={pending} onClick={() => setConfirmDeleteId(u.id)} className="dp-btn-outline" style={{ ...miniBtn, color: '#8F2E22', borderColor: '#EBC3BB' }}>Supprimer…</button>
                                        )}
                                    </div>

                                    {confirmDeleteId === u.id && (
                                        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: '#FDF4F1', border: '1px solid #EBC3BB' }}>
                                            <span style={{ fontSize: 12.5, color: '#8F2E22', fontWeight: 600, flex: 1, minWidth: 200 }}>
                                                Supprimer définitivement {u.email} et ses {u.dossierCount} dossier{u.dossierCount > 1 ? 's' : ''} ?
                                            </span>
                                            <button onClick={() => removeUser(u.id)} disabled={pending} className="dp-btn-outline" style={{ ...miniBtn, color: '#8F2E22', borderColor: '#EBC3BB' }}>
                                                {pending ? 'Suppression…' : 'Supprimer'}
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(null)} className="dp-btn-secondary" style={miniBtn}>Annuler</button>
                                        </div>
                                    )}

                                    {/* Coordonnées + historique */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Coordonnées</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                                                {detail.user.phone && <div>📞 {detail.user.phone}</div>}
                                                {detail.user.address && <div>📍 {detail.user.address}, {detail.user.postalCode} {detail.user.city}</div>}
                                                {detail.subscription && (
                                                    <div>💳 {detail.subscription.plan} · {detail.subscription.status}
                                                        {detail.subscription.status === 'active' && <> · {detail.subscription.used}/{detail.subscription.quota === 0 ? '∞' : detail.subscription.quota} · renouvellement {fmtDate(detail.subscription.periodEnd)}</>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Paiements ({detail.payments.length})</div>
                                            {detail.payments.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucun paiement.</div> :
                                                detail.payments.slice(0, 5).map(p => (
                                                    <div key={p.id} style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
                                                        <span style={{ ...mono, flexShrink: 0 }}>{euro(p.amountCents)} · {fmtDate(p.createdAt)}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Dossiers du compte */}
                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Dossiers ({detail.dossiers.length})</div>
                                        {detail.dossiers.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucun dossier.</div> :
                                            detail.dossiers.slice(0, 8).map(dd => (
                                                <div key={dd.id} style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--line-2)' }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {dd.title}{dd.summary?.address ? <span style={{ color: 'var(--muted)' }}> — {dd.summary.address}</span> : ''}
                                                    </span>
                                                    <span style={{ flexShrink: 0, ...mono, fontSize: 11.5 }}>
                                                        {dd.decision === 'accepted' ? '✓' : dd.decision === 'rejected' ? '✗' : dd.status === 'complete' ? 'complet' : `étape ${dd.lastStep}/7`} · {fmtDate(dd.updatedAt)}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {pages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, alignItems: 'center' }}>
                    <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(q, p) }} className="dp-btn-secondary" style={miniBtn}>← Préc.</button>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', ...mono }}>{page}/{pages}</span>
                    <button disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); load(q, p) }} className="dp-btn-secondary" style={miniBtn}>Suiv. →</button>
                </div>
            )}
        </div>
    )
}

// ── Dossiers (tous comptes) ───────────────────────────────────────────────────
function DossiersTab({ onError }: { onError: (m: string | null) => void }) {
    const [rows, setRows] = useState<AdminDossier[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [q, setQ] = useState('')
    const [status, setStatus] = useState('')
    const [loading, setLoading] = useState(true)
    const [openId, setOpenId] = useState<string | null>(null)

    const load = useCallback(async (query: string, st: string, p: number) => {
        setLoading(true)
        try {
            const r = await fetch(`/api/admin/dossiers?q=${encodeURIComponent(query)}&status=${st}&page=${p}`)
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Chargement impossible.')
            const d = await r.json()
            setRows(d.dossiers); setTotal(d.total); setPageSize(d.pageSize)
        } catch (e: any) { onError(e.message) } finally { setLoading(false) }
    }, [onError])

    useEffect(() => { load('', '', 1) }, [load])
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); load(q, status, 1) }, 300)
        return () => clearTimeout(t)
    }, [q, status, load])

    const chip = (isActive: boolean): React.CSSProperties => ({
        padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 12.5, fontWeight: 600, transition: 'all .15s', whiteSpace: 'nowrap',
        border: `1px solid ${isActive ? 'var(--ac)' : 'var(--line)'}`,
        background: isActive ? 'var(--act)' : 'var(--surface)',
        color: isActive ? 'var(--acd)' : 'var(--ink-2)',
    })
    const FILTERS = [
        { key: '', label: 'Tous' }, { key: 'draft', label: 'Brouillons' }, { key: 'complete', label: 'Complets' },
        { key: 'submitted', label: 'Déposés' }, { key: 'accepted', label: 'Acceptés' }, { key: 'rejected', label: 'Refusés' },
    ]
    const pages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <input className="dp-input" style={{ maxWidth: 340 }} placeholder="Rechercher (titre, client, email)…" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un dossier" />
                <span style={{ fontSize: 12.5, color: 'var(--muted)', ...mono }}>{total} dossier{total > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {FILTERS.map(f => <button key={f.key} onClick={() => setStatus(f.key)} style={chip(status === f.key)}>{f.label}</button>)}
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: 40 }}><span className="dp-spinner" /></div> : rows.map(dd => (
                <div key={dd.id} className="dp-card" style={{ padding: '13px 18px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{dd.title}</span>
                                <span className="dp-chip" style={{ fontSize: 10.5 }}>
                                    {dd.decision === 'accepted' ? '✓ acceptée' : dd.decision === 'rejected' ? '✗ refusée' : dd.submittedAt ? 'déposé' : dd.status === 'complete' ? 'complet' : `étape ${dd.lastStep}/7`}
                                </span>
                                {dd.archivedAt && <span className="dp-chip" style={{ fontSize: 10.5, opacity: .7 }}>archivé</span>}
                                {dd.billedAt && <span className="dp-chip is-ok" style={{ fontSize: 10.5 }}>facturé</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, ...mono }}>
                                {dd.email}{dd.clientName ? ` · client : ${dd.clientName}` : ''} · modifié le {fmtDate(dd.updatedAt)}
                            </div>
                        </div>
                        <button onClick={() => setOpenId(openId === dd.id ? null : dd.id)} className="dp-btn-secondary" style={miniBtn} aria-expanded={openId === dd.id}>
                            {openId === dd.id ? 'Fermer' : 'Inspecter'}
                        </button>
                    </div>

                    {openId === dd.id && (
                        <div className="animate-fadeIn" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-2)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>
                            {dd.summary?.applicant && <div><b>Demandeur :</b> {dd.summary.applicant}</div>}
                            {dd.summary?.address && <div><b>Terrain :</b> {dd.summary.address}</div>}
                            {dd.summary?.worksType && <div><b>Travaux :</b> {dd.summary.worksType}</div>}
                            <div><b>Créé :</b> {fmtDate(dd.createdAt || null)} · <b>Déposé :</b> {fmtDate(dd.submittedAt)} · <b>Facturé :</b> {dd.billedAt ? fmtDate(dd.billedAt) : 'non'}</div>
                            <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>id {dd.id}</div>
                        </div>
                    )}
                </div>
            ))}

            {pages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, alignItems: 'center' }}>
                    <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(q, status, p) }} className="dp-btn-secondary" style={miniBtn}>← Préc.</button>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', ...mono }}>{page}/{pages}</span>
                    <button disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); load(q, status, p) }} className="dp-btn-secondary" style={miniBtn}>Suiv. →</button>
                </div>
            )}
        </div>
    )
}

// ── Règles de l'app ───────────────────────────────────────────────────────────
function ReglesTab({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string) => void }) {
    const [settings, setSettings] = useState<Setting[] | null>(null)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [pendingKey, setPendingKey] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/admin/settings').then(async r => {
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Chargement impossible.')
            setSettings((await r.json()).settings)
        }).catch(e => onError(e.message))
    }, [onError])

    const put = async (key: string, value: string | number | boolean | null, okMsg: string) => {
        setPendingKey(key)
        try {
            const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
            const d = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(d?.error || 'Écriture impossible.')
            setSettings(d.settings)
            setDrafts(prev => { const n = { ...prev }; delete n[key]; return n })
            onNotice(okMsg)
        } catch (e: any) { onError(e.message) } finally { setPendingKey(null) }
    }

    if (!settings) return <div style={{ textAlign: 'center', padding: 60 }}><span className="dp-spinner" /></div>

    const GROUPS: { key: Setting['group']; title: string; blurb: string }[] = [
        { key: 'ai', title: 'Modèles IA', blurb: 'Quels modèles OpenRouter propulsent chaque étape. Épingler un modèle précis fiabilise (et fige le coût de) l’analyse.' },
        { key: 'limits', title: 'Plafonds', blurb: 'Les limites de consommation par utilisateur / dossier.' },
        { key: 'access', title: 'Accès & facturation', blurb: 'Les interrupteurs globaux de l’application.' },
    ]
    const srcBadge = (s: Setting) => s.source === 'db'
        ? <span className="dp-chip is-ok" style={{ fontSize: 10 }}>réglé ici</span>
        : s.source === 'env'
            ? <span className="dp-chip" style={{ fontSize: 10 }}>variable d’env</span>
            : <span className="dp-chip" style={{ fontSize: 10, opacity: .65 }}>défaut</span>

    return (
        <div className="animate-fadeIn">
            {GROUPS.map(g => (
                <div key={g.key} className="dp-card" style={{ padding: 20, marginBottom: 16 }}>
                    <div style={{ marginBottom: 4, fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', fontFamily: 'var(--hf)' }}>{g.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>{g.blurb}</div>

                    {settings.filter(s => s.group === g.key).map(s => {
                        const draft = drafts[s.key]
                        const dirty = draft !== undefined && draft !== String(s.value)
                        return (
                            <div key={s.key} style={{ padding: '12px 0', borderTop: '1px solid var(--line-2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{s.label}</span>
                                    {srcBadge(s)}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, maxWidth: 640 }}>{s.help}</div>

                                {s.type === 'boolean' ? (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button disabled={pendingKey === s.key}
                                            onClick={() => put(s.key, !(s.value as boolean), `« ${s.label} » ${!(s.value as boolean) ? 'activé' : 'désactivé'}.`)}
                                            className={s.value ? 'dp-btn-primary' : 'dp-btn-secondary'} style={miniBtn}>
                                            {pendingKey === s.key ? '…' : s.value ? '● Activé' : '○ Désactivé'}
                                        </button>
                                        {s.source === 'db' && (
                                            <button disabled={pendingKey === s.key} onClick={() => put(s.key, null, `« ${s.label} » réinitialisé.`)} className="dp-btn-secondary" style={{ ...miniBtn, opacity: .75 }}>Réinitialiser</button>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                            className="dp-input"
                                            style={{ maxWidth: 360, padding: '7px 11px', fontSize: 13, ...(s.type === 'number' ? mono : {}) }}
                                            type={s.type === 'number' ? 'number' : 'text'}
                                            list={s.options ? `opts-${s.key}` : undefined}
                                            value={draft ?? String(s.value)}
                                            onChange={e => setDrafts(prev => ({ ...prev, [s.key]: e.target.value }))}
                                            aria-label={s.label}
                                        />
                                        {s.options && (
                                            <datalist id={`opts-${s.key}`}>
                                                {s.options.map(o => <option key={o} value={o} />)}
                                            </datalist>
                                        )}
                                        <button disabled={!dirty || pendingKey === s.key}
                                            onClick={() => put(s.key, s.type === 'number' ? Number(draft) : (draft ?? '').trim(), `« ${s.label} » enregistré.`)}
                                            className="dp-btn-primary" style={{ ...miniBtn, opacity: dirty ? 1 : .5 }}>
                                            {pendingKey === s.key ? 'Enregistrement…' : 'Enregistrer'}
                                        </button>
                                        {s.source === 'db' && (
                                            <button disabled={pendingKey === s.key} onClick={() => put(s.key, null, `« ${s.label} » réinitialisé (retour ${s.envVar ? 'variable d’env' : 'défaut'}).`)} className="dp-btn-secondary" style={{ ...miniBtn, opacity: .75 }}>Réinitialiser</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}

            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
                Les changements prennent effet côté serveur en ≤ 30 s (cache court). « Réinitialiser » supprime la
                surcharge et rend la main à la variable d’environnement, puis au défaut codé.
            </div>
        </div>
    )
}
