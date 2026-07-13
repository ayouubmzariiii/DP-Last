'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { computeSuivi, type MilestoneStatus } from '@/lib/dossierTimeline'

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
    numeroDp?: string | null
    affichageAt?: string | null
    archivedAt?: string | null
    empty?: boolean
    summary?: { applicant: string; address: string; worksType: string; files: DossierFiles; abf?: boolean }
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

const fmtD = (x?: Date | string | null) => {
    if (!x) return ''
    try { return new Date(x).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' }
}

// ── Suivi d'instruction — timeline légale + n° de DP + affichage + panneau ──
const DOT: Record<MilestoneStatus, { ch: string; color: string }> = {
    done: { ch: '✓', color: 'var(--acd)' },
    current: { ch: '●', color: '#B07E1E' },
    alert: { ch: '!', color: '#8F2E22' },
    upcoming: { ch: '○', color: 'var(--muted)' },
}

function SuiviInstruction({ d, pending, onPatch }: {
    d: DossierMeta
    pending: boolean
    onPatch: (body: Record<string, unknown>, okMsg?: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [numEdit, setNumEdit] = useState(false)
    const [numVal, setNumVal] = useState(d.numeroDp || '')
    const [affVal, setAffVal] = useState(() => new Date().toISOString().slice(0, 10))

    const suivi = computeSuivi({
        submittedAt: d.submittedAt ?? null,
        decision: d.decision ?? null,
        decisionAt: d.decisionAt ?? null,
        affichageAt: d.affichageAt ?? null,
        abf: d.summary?.abf,
    })
    if (!suivi) return null
    const { milestones, outcome } = suivi

    const refused = outcome === 'rejected'
    const boxStyle: React.CSSProperties = refused
        ? { background: '#FDF4F1', border: '1px solid #EBC3BB' }
        : outcome ? { background: 'var(--act)', border: '1px solid var(--acb)' }
            : { background: '#F7EFDC', border: '1px solid #E5D5AC' }
    const miniBtn: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5 }

    const commitNum = () => {
        setNumEdit(false)
        const v = numVal.trim()
        if (v === (d.numeroDp || '')) return
        onPatch({ numeroDp: v || null }, v ? 'N° de DP enregistré.' : 'N° de DP effacé.')
    }

    // Résumé sur UNE ligne pour la liste : statut + prochaine échéance. Le détail
    // (timeline complète, n° de DP, affichage, panneau) ne s'ouvre qu'à la demande.
    const recours = milestones.find(m => m.key === 'recours')
    const statusColor = refused ? '#8F2E22' : outcome ? 'var(--acd)' : '#7A5C1E'
    const headline = refused
        ? `✗ Refusée${d.decisionAt ? ` le ${fmtD(d.decisionAt)}` : ''}`
        : outcome === 'accepted' ? `✓ Acceptée${d.decisionAt ? ` le ${fmtD(d.decisionAt)}` : ''}`
            : outcome === 'tacite' ? `✓ Tacite acquise le ${fmtD(suivi.outcomeDate)}`
                : `⏳ Réponse de la mairie avant le ${fmtD(suivi.taciteDate)}`
    const nextBit = (outcome === 'accepted' || outcome === 'tacite')
        ? (!d.affichageAt ? ' · ⚠ panneau à afficher'
            : recours?.status === 'current' ? ` · recours des tiers jusqu'au ${fmtD(recours.date)}`
                : recours?.status === 'done' ? ' · délai de recours purgé' : '')
        : ''

    return (
        <div style={{ marginTop: 10, borderRadius: 10, ...boxStyle }}>
            {/* Ligne compacte, toujours visible */}
            <button onClick={() => setOpen(o => !o)} aria-expanded={open}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: statusColor, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {headline}{nextBit}
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{open ? 'Réduire ▴' : 'Suivi ▾'}</span>
            </button>

            {open && (
                <div className="animate-fadeIn" style={{ padding: '2px 12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                            {suivi.delaiMois === 2 ? 'Secteur protégé (ABF) : délai d’instruction de 2 mois.' : 'Délai d’instruction de droit commun : 1 mois.'}
                        </span>
                        {/* N° d'enregistrement (porté sur le récépissé de dépôt) */}
                        {numEdit ? (
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <input className="dp-input" style={{ width: 190, padding: '5px 9px', fontSize: 12.5 }} value={numVal} autoFocus
                                    placeholder="ex : DP 059 350 26 A0123"
                                    onChange={e => setNumVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitNum(); if (e.key === 'Escape') setNumEdit(false) }}
                                    aria-label="Numéro de la déclaration préalable" />
                                <button onClick={commitNum} className="dp-btn-primary" style={miniBtn}>OK</button>
                            </span>
                        ) : (
                            <button onClick={() => { setNumVal(d.numeroDp || ''); setNumEdit(true) }} disabled={pending}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', textDecoration: 'underline' }}>
                                {d.numeroDp ? `N° ${d.numeroDp} · modifier` : '＋ N° de DP (sur le récépissé)'}
                            </button>
                        )}
                    </div>

                    {/* Timeline légale */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {milestones.map(m => (
                            <div key={m.key} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                                <span aria-hidden style={{ width: 14, textAlign: 'center', flexShrink: 0, fontWeight: 700, fontSize: 12, color: DOT[m.status].color }}>{DOT[m.status].ch}</span>
                                <div style={{ minWidth: 0 }}>
                                    <span style={{ fontSize: 12.5, fontWeight: m.status === 'current' || m.status === 'alert' ? 700 : 600, color: 'var(--ink)' }}>
                                        {m.label}{m.date ? ` — ${fmtD(m.date)}` : ''}
                                    </span>
                                    {m.detail && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 1 }}>{m.detail}</div>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions contextuelles */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        {!d.decision && (
                            <>
                                <button onClick={() => onPatch({ decision: 'accepted' }, 'Félicitations — DP acceptée !')} disabled={pending} className="dp-btn-primary" style={miniBtn}>
                                    {outcome === 'tacite' ? '✓ Confirmer l’acceptation (tacite)' : '✓ Acceptée'}
                                </button>
                                <button onClick={() => onPatch({ decision: 'rejected' }, 'Décision enregistrée.')} disabled={pending} className="dp-btn-secondary" style={miniBtn}>✗ Refusée</button>
                                <button onClick={() => onPatch({ submittedAt: null }, 'Dépôt annulé.')} disabled={pending} className="dp-btn-secondary" style={{ ...miniBtn, opacity: .8 }}>Annuler le dépôt</button>
                            </>
                        )}
                        {(outcome === 'accepted' || outcome === 'tacite') && (
                            <>
                                {!d.affichageAt ? (
                                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input type="date" className="dp-input" style={{ width: 150, padding: '5px 9px', fontSize: 12.5 }} value={affVal}
                                            max={new Date().toISOString().slice(0, 10)}
                                            onChange={e => setAffVal(e.target.value)} aria-label="Date de pose du panneau" />
                                        <button onClick={() => affVal && onPatch({ affichageAt: new Date(`${affVal}T12:00:00`).toISOString() }, 'Date d’affichage enregistrée — le délai de recours court.')}
                                            disabled={pending || !affVal} className="dp-btn-secondary" style={miniBtn}>
                                            📌 Panneau posé à cette date
                                        </button>
                                    </span>
                                ) : (
                                    <button onClick={() => onPatch({ affichageAt: null }, 'Date d’affichage effacée.')} disabled={pending}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', textDecoration: 'underline', fontFamily: 'inherit' }}>
                                        corriger la date d’affichage
                                    </button>
                                )}
                            </>
                        )}
                        {!refused && (
                            <button onClick={() => window.open(`/api/dossiers/${d.id}/panneau`, '_blank')} className="dp-btn-secondary" style={miniBtn}>
                                📋 Panneau d’affichage (PDF)
                            </button>
                        )}
                        {d.decision && (
                            <button onClick={() => onPatch({ decision: null }, 'Retour en instruction.')} disabled={pending}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--muted)', textDecoration: 'underline', fontFamily: 'inherit' }}>
                                modifier la décision
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
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
        // Shared-computer hygiene: drop the per-dossier offline caches of this account.
        try {
            Object.keys(localStorage).filter(k => k.startsWith('dp-dossier-')).forEach(k => localStorage.removeItem(k))
        } catch { /* noop */ }
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

    // "Reprendre" hero — the most recently touched draft, one click back into the wizard.
    const resumeTarget = projects
        .filter(d => !d.archivedAt && d.status === 'draft')
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0]

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

                    {/* Reprendre — one-click resume of the latest draft */}
                    {resumeTarget && filter === 'tous' && !query && (
                        <div className="dp-card" style={{ marginBottom: 22, background: 'var(--act)', border: '1px solid var(--acb)' }}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div style={{ minWidth: 0 }}>
                                    <div className="dp-eyebrow" style={{ marginBottom: 4 }}>Reprendre là où vous en étiez</div>
                                    <div style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{resumeTarget.title}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
                                        Étape {resumeTarget.lastStep}/7 · {STEP_LABELS[Math.min(resumeTarget.lastStep, 7) - 1]} · modifié le {fmtDate(resumeTarget.updatedAt)}
                                    </div>
                                </div>
                                <button onClick={() => router.push(`/etape/${resumeTarget.id}/${resumeTarget.lastStep || 1}`)}
                                    className="dp-btn-primary shrink-0 justify-center">
                                    Reprendre →
                                </button>
                            </div>
                        </div>
                    )}

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
                                                {d.submittedAt && lc !== 'archive' && (
                                                    <SuiviInstruction d={d} pending={isPending} onPatch={(body, okMsg) => patchDossier(d.id, body, okMsg)} />
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
