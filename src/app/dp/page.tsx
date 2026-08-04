import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell from '@/components/seo/PublicShell'
import { H2, Section, ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd } from '@/components/seo/blocks'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'
import { COMMUNES, communeParam } from '@/lib/seo/communes'
import { canonical, ANNEE } from '@/lib/seo/site'

export const metadata: Metadata = {
    title: `Déclaration préalable de travaux : guides par type de projet (${ANNEE})`,
    description:
        'Abri de jardin, piscine, panneaux solaires, clôture, extension : pour chaque type de travaux, la formalité applicable, les pièces obligatoires du dossier et les erreurs qui font refuser une déclaration préalable.',
    alternates: { canonical: canonical('/dp') },
}

export default function DpHub() {
    // Un échantillon de grandes villes pour amorcer le maillage interne vers les
    // pages par commune (le sitemap couvre l'intégralité du jeu de données).
    const villes = COMMUNES.slice(0, 24)

    return (
        <PublicShell breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Guides' }]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
            ]} />

            <Section>
                <div className="dp-page-head">
                    <span className="dp-eyebrow">Guides — déclaration préalable</span>
                    <h1 className="dp-page-title">
                        Quelle formalité pour <em>vos travaux</em> ?
                    </h1>
                    <p className="dp-page-sub">
                        Onze types de travaux, un guide par type : le seuil qui déclenche la déclaration préalable ou le permis de
                        construire, les pièces que la mairie attend réellement, ce que votre PLU encadre, et les motifs concrets pour
                        lesquels un dossier revient incomplet.
                    </p>
                    <div className="dp-rule" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
                    {SEO_TRAVAUX.map(t => (
                        <Link key={t.slug} href={`/dp/${t.slug}`} className="dp-card dp-spec" style={{ textDecoration: 'none', display: 'block', padding: '24px 22px 20px' }}>
                            <p style={{ margin: '0 0 7px', fontFamily: 'var(--hf)', fontSize: 19, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{t.nom}</p>
                            <p style={{ margin: '0 0 14px', fontSize: 14.2, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                                {t.intro[0].split('. ')[0]}.
                            </p>
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>
                                Lire le guide →
                            </span>
                        </Link>
                    ))}
                </div>
            </Section>

            <Section tone="surface">
                <H2>La procédure, une fois pour toutes</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Ces règles sont communes à toutes les déclarations préalables, quel que soit le projet.
                </p>
                <ProcedureBlock />
                <Disclaimer />
            </Section>

            <Section>
                <H2>Les règles locales, commune par commune</H2>
                <p style={{ fontSize: 16, lineHeight: 1.72, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: '72ch' }}>
                    Le Code de l&apos;urbanisme fixe les seuils ; le PLU de votre commune fixe les hauteurs, les reculs, les teintes et
                    les matériaux. Chaque guide se décline par commune, avec le lien direct vers le document d&apos;urbanisme opposable.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {villes.map(c => (
                        <Link
                            key={c.insee}
                            href={`/dp/${SEO_TRAVAUX[0].slug}/${communeParam(c)}`}
                            className="dp-chip"
                            style={{ textDecoration: 'none' }}
                        >
                            {c.nom}
                        </Link>
                    ))}
                </div>
            </Section>

            <Section>
                <Cta
                    titre="Votre dossier de déclaration préalable, constitué à partir de votre PLU"
                    texte="Nous cherchons des projets réels pour tester l’outil. C’est gratuit, sans engagement, et nous suivons votre dossier jusqu’à la réponse de la mairie."
                />
            </Section>
        </PublicShell>
    )
}
