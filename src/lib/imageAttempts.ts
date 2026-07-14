// ─────────────────────────────────────────────────────────────────────────────
// Per-image AI generation cap. Each client may generate the "après / insertion"
// view of a given façade at most MAX_IMAGE_ATTEMPTS times — a durable, server-
// authoritative counter keyed by (dossier, façade) so retries can't run up cost.
// Only SUCCESSFUL generations are counted (a model that returns no image doesn't
// burn a try). NODE-only.
// ─────────────────────────────────────────────────────────────────────────────
import { and, eq, sql } from 'drizzle-orm'
import { db, imageAttempts, dossiers } from '@/lib/db'

export const MAX_IMAGE_ATTEMPTS = 4

// True when the dossier exists and belongs to the user (guards the counter key).
export async function ownsDossier(userId: string, dossierId: string): Promise<boolean> {
    const [row] = await db.select({ userId: dossiers.userId }).from(dossiers).where(eq(dossiers.id, dossierId)).limit(1)
    return !!row && row.userId === userId
}

export async function imageAttemptCount(dossierId: string, facadeId: string): Promise<number> {
    const [row] = await db.select({ count: imageAttempts.count }).from(imageAttempts)
        .where(and(eq(imageAttempts.dossierId, dossierId), eq(imageAttempts.facadeId, facadeId))).limit(1)
    return row?.count ?? 0
}

// Atomic upsert-increment; returns the new total.
export async function bumpImageAttempt(userId: string, dossierId: string, facadeId: string): Promise<number> {
    const [row] = await db.insert(imageAttempts)
        .values({ userId, dossierId, facadeId, count: 1, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: [imageAttempts.dossierId, imageAttempts.facadeId],
            set: { count: sql`${imageAttempts.count} + 1`, updatedAt: new Date() },
        })
        .returning({ count: imageAttempts.count })
    return row?.count ?? 0
}
