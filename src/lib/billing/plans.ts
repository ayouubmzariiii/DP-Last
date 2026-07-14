// ─────────────────────────────────────────────────────────────────────────────
// Billing catalogue — the single source of truth for what's for sale.
//
// Framework-agnostic (no server imports) so both the client (cart, checkout,
// pricing) and the server (entitlement service, API routes) use the SAME prices,
// quotas and credit grants. Amounts are in cents to avoid float drift.
//
// Provider is "mock" for now: the checkout applies entitlements directly, no real
// charge. Swapping in Stripe later means replacing the confirm step with a real
// checkout session + webhook — the catalogue and entitlement model stay put.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanId = 'studio' | 'cabinet' | 'agence'
export type SkuId = 'dossier' | 'pack'

export interface SubPlan {
    id: PlanId
    name: string
    priceCents: number | null   // null = "Sur devis" (Agence)
    quota: number | null        // dossiers included per month; null = illimité (Agence)
    perLabel: string            // per-dossier headline for the recommendation banner
    blurb: string
    contact?: boolean           // Agence: talk-to-sales rather than self-serve checkout
}

export const SUB_PLANS: Record<PlanId, SubPlan> = {
    studio: { id: 'studio', name: 'Studio', priceCents: 29000, quota: 5, perLabel: '58 € le dossier', blurb: 'Indépendants, artisans et petits cabinets.' },
    cabinet: { id: 'cabinet', name: 'Cabinet', priceCents: 62000, quota: 12, perLabel: '≈ 52 € le dossier', blurb: 'Cabinets d’architecture et maîtres d’œuvre.' },
    agence: { id: 'agence', name: 'Agence', priceCents: null, quota: null, perLabel: 'dès 50 € le dossier', blurb: 'Groupes, réseaux et grands comptes.', contact: true },
}

export interface Sku {
    id: SkuId
    name: string
    priceCents: number
    credits: number     // non-expiring dossier credits granted per unit
    blurb: string
}

export const SKUS: Record<SkuId, Sku> = {
    dossier: { id: 'dossier', name: 'Dossier complet', priceCents: 6900, credits: 1, blurb: 'Un dossier prêt à déposer, sans filigrane.' },
    pack: { id: 'pack', name: 'Pack Rénovation', priceCents: 17900, credits: 3, blurb: '3 dossiers — 59,70 € l’unité.' },
}

export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in SUB_PLANS
export const isSkuId = (v: unknown): v is SkuId => typeof v === 'string' && v in SKUS

// French price label from a cents amount: 6900 → "69 €", 5970 → "59,70 €".
export function euro(cents: number): string {
    const v = cents / 100
    return v.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }) + ' €'
}
