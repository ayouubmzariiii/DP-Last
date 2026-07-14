'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Matériaux en visuel — petites vignettes SVG évoquant la matière (bois, alu,
// enduit, tuile…), utilisées partout où un matériau apparaît dans l'app :
//  • <MaterialTiles>  — sélecteur visuel (remplace les <select> texte, étape 3)
//  • <MaterialSwatch> — la vignette seule
//  • <MaterialInline> — texte + vignette (récapitulatif, analyse PLU)
//  • detectMaterial() — retrouve le matériau dans un texte libre
// ─────────────────────────────────────────────────────────────────────────────

import React, { useId } from 'react'

export type MaterialId =
    | 'bois' | 'pvc' | 'aluminium' | 'mixte' | 'acier' | 'composite'
    | 'enduit' | 'peinture' | 'pierre' | 'bardage_bois' | 'maconnerie'
    | 'grillage' | 'tuile' | 'ardoise' | 'zinc' | 'bac_acier'

export const MATERIAL_LABELS: Record<MaterialId, string> = {
    bois: 'Bois', pvc: 'PVC', aluminium: 'Aluminium', mixte: 'Mixte bois/alu',
    acier: 'Métal / acier', composite: 'Composite', enduit: 'Enduit', peinture: 'Peinture',
    pierre: 'Pierre', bardage_bois: 'Bardage bois', maconnerie: 'Maçonnerie',
    grillage: 'Grillage', tuile: 'Tuile', ardoise: 'Ardoise', zinc: 'Zinc', bac_acier: 'Bac acier',
}

// Le motif de chaque matière, dessiné dans un viewBox 40×40 (uid rend les ids
// de dégradés uniques par instance pour un SVG valide).
function pattern(id: MaterialId, uid: string): React.ReactNode {
    const g = (n: string) => `${uid}-${n}`
    switch (id) {
        case 'bois': return (<>
            <defs><linearGradient id={g('w')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C29063" /><stop offset="1" stopColor="#9D6E45" /></linearGradient></defs>
            <rect width="40" height="40" fill={`url(#${g('w')})`} />
            <path d="M8 0v40M16 0v40M24 0v40M32 0v40" stroke="#8A5F3C" strokeWidth="1" opacity=".5" />
            <path d="M10 6q3 4 0 9M27 22q3 5 0 10" stroke="#8A5F3C" strokeWidth="1.2" fill="none" opacity=".55" />
            <ellipse cx="20" cy="14" rx="2.4" ry="3.6" fill="none" stroke="#7C5233" strokeWidth="1.1" opacity=".6" />
        </>)
        case 'pvc': return (<>
            <rect width="40" height="40" fill="#F3F3EF" />
            <rect x="5" y="5" width="30" height="30" rx="3" fill="none" stroke="#D6D6D0" strokeWidth="2" />
            <rect x="11" y="11" width="18" height="18" rx="2" fill="#E9EDEE" stroke="#D6D6D0" strokeWidth="1.2" />
            <path d="M13 27L27 13" stroke="#fff" strokeWidth="4" opacity=".65" strokeLinecap="round" />
        </>)
        case 'aluminium': return (<>
            <defs><linearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDD2D7" /><stop offset=".5" stopColor="#A6ADB4" /><stop offset="1" stopColor="#C4C9CE" /></linearGradient></defs>
            <rect width="40" height="40" fill={`url(#${g('a')})`} />
            <path d="M0 8h40M0 15h40M0 23h40M0 31h40" stroke="#fff" strokeWidth=".8" opacity=".45" />
            <path d="M0 11h40M0 19h40M0 27h40" stroke="#7E858C" strokeWidth=".7" opacity=".4" />
        </>)
        case 'mixte': return (<>
            <defs>
                <linearGradient id={g('mw')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C29063" /><stop offset="1" stopColor="#9D6E45" /></linearGradient>
                <linearGradient id={g('ma')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDD2D7" /><stop offset="1" stopColor="#A6ADB4" /></linearGradient>
            </defs>
            <path d="M0 0h40L0 40Z" fill={`url(#${g('mw')})`} />
            <path d="M40 0v40H0Z" fill={`url(#${g('ma')})`} />
            <path d="M7 4v18M14 4v10" stroke="#8A5F3C" strokeWidth="1" opacity=".5" />
            <path d="M22 34h14M27 28h10" stroke="#fff" strokeWidth=".9" opacity=".5" />
            <path d="M40 0L0 40" stroke="#F1ECE3" strokeWidth="1.6" />
        </>)
        case 'acier': return (<>
            <defs><linearGradient id={g('s')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8B939B" /><stop offset="1" stopColor="#6B737B" /></linearGradient></defs>
            <rect width="40" height="40" fill={`url(#${g('s')})`} />
            <path d="M0 10h40M0 20h40M0 30h40" stroke="#fff" strokeWidth=".7" opacity=".3" />
            <circle cx="8" cy="8" r="1.6" fill="#5A626A" /><circle cx="32" cy="8" r="1.6" fill="#5A626A" />
            <circle cx="8" cy="32" r="1.6" fill="#5A626A" /><circle cx="32" cy="32" r="1.6" fill="#5A626A" />
        </>)
        case 'composite': return (<>
            <rect width="40" height="40" fill="#8D7B6C" />
            <rect y="0" width="40" height="9" fill="#96847314" />
            <rect y="10" width="40" height="9" fill="#7C6B5D" />
            <rect y="20" width="40" height="9" fill="#8D7B6C" />
            <rect y="30" width="40" height="10" fill="#7C6B5D" />
            <path d="M0 9.5h40M0 19.5h40M0 29.5h40" stroke="#5F5145" strokeWidth="1" opacity=".7" />
            <path d="M4 3h10M22 13h12M8 24h12M26 34h9" stroke="#6E5F52" strokeWidth=".8" opacity=".8" />
        </>)
        case 'enduit': return (<>
            <rect width="40" height="40" fill="#E4D9C4" />
            {[[6, 7], [14, 4], [24, 9], [33, 5], [9, 16], [20, 19], [30, 15], [5, 27], [15, 30], [26, 26], [34, 31], [11, 36], [22, 35], [31, 38], [17, 11], [36, 21]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.1 : .7} fill="#B7A88C" opacity=".55" />
            ))}
            <path d="M4 33q8-6 16-2t16-3" stroke="#CDBFA4" strokeWidth="2.4" fill="none" opacity=".8" strokeLinecap="round" />
        </>)
        case 'peinture': return (<>
            <rect width="40" height="40" fill="#EEE9DE" />
            <path d="M-4 30L30 -4" stroke="#C9B893" strokeWidth="13" strokeLinecap="round" />
            <path d="M6 42L44 4" stroke="#D8CBAC" strokeWidth="7" strokeLinecap="round" opacity=".8" />
            <path d="M30 34l4 4M34 30l3 3" stroke="#C9B893" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        </>)
        case 'pierre': return (<>
            <rect width="40" height="40" fill="#CFC5B2" />
            <path d="M0 13h40M0 27h40" stroke="#B0A48C" strokeWidth="1.6" />
            <path d="M14 0v13M28 0v13M7 13v14M21 13v14M34 13v14M14 27v13M28 27v13" stroke="#B0A48C" strokeWidth="1.4" />
            <path d="M3 5h6M23 20h7M17 33h6" stroke="#BDB29A" strokeWidth="1" opacity=".8" />
        </>)
        case 'bardage_bois': return (<>
            <defs><linearGradient id={g('b')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#C29063" /><stop offset="1" stopColor="#A87A50" /></linearGradient></defs>
            <rect width="40" height="40" fill={`url(#${g('b')})`} />
            <path d="M0 8h40M0 16h40M0 24h40M0 32h40" stroke="#7C5233" strokeWidth="1.6" opacity=".65" />
            <path d="M6 4h14M20 12h14M4 20h12M24 28h12M8 36h16" stroke="#8A5F3C" strokeWidth=".9" opacity=".6" />
        </>)
        case 'maconnerie': return (<>
            <rect width="40" height="40" fill="#E4D9C4" />
            {[0, 1, 2, 3].map(r => (
                <g key={r}>
                    {[0, 1, 2].map(c => (
                        <rect key={c} x={(r % 2 ? -7 : 0) + c * 14 + 1} y={r * 10 + 1} width="12" height="8" rx="1" fill="#BE7355" />
                    ))}
                    <rect x={(r % 2 ? 35 : 42) + 1} y={r * 10 + 1} width="12" height="8" rx="1" fill="#BE7355" />
                </g>
            ))}
        </>)
        case 'grillage': return (<>
            <rect width="40" height="40" fill="#EDEAE2" />
            <path d="M-6 14L14 -6M-6 28L28 -6M2 40L40 2M16 40L40 16M30 40L40 30" stroke="#868C91" strokeWidth="1.5" />
            <path d="M0 2L38 40M0 16L24 40M0 30L10 40M12 0L40 28M26 0L40 14" stroke="#868C91" strokeWidth="1.5" />
        </>)
        case 'tuile': return (<>
            <rect width="40" height="40" fill="#B4593A" />
            {[0, 1, 2, 3].map(r => (
                <g key={r}>
                    {[0, 1, 2, 3].map(c => (
                        <path key={c} d={`M${(r % 2 ? -6 : 0) + c * 12} ${r * 10 + 10} q6 -7 12 0`} fill="#C46F4A" stroke="#93462C" strokeWidth="1.1" />
                    ))}
                </g>
            ))}
        </>)
        case 'ardoise': return (<>
            <rect width="40" height="40" fill="#535E68" />
            <path d="M0 10h40M0 20h40M0 30h40" stroke="#414B54" strokeWidth="1.4" />
            <path d="M10 0v10M25 0v10M5 10v10M18 10v10M32 10v10M12 20v10M27 20v10M7 30v10M21 30v10M34 30v10" stroke="#414B54" strokeWidth="1.2" />
            <path d="M2 4l8 3M20 14l9 2M8 25l8 2" stroke="#6B7680" strokeWidth=".9" opacity=".7" />
        </>)
        case 'zinc': return (<>
            <defs><linearGradient id={g('z')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C3CCD0" /><stop offset="1" stopColor="#A8B2B7" /></linearGradient></defs>
            <rect width="40" height="40" fill={`url(#${g('z')})`} />
            <path d="M10 0v40M20 0v40M30 0v40" stroke="#8B969C" strokeWidth="2" />
            <path d="M8 0v40M18 0v40M28 0v40M38 0v40" stroke="#D7DEE1" strokeWidth="1" opacity=".8" />
        </>)
        case 'bac_acier': return (<>
            <rect width="40" height="40" fill="#AEB6BC" />
            {[0, 1, 2, 3].map(i => (
                <rect key={i} x={i * 10 + 2} y="0" width="5" height="40" rx="2.4" fill="#CDD3D7" />
            ))}
            <path d="M4.5 0v40M14.5 0v40M24.5 0v40M34.5 0v40" stroke="#98A1A7" strokeWidth=".8" opacity=".7" />
        </>)
    }
}

export function MaterialSwatch({ id, size = 22, title }: { id: MaterialId; size?: number; title?: string }) {
    const uid = useId()
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ borderRadius: Math.max(4, Math.round(size / 5)), border: '1px solid rgba(37,34,30,.18)', flexShrink: 0, display: 'inline-block', verticalAlign: '-4px' }}>
            {title && <title>{title}</title>}
            {pattern(id, uid)}
        </svg>
    )
}

// Retrouve un matériau dans un texte libre ("Bardage bois mélèze", "pvc", "Tuile
// terre cuite"). Les motifs les plus spécifiques sont testés en premier.
const KEYWORDS: [RegExp, MaterialId][] = [
    [/bac[\s-]?acier/, 'bac_acier'],
    [/bardage[\s_]?(bois|meleze|douglas)/, 'bardage_bois'],
    [/bardage[\s_]?(metal|acier|alu)/, 'acier'],
    [/composite|hpl/, 'composite'],
    [/bardage/, 'bardage_bois'],
    [/tuile/, 'tuile'],
    [/ardoise/, 'ardoise'],
    [/zinc/, 'zinc'],
    [/grillage|grille/, 'grillage'],
    [/maconnerie|brique|parpaing|beton/, 'maconnerie'],
    [/pierre/, 'pierre'],
    [/enduit|crepi/, 'enduit'],
    [/peinture|peint/, 'peinture'],
    [/mixte/, 'mixte'],
    [/alu/, 'aluminium'],
    [/pvc/, 'pvc'],
    [/acier|metal/, 'acier'],
    [/bois/, 'bois'],
]
export function detectMaterial(text?: string | null): MaterialId | null {
    if (!text) return null
    const s = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ')
    for (const [re, id] of KEYWORDS) if (re.test(s)) return id
    return null
}

// Texte + vignette matière, pour les surfaces en lecture seule (récap, PLU).
export function MaterialInline({ text }: { text?: string | null }) {
    if (!text) return null
    const id = detectMaterial(text)
    if (!id) return <>{text}</>
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <MaterialSwatch id={id} size={18} title={MATERIAL_LABELS[id]} />
            {text}
        </span>
    )
}

// Icônes « élément » au trait (fenêtre, porte, volet, clôture…) pour les champs
// de type qui ne sont pas une matière mais méritent aussi un visuel.
export type ElementId =
    | 'fenetre' | 'porte' | 'volet' | 'baie_vitree' | 'porte_fenetre' | 'fenetre_toit'
    | 'mur' | 'mur_bahut' | 'grillage_cloture' | 'panneaux' | 'claire_voie'

const ELEMENT_PATHS: Record<ElementId, React.ReactNode> = {
    fenetre: (<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M12 3v18M4 12h16" /></>),
    porte: (<><rect x="6" y="3" width="12" height="18" rx="1.5" /><path d="M6 21h12" /><circle cx="15" cy="12.5" r="1" fill="currentColor" stroke="none" /></>),
    volet: (<><rect x="3" y="3" width="8" height="18" rx="1" /><rect x="13" y="3" width="8" height="18" rx="1" /><path d="M5 7h4M5 11h4M5 15h4M15 7h4M15 11h4M15 15h4" /></>),
    baie_vitree: (<><rect x="2" y="4" width="20" height="16" rx="1.5" /><path d="M12 4v16" /><path d="M6 12h3M9.5 10.5L8 12l1.5 1.5M18 12h-3M14.5 10.5L16 12l-1.5 1.5" /></>),
    porte_fenetre: (<><rect x="6" y="3" width="12" height="18" rx="1.5" /><path d="M12 3v18M6 13h12" /><circle cx="10" cy="12" r=".9" fill="currentColor" stroke="none" /></>),
    fenetre_toit: (<><path d="M3 16L14 5l7 5" /><rect x="9" y="9.5" width="7" height="6" rx="1" transform="rotate(-45 12.5 12.5)" /></>),
    mur: (<><path d="M3 6h18v13H3z" /><path d="M3 10.3h18M3 14.6h18M9 6v4.3M15 6v4.3M6 10.3v4.3M12 10.3v4.3M18 10.3v4.3M9 14.6V19M15 14.6V19" /></>),
    mur_bahut: (<><path d="M3 14h18v6H3z" /><path d="M10.5 14v6M3 17h18" /><path d="M5.5 14V5M9.5 14V5M13.5 14V5M17.5 14V5M20.5 14V5" /></>),
    grillage_cloture: (<><path d="M4 4v17M20 4v17" /><path d="M4 7l16 10M20 7L4 17M4 12l10 9M20 12l-10 9M9 4l11 7M15 4L4 11" strokeWidth="1" /></>),
    panneaux: (<><path d="M4 4v17M20 4v17" /><path d="M4 8h16M4 11h16M4 15h16M4 18h16" /></>),
    claire_voie: (<><path d="M4 21V6l1.5-2L7 6v15M10.5 21V6L12 4l1.5 2v15M17 21V6l1.5-2L20 6v15" /><path d="M2 12h20M2 17h20" strokeWidth="1" /></>),
}

export function ElementIcon({ id, size = 30 }: { id: ElementId; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            {ELEMENT_PATHS[id]}
        </svg>
    )
}

// Sélecteur visuel : une grille de tuiles (vignette matière OU icône au trait + libellé).
export function MaterialTiles({ options, value, onChange, columns }: {
    options: { value: string; label: string; material?: MaterialId; element?: ElementId }[]
    value: string
    onChange: (v: string) => void
    columns?: number
}) {
    const norm = (s: string) => s.trim().toLowerCase()
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns || Math.min(options.length, 4)}, 1fr)`, gap: 8, marginTop: 4 }}>
            {options.map(o => {
                const on = norm(value) === norm(o.value)
                return (
                    <button key={o.value} type="button" onClick={() => onChange(on ? '' : o.value)} aria-pressed={on}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                            padding: '11px 6px 9px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                            background: on ? 'var(--act)' : 'var(--surface)',
                            border: `2px solid ${on ? 'var(--ac)' : 'var(--line)'}`,
                            boxShadow: on ? '0 8px 18px -10px rgba(45,90,76,.5)' : '0 1px 2px rgba(37,34,30,.04)',
                            transition: 'border-color .15s, background .15s, box-shadow .15s',
                        }}>
                        {o.material ? (
                            <MaterialSwatch id={o.material} size={34} />
                        ) : o.element ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, color: on ? 'var(--acd)' : 'var(--ink-2)' }}>
                                <ElementIcon id={o.element} size={30} />
                            </span>
                        ) : null}
                        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: on ? 'var(--acd)' : 'var(--ink-2)', textAlign: 'center' }}>{o.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
