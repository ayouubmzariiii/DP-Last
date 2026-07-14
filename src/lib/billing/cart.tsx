'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Cart — client-side, localStorage-backed. Holds one-off / pack SKUs only
// (subscriptions are single-item and go straight to checkout, never the cart).
// Survives login redirects (localStorage), so a guest can fill a cart, get
// bounced to /login?next=/checkout, and come back to it intact.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { SKUS, type SkuId } from '@/lib/billing/plans'

export interface CartItem { sku: SkuId; qty: number }
const KEY = 'dp-cart'

interface CartCtx {
    items: CartItem[]
    count: number
    totalCents: number
    add: (sku: SkuId, qty?: number) => void
    setQty: (sku: SkuId, qty: number) => void
    remove: (sku: SkuId) => void
    clear: () => void
}

const Ctx = createContext<CartCtx | undefined>(undefined)

function read(): CartItem[] {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
        if (!Array.isArray(raw)) return []
        return raw
            .map((i) => ({ sku: String(i?.sku) as SkuId, qty: Math.max(1, Math.floor(Number(i?.qty) || 1)) }))
            .filter((i) => i.sku in SKUS)
    } catch { return [] }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([])

    // Hydrate from storage after mount (avoids SSR mismatch) and sync across tabs.
    useEffect(() => {
        setItems(read())
        const onStorage = (e: StorageEvent) => { if (e.key === KEY) setItems(read()) }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const persist = useCallback((next: CartItem[]) => {
        setItems(next)
        try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota */ }
    }, [])

    const add = useCallback((sku: SkuId, qty = 1) => {
        persist((() => {
            const cur = read()
            const ex = cur.find((i) => i.sku === sku)
            if (ex) return cur.map((i) => i.sku === sku ? { ...i, qty: i.qty + qty } : i)
            return [...cur, { sku, qty }]
        })())
    }, [persist])

    const setQty = useCallback((sku: SkuId, qty: number) => {
        const q = Math.max(0, Math.floor(qty))
        persist(read().flatMap((i) => i.sku !== sku ? [i] : q <= 0 ? [] : [{ ...i, qty: q }]))
    }, [persist])

    const remove = useCallback((sku: SkuId) => persist(read().filter((i) => i.sku !== sku)), [persist])
    const clear = useCallback(() => persist([]), [persist])

    const count = items.reduce((n, i) => n + i.qty, 0)
    const totalCents = items.reduce((n, i) => n + SKUS[i.sku].priceCents * i.qty, 0)

    return <Ctx.Provider value={{ items, count, totalCents, add, setQty, remove, clear }}>{children}</Ctx.Provider>
}

export function useCart(): CartCtx {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error('useCart must be used within CartProvider')
    return ctx
}
