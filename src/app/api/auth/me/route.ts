import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const [row] = await db.select({ id: users.id, email: users.email, createdAt: users.createdAt })
        .from(users).where(eq(users.id, session.userId)).limit(1)
    if (!row) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    return NextResponse.json({ user: row })
}
