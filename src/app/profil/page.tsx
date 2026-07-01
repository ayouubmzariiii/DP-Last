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
interface Account { email: string; createdAt?: string }

const STEP_LABELS = ['Demandeur', 'Terrain', 'Travaux', 'PLU', 'Photos', 'Plans', 'Génération']

export default function ProfilePage() {
    const router = useRouter()
    const [dossiers, setDossiers] = useState<DossierMeta[] | null>(null)
    const [account, setAccount] = useState<Account | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

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

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="dp-page-head flex items-start justify-between gap-4">
                <div>
                    <span className="dp-eyebrow">Mon espace</span>
                    <h1 className="dp-page-title">Mon <span className="accent">profil</span></h1>
                    <p className="dp-page-sub">Retrouvez et reprenez tous vos projets de déclaration préalable.</p>
                </div>
                <button onClick={logout} className="dp-btn-secondary text-sm shrink-0">Se déconnecter</button>
            </div>
            <div className="dp-rule" />

            {error && <div className="dp-alert is-error mb-4">⚠️ {error}</div>}

            {/* Identity + stats */}
            <div className="dp-card mb-6">
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center justify-center shrink-0 text-white font-bold"
                            style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ac)', fontSize: 24, fontFamily: 'var(--hf)' }}>
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold t-ink truncate">{account?.email || '…'}</div>
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
        </div>
    )
}
