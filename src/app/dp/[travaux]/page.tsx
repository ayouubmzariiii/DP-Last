import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/seo/PublicShell'
import {
    H2, Prose, Section, SeuilsTable, PiecesList, ErreursList, PluPoints,
    FaqList, ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd,
} from '@/components/seo/blocks'
import { SEO_TRAVAUX, findTravaux } from '@/lib/seo/travaux'
import { COMMUNES, communeParam } from '@/lib/seo/communes'
import { canonical, ANNEE, SITE_NAME } from '@/lib/seo/site'

export const dynamicParams = false

export function generateStaticParams() {
    return SEO_TRAVAUX.map(t => ({ travaux: t.slug }))
}

export function generateMetadata({ params }: { params: { travaux: string } }): Metadata {
    const t = findTravaux(params.travaux)
    if (!t) return {}
    return {
        title: `${t.metaTitle} (${ANNEE})`,
        description: t.metaDescription,
        keywords: t.aliases,
        alternates: { canonical: canonical(`/dp/${t.slug}`) },
        openGraph: {
            title: t.metaTitle,
            description: t.metaDescription,
            url: canonical(`/dp/${t.slug}`),
            siteName: SITE_NAME,
            locale: 'fr_FR',
            type: 'article',
        },
    }
}

export default function TravauxGuide({ params }: { params: { travaux: string } }) {
    const t = findTravaux(params.travaux)
    if (!t) notFound()

    const villes = COMMUNES.slice(0, 30)
    const related = t.related.map(findTravaux).filter(Boolean) as NonNullable<ReturnType<typeof findTravaux>>[]

    return (
        <PublicShell breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Guides', href: '/dp' }, { label: t.nom }]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
                { name: t.nom, url: canonical(`/dp/${t.slug}`) },
            ]} />

            <Section>
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Déclaration préalable · {t.nom}</span>
                    <h1 className="dp-page-title">
                        Déclaration préalable pour <em>{t.article}</em>
                    </h1>
                    <div className="dp-rule" />
                </div>
                <Prose paragraphs={t.intro} />
            </Section>

            <Section tone="surface">
                <H2 id="seuils">Faut-il une autorisation ?</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Les seuils ci-dessous relèvent du Code de l&apos;urbanisme : ils s&apos;appliquent partout en France.
                </p>
                <SeuilsTable seuils={t.seuils} />
            </Section>

            <Section>
                <H2 id="pieces">Les pièces à joindre</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Le formulaire ne représente qu&apos;une petite part du dossier. Ce sont ces pièces annexes qui décident de sa
                    recevabilité, et leur absence ou leur imprécision est la cause quasi unique des demandes de pièces complémentaires.
                </p>
                <PiecesList codes={t.pieces} note={t.piecesNote} />
            </Section>

            <Section tone="surface">
                <H2 id="erreurs">Les {t.erreurs.length} erreurs qui font revenir le dossier</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Un refus franc est rare. Ce qui arrive, c&apos;est la demande de pièces complémentaires : le délai est suspendu, le
                    chantier décalé de plusieurs semaines. Voici ce qui la déclenche pour {t.article}.
                </p>
                <ErreursList erreurs={t.erreurs} />
            </Section>

            <Section>
                <H2 id="plu">Ce que votre PLU encadre</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Les seuils sont nationaux, les règles de forme sont locales. Pour {t.article}, voici les points du règlement à
                    vérifier avant de dessiner le projet — et non après.
                </p>
                <PluPoints titre={`Points de vigilance — ${t.nom}`} points={t.pluPoints} />
            </Section>

            <Section tone="surface">
                <H2 id="procedure">Délais, dépôt et suites</H2>
                <div style={{ marginTop: 22 }}><ProcedureBlock /></div>
                <Disclaimer />
            </Section>

            <Section>
                <H2 id="faq">Questions fréquentes</H2>
                <div style={{ marginTop: 20 }}><FaqList faq={t.faq} /></div>
            </Section>

            <Section>
                <Cta
                    travauxSlug={t.slug}
                    titre={`Votre dossier « ${t.nom} », monté à partir du PLU de votre commune`}
                    texte="Nous cherchons des projets réels pour tester l’outil : c’est gratuit, sans engagement, et nous suivons votre dossier jusqu’à la réponse de la mairie."
                />
            </Section>

            <Section tone="surface">
                <H2>{t.nom} : les règles de votre commune</H2>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: '72ch' }}>
                    Accédez au document d&apos;urbanisme opposable et aux repères locaux pour votre commune.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {villes.map(c => (
                        <Link key={c.insee} href={`/dp/${t.slug}/${communeParam(c)}`} className="dp-chip" style={{ textDecoration: 'none' }}>
                            {c.nom} <span style={{ color: 'var(--faint)' }}>{c.dept}</span>
                        </Link>
                    ))}
                </div>
                <p style={{ marginTop: 16, fontSize: 14.5 }}>
                    <Link href="/dp" style={{ color: 'var(--ac)', fontWeight: 600, textDecoration: 'none' }}>
                        Voir toutes les communes couvertes →
                    </Link>
                </p>

                {related.length > 0 && (
                    <div style={{ marginTop: 40 }}>
                        <p className="dp-meta" style={{ marginBottom: 12 }}>Guides liés</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
                            {related.map(r => (
                                <Link key={r.slug} href={`/dp/${r.slug}`} className="dp-card" style={{ textDecoration: 'none', padding: '18px 20px' }}>
                                    <p style={{ margin: '0 0 4px', fontFamily: 'var(--hf)', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{r.nom}</p>
                                    <span style={{ fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>Lire →</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <p style={{ marginTop: 34, fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted)' }}>
                    Aussi recherché : {t.aliases.join(' · ')}.
                </p>
            </Section>
        </PublicShell>
    )
}
