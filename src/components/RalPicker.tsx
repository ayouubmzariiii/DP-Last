'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Teintes RAL dans l'UI :
//  • <RalSwatch>  — pastille de couleur (partout où un code RAL s'affiche)
//  • <RalHint>    — détection automatique sous un champ libre ("Blanc RAL 9016"
//                   → pastille + nom de la teinte)
//  • <RalPicker>  — champ RAL dédié avec sélecteur : recherche par code ou par
//                   nom, aperçu couleur, saisie libre toujours possible
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { detectRal, searchRal, type RalColor } from '@/lib/ralColors'

export function RalSwatch({ hex, size = 14, title }: { hex: string; size?: number; title?: string }) {
    return (
        <span title={title} aria-hidden style={{
            display: 'inline-block', width: size, height: size, flexShrink: 0,
            borderRadius: Math.max(3, Math.round(size / 4)), background: hex,
            border: '1px solid rgba(37,34,30,.22)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)',
            verticalAlign: '-2px',
        }} />
    )
}

// Sous un champ libre : si le texte contient un code RAL connu, montre la teinte.
export function RalHint({ text }: { text?: string | null }) {
    const ral = detectRal(text)
    if (!ral) return null
    return (
        <div className="animate-fadeIn" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: 12, color: 'var(--ink-2)' }}>
            <RalSwatch hex={ral.hex} size={15} />
            <span><strong style={{ color: 'var(--ink)' }}>RAL {ral.code}</strong> · {ral.name}</span>
        </div>
    )
}

// Rendu inline d'un texte contenant (peut-être) un code RAL : le texte, suivi de
// la pastille correspondante. Pour les récapitulatifs et suggestions PLU.
export function RalInline({ text }: { text?: string | null }) {
    const ral = detectRal(text)
    if (!text) return null
    if (!ral) return <>{text}</>
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {text}
            <RalSwatch hex={ral.hex} size={13} title={`RAL ${ral.code} · ${ral.name}`} />
        </span>
    )
}

export default function RalPicker({ value, onChange, placeholder, format = 'code' }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    // 'code' stocke « RAL 7016 » (champ RAL dédié) ; 'label' stocke
    // « Gris anthracite (RAL 7016) » (champs couleur lisibles par la mairie).
    format?: 'code' | 'label'
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const current = detectRal(value)
    const options = searchRal(value)

    // Close on outside click.
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [open])

    const pick = (c: RalColor) => { onChange(format === 'label' ? `${c.name} (RAL ${c.code})` : `RAL ${c.code}`); setOpen(false) }

    return (
        <div ref={rootRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                {current && (
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
                        <RalSwatch hex={current.hex} size={16} />
                    </span>
                )}
                <input
                    className="dp-input"
                    style={current ? { paddingLeft: 36 } : undefined}
                    placeholder={placeholder || 'ex : RAL 7016 ou « anthracite »'}
                    value={value}
                    onChange={e => { onChange(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
                    aria-label="Code RAL"
                    aria-expanded={open}
                    role="combobox"
                />
            </div>
            {current && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 5 }}>{current.name}</div>
            )}
            {open && options.length > 0 && (
                <div className="dp-card" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, padding: 6, maxHeight: 264, overflowY: 'auto', boxShadow: '0 16px 38px -16px rgba(37,34,30,.4)' }}>
                    {!value.trim() && (
                        <div style={{ fontFamily: 'var(--mf)', fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', padding: '4px 9px 6px' }}>Teintes courantes</div>
                    )}
                    {options.map(c => (
                        <button key={c.code} type="button" onClick={() => pick(c)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', fontFamily: 'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <RalSwatch hex={c.hex} size={18} />
                            <span style={{ fontFamily: 'var(--mf)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>RAL {c.code}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
