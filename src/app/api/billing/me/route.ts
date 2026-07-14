import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntitlements, paymentHistory } from '@/lib/billing/service'

export const runtime = 'nodejs'

// GET /api/billing/me — the signed-in user's entitlements + recent order history.
export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [entitlements, history] = await Promise.all([
        getEntitlements(session.userId),
        paymentHistory(session.userId),
    ])
    return NextResponse.json({ entitlements, history })
}
