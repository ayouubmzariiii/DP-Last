// Canonical DP Travaux brand mark — the gradient "dp" tile used as the app logo and favicon
// (src/app/icon.svg). Single source of truth so the logo is identical everywhere it appears.
export default function Logo({
    size = 40,
    className,
}: { size?: number; className?: string }) {
    return (
        <div
            className={className}
            aria-label="DP Travaux"
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.27),
                background: 'linear-gradient(155deg, var(--ac), var(--acd))',
                boxShadow: `0 ${size * 0.2}px ${size * 0.42}px -${size * 0.16}px rgba(45,90,76,.55)`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: size * 0.09,
                flexShrink: 0,
            }}
        >
            <span style={{ fontFamily: 'var(--hf)', fontWeight: 600, fontSize: size * 0.48, lineHeight: 1, letterSpacing: '-.03em', color: '#fff' }}>dp</span>
            <span style={{ width: size * 0.33, height: Math.max(1.5, size * 0.03), borderRadius: 2, background: 'rgba(255,255,255,.55)' }} />
        </div>
    )
}
