'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'

interface DossierFiles {
    situation: boolean
    masse: boolean
    notice: boolean
    photos: number
    simulations: number
    croquis: number
}
interface DossierMeta {
    id: string
    title: string
    status: 'draft' | 'complete'
    lastStep: number
    createdAt: string
    updatedAt: string
    clientName?: string | null
    submittedAt?: string | null
    decision?: 'accepted' | 'rejected' | null
    decisionAt?: string | null
    archivedAt?: string | null
    empty?: boolean
    summary?: { applicant: string; address: string; worksType: string; files: DossierFiles }
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

// Lifecycle of a project: constitution (brouillon → complet), then suivi d'instruction
// (déposé en mairie → accepté / refusé). Archived projects are kept but hidden by default.
type Lifecycle = 'brouillon' | 'complet' | 'depose' | 'accepte' | 'refuse' | 'archive'
const lifecycleOf = (d: DossierMeta): Lifecycle =>
    d.archivedAt ? 'archive'
        : d.decision === 'accepted' ? 'accepte'
        : d.decision === 'rejected' ? 'refuse'
        : d.submittedAt ? 'depose'
        : d.status === 'complete' ? 'complet'
        : 'brouillon'

const LIFECYCLE_CHIP: Record<Lifecycle, { label: string; cls: string; style?: React.CSSProperties }> = {
    brouillon: { label: 'Brouillon', cls: 'dp-chip' },
    complet: { label: 'Complet', cls: 'dp-chip is-ok' },
    depose: { label: 'En instruction', cls: 'dp-chip', style: { background: '#F7EFDC', color: '#7A5C1E', borderColor: '#E5D5AC' } },
    accepte: { label: 'Accepté ✓', cls: 'dp-chip is-ok' },
    refuse: { label: 'Refusé', cls: 'dp-chip', style: { background: '#FDF4F1', color: '#8F2E22', borderColor: '#EBC3BB' } },
    archive: { label: 'Archivé', cls: 'dp-chip', style: { opacity: .75 } },
}

type Filter = 'tous' | 'brouillon' | 'complet' | 'depose' | 'archive'
type Sort = 'updated' | 'created' | 'title'

// Délai d'instruction de droit commun d'une DP : 1 mois à compter du dépôt.
const responseDeadline = (submittedIso: string) => {
    const d = new Date(submittedIso)
    d.setMonth(d.getMonth() + 1)
    return d
}

export default function ProfilePage() {
    const router = useRouter()
    const [dossiers, setDossiers] = useState<DossierMeta[] | null>(null)
    const [account, setAccount] = useState<Account | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [tab, setTab] = useState<'projets' | 'params'>('projets')

    // Toolbar
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<Filter>('tous')
    const [sort, setSort] = useState<Sort>('updated')

    // Per-card interactions
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [clientEditId, setClientEditId] = useState<string | null>(null)
    const [clientVal, setClientVal] = useState('')
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [dupMenuId, setDupMenuId] = useState<string | null>(null)
    const [pendingId, setPendingId] = useState<string | null>(null)

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

    // Auto-dismiss the success notice.
    useEffect(() => {
        if (!notice) return
        const t = setTimeout(() => setNotice(null), 4000)
        return () => clearTimeout(t)
    }, [notice])

    const createDossier = async () => {
        setBusy(true); setError(null)
        try {
            const res = await fetch('/api/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            if (!res.ok) throw new Error()
            const { dossier } = await res.json()
            router.push(`/etape/${dossier.id}/1`)
        } catch { setError('Création impossible.'); setBusy(false) }
    }

    // Shared PATCH-like helper: PUT a partial body, surface failures, refresh the list.
    const patchDossier = useCallback(async (id: string, body: Record<string, unknown>, okMsg?: string) => {
        setPendingId(id); setError(null)
        try {
            const res = await fetch(`/api/dossiers/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Mise à jour impossible.')
            }
            await load()
            if (okMsg) setNotice(okMsg)
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : 'Mise à jour impossible.')
        } finally {
            setPendingId(null)
        }
    }, [load])

    const startRename = (d: DossierMeta) => { setEditingId(d.id); setEditTitle(d.title); setConfirmDeleteId(null); setDupMenuId(null) }
    const commitRename = async (d: DossierMeta) => {
        const title = editTitle.trim()
        setEditingId(null)
        if (!title || title === d.title) return
        await patchDossier(d.id, { title }, 'Projet renommé.')
    }

    const startClientEdit = (d: DossierMeta) => { setClientEditId(d.id); setClientVal(d.clientName || '') }
    const commitClientEdit = async (d: DossierMeta) => {
        const v = clientVal.trim()
        setClientEditId(null)
        if (v === (d.clientName || '')) return
        await patchDossier(d.id, { clientName: v || null }, v ? 'Client associé.' : 'Client retiré.')
    }

    const duplicate = async (d: DossierMeta, mode: 'full' | 'terrain') => {
        setDupMenuId(null); setPendingId(d.id); setError(null)
        try {
            const res = await fetch(`/api/dossiers/${d.id}/duplicate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
            })
            if (!res.ok) throw new Error()
            await load()
            setNotice(mode === 'terrain'
                ? `Nouveau projet créé sur le même terrain que « ${d.title} ».`
                : `« ${d.title} » dupliqué.`)
        } catch {
            setError('Duplication impossible. Réessayez.')
        } finally {
            setPendingId(null)
        }
    }

    const remove = async (d: DossierMeta) => {
        setConfirmDeleteId(null); setPendingId(d.id); setError(null)
        try {
            const res = await fetch(`/api/dossiers/${d.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            await load()
            setNotice(`« ${d.title} » supprimé.`)
        } catch {
            setError('Suppression impossible. Réessayez.')
        } finally {
            setPendingId(null)
        }
    }

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login'); router.refresh()
    }

    const fmtDate = (iso?: string | null) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' } }

    // Empty dossiers (nothing but the account-seeded identity — no terrain, works or files) are not
    // real projects: hide them from the list and the counts.
    const projects = useMemo(() => (dossiers ?? []).filter(d => !d.empty), [dossiers])
    const active = projects.filter(d => !d.archivedAt)
    const total = active.length
    const drafts = active.filter(d => lifecycleOf(d) === 'brouillon').length
    const complete = active.filter(d => lifecycleOf(d) === 'complet').length
    const deposes = active.filter(d => !!d.submittedAt).length
    const archivedCount = projects.filter(d => !!d.archivedAt).length
    const initial = (account?.fullName || account?.email || '?').charAt(0).toUpperCase()

    // Toolbar pipeline: filter → search → sort.
    const visible = useMemo(() => {
        let list = projects
        list = filter === 'archive'
            ? list.filter(d => !!d.archivedAt)
            : list.filter(d => !d.archivedAt)
        if (filter === 'brouillon') list = list.filter(d => lifecycleOf(d) === 'brouillon')
        if (filter === 'complet') list = list.filter(d => lifecycleOf(d) === 'complet')
        if (filter === 'depose') list = list.filter(d => !!d.submittedAt)
        const q = query.trim().toLowerCase()
        if (q) {
            list = list.filter(d => [
                d.title, d.clientName, d.summary?.applicant, d.summary?.address, d.summary?.worksType,
            ].some(v => (v || '').toLowerCase().includes(q)))
        }
        const sorted = [...list]
        if (sort === 'updated') sorted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        if (sort === 'created') sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
        return sorted
    }, [projects, filter, query, sort])

    const fileChips = (f: DossierFiles): string[] => {
        const c: string[] = []
        if (f.situation) c.push('Plan de situation')
        if (f.masse) c.push('Plan de masse')
        if (f.photos) c.push(`${f.photos} photo${f.photos > 1 ? 's' : ''}`)
        if (f.simulations) c.push(`${f.simulations} simulation${f.simulations > 1 ? 's' : ''} IA`)
        if (f.croquis) c.push(`${f.croquis} croquis`)
        if (f.notice) c.push('Notice descriptive')
        return c
    }

    const tabStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 600, transition: 'all .15s',
        background: isActive ? 'var(--surface)' : 'transparent', color: isActive ? 'var(--ink)' : 'var(--muted)',
        boxShadow: isActive ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none',
    })
    const filterChipStyle = (isActive: boolean): React.CSSProperties => ({
        padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 12.5, fontWeight: 600, transition: 'all .15s', whiteSpace: 'nowrap',
        border: `1px solid ${isActive ? 'var(--ac)' : 'var(--line)'}`,
        background: isActive ? 'var(--act)' : 'var(--surface)',
        color: isActive ? 'var(--acd)' : 'var(--ink-2)',
    })
    const metricTile: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }
    const metricTileAccent: React.CSSProperties = { background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 12, padding: 16 }
    const miniBtn: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5 }

    const FILTERS: { key: Filter; label: string; count?: number }[] = [
        { key: 'tous', label: 'Tous', count: total },
        { key: 'brouillon', label: 'Brouillons', count: drafts },
        { key: 'complet', label: 'Complets', count: complete },
        { key: 'depose', label: 'Déposés', count: deposes },
        { key: 'archive', label: 'Archivés', count: archivedCount },
    ]

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 880, margin: '0 auto', padding: '44px 24px 80px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <Link href="/" aria-label="Accueil DP Travaux"><Logo size={46} /></Link>
                    <div className="dp-page-head" style={{ marginBottom: 0 }}>
                        <span className="dp-eyebrow">Mon espace</span>
                        <h1 className="dp-page-title">Mon <span className="accent">profil</span></h1>
                    </div>
                </div>
                <button onClick={logout} className="dp-btn-secondary" style={{ flexShrink: 0 }}>Se déconnecter</button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4, margin: '0 0 28px' }}>
                <button onClick={() => setTab('projets')} style={tabStyle(tab === 'projets')}>Mes projets</button>
                <button onClick={() => setTab('params')} style={tabStyle(tab === 'params')}>Paramètres</button>
            </div>

            {error && <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
            {notice && <div className="dp-alert is-ok" style={{ marginBottom: 16 }}>✓ {notice}</div>}

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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                            <div className="dp-metric" style={metricTile}><span className="val">{total}</span><span className="key">Projets</span></div>
                            <div className="dp-metric" style={metricTile}><span className="val">{drafts}</span><span className="key">Brouillons</span></div>
                            <div className="dp-metric" style={metricTile}><span className="val">{complete}</span><span className="key">Complets</span></div>
                            <div className="dp-metric is-accent" style={metricTileAccent}><span className="val">{deposes}</span><span className="key">Déposés en mairie</span></div>
                        </div>
                    </div>

                    {/* Projects header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                        <h2 className="dp-section-title" style={{ margin: 0, padding: 0, border: 'none' }}>Mes projets</h2>
                        <button onClick={createDossier} disabled={busy} className="dp-btn-primary">
                            {busy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Création…</> : '+ Nouveau projet'}
                        </button>
                    </div>

                    {/* Toolbar: search + filters + sort (shown once there is something to organize) */}
                    {projects.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <input
                                    className="dp-input"
                                    style={{ flex: 1, minWidth: 0 }}
                                    placeholder="Rechercher un projet, une adresse, un client…"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    aria-label="Rechercher un projet"
                                />
                                <select className="dp-select" style={{ width: 'auto', flexShrink: 0 }} value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Trier les projets">
                                    <option value="updated">Modifiés récemment</option>
                                    <option value="created">Créés récemment</option>
                                    <option value="title">Titre A → Z</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {FILTERS.map(f => (
                                    <button key={f.key} onClick={() => setFilter(f.key)} style={filterChipStyle(filter === f.key)}>
                                        {f.label}{typeof f.count === 'number' ? ` · ${f.count}` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {dossiers === null ? (
                        <div className="dp-card" style={{ textAlign: 'center', padding: '64px 0' }}><span className="dp-spinner dp-spinner-lg" /></div>
                    ) : projects.length === 0 ? (
                        <div className="dp-card" style={{ textAlign: 'center', padding: '56px 0' }}>
                            <div style={{ fontSize: 34, marginBottom: 12 }}>📁</div>
                            <h3 style={{ fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Aucun projet pour le moment</h3>
                            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>Créez votre premier dossier de déclaration préalable.</p>
                            <button onClick={createDossier} disabled={busy} className="dp-btn-primary" style={{ marginTop: 24 }}>+ Nouveau projet</button>
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="dp-card" style={{ textAlign: 'center', padding: '44px 0' }}>
                            <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
                            <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                                {filter === 'archive' ? 'Aucun projet archivé.' : 'Aucun projet ne correspond à votre recherche.'}
                            </p>
                            {(query || filter !== 'tous') && (
                                <button onClick={() => { setQuery(''); setFilter('tous') }} className="dp-btn-secondary" style={{ marginTop: 18 }}>Réinitialiser les filtres</button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {visible.map(d => {
                                const chips = d.summary ? fileChips(d.summary.files) : []
                                const details = [d.summary?.worksType, d.summary?.address].filter(Boolean).join(' · ')
                                const lc = lifecycleOf(d)
                                const chip = LIFECYCLE_CHIP[lc]
                                const isPending = pendingId === d.id
                                const deadline = d.submittedAt ? responseDeadline(d.submittedAt) : null
                                const deadlinePassed = deadline ? deadline.getTime() < Date.now() : false
                                return (
                                    <div key={d.id} className="dp-card" style={{ padding: '16px 18px', opacity: lc === 'archive' ? .85 : 1, position: 'relative' }}>
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                            <div className="w-full sm:flex-1" style={{ minWidth: 0 }}>
                                                {/* Title row — inline rename */}
                                                {editingId === d.id ? (
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                        <input
                                                            className="dp-input"
                                                            style={{ flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 14 }}
                                                            value={editTitle}
                                                            autoFocus
                                                            onChange={e => setEditTitle(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') commitRename(d); if (e.key === 'Escape') setEditingId(null) }}
                                                            aria-label="Nom du projet"
                                                        />
                                                        <button onClick={() => commitRename(d)} className="dp-btn-primary" style={miniBtn}>OK</button>
                                                        <button onClick={() => setEditingId(null)} className="dp-btn-secondary" style={miniBtn}>Annuler</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                            <span style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflowWrap: 'anywhere' }}>{d.title}</span>
                                                            <span className={chip.cls} style={chip.style}>{chip.label}</span>
                                                            {d.clientName && <span className="dp-chip" style={{ fontSize: 11 }}>👤 {d.clientName}</span>}
                                                        </div>
                                                    </button>
                                                )}

                                                {details && (
                                                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', marginBottom: 4, overflowWrap: 'anywhere' }}>{details}</div>
                                                )}
                                                <div className="dp-meta" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                                                    {d.summary?.applicant ? `${d.summary.applicant} · ` : ''}Étape {d.lastStep}/7 · {STEP_LABELS[Math.min(d.lastStep, 7) - 1]} · modifié le {fmtDate(d.updatedAt)}
                                                </div>

                                                {/* Client (usage pro) — inline edit */}
                                                {clientEditId === d.id ? (
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                                        <input
                                                            className="dp-input"
                                                            style={{ maxWidth: 260, padding: '6px 10px', fontSize: 13 }}
                                                            value={clientVal}
                                                            autoFocus
                                                            placeholder="Nom du client"
                                                            onChange={e => setClientVal(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') commitClientEdit(d); if (e.key === 'Escape') setClientEditId(null) }}
                                                            aria-label="Nom du client"
                                                        />
                                                        <button onClick={() => commitClientEdit(d)} className="dp-btn-primary" style={miniBtn}>OK</button>
                                                        <button onClick={() => setClientEditId(null)} className="dp-btn-secondary" style={miniBtn}>Annuler</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startClientEdit(d)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}>
                                                        {d.clientName ? `👤 Client : ${d.clientName} · modifier` : '＋ Associer un client'}
                                                    </button>
                                                )}

                                                {chips.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                                        {chips.map(c => (
                                                            <span key={c} className="dp-chip is-ok" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>
                                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                                                                {c}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Suivi d'instruction en mairie */}
                                                {lc === 'complet' && (
                                                    <div style={{ marginTop: 12 }}>
                                                        <button onClick={() => patchDossier(d.id, { submittedAt: new Date().toISOString() }, 'Dossier marqué comme déposé en mairie.')} disabled={isPending} className="dp-btn-secondary" style={miniBtn}>
                                                            📮 Marquer comme déposé en mairie
                                                        </button>
                                                    </div>
                                                )}
                                                {lc === 'depose' && deadline && (
                                                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#F7EFDC', border: '1px solid #E5D5AC' }}>
                                                        <div style={{ fontSize: 12.5, color: '#7A5C1E', fontWeight: 600 }}>
                                                            Déposé le {fmtDate(d.submittedAt)} · instruction en cours
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#7A5C1E', marginTop: 2 }}>
                                                            {deadlinePassed
                                                                ? `Le délai d'instruction d'1 mois est écoulé depuis le ${fmtDate(deadline.toISOString())} — sans réponse de la mairie, votre DP est en principe tacitement acceptée.`
                                                                : `Réponse de la mairie attendue avant le ${fmtDate(deadline.toISOString())} (délai courant : 1 mois).`}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                                            <button onClick={() => patchDossier(d.id, { decision: 'accepted' }, 'Félicitations — DP acceptée !')} disabled={isPending} className="dp-btn-primary" style={miniBtn}>✓ Acceptée</button>
                                                            <button onClick={() => patchDossier(d.id, { decision: 'rejected' }, 'Décision enregistrée.')} disabled={isPending} className="dp-btn-secondary" style={miniBtn}>✗ Refusée</button>
                                                            <button onClick={() => patchDossier(d.id, { submittedAt: null }, 'Dépôt annulé.')} disabled={isPending} className="dp-btn-secondary" style={{ ...miniBtn, opacity: .8 }}>Annuler le dépôt</button>
                                                        </div>
                                                    </div>
                                                )}
                                                {(lc === 'accepte' || lc === 'refuse') && (
                                                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 12.5, color: lc === 'accepte' ? 'var(--acd)' : '#8F2E22', fontWeight: 600 }}>
                                                            {lc === 'accepte' ? '✓ DP acceptée' : '✗ DP refusée'}{d.decisionAt ? ` le ${fmtDate(d.decisionAt)}` : ''} (déposée le {fmtDate(d.submittedAt)})
                                                        </span>
                                                        <button onClick={() => patchDossier(d.id, { decision: null }, 'Retour en instruction.')} disabled={isPending} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', textDecoration: 'underline', fontFamily: 'inherit' }}>
                                                            modifier
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto sm:flex-col sm:items-stretch" style={{ position: 'relative' }}>
                                                {confirmDeleteId === d.id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#FDF4F1', border: '1px solid #EBC3BB', maxWidth: 240 }}>
                                                        <span style={{ fontSize: 12.5, color: '#8F2E22', fontWeight: 600 }}>Supprimer définitivement « {d.title} » ?</span>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button onClick={() => remove(d)} disabled={isPending} className="dp-btn-outline" style={{ ...miniBtn, color: '#8F2E22', borderColor: '#EBC3BB' }}>
                                                                {isPending ? 'Suppression…' : 'Supprimer'}
                                                            </button>
                                                            <button onClick={() => setConfirmDeleteId(null)} className="dp-btn-secondary" style={miniBtn}>Annuler</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button onClick={() => router.push(`/etape/${d.id}/${d.lastStep || 1}`)} className="dp-btn-primary flex-1 sm:flex-none justify-center" style={{ padding: '9px 16px', fontSize: 13 }}>Ouvrir</button>
                                                        <button onClick={() => startRename(d)} className="dp-btn-secondary flex-1 sm:flex-none justify-center" style={miniBtn}>Renommer</button>
                                                        <button onClick={() => { setDupMenuId(dupMenuId === d.id ? null : d.id); setConfirmDeleteId(null) }} disabled={isPending} className="dp-btn-secondary flex-1 sm:flex-none justify-center" style={miniBtn}>
                                                            {isPending ? <span className="dp-spinner dp-spinner-sm" /> : 'Dupliquer ▾'}
                                                        </button>
                                                        {lc === 'archive' ? (
                                                            <button onClick={() => patchDossier(d.id, { archived: false }, 'Projet restauré.')} disabled={isPending} className="dp-btn-secondary flex-1 sm:flex-none justify-center" style={miniBtn}>Restaurer</button>
                                                        ) : (
                                                            <button onClick={() => patchDossier(d.id, { archived: true }, 'Projet archivé — retrouvez-le via le filtre « Archivés ».')} disabled={isPending} className="dp-btn-secondary flex-1 sm:flex-none justify-center" style={miniBtn}>Archiver</button>
                                                        )}
                                                        <button onClick={() => { setConfirmDeleteId(d.id); setDupMenuId(null) }} className="dp-btn-secondary justify-center shrink-0" style={{ padding: '7px 11px', fontSize: 13 }} title="Supprimer" aria-label="Supprimer">🗑</button>
                                                    </>
                                                )}

                                                {/* Duplicate menu */}
                                                {dupMenuId === d.id && (
                                                    <>
                                                        <div onClick={() => setDupMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
                                                        <div className="dp-card" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50, padding: 8, width: 280, boxShadow: '0 12px 32px -12px rgba(37,34,30,.35)' }}>
                                                            <button onClick={() => duplicate(d, 'full')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Copie identique</div>
                                                                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Tout est repris : travaux, photos, plans, simulations.</div>
                                                            </button>
                                                            <button onClick={() => duplicate(d, 'terrain')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Même terrain, nouveaux travaux</div>
                                                                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Demandeur, terrain et analyse PLU conservés — travaux, photos et plans remis à zéro.</div>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
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
