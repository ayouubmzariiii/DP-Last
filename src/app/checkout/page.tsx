'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useCart } from '@/lib/billing/cart'
import { SUB_PLANS, SKUS, euro, isPlanId, type SkuId } from '@/lib/billing/plans'

type CSS = React.CSSProperties
const card: CSS = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }
const cap: CSS = { fontFamily: 'var(--mf)', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }

function CheckoutInner() {
    const router = useRouter()
    const params = useSearchParams()
    const planParam = params.get('plan')
    const cart = useCart()
    const [status, setStatus] = useState<'idle' | 'paying' | 'done'>('idle')
    const [error, setError] = useState<string | null>(null)
    const [msg, setMsg] = useState('')

    // Subscription mode when ?plan=… is a self-serve plan; otherwise cart mode.
    const plan = isPlanId(planParam) && !SUB_PLANS[planParam].contact ? SUB_PLANS[planParam] : null
    const isSub = !!plan

    const lines = useMemo(() => {
        if (isSub) return [{ key: plan!.id, name: `Abonnement ${plan!.name}`, sub: `${plan!.quota} dossiers / mois · ${plan!.perLabel}`, qty: 1, unit: plan!.priceCents ?? 0, editable: false }]
        return cart.items.map((i) => ({ key: i.sku, name: SKUS[i.sku].name, sub: SKUS[i.sku].blurb, qty: i.qty, unit: SKUS[i.sku].priceCents, editable: true }))
    }, [isSub, plan, cart.items])

    const total = isSub ? (plan!.priceCents ?? 0) : cart.totalCents
    const empty = lines.length === 0

    const pay = async () => {
        setStatus('paying'); setError(null)
        try {
            const body = isSub
                ? { subscription: plan!.id }
                : { items: cart.items.map((i) => ({ sku: i.sku, qty: i.qty })) }
            const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Paiement refusé.')
            if (!isSub) cart.clear()
            setMsg(data.message || 'Paiement confirmé.')
            setStatus('done')
        } catch (e: any) {
            setError(e.message || 'Une erreur est survenue.'); setStatus('idle')
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
            <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}><Logo size={34} /><span style={{ fontFamily: 'var(--hf)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>DP Travaux</span></Link>
                    <span style={{ ...cap, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V8a5 5 0 0 1 10 0v3" /></svg>
                        Paiement sécurisé
                    </span>
                </div>
            </header>

            <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 80px' }}>
                {status === 'done' ? (
                    <div style={{ ...card, maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 36 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--act)', border: '1px solid var(--acb)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--acd)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        </div>
                        <h1 style={{ fontFamily: 'var(--hf)', fontSize: 26, fontWeight: 600, margin: 0 }}>{msg}</h1>
                        <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, margin: '10px 0 24px' }}>Paiement de démonstration validé. Votre {isSub ? 'abonnement est actif' : 'crédit est disponible'} sur votre espace.</p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/profil?tab=facturation" className="dp-btn-primary" style={{ textDecoration: 'none' }}>Voir mon abonnement</Link>
                            <Link href="/profil" className="dp-btn-secondary" style={{ textDecoration: 'none' }}>Mes projets</Link>
                        </div>
                    </div>
                ) : empty ? (
                    <div style={{ ...card, maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 36 }}>
                        <h1 style={{ fontFamily: 'var(--hf)', fontSize: 24, fontWeight: 600, margin: 0 }}>Votre panier est vide</h1>
                        <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: '10px 0 24px' }}>Choisissez une offre pour commencer.</p>
                        <Link href="/#pricing" className="dp-btn-primary" style={{ textDecoration: 'none' }}>Voir les tarifs</Link>
                    </div>
                ) : (
                    <>
                        <h1 style={{ fontFamily: 'var(--hf)', fontSize: 'clamp(26px,3.4vw,34px)', fontWeight: 500, margin: '0 0 26px', letterSpacing: '-.01em' }}>Finaliser votre commande</h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .9fr', gap: 24, alignItems: 'start' }} data-cogrid>
                            {/* Order summary */}
                            <div style={card}>
                                <div style={{ ...cap, marginBottom: 16 }}>{isSub ? 'Votre abonnement' : 'Votre panier'}</div>
                                {lines.map((l) => (
                                    <div key={l.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderTop: '1px solid var(--line-2)' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'var(--hf)', fontSize: 17, fontWeight: 600 }}>{l.name}</div>
                                            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{l.sub}</div>
                                            {l.editable && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
                                                        <button onClick={() => cart.setQty(l.key as SkuId, l.qty - 1)} style={qtyBtn}>−</button>
                                                        <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{l.qty}</span>
                                                        <button onClick={() => cart.setQty(l.key as SkuId, l.qty + 1)} style={qtyBtn}>+</button>
                                                    </div>
                                                    <button onClick={() => cart.remove(l.key as SkuId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)', fontFamily: 'inherit' }}>Retirer</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontFamily: 'var(--hf)', fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{euro(l.unit * l.qty)}{isSub ? <span style={{ fontSize: 13, color: 'var(--muted)' }}> /mois</span> : null}</div>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontFamily: 'var(--hf)', fontSize: 18, fontWeight: 600 }}>Total</span>
                                    <span style={{ fontFamily: 'var(--hf)', fontSize: 26, fontWeight: 600 }}>{euro(total)}{isSub ? <span style={{ fontSize: 14, color: 'var(--muted)' }}> /mois</span> : null}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8, fontFamily: 'var(--mf)' }}>TVA incluse · {isSub ? 'sans engagement, résiliable à tout moment' : 'crédits sans expiration'}</div>
                            </div>

                            {/* Mock payment panel */}
                            <div style={{ ...card, background: 'var(--surface-2)' }}>
                                <div style={{ ...cap, marginBottom: 14 }}>Paiement</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: .7, pointerEvents: 'none' }} aria-hidden>
                                    <div><label className="dp-label">Numéro de carte</label><div className="dp-input" style={{ color: 'var(--muted)' }}>4242 4242 4242 4242</div></div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1 }}><label className="dp-label">Expiration</label><div className="dp-input" style={{ color: 'var(--muted)' }}>12 / 30</div></div>
                                        <div style={{ flex: 1 }}><label className="dp-label">CVC</label><div className="dp-input" style={{ color: 'var(--muted)' }}>•••</div></div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '14px 0', padding: '10px 12px', background: 'var(--act)', border: '1px solid var(--acb)', borderRadius: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--acd)' }}>
                                    <span>ℹ️</span><span>Paiement de démonstration — aucune carte n’est débitée. Le vrai encaissement sera branché ultérieurement.</span>
                                </div>
                                {error && <div style={{ fontSize: 13, color: '#8F2E22', marginBottom: 12 }}>{error}</div>}
                                <button onClick={pay} disabled={status === 'paying'} className="dp-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13, opacity: status === 'paying' ? .7 : 1 }}>
                                    {status === 'paying' ? 'Traitement…' : isSub ? `Payer ${euro(total)} / mois` : `Payer ${euro(total)}`}
                                </button>
                                <Link href="/#pricing" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 14, textDecoration: 'none' }}>← Retour aux offres</Link>
                            </div>
                        </div>
                    </>
                )}
            </main>
            <style dangerouslySetInnerHTML={{ __html: '@media (max-width:760px){[data-cogrid]{grid-template-columns:1fr!important}}' }} />
        </div>
    )
}

const qtyBtn: CSS = { width: 32, height: 32, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 17, color: 'var(--ink)', fontFamily: 'inherit' }

export default function CheckoutPage() {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--paper)' }} />}><CheckoutInner /></Suspense>
}
