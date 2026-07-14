'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Public marketing site — single-page, pro-first landing.
// Implements the Claude Design project "MarketingSite.dc.html" (DP Travaux design
// system) on the warm-paper "Architect's Dossier" tokens from globals.css.
// One scrolling page with anchor nav (#how #pricing #faq #contact); CTAs lead
// into the app (Commencer / Essayer → /register or /profil, Se connecter → /login).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { type SkuId } from '@/lib/billing/plans'

type CSS = React.CSSProperties

// Parse an inline CSS string into a React style object so the design's inline
// styles port faithfully. Custom properties (--x) are kept verbatim.
function s(css: string): CSS {
    const out: Record<string, string> = {}
    css.split(';').forEach((rule) => {
        const i = rule.indexOf(':')
        if (i === -1) return
        const prop = rule.slice(0, i).trim()
        const val = rule.slice(i + 1).trim()
        if (!prop) return
        const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        out[key] = val
    })
    return out as CSS
}

const Check = ({ size = 13, color = 'var(--ac)', sw = 3 }: { size?: number; color?: string; sw?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
)

// Line icon from one or more path `d` strings (ports the design's ico() helper).
const Ico = ({ ds, size = 22, color = 'var(--acd)', sw = 1.7 }: { ds: string[]; size?: number; color?: string; sw?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {ds.map((d, i) => <path key={i} d={d} />)}
    </svg>
)

interface Step { n: string; title: string; tag: string; body: string; ds: string[] }
const STEPS: Step[] = [
    { n: '1', title: 'Le terrain', tag: '≈ 2 min', body: 'Adresse officielle et références cadastrales, en un champ.', ds: ['M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'] },
    { n: '2', title: 'Les travaux', tag: '≈ 5 min', body: 'Nature du projet, matériaux, teintes RAL et surfaces.', ds: ['M14 4l6 6', 'M4 20l1.2-4.2L16.5 4.5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8.2 18.8 4 20z'] },
    { n: '3', title: 'L’analyse PLU', tag: '≈ 2 min · auto', body: 'Conformité au règlement de la zone, vérifiée avant la mairie.', ds: ['M12 3l7 3v5c0 4.6-3.1 7.7-7 9-3.9-1.3-7-4.4-7-9V6l7-3z', 'M9 12l2 2 4-4'] },
    { n: '4', title: 'Le dossier', tag: 'Le livrable', body: 'CERFA rempli et pièces DP1–DP8 assemblées, prêtes à déposer.', ds: ['M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M9 13h6M9 17h5'] },
]

const PRO_FEATURES = [
    { ds: ['M12 3l7 3v5c0 4.6-3.1 7.7-7 9-3.9-1.3-7-4.4-7-9V6l7-3z', 'M9 12l2 2 4-4'], title: 'Analyse PLU automatique', body: 'Le projet croisé au règlement de la parcelle : blocages, teintes imposées et secteurs ABF repérés avant le dépôt.' },
    { ds: ['M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M9 13h6M9 17h5'], title: 'CERFA & pièces assemblés', body: 'Le 16702*03 pré-rempli et les pièces DP1 à DP8 réunies dans un dossier unique, prêt à imprimer ou déposer en ligne.' },
    { ds: ['M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z', 'M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z'], title: 'Vues « après » & marque perso', body: 'L’insertion paysagère (DP6) générée par IA, la notice DP4 rédigée, et des exports à l’en-tête de votre cabinet.' },
]

const TESTIMONIALS = [
    { quote: 'Je génère les déclarations de mes clients en quinze minutes. L’analyse PLU nous a déjà évité deux refus.', name: 'Karim B.', meta: 'Menuisier · Villeurbanne', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&q=70' },
    { quote: 'La palette imposée en secteur ABF était signalée dès l’analyse. On a corrigé la teinte avant de déposer.', name: 'Sophie & Marc', meta: 'Maître d’œuvre · Bordeaux', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&q=70' },
    { quote: 'Dossier monté et déposé le week-end, accepté en trois semaines. Le gain de temps est réel.', name: 'Camille R.', meta: 'Architecte · Lyon 3e', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&q=70' },
]

const eligImg = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&q=70`
const ELIG: Record<string, { label: string; emoji: string; img: string; verdict: string; delai: string; note: string }> = {
    menuiseries: { label: 'Menuiseries', emoji: '🪟', img: eligImg('1509644851169-2acc08aa25b5'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Changer des fenêtres, portes ou volets modifie l’aspect extérieur : une déclaration préalable est requise.' },
    ite: { label: 'Isolation ext.', emoji: '🧱', img: eligImg('1621905251189-08b45d6a269e'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'L’isolation par l’extérieur change l’aspect des façades : la déclaration préalable est obligatoire.' },
    solaire: { label: 'Solaire', emoji: '☀️', img: eligImg('1509391366360-2e959784a276'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Panneaux posés en toiture : DP requise (permis si construction neuve ou secteur protégé).' },
    cloture: { label: 'Clôture', emoji: '🚪', img: eligImg('1558904541-efa843a96f01'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Selon la commune, une DP est souvent exigée pour une clôture ou un portail sur rue.' },
    abri: { label: 'Abri de jardin', emoji: '🏡', img: eligImg('1449844908441-8829872d2607'), verdict: 'DP de 5 à 20 m²', delai: '≈ 1 mois', note: 'Emprise ≤ 5 m² : aucune formalité. De 5 à 20 m² : déclaration préalable. Au-delà : permis.' },
    piscine: { label: 'Piscine', emoji: '🏊', img: eligImg('1576013551627-0cc20b96c2a7'), verdict: 'DP de 10 à 100 m²', delai: '≈ 1 mois', note: 'Bassin de 10 à 100 m² non couvert : déclaration préalable.' },
    ravalement: { label: 'Ravalement', emoji: '🎨', img: eligImg('1589939705384-5185137a7f0f'), verdict: 'Selon la commune', delai: '≈ 1 mois', note: 'Obligatoire en secteur protégé ou lorsque la commune l’impose par délibération.' },
    veranda: { label: 'Véranda', emoji: '🌿', img: eligImg('1616137466211-f939a420be84'), verdict: 'DP jusqu’à 20 m²', delai: '1 à 2 mois', note: 'Emprise ou surface ≤ 20 m² : déclaration préalable. Au-delà : permis de construire.' },
}
const ELIG_KEYS = ['menuiseries', 'ite', 'solaire', 'cloture', 'abri', 'piscine', 'ravalement', 'veranda']

interface Plan { key: string; name: string; price: string; unit: string; per: string; tag: string; highlight: boolean; cta: string; desc: string; features: string[] }
const PLANS_ABO: Plan[] = [
    { key: 's', name: 'Studio', price: '290', unit: '€', per: 'par mois', tag: '', highlight: false, cta: 'Essayer 14 jours', desc: 'Indépendants, artisans et petits cabinets.', features: ['5 dossiers par mois — 58 € l’unité', 'Multi-projets et multi-clients', 'Exports à votre marque', 'Modifications illimitées', 'Sans engagement'] },
    { key: 'c', name: 'Cabinet', price: '620', unit: '€', per: 'par mois', tag: 'Le plus choisi', highlight: true, cta: 'Essayer 14 jours', desc: 'Cabinets d’architecture et maîtres d’œuvre.', features: ['Tout de Studio, plus :', '12 dossiers/mois — ≈ 52 € l’unité', '5 utilisateurs inclus', 'Suivi par client et par chantier', 'Support prioritaire sous 4 h'] },
    { key: 'e', name: 'Agence', price: 'Sur devis', unit: '', per: 'volume sur mesure', tag: '', highlight: false, cta: 'Parler à l’équipe', desc: 'Groupes, réseaux et grands comptes.', features: ['Dossiers et utilisateurs illimités', 'Tarif dégressif — plancher 50 €', 'Déploiement multi-agences', 'API, SSO et intégrations', 'Interlocuteur dédié'] },
]
const PLANS_USAGE: Plan[] = [
    { key: 'd', name: 'Découverte', price: '0', unit: '€', per: 'pour toujours', tag: '', highlight: false, cta: 'Commencer', desc: 'Pour créer et vérifier votre dossier, sans payer.', features: ['Parcours guidé complet', 'Analyse PLU de la parcelle', 'Aperçu du CERFA et des pièces', 'Mode test avec filigrane', 'Sauvegarde de vos projets'] },
    { key: 'o', name: 'Dossier complet', price: '69', unit: '€', per: 'par dossier', tag: 'Le plus choisi', highlight: true, cta: 'Générer mon dossier', desc: 'Le dossier prêt à déposer, en ≈ 10 minutes.', features: ['Tout de Découverte, plus :', 'CERFA 16702*03 pré-rempli', 'Pièces DP1 à DP8 assemblées', 'Vues « après » par IA', 'Export PDF & ZIP sans filigrane'] },
    { key: 'p', name: 'Pack Rénovation', price: '179', unit: '€', per: '3 dossiers', tag: '', highlight: false, cta: 'Choisir le pack', desc: 'Plusieurs chantiers ? 59,70 € le dossier.', features: ['Tout de Dossier complet', '3 dossiers, quand vous voulez', 'Modifications illimitées 6 mois', 'Assistance email prioritaire'] },
]

const INCLUDED = ['Analyse PLU incluse', 'Projets sauvegardés', 'Support par email', 'Hébergé en France', 'Sans engagement']

interface FaqItem { id: string; q: string; a: string }
const FAQ: FaqItem[] = [
    { id: 'a1', q: 'Qu’est-ce qu’une déclaration préalable de travaux ?', a: 'C’est l’autorisation d’urbanisme exigée pour les travaux qui modifient l’aspect extérieur d’un bâtiment ou créent une petite surface, sans nécessiter de permis de construire. Elle se dépose en mairie.' },
    { id: 'a3', q: 'Puis-je préparer les dossiers de mes clients ?', a: 'Oui : les offres Pro sont pensées pour les architectes, maîtres d’œuvre et artisans. Multi-clients, exports à votre marque et modifications illimitées.' },
    { id: 'b1', q: 'Combien de temps dure l’instruction ?', a: 'En général un mois à compter du dépôt. Ce délai passe à deux mois lorsque l’avis de l’Architecte des Bâtiments de France est requis.' },
    { id: 'c1', q: 'Le dossier est-il vraiment accepté en mairie ?', a: 'Le dossier reprend le formulaire officiel et les pièces réglementaires DP1 à DP8. Il est conçu pour être déposé tel quel. La décision finale appartient toujours au service instructeur.' },
    { id: 'd1', q: 'Quand dois-je payer ?', a: 'La création, l’analyse PLU et l’aperçu sont gratuits. Le paiement n’intervient qu’au moment de générer le dossier définitif, sans filigrane.' },
]

const fr = (n: number) => Math.round(n).toLocaleString('fr-FR')

export default function MarketingSite({ authed = false }: { authed?: boolean }) {
    const appHref = authed ? '/profil' : '/register'
    // Buy directly — the button leads straight to checkout for that item. You need an
    // account first, so guests are sent to /register?next=<checkout> (destination preserved).
    const buyHref = (dest: string) => authed ? dest : `/register?next=${encodeURIComponent(dest)}`
    const [pricing, setPricing] = useState<'abo' | 'usage'>('abo')
    const [elig, setElig] = useState('menuiseries')
    const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({})
    const [sliderPos, setSliderPos] = useState(52)
    const [simPrice, setSimPrice] = useState('150')
    const [simHours, setSimHours] = useState('2')
    const [simCount, setSimCount] = useState('10')
    const sliderRef = useRef<HTMLDivElement>(null)
    const draggingRef = useRef(false)

    // Before / after comparison slider.
    const posFromX = (clientX: number) => {
        const el = sliderRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setSliderPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)))
    }
    const onDown = (e: React.PointerEvent) => { draggingRef.current = true; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ } posFromX(e.clientX) }
    const onMove = (e: React.PointerEvent) => { if (draggingRef.current) posFromX(e.clientX) }
    const onUp = (e: React.PointerEvent) => { draggingRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ } }

    const toggleFaq = (id: string) => setOpenFaqs((o) => ({ ...o, [id]: !o[id] }))

    // Simulator maths (same engine as the app's Étape 4 ROI figures).
    const num = (v: string) => { const n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : n }
    const sp = num(simPrice), sh = num(simHours), sc = num(simCount)
    const freedH = Math.max(0, sc * sh - sc * (10 / 60))
    // The plan recommended for this volume — adapts live to the "dossiers/mois" input.
    // costLabel/per drive the recommendation banner; `plan` matches a pricing card key.
    const simPlan = sc <= 5
        ? { name: 'Studio', plan: 's', costLabel: '290 € / mois', per: '58 € le dossier' }
        : sc <= 12
            ? { name: 'Cabinet', plan: 'c', costLabel: '620 € / mois', per: '≈ 52 € le dossier' }
            : { name: 'Agence', plan: 'e', costLabel: 'Sur devis', per: 'dès 50 € le dossier' }
    const extraRev = (sh > 0 ? freedH / sh : 0) * sp

    const ev = ELIG[elig] || ELIG.menuiseries
    const plans = pricing === 'abo' ? PLANS_ABO : PLANS_USAGE

    const segStyle = (on: boolean): CSS => ({ padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, transition: 'all .15s', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--muted)', boxShadow: on ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none' })
    const planCardStyle = (highlight: boolean): CSS => ({ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)', border: '1px solid ' + (highlight ? 'var(--ac)' : 'var(--line)'), borderRadius: 18, padding: '30px 26px', boxShadow: highlight ? '0 26px 62px -30px rgba(45,90,76,.55)' : '0 1px 2px rgba(37,34,30,.03),0 16px 36px -28px rgba(37,34,30,.22)' })

    const cellBg = 'var(--acd)'

    return (
        <div id="site" style={s('min-height:100vh;background:var(--paper);color:var(--ink);font-family:\'IBM Plex Sans\',system-ui,sans-serif;overflow-x:hidden')}>
            <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />

            {/* ===================== HEADER ===================== */}
            <header style={s('position:sticky;top:0;z-index:60;background:rgba(241,236,227,.85);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)')}>
                <div data-head style={s('max-width:1160px;margin:0 auto;padding:13px 28px;display:flex;align-items:center;gap:22px')}>
                    <a href="#top" style={s('display:flex;align-items:center;gap:12px;flex-shrink:0;text-decoration:none')}>
                        <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:40px;height:40px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));box-shadow:0 6px 16px -8px rgba(45,90,76,.6);flex-shrink:0')}>
                            <span style={s('font-family:var(--hf);font-weight:600;font-size:19px;line-height:1;letter-spacing:-.03em;color:#fff')}>dp</span>
                            <span style={s('width:14px;height:1.5px;border-radius:2px;background:rgba(255,255,255,.5)')}></span>
                        </div>
                        <div data-logotext style={s('white-space:nowrap')}>
                            <div style={s('font-family:var(--hf);font-size:16px;font-weight:600;line-height:1.05;color:var(--ink)')}>DP Travaux</div>
                            <div data-logosub style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.09em;color:var(--muted);text-transform:uppercase')}>Déclaration préalable</div>
                        </div>
                    </a>
                    <nav data-nav-center style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:30px')}>
                        <a data-nav href="#how" style={s('font-size:14px;font-weight:500;color:var(--ink-2);transition:color .15s;text-decoration:none')}>Comment ça marche</a>
                        <a data-nav href="#pricing" style={s('font-size:14px;font-weight:500;color:var(--ink-2);transition:color .15s;text-decoration:none')}>Tarifs</a>
                        <a data-nav href="#faq" style={s('font-size:14px;font-weight:500;color:var(--ink-2);transition:color .15s;text-decoration:none')}>FAQ</a>
                        <a data-nav href="#contact" style={s('font-size:14px;font-weight:500;color:var(--ink-2);transition:color .15s;text-decoration:none')}>Contact</a>
                    </nav>
                    <div style={s('display:flex;align-items:center;gap:16px;flex-shrink:0')}>
                        {authed ? (
                            <a href="/profil" className="dp-btn-primary" style={s('padding:10px 20px;font-size:14px;text-decoration:none')}>Mon espace</a>
                        ) : (
                            <>
                                <a href="/login" data-nav data-signin style={s('font-size:14px;font-weight:600;color:var(--ink-2);white-space:nowrap;transition:color .15s;text-decoration:none')}>Se connecter</a>
                                <a href="/register" className="dp-btn-primary" style={s('padding:10px 20px;font-size:14px;text-decoration:none')}>Commencer</a>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ===================== HERO ===================== */}
            <section id="top" style={s('position:relative;overflow:hidden;scroll-margin-top:80px')}>
                <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(1100px 460px at 84% -10%,rgba(45,90,76,.12),transparent 58%)')}></div>
                <div data-hero style={s('position:relative;max-width:1160px;margin:0 auto;padding:clamp(56px,7vw,90px) 28px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center')}>
                    <div>
                        <span style={s('display:inline-flex;align-items:center;gap:9px;font-family:var(--mf);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);background:var(--act);border:1px solid var(--acb);padding:7px 14px;border-radius:100px')}>
                            <Ico ds={['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 12m-5.4 0a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0 -10.8 0', 'M9.6 12.1l1.7 1.7 3.1-3.4', 'M12 1.6v1.4M12 21v1.4M1.6 12h1.4M21 12h1.4']} size={15} color="var(--ac)" sw={1.6} />
                            Pour les professionnels de la rénovation
                        </span>
                        <h1 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(38px,5vw,60px);line-height:1.02;letter-spacing:-.02em;margin:22px 0 0;color:var(--ink)')}>Les déclarations de vos clients, <span style={s('font-style:italic;color:var(--ac)')}>prêtes à déposer</span>.</h1>
                        <p style={s('font-size:18px;line-height:1.62;color:var(--ink-2);margin:22px 0 0;max-width:52ch')}>CERFA, plans, photos et notice assemblés en un dossier conforme — avec l&apos;analyse PLU de la parcelle qui évite le refus en mairie. Un dossier complet en ≈ 10 minutes, à votre marque.</p>
                        <div style={s('display:flex;align-items:center;gap:14px;margin-top:32px;flex-wrap:wrap')}>
                            <a href={appHref} className="dp-btn-primary" style={s('padding:14px 26px;font-size:15px;text-decoration:none')}>Essayer 14 jours</a>
                            <a href="#how" className="dp-btn-secondary" style={s('padding:14px 24px;font-size:15px;text-decoration:none')}>Voir comment ça marche</a>
                        </div>
                        <div style={s('display:flex;align-items:center;gap:22px;margin-top:28px;flex-wrap:wrap;font-family:var(--mf);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)')}>
                            <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Sans engagement</span>
                            <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Multi-clients</span>
                            <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Conforme CERFA</span>
                        </div>
                    </div>
                    <div data-hero-visual style={s('position:relative')}>
                        <div style={s('position:relative;max-width:400px;margin:0 auto')}>
                            <div style={s('position:absolute;top:22px;right:-16px;bottom:-14px;left:22px;border-radius:22px;background:var(--act);border:1px solid var(--acb);transform:rotate(2.5deg)')}></div>
                            <div style={s('position:relative;animation:dpFloat 7.5s ease-in-out infinite;background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 46px 88px -44px rgba(37,34,30,.55);overflow:hidden')}>
                                <div style={s('position:relative;height:196px;background:var(--field)')}>
                                    <img src="/test/cache/after-principale.jpg" alt="Maison après travaux déclarés" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 52%' }} />
                                    <span style={s('position:absolute;inset:0;background:linear-gradient(to top,rgba(30,28,24,.82),rgba(30,28,24,.03) 54%)')}></span>
                                    <span className="dp-chip is-ok" style={s('position:absolute;top:13px;right:13px')}>Prêt à déposer</span>
                                    <div style={s('position:absolute;left:17px;right:17px;bottom:13px')}>
                                        <div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.82)')}>Dossier DP · Ravalement + menuiseries</div>
                                        <div style={s('font-family:var(--hf);font-size:18px;font-weight:600;color:#fff;line-height:1.15;margin-top:2px;text-shadow:0 1px 4px rgba(0,0,0,.45)')}>24 Rue des Lilas, Lyon</div>
                                    </div>
                                </div>
                                <div style={s('padding:8px 20px 20px')}>
                                    {[['Analyse PLU · Zone UA', 'Conforme'], ['Pièces DP1 à DP8', '8 / 8'], ['CERFA 16702*03', 'Rempli']].map(([label, val], i) => (
                                        <div key={label}>
                                            {i > 0 && <div style={s('height:1px;background:var(--line-2)')}></div>}
                                            <div style={s('display:flex;align-items:center;gap:12px;padding:12px 0')}>
                                                <span style={s('flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center')}><Check size={13} color="#fff" /></span>
                                                <span style={s('flex:1;font-size:14.5px;font-weight:500;color:var(--ink)')}>{label}</span>
                                                <span style={s('font-family:var(--mf);font-size:11.5px;font-weight:600;color:var(--acd)')}>{val}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={s('margin-top:14px')}>
                                        <div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:10px;letter-spacing:.04em;color:var(--muted);margin-bottom:6px')}><span>DOSSIER COMPLET</span><span style={s('color:var(--acd);font-weight:600')}>100 %</span></div>
                                        <div style={s('height:7px;border-radius:4px;background:var(--line-2);overflow:hidden')}><div style={s('height:100%;width:100%;background:linear-gradient(90deg,var(--ac),var(--acd))')}></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===================== STAT STRIP ===================== */}
            <section style={s('border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface-2)')}>
                <div data-statgrid style={s('max-width:1160px;margin:0 auto;padding:26px 28px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px')}>
                    {[['≈ 10 min', 'Un dossier complet'], ['DP1 → DP8', 'Pièces générées'], ['34 900+', 'Communes couvertes'], ['≈ 52 €', 'Le dossier, plan Cabinet']].map(([v, k], i) => (
                        <div key={k} style={s(`text-align:center${i > 0 ? ';border-left:1px solid var(--line)' : ''}`)}>
                            <div style={s('font-family:var(--mf);font-size:26px;font-weight:600;color:var(--ink);letter-spacing:-.01em')}>{v}</div>
                            <div style={s('font-family:var(--mf);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:5px')}>{k}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===================== PRO BAND ===================== */}
            <section id="pros" style={s('background:var(--acd);color:#fff;scroll-margin-top:70px')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('max-width:620px')}>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8FB3A5')}>Conçu pour les cabinets, artisans et maîtres d&apos;œuvre</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:14px 0 0;color:#fff')}>Le travail administratif fait, <span style={s('font-style:italic;color:#B9D4C9')}>pas le vôtre</span>.</h2>
                    </div>
                    <div data-progrid style={s('margin-top:46px;display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden')}>
                        {PRO_FEATURES.map((f) => (
                            <div key={f.title} style={{ background: cellBg, padding: '32px 28px' }}>
                                <Ico ds={f.ds} size={26} color="#B9D4C9" sw={1.6} />
                                <h3 style={s('font-family:var(--hf);font-size:20px;font-weight:600;margin:16px 0 0;color:#fff')}>{f.title}</h3>
                                <p style={s('font-size:14.5px;line-height:1.6;color:rgba(255,255,255,.72);margin:9px 0 0')}>{f.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===================== HOW ===================== */}
            <section id="how" style={s('scroll-margin-top:70px')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap')}>
                        <div>
                            <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Le parcours</span>
                            <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Quatre étapes, un dossier conforme.</h2>
                        </div>
                        <a data-nav href="#pricing" style={s('font-size:14px;font-weight:600;color:var(--ac);white-space:nowrap;padding-bottom:6px;text-decoration:none')}>Voir les tarifs pro →</a>
                    </div>
                    <div data-howgrid style={s('margin-top:48px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px')}>
                        {STEPS.map((st) => (
                            <div key={st.n} style={s('position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px 24px 22px;box-shadow:0 1px 2px rgba(37,34,30,.03),0 16px 36px -30px rgba(37,34,30,.25);overflow:hidden')}>
                                <div style={s('position:absolute;top:-14px;right:-2px;font-family:var(--hf);font-size:96px;font-weight:400;line-height:1;color:var(--surface-2);pointer-events:none')}>{st.n}</div>
                                <div style={s('position:relative;width:44px;height:44px;border-radius:12px;background:var(--act);border:1px solid var(--acb);display:flex;align-items:center;justify-content:center')}><Ico ds={st.ds} /></div>
                                <h3 style={s('position:relative;font-family:var(--hf);font-size:19px;font-weight:600;margin:16px 0 0;color:var(--ink)')}>{st.title}</h3>
                                <p style={s('position:relative;font-size:14px;line-height:1.55;color:var(--ink-2);margin:8px 0 0')}>{st.body}</p>
                                <div style={s('position:relative;font-family:var(--mf);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ac);margin-top:16px;padding-top:14px;border-top:1px solid var(--line-2)')}>{st.tag}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===================== BEFORE / AFTER ===================== */}
            <section id="insertion" style={s('background:var(--surface);border-top:1px solid var(--line);border-bottom:1px solid var(--line);scroll-margin-top:70px')}>
                <div data-ba style={s('max-width:1160px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px;display:grid;grid-template-columns:.9fr 1.1fr;gap:56px;align-items:center')}>
                    <div>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Pièce DP6 · Insertion</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Des vues « après » <span style={s('font-style:italic;color:var(--ac)')}>générées par IA</span>.</h2>
                        <p style={s('font-size:16px;line-height:1.62;color:var(--ink-2);margin:16px 0 0;max-width:44ch')}>À partir des photos du terrain, DP Travaux produit l&apos;insertion paysagère du projet — la pièce la plus délicate à réaliser à la main. Faites glisser pour comparer.</p>
                        <div style={s('display:flex;gap:14px;margin-top:24px')}>
                            <div style={s('display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink-2)')}><span style={s('width:9px;height:9px;border-radius:2px;background:var(--line-3)')}></span>Avant</div>
                            <div style={s('display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink-2)')}><span style={s('width:9px;height:9px;border-radius:2px;background:var(--ac)')}></span>Après (projet)</div>
                        </div>
                    </div>
                    <div ref={sliderRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={s('position:relative;aspect-ratio:1/1;border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 30px 60px -40px rgba(37,34,30,.5);cursor:ew-resize;touch-action:none;user-select:none')}>
                        <img src="/test/facade-principale.jpg" alt="Façade avant travaux" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${sliderPos}%)` }}>
                            <img src="/test/cache/after-principale.jpg" alt="Façade après travaux" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        </div>
                        <span style={s('position:absolute;top:13px;left:13px;font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:rgba(30,28,24,.55);padding:5px 10px;border-radius:100px')}>Avant</span>
                        <span style={s('position:absolute;top:13px;right:13px;font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--ac);padding:5px 10px;border-radius:100px')}>Après</span>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2, background: '#fff', transform: 'translateX(-1px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={s('width:38px;height:38px;border-radius:50%;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l-4 6 4 6M15 6l4 6-4 6" /></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===================== ELIGIBILITY ===================== */}
            <section id="elig" style={s('scroll-margin-top:70px')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('text-align:center;max-width:640px;margin:0 auto')}>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Éligibilité</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Ce projet nécessite-t-il une déclaration ?</h2>
                        <p style={s('font-size:16px;line-height:1.6;color:var(--ink-2);margin:14px 0 0')}>Choisissez un type de travaux pour voir le régime applicable et le délai d&apos;instruction.</p>
                    </div>
                    <div data-elig style={s('margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start')}>
                        <div data-eligtiles style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:12px')}>
                            {ELIG_KEYS.map((k) => {
                                const on = k === elig
                                return (
                                    <button key={k} onClick={() => setElig(k)} style={{ position: 'relative', overflow: 'hidden', height: 112, borderRadius: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit', background: 'var(--act)', border: '2px solid ' + (on ? 'var(--ac)' : 'transparent'), outline: on ? 'none' : '1px solid var(--line)', boxShadow: on ? '0 16px 30px -16px rgba(45,90,76,.6)' : '0 1px 3px rgba(37,34,30,.08)', transform: on ? 'translateY(-3px)' : 'none', transition: 'all .16s ease' }}>
                                        <span style={s('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px')}>{ELIG[k].emoji}</span>
                                        <img src={ELIG[k].img} alt={ELIG[k].label} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <span style={s('position:absolute;inset:0;background:linear-gradient(to top,rgba(28,26,22,.82),rgba(28,26,22,.15) 55%,rgba(28,26,22,.02))')}></span>
                                        <span style={s('position:absolute;left:10px;right:10px;bottom:9px;font-size:12.5px;font-weight:600;color:#fff;text-align:left;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.6)')}>{ELIG[k].label}</span>
                                        <span style={{ position: 'absolute', top: 9, right: 9, width: 22, height: 22, borderRadius: '50%', display: on ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', background: 'var(--ac)', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }}><Check size={12} color="#fff" sw={3.4} /></span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="dp-card dp-spec" style={s('padding:30px 28px')}>
                            <div style={s('display:flex;align-items:center;gap:14px')}>
                                <div style={s('font-size:30px;line-height:1')}>{ev.emoji}</div>
                                <div>
                                    <div style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink);line-height:1.1')}>{ev.label}</div>
                                    <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:3px')}>Type de travaux</div>
                                </div>
                            </div>
                            <div data-eligmetrics style={s('display:flex;gap:12px;margin-top:22px;flex-wrap:wrap')}>
                                <div className="dp-metric is-accent" style={s('flex:1 1 140px')}><div className="val">{ev.verdict}</div><span className="key">Régime</span></div>
                                <div className="dp-metric" style={s('flex:0 0 auto;min-width:120px')}><div className="val">{ev.delai}</div><span className="key">Instruction</span></div>
                            </div>
                            <p style={s('font-size:15px;line-height:1.6;color:var(--ink-2);margin:20px 0 0')}>{ev.note}</p>
                            <a href={appHref} className="dp-btn-primary" style={s('margin-top:22px;padding:12px 22px;font-size:14px;text-decoration:none')}>Préparer ce dossier →</a>
                        </div>
                    </div>
                    <p style={s('text-align:center;font-family:var(--mf);font-size:11px;color:var(--faint);margin:26px 0 0')}>Informations à titre indicatif — le régime exact dépend du PLU de votre commune.</p>
                </div>
            </section>

            {/* ===================== TESTIMONIALS ===================== */}
            <section style={s('background:var(--surface-2);border-top:1px solid var(--line);border-bottom:1px solid var(--line)')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(56px,7vw,90px) 28px')}>
                    <div data-testi style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:24px')}>
                        {TESTIMONIALS.map((q) => (
                            <figure key={q.name} className="dp-card" style={s('margin:0;display:flex;flex-direction:column;padding:28px 26px')}>
                                <div style={s('font-family:var(--hf);font-size:38px;line-height:.6;color:var(--acb)')}>&ldquo;</div>
                                <blockquote style={s('flex:1;margin:10px 0 0;font-size:15.5px;line-height:1.6;color:var(--ink)')}>{q.quote}</blockquote>
                                <figcaption style={s('display:flex;align-items:center;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid var(--line-2)')}>
                                    <img src={q.avatar} alt={q.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div>
                                        <div style={s('font-weight:600;font-size:14.5px;color:var(--ink)')}>{q.name}</div>
                                        <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.03em;color:var(--muted)')}>{q.meta}</div>
                                    </div>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===================== CONVERSION (simulator) ===================== */}
            <section style={s('scroll-margin-top:70px')}>
                <div style={s('max-width:1000px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('text-align:center;max-width:620px;margin:0 auto')}>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Votre rentabilité</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Combien DP Travaux <span style={s('font-style:italic;color:var(--ac)')}>vous fait gagner</span>.</h2>
                        <p style={s('font-size:16px;line-height:1.6;color:var(--ink-2);margin:14px 0 0')}>Renseignez vos chiffres — chaque dossier passe de plusieurs heures à ≈ 10 minutes.</p>
                    </div>
                    <div data-sim className="dp-card dp-spec" style={s('margin-top:40px;padding:clamp(28px,4vw,40px) clamp(24px,4vw,36px)')}>
                        <div data-simform style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:22px')}>
                            <div>
                                <label className="dp-label">Ce que vous facturez / dossier</label>
                                <div style={s('position:relative')}>
                                    <input type="number" className="dp-input" min="0" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={s('padding-right:36px')} />
                                    <span style={s('position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none')}>€</span>
                                </div>
                            </div>
                            <div>
                                <label className="dp-label">Temps par dossier aujourd&apos;hui</label>
                                <div style={s('position:relative')}>
                                    <input type="number" className="dp-input" min="0" step="0.5" value={simHours} onChange={(e) => setSimHours(e.target.value)} style={s('padding-right:36px')} />
                                    <span style={s('position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none')}>h</span>
                                </div>
                            </div>
                            <div>
                                <label className="dp-label">Dossiers par mois</label>
                                <input type="number" className="dp-input" min="0" value={simCount} onChange={(e) => setSimCount(e.target.value)} />
                            </div>
                        </div>
                        <div style={s('height:1px;background:var(--line-2);margin:28px 0')}></div>
                        <div data-simmetrics style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:16px')}>
                            <div className="dp-metric"><div className="val">{fr(sc)}</div><span className="key">Dossiers / mois</span></div>
                            <div className="dp-metric"><div className="val">{fr(freedH)} h</div><span className="key">Temps libéré / mois</span></div>
                            <div className="dp-metric is-accent"><div className="val">+ {fr(extraRev)} €</div><span className="key">CA possible en plus</span></div>
                        </div>

                        {/* Adaptive recommendation — the plan follows the "dossiers / mois" input. */}
                        <a href="#pricing" onClick={() => setPricing('abo')} data-simreco style={s('margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,var(--ac),var(--acd));border-radius:14px;padding:18px 22px;text-decoration:none')}>
                            <div style={s('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
                                <span style={s('display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);color:#fff;font-family:var(--mf);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px;border-radius:100px;white-space:nowrap')}>
                                    <Check size={12} color="#fff" sw={3} /> Recommandé pour vous
                                </span>
                                <div>
                                    <div style={s('font-family:var(--hf);font-size:21px;font-weight:600;color:#fff;line-height:1.1')}>Offre {simPlan.name}</div>
                                    <div style={s('font-size:13.5px;color:rgba(255,255,255,.82);margin-top:2px')}>{simPlan.costLabel} · {simPlan.per} — pour {fr(sc)} dossier{sc > 1 ? 's' : ''}/mois</div>
                                </div>
                            </div>
                            <span style={s('display:inline-flex;align-items:center;gap:7px;background:#fff;color:var(--acd);font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;white-space:nowrap')}>Voir l&apos;offre →</span>
                        </a>
                    </div>
                    <p style={s('text-align:center;font-family:var(--mf);font-size:11px;color:var(--faint);margin:24px 0 0')}>Le temps libéré est valorisé à votre tarif horaire. Estimations à titre indicatif.</p>
                </div>
            </section>

            {/* ===================== PRICING ===================== */}
            <section id="pricing" style={s('scroll-margin-top:70px')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('text-align:center;max-width:640px;margin:0 auto')}>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Tarifs</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Un abonnement qui suit votre volume.</h2>
                    </div>
                    <div style={s('display:flex;justify-content:center;margin-top:26px')}>
                        <div style={s('display:inline-flex;padding:5px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line)')}>
                            <button onClick={() => setPricing('abo')} style={segStyle(pricing === 'abo')}>Professionnels</button>
                            <button onClick={() => setPricing('usage')} style={segStyle(pricing === 'usage')}>À l&apos;usage</button>
                        </div>
                    </div>
                    <div data-pricegrid style={s('margin-top:40px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;align-items:stretch')}>
                        {plans.map((p) => (
                            <div key={p.key} style={planCardStyle(p.highlight)}>
                                {p.tag && <span style={s('position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--ac);color:#fff;font-family:var(--mf);font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:5px 13px;border-radius:100px;white-space:nowrap')}>{p.tag}</span>}
                                <div style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink)')}>{p.name}</div>
                                <p style={s('font-size:13.5px;line-height:1.5;color:var(--ink-2);margin:6px 0 0;min-height:40px')}>{p.desc}</p>
                                <div style={s('display:flex;align-items:baseline;gap:6px;margin:18px 0 0')}>
                                    <span style={{ fontFamily: 'var(--hf)', fontSize: p.price === 'Sur devis' ? 26 : 38, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{p.price}</span>
                                    <span style={s('font-size:18px;color:var(--muted)')}>{p.unit}</span>
                                    <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.04em;color:var(--muted);margin-left:4px')}>{p.per}</span>
                                </div>
                                <div style={s('height:1px;background:var(--line-2);margin:20px 0')}></div>
                                <ul style={s('list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px;flex:1')}>
                                    {p.features.map((f) => (
                                        <li key={f} style={s('display:flex;gap:10px;font-size:14px;line-height:1.45;color:var(--ink-2)')}>
                                            <span style={s('flex-shrink:0;margin-top:2px')}><Check size={16} sw={2.4} /></span><span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                {(() => {
                                    const cls = p.highlight ? 'dp-btn-primary' : 'dp-btn-secondary'
                                    const st = s('margin-top:24px;justify-content:center;width:100%;padding:12px;text-decoration:none')
                                    // Subscriptions → checkout with the plan; Agence → contact.
                                    // One-off (Dossier 69 / Pack 179) → add to cart; Découverte → free sign-up.
                                    if (pricing === 'abo') {
                                        if (p.key === 'e') return <a href="#contact" className={cls} style={st}>{p.cta}</a>
                                        const dest = p.key === 's' ? '/checkout?plan=studio' : '/checkout?plan=cabinet'
                                        return <a href={buyHref(dest)} className={cls} style={st}>{p.cta}</a>
                                    }
                                    if (p.key === 'o' || p.key === 'p') {
                                        const sku: SkuId = p.key === 'o' ? 'dossier' : 'pack'
                                        return <a href={buyHref(`/checkout?sku=${sku}`)} className={cls} style={st}>{p.cta}</a>
                                    }
                                    return <a href={appHref} className={cls} style={st}>{p.cta}</a>
                                })()}
                            </div>
                        ))}
                    </div>
                    <div style={s('display:flex;justify-content:center;flex-wrap:wrap;gap:22px;margin-top:34px')}>
                        {INCLUDED.map((inc) => (
                            <span key={inc} style={s('display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink-2)')}><Check size={14} sw={2.4} />{inc}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===================== FAQ ===================== */}
            <section id="faq" style={s('background:var(--surface);border-top:1px solid var(--line);scroll-margin-top:70px')}>
                <div style={s('max-width:820px;margin:0 auto;padding:clamp(60px,8vw,104px) 28px')}>
                    <div style={s('text-align:center')}>
                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)')}>Questions fréquentes</span>
                        <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.6vw,42px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 26px;color:var(--ink)')}>Tout ce qu&apos;il faut savoir.</h2>
                    </div>
                    {FAQ.map((f) => {
                        const open = !!openFaqs[f.id]
                        return (
                            <div key={f.id} style={{ borderRadius: 13, border: '1px solid ' + (open ? 'var(--acb)' : 'var(--line)'), background: open ? 'var(--act)' : 'var(--surface)', marginBottom: 10, overflow: 'hidden', transition: 'background .2s ease,border-color .2s ease', boxShadow: open ? '0 12px 28px -18px rgba(45,90,76,.42)' : '0 1px 2px rgba(37,34,30,.03)' }}>
                                <button onClick={() => toggleFaq(f.id)} style={s('display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;text-align:left;cursor:pointer;background:transparent;border:none;font-family:inherit;padding:17px 20px')}>
                                    <span style={{ fontFamily: 'var(--hf)', fontSize: 16.5, fontWeight: 600, lineHeight: 1.3, color: open ? 'var(--acd)' : 'var(--ink)', transition: 'color .2s ease' }}>{f.q}</span>
                                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (open ? 'var(--ac)' : 'var(--line-3)'), background: open ? 'var(--ac)' : 'var(--surface-2)', color: open ? '#fff' : 'var(--muted)', fontSize: 18, lineHeight: 1, transition: 'all .2s ease', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
                                </button>
                                <div style={{ overflow: 'hidden', maxHeight: open ? 360 : 0, opacity: open ? 1 : 0, transition: 'max-height .35s ease,opacity .3s ease' }}>
                                    <div style={s('padding:0 20px 17px;font-size:15px;line-height:1.6;color:var(--ink-2)')}>{f.a}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* ===================== FINAL CTA ===================== */}
            <section id="contact" style={s('background:var(--acd);color:#fff;scroll-margin-top:70px')}>
                <div style={s('max-width:1160px;margin:0 auto;padding:clamp(64px,9vw,120px) 28px;text-align:center')}>
                    <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8FB3A5')}>Prêt à gagner du temps ?</span>
                    <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(32px,4.4vw,52px);line-height:1.05;letter-spacing:-.02em;margin:14px auto 0;color:#fff;max-width:16ch')}>Votre prochain dossier, prêt <span style={s('font-style:italic;color:#B9D4C9')}>avant la pause déjeuner</span>.</h2>
                    <div style={s('display:flex;align-items:center;justify-content:center;gap:14px;margin-top:34px;flex-wrap:wrap')}>
                        <a href={appHref} style={s('background:#fff;color:var(--acd);font-weight:600;font-size:15px;padding:14px 28px;border-radius:12px;display:inline-flex;align-items:center;gap:8px;text-decoration:none')}>Essayer 14 jours gratuits</a>
                        <a href="mailto:contact@dptravaux.fr" style={s('border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px;text-decoration:none')}>Parler à l&apos;équipe</a>
                    </div>
                    <p style={s('font-family:var(--mf);font-size:11px;letter-spacing:.05em;color:rgba(255,255,255,.55);margin:22px 0 0')}>Sans engagement · Résiliable en un clic · Hébergé en France</p>
                </div>
            </section>

            {/* ===================== FOOTER ===================== */}
            <footer style={s('background:var(--paper);border-top:1px solid var(--line)')}>
                <div data-foot style={s('max-width:1160px;margin:0 auto;padding:44px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap')}>
                    <div style={s('display:flex;align-items:center;gap:12px')}>
                        <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:36px;height:36px;border-radius:10px;background:linear-gradient(155deg,var(--ac),var(--acd))')}>
                            <span style={s('font-family:var(--hf);font-weight:600;font-size:17px;line-height:1;letter-spacing:-.03em;color:#fff')}>dp</span>
                            <span style={s('width:12px;height:1.5px;border-radius:2px;background:rgba(255,255,255,.5)')}></span>
                        </div>
                        <div>
                            <div style={s('font-family:var(--hf);font-size:15px;font-weight:600;color:var(--ink)')}>DP Travaux</div>
                            <div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;color:var(--muted)')}>Service privé, non affilié à l&apos;administration</div>
                        </div>
                    </div>
                    <div style={s('display:flex;align-items:center;gap:26px;flex-wrap:wrap')}>
                        <a data-nav href="#how" style={s('font-size:13.5px;color:var(--ink-2);text-decoration:none')}>Comment ça marche</a>
                        <a data-nav href="#pricing" style={s('font-size:13.5px;color:var(--ink-2);text-decoration:none')}>Tarifs</a>
                        <a data-nav href="#faq" style={s('font-size:13.5px;color:var(--ink-2);text-decoration:none')}>FAQ</a>
                        <a data-nav href="/login" style={s('font-size:13.5px;color:var(--ink-2);text-decoration:none')}>Se connecter</a>
                    </div>
                </div>
                <div style={s('border-top:1px solid var(--line-2)')}><div style={s('max-width:1160px;margin:0 auto;padding:16px 28px;font-family:var(--mf);font-size:10.5px;letter-spacing:.04em;color:var(--faint)')}>© 2026 DP Travaux — Déclaration préalable de travaux en ligne.</div></div>
            </footer>
        </div>
    )
}

// Scoped styles: smooth-scroll anchoring, the hero card float, nav hover, and the
// responsive breakpoints that stack the design's fixed grids on small screens.
const SITE_CSS = `
#site{scroll-behavior:smooth}
html{scroll-behavior:smooth}
@keyframes dpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
#site [data-nav]:hover{color:var(--ac)!important}
/* Simulator: readable, characterful captions (Spectral italic) instead of tiny mono caps */
#site [data-sim] .dp-label{font-family:var(--hf);font-style:italic;font-weight:500;font-size:14.5px;letter-spacing:0;text-transform:none;color:var(--ink-2)}
#site [data-sim] .dp-metric .key{font-family:var(--hf);font-style:italic;font-weight:500;font-size:13.5px;letter-spacing:0;text-transform:none;color:var(--muted);margin-top:6px}
#site [data-sim] .dp-metric .val{font-size:24px}
#site [data-simreco]{transition:transform .16s ease,box-shadow .16s ease}
#site [data-simreco]:hover{transform:translateY(-2px);box-shadow:0 20px 40px -22px rgba(45,90,76,.7)}
@media (prefers-reduced-motion:reduce){#site [style*="dpFloat"]{animation:none!important}}
@media (max-width:900px){
  #site [data-hero]{grid-template-columns:1fr!important;gap:40px!important}
  #site [data-hero-visual]{display:none!important}
  #site [data-pricegrid]{grid-template-columns:1fr!important;max-width:420px;margin-left:auto;margin-right:auto}
}
@media (max-width:860px){
  #site [data-ba]{grid-template-columns:1fr!important;gap:36px!important}
  #site [data-elig]{grid-template-columns:minmax(0,1fr)!important}
}
@media (max-width:820px){
  #site [data-nav-center]{display:none!important}
  #site [data-progrid]{grid-template-columns:1fr!important}
  #site [data-howgrid]{grid-template-columns:repeat(2,1fr)!important}
  #site [data-testi]{grid-template-columns:1fr!important}
}
@media (max-width:640px){
  #site [data-statgrid]{grid-template-columns:repeat(2,1fr)!important;gap:20px 12px!important}
  #site [data-statgrid] > div{border-left:none!important}
  #site [data-simform]{grid-template-columns:1fr!important}
  #site [data-simmetrics]{grid-template-columns:1fr!important}
  #site [data-simreco]{flex-direction:column;align-items:flex-start!important}
  #site [data-howgrid]{grid-template-columns:1fr!important}
  #site [data-foot]{justify-content:flex-start!important}
  #site [data-eligtiles]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
/* Header: keep the logo + primary CTA on one line on phones. */
@media (max-width:560px){
  #site [data-head]{padding-left:16px!important;padding-right:16px!important;gap:12px!important}
  #site [data-logosub]{display:none!important}
  #site [data-signin]{display:none!important}
}
@media (max-width:400px){
  #site [data-logotext]{display:none!important}
}
@media (max-width:600px){
  #site [data-hero] .dp-btn-primary,#site [data-hero] .dp-btn-secondary{flex:1 1 100%!important;justify-content:center}
}
`
