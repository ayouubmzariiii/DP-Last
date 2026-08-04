import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, betaSignups, events } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/beta — candidature au programme de test (page /beta).
//
// Le même email qui repostule met à jour sa candidature plutôt que d'échouer :
// un testeur qui corrige son téléphone ne doit pas se heurter à une erreur 409.

const phoneRe = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/

const schema = z.object({
    email: z.string().trim().email('Adresse email invalide.').max(180),
    nom: z.string().trim().min(2, 'Indiquez votre nom.').max(120),
    phone: z.string().trim().regex(phoneRe, 'Numéro invalide (ex : 06 12 34 56 78).').optional().or(z.literal('')),
    profil: z.enum(['particulier', 'pro']).default('particulier'),
    metier: z.string().trim().max(120).optional().or(z.literal('')),
    travaux: z.string().trim().max(60).optional().or(z.literal('')),
    commune: z.string().trim().max(120).optional().or(z.literal('')),
    codePostal: z.string().trim().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres).').optional().or(z.literal('')),
    message: z.string().trim().max(2000).optional().or(z.literal('')),
    source: z.string().trim().max(80).optional().or(z.literal('')),
    campaign: z.string().trim().max(80).optional().or(z.literal('')),
    referrer: z.string().trim().max(300).optional().or(z.literal('')),
    anonId: z.string().trim().max(64).optional().or(z.literal('')),
})

const nz = (v?: string) => (v && v.trim() ? v.trim() : null)

export async function POST(req: NextRequest) {
    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.' }, { status: 422 })
    }

    const d = parsed.data
    const email = d.email.toLowerCase().trim()

    const values = {
        email,
        nom: nz(d.nom),
        phone: nz(d.phone),
        profil: d.profil,
        metier: nz(d.metier),
        travaux: nz(d.travaux),
        commune: nz(d.commune),
        codePostal: nz(d.codePostal),
        message: nz(d.message),
        source: nz(d.source),
        campaign: nz(d.campaign),
        referrer: nz(d.referrer),
    }

    try {
        const [existing] = await db.select({ id: betaSignups.id }).from(betaSignups).where(eq(betaSignups.email, email)).limit(1)
        if (existing) {
            await db.update(betaSignups).set({ ...values, updatedAt: new Date() }).where(eq(betaSignups.id, existing.id))
        } else {
            await db.insert(betaSignups).values(values)
        }
    } catch {
        return NextResponse.json({ error: 'Enregistrement impossible pour le moment. Réessayez dans un instant.' }, { status: 500 })
    }

    // Conversion de l'entonnoir — best-effort, jamais bloquant.
    db.insert(events).values({
        name: 'beta_submit',
        anonId: nz(d.anonId),
        path: '/beta',
        source: nz(d.source),
        campaign: nz(d.campaign),
        referrer: nz(d.referrer),
        props: { profil: d.profil, travaux: values.travaux, dept: values.codePostal?.slice(0, 2) ?? null },
    }).catch(() => { })

    return NextResponse.json({ ok: true })
}
