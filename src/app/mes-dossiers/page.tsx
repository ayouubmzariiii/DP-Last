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

export default function MesDossiersPage() {
    const router = useRouter()
    const [dossiers, setDossiers] = useState<DossierMeta[] | null>(null)
    const [email, setEmail] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        try {
            const [dRes, meRes] = await Promise.all([fetch('/api/dossiers'), fetch('/api/auth/me')])
            if (dRes.status === 401) { router.push('/login'); return }
            const d = await dRes.json()
            setDossiers(d.dossiers || [])
            if (meRes.ok) setEmail((await meRes.json()).user?.email || '')
        } catch {
            setError('Impossible de charger vos dossiers.')
            setDossiers([])
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
        } catch {
            setError('Création impossible.'); setBusy(false)
        }
    }

    const rename = async (d: DossierMeta) => {
        const title = window.prompt('Nom du dossier :', d.title)
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

    const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return '' } }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="dp-page-head flex items-start justify-between gap-4">
                <div>
                    <span className="dp-eyebrow">Mon espace</span>
                    <h1 className="dp-page-title">Mes <span className="accent">dossiers</span></h1>
                    <p className="dp-page-sub">{email ? `Connecté en tant que ${email}` : 'Vos déclarations préalables enregistrées.'}</p>
                </div>
                <button onClick={logout} className="dp-btn-secondary text-sm shrink-0">Se déconnecter</button>
            </div>
            <div className="dp-rule" />

            {error && <div className="dp-alert is-error mb-4">⚠️ {error}</div>}

            <div className="flex justify-end mb-5">
                <button onClick={createDossier} disabled={busy} className="dp-btn-primary disabled:opacity-50">
                    {busy ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Création…</> : '+ Nouveau dossier'}
                </button>
            </div>

            {dossiers === null ? (
                <div className="dp-card text-center py-16"><span className="dp-spinner dp-spinner-lg" /></div>
            ) : dossiers.length === 0 ? (
                <div className="dp-card text-center py-16">
                    <div className="text-4xl mb-3">📁</div>
                    <h3 className="font-bold t-ink">Aucun dossier pour le moment</h3>
                    <p className="text-sm t-ink2 mt-1">Créez votre premier dossier de déclaration préalable.</p>
                    <button onClick={createDossier} disabled={busy} className="dp-btn-primary mt-6 mx-auto disabled:opacity-50">+ Nouveau dossier</button>
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
                                <div className="text-xs t-muted mt-1">Étape {d.lastStep}/7 · modifié le {fmtDate(d.updatedAt)}</div>
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
