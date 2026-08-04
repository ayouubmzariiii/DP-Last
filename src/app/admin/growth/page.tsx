'use client'

// ─────────────────────────────────────────────────────────────────────────────
// /admin/growth — l'onglet Croissance du back-office.
//
// Trois lectures, dans l'ordre d'importance pendant la phase de test :
//  1. L'entonnoir : où les visiteurs décrochent, en visiteurs distincts.
//  2. Les retours : ce qu'ils disent quand ils décrochent.
//  3. Les candidatures testeurs : le pipeline de recrutement, avec son statut.
//
// Page ADDITIVE : elle est servie sous /admin (déjà gardé par le middleware et
// re-vérifié en base par /api/admin/growth) et ne modifie pas /admin existant.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

interface FunnelRow { path: string; label: string; visiteurs: number; vues: number }
interface SourceRow { source: string; visiteurs: number }
interface EventRow { name: string; total: number }
interface SignupRow {
    id: string; email: string; nom: string | null; phone: string | null; profil: string
    metier: string | null; travaux: string | null; commune: string | null; codePostal: string | null
    message: string | null; source: string | null; status: string; notes: string | null; createdAt: string
}
interface FeedbackRow {
    id: string; category: string; message: string; rating: number | null; email: string | null
    path: string | null; step: number | null; resolved: boolean; createdAt: string; userEmail: string | null
}
interface Payload {
    jours: number
    funnel: FunnelRow[]
    sources: SourceRow[]
    events: EventRow[]
    signups: { stats: { total: number; nouveaux: number; pros: number; deposes: number; periode: number }; rows: SignupRow[] }
    feedback: { stats: { total: number; ouverts: number; bugs: number; periode: number }; rows: FeedbackRow[] }
}

type Tab = 'entonnoir' | 'testeurs' | 'retours'

const STATUTS: { id: string; label: string }[] = [
    { id: 'nouveau', label: 'Nouveau' },
    { id: 'contacte', label: 'Contacté' },
    { id: 'actif', label: 'Dossier en cours' },
    { id: 'depose', label: 'Déposé en mairie' },
    { id: 'ecarte', label: 'Écarté' },
]

const CAT_LABEL: Record<string, string> = {
    bug: 'Bug', confus: 'Incompréhension', manque: 'Information manquante', idee: 'Suggestion', autre: 'Autre',
}

const mono: React.CSSProperties = { fontFamily: 'var(--mf)' }
const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function GrowthPage() {
    const [tab, setTab] = useState<Tab>('entonnoir')
    const [jours, setJours] = useState(30)
    const [data, setData] = useState<Payload | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState<string | null>(null)

    const load = useCallback(async () => {
        setError('')
        try {
            const res = await fetch(`/api/admin/growth?jours=${jours}`, { cache: 'no-store' })
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Chargement impossible.')
            setData(await res.json())
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Chargement impossible.')
        }
    }, [jours])

    useEffect(() => { void load() }, [load])

    async function patch(body: Record<string, unknown>, key: string) {
        setBusy(key)
        try {
            await fetch('/api/admin/growth', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            await load()
        } finally {
            setBusy(null)
        }
    }

    // Base de l'entonnoir : la première marche non nulle, pour que les taux
    // restent lisibles même quand la mesure vient de démarrer.
    const base = data?.funnel.find(f => f.visiteurs > 0)?.visiteurs ?? 0
    const maxVis = Math.max(1, ...(data?.funnel.map(f => f.visiteurs) ?? [1]))

    return (
        <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
            <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <Logo size={34} />
                    <div>
                        <p style={{ margin: 0, fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>Croissance</p>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Entonnoir, testeurs et retours</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <select className="dp-select" value={jours} onChange={e => setJours(Number(e.target.value))} style={{ width: 'auto', padding: '8px 12px', fontSize: 13.5 }}>
                            <option value={7}>7 jours</option>
                            <option value={30}>30 jours</option>
                            <option value={90}>90 jours</option>
                            <option value={365}>1 an</option>
                        </select>
                        <Link href="/admin" className="dp-btn-secondary" style={{ padding: '8px 14px', fontSize: 13.5, textDecoration: 'none' }}>← Back-office</Link>
                    </div>
                </div>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 4 }}>
                    {([['entonnoir', 'Entonnoir'], ['retours', 'Retours'], ['testeurs', 'Testeurs']] as [Tab, string][]).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                padding: '11px 14px', fontSize: 14, fontWeight: 600,
                                color: tab === id ? 'var(--ac)' : 'var(--muted)',
                                borderBottom: `2px solid ${tab === id ? 'var(--ac)' : 'transparent'}`,
                            }}
                        >
                            {label}
                            {id === 'retours' && data && data.feedback.stats.ouverts > 0 && (
                                <span className="dp-chip is-missing" style={{ marginLeft: 8, padding: '2px 7px', fontSize: 11 }}>{data.feedback.stats.ouverts}</span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <main style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 20px 60px' }}>
                {error && <div className="dp-alert is-error" style={{ marginBottom: 18 }}>{error}</div>}
                {!data && !error && <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--muted)' }}><span className="dp-spinner dp-spinner-sm" /> Chargement…</div>}

                {data && (
                    <>
                        {/* ── Chiffres clés ─────────────────────────────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12, marginBottom: 26 }}>
                            {[
                                ['Candidatures testeurs', data.signups.stats.total, `${data.signups.stats.periode} sur la période`],
                                ['Dont professionnels', data.signups.stats.pros, 'volume répété'],
                                ['Dossiers déposés', data.signups.stats.deposes, 'la seule vraie mesure'],
                                ['Retours ouverts', data.feedback.stats.ouverts, `${data.feedback.stats.bugs} bug${data.feedback.stats.bugs > 1 ? 's' : ''} signalé${data.feedback.stats.bugs > 1 ? 's' : ''}`],
                            ].map(([k, v, sub], i) => (
                                <div key={i} className={`dp-metric${i === 2 ? ' is-accent' : ''}`}>
                                    <span className="val">{v as number}</span>
                                    <span className="key">{k as string}</span>
                                    <span style={{ ...mono, display: 'block', marginTop: 4, fontSize: 10.5, color: 'var(--faint)' }}>{sub as string}</span>
                                </div>
                            ))}
                        </div>

                        {/* ── Entonnoir ─────────────────────────────────────── */}
                        {tab === 'entonnoir' && (
                            <>
                                <div className="dp-card" style={{ marginBottom: 16 }}>
                                    <h2 className="dp-section-title">Entonnoir — visiteurs distincts par étape</h2>
                                    {base === 0 ? (
                                        <div className="dp-alert is-info">
                                            Aucune mesure encore enregistrée sur la période. Les vues sont collectées automatiquement dès
                                            qu&apos;un visiteur navigue sur le site : cette section se remplit d&apos;elle-même.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: 7 }}>
                                            {data.funnel.map((f, i) => {
                                                const prev = i > 0 ? data.funnel[i - 1] : null
                                                const chuteRel = prev && prev.visiteurs > 0 ? Math.round((1 - f.visiteurs / prev.visiteurs) * 100) : null
                                                const pctBase = base > 0 ? Math.round((f.visiteurs / base) * 100) : 0
                                                const alerte = chuteRel !== null && chuteRel >= 40 && prev!.visiteurs >= 5
                                                return (
                                                    <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                        <span style={{ minWidth: 186, fontSize: 13.5, color: 'var(--ink-2)' }}>{f.label}</span>
                                                        <div style={{ flex: 1, minWidth: 160, height: 26, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
                                                            <div style={{ width: `${Math.max(2, (f.visiteurs / maxVis) * 100)}%`, height: '100%', background: alerte ? '#EBD9A8' : 'var(--act)', borderRight: `1px solid ${alerte ? '#D9C286' : 'var(--acb)'}` }} />
                                                            <span style={{ ...mono, position: 'absolute', left: 9, top: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--acd)' }}>
                                                                {f.visiteurs}
                                                            </span>
                                                        </div>
                                                        <span style={{ ...mono, minWidth: 46, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{pctBase}%</span>
                                                        <span style={{ ...mono, minWidth: 96, fontSize: 12, color: alerte ? '#8A6D1F' : 'var(--faint)', textAlign: 'right' }}>
                                                            {chuteRel === null ? '—' : chuteRel > 0 ? `−${chuteRel}% vs préc.` : 'stable'}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    <p style={{ margin: '16px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}>
                                        Une marche surlignée signale une chute d&apos;au moins 40 % par rapport à l&apos;étape précédente : c&apos;est
                                        là qu&apos;il faut aller lire les retours et, si besoin, appeler un testeur.
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
                                    <div className="dp-card">
                                        <h2 className="dp-section-title">Provenance</h2>
                                        {data.sources.length === 0 ? <p style={{ fontSize: 14, color: 'var(--muted)' }}>Aucune donnée.</p> : (
                                            <div style={{ display: 'grid', gap: 1, background: 'var(--line-2)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                                                {data.sources.map(s => (
                                                    <div key={s.source} style={{ background: 'var(--surface)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                        <span style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.source}</span>
                                                        <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.visiteurs}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
                                            Ajoutez <code style={mono}>?utm_source=forum-construire</code> à vos liens pour distinguer chaque canal.
                                        </p>
                                    </div>

                                    <div className="dp-card">
                                        <h2 className="dp-section-title">Événements</h2>
                                        <div style={{ display: 'grid', gap: 1, background: 'var(--line-2)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                                            {data.events.map(e => (
                                                <div key={e.name} style={{ background: 'var(--surface)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                    <span style={{ ...mono, fontSize: 12.5, color: 'var(--ink-2)' }}>{e.name}</span>
                                                    <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{e.total}</span>
                                                </div>
                                            ))}
                                            {data.events.length === 0 && <div style={{ background: 'var(--surface)', padding: '10px 14px', fontSize: 13, color: 'var(--muted)' }}>Aucun événement.</div>}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Retours ───────────────────────────────────────── */}
                        {tab === 'retours' && (
                            <div className="dp-card">
                                <h2 className="dp-section-title">Retours utilisateurs ({data.feedback.stats.total})</h2>
                                {data.feedback.rows.length === 0 ? (
                                    <div className="dp-alert is-info">
                                        Aucun retour pour l&apos;instant. Le widget « Un retour ? » est présent en bas à droite de toutes
                                        les pages du site et de l&apos;assistant.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        {data.feedback.rows.map(f => (
                                            <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', background: f.resolved ? 'var(--surface-2)' : 'var(--surface)', opacity: f.resolved ? 0.72 : 1 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                    <span className={`dp-chip${f.category === 'bug' ? ' is-missing' : ''}`}>{CAT_LABEL[f.category] || f.category}</span>
                                                    {f.step && <span className="dp-chip"><span className="code">Étape {f.step}</span></span>}
                                                    {f.path && <span style={{ ...mono, fontSize: 11.5, color: 'var(--faint)' }}>{f.path}</span>}
                                                    <span style={{ ...mono, marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)' }}>{fmt(f.createdAt)}</span>
                                                </div>
                                                <p style={{ margin: '0 0 10px', fontSize: 14.6, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{f.message}</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                                                    {(f.userEmail || f.email) && (
                                                        <a href={`mailto:${f.userEmail || f.email}`} style={{ ...mono, fontSize: 12, color: 'var(--ac)' }}>{f.userEmail || f.email}</a>
                                                    )}
                                                    <button
                                                        onClick={() => patch({ kind: 'feedback', id: f.id, resolved: !f.resolved }, f.id)}
                                                        disabled={busy === f.id}
                                                        className="dp-btn-secondary"
                                                        style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12.5 }}
                                                    >
                                                        {f.resolved ? 'Rouvrir' : 'Marquer traité'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Testeurs ──────────────────────────────────────── */}
                        {tab === 'testeurs' && (
                            <div className="dp-card">
                                <h2 className="dp-section-title">Candidatures au programme de test ({data.signups.stats.total})</h2>
                                {data.signups.rows.length === 0 ? (
                                    <div className="dp-alert is-info">
                                        Aucune candidature. La page de recrutement est en ligne sur <Link href="/beta" style={{ color: 'var(--ac)', fontWeight: 600 }}>/beta</Link> —
                                        les guides <Link href="/dp" style={{ color: 'var(--ac)', fontWeight: 600 }}>/dp</Link> y renvoient.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        {data.signups.rows.map(s => (
                                            <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', background: s.status === 'ecarte' ? 'var(--surface-2)' : 'var(--surface)', opacity: s.status === 'ecarte' ? 0.7 : 1 }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                                                    <span style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{s.nom || '—'}</span>
                                                    {s.profil === 'pro' && <span className="dp-chip is-ok">Pro{s.metier ? ` · ${s.metier}` : ''}</span>}
                                                    {s.travaux && <span className="dp-chip"><span className="code">{s.travaux}</span></span>}
                                                    <span style={{ ...mono, marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)' }}>{fmt(s.createdAt)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: s.message ? 10 : 12, fontSize: 12.8, color: 'var(--ink-2)' }}>
                                                    <a href={`mailto:${s.email}`} style={{ ...mono, color: 'var(--ac)' }}>{s.email}</a>
                                                    {s.phone && <span style={mono}>{s.phone}</span>}
                                                    {(s.commune || s.codePostal) && <span>{[s.commune, s.codePostal].filter(Boolean).join(' · ')}</span>}
                                                    {s.source && <span style={{ color: 'var(--faint)' }}>via {s.source}</span>}
                                                </div>
                                                {s.message && (
                                                    <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>{s.message}</p>
                                                )}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {STATUTS.map(st => (
                                                        <button
                                                            key={st.id}
                                                            onClick={() => patch({ kind: 'signup', id: s.id, status: st.id }, s.id)}
                                                            disabled={busy === s.id}
                                                            className={`toggle-btn${s.status === st.id ? ' active' : ''}`}
                                                            style={{ padding: '6px 12px', fontSize: 12.5 }}
                                                        >
                                                            {st.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}
