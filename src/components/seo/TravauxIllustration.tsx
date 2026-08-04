// ─────────────────────────────────────────────────────────────────────────────
// Illustrations des types de travaux — schémas au trait, dans le langage
// « dossier d'architecte » du design system : cotes, lignes de sol, hachures.
//
// Ce sont des SVG en ligne, pas des images : aucun poids réseau, mise à l'échelle
// parfaite, et les couleurs suivent les tokens (donc le thème) automatiquement.
// Une photographie générique de banque d'images aurait affaibli le propos ; un
// croquis coté dit exactement ce dont la page parle.
// ─────────────────────────────────────────────────────────────────────────────
import type { TravauxId } from '@/lib/travauxRegistry'

const AC = 'var(--ac)'
const INK = 'var(--ink-2)'
const FAINT = 'var(--faint)'
const TINT = 'var(--act)'

/** Ligne de terrain naturel, commune à tous les croquis. */
function Sol({ y = 116, x1 = 8, x2 = 232 }: { y?: number; x1?: number; x2?: number }) {
    return (
        <>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={INK} strokeWidth="1.4" />
            {Array.from({ length: Math.floor((x2 - x1) / 12) }).map((_, i) => (
                <line key={i} x1={x1 + i * 12} y1={y} x2={x1 + i * 12 - 5} y2={y + 6} stroke={FAINT} strokeWidth="1" />
            ))}
        </>
    )
}

/** Cote horizontale avec flèches et libellé. */
function Cote({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
    return (
        <g>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={AC} strokeWidth="1" />
            <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={AC} strokeWidth="1" />
            <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={AC} strokeWidth="1" />
            <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">{label}</text>
        </g>
    )
}

const SHAPES: Record<TravauxId, React.ReactNode> = {
    // Abri isolé : volume simple + cote d'emprise, le sujet de la page.
    abri: (
        <>
            <Sol />
            <rect x="72" y="62" width="96" height="54" fill={TINT} stroke={AC} strokeWidth="1.6" />
            <path d="M64 62 L120 34 L176 62 Z" fill="none" stroke={AC} strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="104" y="84" width="32" height="32" fill="none" stroke={INK} strokeWidth="1.2" />
            <Cote x1={72} x2={168} y={132} label="≤ 20 m²" />
        </>
    ),
    // Piscine : bassin en coupe, margelles, profondeur cotée.
    piscine: (
        <>
            <Sol />
            <path d="M60 116 L60 74 L180 74 L180 116" fill={TINT} stroke={AC} strokeWidth="1.6" />
            <line x1="52" y1="74" x2="188" y2="74" stroke={INK} strokeWidth="2.2" />
            <path d="M64 84 q14 -6 28 0 t28 0 t28 0 t20 0" fill="none" stroke={AC} strokeWidth="1.2" opacity=".7" />
            <line x1="196" y1="74" x2="196" y2="116" stroke={AC} strokeWidth="1" />
            <line x1="192" y1="74" x2="200" y2="74" stroke={AC} strokeWidth="1" />
            <line x1="192" y1="116" x2="200" y2="116" stroke={AC} strokeWidth="1" />
            <text x="204" y="98" fill={AC} fontSize="9" fontFamily="var(--mf)">prof.</text>
            <Cote x1={60} x2={180} y={136} label="10 – 100 m²" />
        </>
    ),
    // Panneaux : pan de toit + champ de modules en surimposition.
    photovoltaique: (
        <>
            <Sol />
            <path d="M46 116 L46 78 L120 40 L194 78 L194 116" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M62 82 L118 53 L118 74 L62 100 Z" fill={TINT} stroke={AC} strokeWidth="1.5" strokeLinejoin="round" />
            <line x1="76" y1="79" x2="76" y2="96" stroke={AC} strokeWidth=".9" opacity=".8" />
            <line x1="90" y1="72" x2="90" y2="90" stroke={AC} strokeWidth=".9" opacity=".8" />
            <line x1="104" y1="65" x2="104" y2="83" stroke={AC} strokeWidth=".9" opacity=".8" />
            <line x1="62" y1="91" x2="118" y2="63" stroke={AC} strokeWidth=".9" opacity=".8" />
            <circle cx="176" cy="40" r="9" fill="none" stroke={AC} strokeWidth="1.3" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
                <line key={a} x1={176 + 13 * Math.cos(a * Math.PI / 180)} y1={40 + 13 * Math.sin(a * Math.PI / 180)}
                    x2={176 + 17 * Math.cos(a * Math.PI / 180)} y2={40 + 17 * Math.sin(a * Math.PI / 180)} stroke={AC} strokeWidth="1.1" />
            ))}
        </>
    ),
    // Clôture : mur-bahut + claire-voie, hauteur cotée (le point réglementaire).
    cloture: (
        <>
            <Sol />
            <rect x="40" y="98" width="150" height="18" fill={TINT} stroke={AC} strokeWidth="1.5" />
            {[52, 76, 100, 124, 148, 172].map(x => (
                <line key={x} x1={x} y1="56" x2={x} y2="98" stroke={AC} strokeWidth="1.3" />
            ))}
            <line x1="40" y1="56" x2="190" y2="56" stroke={AC} strokeWidth="1.6" />
            <line x1="40" y1="76" x2="190" y2="76" stroke={AC} strokeWidth="1" opacity=".55" />
            <line x1="206" y1="56" x2="206" y2="116" stroke={AC} strokeWidth="1" />
            <line x1="202" y1="56" x2="210" y2="56" stroke={AC} strokeWidth="1" />
            <line x1="202" y1="116" x2="210" y2="116" stroke={AC} strokeWidth="1" />
            <text x="200" y="42" textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">H max</text>
        </>
    ),
    // Ravalement : façade + nuancier (la teinte est le vrai sujet).
    ravalement: (
        <>
            <Sol />
            <rect x="52" y="40" width="106" height="76" fill={TINT} stroke={AC} strokeWidth="1.6" />
            <rect x="68" y="56" width="24" height="24" fill="none" stroke={INK} strokeWidth="1.2" />
            <rect x="118" y="56" width="24" height="24" fill="none" stroke={INK} strokeWidth="1.2" />
            <rect x="92" y="92" width="26" height="24" fill="none" stroke={INK} strokeWidth="1.2" />
            <line x1="52" y1="48" x2="158" y2="48" stroke={AC} strokeWidth="1" opacity=".5" />
            {[0, 1, 2].map(i => (
                <rect key={i} x={176} y={52 + i * 22} width="26" height="16" rx="2" fill={i === 1 ? AC : 'none'} stroke={AC} strokeWidth="1.2" opacity={i === 1 ? 1 : 0.55} />
            ))}
            <text x="189" y="44" textAnchor="middle" fill={AC} fontSize="8.5" fontFamily="var(--mf)">RAL</text>
        </>
    ),
    // ITE : épaisseur ajoutée sur la façade — exactement ce qui pose problème.
    isolation: (
        <>
            <Sol />
            <rect x="70" y="42" width="76" height="74" fill="none" stroke={INK} strokeWidth="1.5" />
            <rect x="146" y="42" width="14" height="74" fill={TINT} stroke={AC} strokeWidth="1.5" />
            {Array.from({ length: 9 }).map((_, i) => (
                <line key={i} x1="146" y1={46 + i * 8} x2="160" y2={42 + i * 8} stroke={AC} strokeWidth=".8" opacity=".7" />
            ))}
            <rect x="88" y="58" width="26" height="26" fill="none" stroke={INK} strokeWidth="1.2" />
            <Cote x1={146} x2={160} y={34} label="+ ép." />
            <line x1="70" y1="126" x2="70" y2="132" stroke={FAINT} strokeWidth="1" />
            <line x1="160" y1="126" x2="160" y2="132" stroke={FAINT} strokeWidth="1" />
            <Cote x1={70} x2={160} y={136} label="nouveau nu" />
        </>
    ),
    // Menuiseries : avant / après sur la même baie.
    menuiseries: (
        <>
            <rect x="34" y="34" width="76" height="88" fill="none" stroke={INK} strokeWidth="1.5" />
            <line x1="72" y1="34" x2="72" y2="122" stroke={INK} strokeWidth="1.2" />
            <line x1="34" y1="78" x2="110" y2="78" stroke={INK} strokeWidth="1.2" />
            <text x="72" y="20" textAnchor="middle" fill={FAINT} fontSize="9" fontFamily="var(--mf)">EXISTANT</text>
            <path d="M124 78 L146 78 M140 72 L146 78 L140 84" fill="none" stroke={AC} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="160" y="34" width="76" height="88" fill={TINT} stroke={AC} strokeWidth="1.8" />
            <line x1="198" y1="34" x2="198" y2="122" stroke={AC} strokeWidth="1.4" />
            <text x="198" y="20" textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">PROJET</text>
        </>
    ),
    // Création d'ouverture : percement dans un pignon, coté.
    ouverture: (
        <>
            <Sol />
            <rect x="56" y="36" width="128" height="80" fill="none" stroke={INK} strokeWidth="1.5" />
            <rect x="74" y="54" width="26" height="26" fill="none" stroke={FAINT} strokeWidth="1.2" strokeDasharray="3 3" />
            <rect x="126" y="54" width="34" height="44" fill={TINT} stroke={AC} strokeWidth="1.8" />
            <line x1="143" y1="54" x2="143" y2="98" stroke={AC} strokeWidth="1.2" />
            <Cote x1={126} x2={160} y={44} label="l" />
            <line x1="176" y1="54" x2="176" y2="98" stroke={AC} strokeWidth="1" />
            <line x1="172" y1="54" x2="180" y2="54" stroke={AC} strokeWidth="1" />
            <line x1="172" y1="98" x2="180" y2="98" stroke={AC} strokeWidth="1" />
            <text x="188" y="79" fill={AC} fontSize="9" fontFamily="var(--mf)">h</text>
            <Cote x1={160} x2={184} y={116} label="allège" />
        </>
    ),
    // Toiture : pans, faîtage, pente — les trois variables du règlement.
    toiture: (
        <>
            <Sol />
            <path d="M40 116 L40 84 L120 40 L200 84 L200 116" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M40 84 L120 40 L200 84 Z" fill={TINT} stroke={AC} strokeWidth="1.6" strokeLinejoin="round" />
            {[0, 1, 2, 3].map(i => (
                <line key={i} x1={56 + i * 16} y1={84 - i * 0} x2={104 + i * 16} y2={57} stroke={AC} strokeWidth=".7" opacity=".45" />
            ))}
            <path d="M150 62 L150 84" stroke={AC} strokeWidth="1" />
            <path d="M150 62 L176 76" stroke={AC} strokeWidth="1" />
            <text x="158" y="60" fill={AC} fontSize="9" fontFamily="var(--mf)">pente</text>
            <circle cx="120" cy="40" r="2.6" fill={AC} />
            <text x="120" y="30" textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">faîtage</text>
        </>
    ),
    // Extension : volume accolé à l'existant, surface créée cotée.
    extension: (
        <>
            <Sol />
            <rect x="44" y="52" width="82" height="64" fill="none" stroke={INK} strokeWidth="1.5" />
            <path d="M36 52 L85 26 L134 52" fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="126" y="76" width="72" height="40" fill={TINT} stroke={AC} strokeWidth="1.8" />
            <path d="M120 76 L162 58 L204 76" fill="none" stroke={AC} strokeWidth="1.6" strokeLinejoin="round" />
            <Cote x1={126} x2={198} y={134} label="≤ 40 m²" />
            <text x="85" y="94" textAnchor="middle" fill={FAINT} fontSize="9" fontFamily="var(--mf)">EXISTANT</text>
        </>
    ),
    // Terrassement : profil avant / après, déblai et remblai.
    terrassement: (
        <>
            <path d="M16 74 L108 74 L108 110 L232 110" fill="none" stroke={AC} strokeWidth="1.8" />
            <path d="M16 92 L232 92" fill="none" stroke={FAINT} strokeWidth="1.2" strokeDasharray="5 4" />
            <path d="M16 74 L108 74 L108 92 L16 92 Z" fill={TINT} opacity=".8" />
            <path d="M108 92 L232 92 L232 110 L108 110 Z" fill={TINT} opacity=".45" />
            {Array.from({ length: 7 }).map((_, i) => (
                <line key={i} x1={22 + i * 13} y1="92" x2={30 + i * 13} y2="74" stroke={AC} strokeWidth=".7" opacity=".6" />
            ))}
            <text x="62" y="66" textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">DÉBLAI</text>
            <text x="170" y="126" textAnchor="middle" fill={AC} fontSize="9" fontFamily="var(--mf)">REMBLAI</text>
            <text x="196" y="86" textAnchor="middle" fill={FAINT} fontSize="8.5" fontFamily="var(--mf)">T.N.</text>
        </>
    ),
}

export default function TravauxIllustration({
    id,
    height = 168,
    className,
}: { id: TravauxId; height?: number; className?: string }) {
    return (
        <svg
            viewBox="0 0 248 148"
            height={height}
            width="100%"
            role="img"
            aria-hidden="true"
            focusable="false"
            className={className}
            style={{ display: 'block', maxWidth: '100%', overflow: 'visible' }}
        >
            {SHAPES[id]}
        </svg>
    )
}
