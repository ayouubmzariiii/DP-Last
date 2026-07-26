import { NextRequest, NextResponse } from 'next/server'
import { sql, eq } from 'drizzle-orm'
import { db, users, dossiers } from '@/lib/db'
import { requireAdmin } from '@/lib/adminGuard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/dossiers/:id — la fiche COMPLÈTE d'un dossier, tous comptes confondus.
//
// Contrairement à la liste (/api/admin/dossiers), qui ne renvoie que le `summary`
// dénormalisé, cette route charge le jsonb `data` entier : identité, terrain, analyse PLU,
// travaux, CERFA, et les URLs Blob des photos/plans. C'est la source de la page /admin/dossiers/:id.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    const [row] = await db.select({
        id: dossiers.id,
        title: dossiers.title,
        clientName: dossiers.clientName,
        status: dossiers.status,
        lastStep: dossiers.lastStep,
        decision: dossiers.decision,
        decisionAt: dossiers.decisionAt,
        numeroDp: dossiers.numeroDp,
        affichageAt: dossiers.affichageAt,
        submittedAt: dossiers.submittedAt,
        billedAt: dossiers.billedAt,
        archivedAt: dossiers.archivedAt,
        createdAt: dossiers.createdAt,
        updatedAt: dossiers.updatedAt,
        summary: dossiers.summary,
        data: dossiers.data,
        ownerId: users.id,
        ownerEmail: users.email,
        ownerName: users.fullName,
        ownerPhone: users.phone,
        ownerCity: users.city,
        ownerRole: users.role,
        ownerCredits: users.credits,
        ownerSince: users.createdAt,
    }).from(dossiers).innerJoin(users, eq(dossiers.userId, users.id)).where(eq(dossiers.id, params.id)).limit(1)

    if (!row) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })

    const { ownerId, ownerEmail, ownerName, ownerPhone, ownerCity, ownerRole, ownerCredits, ownerSince, ...dossier } = row

    // Combien d'autres dossiers ce compte possède-t-il — pour situer celui-ci dans son portefeuille.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(dossiers).where(eq(dossiers.userId, ownerId))

    return NextResponse.json({
        dossier,
        owner: {
            id: ownerId, email: ownerEmail, fullName: ownerName, phone: ownerPhone,
            city: ownerCity, role: ownerRole, credits: ownerCredits, createdAt: ownerSince,
            dossierCount: n,
        },
    })
}
