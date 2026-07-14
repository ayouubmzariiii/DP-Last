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
// Time / capability figures grounded in the real end-to-end flow (see the "à titre indicatif"
// footnote). Communes couvertes ≈ the ~34 900 French communes, since the analysis runs on the
// national IGN / Géoportail de l'Urbanisme data.
const STATS = [
    { val: '≈ 2 min', label: 'Analyse PLU de votre parcelle' },
    { val: '≈ 10 min', label: 'Un dossier complet' },
    { val: '8', label: 'Pièces générées (DP1–DP8)' },
    { val: '34 900+', label: 'Communes couvertes' },
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

// Thumbnails for the "Déposez" walkthrough card — the 8 DP pieces, generated
// as CSS backgrounds (ported from the prototype's pieceThumbs).
const PIECE_THUMBS = [
    { code: 'DP1', bg: 'radial-gradient(circle at 50% 55%, var(--acb) 0 4px, transparent 5px), repeating-linear-gradient(0deg,var(--line-2) 0 1px,transparent 1px 7px), repeating-linear-gradient(90deg,var(--line-2) 0 1px,transparent 1px 7px)' },
    { code: 'DP2', bg: 'linear-gradient(135deg,#E6EDE9,#DCE6E0)' },
    { code: 'DP3', bg: 'repeating-linear-gradient(90deg,var(--field) 0 7px,var(--line-2) 7px 9px)' },
    { code: 'DP4', bg: 'repeating-linear-gradient(0deg,var(--surface) 0 4px,var(--line-2) 4px 5px)' },
    { code: 'DP5', bg: 'linear-gradient(135deg,#EDEBE3,#E4E0D5)' },
    { code: 'DP6', bg: 'linear-gradient(135deg,#D8E4DC,#C7D8CD)' },
    { code: 'DP7', bg: 'repeating-linear-gradient(45deg,#EFEAE0,#EFEAE0 5px,#F5F1E9 5px,#F5F1E9 10px)' },
    { code: 'DP8', bg: 'linear-gradient(135deg,#E9E4D9,#DED7C8)' },
]

// Real before/after façade photos already shipped in /public/test — used by the
// DP6 insertion comparison slider in the walkthrough.
const BA_BEFORE = '/test/facade-principale.jpg'
const BA_AFTER = '/test/cache/after-principale.jpg'

const FEATURES = [
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3.1 7.7-7 9-3.9-1.3-7-4.4-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>, title: 'Analyse PLU automatique', body: 'Votre projet croisé au règlement de votre parcelle, pour repérer les blocages avant la mairie.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h5" /></svg>, title: 'Formulaire CERFA pré-rempli', body: 'Le 16702*03 rempli à partir de vos réponses, sans case oubliée.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z" /><path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" /></svg>, title: 'Vues « après » par IA', body: 'L\'insertion paysagère « après » (DP6) générée à partir de vos photos.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 16.5l9 5 9-5" /></svg>, title: 'Toutes les pièces réunies', body: 'DP1 à DP8 dans un dossier unique, prêt à imprimer ou déposer en ligne.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-5 9 5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 21h18" /></svg>, title: 'Secteurs protégés & ABF', body: 'Détection des sites patrimoniaux et des avis ABF obligatoires.' },
    { icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6" /><path d="M4 20l1.2-4.2L16.5 4.5a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L8.2 18.8 4 20z" /></svg>, title: 'Notice rédigée pour vous', body: 'La notice DP4 rédigée à partir de vos travaux et matériaux.' },
]

const STEPS_DETAIL = [
    { n: '1', title: 'Le demandeur', tag: '≈ 2 min', body: 'Vos coordonnées et votre qualité : particulier, mandataire ou société.', bullets: ['État civil et adresse', 'Société ou co-déclarant', 'Pré-rempli d\'une fois sur l\'autre'] },
    { n: '2', title: 'Le terrain', tag: '≈ 2 min', body: 'L\'adresse et les références cadastrales du terrain concerné.', bullets: ['Recherche d\'adresse officielle', 'Parcelle, section, superficie', 'Report du cadastre'] },
    { n: '3', title: 'Les travaux', tag: '≈ 5 min', body: 'La nature exacte de votre projet et ses caractéristiques techniques.', bullets: ['Menuiseries, ITE, solaire…', 'Matériaux, teintes RAL', 'Surfaces existantes et créées'] },
    { n: '4', title: 'L\'analyse PLU', tag: '≈ 2 min · auto', body: 'La vérification de conformité qui évite le refus en mairie.', bullets: ['Règlement de votre zone', 'Détection SPR, ABF', 'Matériaux autorisés / interdits'] },
    { n: '5', title: 'Les photos', tag: '≈ 3 min', body: 'Les vues du terrain exigées par le formulaire CERFA.', bullets: ['Pièces DP7 et DP8', 'Cadrage guidé', 'Vues « après » par IA'] },
    { n: '6', title: 'Les plans', tag: 'Générés', body: 'Les documents graphiques réglementaires et la notice.', bullets: ['DP1, DP2, DP3', 'Notice descriptive DP4', 'Insertion par façade'] },
    { n: '7', title: 'La génération', tag: 'Le livrable', body: 'Votre dossier complet, vérifié et prêt à déposer.', bullets: ['CERFA 16702*03 rempli', 'Toutes les pièces (PDF/ZIP)', 'Guide de dépôt en mairie'] },
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
    { quote: 'Je pensais devoir payer un architecte pour changer mes fenêtres. Dossier déposé le week-end, accepté en trois semaines.', name: 'Camille R.', meta: 'Propriétaire · Lyon 3e', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&q=70' },
    { quote: 'Je génère les déclarations de mes clients en quinze minutes. L\'analyse PLU nous a déjà évité deux refus.', name: 'Karim B.', meta: 'Menuisier · Villeurbanne', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&q=70' },
    { quote: 'La palette imposée en secteur ABF était signalée dès l\'analyse. On a corrigé la teinte avant de déposer.', name: 'Sophie & Marc', meta: 'Rénovation · Bordeaux', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&q=70' },
]

// Unsplash photo for a work type. Ported from the prototype's IMG(id) helper.
const eligImg = (id: string, w = 600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70`
const ELIG_MAP: Record<string, { label: string; emoji: string; img: string; verdict: string; delai: string; note: string }> = {
    menuiseries: { label: 'Menuiseries', emoji: '🪟', img: eligImg('1509644851169-2acc08aa25b5'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Changer des fenêtres, portes ou volets modifie l\'aspect extérieur : une déclaration préalable est requise.' },
    ite: { label: 'Isolation extérieure', emoji: '🧱', img: eligImg('1621905251189-08b45d6a269e'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'L\'isolation par l\'extérieur change l\'aspect des façades : la déclaration préalable est obligatoire.' },
    solaire: { label: 'Panneaux solaires', emoji: '☀️', img: eligImg('1509391366360-2e959784a276'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Panneaux posés en toiture : DP requise (permis si construction neuve ou secteur protégé).' },
    cloture: { label: 'Clôture & portail', emoji: '🚪', img: eligImg('1558904541-efa843a96f01'), verdict: 'Déclaration préalable', delai: '≈ 1 mois', note: 'Selon la commune, une DP est souvent exigée pour une clôture ou un portail sur rue.' },
    abri: { label: 'Abri de jardin', emoji: '🏡', img: eligImg('1449844908441-8829872d2607'), verdict: 'DP de 5 à 20 m²', delai: '≈ 1 mois', note: 'Emprise ≤ 5 m² : aucune formalité. De 5 à 20 m² : déclaration préalable. Au-delà : permis.' },
    piscine: { label: 'Piscine', emoji: '🏊', img: eligImg('1576013551627-0cc20b96c2a7'), verdict: 'DP de 10 à 100 m²', delai: '≈ 1 mois', note: 'Bassin de 10 à 100 m² non couvert : déclaration préalable.' },
    ravalement: { label: 'Ravalement', emoji: '🎨', img: eligImg('1589939705384-5185137a7f0f'), verdict: 'Selon la commune', delai: '≈ 1 mois', note: 'Obligatoire en secteur protégé ou lorsque la commune l\'impose par délibération.' },
    veranda: { label: 'Véranda', emoji: '🌿', img: eligImg('1616137466211-f939a420be84'), verdict: 'DP jusqu\'à 20 m²', delai: '1 à 2 mois', note: 'Emprise ou surface ≤ 20 m² : déclaration préalable. Au-delà : permis de construire.' },
}
const ELIG_KEYS = ['menuiseries', 'ite', 'solaire', 'cloture', 'abri', 'piscine', 'ravalement', 'veranda']

// ── ROI « Conçu pour les architectes » ──────────────────────────────────────
// Baselines are the DEFAULTS of the interactive simulator; the visitor can change
// the manual time/cost with the sliders. Tool side: ≈ 10 min, and ≈ 52 € the
// dossier on the flagship Cabinet plan (620 € / 12). Per-dossier never below 50 €.
const ROI = { manualMin: 120, manualEur: 100, toolMin: 10, toolEur: 52 }
const frNum = (n: number) => Math.round(n).toLocaleString('fr-FR')
// One decimal, French style (e.g. "1,8").
const frDec = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

interface Plan { key: string; name: string; price: string; unit: string; per: string; tag: string; highlight: boolean; kind: 'primary' | 'secondary'; cta: string; desc: string; features: string[]; contact?: boolean }
// Individual, pay-per-dossier offers. Priced against the alternative: up to
// 100 € and 2 h when a pro does it by hand — 69 € for ≈ 10 min stays a bargain.
const PLANS_USAGE: Plan[] = [
    { key: 'd', name: 'Découverte', price: '0', unit: '€', per: 'pour toujours', tag: '', highlight: false, kind: 'secondary', cta: 'Commencer', desc: 'Pour créer et vérifier votre dossier, sans payer.', features: ['Parcours guidé complet', 'Analyse PLU de votre parcelle', 'Aperçu du CERFA et des pièces', 'Mode test avec filigrane', 'Sauvegarde de vos projets'] },
    { key: 'o', name: 'Dossier complet', price: '69', unit: '€', per: 'par dossier', tag: 'Le plus choisi', highlight: true, kind: 'primary', cta: 'Générer mon dossier', desc: 'Le dossier prêt à déposer, en ≈ 10 minutes.', features: ['Tout de Découverte, plus :', 'CERFA 16702*03 pré-rempli', 'Pièces DP1 à DP8 assemblées', 'Vues « après » générées par IA', 'Notice descriptive rédigée', 'Export PDF & ZIP sans filigrane', '1 série de modifications incluse'] },
    { key: 'p', name: 'Pack Rénovation', price: '179', unit: '€', per: '3 dossiers', tag: '', highlight: false, kind: 'secondary', cta: 'Choisir le pack', desc: 'Plusieurs chantiers ? 59,70 € le dossier.', features: ['Tout de Dossier complet', '3 dossiers, quand vous voulez', 'Modifications illimitées 6 mois', 'Assistance par email prioritaire'] },
]
// Professional subscriptions — the main offer. Sized in dossiers per month so the
// per-dossier price decays from the 69 € unit anchor toward the 50 € floor
// (58 € → ≈ 52 € → sur mesure). It never goes below 50 € the dossier.
const PLANS_ABO: Plan[] = [
    { key: 's', name: 'Studio', price: '290', unit: '€', per: 'par mois', tag: '', highlight: false, kind: 'secondary', cta: 'Essayer 14 jours', desc: 'Indépendants, artisans et petits cabinets.', features: ['5 dossiers par mois — 58 € l\'unité', 'Multi-projets et multi-clients', 'Exports à votre marque', 'Modèles de notices réutilisables', 'Modifications illimitées', 'Sans engagement, résiliable en un clic'] },
    { key: 'c', name: 'Cabinet', price: '620', unit: '€', per: 'par mois', tag: 'Le plus choisi', highlight: true, kind: 'primary', cta: 'Essayer 14 jours', desc: 'Cabinets d\'architecture et maîtres d\'œuvre.', features: ['Tout de Studio, plus :', '12 dossiers par mois — ≈ 52 € l\'unité', '5 utilisateurs inclus', 'Suivi par client et par chantier', 'Support prioritaire sous 4 h', 'Facturation annuelle : −15 %'] },
    { key: 'e', name: 'Agence', price: 'Sur devis', unit: '', per: 'volume sur mesure', tag: '', highlight: false, kind: 'secondary', cta: 'Parler à l\'équipe', contact: true, desc: 'Groupes, réseaux et grands comptes.', features: ['Dossiers et utilisateurs illimités', 'Tarif dégressif — plancher 50 € le dossier', 'Déploiement multi-agences', 'API et intégrations sur mesure', 'SSO et gestion des accès', 'Interlocuteur dédié et formation'] },
]

const INCLUDED = ['Analyse PLU incluse', 'Projets sauvegardés', 'Support par email', 'Hébergé en France', 'Sans engagement']

const CMP_RAW: [string, string, string, string][] = [
    ['Parcours guidé et sauvegarde', 'y', 'y', 'y'],
    ['Analyse PLU de la parcelle', 'y', 'y', 'y'],
    ['Aperçu du CERFA et des pièces', 'y', 'y', 'y'],
    ['Export sans filigrane', 'n', 'y', 'y'],
    ['Pièces DP1 à DP8 assemblées', 'n', 'y', 'y'],
    ['Vues « après » par IA', 'n', 'y', 'y'],
    ['Dossiers inclus', 'n', '1', '10 → illimités'],
    ['Modifications du dossier', 'n', '1 série', 'Illimitées'],
    ['Multi-clients et marque perso.', 'n', 'n', 'y'],
    ['Utilisateurs', '1', '1', '1 → illimités'],
    ['API, SSO, intégrations', 'n', 'n', 'Agence'],
    ['Support', 'Email', 'Email', 'Prioritaire'],
]

interface FaqItem { id: string; q: string; a: string }
const FAQ_DATA: { title: string; items: FaqItem[] }[] = [
    { title: 'La déclaration préalable', items: [
        { id: 'a1', q: 'Qu\'est-ce qu\'une déclaration préalable de travaux ?', a: 'C\'est l\'autorisation d\'urbanisme exigée pour les travaux qui modifient l\'aspect extérieur d\'un bâtiment ou créent une petite surface, sans nécessiter de permis de construire. Elle se dépose en mairie.' },
        { id: 'a2', q: 'Quels travaux nécessitent une DP ?', a: 'Le remplacement de menuiseries, l\'isolation par l\'extérieur, les panneaux solaires, une clôture, un abri de jardin de 5 à 20 m², une piscine de 10 à 100 m², ou un ravalement en secteur protégé.' },
        { id: 'a3', q: 'Ai-je besoin d\'un architecte ?', a: 'La déclaration préalable ne l\'impose pas : un particulier peut constituer lui-même un dossier complet et conforme avec DP Travaux. Les professionnels — architectes, maîtres d\'œuvre, artisans — l\'utilisent aussi pour préparer plus vite les dossiers de leurs clients (offre Pro).' },
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
        { id: 'd4', q: 'Suis-je engagé sur la durée ?', a: 'Aucun engagement pour le paiement à l\'usage. Les abonnements Studio et Cabinet sont résiliables à tout moment.' },
        { id: 'd5', q: 'Comment sont facturés les abonnements professionnels ?', a: 'Chaque formule inclut un volume mensuel de dossiers : 5 avec Studio (290 €, soit 58 € le dossier), 12 avec Cabinet (620 €, soit ≈ 52 € le dossier), sur mesure avec Agence. Le tarif dégressif ne descend jamais sous 50 € le dossier. La facturation annuelle de Cabinet est remisée de 15 %.' },
    ] },
]
const HOME_FAQ_IDS: Record<string, boolean> = { a1: true, a3: true, b1: true, c1: true, d1: true }
const FAQ_ALL: FaqItem[] = FAQ_DATA.flatMap((g) => g.items)

// ── Component ──────────────────────────────────────────────────────────────
export default function MarketingSite({ authed = false }: { authed?: boolean }) {
    // Authenticated visitors' CTAs lead to their space; guests' lead to registration.
    const appHref = authed ? '/profil' : '/register'
    const [page, setPage] = useState<Page>('home')
    // Pros (abonnements) are the primary offer; individuals switch to « à l'usage ».
    const [pricing, setPricing] = useState<'usage' | 'abo'>('abo')
    const [volume, setVolume] = useState(10)
    // Interactive simulator inputs the visitor can tune (manual baseline).
    const [manualMin, setManualMin] = useState(ROI.manualMin)   // minutes/dossier by hand
    const [manualEur, setManualEur] = useState(ROI.manualEur)   // €/dossier by hand
    const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({})
    const [elig, setElig] = useState('menuiseries')
    const [address, setAddress] = useState<{ adresse: string; code_postal: string; commune: string; coords?: { lat: number; lon: number } } | null>(null)
    const [starting, setStarting] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [sent, setSent] = useState(false)
    const [sliderPos, setSliderPos] = useState(52)
    const rootRef = useRef<HTMLDivElement>(null)
    const sliderRef = useRef<HTMLDivElement>(null)
    const draggingRef = useRef(false)

    const go = (p: Page) => {
        setMenuOpen(false)
        if (p === page) { try { window.scrollTo(0, 0) } catch { /* noop */ } return }
        setSent(false)
        setPage(p)
    }
    const goPricing = (mode: 'usage' | 'abo') => { setPricing(mode); go('pricing') }

    // Hero handoff — the validated address must survive into the déclaration:
    //  • guest → stash it (sessionStorage) and go register; AuthForm creates the dossier after auth.
    //  • authed → create the dossier right away, terrain pre-seeded, and open the wizard.
    const startDeclaration = async () => {
        if (!address) return
        try { sessionStorage.setItem('dp-pending-address', JSON.stringify(address)) } catch { /* private mode */ }
        if (!authed) { window.location.href = '/register'; return }
        setStarting(true)
        try {
            const res = await fetch('/api/dossiers', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ terrainAddress: address }),
            })
            if (!res.ok) throw new Error()
            const { dossier } = await res.json()
            try { sessionStorage.removeItem('dp-pending-address') } catch { /* noop */ }
            window.location.href = `/etape/${dossier.id}/1`
        } catch {
            window.location.href = '/profil'
        }
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

    // Before / after comparison slider (ported from the prototype's pointer handlers).
    const clampPos = (x: number) => Math.max(2, Math.min(98, x))
    const posFromX = (clientX: number) => {
        const el = sliderRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setSliderPos(clampPos(((clientX - r.left) / r.width) * 100))
    }
    const onSliderDown = (e: React.PointerEvent) => { draggingRef.current = true; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ } posFromX(e.clientX) }
    const onSliderMove = (e: React.PointerEvent) => { if (draggingRef.current) posFromX(e.clientX) }
    const onSliderUp = (e: React.PointerEvent) => { draggingRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ } }

    // Dynamic style builders (ported from the prototype's render helpers).
    const planCardStyle = (highlight: boolean): CSS => ({
        position: 'relative', display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--surface)', border: '1px solid ' + (highlight ? 'var(--ac)' : 'var(--line)'),
        borderRadius: 18, padding: '30px 26px',
        boxShadow: highlight ? '0 26px 62px -30px rgba(45,90,76,.55)' : '0 1px 2px rgba(37,34,30,.03),0 16px 36px -28px rgba(37,34,30,.22)',
    })
    const planTagStyle: CSS = { position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--ac)', color: '#fff', fontFamily: 'var(--mf)', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', padding: '5px 13px', borderRadius: 100, whiteSpace: 'nowrap' }
    const segStyle = (on: boolean): CSS => ({ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, transition: 'all .15s', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--muted)', boxShadow: on ? '0 2px 6px -3px rgba(37,34,30,.28)' : 'none' })
    const eligTileStyle = (on: boolean): CSS => ({ position: 'relative', height: 92, borderRadius: 13, overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'var(--field)', border: '2px solid ' + (on ? 'var(--ac)' : 'transparent'), outline: on ? 'none' : '1px solid var(--line)', transition: 'transform .16s ease, box-shadow .16s ease', boxShadow: on ? '0 14px 28px -16px rgba(45,90,76,.6)' : '0 1px 2px rgba(37,34,30,.05)', transform: on ? 'translateY(-2px)' : 'none' })

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

    // ROI calculator (home, « Conçu pour les architectes ») — driven by `volume`.
    // Live simulator maths — driven by the three sliders (volume, manual time, manual cost).
    // Tool side is fixed (≈ 10 min, ≈ 52 €/dossier on Cabinet). Savings floored at 0 so a
    // deliberately low manual baseline never shows a negative "gain".
    const manualHMonth = (volume * manualMin) / 60
    const toolHMonth = (volume * ROI.toolMin) / 60
    const manualEurMonth = volume * manualEur
    const toolEurMonth = volume * ROI.toolEur
    const savedHoursMonth = Math.max(0, manualHMonth - toolHMonth)
    const savedEurMonth = Math.max(0, manualEurMonth - toolEurMonth)
    const savedDaysYear = (savedHoursMonth * 12) / 8
    // Bar widths (share of the larger of the two, in %).
    const pct = (v: number, max: number) => max > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0
    const hMax = Math.max(manualHMonth, toolHMonth)
    const eMax = Math.max(manualEurMonth, toolEurMonth)
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
                        {/* Mobile burger — the nav links are hidden ≤760px, this brings them back */}
                        <button data-burger aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}
                            style={s('display:none;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:var(--surface);cursor:pointer;flex-shrink:0')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
                                {menuOpen ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
                            </svg>
                        </button>
                    </div>
                </div>
                {/* Mobile menu panel */}
                {menuOpen && (
                    <div data-mobilemenu style={s('border-top:1px solid var(--line);background:var(--paper);padding:10px 20px 16px;display:flex;flex-direction:column;gap:2px')}>
                        {([['home', 'Accueil'], ['how', 'Comment ça marche'], ['pricing', 'Tarifs'], ['faq', 'FAQ'], ['contact', 'Contact']] as [Page, string][]).map(([p, label]) => (
                            <button key={p} onClick={() => go(p)}
                                style={s(`text-align:left;background:${page === p ? 'var(--act)' : 'transparent'};border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;color:${page === p ? 'var(--acd)' : 'var(--ink)'};padding:12px 14px`)}>
                                {label}
                            </button>
                        ))}
                        {!authed && (
                            <a href={SIGNIN_HREF} style={s('text-decoration:none;font-size:15px;font-weight:600;color:var(--ink-2);padding:12px 14px')}>Se connecter</a>
                        )}
                    </div>
                )}
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
                                <p style={s('font-size:18px;line-height:1.62;color:var(--ink-2);margin:22px 0 0;max-width:53ch')}>Formulaire CERFA, plans, photos et notice : nous assemblons tout et vérifions la conformité au PLU de votre commune. Un dossier complet en 10&nbsp;minutes, que vous soyez particulier ou professionnel.</p>

                                <div style={s('margin:32px 0 0;max-width:470px')}>
                                    <label className="dp-label" style={s('display:block;margin-bottom:8px')}>Commencez par l&apos;adresse de votre terrain</label>
                                    <AddressAutocomplete placeholder="Ex : 24 Rue des Lilas, Lyon" onAddressSelected={(a) => setAddress(a)} />
                                    {address ? (
                                        <div style={s('display:flex;align-items:center;gap:12px;margin-top:15px;flex-wrap:wrap')}>
                                            <span style={s('display:inline-flex;align-items:center;gap:7px;font-size:13.5px;color:var(--acd);font-weight:600')}>
                                                <Check size={15} color="var(--acd)" />
                                                {(address.commune || address.adresse || 'Votre commune')} — PLU disponible
                                            </span>
                                            <button onClick={startDeclaration} disabled={starting} className="dp-btn-primary" style={s('padding:10px 18px;font-size:14px')}>
                                                {starting ? 'Ouverture…' : 'Continuer ma déclaration →'}
                                            </button>
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
                                <div style={s('position:relative;max-width:412px;margin:0 auto')}>
                                    <div style={s('position:absolute;top:24px;right:-16px;bottom:-14px;left:22px;border-radius:22px;background:var(--act);border:1px solid var(--acb);transform:rotate(2.5deg)')}></div>
                                    <div data-anim style={s('position:relative;animation:dpFloat 7.5s ease-in-out infinite;background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 46px 88px -44px rgba(37,34,30,.55);overflow:hidden')}>
                                        <div style={s('position:relative;height:210px;background:var(--field)')}>
                                            <img src={BA_AFTER} alt="Maison après travaux déclarés" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 50%' }} />
                                            <span style={s('position:absolute;inset:0;background:linear-gradient(to top,rgba(30,28,24,.8),rgba(30,28,24,.04) 52%)')}></span>
                                            <span className="dp-chip is-ok" style={s('position:absolute;top:13px;right:13px')}>Prêt à déposer</span>
                                            <div style={s('position:absolute;left:17px;right:17px;bottom:13px')}>
                                                <div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.82)')}>Dossier DP · Extension</div>
                                                <div style={s('font-family:var(--hf);font-size:19px;font-weight:600;color:#fff;line-height:1.15;margin-top:2px;text-shadow:0 1px 4px rgba(0,0,0,.45)')}>24 Rue des Lilas, Lyon</div>
                                            </div>
                                        </div>
                                        <div style={s('padding:8px 20px 20px')}>
                                            <div style={s('display:flex;align-items:center;gap:12px;padding:12px 0')}>
                                                <span style={s('flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center')}><Check size={13} color="#fff" sw={3} /></span>
                                                <span style={s('flex:1;font-size:14.5px;font-weight:500;color:var(--ink)')}>Analyse PLU · Zone UA</span>
                                                <span style={s('font-family:var(--mf);font-size:11.5px;font-weight:600;color:var(--acd)')}>Conforme</span>
                                            </div>
                                            <div style={s('height:1px;background:var(--line-2)')}></div>
                                            <div style={s('display:flex;align-items:center;gap:12px;padding:12px 0')}>
                                                <span style={s('flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center')}><Check size={13} color="#fff" sw={3} /></span>
                                                <span style={s('flex:1;font-size:14.5px;font-weight:500;color:var(--ink)')}>Pièces DP1 à DP8</span>
                                                <span style={s('font-family:var(--mf);font-size:11.5px;font-weight:600;color:var(--acd)')}>8 / 8</span>
                                            </div>
                                            <div style={s('height:1px;background:var(--line-2)')}></div>
                                            <div style={s('display:flex;align-items:center;gap:12px;padding:12px 0')}>
                                                <span style={s('flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center')}><Check size={13} color="#fff" sw={3} /></span>
                                                <span style={s('flex:1;font-size:14.5px;font-weight:500;color:var(--ink)')}>CERFA 16702*03</span>
                                                <span style={s('font-family:var(--mf);font-size:11.5px;font-weight:600;color:var(--acd)')}>Rempli</span>
                                            </div>
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
                            <div style={s('text-align:center;font-family:var(--mf);font-size:10px;color:var(--faint);margin-top:16px')}>Durées moyennes constatées, à titre indicatif · couverture France entière</div>
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

                    {/* HOW — VISUAL WALKTHROUGH */}
                    <section style={s('max-width:1120px;margin:0 auto;padding:82px 28px 10px')}>
                        <div data-reveal style={s('max-width:640px;margin:0 auto 56px;text-align:center')}>
                            <span className="dp-eyebrow">Démonstration</span>
                            <h2 style={sectionHeadH2}>Le dossier se construit <span style={italicAc}>sous vos yeux</span>.</h2>
                        </div>

                        {/* Row 1 : Décrivez */}
                        <div data-reveal data-wrow style={s('display:grid;grid-template-columns:1fr 1.04fr;gap:52px;align-items:center;margin-bottom:64px')}>
                            <div>
                                <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:16px')}><span style={s('font-family:var(--hf);font-size:15px;font-weight:600;color:#fff;width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));display:flex;align-items:center;justify-content:center')}>01</span><span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)')}>≈ 5 minutes</span></div>
                                <h3 style={s('font-family:var(--hf);font-size:26px;font-weight:600;color:var(--ink);margin:0 0 10px;letter-spacing:-.01em')}>Décrivez votre projet</h3>
                                <p style={s('font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0 0 18px;max-width:44ch')}>L&apos;adresse suffit pour retrouver la parcelle. On vous guide, champ après champ, sans jargon.</p>
                                <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Adresse &amp; cadastre</span>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Nature des travaux</span>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Matériaux &amp; teintes</span>
                                </div>
                            </div>
                            <div style={s('position:relative')}>
                                <div style={s('background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 34px 66px -40px rgba(37,34,30,.5);padding:24px')}>
                                    <div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:14px')}>Votre projet</div>
                                    <label className="dp-label" style={s('display:block;margin-bottom:6px')}>Adresse du terrain</label>
                                    <div style={s('display:flex;align-items:center;gap:10px;border:1px solid var(--acb);background:var(--act);border-radius:11px;padding:11px 13px;margin-bottom:16px')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acd)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>
                                        <span style={s('font-size:13.5px;font-weight:600;color:var(--ink)')}>24 Rue des Lilas, 69003 Lyon</span>
                                    </div>
                                    <label className="dp-label" style={s('display:block;margin-bottom:8px')}>Type de travaux</label>
                                    <div style={s('display:flex;flex-wrap:wrap;gap:7px')}>
                                        <span style={s('display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--acd);background:var(--act);border:1px solid var(--ac);padding:7px 12px;border-radius:9px')}><Check size={12} color="var(--acd)" sw={3} />Menuiseries</span>
                                        <span style={s('font-size:12.5px;color:var(--muted);background:var(--field);border:1px solid var(--line-2);padding:7px 12px;border-radius:9px')}>Ravalement</span>
                                        <span style={s('font-size:12.5px;color:var(--muted);background:var(--field);border:1px solid var(--line-2);padding:7px 12px;border-radius:9px')}>Clôture</span>
                                        <span style={s('font-size:12.5px;color:var(--muted);background:var(--field);border:1px solid var(--line-2);padding:7px 12px;border-radius:9px')}>Solaire</span>
                                    </div>
                                    <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px')}>
                                        <div><div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:5px')}>Fenêtres</div><div style={s('height:34px;border-radius:8px;background:var(--field);border:1px solid var(--line-2);display:flex;align-items:center;padding:0 11px;font-size:13px;color:var(--ink)')}>6 · Bois</div></div>
                                        <div><div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:5px')}>Teinte RAL</div><div style={s('height:34px;border-radius:8px;background:var(--field);border:1px solid var(--line-2);display:flex;align-items:center;gap:8px;padding:0 11px;font-size:13px;color:var(--ink)')}><span style={s('width:14px;height:14px;border-radius:4px;background:#7B8B6F;border:1px solid rgba(0,0,0,.15)')}></span>6013</div></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 2 : Vérifiez (visual left) */}
                        <div data-reveal data-wrow style={s('display:grid;grid-template-columns:1.04fr 1fr;gap:52px;align-items:center;margin-bottom:64px')}>
                            <div style={s('grid-column:1;grid-row:1')}>
                                <div style={s('position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 34px 66px -40px rgba(37,34,30,.5);padding:24px')}>
                                    <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:16px')}>
                                        <span style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Analyse PLU · Parcelle AK 0142</span>
                                        <span style={s('font-family:var(--mf);font-size:10px;font-weight:600;color:var(--acd);background:var(--act);border:1px solid var(--acb);padding:3px 8px;border-radius:6px')}>ZONE UA</span>
                                    </div>
                                    <div style={s('display:flex;flex-direction:column;gap:9px')}>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border:1px solid var(--acb);background:var(--act);border-radius:10px')}><span style={s('font-size:13.5px;color:var(--ink);font-weight:500')}>Hauteur ≤ 9 m</span><span className="dp-chip is-ok" style={s('font-size:11px')}>Conforme</span></div>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border:1px solid var(--acb);background:var(--act);border-radius:10px')}><span style={s('font-size:13.5px;color:var(--ink);font-weight:500')}>Menuiseries bois autorisées</span><span className="dp-chip is-ok" style={s('font-size:11px')}>Conforme</span></div>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border:1px solid #E3C9A6;background:#FBF3E6;border-radius:10px')}><span style={s('font-size:13.5px;color:var(--ink);font-weight:500')}>Secteur ABF — teinte imposée</span><span className="dp-chip is-missing" style={s('font-size:11px')}>À vérifier</span></div>
                                    </div>
                                    <div data-anim style={s('position:absolute;top:52px;bottom:0;left:0;width:34%;background:linear-gradient(90deg,transparent,rgba(45,90,76,.14),transparent);animation:dpScan 3s linear infinite;pointer-events:none')}></div>
                                </div>
                            </div>
                            <div style={s('grid-column:2;grid-row:1')}>
                                <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:16px')}><span style={s('font-family:var(--hf);font-size:15px;font-weight:600;color:#fff;width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));display:flex;align-items:center;justify-content:center')}>02</span><span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)')}>Automatique</span></div>
                                <h3 style={s('font-family:var(--hf);font-size:26px;font-weight:600;color:var(--ink);margin:0 0 10px;letter-spacing:-.01em')}>L&apos;analyse PLU repère les pièges</h3>
                                <p style={s('font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0 0 18px;max-width:44ch')}>On croise votre projet avec le règlement de votre zone et signale les secteurs protégés — avant que la mairie ne le fasse.</p>
                                <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Règlement de zone</span>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Détection ABF / SPR</span>
                                </div>
                            </div>
                        </div>

                        {/* Row 3 : Générez (before/after slider) */}
                        <div data-reveal data-wrow style={s('display:grid;grid-template-columns:1fr 1.04fr;gap:52px;align-items:center;margin-bottom:64px')}>
                            <div>
                                <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:16px')}><span style={s('font-family:var(--hf);font-size:15px;font-weight:600;color:#fff;width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));display:flex;align-items:center;justify-content:center')}>03</span><span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)')}>Généré pour vous</span></div>
                                <h3 style={s('font-family:var(--hf);font-size:26px;font-weight:600;color:var(--ink);margin:0 0 10px;letter-spacing:-.01em')}>Vos pièces graphiques, prêtes</h3>
                                <p style={s('font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0 0 18px;max-width:44ch')}>Plans, notice et surtout l&apos;insertion paysagère « après » (DP6) générée par IA à partir de vos photos.</p>
                                <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Insertion DP6 par IA</span>
                                    <span style={s('font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);padding:6px 11px;border-radius:8px')}>Notice DP4 rédigée</span>
                                </div>
                            </div>
                            <div style={s('background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 34px 66px -40px rgba(37,34,30,.5);padding:16px')}>
                                <div style={s('display:flex;align-items:center;justify-content:space-between;padding:2px 4px 12px')}><span style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>DP6 · Insertion paysagère</span><span style={s('font-family:var(--mf);font-size:10px;color:var(--acd);display:inline-flex;align-items:center;gap:5px')}><span style={s('width:6px;height:6px;border-radius:50%;background:var(--ac)')}></span>Généré par IA</span></div>
                                <div ref={sliderRef} onPointerDown={onSliderDown} onPointerMove={onSliderMove} onPointerUp={onSliderUp} style={s('position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--line-2);aspect-ratio:4/3;max-width:400px;margin:0 auto;background:var(--field);cursor:ew-resize;touch-action:none;user-select:none;-webkit-user-select:none')}>
                                    <img src={BA_AFTER} alt="Façade après travaux" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                                    <img src={BA_BEFORE} alt="Façade avant travaux" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }} />
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2, background: '#fff', transform: 'translateX(-1px)', boxShadow: '0 0 0 1px rgba(37,34,30,.18)', pointerEvents: 'none' }}>
                                        <div style={s('position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 4px 14px -3px rgba(37,34,30,.5),0 0 0 1px rgba(37,34,30,.1);display:flex;align-items:center;justify-content:center')}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--acd)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 8L6 12l3.5 4" /><path d="M14.5 8l3.5 4-3.5 4" /></svg>
                                        </div>
                                    </div>
                                    <span style={s('position:absolute;bottom:10px;left:10px;z-index:2;pointer-events:none;font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;color:#fff;background:rgba(37,34,30,.72);padding:3px 8px;border-radius:6px')}>AVANT</span>
                                    <span style={s('position:absolute;bottom:10px;right:10px;z-index:2;pointer-events:none;font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;color:#fff;background:var(--acd);padding:3px 8px;border-radius:6px')}>APRÈS</span>
                                </div>
                                <div style={s('display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 12px;background:var(--act);border:1px solid var(--acb);border-radius:10px')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--acd)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3" /></svg><span style={s('font-size:12.5px;color:var(--acd);font-weight:600')}>Glissez le curseur pour comparer avant / après</span></div>
                            </div>
                        </div>

                        {/* Row 4 : Déposez (visual left) */}
                        <div data-reveal data-wrow style={s('display:grid;grid-template-columns:1.04fr 1fr;gap:52px;align-items:center')}>
                            <div style={s('grid-column:1;grid-row:1')}>
                                <div style={s('background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 34px 66px -40px rgba(37,34,30,.5);overflow:hidden')}>
                                    <div style={s('display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line-2);background:var(--surface-2)')}><span style={s('font-family:var(--hf);font-size:14px;font-weight:600;color:var(--ink)')}>Dossier DP — 24 Rue des Lilas</span><span className="dp-chip is-ok">Prêt à déposer</span></div>
                                    <div style={s('padding:18px')}>
                                        <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px')}>
                                            {PIECE_THUMBS.map((pt) => (
                                                <div key={pt.code} style={s('border:1px solid var(--acb);border-radius:9px;overflow:hidden;background:var(--act)')}><div style={{ height: 34, background: pt.bg }}></div><div style={s('display:flex;align-items:center;justify-content:center;gap:4px;font-family:var(--mf);font-size:8.5px;letter-spacing:.03em;color:var(--acd);padding:4px 0')}><Check size={9} color="var(--acd)" sw={3.4} />{pt.code}</div></div>
                                            ))}
                                        </div>
                                        <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px')}>
                                            <div style={s('flex:1')}><div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:9.5px;letter-spacing:.04em;color:var(--muted);margin-bottom:5px')}><span>DOSSIER COMPLET</span><span>8 / 8</span></div><div style={s('height:6px;border-radius:4px;background:var(--line-2);overflow:hidden')}><div style={s('height:100%;width:100%;background:linear-gradient(90deg,var(--ac),var(--acd))')}></div></div></div>
                                            <span style={s('display:inline-flex;align-items:center;gap:7px;background:var(--ac);color:#fff;font-size:12.5px;font-weight:600;padding:9px 15px;border-radius:10px;white-space:nowrap')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 21h16" /></svg>PDF · ZIP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={s('grid-column:2;grid-row:1')}>
                                <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:16px')}><span style={s('font-family:var(--hf);font-size:15px;font-weight:600;color:#fff;width:38px;height:38px;border-radius:11px;background:linear-gradient(155deg,var(--ac),var(--acd));display:flex;align-items:center;justify-content:center')}>04</span><span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)')}>Le livrable</span></div>
                                <h3 style={s('font-family:var(--hf);font-size:26px;font-weight:600;color:var(--ink);margin:0 0 10px;letter-spacing:-.01em')}>Déposez, tout est là</h3>
                                <p style={s('font-size:15.5px;line-height:1.6;color:var(--ink-2);margin:0 0 18px;max-width:44ch')}>CERFA rempli et pièces DP1 à DP8 réunies en un dossier unique, avec le guide de dépôt en mairie ou en ligne.</p>
                                <button className="dp-btn-secondary" onClick={() => go('how')} style={s('padding:12px 22px')}>Voir le détail des 7 étapes →</button>
                            </div>
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
                            <div data-elig-grid style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:11px')}>
                                {ELIG_KEYS.map((k) => {
                                    const on = elig === k
                                    return (
                                        <button key={k} onClick={() => setElig(k)} style={eligTileStyle(on)}>
                                            <img src={ELIG_MAP[k].img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <span style={s('position:absolute;inset:0;background:linear-gradient(to top, rgba(30,28,24,.72), rgba(30,28,24,.12) 55%, rgba(30,28,24,.02))')}></span>
                                            <span style={s('position:absolute;left:11px;bottom:9px;right:34px;z-index:2;color:#fff;font-family:inherit;font-size:13px;font-weight:600;text-align:left;line-height:1.2;text-shadow:0 1px 3px rgba(0,0,0,.4)')}>{ELIG_MAP[k].label}</span>
                                            <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--ac)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.3)', opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(.6)', transition: 'opacity .16s ease, transform .16s ease' }}><Check size={12} color="#fff" sw={3.4} /></span>
                                        </button>
                                    )
                                })}
                            </div>
                            <div className="dp-card dp-spec" style={s('padding:0;overflow:hidden;position:sticky;top:88px')}>
                                <div style={s('position:relative;height:150px;background:var(--field)')}>
                                    <img src={ev.img} alt={ev.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <span style={s('position:absolute;inset:0;background:linear-gradient(to top,rgba(30,28,24,.66),rgba(30,28,24,.05) 62%)')}></span>
                                    <div style={s('position:absolute;left:20px;bottom:14px;right:20px')}>
                                        <div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.82)')}>Régime d&apos;urbanisme</div>
                                        <div style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:#fff;line-height:1.1;margin-top:3px;text-shadow:0 1px 4px rgba(0,0,0,.4)')}>{ev.label}</div>
                                    </div>
                                </div>
                                <div style={s('padding:22px 24px 24px')}>
                                    <div className="dp-alert is-ok" style={s('margin-bottom:16px')}><span className="dp-alert-title">Formalité</span><div style={s('font-size:16px;font-weight:600;color:var(--acd)')}>{ev.verdict}</div></div>
                                    <div style={s('display:flex;gap:10px;margin-bottom:16px')}>
                                        <div style={s('flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px 14px')}><div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Instruction</div><div style={s('font-size:15px;font-weight:600;color:var(--ink);margin-top:4px')}>{ev.delai}</div></div>
                                        <div style={s('flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:13px 14px')}><div style={s('font-family:var(--mf);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)')}>Architecte</div><div style={s('font-size:15px;font-weight:600;color:var(--ink);margin-top:4px')}>Non requis</div></div>
                                    </div>
                                    <p style={s('font-size:14px;line-height:1.55;color:var(--ink-2);margin:0 0 18px')}>{ev.note}</p>
                                    <a href={appHref} className="dp-btn-primary" style={s('text-decoration:none;width:100%;justify-content:center')}>Déclarer ce projet</a>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* MADE FOR ARCHITECTS — INTERACTIVE ROI SIMULATOR */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:680px;margin:0 auto 40px;text-align:center')}>
                            <span className="dp-eyebrow">Conçu pour les architectes</span>
                            <h2 style={sectionHeadH2}>Comparez votre méthode <span style={italicAc}>actuelle</span> à DP&nbsp;Travaux.</h2>
                            <p style={s('font-size:16.5px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:58ch')}>Réglez vos paramètres — volume, temps et coût d&apos;un dossier fait à la main — et voyez en direct ce que change le passage à DP&nbsp;Travaux (≈&nbsp;10&nbsp;min et ≈&nbsp;52&nbsp;€ le dossier).</p>
                        </div>

                        <div className="dp-card" style={s('padding:0;overflow:hidden')}>
                            <div data-sim style={s('display:grid;grid-template-columns:.82fr 1.18fr')}>
                                {/* ── Controls ── */}
                                <div style={s('padding:30px 28px;background:var(--surface-2);border-right:1px solid var(--line-2)')}>
                                    <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:22px')}>Votre situation actuelle</div>

                                    <div style={s('margin-bottom:26px')}>
                                        <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px')}><label className="dp-label" style={s('margin:0')}>Dossiers par mois</label><span style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink)')}>{volume}</span></div>
                                        <input type="range" min={1} max={60} step={1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Dossiers par mois" style={s('width:100%;cursor:pointer;margin:8px 0 4px')} />
                                        <div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:10px;color:var(--faint)')}><span>1</span><span>60</span></div>
                                    </div>

                                    <div style={s('margin-bottom:26px')}>
                                        <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px')}><label className="dp-label" style={s('margin:0')}>Temps par dossier, à la main</label><span style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink)')}>{frDec(manualMin / 60)} h</span></div>
                                        <input type="range" min={30} max={240} step={15} value={manualMin} onChange={(e) => setManualMin(Number(e.target.value))} aria-label="Temps par dossier à la main" style={s('width:100%;cursor:pointer;margin:8px 0 4px')} />
                                        <div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:10px;color:var(--faint)')}><span>30 min</span><span>4 h</span></div>
                                    </div>

                                    <div>
                                        <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px')}><label className="dp-label" style={s('margin:0')}>Coût par dossier, à la main</label><span style={s('font-family:var(--hf);font-size:22px;font-weight:600;color:var(--ink)')}>{frNum(manualEur)} €</span></div>
                                        <input type="range" min={40} max={200} step={5} value={manualEur} onChange={(e) => setManualEur(Number(e.target.value))} aria-label="Coût par dossier à la main" style={s('width:100%;cursor:pointer;margin:8px 0 4px')} />
                                        <div style={s('display:flex;justify-content:space-between;font-family:var(--mf);font-size:10px;color:var(--faint)')}><span>40 €</span><span>200 €</span></div>
                                    </div>

                                    <div style={s('margin-top:24px;padding-top:18px;border-top:1px solid var(--line-2);font-family:var(--mf);font-size:10.5px;line-height:1.6;color:var(--faint)')}>Côté DP&nbsp;Travaux : ≈&nbsp;10&nbsp;min et ≈&nbsp;52&nbsp;€ le dossier (offre Cabinet), conformité PLU vérifiée avant dépôt.</div>
                                </div>

                                {/* ── Live comparison ── */}
                                <div style={s('padding:30px 30px 26px')}>
                                    {/* Temps / mois */}
                                    <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px')}>
                                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)')}>Temps de travail par mois</span>
                                        <span style={s('font-size:12.5px;color:var(--acd);font-weight:600')}>− {frDec(savedHoursMonth)} h</span>
                                    </div>
                                    {[
                                        { label: 'À la main', val: manualHMonth, w: pct(manualHMonth, hMax), ac: false },
                                        { label: 'DP Travaux', val: toolHMonth, w: pct(toolHMonth, hMax), ac: true },
                                    ].map((b) => (
                                        <div key={b.label} style={s('display:flex;align-items:center;gap:12px;margin-bottom:10px')}>
                                            <span style={s('flex:0 0 82px;font-size:12.5px;color:var(--ink-2)')}>{b.label}</span>
                                            <div style={s('flex:1;height:26px;background:var(--field);border-radius:7px;overflow:hidden')}>
                                                <div style={{ height: '100%', width: `${b.w}%`, borderRadius: 7, background: b.ac ? 'linear-gradient(90deg,var(--ac),var(--acd))' : 'var(--line-3)', transition: 'width .35s cubic-bezier(.2,.7,.2,1)' }} />
                                            </div>
                                            <span style={{ flex: '0 0 74px', textAlign: 'right', fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: b.ac ? 'var(--acd)' : 'var(--ink)' }}>{frDec(b.val)} h</span>
                                        </div>
                                    ))}

                                    {/* Coût / mois */}
                                    <div style={s('display:flex;align-items:baseline;justify-content:space-between;margin:22px 0 14px')}>
                                        <span style={s('font-family:var(--mf);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)')}>Coût de production par mois</span>
                                        <span style={s('font-size:12.5px;color:var(--acd);font-weight:600')}>− {frNum(savedEurMonth)} €</span>
                                    </div>
                                    {[
                                        { label: 'À la main', val: manualEurMonth, w: pct(manualEurMonth, eMax), ac: false },
                                        { label: 'DP Travaux', val: toolEurMonth, w: pct(toolEurMonth, eMax), ac: true },
                                    ].map((b) => (
                                        <div key={b.label} style={s('display:flex;align-items:center;gap:12px;margin-bottom:10px')}>
                                            <span style={s('flex:0 0 82px;font-size:12.5px;color:var(--ink-2)')}>{b.label}</span>
                                            <div style={s('flex:1;height:26px;background:var(--field);border-radius:7px;overflow:hidden')}>
                                                <div style={{ height: '100%', width: `${b.w}%`, borderRadius: 7, background: b.ac ? 'linear-gradient(90deg,var(--ac),var(--acd))' : 'var(--line-3)', transition: 'width .35s cubic-bezier(.2,.7,.2,1)' }} />
                                            </div>
                                            <span style={{ flex: '0 0 74px', textAlign: 'right', fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: b.ac ? 'var(--acd)' : 'var(--ink)' }}>{frNum(b.val)} €</span>
                                        </div>
                                    ))}

                                    {/* Savings headline */}
                                    <div data-simstats style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px')}>
                                        <div style={s('background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:15px 12px;text-align:center')}>
                                            <div style={s('font-family:var(--hf);font-size:clamp(20px,2.3vw,26px);font-weight:600;color:var(--ink);line-height:1')}>{frDec(savedHoursMonth)} h</div>
                                            <div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:7px')}>Gagnées / mois</div>
                                        </div>
                                        <div style={s('background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:15px 12px;text-align:center')}>
                                            <div style={s('font-family:var(--hf);font-size:clamp(20px,2.3vw,26px);font-weight:600;color:var(--ink);line-height:1')}>{frNum(savedEurMonth)} €</div>
                                            <div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:7px')}>Économisés / mois</div>
                                        </div>
                                        <div style={s('background:var(--act);border:1px solid var(--acb);border-radius:12px;padding:15px 12px;text-align:center')}>
                                            <div style={s('font-family:var(--hf);font-size:clamp(20px,2.3vw,26px);font-weight:600;color:var(--acd);line-height:1')}>{frNum(savedEurMonth * 12)} €</div>
                                            <div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--acd);margin-top:7px')}>Par an · ≈ {frNum(savedDaysYear)} j ouvrés</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer band */}
                            <div style={s('display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line-2);background:var(--surface-2);padding:16px 28px')}>
                                <span style={s('font-family:var(--mf);font-size:10.5px;color:var(--faint);line-height:1.5;max-width:60ch')}>Estimation indicative à partir de vos paramètres · côté DP&nbsp;Travaux : ≈&nbsp;10&nbsp;min et ≈&nbsp;52&nbsp;€ le dossier (offre Cabinet).</span>
                                <button className="dp-btn-primary" onClick={() => goPricing('abo')} style={s('flex-shrink:0')}>Voir les offres pro →</button>
                            </div>
                        </div>
                    </section>

                    {/* PRICING TEASER */}
                    <section data-reveal style={s('max-width:1120px;margin:0 auto;padding:78px 28px 20px')}>
                        <div style={s('max-width:660px;margin:0 auto 46px;text-align:center')}>
                            <span className="dp-eyebrow">Tarifs</span>
                            <h2 style={sectionHeadH2}>Dès 52 € le dossier, <span style={italicAc}>selon votre volume</span>.</h2>
                            <p style={s('font-size:16.5px;line-height:1.6;color:var(--ink-2);margin:14px auto 0;max-width:54ch')}>Des abonnements pensés pour les cabinets qui déposent chaque semaine — et un tarif à l&apos;unité pour les particuliers.</p>
                        </div>
                        <div data-grid3 style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch')}>
                            {PLANS_ABO.map((p) => (
                                <div key={p.key} style={planCardStyle(p.highlight)}>
                                    {p.highlight && <span style={planTagStyle}>{p.tag}</span>}
                                    <div style={s('font-family:var(--hf);font-size:19px;font-weight:600;color:var(--ink)')}>{p.name}</div>
                                    <div style={s('display:flex;align-items:baseline;gap:4px;margin:12px 0 4px')}><span style={{ fontFamily: 'var(--hf)', fontSize: p.contact ? 30 : 42, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{p.price}</span><span style={s('font-size:20px;color:var(--ink)')}>{p.unit}</span><span style={s('font-size:13px;color:var(--muted);margin-left:2px')}>{p.per}</span></div>
                                    <div style={s('font-size:14px;line-height:1.5;color:var(--ink-2);margin-bottom:20px;min-height:42px')}>{p.desc}</div>
                                    {p.contact ? (
                                        <button className="dp-btn-secondary" onClick={() => go('contact')} style={s('width:100%;justify-content:center')}>{p.cta}</button>
                                    ) : (
                                        <a href={appHref} className={p.kind === 'primary' ? 'dp-btn-primary' : 'dp-btn-secondary'} style={s('text-decoration:none;width:100%;justify-content:center')}>{p.cta}</a>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={s('display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:30px')}>
                            <button className="dp-btn-secondary" onClick={() => goPricing('usage')} style={s('padding:12px 22px')}>Particulier ? Un dossier à l&apos;unité à 69 € →</button>
                            <button className="dp-btn-secondary" onClick={() => goPricing('abo')} style={s('padding:12px 22px')}>Comparer tous les tarifs →</button>
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
                                        <div style={s('width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--line-2)')}><img src={t.avatar} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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
                                    <span style={s('font-family:var(--mf);font-size:12px;letter-spacing:.04em;color:rgba(255,255,255,.75)')}>≈ 10 minutes</span>
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
                            <p style={s('font-size:18px;line-height:1.6;color:var(--ink-2);margin:16px auto 26px;max-width:54ch')}>Pensé pour les cabinets et agences qui déposent des dossiers chaque semaine — dès 52&nbsp;€ le dossier. Les particuliers paient à l&apos;unité, seulement à la génération.</p>
                            <div style={s('display:inline-flex;gap:4px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:4px')}>
                                <button onClick={() => setPricing('abo')} style={segStyle(pricing === 'abo')}>Professionnels</button>
                                <button onClick={() => setPricing('usage')} style={segStyle(pricing === 'usage')}>Particuliers · à l&apos;unité</button>
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
                                    <div style={s('display:flex;align-items:baseline;gap:4px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--line-2)')}><span style={{ fontFamily: 'var(--hf)', fontSize: p.contact ? 32 : 46, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{p.price}</span><span style={s('font-size:22px;color:var(--ink)')}>{p.unit}</span><span style={s('font-size:13px;color:var(--muted);margin-left:3px')}>{p.per}</span></div>
                                    <ul style={s('margin:0 0 22px;padding:0;list-style:none;display:flex;flex-direction:column;gap:11px;flex:1')}>
                                        {p.features.map((f) => (
                                            <li key={f} style={s('display:flex;gap:10px;font-size:14px;line-height:1.45;color:var(--ink-2)')}><span style={s('flex-shrink:0;margin-top:2px')}><Check size={16} sw={2.4} /></span>{f}</li>
                                        ))}
                                    </ul>
                                    {p.contact ? (
                                        <button className="dp-btn-secondary" onClick={() => go('contact')} style={s('width:100%;justify-content:center')}>{p.cta}</button>
                                    ) : (
                                        <a href={appHref} className={p.kind === 'primary' ? 'dp-btn-primary' : 'dp-btn-secondary'} style={s('text-decoration:none;width:100%;justify-content:center')}>{p.cta}</a>
                                    )}
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
                                            <th style={s('padding:16px 14px;font-family:var(--hf);font-size:15px;font-weight:600;color:var(--ink)')}>À l&apos;unité</th>
                                            <th style={s('padding:16px 14px;font-family:var(--hf);font-size:15px;font-weight:600;color:var(--acd);background:var(--act)')}>Abonnements Pro</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CMP_RAW.map((r) => {
                                            const c0 = cmpCell(r[1]), c1 = cmpCell(r[2]), c2 = cmpCell(r[3])
                                            return (
                                                <tr key={r[0]} style={s('border-top:1px solid var(--line-2)')}>
                                                    <td style={s('padding:14px 22px;color:var(--ink);font-weight:500')}>{r[0]}</td>
                                                    <td style={s('padding:14px 14px;text-align:center;color:var(--ink-2)')}><span style={c0.st}>{c0.c}</span></td>
                                                    <td style={s('padding:14px 14px;text-align:center;color:var(--ink-2)')}><span style={c1.st}>{c1.c}</span></td>
                                                    <td style={s('padding:14px 14px;text-align:center;background:var(--act);color:var(--ink)')}><span style={c2.st}>{c2.c}</span></td>
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
                                    <p style={s('font-size:13.5px;line-height:1.5;color:var(--ink-2);margin:0 0 14px')}>Architectes, maîtres d&apos;œuvre et artisans : des abonnements dès 290 €/mois, soit ≈ 52 € le dossier avec l&apos;offre Cabinet.</p>
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
                                <div><div style={s('font-family:var(--hf);font-size:16px;font-weight:600;color:#fff')}>DP Travaux</div><div style={s('font-family:var(--mf);font-size:9.5px;letter-spacing:.08em;color:rgba(255,255,255,.5);text-transform:uppercase')}>CERFA 16702*03</div></div>
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
                        <div style={s('font-family:var(--mf);font-size:11px;letter-spacing:.04em;color:rgba(255,255,255,.4)')}>Formulaire CERFA n° 16702*03</div>
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
#site input[type=range]{accent-color:var(--ac)}
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
@media (max-width:860px){#site [data-hero]{grid-template-columns:1fr!important}#site [data-hero-visual]{display:none!important}#site [data-col2]{grid-template-columns:1fr!important}#site [data-split]{grid-template-columns:1fr!important}#site [data-sim]{grid-template-columns:1fr!important}#site [data-sim] > div:first-child{border-right:none!important;border-bottom:1px solid var(--line-2)!important}}
@media (max-width:480px){#site [data-simstats]{grid-template-columns:1fr!important}}
@media (max-width:820px){#site [data-wrow]{grid-template-columns:1fr!important;gap:26px!important}#site [data-wrow] > *{grid-column:auto!important;grid-row:auto!important}}
@media (max-width:760px){#site [data-navlinks]{display:none!important}#site [data-headcta]{margin-left:auto}#site [data-burger]{display:flex!important}#site [data-grid3]{grid-template-columns:1fr!important}#site [data-grid2]{grid-template-columns:repeat(2,1fr)!important}#site [data-elig]{grid-template-columns:1fr!important}#site [data-elig-grid]{grid-template-columns:repeat(2,1fr)!important}#site [data-foot]{grid-template-columns:1fr 1fr!important}}
@media (max-width:520px){#site header > div{padding-left:16px!important;padding-right:16px!important;gap:12px!important}#site [data-logosub]{display:none!important}#site [data-signin]{display:none!important}#site [data-foot]{grid-template-columns:1fr!important}}
@media (min-width:761px){#site [data-mobilemenu]{display:none!important}}
`
