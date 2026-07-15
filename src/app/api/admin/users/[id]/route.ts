import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql, desc, eq } from 'drizzle-orm'
import { db, users, dossiers, subscriptions, payments } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'
import { SUB_PLANS, isPlanId } from '@/lib/billing/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/:id — fiche complète : compte, abonnement, paiements, dossiers.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const [user] = await db.select({
        id: users.id, email: users.email, role: users.role, fullName: users.fullName,
        firstName: users.firstName, lastName: users.lastName, phone: users.phone,
        address: users.address, postalCode: users.postalCode, city: users.city,
        credits: users.credits, createdAt: users.createdAt,
    }).from(users).where(eq(users.id, params.id)).limit(1)
    if (!user) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })

    const [[sub], userPayments, userDossiers] = await Promise.all([
        db.select().from(subscriptions).where(eq(subscriptions.userId, params.id)).limit(1),
        db.select({
            id: payments.id, kind: payments.kind, label: payments.label, amountCents: payments.amountCents,
            creditsGranted: payments.creditsGranted, status: payments.status, createdAt: payments.createdAt,
        }).from(payments).where(eq(payments.userId, params.id)).orderBy(desc(payments.createdAt)).limit(20),
        db.select({
            id: dossiers.id, title: dossiers.title, clientName: dossiers.clientName, status: dossiers.status,
            lastStep: dossiers.lastStep, decision: dossiers.decision, submittedAt: dossiers.submittedAt,
            billedAt: dossiers.billedAt, archivedAt: dossiers.archivedAt, updatedAt: dossiers.updatedAt,
            summary: dossiers.summary,
        }).from(dossiers).where(eq(dossiers.userId, params.id)).orderBy(desc(dossiers.updatedAt)).limit(50),
    ])

    return NextResponse.json({ user, subscription: sub || null, payments: userPayments, dossiers: userDossiers })
}

const patchSchema = z.object({
    role: z.enum(['user', 'admin']).optional(),
    // Crédits : valeur absolue (set) OU delta (add) — un seul des deux.
    credits: z.number().int().min(0).max(100000).optional(),
    addCredits: z.number().int().min(-1000).max(1000).optional(),
    // Abonnement : attribuer un plan (upsert, période d'un mois) ou le résilier.
    plan: z.union([z.enum(['studio', 'cabinet', 'agence']), z.literal('none')]).optional(),
})

// PATCH /api/admin/users/:id — rôle, crédits, abonnement.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides.', issues: parsed.error.issues.map(i => i.message) }, { status: 422 })
    const d = parsed.data

    const [target] = await db.select({ id: users.id, role: users.role, credits: users.credits }).from(users).where(eq(users.id, params.id)).limit(1)
    if (!target) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })

    // Garde-fou : ne jamais retirer le DERNIER admin (sinon plus personne n'entre au back-office).
    if (d.role === 'user' && target.role === 'admin') {
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'admin'))
        if (n <= 1) return NextResponse.json({ error: 'Impossible de rétrograder le dernier administrateur.' }, { status: 409 })
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (d.role !== undefined) patch.role = d.role
    if (d.credits !== undefined) patch.credits = d.credits
    else if (d.addCredits !== undefined) patch.credits = Math.max(0, target.credits + d.addCredits)
    if (Object.keys(patch).length > 1) {
        await db.update(users).set(patch).where(eq(users.id, params.id))
    }

    if (d.plan) {
        if (d.plan === 'none') {
            await db.update(subscriptions)
                .set({ status: 'canceled', quota: 0, cancelAtPeriodEnd: false, updatedAt: new Date() })
                .where(eq(subscriptions.userId, params.id))
        } else if (isPlanId(d.plan)) {
            const plan = SUB_PLANS[d.plan]
            const now = new Date()
            const end = new Date(now); end.setMonth(end.getMonth() + 1)
            await db.insert(subscriptions)
                .values({ userId: params.id, plan: plan.id, status: 'active', quota: plan.quota ?? 0, used: 0, periodStart: now, periodEnd: end, provider: 'admin', providerRef: admin.email })
                .onConflictDoUpdate({
                    target: subscriptions.userId,
                    set: { plan: plan.id, status: 'active', quota: plan.quota ?? 0, used: 0, periodStart: now, periodEnd: end, cancelAtPeriodEnd: false, provider: 'admin', providerRef: admin.email, updatedAt: now },
                })
        }
    }

    console.log(`[admin] ${admin.email} updated user ${params.id}:`, JSON.stringify(d))
    return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users/:id — suppression définitive du compte (cascade : dossiers,
// abonnement, paiements). L'admin ne peut pas se supprimer lui-même.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
    if (params.id === admin.userId) return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 409 })

    const [target] = await db.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq(users.id, params.id)).limit(1)
    if (!target) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })
    if (target.role === 'admin') return NextResponse.json({ error: 'Rétrogradez cet administrateur avant de supprimer son compte.' }, { status: 409 })

    await db.delete(users).where(eq(users.id, params.id))
    console.log(`[admin] ${admin.email} DELETED user ${target.email} (${params.id})`)
    return NextResponse.json({ ok: true })
}
