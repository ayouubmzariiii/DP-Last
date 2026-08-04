import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/seo/PublicShell'
import TravauxIllustration from '@/components/seo/TravauxIllustration'
import {
    H2, Prose, Section, SeuilsTable, PiecesList, ErreursList, PluPoints,
    FaqList, ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd,
    QuickAnswer, Reperes, Sommaire,
} from '@/components/seo/blocks'
import { SEO_TRAVAUX, findTravaux, VERDICTS, RESERVE_SECTEUR_PROTEGE } from '@/lib/seo/travaux'
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

    const verdict = VERDICTS[t.slug]
    const villes = COMMUNES.slice(0, 30)
    const related = t.related.map(findTravaux).filter(Boolean) as NonNullable<ReturnType<typeof findTravaux>>[]

    const sommaire = [
        { id: 'seuils', label: 'Seuils' },
        { id: 'pieces', label: 'Pièces du dossier' },
        { id: 'erreurs', label: 'Erreurs à éviter' },
        { id: 'plu', label: 'Règles du PLU' },
        { id: 'procedure', label: 'Délais et dépôt' },
        { id: 'faq', label: 'Questions fréquentes' },
        { id: 'communes', label: 'Votre commune' },
    ]

    return (
        <PublicShell breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Guides', href: '/dp' }, { label: t.nom }]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
                { name: t.nom, url: canonical(`/dp/${t.slug}`) },
            ]} />

            {/* ── Hero : titre + réponse immédiate, avec le croquis du sujet ─────── */}
            <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 1160, margin: '0 auto', padding: '26px 28px 38px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 40, alignItems: 'center' }} className="dp-hero-grid">
                        <div>
                            <span className="dp-eyebrow">Déclaration préalable · {t.nom}</span>
                            <h1 className="dp-page-title" style={{ marginTop: 10 }}>
                                Déclaration préalable pour <em>{t.article}</em>
                            </h1>
                            <p className="dp-page-sub">{t.intro[0]}</p>
                        </div>
                        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 18, padding: '22px 20px' }} className="dp-hero-visual">
                            <TravauxIllustration id={t.travauxId} height={176} />
                            <p style={{ margin: '10px 0 0', textAlign: 'center', fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                                Schéma de principe — {t.nom}
                            </p>
                        </div>
                    </div>

                    {verdict && (
                        <div style={{ marginTop: 30 }}>
                            <QuickAnswer reponse={verdict.reponse} seuilCle={verdict.seuilCle} />
                        </div>
                    )}

                    <div style={{ marginTop: 12 }}><Reperes /></div>
                    <div style={{ marginTop: 12 }}><Sommaire items={sommaire} /></div>
                </div>
            </section>

            <Section>
                <H2 id="seuils">Faut-il une autorisation ?</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Ces seuils sont ceux du Code de l&apos;urbanisme. Ils valent sur l&apos;ensemble du territoire <em>hors secteur
                    protégé</em> — la réserve ci-dessous n&apos;est pas un détail : elle change le régime applicable.
                </p>
                <SeuilsTable seuils={t.seuils} />
                <div className="dp-alert is-warn" style={{ marginTop: 14 }}>
                    <span className="dp-alert-title">Avant tout : votre parcelle est-elle en secteur protégé ?</span>
                    {RESERVE_SECTEUR_PROTEGE}
                </div>
                <details style={{ marginTop: 20 }}>
                    <summary style={{ cursor: 'pointer', fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>
                        En détail — comment ces seuils se calculent
                    </summary>
                    <div style={{ marginTop: 16 }}><Prose paragraphs={t.intro.slice(1)} /></div>
                </details>
            </Section>

            <Section tone="surface">
                <H2 id="pieces">Les pièces à joindre</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Le formulaire ne représente qu&apos;une petite part du dossier. Ce sont ces pièces annexes qui décident de sa
                    recevabilité, et leur absence est la cause quasi unique des demandes de pièces complémentaires.
                </p>
                <PiecesList codes={t.pieces} note={t.piecesNote} />
            </Section>

            <Section>
                <H2 id="erreurs">Les {t.erreurs.length} erreurs qui font revenir le dossier</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Un refus franc est rare. Ce qui arrive, c&apos;est la demande de pièces complémentaires : le délai est suspendu, le
                    chantier décalé de plusieurs semaines.
                </p>
                <ErreursList erreurs={t.erreurs} />
            </Section>

            <Section tone="surface">
                <H2 id="plu">Ce que votre PLU encadre</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Les seuils sont nationaux, les règles de forme sont locales. Voici les points du règlement à vérifier avant de
                    dessiner le projet — et non après.
                </p>
                <PluPoints titre={`Points de vigilance — ${t.nom}`} points={t.pluPoints} />
            </Section>

            <Section>
                <H2 id="procedure">Délais, dépôt et suites</H2>
                <div style={{ marginTop: 22 }}><ProcedureBlock /></div>
                <Disclaimer />
            </Section>

            <Section tone="surface">
                <H2 id="faq">Questions fréquentes</H2>
                <div style={{ marginTop: 20 }}><FaqList faq={t.faq} /></div>
            </Section>

            <Section>
                <Cta
                    titre={`Votre dossier « ${t.nom} », monté à partir du PLU de votre commune`}
                    texte="Cerfa, plan de situation, plan de masse, plan de coupe, façades, notice et insertion — le dossier complet, prêt à déposer en mairie."
                />
            </Section>

            <Section tone="surface">
                <H2 id="communes">{t.nom} : les règles de votre commune</H2>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                            {related.map(r => (
                                <Link key={r.slug} href={`/dp/${r.slug}`} className="dp-card" style={{ textDecoration: 'none', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <span style={{ flexShrink: 0, width: 56 }}><TravauxIllustration id={r.travauxId} height={40} /></span>
                                    <span>
                                        <span style={{ display: 'block', fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{r.nom}</span>
                                        <span style={{ fontFamily: 'var(--mf)', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>Lire →</span>
                                    </span>
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
