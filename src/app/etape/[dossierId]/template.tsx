'use client'

// A template re-mounts on every /etape/* navigation (unlike layout, which persists). Wrapping
// the page content here replays the enter animation on each step change, so transitions feel
// fluid while the surrounding chrome (header/stepper/progress) stays put.
export default function EtapeTemplate({ children }: { children: React.ReactNode }) {
    return <div className="dp-step-enter">{children}</div>
}
