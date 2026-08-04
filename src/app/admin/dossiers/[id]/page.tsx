'use client'

// ─────────────────────────────────────────────────────────────────────────────
// /admin/dossiers/:id — la fiche COMPLÈTE d'un projet, vue administrateur.
//
// La liste du back-office ne montre que le `summary` dénormalisé ; cette page charge
// le jsonb `data` entier via /api/admin/dossiers/:id et l'expose intégralement :
// compte propriétaire, cycle de vie et suivi d'instruction, demandeur (+ co-déclarant),
// terrain & cadastre, analyse PLU (zonage, patrimoine, risques, verdict, rapport IA),
// travaux (tous champs du sous-formulaire du type choisi), surfaces & taxation,
// rubriques CERFA, pièces DP1–DP8, et toutes les images/plans générés.
//
// Strictement en LECTURE — aucun bouton d'écriture : les actions de gestion restent
// dans l'onglet Utilisateurs (crédits, plans, rôle, suppression).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import type { DPFormData } from '@/lib/models'
import { getTravauxDef } from '@/lib/travauxRegistry'
import { piecesChecklist, isProtectedSector } from '@/lib/validation'
import { computeSuivi } from '@/lib/dossierTimeline'
import { formForNature, type CerfaForm } from '@/lib/cerfaForms'

interface AdminDossierDetail {
    dossier: {
        id: string; title: string; clientName: string | null; status: string; lastStep: number
        decision: 'accepted' | 'rejected' | null; decisionAt: string | null; numeroDp: string | null
        affichageAt: string | null; submittedAt: string | null; billedAt: string | null
        archivedAt: string | null; createdAt: string; updatedAt: string
        summary: any; data: DPFormData
    }
    owner: {
        id: string; email: string; fullName: string | null; phone: string | null; city: string | null
        role: string; credits: number; createdAt: string; dossierCount: number
    }
}

const mono: React.CSSProperties = { fontFamily: 'var(--mf)' }
const miniBtn: React.CSSProperties = { padding: '7px 12px', fontSize: 12.5 }
const fmtDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Petits blocs de présentation ─────────────────────────────────────────────
function Section({ title, icon, children, sub }: { title: string; icon: string; children: React.ReactNode; sub?: string }) {
    return (
        <div className="dp-card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 className="dp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{icon}</span> {title}
            </h3>
            {sub && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -6, marginBottom: 12 }}>{sub}</p>}
            {children}
        </div>
    )
}

type Field = { label: string; value: React.ReactNode }

/** Grille clé/valeur. Les champs vides sont masqués, sauf `showEmpty` (utile pour repérer un trou). */
function Fields({ items, showEmpty = false }: { items: Field[]; showEmpty?: boolean }) {
    const kept = items.filter(i => showEmpty || (i.value !== null && i.value !== undefined && i.value !== '' && i.value !== false))
    if (kept.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucune donnée renseignée.</div>
    return (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px 24px' }}>
            {kept.map((i, k) => (
                <div key={`${i.label}-${k}`}>
                    <dt className="dp-meta">{i.label}</dt>
                    <dd style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', marginTop: 3, overflowWrap: 'anywhere' }}>
                        {i.value === null || i.value === undefined || i.value === '' ? <span style={{ color: 'var(--faint)' }}>—</span> : i.value}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

/** Emprise du DP1 en vrais mètres au sol. Les dossiers antérieurs à la correction de projection
 *  ne stockent que `dp1_span_m`, exprimé en unités Web-Mercator : on le reconvertit pour ne pas
 *  afficher une emprise ~30 % trop généreuse. */
function dp1GroundLabel(pl: { dp1_ground_m?: number; dp1_span_m?: number }): string {
    if (pl.dp1_ground_m) return ` (${pl.dp1_ground_m} m au sol)`
    if (pl.dp1_span_m) return ` (~${Math.round(pl.dp1_span_m * Math.cos(46 * Math.PI / 180))} m au sol, capture ancienne)`
    return ''
}

/** Vignette d'image cliquable (ouvre l'original dans un onglet) ; supporte les data: et les Blob URLs. */
function Shot({ src, label, tall }: { src?: string | null; label: string; tall?: boolean }) {
    if (!src) return null
    return (
        <figure style={{ margin: 0, minWidth: 0 }}>
            <a href={src} target="_blank" rel="noopener noreferrer" title="Ouvrir l’original">
                <div style={{
                    height: tall ? 220 : 150, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)',
                    background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
            </a>
            <figcaption style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5, textAlign: 'center' }}>{label}</figcaption>
        </figure>
    )
}

const Grid = ({ children, min = 200 }: { children: React.ReactNode; min?: number }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>
)

// ── Libellés des champs travaux (sous-formulaire du type choisi) ─────────────
// Le rendu est générique : on parcourt l'objet travaux[type] et on affiche TOUTES ses
// clés renseignées, pour qu'un nouveau type de travaux n'ait rien à ajouter ici.
const TRAVAUX_FIELD_LABEL: Record<string, string> = {
    type: 'Type', materiau: 'Matériau', couleur: 'Couleur', couleur_ral: 'Teinte RAL',
    nombre: 'Nombre', largeur: 'Largeur', hauteur: 'Hauteur', profondeur: 'Profondeur',
    longueur: 'Longueur', remplacement: 'Remplacement (et non création)', description: 'Description',
    type_finition: 'Finition', epaisseur_isolant: 'Épaisseur d’isolant', materiau_isolant: 'Isolant',
    facades_concernees: 'Façades concernées', nombre_panneaux: 'Nombre de panneaux',
    surface_totale: 'Surface totale', puissance_kw: 'Puissance (kWc)', marque: 'Marque',
    orientation: 'Orientation', inclinaison: 'Inclinaison', integration: 'Mode d’intégration',
    type_cloture: 'Type de clôture', sur_voie: 'Implantée sur voie / espace public',
    finition: 'Finition', operation: 'Opération', materiau_couverture: 'Matériau de couverture',
    type_ouverture: 'Type d’ouverture', facade: 'Façade concernée',
    hauteur_margelle: 'Hauteur de margelle', recul_maison: 'Recul / maison', local_technique: 'Local technique',
    hauteur_egout: 'Hauteur à l’égout', hauteur_faitage: 'Hauteur au faîtage', type_toit: 'Type de toit',
    cote_adossement: 'Côté d’adossement', type_mouvement: 'Mouvement de terre',
    mur_soutenement: 'Mur de soutènement', hauteur_mur: 'Hauteur du mur',
}
const humanize = (k: string) => TRAVAUX_FIELD_LABEL[k] || k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
const renderVal = (v: unknown): React.ReactNode => {
    if (v === true) return 'Oui'
    if (v === false) return 'Non'
    if (Array.isArray(v)) return v.length ? v.join(', ') : ''
    if (v === null || v === undefined) return ''
    return String(v)
}

// ── Documents générés ────────────────────────────────────────────────────────
// Les PDF ne sont pas stockés : ils sont reconstruits à la demande depuis le `data`
// en base (route /api/admin/dossiers/:id/document), donc toujours à jour. On les
// récupère en blob plutôt que de pointer l'iframe directement sur l'URL, pour
// pouvoir afficher une vraie erreur si la génération échoue.
const DOCS = [
    // Le libellé du CERFA est calculé par dossier (cerfaForm ci-dessous) : le blurb
    // générique ne sert que de repli si la nature du bien est absente.
    { kind: 'cerfa', icon: '📋', title: 'Formulaire CERFA', blurb: 'Pré-rempli depuis le dossier.' },
    { kind: 'dp', icon: '📁', title: 'Dossier DP complet', blurb: 'DP1 à DP8 — plans, notice, photos et insertions.' },
    { kind: 'panneau', icon: '🪧', title: 'Panneau d’affichage', blurb: 'Panneau réglementaire à poser sur le terrain.' },
] as const
type DocKind = typeof DOCS[number]['kind']

function DocumentsSection({ dossierId, cerfaForm }: { dossierId: string; cerfaForm: CerfaForm }) {
    const [kind, setKind] = useState<DocKind | null>(null)
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    // Nombre de manques bloquants au moment de la génération (en-tête X-Dossier-Fatals) :
    // le parcours client refuserait de produire le document, l'admin le voit quand même.
    const [fatals, setFatals] = useState(0)
    // Les object URLs doivent être révoquées à la main, sinon le blob reste en mémoire.
    const urlRef = useRef<string | null>(null)

    const revoke = () => { if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null } }
    useEffect(() => revoke, [])

    const open = useCallback(async (k: DocKind) => {
        if (k === kind) { setKind(null); setUrl(null); setErr(null); revoke(); return }
        setKind(k); setErr(null); setLoading(true); setUrl(null); setFatals(0); revoke()
        try {
            const r = await fetch(`/api/admin/dossiers/${dossierId}/document?kind=${k}`)
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Génération impossible.')
            setFatals(Math.max(0, Number(r.headers.get('X-Dossier-Fatals') ?? 0)))
            const blob = await r.blob()
            const u = URL.createObjectURL(blob)
            urlRef.current = u
            setUrl(u)
        } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
    }, [dossierId, kind])

    return (
        <Section title="Documents générés" icon="📥"
            sub="Régénérés à la demande depuis les données en base — l’aperçu ne consomme ni quota ni crédit du client.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {DOCS.map(doc => {
                    const active = kind === doc.kind
                    return (
                        <div key={doc.kind} style={{
                            border: '1px solid', borderRadius: 12, padding: 14,
                            ...(active ? { borderColor: 'var(--acb)', background: 'var(--act)' } : { borderColor: 'var(--line)', background: 'var(--surface-2)' }),
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: 18 }}>{doc.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                                    {doc.kind === 'cerfa' ? `CERFA n°${cerfaForm.numero}` : doc.title}
                                </span>
                            </div>
                            <p style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
                                {doc.kind === 'cerfa' ? `${cerfaForm.bien} — ${cerfaForm.pourquoi}` : doc.blurb}
                            </p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={() => open(doc.kind)} disabled={loading && active}
                                    className={active ? 'dp-btn-primary' : 'dp-btn-secondary'} style={miniBtn} aria-expanded={active}>
                                    {loading && active ? 'Génération…' : active ? 'Masquer' : 'Aperçu'}
                                </button>
                                <a href={`/api/admin/dossiers/${dossierId}/document?kind=${doc.kind}&dl=1`}
                                    className="dp-btn-secondary" style={{ ...miniBtn, textDecoration: 'none' }}>Télécharger</a>
                            </div>
                        </div>
                    )
                })}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 34 }}>
                    <span className="dp-spinner" />
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
                        Composition du PDF (les plans et photos sont retéléchargés)…
                    </div>
                </div>
            )}
            {err && <div className="dp-alert is-error" style={{ marginTop: 14 }}>⚠️ {err}</div>}
            {url && !loading && fatals > 0 && (
                <div className="dp-alert is-warn" style={{ marginTop: 14 }}>
                    Dossier incomplet : {fatals} point{fatals > 1 ? 's' : ''} bloquant{fatals > 1 ? 's' : ''}. Le client ne
                    pourrait pas encore générer ce document — l’aperçu ci-dessous montre l’état actuel, champs manquants compris.
                </div>
            )}
            {url && !loading && (
                <div style={{ marginTop: 14 }}>
                    <iframe src={url} title={`Aperçu ${kind}`} style={{
                        width: '100%', height: 760, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)',
                    }} />
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                        Aperçu généré à l’instant. <a href={url} target="_blank" rel="noopener noreferrer" className="t-accent">Ouvrir dans un onglet ↗</a>
                    </div>
                </div>
            )}
        </Section>
    )
}

// ── Cycle de vie ─────────────────────────────────────────────────────────────
type Lifecycle = 'brouillon' | 'complet' | 'depose' | 'accepte' | 'refuse' | 'archive'
const LIFECYCLE_CHIP: Record<Lifecycle, { label: string; cls: string; style?: React.CSSProperties }> = {
    brouillon: { label: 'Brouillon', cls: 'dp-chip' },
    complet: { label: 'Complet', cls: 'dp-chip is-ok' },
    depose: { label: 'En instruction', cls: 'dp-chip', style: { background: '#F7EFDC', color: '#7A5C1E', borderColor: '#E5D5AC' } },
    accepte: { label: 'Accepté ✓', cls: 'dp-chip is-ok' },
    refuse: { label: 'Refusé', cls: 'dp-chip', style: { background: '#FDF4F1', color: '#8F2E22', borderColor: '#EBC3BB' } },
    archive: { label: 'Archivé', cls: 'dp-chip', style: { opacity: .75 } },
}

export default function AdminDossierPage() {
    const router = useRouter()
    const id = useParams<{ id: string }>().id as string
    const [d, setD] = useState<AdminDossierDetail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [rawOpen, setRawOpen] = useState(false)

    useEffect(() => {
        fetch(`/api/admin/dossiers/${id}`).then(async r => {
            if (r.status === 403) { router.push('/profil'); return }
            if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Chargement impossible.')
            setD(await r.json())
        }).catch(e => setError(e.message))
    }, [id, router])

    const backLink = (
        <Link href="/admin" className="dp-btn-secondary" style={{ ...miniBtn, textDecoration: 'none' }}>← Back-office</Link>
    )

    if (error) return (
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '44px 24px' }}>
            <div className="dp-alert is-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>
            {backLink}
        </div>
    )
    if (!d) return <div style={{ textAlign: 'center', padding: 80 }}><span className="dp-spinner" /></div>

    const { dossier: dd, owner } = d
    const data = (dd.data || {}) as DPFormData
    // Formulaire que ce dossier produit — même règle que le parcours client.
    const cerfaForm = formForNature(data.nature_bien)
    const dem = data.demandeur || ({} as DPFormData['demandeur'])
    const co = data.co_demandeur
    const ter = data.terrain || ({} as DPFormData['terrain'])
    const tr = data.travaux || ({} as DPFormData['travaux'])
    const ph = data.photos || ({} as DPFormData['photos'])
    const pl = data.plans || ({} as DPFormData['plans'])
    const plu = ter.plu
    const ov = plu?.overlays
    const ev = plu?.evaluationResult as { status?: string; decision?: string; violations?: string[]; warnings?: string[] } | undefined

    const lc: Lifecycle = dd.archivedAt ? 'archive'
        : dd.decision === 'accepted' ? 'accepte'
            : dd.decision === 'rejected' ? 'refuse'
                : dd.submittedAt ? 'depose'
                    : dd.status === 'complete' ? 'complet' : 'brouillon'
    const chip = LIFECYCLE_CHIP[lc]

    const def = getTravauxDef(tr.type)
    // Sous-formulaire du type choisi : on affiche tous ses champs renseignés (rendu générique).
    const sub = def ? (tr as unknown as Record<string, Record<string, unknown> | undefined>)[def.id] : undefined
    const subFields: Field[] = sub
        ? Object.entries(sub)
            .filter(([k, v]) => k !== 'description' && v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
            .map(([k, v]) => ({ label: humanize(k), value: renderVal(v) }))
        : []

    // Pièces + suivi d'instruction : mêmes fonctions pures que le parcours client, donc
    // l'admin voit exactement l'état que voit le déclarant.
    let pieces: ReturnType<typeof piecesChecklist> = []
    let protege = false
    try { pieces = piecesChecklist(data); protege = isProtectedSector(data) } catch { /* données legacy incomplètes */ }
    const suivi = computeSuivi({
        submittedAt: dd.submittedAt, decision: dd.decision, decisionAt: dd.decisionAt,
        affichageAt: dd.affichageAt, abf: dd.summary?.summary?.abf ?? (protege || undefined),
    })

    const facades = (ph.facades || []).filter(f => f.before || f.after || f.croquis)
    const addr = (voie?: string, cp?: string, ville?: string) => [voie, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 1080, margin: '0 auto', padding: '44px 24px 80px' }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 26, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <Link href="/admin" aria-label="Back-office"><Logo size={46} /></Link>
                    <div className="dp-page-head" style={{ marginBottom: 0, minWidth: 0 }}>
                        <span className="dp-eyebrow">Back-office · Fiche projet</span>
                        <h1 className="dp-page-title" style={{ overflowWrap: 'anywhere' }}>{dd.title}</h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{backLink}</div>
            </div>

            {/* Bandeau : statut, compte, dates clés */}
            <div className="dp-card dp-spec" style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{
                        width: 110, height: 110, flexShrink: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)',
                        background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {dd.summary?.summary?.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={dd.summary.summary.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
                            </svg>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span className={chip.cls} style={chip.style}>{chip.label}</span>
                            {lc === 'brouillon' && <span className="dp-chip" style={{ fontSize: 10.5 }}>étape {dd.lastStep}/7</span>}
                            {dd.clientName && <span className="dp-chip" style={{ fontSize: 11 }}>👤 {dd.clientName}</span>}
                            {dd.billedAt && <span className="dp-chip is-ok" style={{ fontSize: 10.5 }}>facturé</span>}
                            {protege && <span className="dp-chip" style={{ fontSize: 10.5, background: '#F7EFDC', color: '#7A5C1E', borderColor: '#E5D5AC' }}>secteur protégé · ABF</span>}
                            {def && <span className="dp-chip" style={{ fontSize: 11 }}>{def.icon} {def.title}</span>}
                        </div>
                        <Fields items={[
                            { label: 'Compte', value: <span style={mono}>{owner.email}</span> },
                            { label: 'Titulaire du compte', value: owner.fullName || '—' },
                            { label: 'Autres dossiers du compte', value: `${owner.dossierCount}` },
                            { label: 'Créé le', value: fmtDateTime(dd.createdAt) },
                            { label: 'Dernière modification', value: fmtDateTime(dd.updatedAt) },
                            { label: 'Déposé en mairie', value: fmtDate(dd.submittedAt) },
                            { label: 'N° d’enregistrement DP', value: dd.numeroDp },
                            { label: 'Décision', value: dd.decision ? `${dd.decision === 'accepted' ? 'Acceptée' : 'Refusée'} le ${fmtDate(dd.decisionAt)}` : '—' },
                            { label: 'Affichage sur le terrain', value: fmtDate(dd.affichageAt) },
                            { label: 'Facturé le', value: fmtDate(dd.billedAt) },
                            { label: 'Archivé le', value: fmtDate(dd.archivedAt) },
                        ]} showEmpty />
                        <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>id {dd.id}</div>
                    </div>
                </div>
            </div>

            {/* Suivi d'instruction (seulement une fois déposé) */}
            {suivi && (
                <Section title="Suivi d’instruction" icon="🏛️" sub={`Délai applicable : ${suivi.delaiMois} mois${suivi.outcome === 'tacite' ? ' · non-opposition tacite acquise' : ''}.`}>
                    <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {suivi.milestones.map(m => (
                            <li key={m.key} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                                <span style={{ flexShrink: 0, fontSize: 13 }}>
                                    {m.status === 'done' ? '✅' : m.status === 'alert' ? '⚠️' : m.status === 'current' ? '◍' : '○'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{m.label}</div>
                                    {m.detail && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{m.detail}</div>}
                                </div>
                                <span style={{ ...mono, fontSize: 11.5, color: 'var(--muted)', flexShrink: 0 }}>{fmtDate(m.date)}</span>
                            </li>
                        ))}
                    </ol>
                </Section>
            )}

            {/* Pièces DP1–DP8 */}
            {pieces.length > 0 && (
                <Section title="Pièces du dossier (DP1–DP8)" icon="📄">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                        {pieces.map(p => (
                            <div key={p.code} title={p.note || ''} style={{
                                borderRadius: 10, padding: 10, textAlign: 'center', fontSize: 12.5, fontWeight: 600, border: '1px solid',
                                ...(p.present
                                    ? { borderColor: 'var(--acb)', background: 'var(--act)', color: 'var(--acd)' }
                                    : p.severity === 'fatal'
                                        ? { borderColor: '#EBC3BB', background: '#FBEAE6', color: '#B4453A' }
                                        : { borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--muted)' }),
                            }}>
                                <div style={{ fontSize: 17 }}>{p.present ? '✅' : p.severity === 'fatal' ? '✗' : '⬜'}</div>
                                <div style={{ ...mono, fontSize: 10.5, opacity: .7 }}>{p.code}</div>
                                {p.label}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Documents générés (CERFA, dossier DP, panneau) */}
            <DocumentsSection dossierId={dd.id} cerfaForm={cerfaForm} />

            {/* Demandeur */}
            <Section title="Demandeur" icon="👤">
                <Fields items={dem.est_societe ? [
                    { label: 'Personne morale', value: dem.nom_societe },
                    { label: 'Forme juridique', value: dem.type_societe },
                    { label: 'SIRET', value: dem.siret && <span style={mono}>{dem.siret}</span> },
                    { label: 'Représentant', value: [dem.representant_prenom, dem.representant_nom].filter(Boolean).join(' ') },
                    { label: 'Adresse', value: addr(dem.adresse, dem.code_postal, dem.commune) },
                    { label: 'Téléphone', value: dem.telephone },
                    { label: 'Email', value: dem.email },
                ] : [
                    { label: 'Civilité', value: dem.civilite },
                    { label: 'Nom', value: dem.nom },
                    { label: 'Prénom', value: dem.prenom },
                    { label: 'Né(e) le', value: dem.date_naissance },
                    { label: 'Lieu de naissance', value: [dem.lieu_naissance, dem.departement_naissance, dem.pays_naissance].filter(Boolean).join(' · ') },
                    { label: 'Adresse', value: addr(dem.adresse, dem.code_postal, dem.commune) },
                    { label: 'Lieu-dit', value: dem.lieu_dit },
                    { label: 'Téléphone', value: dem.telephone },
                    { label: 'Email', value: dem.email },
                    { label: 'Coordonnées GPS', value: dem.coords && <span style={mono}>{dem.coords.lat.toFixed(5)}, {dem.coords.lon.toFixed(5)}</span> },
                ]} />
            </Section>

            {/* Co-déclarant */}
            {co?.actif && (
                <Section title="Co-déclarant (CERFA 2BIS)" icon="👥">
                    <Fields items={co.est_societe ? [
                        { label: 'Personne morale', value: co.nom_societe },
                        { label: 'Forme juridique', value: co.type_societe },
                        { label: 'SIRET', value: co.siret },
                        { label: 'Représentant', value: [co.representant_prenom, co.representant_nom].filter(Boolean).join(' ') },
                    ] : [
                        { label: 'Civilité', value: co.civilite },
                        { label: 'Nom', value: co.nom },
                        { label: 'Prénom', value: co.prenom },
                    ]} />
                </Section>
            )}

            {/* Terrain */}
            <Section title="Terrain & cadastre" icon="📍">
                <Fields items={[
                    { label: 'Adresse des travaux', value: ter.meme_adresse ? `${addr(dem.adresse, dem.code_postal, dem.commune)} (identique au demandeur)` : addr(ter.adresse, ter.code_postal, ter.commune) },
                    { label: 'Lieu-dit', value: ter.lieu_dit },
                    { label: 'Préfixe cadastral', value: ter.prefixe_cadastral },
                    { label: 'Section', value: ter.section_cadastrale },
                    { label: 'Parcelle n°', value: ter.numero_parcelle },
                    { label: 'Surface du terrain', value: ter.surface_terrain && `${ter.surface_terrain} m²` },
                    { label: 'Surface de plancher existante', value: ter.surface_plancher && `${ter.surface_plancher} m²` },
                    { label: 'Coordonnées GPS', value: ter.coords && <span style={mono}>{ter.coords.lat.toFixed(5)}, {ter.coords.lon.toFixed(5)}</span> },
                    { label: 'Terrain en lotissement', value: data.terrain_lotissement ? 'Oui' : 'Non' },
                ]} />
                {ter.description_projet && (
                    <div style={{ marginTop: 14 }}>
                        <div className="dp-meta">Description du projet (terrain)</div>
                        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.65 }}>{ter.description_projet}</p>
                    </div>
                )}
                {(data.cadastrales_multiparcelles?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 14 }}>
                        <div className="dp-meta">Parcelles supplémentaires</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {data.cadastrales_multiparcelles.map((p, i) => (
                                <span key={i} className="dp-chip" style={{ ...mono, fontSize: 11.5 }}>{[p.prefixe, p.section, p.numero].filter(Boolean).join(' ')}</span>
                            ))}
                        </div>
                    </div>
                )}
            </Section>

            {/* Travaux */}
            <Section title="Travaux déclarés" icon="🔨">
                <Fields items={[
                    { label: 'Nature', value: def ? `${def.icon} ${def.natureLabel}` : 'Non défini' },
                    { label: 'Nature CERFA §4.1', value: data.nature_travaux },
                    { label: 'Le projet concerne', value: data.projet_concerne === 'principale' ? 'Résidence principale' : data.projet_concerne === 'secondaire' ? 'Résidence secondaire' : '' },
                    { label: 'Plan de coupe (DP3) requis', value: def ? (def.requiresDP3 ? 'Oui' : 'Non') : '' },
                    ...subFields,
                ]} />
                {(tr.description_projet || (sub?.description as string)) && (
                    <div style={{ marginTop: 14 }}>
                        <div className="dp-meta">Description des travaux</div>
                        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.65 }}>{tr.description_projet || (sub?.description as string)}</p>
                    </div>
                )}
            </Section>

            {/* Surfaces & taxation */}
            <Section title="Surfaces & taxation" icon="📐">
                <Fields items={[
                    { label: 'Surface existante', value: (data.surface_existante || tr.surfaces?.existante) && `${data.surface_existante || tr.surfaces?.existante} m²` },
                    { label: 'Surface créée', value: (data.surface_creee || tr.surfaces?.creee) && `${data.surface_creee || tr.surfaces?.creee} m²` },
                    { label: 'Surface supprimée', value: (data.surface_supprimee || tr.surfaces?.supprimee) && `${data.surface_supprimee || tr.surfaces?.supprimee} m²` },
                    { label: 'Logements créés', value: data.taxation?.logements_crees },
                    { label: 'Stationnement couvert', value: data.taxation?.stationnement_couvert },
                    { label: 'Stationnement non couvert', value: data.taxation?.stationnement_non_couvert },
                    { label: 'Surface de bassin (piscine)', value: data.taxation?.surface_bassin_piscine && `${data.taxation.surface_bassin_piscine} m²` },
                    { label: 'Habitation — existante', value: data.taxation?.destination_habitation_existante },
                    { label: 'Habitation — créée', value: data.taxation?.destination_habitation_creee },
                    { label: 'Habitation — supprimée', value: data.taxation?.destination_habitation_supprimee },
                    { label: 'Financement PTZ', value: data.taxation?.financement_ptz ? 'Oui' : '' },
                    { label: 'Prêt social', value: data.taxation?.financement_pret_social ? 'Oui' : '' },
                    { label: 'Architecte', value: data.architecte_nom },
                    { label: 'N° d’inscription à l’Ordre', value: data.architecte_inscription },
                ]} />
            </Section>

            {/* Analyse PLU */}
            <Section title="Analyse d’urbanisme (PLU)" icon="🗺️"
                sub={plu ? `Source : ${plu.source || 'inconnue'}${plu.verified ? ' · vérifiée' : ''}${plu.fetchedAt ? ` · récupérée le ${fmtDate(plu.fetchedAt)}` : ''}` : undefined}>
                {!plu ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucune analyse PLU enregistrée pour ce dossier.</div> : (
                    <>
                        <Fields items={[
                            { label: 'Zone', value: plu.zone?.libelle },
                            { label: 'Type de zone', value: plu.zone?.typezone },
                            { label: 'Nom de la zone', value: plu.zone?.nomzone },
                            { label: 'Commune au RNU', value: plu.isRnu ? 'Oui' : 'Non' },
                            { label: 'Règlement (PDF)', value: plu.pdfType },
                            { label: 'Texte extrait', value: plu.textLength ? `${plu.textLength.toLocaleString('fr-FR')} caractères` : '' },
                            { label: 'Document', value: plu.zone?.url_doc && <a href={plu.zone.url_doc} target="_blank" rel="noopener noreferrer" className="t-accent">Ouvrir le règlement ↗</a> },
                        ]} />

                        {plu.zone?.libelong && (
                            <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.65 }}>{plu.zone.libelong}</p>
                        )}

                        {/* Verdict de conformité */}
                        {ev && (
                            <div className="dp-alert" style={{
                                marginTop: 14,
                                ...(String(ev.status).toUpperCase().includes('NON')
                                    ? { background: '#FBEAE6', borderColor: '#EBC3BB', color: '#8F2E22' }
                                    : { background: 'var(--act)', borderColor: 'var(--acb)', color: 'var(--acd)' }),
                            }}>
                                <span className="dp-alert-title">Verdict : {ev.status || '—'}{ev.decision ? ` · ${ev.decision}` : ''}</span>
                                {(ev.violations?.length ?? 0) > 0 && (
                                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                                        {ev.violations!.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                )}
                                {(ev.warnings?.length ?? 0) > 0 && (
                                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, opacity: .9 }}>
                                        {ev.warnings!.map((w, i) => <li key={i}>⚠️ {w}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Patrimoine & risques */}
                        {ov && (
                            <div style={{ marginTop: 14 }}>
                                <div className="dp-meta" style={{ marginBottom: 6 }}>Patrimoine & risques</div>
                                <Fields items={[
                                    { label: 'Site patrimonial (SPR)', value: ov.hasSPR ? (ov.sprName || 'Oui') : 'Non' },
                                    { label: 'Monuments historiques < 500 m', value: `${ov.monumentsWithin500m?.length ?? 0}` },
                                    { label: 'Zone de sismicité', value: ov.seismicClass || ov.seismicZone },
                                    { label: 'Risque d’inondation', value: ov.hasFloodRisk ? `Oui (${ov.floodRisks?.length ?? 0} événement(s))` : 'Non' },
                                    { label: 'PPRN', value: ov.hasPPRN ? (ov.pprnList || []).map(p => p.libPpr).join(', ') || 'Oui' : 'Non' },
                                    { label: 'PPRT', value: ov.hasPPRT ? (ov.pprtList || []).map(p => p.libPpr).join(', ') || 'Oui' : 'Non' },
                                ]} showEmpty />
                                {(ov.monumentsWithin500m?.length ?? 0) > 0 && (
                                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {ov.monumentsWithin500m!.slice(0, 12).map(m => (
                                            <span key={m.reference} className="dp-chip" style={{ fontSize: 11 }} title={`${m.protection} · réf. ${m.reference}`}>
                                                {m.title} · {m.distance} m
                                            </span>
                                        ))}
                                        {ov.monumentsWithin500m!.length > 12 && (
                                            <span className="dp-chip" style={{ fontSize: 11, opacity: .7 }}>+{ov.monumentsWithin500m!.length - 12} autres</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Prescriptions du zonage */}
                        {(plu.prescriptions?.length ?? 0) > 0 && (
                            <div style={{ marginTop: 14 }}>
                                <div className="dp-meta" style={{ marginBottom: 6 }}>Prescriptions ({plu.prescriptions!.length})</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {plu.prescriptions!.map((p, i) => (
                                        <span key={i} className="dp-chip" style={{ fontSize: 11 }} title={p.typepresc}>{p.libelle}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rapport IA */}
                        {plu.analysisReport && (
                            <details style={{ marginTop: 14 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Rapport d’analyse complet</summary>
                                <pre style={{
                                    whiteSpace: 'pre-wrap', fontSize: 12.2, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 10,
                                    background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'inherit',
                                }}>{plu.analysisReport}</pre>
                            </details>
                        )}

                        {/* Règles extraites du règlement (données brutes de l'extracteur) */}
                        {plu.extractedRules && (
                            <details style={{ marginTop: 10 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Règles extraites du règlement (JSON)</summary>
                                <pre style={{
                                    whiteSpace: 'pre-wrap', ...mono, fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 10,
                                    background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, maxHeight: 380, overflow: 'auto',
                                }}>{JSON.stringify(plu.extractedRules, null, 2)}</pre>
                            </details>
                        )}

                        {plu.extractedText && (
                            <details style={{ marginTop: 10 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Extrait du règlement (texte source)</summary>
                                <pre style={{
                                    whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 10,
                                    background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14,
                                    maxHeight: 380, overflow: 'auto', fontFamily: 'inherit',
                                }}>{plu.extractedText}</pre>
                            </details>
                        )}
                    </>
                )}
            </Section>

            {/* Plans générés */}
            <Section title="Plans" icon="🗺️" sub="Cliquez une vignette pour ouvrir le fichier d’origine (Blob).">
                {!pl.dp1_carte_situation && !pl.dp2_plan_masse && !pl.dp3_coupe
                    ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucun plan enregistré.</div>
                    : (
                        <Grid min={230}>
                            <Shot src={pl.dp1_carte_situation} label={`DP1 · Plan de situation${dp1GroundLabel(pl)}`} tall />
                            <Shot src={pl.dp2_plan_masse} label={`DP2 · Plan de masse${pl.dp2_span_m ? ` (${pl.dp2_span_m} m)` : ''}`} tall />
                            <Shot src={pl.dp3_coupe} label="DP3 · Plan de coupe" tall />
                        </Grid>
                    )}
            </Section>

            {/* Notice descriptive */}
            {pl.dp4_notice && (
                <Section title="DP11 · Notice descriptive et des matériaux" icon="📝">
                    <pre style={{
                        whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.75, color: 'var(--ink-2)', margin: 0,
                        background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 16, fontFamily: 'inherit',
                    }}>{pl.dp4_notice}</pre>
                </Section>
            )}

            {/* Photos & simulations */}
            <Section title="Photos & simulations" icon="📷">
                {facades.length === 0 && !ph.dp7_vue_proche && !ph.dp8_vue_lointaine
                    ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Aucune photo enregistrée.</div>
                    : (
                        <>
                            {facades.map(f => (
                                <div key={f.id} style={{ marginBottom: 16 }}>
                                    <div className="dp-meta" style={{ marginBottom: 8 }}>{f.label} · {f.type}</div>
                                    <Grid min={190}>
                                        <Shot src={f.before} label="État existant" />
                                        <Shot src={f.after} label="Simulation après travaux (IA)" />
                                        <Shot src={f.croquis} label="Croquis d’insertion (IA)" />
                                    </Grid>
                                </div>
                            ))}
                            {(ph.dp7_vue_proche || ph.dp8_vue_lointaine) && (
                                <div>
                                    <div className="dp-meta" style={{ marginBottom: 8 }}>Environnement</div>
                                    <Grid min={190}>
                                        <Shot src={ph.dp7_vue_proche} label="DP7 · Vue proche" />
                                        <Shot src={ph.dp8_vue_lointaine} label="DP8 · Vue lointaine" />
                                    </Grid>
                                </div>
                            )}
                        </>
                    )}
            </Section>

            {/* Rubriques CERFA restantes */}
            <Section title="Rubriques CERFA" icon="📋">
                <Fields items={[
                    { label: 'Site patrimonial remarquable', value: data.zones_specifiques?.site_patrimonial ? 'Oui' : 'Non' },
                    { label: 'Abords d’un monument historique', value: data.zones_specifiques?.abords_monument ? 'Oui' : 'Non' },
                    { label: 'Site classé / en instance', value: data.zones_specifiques?.site_classe ? 'Oui' : 'Non' },
                    { label: 'Accord de dématérialisation', value: data.accord_dematerialisation ? 'Oui' : 'Non' },
                    { label: 'Engagement — lieu', value: data.engagement?.lieu || data.lieu_signature },
                    { label: 'Engagement — date', value: data.engagement?.date || data.date_signature },
                    { label: 'Engagement — signé', value: data.engagement?.signature ? 'Oui ✓' : 'Non' },
                ]} showEmpty />
                {(() => {
                    const sn = data.sous_nature_nouvelle, se = data.sous_nature_existante
                    const chips = [
                        sn?.piscine && 'Piscine', sn?.garage && 'Garage', sn?.veranda && 'Véranda', sn?.abri_jardin && 'Abri de jardin',
                        sn?.autre && (sn.autre_desc || 'Autre (nouvelle construction)'),
                        se?.extension && 'Extension', se?.surelevation && 'Surélévation', se?.creation_niveaux && 'Création de niveaux',
                        se?.autre && (se.autre_desc || 'Autre (existant)'),
                    ].filter(Boolean) as string[]
                    return chips.length ? (
                        <div style={{ marginTop: 12 }}>
                            <div className="dp-meta" style={{ marginBottom: 6 }}>Sous-nature des travaux</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {chips.map(c => <span key={c} className="dp-chip" style={{ fontSize: 11 }}>{c}</span>)}
                            </div>
                        </div>
                    ) : null
                })()}
            </Section>

            {/* Données brutes — le dernier recours quand un champ n'est pas encore rendu ci-dessus */}
            <Section title="Données brutes du dossier" icon="🧾" sub="Le jsonb `data` intégral, tel qu'enregistré en base.">
                <button onClick={() => setRawOpen(o => !o)} className="dp-btn-secondary" style={miniBtn} aria-expanded={rawOpen}>
                    {rawOpen ? 'Masquer le JSON' : 'Afficher le JSON complet'}
                </button>
                {rawOpen && (
                    <pre style={{
                        whiteSpace: 'pre-wrap', ...mono, fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 12,
                        background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 14,
                        maxHeight: 560, overflow: 'auto', overflowWrap: 'anywhere',
                    }}>{JSON.stringify(dd.data, null, 2)}</pre>
                )}
            </Section>
        </div>
    )
}
