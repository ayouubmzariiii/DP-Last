// Official stamp / seal glyph — communicates an approved/validated dossier.
// Double ring + centred check + four radial "teeth" for the seal feel.
export default function SealIcon({
    size = 18,
    stroke = 'currentColor',
    strokeWidth = 1.6,
}: { size?: number; stroke?: string; strokeWidth?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
            strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5.4" />
            <path d="M9.6 12.1l1.7 1.7 3.1-3.4" />
            <path d="M12 1.6v1.4M12 21v1.4M1.6 12h1.4M21 12h1.4" />
        </svg>
    )
}
