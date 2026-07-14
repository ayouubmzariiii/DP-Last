// ─────────────────────────────────────────────────────────────────────────────
// Entitlement service — the server-side truth for what a user is allowed to do.
//
// Model (chosen with the owner): a subscription grants a monthly dossier `quota`
// that resets each period; one-off purchases add non-expiring `credits`. Generating
// a final dossier consumes one (quota first, then a credit). Generation is NOT hard-
// gated yet — consumeDossier() records usage but callers don't refuse; flip
// ENFORCE to true (or gate on canGenerate) when you want to enforce.
//
// NODE-only (imports the Drizzle client). Never import from middleware/edge.
// ─────────────────────────────────────────────────────────────────────────────
import { and, eq, desc, isNull } from 'drizzle-orm'
import { db, users, subscriptions, dossiers, payments } from '@/lib/db'
import { SUB_PLANS, SKUS, type PlanId, type SkuId } from '@/lib/billing/plans'

// Master switch. OFF by default → the app is entirely FREE and the billing layer
// is dormant: dossier generation never consumes quota/credits and is never gated.
// Everything else (checkout, subscriptions, the profil tab) still works if used, so
// the layer is ready — flip BILLING_ENFORCED=1 (Vercel env) to make it live.
export const BILLING_ENFORCED = process.env.BILLING_ENFORCED === '1'

export interface Entitlements {
    plan: PlanId | null
    planName: string | null
    planStatus: 'active' | 'canceled' | null
    quota: number          // 0 = illimité (Agence)
    used: number
    quotaRemaining: number | null   // null = illimité
    credits: number
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
    unlimited: boolean
    canGenerate: boolean   // an active unlimited plan, remaining quota, or ≥1 credit
}

const MS_MONTH = 30 * 24 * 3600 * 1000
const addMonth = (d: Date) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n }

// Read the active subscription, rolling the period forward lazily if it lapsed:
// an active sub past periodEnd resets `used` for the new month; a sub marked
// cancelAtPeriodEnd becomes 'canceled' (quota 0) once its period ends.
async function currentSub(userId: string) {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1)
    if (!sub) return null
    if (sub.status === 'canceled') return sub
    const now = Date.now()
    if (now <= new Date(sub.periodEnd).getTime()) return sub

    // Period lapsed — roll it forward (or end a scheduled cancellation).
    if (sub.cancelAtPeriodEnd) {
        const [row] = await db.update(subscriptions)
            .set({ status: 'canceled', quota: 0, used: 0, updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id)).returning()
        return row
    }
    // Advance one or more whole periods to "now" and reset usage.
    let start = new Date(sub.periodEnd)
    let end = addMonth(start)
    while (end.getTime() < now) { start = end; end = addMonth(start) }
    const [row] = await db.update(subscriptions)
        .set({ periodStart: start, periodEnd: end, used: 0, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id)).returning()
    return row
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
    const [sub, [u]] = await Promise.all([
        currentSub(userId),
        db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1),
    ])
    const credits = u?.credits ?? 0
    const active = sub && sub.status === 'active'
    const unlimited = !!active && sub!.quota === 0
    const quota = active ? sub!.quota : 0
    const used = active ? sub!.used : 0
    const quotaRemaining = !active ? 0 : unlimited ? null : Math.max(0, quota - used)
    const canGenerate = unlimited || (quotaRemaining ?? 0) > 0 || credits > 0
    return {
        plan: active ? (sub!.plan as PlanId) : null,
        planName: active ? (SUB_PLANS[sub!.plan as PlanId]?.name ?? sub!.plan) : null,
        planStatus: sub ? (sub.status as 'active' | 'canceled') : null,
        quota, used, quotaRemaining, credits,
        periodEnd: active ? new Date(sub!.periodEnd).toISOString() : null,
        cancelAtPeriodEnd: !!sub?.cancelAtPeriodEnd,
        unlimited,
        canGenerate,
    }
}

// Start / switch a subscription (mock payment already "succeeded"). Resets the
// monthly period and usage, records a payment row, returns fresh entitlements.
export async function applySubscription(userId: string, planId: PlanId): Promise<Entitlements> {
    const plan = SUB_PLANS[planId]
    if (!plan || plan.contact) throw new Error('Plan non souscriptible en ligne.')
    const now = new Date()
    const periodEnd = addMonth(now)
    const values = {
        userId, plan: planId, status: 'active' as const,
        quota: plan.quota ?? 0, used: 0, periodStart: now, periodEnd,
        cancelAtPeriodEnd: false, provider: 'mock', updatedAt: now,
    }
    await db.insert(subscriptions).values(values)
        .onConflictDoUpdate({ target: subscriptions.userId, set: values })
    await db.insert(payments).values({
        userId, kind: 'subscription', sku: planId, label: `Abonnement ${plan.name}`,
        amountCents: plan.priceCents ?? 0, creditsGranted: 0, status: 'paid', provider: 'mock',
    })
    return getEntitlements(userId)
}

// Add credits from one-off / pack purchases (mock payment already "succeeded").
export async function addCredits(userId: string, sku: SkuId, qty = 1): Promise<Entitlements> {
    const item = SKUS[sku]
    if (!item) throw new Error('Article inconnu.')
    const n = Math.max(1, Math.floor(qty))
    const [u] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1)
    const next = (u?.credits ?? 0) + item.credits * n
    await db.update(users).set({ credits: next, updatedAt: new Date() }).where(eq(users.id, userId))
    await db.insert(payments).values({
        userId, kind: 'oneoff', sku, label: n > 1 ? `${item.name} ×${n}` : item.name,
        amountCents: item.priceCents * n, creditsGranted: item.credits * n, status: 'paid', provider: 'mock',
    })
    return getEntitlements(userId)
}

export async function cancelSubscription(userId: string): Promise<Entitlements> {
    await db.update(subscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    return getEntitlements(userId)
}

// Record one dossier as consumed — quota first, then a credit — but ONLY the first
// time a given dossier is generated (guarded by dossiers.billedAt). Idempotent, so
// re-downloading never double-charges. Never throws / never blocks: returns what
// was charged so the caller can surface it, but generation proceeds regardless.
export async function consumeDossier(userId: string, dossierId?: string): Promise<{ charged: 'quota' | 'credit' | 'none' }> {
    // Dormant unless billing is switched on — the app stays free for everyone.
    if (!BILLING_ENFORCED) return { charged: 'none' }
    try {
        // Idempotency: only bill a dossier that hasn't been billed yet.
        if (dossierId) {
            const [d] = await db.select({ id: dossiers.id, billedAt: dossiers.billedAt })
                .from(dossiers).where(and(eq(dossiers.id, dossierId), eq(dossiers.userId, userId))).limit(1)
            if (!d) return { charged: 'none' }
            if (d.billedAt) return { charged: 'none' }
        }
        const sub = await currentSub(userId)
        let charged: 'quota' | 'credit' | 'none' = 'none'
        if (sub && sub.status === 'active' && (sub.quota === 0 || sub.used < sub.quota)) {
            if (sub.quota !== 0) {
                await db.update(subscriptions).set({ used: sub.used + 1, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id))
            }
            charged = 'quota'
        } else {
            const [u] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1)
            if ((u?.credits ?? 0) > 0) {
                await db.update(users).set({ credits: (u!.credits) - 1, updatedAt: new Date() }).where(eq(users.id, userId))
                charged = 'credit'
            }
        }
        if (dossierId) {
            await db.update(dossiers).set({ billedAt: new Date() })
                .where(and(eq(dossiers.id, dossierId), eq(dossiers.userId, userId), isNull(dossiers.billedAt)))
        }
        return { charged }
    } catch (e) {
        console.warn('[billing] consumeDossier failed (non-blocking):', e)
        return { charged: 'none' }
    }
}

// Recent order history for the billing tab.
export async function paymentHistory(userId: string, limit = 20) {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(limit)
}
