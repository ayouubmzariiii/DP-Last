import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell from '@/components/seo/PublicShell'
import TravauxIllustration from '@/components/seo/TravauxIllustration'
import { H2, Section, ProcedureBlock, Disclaimer, Cta, BreadcrumbJsonLd } from '@/components/seo/blocks'
import { SEO_TRAVAUX, VERDICTS } from '@/lib/seo/travaux'
import { COMMUNES, communeParam } from '@/lib/seo/communes'
import { canonical, ANNEE } from '@/lib/seo/site'

export const metadata: Metadata = {
    title: `Déclaration préalable de travaux : guides par type de projet (${ANNEE})`,
    description:
        'Abri de jardin, piscine, panneaux solaires, clôture, extension : pour chaque type de travaux, la formalité applicable, les pièces obligatoires du dossier et les erreurs qui font refuser une déclaration préalable.',
    alternates: { canonical: canonical('/dp') },
}

export default function DpHub() {
    // Les villes listées ici pointent vers leur HUB de commune (/dp/ville/…), qui
    // distribue ensuite vers les onze déclinaisons par travaux. Un lien par ville
    // au lieu d'un lien arbitraire vers un seul type de travaux.
    const villes = COMMUNES.slice(0, 60)

    return (
        <PublicShell breadcrumb={[{ label: 'Accueil', href: '/' }, { label: 'Guides' }]}>
            <BreadcrumbJsonLd items={[
                { name: 'Accueil', url: canonical('/') },
                { name: 'Guides', url: canonical('/dp') },
            ]} />

            <Section first>
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
                    {SEO_TRAVAUX.map(t => {
                        const v = VERDICTS[t.slug]
                        return (
                            <Link key={t.slug} href={`/dp/${t.slug}`} className="dp-card" style={{ textDecoration: 'none', display: 'block', padding: '18px 20px 20px' }}>
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '10px 8px', marginBottom: 14 }}>
                                    <TravauxIllustration id={t.travauxId} height={104} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                                    <span style={{ fontFamily: 'var(--hf)', fontSize: 19, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{t.nom}</span>
                                    {v && <span style={{ fontFamily: 'var(--mf)', fontSize: 11, fontWeight: 600, color: 'var(--acd)', background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 7, padding: '3px 8px', whiteSpace: 'nowrap' }}>{v.seuilCle}</span>}
                                </div>
                                <p style={{ margin: '0 0 14px', fontSize: 14.2, lineHeight: 1.6, color: 'var(--ink-2)' }}>
                                    {v ? v.reponse : `${t.intro[0].split('. ')[0]}.`}
                                </p>
                                <span style={{ fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ac)' }}>
                                    Lire le guide →
                                </span>
                            </Link>
                        )
                    })}
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
                    les matériaux. Chaque commune a sa page, avec le lien direct vers le document d&apos;urbanisme opposable et les onze
                    types de travaux déclinés localement.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {villes.map(c => (
                        <Link
                            key={c.insee}
                            href={`/dp/ville/${communeParam(c)}`}
                            className="dp-chip"
                            style={{ textDecoration: 'none' }}
                        >
                            {c.nom} <span style={{ color: 'var(--faint)' }}>{c.dept}</span>
                        </Link>
                    ))}
                </div>
                <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {COMMUNES.length} communes couvertes, soit les principales villes de {new Set(COMMUNES.map(c => c.dept)).size} départements.
                    Votre commune n&apos;est pas listée ? Les seuils et les pièces sont identiques partout — seul le règlement local change.
                </p>
            </Section>

            <Section>
                <Cta
                    titre="Votre dossier de déclaration préalable, constitué à partir de votre PLU"
                    texte="Cerfa, plan de situation, plan de masse, plan de coupe, façades, notice et insertion — le dossier complet, prêt à déposer en mairie."
                />
            </Section>
        </PublicShell>
    )
}
