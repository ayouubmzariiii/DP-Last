// Blocs de contenu réutilisés par les pages SEO /dp/** : tableau de seuils, liste
// des pièces, erreurs fréquentes, FAQ (+ JSON-LD), rappels de procédure, CTA.
// Tous sont des composants serveur sans état — rien n'est envoyé au client.
import Link from 'next/link'
import { PIECES, FORMALITE_LABEL, PROCEDURE, DISCLAIMER, SOURCES, VERIFIE_LE } from '@/lib/seo/travaux'
import type { Seuil, Faq, Erreur, PieceCode } from '@/lib/seo/travaux'

const FORMALITE_STYLE: Record<Seuil['formalite'], { bg: string; border: string; color: string }> = {
    aucune: { bg: 'var(--act)', border: 'var(--acb)', color: 'var(--acd)' },
    dp: { bg: '#FBF1DC', border: '#EBD9A8', color: '#7A5E16' },
    pc: { bg: '#FBEAE6', border: '#EBC3BB', color: '#8F2E22' },
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
    return (
        <h2 id={id} style={{ fontFamily: 'var(--hf)', fontWeight: 500, fontSize: 'clamp(22px,3vw,29px)', lineHeight: 1.15, letterSpacing: '-.01em', color: 'var(--ink)', margin: '0 0 6px' }}>
            {children}
        </h2>
    )
}

export function Prose({ paragraphs }: { paragraphs: string[] }) {
    return (
        <>
            {paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 16px', maxWidth: '72ch' }}>{p}</p>
            ))}
        </>
    )
}

// Conteneur unique du site : 1160 px, 28 px de gouttière — identique à l'en-tête,
// au pied de page et au fil d'Ariane. C'est ce qui aligne le titre, le fil
// d'Ariane et le logo sur la même verticale.
export function Section({
    children,
    tone = 'paper',
    first = false,
}: {
    children: React.ReactNode
    tone?: 'paper' | 'surface'
    /** Première section de la page : réduit l'espace au-dessus, le fil d'Ariane
     *  ayant déjà posé sa propre marge. */
    first?: boolean
}) {
    return (
        <section style={{
            background: tone === 'surface' ? 'var(--surface)' : 'transparent',
            borderTop: tone === 'surface' ? '1px solid var(--line)' : undefined,
            borderBottom: tone === 'surface' ? '1px solid var(--line)' : undefined,
        }}>
            <div style={{ maxWidth: 1160, margin: '0 auto', padding: first ? '20px 28px 48px' : '48px 28px' }}>{children}</div>
        </section>
    )
}

/** Tableau « faut-il une autorisation ? » — le bloc que les visiteurs cherchent. */
export function SeuilsTable({ seuils }: { seuils: Seuil[] }) {
    return (
        <div style={{ display: 'grid', gap: 10 }}>
            {seuils.map((s, i) => {
                const st = FORMALITE_STYLE[s.formalite]
                return (
                    <div key={i} className="dp-card" style={{ padding: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', overflow: 'hidden' }}>
                        <div style={{ background: st.bg, borderRight: `1px solid ${st.border}`, padding: '16px 18px', minWidth: 196, display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: st.color, lineHeight: 1.35 }}>
                                {FORMALITE_LABEL[s.formalite]}
                            </span>
                        </div>
                        <p style={{ flex: 1, minWidth: 240, margin: 0, padding: '16px 20px', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)' }}>{s.condition}</p>
                    </div>
                )
            })}
        </div>
    )
}

/** Les pièces DP1–DP8 requises, avec ce que l'instructeur y cherche. */
export function PiecesList({ codes, note }: { codes: PieceCode[]; note?: string }) {
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(288px,1fr))', gap: 12 }}>
                {codes.map(code => (
                    <div key={code} className="dp-card dp-spec" style={{ padding: '20px 20px 18px' }}>
                        <span className="dp-chip is-ok" style={{ marginBottom: 10 }}><span className="code">{code}</span></span>
                        <p style={{ margin: '0 0 6px', fontFamily: 'var(--hf)', fontSize: 16.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{PIECES[code].titre}</p>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>{PIECES[code].desc}</p>
                    </div>
                ))}
            </div>
            {note && (
                <div className="dp-alert is-info" style={{ marginTop: 14 }}>
                    <span className="dp-alert-title">À noter</span>
                    {note}
                </div>
            )}
        </>
    )
}

/** Les motifs réels de pièces complémentaires. Le contenu le plus différenciant. */
export function ErreursList({ erreurs }: { erreurs: Erreur[] }) {
    return (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, counterReset: 'err' }}>
            {erreurs.map((e, i) => (
                <li key={i} className="dp-card" style={{ padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mf)', fontSize: 13, fontWeight: 600, color: 'var(--ac)', background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                        <p style={{ margin: '0 0 5px', fontFamily: 'var(--hf)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.32 }}>{e.titre}</p>
                        <p style={{ margin: 0, fontSize: 14.8, lineHeight: 1.65, color: 'var(--ink-2)' }}>{e.texte}</p>
                    </div>
                </li>
            ))}
        </ol>
    )
}

export function PluPoints({ points, titre }: { points: string[]; titre: string }) {
    return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 1, background: 'var(--line-2)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <li style={{ background: 'var(--surface-2)', padding: '14px 20px' }}>
                <span className="dp-meta">{titre}</span>
            </li>
            {points.map((p, i) => (
                <li key={i} style={{ background: 'var(--surface)', padding: '15px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span aria-hidden style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--ac)', marginTop: 8, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)' }}>{p}</span>
                </li>
            ))}
        </ul>
    )
}

/** FAQ visible + FAQPage JSON-LD (éligible aux résultats enrichis Google). */
export function FaqList({ faq }: { faq: Faq[] }) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
    }
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div style={{ display: 'grid', gap: 10 }}>
                {faq.map((f, i) => (
                    <details key={i} className="dp-card" style={{ padding: '18px 22px' }}>
                        <summary style={{ cursor: 'pointer', fontFamily: 'var(--hf)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, listStyle: 'none' }}>
                            {f.q}
                        </summary>
                        <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.68, color: 'var(--ink-2)' }}>{f.a}</p>
                    </details>
                ))}
            </div>
        </>
    )
}

/** Rappels de procédure communs (délais, dépôt, affichage, coût). */
export function ProcedureBlock() {
    const rows: [string, string][] = [
        ['Formulaire', PROCEDURE.cerfa],
        ['Délai d’instruction', `${PROCEDURE.delai} ${PROCEDURE.delaiMajore}`],
        ['Dossier incomplet', PROCEDURE.incomplet],
        ['Absence de réponse', PROCEDURE.tacite],
        ['Dépôt', PROCEDURE.depot],
        ['Après la décision', `${PROCEDURE.affichage} ${PROCEDURE.validite} ${PROCEDURE.daact}`],
        ['Coût', PROCEDURE.cout],
    ]
    return (
        <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--line-2)', display: 'grid', gap: 1 }}>
            {rows.map(([k, v]) => (
                <div key={k} style={{ background: 'var(--surface)', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="dp-meta" style={{ minWidth: 176, paddingTop: 2 }}>{k}</span>
                    <p style={{ margin: 0, flex: 1, minWidth: 260, fontSize: 15, lineHeight: 1.62, color: 'var(--ink-2)' }}>{v}</p>
                </div>
            ))}
        </div>
    )
}

/** La réponse à la question posée, avant toute explication. Bloc le plus visible
 *  de la page : c'est ce que le visiteur est venu chercher. */
export function QuickAnswer({ reponse, seuilCle }: { reponse: string; seuilCle: string }) {
    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 22,
            background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 18,
            padding: '22px 26px',
        }}>
            <div style={{ flexShrink: 0, textAlign: 'center', paddingRight: 22, borderRight: '1px solid var(--acb)', minWidth: 128 }}>
                <span style={{ display: 'block', fontFamily: 'var(--mf)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ac)' }}>Seuil clé</span>
                <span style={{ display: 'block', marginTop: 5, fontFamily: 'var(--mf)', fontSize: 19, fontWeight: 600, color: 'var(--acd)', lineHeight: 1.15 }}>{seuilCle}</span>
            </div>
            <p style={{ flex: 1, minWidth: 260, margin: 0, fontFamily: 'var(--hf)', fontSize: 18.5, lineHeight: 1.5, color: 'var(--acd)', fontWeight: 500 }}>
                {reponse}
            </p>
        </div>
    )
}

/** Les quatre repères identiques à toute déclaration préalable. Ils évitent de
 *  faire lire trois paragraphes pour apprendre que la démarche est gratuite. */
export function Reperes() {
    const tiles: [string, string, string][] = [
        ['1 mois', 'Délai d’instruction', '2 mois en secteur protégé'],
        ['0 €', 'Coût du dépôt', 'taxe d’aménagement à part'],
        ['13703', 'Formulaire Cerfa', 'maison individuelle'],
        ['3 ans', 'Validité', 'prorogeable 2 × 1 an'],
    ]
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(146px,1fr))', gap: 10 }}>
            {tiles.map(([val, key, sub], i) => (
                <div key={key} className={`dp-metric${i === 0 ? ' is-accent' : ''}`}>
                    <span className="val">{val}</span>
                    <span className="key">{key}</span>
                    <span style={{ display: 'block', marginTop: 4, fontFamily: 'var(--mf)', fontSize: 10, color: 'var(--faint)', lineHeight: 1.4 }}>{sub}</span>
                </div>
            ))}
        </div>
    )
}

/** Sommaire ancré — rend une page longue parcourable en un coup d'œil. */
export function Sommaire({ items }: { items: { id: string; label: string }[] }) {
    return (
        <nav aria-label="Sommaire" style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 18px',
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
        }}>
            <span className="dp-meta" style={{ alignSelf: 'center', marginRight: 4 }}>Sur cette page</span>
            {items.map(it => (
                <a
                    key={it.id}
                    href={`#${it.id}`}
                    style={{
                        fontSize: 13.2, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none',
                        padding: '5px 11px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                    }}
                >
                    {it.label}
                </a>
            ))}
        </nav>
    )
}

/** Mention légale + sources. Afficher les articles n'est pas cosmétique : cela
 *  rend les seuils vérifiables par le lecteur, et re-vérifiables par nous à la
 *  prochaine évolution réglementaire. */
export function Disclaimer({ sources = true }: { sources?: boolean }) {
    return (
        <div style={{ marginTop: 28, maxWidth: '78ch' }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--muted)' }}>{DISCLAIMER}</p>
            {sources && (
                <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontFamily: 'var(--mf)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                        Sources — Code de l’urbanisme · seuils vérifiés en {VERIFIE_LE}
                    </summary>
                    <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                        {SOURCES.map(s => (
                            <li key={s.ref} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--muted)' }}>
                                <span style={{ fontFamily: 'var(--mf)', color: 'var(--ink-2)' }}>Art. {s.ref}</span> — {s.objet}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    )
}

/** Appel à l'action — mène à l'application, la seule destination utile ici. */
export function Cta({ titre, texte }: { titre: string; texte: string }) {
    return (
        <div style={{ background: 'var(--acd)', borderRadius: 20, padding: '34px 32px', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ maxWidth: '54ch' }}>
                <p style={{ margin: '0 0 8px', fontFamily: 'var(--hf)', fontSize: 'clamp(21px,2.6vw,26px)', fontWeight: 500, lineHeight: 1.2 }}>{titre}</p>
                <p style={{ margin: 0, fontSize: 15.2, lineHeight: 1.65, color: 'rgba(255,255,255,.82)' }}>{texte}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link
                    href="/register"
                    style={{ background: '#fff', color: 'var(--acd)', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                    Constituer mon dossier
                </Link>
                <Link
                    href="/#how"
                    style={{ border: '1px solid rgba(255,255,255,.42)', color: '#fff', fontWeight: 600, fontSize: 15, padding: '14px 24px', borderRadius: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                    Comment ça marche
                </Link>
            </div>
        </div>
    )
}

/** BreadcrumbList JSON-LD — améliore l'affichage du chemin dans les SERP. */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: it.url,
        })),
    }
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}
