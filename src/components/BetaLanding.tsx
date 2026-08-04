'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Page de recrutement des testeurs (/beta).
//
// Parti pris : l'honnêteté convertit mieux que la promesse. On dit que l'outil
// est en test, on dit ce qu'on attend en retour, et on offre l'accès au lieu de
// le brader — le prix de référence n'est jamais ancré plus bas que le tarif
// unitaire, il est simplement offert aux testeurs.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SEO_TRAVAUX } from '@/lib/seo/travaux'
import { track, anonId, attribution } from '@/lib/track'

type Profil = 'particulier' | 'pro'

const ENGAGEMENTS = [
    {
        titre: 'Le dossier complet, offert',
        texte: 'Cerfa 16702 rempli, plan de situation, plan de masse, plan de coupe, plan des façades, notice descriptive, insertion et photos. Prêt à déposer en mairie. Aucune carte bancaire demandée.',
    },
    {
        titre: 'Une relecture humaine avant dépôt',
        texte: 'Pendant la phase de test, chaque dossier est relu à la main avant que vous le déposiez. Si une pièce est faible, nous vous le disons — et nous la reprenons.',
    },
    {
        titre: 'On corrige jusqu’à ce que le dossier passe',
        texte: 'Si la mairie demande des pièces complémentaires, nous reprenons le dossier autant de fois que nécessaire, sans frais et sans limite de temps.',
    },
]

const ATTENTES = [
    'Un appel de vingt minutes après avoir utilisé l’outil : ce qui a bloqué, ce qui manquait, ce qui vous a fait hésiter.',
    'Nous dire ce que la mairie a répondu — récépissé, demande de pièces complémentaires, décision. C’est la seule mesure qui compte vraiment.',
    'L’autorisation d’utiliser votre dossier de façon anonymisée pour améliorer l’outil.',
]

export default function BetaLanding() {
    const [profil, setProfil] = useState<Profil>('particulier')
    const [form, setForm] = useState({
        nom: '', email: '', phone: '', metier: '', travaux: '', commune: '', codePostal: '', message: '',
    })
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [error, setError] = useState('')

    // Pré-sélection du type de travaux depuis les guides SEO (/beta?travaux=piscine).
    // Lu depuis window plutôt que via useSearchParams : cela évite de basculer la
    // page en rendu dynamique et de perdre son pré-rendu statique.
    useEffect(() => {
        try {
            const t = new URLSearchParams(window.location.search).get('travaux')
            if (t && SEO_TRAVAUX.some(x => x.slug === t)) setForm(f => ({ ...f, travaux: t }))
        } catch { /* rien à faire */ }
        track('beta_view')
    }, [])

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }))

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setState('sending'); setError('')
        try {
            const attr = attribution()
            const res = await fetch('/api/beta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, profil, ...attr, anonId: anonId() }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error || 'Envoi impossible.')
            }
            setState('sent')
        } catch (err) {
            setState('error')
            setError(err instanceof Error ? err.message : 'Envoi impossible.')
        }
    }

    return (
        <>
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '54px 20px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: 44, alignItems: 'start' }}>
                        <div>
                            <span className="dp-eyebrow">Programme de test — places limitées</span>
                            <h1 className="dp-page-title" style={{ marginTop: 12 }}>
                                Votre déclaration préalable, <em>montée pour vous</em> et gratuite
                            </h1>
                            <p className="dp-page-sub">
                                Nous avons construit un outil qui produit un dossier de déclaration préalable complet à partir de
                                l&apos;adresse de votre terrain et du PLU de votre commune. Il fonctionne. Avant de le vendre, nous voulons
                                le confronter à de vrais projets et à de vraies mairies.
                            </p>
                            <p className="dp-page-sub" style={{ marginTop: 14 }}>
                                Nous cherchons une vingtaine de projets réels — abri de jardin, piscine, panneaux solaires, clôture,
                                extension, ravalement. Nous montons votre dossier gratuitement. En échange, nous vous demandons votre
                                retour honnête et la réponse de votre mairie.
                            </p>
                            <div className="dp-rule" />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
                                <span className="dp-chip is-ok">Gratuit, sans carte bancaire</span>
                                <span className="dp-chip is-ok">Sans engagement</span>
                                <span className="dp-chip is-ok">Données hébergées en France</span>
                            </div>
                        </div>

                        {/* ── Formulaire ────────────────────────────────────── */}
                        <div className="dp-card dp-spec" id="candidater" style={{ scrollMarginTop: 90 }}>
                            {state === 'sent' ? (
                                <div>
                                    <span className="dp-chip is-ok" style={{ marginBottom: 14 }}>Candidature enregistrée</span>
                                    <p style={{ margin: '0 0 10px', fontFamily: 'var(--hf)', fontSize: 21, fontWeight: 600, color: 'var(--ink)' }}>
                                        Merci — on vous écrit sous 48 heures.
                                    </p>
                                    <p style={{ margin: '0 0 18px', fontSize: 14.8, lineHeight: 1.65, color: 'var(--ink-2)' }}>
                                        Nous revenons vers vous par email avec les prochaines étapes. Si votre projet colle au programme,
                                        nous vous proposons un créneau de vingt minutes pour monter le dossier ensemble.
                                    </p>
                                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted)' }}>
                                        Vous pouvez déjà créer votre compte et commencer à saisir votre projet :{' '}
                                        <Link href="/register" style={{ color: 'var(--ac)', fontWeight: 600 }}>créer un compte</Link>.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={submit}>
                                    <p style={{ margin: '0 0 4px', fontFamily: 'var(--hf)', fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>Candidater au programme</p>
                                    <p style={{ margin: '0 0 18px', fontSize: 13.8, lineHeight: 1.55, color: 'var(--muted)' }}>
                                        Deux minutes. Aucun paiement, aucune obligation.
                                    </p>

                                    <div className="dp-form-group" style={{ marginBottom: 14 }}>
                                        <span className="dp-label">Vous êtes</span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" onClick={() => setProfil('particulier')} className={`toggle-btn${profil === 'particulier' ? ' active' : ''}`} style={{ flex: 1 }}>Particulier</button>
                                            <button type="button" onClick={() => setProfil('pro')} className={`toggle-btn${profil === 'pro' ? ' active' : ''}`} style={{ flex: 1 }}>Professionnel</button>
                                        </div>
                                    </div>

                                    <div className="dp-form-group" style={{ marginBottom: 12 }}>
                                        <label className="dp-label" htmlFor="b-nom">Nom et prénom *</label>
                                        <input id="b-nom" className="dp-input" required value={form.nom} onChange={set('nom')} placeholder="Camille Martin" autoComplete="name" />
                                    </div>

                                    <div className="dp-form-group" style={{ marginBottom: 12 }}>
                                        <label className="dp-label" htmlFor="b-email">Email *</label>
                                        <input id="b-email" type="email" className="dp-input" required value={form.email} onChange={set('email')} placeholder="vous@exemple.fr" autoComplete="email" />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        <div className="dp-form-group">
                                            <label className="dp-label" htmlFor="b-tel">Téléphone</label>
                                            <input id="b-tel" className="dp-input" value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" autoComplete="tel" />
                                        </div>
                                        <div className="dp-form-group">
                                            <label className="dp-label" htmlFor="b-cp">Code postal</label>
                                            <input id="b-cp" className="dp-input" value={form.codePostal} onChange={set('codePostal')} placeholder="13100" inputMode="numeric" maxLength={5} />
                                        </div>
                                    </div>

                                    {profil === 'pro' && (
                                        <div className="dp-form-group" style={{ marginBottom: 12 }}>
                                            <label className="dp-label" htmlFor="b-metier">Votre activité</label>
                                            <input id="b-metier" className="dp-input" value={form.metier} onChange={set('metier')} placeholder="Installateur photovoltaïque, pisciniste, maître d’œuvre…" />
                                        </div>
                                    )}

                                    <div className="dp-form-group" style={{ marginBottom: 12 }}>
                                        <label className="dp-label" htmlFor="b-travaux">Type de projet</label>
                                        <select id="b-travaux" className="dp-select" value={form.travaux} onChange={set('travaux')}>
                                            <option value="">— Sélectionner —</option>
                                            {SEO_TRAVAUX.map(t => <option key={t.slug} value={t.slug}>{t.nom}</option>)}
                                        </select>
                                    </div>

                                    <div className="dp-form-group" style={{ marginBottom: 12 }}>
                                        <label className="dp-label" htmlFor="b-commune">Commune du projet</label>
                                        <input id="b-commune" className="dp-input" value={form.commune} onChange={set('commune')} placeholder="Aix-en-Provence" />
                                    </div>

                                    <div className="dp-form-group" style={{ marginBottom: 16 }}>
                                        <label className="dp-label" htmlFor="b-msg">Votre projet en deux lignes</label>
                                        <textarea id="b-msg" className="dp-input" value={form.message} onChange={set('message')} style={{ minHeight: 82 }} placeholder="Ex : abri de jardin de 15 m² au fond du terrain, maison en zone pavillonnaire, travaux prévus au printemps." />
                                    </div>

                                    {error && <div className="dp-alert is-error" style={{ marginBottom: 12 }}>{error}</div>}

                                    <button type="submit" className="dp-btn-primary" disabled={state === 'sending'} style={{ width: '100%', justifyContent: 'center' }}>
                                        {state === 'sending' ? <><span className="dp-spinner dp-spinner-sm on-accent" /> Envoi…</> : 'Envoyer ma candidature'}
                                    </button>
                                    <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--muted)' }}>
                                        Vos coordonnées servent uniquement à vous contacter au sujet du programme de test. Aucune revente,
                                        aucune newsletter. Suppression sur simple demande.
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Ce que vous obtenez ──────────────────────────────────────── */}
            <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginTop: 40 }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 20px' }}>
                    <h2 style={{ fontFamily: 'var(--hf)', fontWeight: 500, fontSize: 'clamp(22px,3vw,29px)', color: 'var(--ink)', margin: '0 0 8px' }}>Ce que vous obtenez</h2>
                    <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 26px', maxWidth: '68ch' }}>
                        Un dossier de déclaration préalable coûte entre 300 et 900 € chez un maître d&apos;œuvre. Pendant la phase de
                        test, il est offert aux testeurs sélectionnés.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 14 }}>
                        {ENGAGEMENTS.map((e, i) => (
                            <div key={i} className="dp-card" style={{ padding: '22px 22px 20px' }}>
                                <span className="dp-chip is-ok" style={{ marginBottom: 12 }}><span className="code">{String(i + 1).padStart(2, '0')}</span></span>
                                <p style={{ margin: '0 0 7px', fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{e.titre}</p>
                                <p style={{ margin: 0, fontSize: 14.6, lineHeight: 1.65, color: 'var(--ink-2)' }}>{e.texte}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Ce qu'on vous demande ────────────────────────────────────── */}
            <section>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 40 }}>
                        <div>
                            <h2 style={{ fontFamily: 'var(--hf)', fontWeight: 500, fontSize: 'clamp(22px,3vw,29px)', color: 'var(--ink)', margin: '0 0 8px' }}>Ce qu&apos;on vous demande</h2>
                            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                                Trois choses, et rien d&apos;autre. Pas de témoignage à écrire, pas d&apos;engagement d&apos;achat.
                            </p>
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
                                {ATTENTES.map((a, i) => (
                                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <span aria-hidden style={{ fontFamily: 'var(--mf)', fontSize: 12, fontWeight: 600, color: 'var(--ac)', paddingTop: 3 }}>0{i + 1}</span>
                                        <span style={{ fontSize: 15.2, lineHeight: 1.65, color: 'var(--ink-2)' }}>{a}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h2 style={{ fontFamily: 'var(--hf)', fontWeight: 500, fontSize: 'clamp(22px,3vw,29px)', color: 'var(--ink)', margin: '0 0 8px' }}>Ce que nous ne sommes pas</h2>
                            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 18px' }}>
                                Autant le dire tout de suite, pour que personne ne perde son temps.
                            </p>
                            <div style={{ display: 'grid', gap: 10 }}>
                                <div className="dp-alert is-info">
                                    Nous ne sommes ni un service de l&apos;État, ni un cabinet d&apos;architecture. Nous vous assistons dans la
                                    constitution du dossier ; c&apos;est vous qui signez la déclaration et qui en restez responsable.
                                </div>
                                <div className="dp-alert is-info">
                                    Nous ne déposons pas le dossier à votre place et nous n&apos;avons aucun lien avec les mairies. Nous ne
                                    pouvons pas garantir une décision favorable — personne ne peut le faire.
                                </div>
                                <div className="dp-alert is-info">
                                    Au-delà de 40 m² d&apos;extension, de 20 m² d&apos;annexe, de 100 m² de bassin ou de 150 m² de surface totale,
                                    votre projet relève du permis de construire : nous vous le dirons, et nous vous orienterons.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Pros ─────────────────────────────────────────────────────── */}
            <section style={{ background: 'var(--acd)', color: '#fff' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '46px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ maxWidth: '58ch' }}>
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.62)' }}>
                                Installateurs, pisciniers, maîtres d&apos;œuvre
                            </span>
                            <p style={{ margin: '12px 0 10px', fontFamily: 'var(--hf)', fontSize: 'clamp(22px,3vw,29px)', fontWeight: 500, lineHeight: 1.22 }}>
                                Vous déposez plusieurs déclarations par mois ?
                            </p>
                            <p style={{ margin: 0, fontSize: 15.4, lineHeight: 1.68, color: 'rgba(255,255,255,.8)' }}>
                                Nous cherchons cinq entreprises pour tester l&apos;outil sur leurs prochains chantiers. Vous saisissez
                                l&apos;adresse et les caractéristiques du projet, vous récupérez le dossier complet. Nous mesurons ce que
                                vous gagnez réellement, dossier par dossier, et vous gardez tout ce qui est produit.
                            </p>
                        </div>
                        <a
                            href="#candidater"
                            onClick={() => { setProfil('pro'); track('beta_pro_cta') }}
                            style={{ background: '#fff', color: 'var(--acd)', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                            Candidater en tant que pro
                        </a>
                    </div>
                </div>
            </section>

            {/* ── Déroulé ──────────────────────────────────────────────────── */}
            <section>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 20px' }}>
                    <h2 style={{ fontFamily: 'var(--hf)', fontWeight: 500, fontSize: 'clamp(22px,3vw,29px)', color: 'var(--ink)', margin: '0 0 26px' }}>Comment ça se passe</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                        {[
                            ['Jour 1', 'Vous candidatez', 'Nous répondons sous 48 heures et vous proposons un créneau si le projet correspond.'],
                            ['Jour 2 à 4', 'Vous montez le dossier', 'Vingt minutes dans l’outil, accompagné si vous le souhaitez. Vous repartez avec le dossier complet.'],
                            ['Semaine 1', 'Vous déposez en mairie', 'En ligne via le guichet numérique de votre commune, ou au guichet. Vous obtenez un récépissé.'],
                            ['Semaine 4 à 8', 'Vous nous dites la suite', 'Décision, ou demande de pièces complémentaires. Dans ce cas, nous reprenons le dossier sans frais.'],
                        ].map(([quand, titre, texte], i) => (
                            <div key={i} className="dp-card" style={{ padding: '20px 20px 18px' }}>
                                <span className="dp-meta">{quand}</span>
                                <p style={{ margin: '8px 0 6px', fontFamily: 'var(--hf)', fontSize: 17.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.28 }}>{titre}</p>
                                <p style={{ margin: 0, fontSize: 14.3, lineHeight: 1.62, color: 'var(--ink-2)' }}>{texte}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 34, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                        <a href="#candidater" className="dp-btn-primary" style={{ textDecoration: 'none' }}>Candidater au programme</a>
                        <Link href="/dp" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ac)', textDecoration: 'none' }}>
                            Lire d&apos;abord les guides par type de travaux →
                        </Link>
                    </div>
                </div>
            </section>
        </>
    )
}
