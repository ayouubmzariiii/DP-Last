import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export const runtime = 'nodejs'

// POST (not GET) so link prefetching can't log a user out.
export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
}
