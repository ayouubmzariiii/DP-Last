// ─────────────────────────────────────────────────────────────────────────────
// Transactional email via the Resend REST API (plain fetch — no SDK dependency).
//
// Configuration (Vercel env vars):
//   RESEND_API_KEY — required to actually send.
//   EMAIL_FROM     — verified sender, e.g. 'DP Travaux <no-reply@dp-travaux.fr>'.
//                    Falls back to Resend's onboarding sender (only delivers to the
//                    Resend account owner — fine for development).
// ─────────────────────────────────────────────────────────────────────────────

export function emailConfigured(): boolean {
    return !!process.env.RESEND_API_KEY
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY manquant : envoi d’email non configuré.')
    const from = process.env.EMAIL_FROM || 'DP Travaux <onboarding@resend.dev>'

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
    }
}

// Warm-paper branded shell consistent with the app's design system.
export function emailShell(title: string, bodyHtml: string): string {
    return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F1ECE3;font-family:Georgia,'Times New Roman',serif;color:#25221E">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;background:#2D5A4C;color:#fff;font-size:20px;font-weight:600;border-radius:12px;padding:10px 16px">dp</span>
      <div style="font-family:Menlo,Consolas,monospace;font-size:10px;letter-spacing:.09em;color:#8A8378;text-transform:uppercase;margin-top:8px">DP Travaux · Déclaration préalable</div>
    </div>
    <div style="background:#FAF7F1;border:1px solid #E3DCCF;border-radius:16px;padding:28px">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 14px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-family:Menlo,Consolas,monospace;font-size:10px;color:#9A9286;text-align:center;margin-top:20px">
      Email envoyé automatiquement par DP Travaux — ne pas répondre.
    </p>
  </div>
</body></html>`
}
