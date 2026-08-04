import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/seo/PublicShell'
import TravauxIllustration from '@/components/seo/TravauxIllustration'
import {
    H2, Section, SeuilsTable, PiecesList, PluPoints, FaqList,
    ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd, ErreursList, QuickAnswer, Reperes,
} from '@/components/seo/blocks'
import { SEO_TRAVAUX, findTravaux, VERDICTS } from '@/lib/seo/travaux'
import {
    COMMUNES, findCommune, communeParam, communesVoisines, densite,
    geoportailUrl, probableZoneU, deCommune, aCommune, aCommuneCap, aCommuneParts,
    type Commune,
} from '@/lib/seo/communes'
import { canonical, ANNEE, SITE_NAME } from '@/lib/seo/site'

// Les communes les plus peuplées sont pré-rendues au build ; les autres sont
// générées à la première visite puis mises en cache (revalidation quotidienne).
// Cela garde le build court tout en couvrant l'intégralité du sitemap.
const PRERENDER = 40
export const revalidate = 86400

export function generateStaticParams() {
    const villes = COMMUNES.slice(0, PRERENDER)
    return SEO_TRAVAUX.flatMap(t => villes.map(c => ({ travaux: t.slug, commune: communeParam(c) })))
}

export function generateMetadata({ params }: { params: { travaux: string; commune: string } }): Metadata {
    const t = findTravaux(params.travaux)
    const c = findCommune(params.commune)
    if (!t || !c) return {}
    const title = `Déclaration préalable ${t.nom.toLowerCase()} ${aCommune(c.nom)} (${c.dept}) — règles ${ANNEE}`
    const description = `${t.nom} ${aCommune(c.nom)} : faut-il une déclaration préalable, que dit le PLU ${deCommune(c.nom)}, quelles pièces joindre et où déposer le dossier. Accès direct au document d’urbanisme opposable.`
    return {
        title,
        description,
        alternates: { canonical: canonical(`/dp/${t.slug}/${communeParam(c)}`) },
        openGraph: { title, description, url: canonical(`/dp/${t.slug}/${communeParam(c)}`), siteName: SITE_NAME, locale: 'fr_FR', type: 'article' },
    }
}

/** Qualifie honnêtement le tissu urbain — sert à expliquer le seuil d'extension. */
function tissu(c: Commune): string {
    const d = densite(c)
    if (d === null) return 'urbain'
    if (d >= 4000) return 'très dense'
    if (d >= 1500) return 'dense'
    if (d >= 500) return 'urbain'
    return 'peu dense'
}

export default function CommuneGuide({ params }: { params: { travaux: string; commune: string } }) {
    const t = findTravaux(params.travaux)
    const c = findCommune(params.commune)
    if (!t || !c) notFound()

    const voisines = communesVoisines(c)
    const d = densite(c)
    const zoneU = probableZoneU(c)
    const nf = (n: number) => n.toLocaleString('fr-FR')

    const faits: [string, string][] = [
        ['Code INSEE', c.insee],
        ['Code postal', c.cps > 1 ? `${c.cp} et ${c.cps - 1} autre${c.cps > 2 ? 's' : ''}` : c.cp || '—'],
        ['Département', `${c.deptNom} (${c.dept})`],
        ['Région', c.region],
        ['Population', `${nf(c.population)} habitants`],
        ['Superficie', c.surfaceKm2 ? `${nf(c.surfaceKm2)} km²` : '—'],
        ['Densité', d !== null ? `${nf(d)} hab/km² — tissu ${tissu(c)}` : '—'],
    ]

    // FAQ locale : deux questions propres à la commune, puis les trois questions
    // de fond du guide. Le contenu reste distinct de la page nationale.
    const faqLocale = [
        {
            q: `Où déposer une déclaration préalable ${aCommune(c.nom)} ?`,
            a: `Le dossier se dépose auprès du service urbanisme de la mairie ${deCommune(c.nom)}, en autant d’exemplaires que l’exige le service, ou par voie dématérialisée. ${c.nom} comptant ${nf(c.population)} habitants, la commune est tenue de proposer une saisine par voie électronique via un guichet numérique des autorisations d’urbanisme (GNAU). Le dépôt donne lieu à un récépissé mentionnant le numéro d’enregistrement et la date à partir de laquelle le délai d’instruction court.`,
        },
        {
            q: `Comment consulter le PLU ${deCommune(c.nom)} ?`,
            a: `Le document d’urbanisme opposable ${deCommune(c.nom)} est publié sur le Géoportail de l’Urbanisme, qui permet de localiser votre parcelle et de lire le zonage ainsi que le règlement applicable. Le service urbanisme de la mairie délivre également le règlement de la zone et vous indique si votre parcelle est concernée par une servitude, un périmètre de monument historique ou un site patrimonial remarquable.`,
        },
        {
            q: `Le délai d’instruction est-il plus long ${aCommune(c.nom)} ?`,
            a: `Le délai de droit commun est de un mois, identique partout. Il passe à deux mois si votre parcelle se situe aux abords d’un monument historique, en site patrimonial remarquable ou en site classé — situation fréquente dans les centres anciens. Le service urbanisme ${deCommune(c.nom)} vous confirme, adresse en main, si l’Architecte des Bâtiments de France doit être consulté.`,
        },
        ...t.faq.slice(0, 3),
    ]

    return (
        <PublicShell breadcrumb={[
            { label: 'Accueil', href: '/' },
            { label: 'Guides', href: '/dp' },
            { label: t.nom, href: `/dp/${t.slug}` },
            { label: c.nom },
        ]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
                { name: t.nom, url: canonical(`/dp/${t.slug}`) },
                { name: c.nom, url: canonical(`/dp/${t.slug}/${communeParam(c)}`) },
            ]} />

            <Section first>
                <div className="dp-page-head">
                    <span className="dp-eyebrow">{c.deptNom} · {c.region}</span>
                    <h1 className="dp-page-title">
                        Déclaration préalable {t.nom.toLowerCase()} {aCommuneParts(c.nom).prep} <em>{aCommuneParts(c.nom).label}</em>
                    </h1>
                    <p className="dp-page-sub">
                        {c.nom} ({c.cp}), {nf(c.population)} habitants, département {c.deptNom} ({c.dept}). Les seuils qui déclenchent
                        la déclaration préalable sont nationaux ; les hauteurs, reculs, teintes et matériaux applicables à votre parcelle
                        sont fixés par le document d&apos;urbanisme de la commune.
                    </p>
                    <div className="dp-rule" />
                </div>

                {VERDICTS[t.slug] && (
                    <div style={{ marginBottom: 20 }}>
                        <QuickAnswer reponse={VERDICTS[t.slug].reponse} seuilCle={VERDICTS[t.slug].seuilCle} />
                    </div>
                )}
                <div style={{ marginBottom: 20 }}><Reperes /></div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 20, alignItems: 'start' }}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--line-2)', display: 'grid', gap: 1 }}>
                        <div style={{ background: 'var(--surface-2)', padding: '13px 18px' }}>
                            <span className="dp-meta">Repères — {c.nom}</span>
                        </div>
                        {faits.map(([k, v]) => (
                            <div key={k} style={{ background: 'var(--surface)', padding: '12px 18px', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span>
                                <span style={{ fontFamily: 'var(--mf)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
                            </div>
                        ))}
                    </div>

                    <div className="dp-card dp-spec">
                        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '8px 6px', marginBottom: 16 }}>
                            <TravauxIllustration id={t.travauxId} height={112} />
                        </div>
                        <p style={{ margin: '0 0 10px', fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
                            Vérifier les règles applicables à votre parcelle
                        </p>
                        <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>
                            Le zonage conditionne tout le reste : recul aux limites, hauteur admise, teintes imposées. {aCommuneCap(c.nom)}, le
                            tissu est {tissu(c)}{zoneU ? ', ce qui rend probable un classement en zone urbaine du PLU — le seuil de 40 m² pour une extension y est alors applicable' : ' ; vérifiez le classement de la parcelle avant de retenir le seuil de 20 ou 40 m² pour une extension'}.
                        </p>
                        <a
                            href={geoportailUrl(c)}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="dp-btn-outline"
                            style={{ textDecoration: 'none' }}
                        >
                            Ouvrir le Géoportail de l&apos;Urbanisme
                        </a>
                        <p style={{ margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}>
                            Service public officiel. Le règlement de zone est également remis par le service urbanisme de la mairie {deCommune(c.nom)}.
                        </p>
                    </div>
                </div>
            </Section>

            <Section tone="surface">
                <H2 id="seuils">{t.nom} {aCommune(c.nom)} : quelle formalité ?</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Ces seuils sont ceux du Code de l&apos;urbanisme : ils s&apos;appliquent {aCommune(c.nom)} comme partout ailleurs. Le
                    PLU ne peut pas les abaisser, mais il ajoute ses propres exigences de forme.
                </p>
                <SeuilsTable seuils={t.seuils} />
                <div className="dp-alert is-warn" style={{ marginTop: 16 }}>
                    <span className="dp-alert-title">Secteur protégé</span>
                    Si votre parcelle est située aux abords d&apos;un monument historique, en site patrimonial remarquable ou en site
                    classé — cas courant dans les centres anciens comme celui {deCommune(c.nom)} — l&apos;Architecte des Bâtiments de France est
                    consulté, le délai passe à deux mois et la déclaration devient exigible même pour des travaux normalement dispensés.
                </div>
            </Section>

            <Section>
                <H2 id="plu">Ce que le PLU {deCommune(c.nom)} est susceptible d&apos;imposer</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Les points ci-dessous sont ceux que les règlements encadrent le plus systématiquement pour {t.article}. Chacun est à
                    confronter au règlement de votre zone : nous ne pouvons pas affirmer la règle locale à votre place, mais nous
                    pouvons vous dire exactement quoi y chercher.
                </p>
                <PluPoints titre={`À vérifier dans le règlement — ${c.nom}`} points={t.pluPoints} />
            </Section>

            <Section tone="surface">
                <H2 id="pieces">Les pièces du dossier</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Le service urbanisme {deCommune(c.nom)} instruit sur la base de ces pièces. Une seule manquante suspend le délai.
                </p>
                <PiecesList codes={t.pieces} note={t.piecesNote} />
            </Section>

            <Section>
                <H2 id="erreurs">Ce qui fait revenir un dossier</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Les motifs de demande de pièces complémentaires sont remarquablement constants d&apos;une commune à l&apos;autre.
                </p>
                <ErreursList erreurs={t.erreurs.slice(0, 3)} />
                <p style={{ marginTop: 18, fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                    <Link href={`/dp/${t.slug}`} style={{ color: 'var(--ac)', fontWeight: 600 }}>
                        Voir les {t.erreurs.length} erreurs et le guide complet « {t.nom} » →
                    </Link>
                </p>
            </Section>

            <Section tone="surface">
                <H2 id="depot">Déposer le dossier {aCommune(c.nom)}</H2>
                <div style={{ marginTop: 22 }}><ProcedureBlock /></div>
                <Disclaimer />
            </Section>

            <Section>
                <H2 id="faq">Questions fréquentes — {c.nom}</H2>
                <div style={{ marginTop: 20 }}><FaqList faq={faqLocale} /></div>
            </Section>

            <Section>
                <Cta
                    titre={`Votre dossier « ${t.nom} » ${aCommune(c.nom)}`}
                    texte="Cerfa, plan de situation, plan de masse, plan de coupe, façades, notice et insertion — le dossier complet, prêt à déposer en mairie."
                />
            </Section>

            <Section tone="surface">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 34 }}>
                    <div>
                        <p className="dp-meta" style={{ marginBottom: 12 }}>Autres travaux {aCommune(c.nom)}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {SEO_TRAVAUX.filter(x => x.slug !== t.slug).map(x => (
                                <Link key={x.slug} href={`/dp/${x.slug}/${communeParam(c)}`} className="dp-chip" style={{ textDecoration: 'none' }}>
                                    {x.nom}
                                </Link>
                            ))}
                        </div>
                        <p style={{ marginTop: 14, fontSize: 14 }}>
                            <Link href={`/dp/ville/${communeParam(c)}`} style={{ color: 'var(--ac)', fontWeight: 600, textDecoration: 'none' }}>
                                Toutes les démarches {aCommune(c.nom)} →
                            </Link>
                        </p>
                    </div>
                    <div>
                        {/* Formulation neutre : le genre des noms de département varie
                            (« dans le Rhône », « dans les Bouches-du-Rhône », « en Gironde »)
                            et aucune règle générale ne le déduit du nom. */}
                        <p className="dp-meta" style={{ marginBottom: 12 }}>{t.nom} — département {c.deptNom}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {voisines.map(v => (
                                <Link key={v.insee} href={`/dp/${t.slug}/${communeParam(v)}`} className="dp-chip" style={{ textDecoration: 'none' }}>
                                    {v.nom}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>
        </PublicShell>
    )
}
