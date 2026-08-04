import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/seo/PublicShell'
import { H2, Section, ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd, FaqList } from '@/components/seo/blocks'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'
import {
    COMMUNES, findCommune, communeParam, communesVoisines, densite,
    geoportailUrl, deCommune, aCommune, aCommuneCap, aCommuneParts,
} from '@/lib/seo/communes'
import { canonical, ANNEE, SITE_NAME } from '@/lib/seo/site'

// ─────────────────────────────────────────────────────────────────────────────
// Hub par commune : « Déclaration préalable à Toulouse — toutes les démarches ».
//
// Ce type de page répond à la requête générique « déclaration préalable +
// ville », que les pages par travaux ne captent pas, et il donne au maillage
// interne son point de convergence : une commune = une page forte, qui distribue
// ensuite vers ses onze déclinaisons par travaux.
//
// Le segment « ville » est statique : il est donc résolu avant la route dynamique
// /dp/[travaux]/[commune], sans ambiguïté (et « ville » n'est de toute façon pas
// un slug de travaux existant).
// ─────────────────────────────────────────────────────────────────────────────

const PRERENDER = 60
export const revalidate = 86400

export function generateStaticParams() {
    return COMMUNES.slice(0, PRERENDER).map(c => ({ commune: communeParam(c) }))
}

export function generateMetadata({ params }: { params: { commune: string } }): Metadata {
    const c = findCommune(params.commune)
    if (!c) return {}
    const title = `Déclaration préalable ${aCommune(c.nom)} (${c.dept}) : démarches et PLU ${ANNEE}`
    const description = `Toutes les déclarations préalables ${aCommune(c.nom)} : abri de jardin, piscine, panneaux solaires, clôture, extension, ravalement. Seuils, pièces du dossier, délais, et accès au PLU ${deCommune(c.nom)}.`
    return {
        title,
        description,
        alternates: { canonical: canonical(`/dp/ville/${communeParam(c)}`) },
        openGraph: { title, description, url: canonical(`/dp/ville/${communeParam(c)}`), siteName: SITE_NAME, locale: 'fr_FR', type: 'article' },
    }
}

export default function VilleHub({ params }: { params: { commune: string } }) {
    const c = findCommune(params.commune)
    if (!c) notFound()

    const d = densite(c)
    const nf = (n: number) => n.toLocaleString('fr-FR')
    const voisines = communesVoisines(c, 12)

    const faq = [
        {
            q: `Quels travaux nécessitent une déclaration préalable ${aCommune(c.nom)} ?`,
            a: `Tous les travaux qui modifient l’aspect extérieur d’une construction (menuiseries, ravalement, toiture, panneaux solaires, création d’ouverture, isolation par l’extérieur) et les petites constructions nouvelles : annexe de 5 à 20 m², extension jusqu’à 20 ou 40 m² selon le zonage, piscine de 10 à 100 m² de bassin. Les clôtures y sont soumises lorsque la commune a délibéré en ce sens, ce qu’a fait la grande majorité des communes.`,
        },
        {
            q: `Où déposer sa déclaration préalable ${aCommune(c.nom)} ?`,
            // Deux obligations distinctes (art. L. 423-3) : RECEVOIR par voie électronique
            // s'impose à toute commune depuis le 1ᵉʳ janvier 2022 ; INSTRUIRE sous forme
            // dématérialisée, avec le guichet numérique qui va avec, ne s'impose qu'au-delà
            // de 3 500 habitants. Les confondre promet un GNAU à des communes qui n'en ont pas.
            a: c.population > 3500
                ? `Auprès du service urbanisme de la mairie ${deCommune(c.nom)}, ou par voie dématérialisée. Avec ${nf(c.population)} habitants, la commune dépasse le seuil de 3 500 habitants : elle doit instruire les demandes sous forme dématérialisée et met à disposition un guichet numérique des autorisations d’urbanisme (GNAU). Le dépôt donne lieu à un récépissé portant le numéro d’enregistrement et la date de départ du délai d’instruction.`
                : `Auprès du service urbanisme de la mairie ${deCommune(c.nom)}, par lettre recommandée avec accusé de réception, ou par voie électronique — depuis le 1ᵉʳ janvier 2022, toute commune doit pouvoir recevoir une demande d’urbanisme par voie électronique. Avec ${nf(c.population)} habitants, la commune reste en deçà du seuil de 3 500 habitants : elle n’est pas tenue de disposer d’un guichet numérique dédié, renseignez-vous sur les modalités qu’elle a retenues. Le dépôt donne lieu à un récépissé portant le numéro d’enregistrement et la date de départ du délai d’instruction.`,
        },
        {
            q: `Quel délai d’instruction ${aCommune(c.nom)} ?`,
            a: `Un mois pour une déclaration préalable, porté à deux mois lorsque l’Architecte des Bâtiments de France doit être consulté — aux abords d’un monument historique, en site patrimonial remarquable ou en site classé. L’absence de réponse dans le délai vaut décision de non-opposition.`,
        },
        {
            q: `Comment savoir ce qu’autorise le PLU ${deCommune(c.nom)} ?`,
            a: `Le document d’urbanisme opposable est publié sur le Géoportail de l’Urbanisme, où vous localisez votre parcelle et lisez le zonage. Le règlement de la zone, remis par le service urbanisme, fixe les hauteurs, les reculs aux limites, l’emprise au sol admise, les teintes et les matériaux imposés.`,
        },
    ]

    return (
        <PublicShell breadcrumb={[
            { label: 'Accueil', href: '/' },
            { label: 'Guides', href: '/dp' },
            { label: c.nom },
        ]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
                { name: c.nom, url: canonical(`/dp/ville/${communeParam(c)}`) },
            ]} />

            <Section first>
                <div className="dp-page-head">
                    <span className="dp-eyebrow">{c.deptNom} · {c.region}</span>
                    <h1 className="dp-page-title">
                        Déclaration préalable {aCommuneParts(c.nom).prep} <em>{aCommuneParts(c.nom).label}</em>
                    </h1>
                    <p className="dp-page-sub">
                        {c.nom} ({c.cp}), {nf(c.population)} habitants{d !== null ? `, ${nf(d)} hab/km²` : ''}, département {c.deptNom} ({c.dept}).
                        Choisissez votre type de travaux pour connaître la formalité applicable, les pièces attendues par le service
                        urbanisme et les points du PLU à vérifier avant de déposer.
                    </p>
                    <div className="dp-rule" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(292px,1fr))', gap: 12 }}>
                    {SEO_TRAVAUX.map(t => (
                        <Link
                            key={t.slug}
                            href={`/dp/${t.slug}/${communeParam(c)}`}
                            className="dp-card dp-spec"
                            style={{ textDecoration: 'none', display: 'block', padding: '22px 22px 18px' }}
                        >
                            <p style={{ margin: '0 0 6px', fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.28 }}>
                                {t.nom}
                            </p>
                            <p style={{ margin: '0 0 12px', fontSize: 13.8, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                                {t.seuils.find(s => s.formalite === 'dp')?.condition}
                            </p>
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>
                                Voir les règles {aCommune(c.nom)} →
                            </span>
                        </Link>
                    ))}
                </div>
            </Section>

            <Section tone="surface">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 22, alignItems: 'start' }}>
                    <div className="dp-card dp-spec">
                        <p style={{ margin: '0 0 10px', fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
                            Le PLU {deCommune(c.nom)}
                        </p>
                        <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>
                            {aCommuneCap(c.nom)} comme ailleurs, le Code de l&apos;urbanisme fixe les seuils, mais c&apos;est le règlement
                            local qui décide de la hauteur admise, du recul aux limites, des teintes et des matériaux. Localisez votre
                            parcelle avant de dessiner le projet.
                        </p>
                        <a href={geoportailUrl(c)} target="_blank" rel="noopener noreferrer nofollow" className="dp-btn-outline" style={{ textDecoration: 'none' }}>
                            Ouvrir le Géoportail de l&apos;Urbanisme
                        </a>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--line-2)', display: 'grid', gap: 1 }}>
                        <div style={{ background: 'var(--surface-2)', padding: '13px 18px' }}>
                            <span className="dp-meta">Repères — {c.nom}</span>
                        </div>
                        {([
                            ['Code INSEE', c.insee],
                            ['Code postal', c.cps > 1 ? `${c.cp} et ${c.cps - 1} autre${c.cps > 2 ? 's' : ''}` : c.cp || '—'],
                            ['Département', `${c.deptNom} (${c.dept})`],
                            ['Région', c.region],
                            ['Population', `${nf(c.population)} hab.`],
                            ['Superficie', c.surfaceKm2 ? `${nf(c.surfaceKm2)} km²` : '—'],
                        ] as [string, string][]).map(([k, v]) => (
                            <div key={k} style={{ background: 'var(--surface)', padding: '12px 18px', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span>
                                <span style={{ fontFamily: 'var(--mf)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            <Section>
                <H2>La procédure {aCommune(c.nom)}</H2>
                <div style={{ marginTop: 22 }}><ProcedureBlock /></div>
                <Disclaimer />
            </Section>

            <Section tone="surface">
                <H2>Questions fréquentes — {c.nom}</H2>
                <div style={{ marginTop: 20 }}><FaqList faq={faq} /></div>
            </Section>

            <Section>
                <Cta
                    titre={`Votre dossier de déclaration préalable ${aCommune(c.nom)}`}
                    texte="Cerfa, plan de situation, plan de masse, plan de coupe, façades, notice et insertion — le dossier complet, prêt à déposer en mairie."
                />
            </Section>

            <Section tone="surface">
                <p className="dp-meta" style={{ marginBottom: 12 }}>Autres communes — département {c.deptNom}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {voisines.map(v => (
                        <Link key={v.insee} href={`/dp/ville/${communeParam(v)}`} className="dp-chip" style={{ textDecoration: 'none' }}>
                            {v.nom}
                        </Link>
                    ))}
                </div>
                <p style={{ marginTop: 26, fontSize: 14.5 }}>
                    <Link href="/dp" style={{ color: 'var(--ac)', fontWeight: 600, textDecoration: 'none' }}>
                        ← Tous les guides par type de travaux
                    </Link>
                </p>
            </Section>
        </PublicShell>
    )
}
