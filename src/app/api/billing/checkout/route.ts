import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { applySubscription, addCredits, getEntitlements } from '@/lib/billing/service'
import { isPlanId, isSkuId, SUB_PLANS, SKUS } from '@/lib/billing/plans'

export const runtime = 'nodejs'

// POST /api/billing/checkout — MOCK payment confirmation. In production this is
// where a real provider's checkout session would be created (and entitlements would
// instead be applied by the provider's webhook). Here we apply them directly.
//
// Body: { subscription?: PlanId } and/or { items?: [{ sku: SkuId, qty?: number }] }.
// A cart may contain one-off items; a subscription is applied on its own.
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: { subscription?: unknown; items?: unknown } = {}
    try { body = await req.json() } catch { /* empty */ }

    const planId = body.subscription
    const rawItems = Array.isArray(body.items) ? body.items : []
    const items: { sku: string; qty: number }[] = rawItems
        .map((it: any) => ({ sku: String(it?.sku), qty: Math.max(1, Math.floor(Number(it?.qty) || 1)) }))
        .filter((it) => isSkuId(it.sku))

    if (planId == null && items.length === 0) {
        return NextResponse.json({ error: 'Panier vide.' }, { status: 400 })
    }
    if (planId != null && !isPlanId(planId)) {
        return NextResponse.json({ error: 'Offre inconnue.' }, { status: 400 })
    }
    if (isPlanId(planId) && SUB_PLANS[planId].contact) {
        return NextResponse.json({ error: 'Cette offre se souscrit auprès de l’équipe commerciale.' }, { status: 400 })
    }

    try {
        // One-off items first (each grants credits), then the subscription.
        for (const it of items) await addCredits(session.userId, it.sku as any, it.qty)
        if (isPlanId(planId)) await applySubscription(session.userId, planId)

        const entitlements = await getEntitlements(session.userId)
        const label = isPlanId(planId)
            ? `Abonnement ${SUB_PLANS[planId].name} activé`
            : items.length === 1 && items[0].qty === 1
                ? `${SKUS[items[0].sku as keyof typeof SKUS].name} ajouté`
                : 'Achat confirmé'
        return NextResponse.json({ ok: true, message: label, entitlements })
    } catch (err) {
        console.error('[billing/checkout] error:', err)
        return NextResponse.json({ error: 'Le paiement (démo) n’a pas pu être finalisé.' }, { status: 500 })
    }
}
