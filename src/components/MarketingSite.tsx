'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Public marketing site — the warm-paper "Architect's Dossier" landing experience.
// Ported from the Claude Design prototype "DP Travaux - Site.dc.html".
// Five client-routed pages: Accueil · Comment ça marche · Tarifs · FAQ · Contact.
// Reuses the app's SealIcon + AddressAutocomplete and the dp-* design-system classes.
// CTAs lead into the authenticated app: "Commencer" → /register, "Se connecter" → /login.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import SealIcon from '@/components/SealIcon'
import AddressAutocomplete from '@/components/AddressAutocomplete'

// Entry points into the app. Guests are sent to registration; authenticated
// visitors go straight to their space (/profil). See `appHref` inside the component.
const SIGNIN_HREF = '/login'

type Page = 'home' | 'how' | 'pricing' | 'faq' | 'contact'
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

const Check = ({ size = 13, color = 'var(--ac)', sw = 2.6 }: { size?: number; color?: string; sw?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

// ── Static content ───────────────────────────────────────────────────────────
const HERO_DOCS = [
    { code: 'DP1', bg: 'radial-gradient(circle at 50% 55%, var(--acb) 0 5px, transparent 6px), repeating-linear-gradient(0deg,var(--line-2) 0 1px,transparent 1px 9px), repeating-linear-gradient(90deg,var(--line-2) 0 1px,transparent 1px 9px)' },
    { code: 'DP2', bg: 'linear-gradient(135deg,#E6EDE9,#DCE6E0)' },
    { code: 'DP5', bg: 'repeating-linear-gradient(90deg,var(--field) 0 9px,var(--line-2) 9px 11px)' },
    { code: 'DP7', bg: 'repeating-linear-gradient(45deg,#EFEAE0,#EFEAE0 6px,#F5F1E9 6px,#F5F1E9 12px)' },
]

const STATS = [
    { val: '18 400', label: 'Dossiers générés' },
    { val: '97 %', label: 'Jugés recevables' },
    { val: '22 min', label: 'Temps moyen' },
    { val: '34 900', label: 'Communes couvertes' },
]

const PAINS = [
    'Trouver le bon formulaire CERFA et le décrypter',
    'Comprendre le règlement du PLU de sa commune',
    'Réaliser des plans et une notice descriptive',
    'Deviner quelles pièces DP joindre au dossier',
    'Risquer un refus… et tout recommencer',
]
const GAINS = [
    'Un parcours guidé, champ après champ',
    'L\'analyse PLU automatique de votre parcelle',
    'Plans, vues et notice générés pour vous',
    'Les pièces DP1 à DP8 réunies automatiquement',
    'Un dossier conforme, prêt à déposer',
]

const STEPS_OVERVIEW = [
    { n: '1', title: 'Décrivez', body: 'Le demandeur, le terrain et la nature exacte de vos travaux.' },
    { n: '2', title: 'Vérifiez', body: 'L\'analyse PLU repère les contraintes et les secteurs protégés.' },
    { n: '3', title: 'Générez', body: 'Le CERFA, les pièces DP1 à DP8 et les vues d\'insertion IA.' },
    { n: '4', title: 'Déposez', body: 'En ligne ou en mairie, avec le guide de dépôt fourni.' },
]

const FEATURES = [
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3.1 7.7-7 9-3.9-1.3-7-4.4-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>, title: 'Analyse PLU automatique', body: 'Nous croisons le règlement d\'urbanisme de votre parcelle avec votre projet, pour repérer les non-conformités avant la mairie.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h5" /></svg>, title: 'Formulaire CERFA pré-rempli', body: 'Le 13703*11 rempli au bon endroit à partir de vos réponses, sans jargon administratif ni case oubliée.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z" /><path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" /></svg>, title: 'Vues « après » par IA', body: 'L\'insertion paysagère générée façade par façade à partir de vos photos, pour la pièce DP6.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 16.5l9 5 9-5" /></svg>, title: 'Toutes les pièces réunies', body: 'DP1 à DP8 assemblées dans un dossier unique, prêt à imprimer ou à déposer en ligne.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-5 9 5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18" /></svg>, title: 'Secteurs protégés & ABF', body: 'Détection des sites patrimoniaux, monuments historiques et avis obligatoires de l\'Architecte des Bâtiments de France.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6" /><path d="M4 20l1.2-4.2L16.5 4.5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8.2 18.8 4 20z" /></svg>, title: 'Notice rédigée pour vous', body: 'La pièce DP4 rédigée automatiquement à partir de la nature de vos travaux et des matériaux choisis.' },
]

const STEPS_DETAIL = [
    { n: '1', title: 'Le demandeur', tag: '≈ 2 min', body: 'Vos coordonnées et votre qualité : particulier, mandataire ou société.', bullets: ['État civil et adresse', 'Société ou co-déclarant', 'Pré-rempli d\'une fois sur l\'autre'] },
    { n: '2', title: 'Le terrain', tag: '≈ 2 min', body: 'L\'adresse et les références cadastrales du terrain concerné.', bullets: ['Recherche d\'adresse officielle', 'Parcelle, section, superficie', 'Report du cadastre'] },
    { n: '3', title: 'Les travaux', tag: '≈ 5 min', body: 'La nature exacte de votre projet et ses caractéristiques techniques.', bullets: ['Menuiseries, ITE, solaire…', 'Matériaux, teintes RAL', 'Surfaces existantes et créées'] },
    { n: '4', title: 'L\'analyse PLU', tag: 'Automatique', body: 'La vérification de conformité qui évite le refus en mairie.', bullets: ['Règlement de votre zone', 'Détection SPR, ABF', 'Matériaux autorisés / interdits'] },
    { n: '5', title: 'Les photos', tag: '≈ 3 min', body: 'Les vues du terrain exigées par le formulaire CERFA.', bullets: ['Pièces DP7 et DP8', 'Cadrage guidé', 'Vues « après » par IA'] },
    { n: '6', title: 'Les plans', tag: 'Générés', body: 'Les documents graphiques réglementaires et la notice.', bullets: ['DP1, DP2, DP3', 'Notice descriptive DP4', 'Insertion par façade'] },
    { n: '7', title: 'La génération', tag: 'Le livrable', body: 'Votre dossier complet, vérifié et prêt à déposer.', bullets: ['CERFA 13703*11 rempli', 'Toutes les pièces (PDF/ZIP)', 'Guide de dépôt en mairie'] },
]

const REQ_RED = s('font-size:11px;color:#B4442F;font-weight:600')
const REQ_MUTED = s('font-size:11px;color:var(--muted);font-weight:600')
const PIECES = [
    { code: 'DP1', name: 'Plan de situation', desc: 'Localise le terrain dans la commune.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP2', name: 'Plan de masse', desc: 'Le terrain vu du dessus, avant / après.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP3', name: 'Plan de coupe', desc: 'Le profil du terrain et du bâti.', req: 'Selon projet', reqStyle: REQ_MUTED },
    { code: 'DP4', name: 'Notice descriptive', desc: 'Décrit le projet et les matériaux.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP5', name: 'Plan des façades', desc: 'Les façades et toitures modifiées.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP6', name: 'Insertion', desc: 'Le projet inséré dans son cadre.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP7', name: 'Photo proche', desc: 'L\'environnement immédiat du terrain.', req: 'Requis', reqStyle: REQ_RED },
    { code: 'DP8', name: 'Photo lointaine', desc: 'Le terrain dans le paysage.', req: 'Requis', reqStyle: REQ_RED },
]

const DEPOSE_STEPS = [
    { n: '1', title: 'Dépôt', body: 'En ligne, en mairie ou en recommandé, en 1 ou plusieurs exemplaires.' },
    { n: '2', title: 'Récépissé', body: 'Numéro de dossier et date de départ du délai d\'instruction.' },
    { n: '3', title: 'Instruction', body: 'Un mois en général, deux mois avec avis de l\'ABF.' },
    { n: '4', title: 'Décision', body: 'Acceptation (parfois tacite) ou demande de pièces complémentaires.' },
]

const TESTIMONIALS = [
    { quote: 'Je pensais devoir payer un architecte pour changer mes fenêtres. Dossier déposé le week-end, accepté en trois semaines.', name: 'Camille R.', meta: 'Propriétaire · Lyon 3e', initial: 'C' },
    { quote: 'Je génère les déclarations de mes clients en quinze minutes. L\'analyse PLU nous a déjà évité deux refus.', name: 'Karim B.', meta: 'Menuisier · Villeurbanne', initial: 'K' },
    { quote: 'La palette imposée en secteur ABF était signalée dès l\'analyse. On a corrigé la teinte avant de déposer.', name: 'Sophie & Marc', meta: 'Rénovation · Bordeaux', initial: 'S' },
]

const ELIG_MAP: Record<string, { label: string; emoji: string; verdict: string; delai: string; note: string }> = {
    menuiseries: { label: 'Menuiseries', emoji: '🪟', verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Changer des fenêtres, portes ou volets modifie l\'aspect extérieur : une déclaration préalable est requise.' },
    ite: { label: 'Isolation extérieure', emoji: '🧱', verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'L\'isolation par l\'extérieur change l\'aspect des façades : la déclaration préalable est obligatoire.' },
    solaire: { label: 'Panneaux solaires', emoji: '☀️', verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Panneaux posés en toiture : DP requise (permis si construction neuve ou secteur protégé).' },
    cloture: { label: 'Clôture & portail', emoji: '🚪', verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Selon la commune, une DP est souvent exigée pour une clôture ou un portail sur rue.' },
    abri: { label: 'Abri de jardin', emoji: '🏡', verdict: 'DP de 5 à 20 m²', delai: '≈ 1 mois', note: 'Emprise ≤ 5 m² : aucune formalité. De 5 à 20 m² : déclaration préalable. Au-delà : permis.' },
    piscine: { label: 'Piscine', emoji: '🏊', verdict: 'DP de 10 à 100 m²', delai: '≈ 1 mois', note: 'Bassin de 10 à 100 m² non couvert : déclaration préalable.' },
    ravalement: { label: 'Ravalement', emoji: '🎨', verdict: 'Selon la commune', delai: '≈ 1 mois', note: 'Obligatoire en secteur protégé ou lorsque la commune l\'impose par délibération.' },
    veranda: { label: 'Véranda', emoji: '🌿', verdict: 'DP jusqu\'à 20 m²', delai: '1 à 2 mois', note: 'Emprise ou surface ≤ 20 m² : déclaration préalable. Au-delà : permis de construire.' },
}
const ELIG_KEYS = ['menuiseries', 'ite', 'solaire', 'cloture', 'abri', 'piscine', 'ravalement', 'veranda']

interface Plan { key: string; name: string; price: string; unit: string; per: string; tag: string; highlight: boolean; kind: 'primary' | 'secondary'; cta: string; desc: string; features: string[] }
const PLANS_USAGE: Plan[] = [
    { key: 'd', name: 'Découverte', price: '0', unit: '€', per: 'pour toujours', tag: '', highlight: false, kind: 'secondary', cta: 'Commencer', desc: 'Pour créer et vérifier votre dossier, sans payer.', features: ['Parcours guidé complet', 'Analyse PLU de votre parcelle', 'Aperçu du CERFA et des pièces', 'Mode test avec filigrane', 'Sauvegarde de vos projets'] },
    { key: 'o', name: 'Dossier complet', price: '59', unit: '€', per: 'par dossier', tag: 'Le plus choisi', highlight: true, kind: 'primary', cta: 'Générer mon dossier', desc: 'Le dossier prêt à déposer en mairie.', features: ['Tout de Découverte, plus :', 'CERFA 13703*11 pré-rempli', 'Pièces DP1 à DP8 assemblées', 'Vues « après » générées par IA', 'Notice descriptive rédigée', 'Export PDF & ZIP sans filigrane', '1 série de modifications incluse'] },
    { key: 'p', name: 'Pack Rénovation', price: '149', unit: '€', per: '3 dossiers', tag: '', highlight: false, kind: 'secondary', cta: 'Choisir le pack', desc: 'Plusieurs chantiers ? Économisez.', features: ['Tout de Dossier complet', '3 dossiers, quand vous voulez', 'Modifications illimitées 6 mois', 'Assistance par email prioritaire'] },
]
const PLANS_ABO: Plan[] = [
    { key: 'd', name: 'Découverte', price: '0', unit: '€', per: 'pour toujours', tag: '', highlight: false, kind: 'secondary', cta: 'Commencer', desc: 'Pour essayer le service.', features: ['Parcours guidé complet', 'Analyse PLU de votre parcelle', 'Aperçu du CERFA et des pièces', 'Mode test avec filigrane'] },
    { key: 'm', name: 'Pro Mensuel', price: '39', unit: '€', per: 'par mois', tag: 'Sans engagement', highlight: true, kind: 'primary', cta: 'Essayer 14 jours', desc: 'Pour artisans, architectes et agences.', features: ['Dossiers illimités', 'Multi-projets et multi-clients', 'Exports à votre marque', 'Modèles de notices réutilisables', 'Support prioritaire', 'Facturation mensuelle'] },
    { key: 'a', name: 'Pro Annuel', price: '390', unit: '€', per: 'par an', tag: '2 mois offerts', highlight: false, kind: 'secondary', cta: 'Passer à l\'annuel', desc: 'Le tarif Pro le plus avantageux.', features: ['Tout de Pro Mensuel', '2 mois offerts', 'Accès anticipé aux nouveautés', 'Un interlocuteur dédié'] },
]

const INCLUDED = ['Analyse PLU incluse', 'Projets sauvegardés', 'Support par email', 'Hébergé en France', 'Sans engagement']

const CMP_RAW: [string, string, string, string][] = [
    ['Parcours guidé et sauvegarde', 'y', 'y', 'y'],
    ['Analyse PLU de la parcelle', 'y', 'y', 'y'],
    ['Aperçu du CERFA et des pièces', 'y', 'y', 'y'],
    ['Export sans filigrane', 'n', 'y', 'y'],
    ['Pièces DP1 à DP8 assemblées', 'n', 'y', 'y'],
    ['Vues « après » par IA', 'n', 'y', 'y'],
    ['Modifications du dossier', 'n', '1 série', 'Illimitées'],
    ['Multi-projets et marque perso.', 'n', 'n', 'y'],
    ['Support', 'Email', 'Email', 'Prioritaire'],
]

interface FaqItem { id: string; q: string; a: string }
const FAQ_DATA: { title: string; items: FaqItem[] }[] = [
    { title: 'La déclaration préalable', items: [
        { id: 'a1', q: 'Qu\'est-ce qu\'une déclaration préalable de travaux ?', a: 'C\'est l\'autorisation d\'urbanisme exigée pour les travaux qui modifient l\'aspect extérieur d\'un bâtiment ou créent une petite surface, sans nécessiter de permis de construire. Elle se dépose en mairie.' },
        { id: 'a2', q: 'Quels travaux nécessitent une DP ?', a: 'Le remplacement de menuiseries, l\'isolation par l\'extérieur, les panneaux solaires, une clôture, un abri de jardin de 5 à 20 m², une piscine de 10 à 100 m², ou un ravalement en secteur protégé.' },
        { id: 'a3', q: 'Ai-je besoin d\'un architecte ?', a: 'Non. La déclaration préalable ne requiert pas d\'architecte. DP Travaux vous permet de constituer vous-même un dossier complet et conforme.' },
        { id: 'a4', q: 'Quelle différence avec un permis de construire ?', a: 'Le permis concerne les projets d\'ampleur (grandes surfaces, constructions neuves). La DP couvre les travaux de faible ampleur. Notre analyse vous indique le régime applicable à votre projet.' },
    ] },
    { title: 'Délais et instruction', items: [
        { id: 'b1', q: 'Combien de temps dure l\'instruction ?', a: 'En général un mois à compter du dépôt. Ce délai passe à deux mois lorsque l\'avis de l\'Architecte des Bâtiments de France est requis.' },
        { id: 'b2', q: 'Que se passe-t-il en secteur protégé (ABF) ?', a: 'En site patrimonial remarquable ou aux abords d\'un monument historique, l\'Architecte des Bâtiments de France émet un avis. DP Travaux détecte ces secteurs et adapte les pièces et les délais.' },
        { id: 'b3', q: 'Sans réponse de la mairie, que se passe-t-il ?', a: 'L\'absence de réponse dans le délai vaut généralement acceptation tacite. Le récépissé remis au dépôt indique la date de référence à conserver.' },
    ] },
    { title: 'Le service DP Travaux', items: [
        { id: 'c1', q: 'Le dossier est-il vraiment accepté en mairie ?', a: 'Le dossier reprend le formulaire officiel et les pièces réglementaires DP1 à DP8. Il est conçu pour être déposé tel quel. La décision finale appartient toujours au service instructeur.' },
        { id: 'c2', q: 'Puis-je déposer ma déclaration en ligne ?', a: 'Oui, la plupart des communes acceptent le dépôt dématérialisé. Sinon, vous imprimez le dossier et le déposez sur place ou l\'envoyez en recommandé.' },
        { id: 'c3', q: 'Mes données sont-elles en sécurité ?', a: 'Vos dossiers sont chiffrés et hébergés en France. Vous pouvez les supprimer à tout moment depuis votre espace.' },
        { id: 'c4', q: 'DP Travaux est-il affilié à l\'administration ?', a: 'Non. DP Travaux est un service privé et indépendant qui vous aide à constituer votre dossier. Il n\'est pas affilié à l\'administration française.' },
    ] },
    { title: 'Tarifs et paiement', items: [
        { id: 'd1', q: 'Quand dois-je payer ?', a: 'La création, l\'analyse PLU et l\'aperçu sont gratuits. Le paiement n\'intervient qu\'au moment de générer le dossier définitif, sans filigrane.' },
        { id: 'd2', q: 'Puis-je modifier mon dossier après génération ?', a: 'Oui. L\'offre Dossier complet inclut une série de modifications. Les offres Pro permettent des modifications illimitées.' },
        { id: 'd3', q: 'Le paiement est-il sécurisé ?', a: 'Oui, les paiements sont traités par un prestataire certifié. Nous ne stockons aucune donnée bancaire.' },
        { id: 'd4', q: 'Suis-je engagé sur la durée ?', a: 'Aucun engagement pour le paiement à l\'usage. Les abonnements Pro sont résiliables à tout moment.' },
    ] },
]
const HOME_FAQ_IDS: Record<string, boolean> = { a1: true, a3: true, b1: true, c1: true, d1: true }
const FAQ_ALL: FaqItem[] = FAQ_DATA.flatMap((g) => g.items)

// ── Component ──────────────────────────────────────────────────────────────
export default function MarketingSite({ authed = false }: { authed?: boolean }) {
    // Authenticated visitors' CTAs lead to their space; guests' lead to registration.
    const appHref = authed ? '/profil' : '/register'
    const [page, setPage] = useState<Page>('home')
    const [pricing, setPricing] = useState<'usage' | 'abo'>('usage')
    const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({})
    const [elig, setElig] = useState('menuiseries')
    const [address, setAddress] = useState<{ adresse: string; code_postal: string; commune: string } | null>(null)
    const [sent, setSent] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const go = (p: Page) => {
        if (p === page) { try { window.scrollTo(0, 0) } catch { /* noop */ } return }
        setSent(false)
        setPage(p)
    }

    // Reveal-on-scroll + scroll-to-top on page change (ports the prototype's observeReveal).
    useEffect(() => {
        try { window.scrollTo(0, 0) } catch { /* noop */ }
        const root = rootRef.current
        if (!root) return
        const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
        if (!els.length) return
        const vh = window.innerHeight || 800
        els.forEach((el) => el.classList.remove('in'))
        els.forEach((el) => { if (el.getBoundingClientRect().top < vh * 0.94) el.classList.add('in') })
        root.classList.add('reveal-on')
        let io: IntersectionObserver | null = null
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver((ents) => {
                ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io?.unobserve(e.target) } })
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
            els.forEach((el) => { if (!el.classList.contains('in')) io!.observe(el) })
        } else {
            els.forEach((el) => el.classList.add('in'))
        }
        const to = window.setTimeout(() => els.forEach((el) => el.classList.add('in')), 2200)
        return () => { io?.disconnect(); window.clearTimeout(to) }
    }, [page, pricing])

    const toggleFaq = (id: string) => setOpenFaqs((o) => ({ ...o, [id]: !o[id] }))

    // Dynamic style builders (ported from the prototype's render helpers).
    const planCardStyle = (highlight: boolean): CSS => ({
        position: 'relative', display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--surface)', border: '1px solid ' + (highlight ? 'var(--ac)' : 'var(--line)'),
        borderRadius: 18, padding: '30px 26px',
        boxShadow: highlight ? '0 26px 62px -30px rgba(45,90,76,.55)' : '0 1px 2px rgba(37,34,30,.03),0 16px 36px -28px rgba(37,34,30,.22)',
    })
    const planTagStyle: CSS = { position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--ac)', color: '#fff', fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', padding: '5px 13px', borderRadius: 100, whiteSpace: 'nowrap' }
    const segStyle = (on: boolean): CSS => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, transition: 'all .15s', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--muted)', boxShadow: on ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none' })
    const eligOptStyle = (on: boolean): CSS => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, textAlign: 'left', transition: 'all .15s', color: on ? 'var(--acd)' : 'var(--ink-2)', border: '1px solid ' + (on ? 'var(--ac)' : 'var(--line)'), background: on ? 'var(--act)' : 'var(--surface)', boxShadow: on ? '0 8px 20px -14px rgba(45,90,76,.5)' : 'none' })

    // FAQ accordion item (ported from mkFaq).
    const FaqRow = ({ item }: { item: FaqItem }) => {
        const open = !!openFaqs[item.id]
        return (
            <div style={{ borderRadius: 13, border: '1px solid ' + (open ? 'var(--acb)' : 'var(--line)'), background: open ? 'var(--act)' : 'var(--surface)', marginBottom: 10, overflow: 'hidden', transition: 'background .2s ease,border-color .2s ease,box-shadow .2s ease', boxShadow: open ? '0 12px 28px -18px rgba(45,90,76,.42)' : '0 1px 2px rgba(37,34,30,.03)' }}>
                <button onClick={() => toggleFaq(item.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'inherit', padding: '17px 20px' }}>
                    <span style={{ fontFamily: 'var(--hf)', fontSize: 16.5, fontWeight: 600, lineHeight: 1.3, color: open ? 'var(--acd)' : 'var(--ink)', transition: 'color .2s ease' }}>{item.q}</span>
                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (open ? 'var(--ac)' : 'var(--line-3)'), background: open ? 'var(--ac)' : 'var(--surface-2)', color: open ? '#fff' : 'var(--muted)', fontSize: 18, lineHeight: 1, transition: 'all .2s ease', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                <div style={{ overflow: 'hidden', maxHeight: open ? 360 : 0, opacity: open ? 1 : 0, transition: 'max-height .35s ease,opacity .3s ease' }}>
                    <div style={{ padding: '0 20px 17px', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)' }}>{item.a}</div>
                </div>
            </div>
        )
    }

    const ev = ELIG_MAP[elig] || ELIG_MAP.menuiseries
    const plans = pricing === 'usage' ? PLANS_USAGE : PLANS_ABO
    const cmpCell = (v: string) => (v === 'y' ? { c: '✓', st: s('color:var(--acd);font-weight:700;font-size:16px') }
        : v === 'n' ? { c: '—', st: s('color:var(--faint);font-weight:400') }
        : { c: v, st: s('color:inherit;font-weight:600;font-size:13.5px') })

    const eyebrowH1: CSS = s('display:inline-flex;align-items:center;gap:9px')
    const sectionHeadH2 = s('font-family:var(--hf);font-weight:500;font-size:clamp(30px,3.7vw,44px);line-height:1.08;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')
    const heroBigH1 = s('font-family:var(--hf);font-weight:500;font-size:clamp(36px,4.6vw,54px);line-height:1.04;letter-spacing:-.02em;margin:18px 0 0;color:var(--ink)')
    const italicAc: CSS = { fontStyle: 'italic', color: 'var(--ac)' }

    return (
        <div id="site" ref={rootRef} style={s('min-height:100vh;background:var(--paper);color:var(--ink);font-family:\'IBM Plex Sans\',system-ui,sans-serif;overflow-x:hidden')}>
            <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />

            {/* ===================== HEADER ===================== */}
            <header style={s('position:sticky;top:0;z-index:60;background:rgba(241,236,227,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)')}>
                <div style={s('max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;align-items:center;gap:22px')}>
                    <a onClick={() => go('home')} style={s('display:flex;align-items:center;gap:12px;cursor:pointer;flex-shrink:0;text-decoration:none')}>
                        <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:40px;height:40px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));box-shadow:0 6px 16px -8px rgba(45,90,76,.6);flex-shrink:0')}>
                            <span style={s('font-family:var(--hf);font-weight:600;font-size:19px;line-height:1;letter-spacing:-.03em;color:#fff')}>dp</span>
                            <span style={s('width:14px;height:1.5px;border-radius:2px;background:rgba(255,255,255,.5)')}></span>
                        </div>
                        <div style={s('white-space:nowrap')}>
                            <div style={s('font-family:var(--hf);font-size:16px;font-weight:600;line-height:1.05;color:var(--ink)')}>DP Travaux</div>
                            <div data-logosub style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.09em;color:var(--muted);text-transform:uppercase')}>Déclaration préalable</div>
                        </div>
                    </a>
                    <nav data-navlinks style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:30px')}>
                        <button data-nav data-active={page === 'how' ? '1' : '0'} onClick={() => go('how')} style={s('background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;padding:7px 2px;transition:color .15s,border-color .15s')}>Comment ça marche</button>
                        <button data-nav data-active={page === 'pricing' ? '1' : '0'} onClick={() => go('pricing')} style={s('background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;padding:7px 2px;transition:color .15s,border-color .15s')}>Tarifs</button>
                        <button data-nav data-active={page === 'faq' ? '1' : '0'} onClick={() => go('faq')} style={s('background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;padding:7px 2px;transition:color .15s,border-color .15s')}>FAQ</button>
                        <button data-nav data-active={page === 'contact' ? '1' : '0'} onClick={() => go('contact')} style={s('background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;padding:7px 2px;transition:color .15s,border-color .15s')}>Contact</button>
                    </nav>
                    <div data-headcta style={s('display:flex;align-items:center;gap:14px;flex-shrink:0')}>
                        {authed ? (
                            <a href="/profil" className="dp-btn-primary" style={s('text-decoration:none;padding:10px 20px;font-size:14px')}>Mon espace</a>
                        ) : (
                            <>
                                <a href={SIGNIN_HREF} data-signin data-nav style={s('text-decoration:none;font-size:14px;font-weight:600;color:var(--ink-2);white-space:nowrap')}>Se connecter</a>
                                <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;padding:10px 20px;font-size:14px')}>Commencer</a>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* ===================== ACCUEIL ===================== */}
            {page === 'home' && (
                <div>
                    {/* HERO */}
                    <section style={s('position:relative;overflow:hidden')}>
                        <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(1100px 480px at 82% -8%,rgba(45,90,76,.11),transparent 58%)')}></div>
                        <div data-hero style={s('position:relative;max-width:1200px;margin:0 auto;padding:78px 28px 70px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center')}>
                            <div>
                                <span className="dp-eyebrow" style={s('display:inline-flex;align-items:center;gap:9px;background:var(--act);border:1px solid var(--acb);padding:7px 14px;border-radius:100px')}>
                                    <SealIcon size={15} strokeWidth={1.6} />
                                    Déclaration préalable en ligne
                                </span>
                                <h1 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(40px,5.3vw,62px);line-height:1.02;letter-spacing:-.02em;margin:22px 0 0;color:var(--ink)')}>Votre déclaration de travaux, <span style={italicAc}>prête à déposer</span>.</h1>
                                <p style={s('font-size:18px;line-height:1.62;color:var(--ink-2);margin:22px 0 0;max-width:53ch')}>DP&nbsp;Travaux assemble votre dossier complet — formulaire CERFA, plans, photos et pièces DP1 à DP8 — et vérifie sa conformité au PLU de votre commune. En 20&nbsp;minutes, sans architecte.</p>

                                <div style={s('margin:32px 0 0;max-width:470px')}>
                                    <label className="dp-label" style={s('display:block;margin-bottom:8px')}>Commencez par l&apos;adresse de votre terrain</label>
                                    <AddressAutocomplete placeholder="Ex : 24 Rue des Lilas, Lyon" onAddressSelected={(a) => setAddress(a)} />
                                    {address ? (
                                        <div style={s('display:flex;align-items:center;gap:12px;margin-top:15px;flex-wrap:wrap')}>
                                            <span style={s('display:inline-flex;align-items:center;gap:7px;font-size:13.5px;color:var(--acd);font-weight:600')}>
                                                <Check size={15} color="var(--acd)" />
                                                {(address.commune || address.adresse || 'Votre commune')} — PLU disponible
                                            </span>
                                            <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;padding:10px 18px;font-size:14px')}>Continuer ma déclaration →</a>
                                        </div>
                                    ) : (
                                        <div style={s('display:flex;align-items:center;gap:14px;margin-top:17px;flex-wrap:wrap')}>
                                            <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;padding:13px 24px;font-size:15px')}>Commencer gratuitement</a>
                                            <button className="dp-btn-secondary" onClick={() => go('how')} style={s('padding:13px 22px;font-size:15px')}>Voir comment ça marche</button>
                                        </div>
                                    )}
                                </div>

                                <div style={s('display:flex;align-items:center;gap:20px;margin-top:26px;flex-wrap:wrap;font-family:var(--mf);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)')}>
                                    <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Gratuit jusqu&apos;à la génération</span>
                                    <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Toutes les communes</span>
                                    <span style={s('display:inline-flex;align-items:center;gap:6px')}><span style={s('width:5px;height:5px;border-radius:50%;background:var(--ac)')}></span>Conforme CERFA</span>
                                </div>
                            </div>

                            {/* HERO VISUAL */}
                            <div data-hero-visual style={s('position:relative')}>
                                <div style={s('position:relative;height:522px')}>
                                    <div data-anim style={s('position:absolute;right:-4px;top:2px;color:var(--ac);animation:dpPulse 6s ease-in-out infinite;opacity:.5')}>
                                        <div style={s('opacity:.13')}><SealIcon size={152} strokeWidth={1} /></div>
                                    </div>
                                    <div style={s('position:absolute;top:28px;right:4px;width:298px;transform:rotate(4.5deg);background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 30px 60px -36px rgba(37,34,30,.5);padding:18px 18px 22px')}>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:14px')}><span style={s('font-family:var(--mf);font-size:10px;letter-spacing:.05em;color:var(--muted);text-transform:uppercase')}>CERFA 13703*11</span><span style={s('font-family:var(--mf);font-size:10px;color:var(--faint)')}>1/4</span></div>
                                        <div style={s('height:9px;width:72%;border-radius:3px;background:var(--line-2);margin-bottom:9px')}></div>
                                        <div style={s('height:9px;width:90%;border-radius:3px;background:var(--line-2);margin-bottom:9px')}></div>
                                        <div style={s('height:9px;width:58%;border-radius:3px;background:var(--line-2);margin-bottom:16px')}></div>
                                        <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:8px')}><div style={s('height:34px;border-radius:7px;background:var(--field);border:1px solid var(--line-2)')}></div><div style={s('height:34px;border-radius:7px;background:var(--field);border:1px solid var(--line-2)')}></div></div>
                                    </div>
                                    <div data-anim style={s('position:absolute;top:0;left:0;width:362px;animation:dpFloat 7s ease-in-out infinite;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 44px 84px -42px rgba(37,34,30,.55);overflow:hidden')}>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line-2);background:var(--surface-2)')}>
                                            <div style={s('display:flex;align-items:center;gap:9px')}>
                                                <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:26px;height:26px;border-radius:7px;background:linear-gradient(155deg,var(--ac),var(--acd))')}><span style={s('font-family:var(--hf);font-weight:600;font-size:12px;line-height:1;color:#fff')}>dp</span></div>
                                                <span style={s('font-family:var(--hf);font-size:14px;font-weight:600;color:var(--ink)')}>Dossier DP</span>
                                            </div>
                                            <span className="dp-chip is-ok">Prêt à déposer</span>
                                        </div>
                                        <div style={s('padding:16px')}>
                                            <div style={s('display:flex;align-items:center;gap:11px;padding:11px 13px;border:1px solid var(--acb);background:var(--act);border-radius:11px')}>
                                                <Check size={17} color="var(--acd)" />
                                                <div style={s('min-width:0')}><div style={s('font-size:13px;font-weight:600;color:var(--ink)')}>24 Rue des Lilas</div><div style={s('font-family:var(--mf);font-size:10.5px;color:var(--muted);margin-top:1px')}>69003 LYON · PARCELLE AK 0142</div></div>
                                            </div>
                                            <div style={s('position:relative;overflow:hidden;margin-top:12px;padding:13px;border:1px solid var(--line);border-radius:11px;background:var(--surface)')}>
                                                <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:10px')}><span style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Analyse PLU</span><span style={s('font-family:var(--mf);font-size:10px;color:var(--acd)')}>ZONE UA</span></div>
                                                <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                                                    <span className="dp-chip is-ok" style={s('font-size:11px')}>Zone UA ✓</span>
                                                    <span className="dp-chip is-ok" style={s('font-size:11px')}>Hauteur ✓</span>
                                                    <span className="dp-chip is-missing" style={s('font-size:11px')}>SPR · Avis ABF</span>
                                                </div>
                                                <div data-anim style={s('position:absolute;top:0;bottom:0;left:0;width:38%;background:linear-gradient(90deg,transparent,rgba(45,90,76,.16),transparent);animation:dpScan 2.9s linear infinite;pointer-events:none')}></div>
                                            </div>
                                            <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px')}>
                                                {HERO_DOCS.map((d) => (
                                                    <div key={d.code} style={s('border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--field)')}>
                                                        <div style={{ height: 40, background: d.bg }}></div>
                                                        <div style={s('font-family:var(--mf);font-size:8.5px;letter-spacing:.04em;text-align:center;color:var(--muted);padding:4px 0')}>{d.code}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={s('margin-top:15px')}>
                                                <div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:10px;letter-spacing:.04em;color:var(--muted);margin-bottom:6px')}><span>DOSSIER</span><span>7 / 8 PIÈCES</span></div>
                                                <div style={s('height:7px;border-radius:4px;background:var(--line-2);overflow:hidden')}><div style={s('height:100%;width:88%;background:linear-gradient(90deg,var(--ac),var(--acd))')}></div></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* STATS */}
                    <section data-reveal style={s('border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface-2)')}>
                        <div style={s('max-width:1120px;margin:0 auto;padding:30px 28px 22px')}>
                            <div data-grid2 style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:22px')}>
                                {STATS.map((st) => (
                                    <div key={st.label} style={s('text-align:center')}>
                                        <div style={s('font-family:var(--hf);font-size:clamp(30px,3.5vw,38px);font-weight:600;color:var(--ink);line-height:1;letter-spacing:-.01em')}>{st.val}</div>
                                        <div style={s('font-family:var(--mf);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-top:8px')}>{st.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={s('text-align:center;font-family:var(--mf);font-size:10px;color:var(--faint);margin-top:16px')}>Chiffres à titre indicatif</div>
                        </div>
                    </section>

                    {/* PROBLEM / SOLUTION */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:82px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Pourquoi DP Travaux</span>
                            <h2 style={sectionHeadH2}>La paperasse en moins, <span style={italicAc}>le dossier en mieux</span>.</h2>
                            <p style={s('font-size:16.5px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:56ch')}>La déclaration préalable décourage par sa complexité. Nous la transformons en un parcours clair, du premier champ au dossier déposable.</p>
                        </div>
                        <div data-col2 style={s('display:grid;grid-template-columns:1fr 1fr;gap:22px')}>
                            <div className="dp-card" style={s('padding:26px 26px 20px')}>
                                <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:16px')}>La DP à l&apos;ancienne</div>
                                <ul style={s('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px')}>
                                    {PAINS.map((p) => (
                                        <li key={p} style={s('display:flex;gap:11px;font-size:15px;color:var(--ink-2);line-height:1.45')}><span style={s('flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#F3E4DF;color:#B4442F;display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:1px')}>✕</span>{p}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="dp-card dp-spec" style={s('padding:26px 26px 20px;background:var(--act);border-color:var(--acb)')}>
                                <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--acd);margin-bottom:16px')}>Avec DP Travaux</div>
                                <ul style={s('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px')}>
                                    {GAINS.map((g) => (
                                        <li key={g} style={s('display:flex;gap:11px;font-size:15px;color:var(--ink);line-height:1.45')}><span style={s('flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;margin-top:1px')}><Check size={12} color="#fff" sw={3} /></span>{g}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* HOW OVERVIEW */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Comment ça marche</span>
                            <h2 style={sectionHeadH2}>Quatre étapes, <span style={italicAc}>un dossier complet</span>.</h2>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:18px')}>
                            {STEPS_OVERVIEW.map((step) => (
                                <div key={step.n} className="dp-card" data-lift style={s('padding:24px 22px')}>
                                    <div style={s('display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:var(--act);border:1px solid var(--acb);font-family:var(--mf);font-size:15px;font-weight:600;color:var(--acd);margin-bottom:16px')}>{step.n}</div>
                                    <div style={s('font-family:var(--hf);font-size:18px;font-weight:600;color:var(--ink);margin-bottom:7px')}>{step.title}</div>
                                    <div style={s('font-size:14px;line-height:1.55;color:var(--ink-2)')}>{step.body}</div>
                                </div>
                            ))}
                        </div>
                        <div style={s('text-align:center;margin-top:30px')}>
                            <button className="dp-btn-secondary" onClick={() => go('how')} style={s('padding:12px 22px')}>Voir le détail des 7 étapes →</button>
                        </div>
                    </section>

                    {/* FEATURES */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Fonctionnalités</span>
                            <h2 style={sectionHeadH2}>Tout ce qu&apos;il faut pour un <span style={italicAc}>dossier recevable</span>.</h2>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:18px')}>
                            {FEATURES.map((f) => (
                                <div key={f.title} className="dp-card" data-lift style={s('padding:26px 24px')}>
                                    <div style={s('display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;background:var(--act);border:1px solid var(--acb);margin-bottom:17px')}>{f.icon}</div>
                                    <div style={s('font-family:var(--hf);font-size:18px;font-weight:600;color:var(--ink);margin-bottom:7px')}>{f.title}</div>
                                    <div style={s('font-size:14.5px;line-height:1.55;color:var(--ink-2)')}>{f.body}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* WORKS + ELIGIBILITY */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:680px;margin:0 auto 44px;text-align:center')}>
                            <span className="dp-eyebrow">Types de travaux</span>
                            <h2 style={sectionHeadH2}>Ai-je besoin d&apos;une <span style={italicAc}>déclaration préalable</span> ?</h2>
                            <p style={s('font-size:16.5px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:52ch')}>Choisissez vos travaux — nous vous disons quel régime s&apos;applique.</p>
                        </div>
                        <div data-elig style={s('display:grid;grid-template-columns:1.1fr .9fr;gap:22px;align-items:start')}>
                            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:10px')}>
                                {ELIG_KEYS.map((k) => (
                                    <button key={k} onClick={() => setElig(k)} style={eligOptStyle(elig === k)}><span style={s('font-size:20px;line-height:1')}>{ELIG_MAP[k].emoji}</span>{ELIG_MAP[k].label}</button>
                                ))}
                            </div>
                            <div className="dp-card dp-spec" style={s('padding:26px 26px 24px;position:sticky;top:88px')}>
                                <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:18px')}>
                                    <div style={s('display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:var(--act);border:1px solid var(--acb);font-size:26px')}>{ev.emoji}</div>
                                    <div><div style={s('font-family:var(--hf);font-size:20px;font-weight:600;color:var(--ink)')}>{ev.label}</div><div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:2px')}>Régime d&apos;urbanisme</div></div>
                                </div>
                                <div className="dp-alert is-ok" style={s('margin-bottom:16px')}><span className="dp-alert-title">Formalité</span><div style={s('font-size:16px;font-weight:600;color:var(--acd)')}>{ev.verdict}</div></div>
                                <div style={s('display:flex;gap:10px;margin-bottom:16px')}>
                                    <div style={s('flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px 14px')}><div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Instruction</div><div style={s('font-size:15px;font-weight:600;color:var(--ink);margin-top:4px')}>{ev.delai}</div></div>
                                    <div style={s('flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px 14px')}><div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Architecte</div><div style={s('font-size:15px;font-weight:600;color:var(--ink);margin-top:4px')}>Non requis</div></div>
                                </div>
                                <p style={s('font-size:14px;line-height:1.55;color:var(--ink-2);margin:0 0 18px')}>{ev.note}</p>
                                <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;width:100%;justify-content:center')}>Déclarer ce projet</a>
                            </div>
                        </div>
                    </section>

                    {/* PRICING TEASER */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Tarifs</span>
                            <h2 style={sectionHeadH2}>Payez seulement <span style={italicAc}>quand c&apos;est prêt</span>.</h2>
                            <p style={s('font-size:16.5px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:54ch')}>Créez, testez et vérifiez gratuitement. Vous ne payez qu&apos;au moment de générer votre dossier définitif.</p>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch')}>
                            {PLANS_USAGE.map((p) => (
                                <div key={p.key} style={planCardStyle(p.highlight)}>
                                    {p.highlight && <span style={planTagStyle}>{p.tag}</span>}
                                    <div style={s('font-family:var(--hf);font-size:19px;font-weight:600;color:var(--ink)')}>{p.name}</div>
                                    <div style={s('display:flex;align-items:baseline;gap:4px;margin:12px 0 4px')}><span style={s('font-family:var(--hf);font-size:42px;font-weight:600;color:var(--ink);line-height:1')}>{p.price}</span><span style={s('font-size:20px;color:var(--ink)')}>{p.unit}</span><span style={s('font-size:13px;color:var(--muted);margin-left:2px')}>{p.per}</span></div>
                                    <div style={s('font-size:14px;line-height:1.5;color:var(--ink-2);margin-bottom:20px;min-height:42px')}>{p.desc}</div>
                                    <a href={appHref} className={p.kind === 'primary' ? 'dp-btn-primary' : 'dp-btn-secondary'} style={s('text-decoration:none;width:100%;justify-content:center')}>{p.cta}</a>
                                </div>
                            ))}
                        </div>
                        <div style={s('text-align:center;margin-top:30px')}>
                            <button className="dp-btn-secondary" onClick={() => go('pricing')} style={s('padding:12px 22px')}>Comparer tous les tarifs →</button>
                        </div>
                    </section>

                    {/* TESTIMONIALS */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Ils ont déclaré avec nous</span>
                            <h2 style={sectionHeadH2}>Des dossiers <span style={italicAc}>acceptés</span>, partout en France.</h2>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:18px')}>
                            {TESTIMONIALS.map((t) => (
                                <div key={t.name} className="dp-card" style={s('padding:26px 24px;display:flex;flex-direction:column')}>
                                    <div style={s('color:var(--ac);font-family:var(--hf);font-size:40px;line-height:.6;height:22px')}>“</div>
                                    <p style={s('font-family:var(--hf);font-size:17px;line-height:1.5;color:var(--ink);margin:8px 0 20px;flex:1')}>{t.quote}</p>
                                    <div style={s('display:flex;align-items:center;gap:12px;border-top:1px solid var(--line-2);padding-top:16px')}>
                                        <div style={s('width:38px;height:38px;border-radius:50%;background:var(--act);border:1px solid var(--acb);color:var(--acd);display:flex;align-items:center;justify-content:center;font-family:var(--hf);font-size:16px;font-weight:600')}>{t.initial}</div>
                                        <div><div style={s('font-size:14px;font-weight:600;color:var(--ink)')}>{t.name}</div><div style={s('font-size:12.5px;color:var(--muted)')}>{t.meta}</div></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* FAQ TEASER */}
                    <section data-reveal style={s('max-width:820px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('text-align:center;margin-bottom:38px')}>
                            <span className="dp-eyebrow">Questions fréquentes</span>
                            <h2 style={sectionHeadH2}>Vous vous demandez <span style={italicAc}>peut-être</span>…</h2>
                        </div>
                        <div style={s('display:flex;flex-direction:column')}>
                            {FAQ_ALL.filter((it) => HOME_FAQ_IDS[it.id]).map((it) => <FaqRow key={it.id} item={it} />)}
                        </div>
                        <div style={s('text-align:center;margin-top:32px')}>
                            <button className="dp-btn-secondary" onClick={() => go('faq')} style={s('padding:12px 22px')}>Toutes les questions →</button>
                        </div>
                    </section>

                    {/* FINAL CTA */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:70px 28px 92px')}>
                        <div style={s('position:relative;overflow:hidden;border-radius:22px;background:linear-gradient(150deg,var(--ac),var(--acd));padding:56px 40px;text-align:center;box-shadow:0 40px 80px -40px rgba(45,90,76,.6)')}>
                            <div data-anim style={s('position:absolute;right:-30px;top:-30px;color:#fff;opacity:.1;animation:dpPulse 7s ease-in-out infinite')}><SealIcon size={200} strokeWidth={1} stroke="#fff" /></div>
                            <div style={s('position:relative')}>
                                <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(30px,3.8vw,46px);line-height:1.06;color:#fff;margin:0')}>Prêt à déclarer vos travaux ?</h2>
                                <p style={s('font-size:17px;line-height:1.55;color:rgba(255,255,255,.85);margin:16px auto 0;max-width:48ch')}>Commencez gratuitement. Vous ne payez qu&apos;au moment de générer le dossier final.</p>
                                <div style={s('display:flex;align-items:center;justify-content:center;gap:16px;margin-top:30px;flex-wrap:wrap')}>
                                    <a href={appHref} style={s('text-decoration:none;display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--acd);font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px;box-shadow:0 14px 30px -12px rgba(0,0,0,.3)')}>Commencer gratuitement</a>
                                    <span style={s('font-family:var(--mf);font-size:12px;letter-spacing:.04em;color:rgba(255,255,255,.75)')}>≈ 20 minutes</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {/* ===================== COMMENT ÇA MARCHE ===================== */}
            {page === 'how' && (
                <div>
                    <section style={s('position:relative;overflow:hidden')}>
                        <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(900px 380px at 50% -20%,rgba(45,90,76,.10),transparent 60%)')}></div>
                        <div style={s('position:relative;max-width:820px;margin:0 auto;padding:70px 28px 40px;text-align:center')}>
                            <span className="dp-eyebrow" style={eyebrowH1}><SealIcon size={15} strokeWidth={1.6} />Le parcours</span>
                            <h1 style={heroBigH1}>Comment <span style={italicAc}>ça marche</span></h1>
                            <p style={s('font-size:18px;line-height:1.6;color:var(--ink-2);margin:18px auto 0;max-width:56ch')}>Sept étapes guidées, de vos coordonnées au dossier téléchargeable. Chaque champ est expliqué, rien n&apos;est laissé au hasard.</p>
                        </div>
                    </section>

                    <section data-reveal style={s('max-width:900px;margin:0 auto;padding:20px 28px 20px')}>
                        <div style={s('display:flex;flex-direction:column;gap:16px')}>
                            {STEPS_DETAIL.map((step) => (
                                <div key={step.n} className="dp-card" style={s('padding:26px 28px;display:grid;grid-template-columns:64px 1fr;gap:22px;align-items:start')}>
                                    <div style={s('display:flex;flex-direction:column;align-items:center;gap:8px')}>
                                        <div style={s('display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:linear-gradient(155deg,var(--ac),var(--acd));color:#fff;font-family:var(--hf);font-size:22px;font-weight:600;box-shadow:0 10px 22px -12px rgba(45,90,76,.6)')}>{step.n}</div>
                                    </div>
                                    <div>
                                        <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px')}><h3 style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink);margin:0')}>{step.title}</h3><span className="dp-chip">{step.tag}</span></div>
                                        <p style={s('font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 0 14px')}>{step.body}</p>
                                        <div style={s('display:flex;flex-wrap:wrap;gap:9px')}>
                                            {step.bullets.map((b) => (
                                                <span key={b} style={s('display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:7px 12px;border-radius:9px')}><Check size={13} />{b}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* DOSSIER PIECES */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:64px 28px 20px')}>
                        <div style={s('max-width:640px;margin:0 auto 40px;text-align:center')}>
                            <span className="dp-eyebrow">Le livrable</span>
                            <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Ce que contient <span style={italicAc}>votre dossier</span></h2>
                            <p style={s('font-size:16px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:52ch')}>Les huit pièces réglementaires de la déclaration préalable, prêtes à déposer.</p>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:14px')}>
                            {PIECES.map((p) => (
                                <div key={p.code} className="dp-card" data-lift style={s('padding:20px')}>
                                    <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:12px')}><span style={s('font-family:var(--mf);font-size:13px;font-weight:600;letter-spacing:.03em;color:var(--acd);background:var(--act);border:1px solid var(--acb);padding:4px 9px;border-radius:7px')}>{p.code}</span><span style={p.reqStyle}>{p.req}</span></div>
                                    <div style={s('font-family:var(--hf);font-size:16px;font-weight:600;color:var(--ink);margin-bottom:5px')}>{p.name}</div>
                                    <div style={s('font-size:13px;line-height:1.5;color:var(--ink-2)')}>{p.desc}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* APRÈS LE DÉPÔT */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:64px 28px 20px')}>
                        <div style={s('max-width:640px;margin:0 auto 40px;text-align:center')}>
                            <span className="dp-eyebrow">Après le dépôt</span>
                            <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>De la mairie à <span style={italicAc}>la décision</span></h2>
                        </div>
                        <div data-grid2 style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:16px')}>
                            {DEPOSE_STEPS.map((d) => (
                                <div key={d.n} style={s('position:relative;padding:22px 20px;background:var(--surface);border:1px solid var(--line);border-radius:14px')}>
                                    <div style={s('font-family:var(--mf);font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--acd);margin-bottom:10px')}>ÉTAPE {d.n}</div>
                                    <div style={s('font-family:var(--hf);font-size:17px;font-weight:600;color:var(--ink);margin-bottom:6px')}>{d.title}</div>
                                    <div style={s('font-size:13.5px;line-height:1.5;color:var(--ink-2)')}>{d.body}</div>
                                </div>
                            ))}
                        </div>
                        <div className="dp-alert is-info" style={s('max-width:760px;margin:22px auto 0;display:flex;gap:12px;align-items:flex-start')}>
                            <span style={s('font-size:18px;line-height:1')}>⏱️</span>
                            <div><span className="dp-alert-title">Bon à savoir</span><div style={s('font-size:14px;line-height:1.55')}>Sans réponse de la mairie dans le délai d&apos;instruction, la déclaration est généralement acceptée tacitement. Le récépissé remis au dépôt indique la date de référence.</div></div>
                        </div>
                        <div style={s('text-align:center;margin-top:40px')}>
                            <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;padding:13px 26px;font-size:15px')}>Commencer ma déclaration →</a>
                        </div>
                    </section>
                    <div style={s('height:40px')}></div>
                </div>
            )}

            {/* ===================== TARIFS ===================== */}
            {page === 'pricing' && (
                <div>
                    <section style={s('position:relative;overflow:hidden')}>
                        <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(900px 380px at 50% -20%,rgba(45,90,76,.10),transparent 60%)')}></div>
                        <div style={s('position:relative;max-width:760px;margin:0 auto;padding:70px 28px 30px;text-align:center')}>
                            <span className="dp-eyebrow">Tarifs</span>
                            <h1 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(36px,4.6vw,54px);line-height:1.04;letter-spacing:-.02em;margin:16px 0 0;color:var(--ink)')}>Un prix clair, <span style={italicAc}>sans surprise</span></h1>
                            <p style={s('font-size:18px;line-height:1.6;color:var(--ink-2);margin:16px auto 26px;max-width:52ch')}>Gratuit pour créer et vérifier. Vous payez à la génération du dossier, ou vous vous abonnez si vous en déposez souvent.</p>
                            <div style={s('display:inline-flex;gap:4px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:4px')}>
                                <button onClick={() => setPricing('usage')} style={segStyle(pricing === 'usage')}>Paiement à l&apos;usage</button>
                                <button onClick={() => setPricing('abo')} style={segStyle(pricing === 'abo')}>Abonnement Pro</button>
                            </div>
                        </div>
                    </section>

                    <section style={s('max-width:1080px;margin:0 auto;padding:14px 28px 20px')}>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch')}>
                            {plans.map((p) => (
                                <div key={p.key} style={planCardStyle(p.highlight)}>
                                    {p.tag && <span style={planTagStyle}>{p.tag}</span>}
                                    <div style={s('font-family:var(--hf);font-size:20px;font-weight:600;color:var(--ink)')}>{p.name}</div>
                                    <div style={s('font-size:14px;line-height:1.5;color:var(--ink-2);margin:6px 0 14px;min-height:40px')}>{p.desc}</div>
                                    <div style={s('display:flex;align-items:baseline;gap:4px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--line-2)')}><span style={s('font-family:var(--hf);font-size:46px;font-weight:600;color:var(--ink);line-height:1')}>{p.price}</span><span style={s('font-size:22px;color:var(--ink)')}>{p.unit}</span><span style={s('font-size:13px;color:var(--muted);margin-left:3px')}>{p.per}</span></div>
                                    <ul style={s('margin:0 0 22px;padding:0;list-style:none;display:flex;flex-direction:column;gap:11px;flex:1')}>
                                        {p.features.map((f) => (
                                            <li key={f} style={s('display:flex;gap:10px;font-size:14px;line-height:1.45;color:var(--ink-2)')}><span style={s('flex-shrink:0;margin-top:2px')}><Check size={16} sw={2.4} /></span>{f}</li>
                                        ))}
                                    </ul>
                                    <a href={appHref} className={p.kind === 'primary' ? 'dp-btn-primary' : 'dp-btn-secondary'} style={s('text-decoration:none;width:100%;justify-content:center')}>{p.cta}</a>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* INCLUDED IN ALL */}
                    <section data-reveal style={s('max-width:1080px;margin:0 auto;padding:36px 28px 10px')}>
                        <div style={s('background:var(--surface-2);border:1px solid var(--line);border-radius:16px;padding:24px 28px')}>
                            <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:18px')}>Compris dans tous les forfaits</div>
                            <div data-grid3 style={s('display:grid;grid-template-columns:repeat(5,1fr);gap:14px')}>
                                {INCLUDED.map((i) => (
                                    <div key={i} style={s('display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px')}><Check size={20} sw={1.8} /><span style={s('font-size:13px;color:var(--ink);font-weight:500;line-height:1.35')}>{i}</span></div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* COMPARISON TABLE */}
                    <section data-reveal style={s('max-width:1080px;margin:0 auto;padding:56px 28px 20px')}>
                        <div style={s('text-align:center;margin-bottom:32px')}>
                            <span className="dp-eyebrow">Comparatif</span>
                            <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(26px,3.2vw,38px);line-height:1.1;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Le détail des offres</h2>
                        </div>
                        <div className="dp-card" style={s('padding:0;overflow:hidden')}>
                            <div style={s('overflow-x:auto')}>
                                <table style={s('width:100%;border-collapse:collapse;font-size:14px')}>
                                    <thead>
                                        <tr style={s('background:var(--surface-2)')}>
                                            <th style={s('text-align:left;padding:16px 22px;font-family:var(--mf);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:500')}>Fonctionnalité</th>
                                            <th style={s('padding:16px 14px;font-family:var(--hf);font-size:15px;font-weight:600;color:var(--ink)')}>Découverte</th>
                                            <th style={s('padding:16px 14px;font-family:var(--hf);font-size:15px;font-weight:600;color:var(--acd);background:var(--act)')}>Dossier complet</th>
                                            <th style={s('padding:16px 14px;font-family:var(--hf);font-size:15px;font-weight:600;color:var(--ink)')}>Pro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CMP_RAW.map((r) => {
                                            const c0 = cmpCell(r[1]), c1 = cmpCell(r[2]), c2 = cmpCell(r[3])
                                            return (
                                                <tr key={r[0]} style={s('border-top:1px solid var(--line-2)')}>
                                                    <td style={s('padding:14px 22px;color:var(--ink);font-weight:500')}>{r[0]}</td>
                                                    <td style={s('padding:14px 14px;text-align:center;color:var(--ink-2)')}><span style={c0.st}>{c0.c}</span></td>
                                                    <td style={s('padding:14px 14px;text-align:center;background:var(--act);color:var(--ink)')}><span style={c1.st}>{c1.c}</span></td>
                                                    <td style={s('padding:14px 14px;text-align:center;color:var(--ink-2)')}><span style={c2.st}>{c2.c}</span></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* PRICING FAQ */}
                    <section data-reveal style={s('max-width:820px;margin:0 auto;padding:56px 28px 20px')}>
                        <div style={s('text-align:center;margin-bottom:34px')}>
                            <span className="dp-eyebrow">Paiement</span>
                            <h2 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(26px,3.2vw,38px);line-height:1.1;letter-spacing:-.01em;margin:12px 0 0;color:var(--ink)')}>Questions sur les tarifs</h2>
                        </div>
                        <div style={s('display:flex;flex-direction:column')}>
                            {FAQ_DATA[3].items.map((it) => <FaqRow key={it.id} item={it} />)}
                        </div>
                        <div style={s('text-align:center;margin-top:36px')}>
                            <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;padding:13px 26px;font-size:15px')}>Commencer gratuitement →</a>
                        </div>
                    </section>
                    <div style={s('height:40px')}></div>
                </div>
            )}

            {/* ===================== FAQ ===================== */}
            {page === 'faq' && (
                <div>
                    <section style={s('position:relative;overflow:hidden')}>
                        <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(900px 380px at 50% -20%,rgba(45,90,76,.10),transparent 60%)')}></div>
                        <div style={s('position:relative;max-width:760px;margin:0 auto;padding:70px 28px 20px;text-align:center')}>
                            <span className="dp-eyebrow" style={eyebrowH1}><SealIcon size={15} strokeWidth={1.6} />Aide</span>
                            <h1 style={heroBigH1}>Questions <span style={italicAc}>fréquentes</span></h1>
                            <p style={s('font-size:18px;line-height:1.6;color:var(--ink-2);margin:18px auto 0;max-width:54ch')}>Tout ce qu&apos;il faut savoir sur la déclaration préalable et sur le service DP Travaux.</p>
                        </div>
                    </section>

                    <section style={s('max-width:820px;margin:0 auto;padding:24px 28px 20px')}>
                        <div style={s('display:flex;flex-direction:column;gap:36px')}>
                            {FAQ_DATA.map((grp) => (
                                <div key={grp.title} data-reveal>
                                    <div style={s('display:flex;align-items:center;gap:14px;margin:2px 0 18px')}><span style={s('font-family:var(--mf);font-size:12.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--acd);font-weight:600;white-space:nowrap')}>{grp.title}</span><span style={s('flex:1;height:1px;background:var(--line)')}></span></div>
                                    <div style={s('display:flex;flex-direction:column')}>
                                        {grp.items.map((it) => <FaqRow key={it.id} item={it} />)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="dp-card dp-spec" data-reveal style={s('margin-top:44px;padding:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;background:var(--act);border-color:var(--acb)')}>
                            <div><div style={s('font-family:var(--hf);font-size:20px;font-weight:600;color:var(--ink)')}>Vous ne trouvez pas votre réponse ?</div><div style={s('font-size:14.5px;color:var(--ink-2);margin-top:4px')}>Notre équipe répond sous 24 heures ouvrées.</div></div>
                            <button className="dp-btn-primary" onClick={() => go('contact')} style={s('flex-shrink:0')}>Nous contacter</button>
                        </div>
                    </section>
                    <div style={s('height:48px')}></div>
                </div>
            )}

            {/* ===================== CONTACT ===================== */}
            {page === 'contact' && (
                <div>
                    <section style={s('position:relative;overflow:hidden')}>
                        <div style={s('position:absolute;inset:0;pointer-events:none;background:radial-gradient(900px 380px at 50% -20%,rgba(45,90,76,.10),transparent 60%)')}></div>
                        <div style={s('position:relative;max-width:760px;margin:0 auto;padding:70px 28px 20px;text-align:center')}>
                            <span className="dp-eyebrow">Contact</span>
                            <h1 style={s('font-family:var(--hf);font-weight:500;font-size:clamp(36px,4.6vw,54px);line-height:1.04;letter-spacing:-.02em;margin:16px 0 0;color:var(--ink)')}>Une question ? <span style={italicAc}>Écrivez-nous</span></h1>
                            <p style={s('font-size:18px;line-height:1.6;color:var(--ink-2);margin:16px auto 0;max-width:50ch')}>Particulier ou professionnel, nous vous répondons sous 24 heures ouvrées.</p>
                        </div>
                    </section>

                    <section style={s('max-width:1000px;margin:0 auto;padding:20px 28px 20px')}>
                        <div data-split style={s('display:grid;grid-template-columns:1.3fr .7fr;gap:22px;align-items:start')}>
                            <div className="dp-card" style={s('padding:30px')}>
                                {!sent ? (
                                    <div>
                                        <h2 className="dp-section-title">Formulaire de contact</h2>
                                        <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:16px')}>
                                            <div className="dp-form-group"><label className="dp-label">Nom complet</label><input className="dp-input" placeholder="Prénom Nom" /></div>
                                            <div className="dp-form-group"><label className="dp-label">Email</label><input className="dp-input" type="email" placeholder="vous@exemple.fr" /></div>
                                        </div>
                                        <div className="dp-form-group" style={s('margin-top:4px')}><label className="dp-label">Sujet</label><select className="dp-select" defaultValue="Question sur ma déclaration"><option>Question sur ma déclaration</option><option>Analyse PLU / secteur ABF</option><option>Tarifs et paiement</option><option>Offre professionnelle</option><option>Autre</option></select></div>
                                        <div className="dp-form-group" style={s('margin-top:4px')}><label className="dp-label">Message</label><textarea className="dp-input" style={s('min-height:130px;resize:vertical;font-family:inherit')} placeholder="Décrivez votre projet ou votre question…"></textarea></div>
                                        <button className="dp-btn-primary" onClick={() => { setSent(true); try { window.scrollTo(0, 0) } catch { /* noop */ } }} style={s('margin-top:6px')}>Envoyer le message</button>
                                    </div>
                                ) : (
                                    <div style={s('text-align:center;padding:28px 10px')}>
                                        <div style={s('display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;background:var(--act);border:1px solid var(--acb);margin-bottom:18px')}><Check size={30} color="var(--acd)" sw={2.4} /></div>
                                        <h2 style={s('font-family:var(--hf);font-size:24px;font-weight:600;color:var(--ink);margin:0 0 8px')}>Message envoyé</h2>
                                        <p style={s('font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 auto 22px;max-width:38ch')}>Merci ! Nous revenons vers vous sous 24 heures ouvrées à l&apos;adresse indiquée.</p>
                                        <button className="dp-btn-secondary" onClick={() => setSent(false)}>Envoyer un autre message</button>
                                    </div>
                                )}
                            </div>

                            <div style={s('display:flex;flex-direction:column;gap:16px')}>
                                <div className="dp-card" style={s('padding:24px')}>
                                    <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:16px')}>Coordonnées</div>
                                    <div style={s('display:flex;flex-direction:column;gap:16px')}>
                                        <div style={s('display:flex;gap:12px;align-items:flex-start')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg><div><div style={s('font-size:14px;font-weight:600;color:var(--ink)')}>bonjour@dptravaux.fr</div><div style={s('font-size:12.5px;color:var(--muted);margin-top:2px')}>Réponse sous 24 h ouvrées</div></div></div>
                                        <div style={s('display:flex;gap:12px;align-items:flex-start')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg><div><div style={s('font-size:14px;font-weight:600;color:var(--ink)')}>01 84 80 12 34</div><div style={s('font-size:12.5px;color:var(--muted);margin-top:2px')}>Lun — Ven · 9 h – 18 h</div></div></div>
                                    </div>
                                </div>
                                <div className="dp-card dp-spec" style={s('padding:24px;background:var(--act);border-color:var(--acb)')}>
                                    <div style={s('font-family:var(--hf);font-size:17px;font-weight:600;color:var(--ink);margin-bottom:6px')}>Vous êtes un professionnel ?</div>
                                    <p style={s('font-size:13.5px;line-height:1.5;color:var(--ink-2);margin:0 0 14px')}>Artisans, architectes et agences : découvrez l&apos;offre Pro et ses dossiers illimités.</p>
                                    <button className="dp-btn-secondary" onClick={() => go('pricing')} style={s('width:100%;justify-content:center')}>Voir l&apos;offre Pro</button>
                                </div>
                            </div>
                        </div>
                    </section>
                    <div style={s('height:48px')}></div>
                </div>
            )}

            {/* ===================== FOOTER ===================== */}
            <footer style={s('background:var(--ink);color:rgba(255,255,255,.72);margin-top:20px')}>
                <div style={s('max-width:1200px;margin:0 auto;padding:56px 28px 28px')}>
                    <div data-foot style={s('display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:36px')}>
                        <div style={s('max-width:300px')}>
                            <div style={s('display:flex;align-items:center;gap:11px;margin-bottom:16px')}>
                                <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:38px;height:38px;border-radius:10px;background:linear-gradient(155deg,var(--ac),var(--acd))')}><span style={s('font-family:var(--hf);font-weight:600;font-size:18px;line-height:1;color:#fff')}>dp</span><span style={s('width:13px;height:1.5px;border-radius:2px;background:rgba(255,255,255,.5)')}></span></div>
                                <div><div style={s('font-family:var(--hf);font-size:16px;font-weight:600;color:#fff')}>DP Travaux</div><div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.08em;color:rgba(255,255,255,.5);text-transform:uppercase')}>CERFA 13703*11</div></div>
                            </div>
                            <p style={s('font-size:13.5px;line-height:1.6;color:rgba(255,255,255,.6);margin:0 0 16px')}>La déclaration préalable de travaux, du premier champ au dossier déposable. Analyse PLU incluse.</p>
                            <div style={s('display:inline-flex;align-items:center;gap:8px;font-family:var(--mf);font-size:11px;letter-spacing:.03em;color:rgba(255,255,255,.6);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:7px 12px;border-radius:9px')}>Données hébergées en France</div>
                        </div>
                        <div>
                            <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:16px')}>Produit</div>
                            <div style={s('display:flex;flex-direction:column;gap:11px;font-size:14px')}>
                                <button data-flink onClick={() => go('how')} style={s('background:none;border:none;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:14px;color:rgba(255,255,255,.72)')}>Comment ça marche</button>
                                <button data-flink onClick={() => go('pricing')} style={s('background:none;border:none;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:14px;color:rgba(255,255,255,.72)')}>Tarifs</button>
                                <a data-flink href={appHref} style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Analyse PLU</a>
                                <a data-flink href={appHref} style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Démarrer un dossier</a>
                            </div>
                        </div>
                        <div>
                            <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:16px')}>Ressources</div>
                            <div style={s('display:flex;flex-direction:column;gap:11px;font-size:14px')}>
                                <button data-flink onClick={() => go('faq')} style={s('background:none;border:none;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:14px;color:rgba(255,255,255,.72)')}>FAQ</button>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Guide de la DP</a>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Exemples de dossiers</a>
                                <button data-flink onClick={() => go('contact')} style={s('background:none;border:none;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:14px;color:rgba(255,255,255,.72)')}>Contact</button>
                            </div>
                        </div>
                        <div>
                            <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:16px')}>Légal</div>
                            <div style={s('display:flex;flex-direction:column;gap:11px;font-size:14px')}>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Mentions légales</a>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>CGV</a>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Confidentialité</a>
                                <a data-flink href="#" style={s('color:rgba(255,255,255,.72);text-decoration:none')}>Cookies</a>
                            </div>
                        </div>
                    </div>
                    <div style={s('border-top:1px solid rgba(255,255,255,.12);margin-top:40px;padding-top:22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap')}>
                        <div style={s('font-size:12.5px;color:rgba(255,255,255,.5)')}>© 2026 DP Travaux · Service indépendant, non affilié à l&apos;administration française.</div>
                        <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.04em;color:rgba(255,255,255,.4)')}>Formulaire CERFA n° 13703*11</div>
                    </div>
                </div>
            </footer>
        </div>
    )
}

// Scoped CSS ported verbatim from the prototype's <style> block (keyframes, hover
// states, reveal transitions, responsive rules). All rules are scoped to #site so
// they never leak into the authenticated app.
const SITE_CSS = `
#site{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
@keyframes dpRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes dpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes dpScan{0%{transform:translateX(-160%)}55%,100%{transform:translateX(380%)}}
@keyframes dpPulse{0%,100%{opacity:.45}50%{opacity:.9}}
#site.reveal-on [data-reveal]{transform:translateY(20px);transition:transform .7s cubic-bezier(.2,.7,.2,1)}
#site.reveal-on [data-reveal].in{transform:none}
#site button{-webkit-appearance:none;appearance:none;font-family:inherit}
#site .dp-btn-primary,#site .dp-btn-secondary{-webkit-appearance:none!important;appearance:none!important;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:12px 24px;border-radius:12px!important;font-family:inherit;font-weight:600;line-height:1.2;cursor:pointer;text-decoration:none;transition:background .2s ease,border-color .2s ease,transform .2s ease}
#site .dp-btn-primary{background:var(--ac)!important;color:#fff!important;border:1px solid var(--ac)!important;box-shadow:0 12px 30px -14px rgba(45,90,76,.55)}
#site .dp-btn-primary:hover{background:var(--acd)!important;border-color:var(--acd)!important;transform:translateY(-1px)}
#site .dp-btn-secondary{background:var(--surface)!important;color:var(--ink-2)!important;border:1px solid var(--line-3)!important}
#site .dp-btn-secondary:hover{background:var(--surface-2)!important;border-color:var(--muted)!important}
#site [data-nav]{color:var(--ink-2)}
#site [data-nav]:hover{color:var(--ink)}
#site [data-nav][data-active="1"]{color:var(--ink);border-bottom-color:var(--ac)!important;font-weight:600}
#site [data-lift]{transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
#site [data-lift]:hover{transform:translateY(-4px);box-shadow:0 26px 52px -28px rgba(37,34,30,.42);border-color:var(--acb)}
#site [data-flink]{text-decoration:none;transition:color .15s ease}
#site [data-flink]:hover{color:#fff!important}
#site [data-anim]{will-change:transform,opacity}
@media (prefers-reduced-motion:reduce){#site [data-anim]{animation:none!important}#site.reveal-on [data-reveal]{opacity:1!important;transform:none!important;transition:none!important}}
@media (max-width:860px){#site [data-hero]{grid-template-columns:1fr!important}#site [data-hero-visual]{display:none!important}#site [data-col2]{grid-template-columns:1fr!important}#site [data-split]{grid-template-columns:1fr!important}}
@media (max-width:760px){#site [data-navlinks]{display:none!important}#site [data-headcta]{margin-left:auto}#site [data-grid3]{grid-template-columns:1fr!important}#site [data-grid2]{grid-template-columns:repeat(2,1fr)!important}#site [data-elig]{grid-template-columns:1fr!important}#site [data-foot]{grid-template-columns:1fr 1fr!important}}
@media (max-width:520px){#site header > div{padding-left:16px!important;padding-right:16px!important;gap:12px!important}#site [data-logosub]{display:none!important}#site [data-signin]{display:none!important}#site [data-foot]{grid-template-columns:1fr!important}}
`
