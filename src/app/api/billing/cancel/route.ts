import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cancelSubscription } from '@/lib/billing/service'

export const runtime = 'nodejs'

// POST /api/billing/cancel — schedule cancellation at period end (stays active until then).
export async function POST() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
    const entitlements = await cancelSubscription(session.userId)
    return NextResponse.json({ ok: true, entitlements })
}
