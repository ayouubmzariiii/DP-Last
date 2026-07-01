import React from 'react'
import { SealIcon } from 'dp-travaux'

// The seal glyph — communicates an approved/validated dossier. Sized via `size`,
// recoloured via `stroke`. Below: the default, a size sweep, and the on-brand
// badge treatment used in the app header (white seal on the green accent chip).

export const Default = () => (
    <div style={{ color: '#2D5A4C' }}>
        <SealIcon size={48} />
    </div>
)

export const Sizes = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: '#2D5A4C' }}>
        <SealIcon size={16} />
        <SealIcon size={24} />
        <SealIcon size={40} />
        <SealIcon size={64} />
    </div>
)

export const OnBrandBadge = () => (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: '#2D5A4C', boxShadow: '0 6px 16px -8px rgba(45,90,76,.6)' }}>
        <SealIcon size={24} stroke="#fff" strokeWidth={1.5} />
    </div>
)
