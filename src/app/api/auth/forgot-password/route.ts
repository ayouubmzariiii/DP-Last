import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, users } from '@/lib/db'
import { emailConfigured, emailShell, sendEmail } from '@/lib/email'

export const runtime = 'nodejs'

const schema = z.object({ email: z.string().email() })
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 h

// POST /api/auth/forgot-password — always replies 200 for a valid email (never leaks
// whether an account exists). If the account exists, a one-hour reset link is emailed.
export async function POST(req: NextRequest) {
    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 422 })

    if (!emailConfigured()) {
        return NextResponse.json({
            error: 'L’envoi d’emails n’est pas encore configuré sur ce déploiement. Contactez le support pour réinitialiser votre mot de passe.',
        }, { status: 503 })
    }

    const email = parsed.data.email.toLowerCase().trim()
    try {
        const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
        if (user) {
            const token = randomBytes(32).toString('hex')
            const tokenHash = createHash('sha256').update(token).digest('hex')
            await db.update(users).set({
                resetTokenHash: tokenHash,
                resetTokenExpires: new Date(Date.now() + TOKEN_TTL_MS),
                updatedAt: new Date(),
            }).where(eq(users.id, user.id))

            const origin = req.nextUrl.origin
            const link = `${origin}/reinitialiser?token=${token}&email=${encodeURIComponent(email)}`
            await sendEmail({
                to: email,
                subject: 'Réinitialisation de votre mot de passe — DP Travaux',
                html: emailShell('Réinitialiser votre mot de passe', `
                    <p style="font-size:15px;line-height:1.6;margin:0 0 18px">Vous avez demandé la réinitialisation du mot de passe de votre compte DP Travaux. Ce lien est valable <strong>1 heure</strong>.</p>
                    <p style="text-align:center;margin:0 0 18px"><a href="${link}" style="display:inline-block;background:#2D5A4C;color:#fff;text-decoration:none;font-size:15px;font-weight:600;border-radius:12px;padding:13px 26px">Choisir un nouveau mot de passe</a></p>
                    <p style="font-size:13px;line-height:1.6;color:#5C564C;margin:0">Si vous n’êtes pas à l’origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.</p>
                `),
            })
        }
    } catch (e) {
        console.error('[forgot-password] error:', e)
        return NextResponse.json({ error: 'Échec de l’envoi de l’email. Réessayez dans quelques minutes.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
