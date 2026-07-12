import { NextRequest, NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, dossiers, users } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { emptyFormData } from '@/lib/models'
import { summarizeDossier } from '@/lib/dossierSummary'

// Split a stored "Prénom Nom" into its parts for the CERFA. French forms carry the given name(s)
// first and the family name last, so the last token is the nom and everything before it the prénom
// (keeps compound first names like "Jean-Pierre Marie" intact). Always user-editable afterwards.
function splitFullName(full: string): { prenom: string; nom: string } {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { prenom: '', nom: '' }
    if (parts.length === 1) return { prenom: '', nom: parts[0] }
    return { prenom: parts.slice(0, -1).join(' '), nom: parts[parts.length - 1] }
}

export const runtime = 'nodejs'

// GET /api/dossiers — list the current user's dossiers (metadata + denormalized summary,
// never the full `data`). Legacy rows saved before the summary column are self-healed:
// their `data` is loaded once, summarized, and the summary persisted.
export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const rows = await db
        .select({
            id: dossiers.id, title: dossiers.title, status: dossiers.status,
            lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
            summary: dossiers.summary, clientName: dossiers.clientName,
            submittedAt: dossiers.submittedAt, decision: dossiers.decision,
            decisionAt: dossiers.decisionAt, archivedAt: dossiers.archivedAt,
        })
        .from(dossiers)
        .where(eq(dossiers.userId, session.userId))
        .orderBy(desc(dossiers.updatedAt))

    // Self-heal legacy rows (summary column added after their last save).
    const missing = rows.filter(r => !r.summary).map(r => r.id)
    const healed = new Map<string, ReturnType<typeof summarizeDossier>>()
    if (missing.length) {
        try {
            const withData = await db
                .select({ id: dossiers.id, data: dossiers.data })
                .from(dossiers)
                .where(inArray(dossiers.id, missing))
            await Promise.all(withData.map(async ({ id, data }) => {
                const s = summarizeDossier(data)
                healed.set(id, s)
                await db.update(dossiers).set({ summary: s }).where(eq(dossiers.id, id))
            }))
        } catch (e) {
            console.warn('[dossiers GET] summary self-heal failed:', e)
        }
    }

    const out = rows.map(({ summary, ...meta }) => {
        const s = summary || healed.get(meta.id)
        return { ...meta, empty: s?.empty ?? false, summary: s?.summary }
    })
    return NextResponse.json({ dossiers: out })
}

// POST /api/dossiers — create a new (empty) dossier for the current user.
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: {
        title?: string
        // Landing-page hero handoff: seed the terrain with the address the visitor validated
        // BEFORE signing up, so their déclaration starts exactly where the promise was made.
        terrainAddress?: { adresse?: string; code_postal?: string; commune?: string; coords?: { lat: number; lon: number } }
    } = {}
    try { body = await req.json() } catch { /* empty body is fine */ }
    let title = (typeof body.title === 'string' && body.title.trim()) ? body.title.trim().slice(0, 120) : 'Nouveau dossier'

    // Pre-fill the applicant identity from the signed-in account so Étape 1 opens already populated
    // (nom, prénom, email, téléphone) — the client only confirms it instead of retyping. Deep-clone
    // the empty template so we never mutate the shared default object.
    const data: typeof emptyFormData = JSON.parse(JSON.stringify(emptyFormData))
    try {
        const [acct] = await db
            .select({ fullName: users.fullName, email: users.email, phone: users.phone })
            .from(users).where(eq(users.id, session.userId)).limit(1)
        if (acct) {
            const { prenom, nom } = splitFullName(acct.fullName || '')
            data.demandeur = {
                ...data.demandeur,
                nom: nom || data.demandeur.nom,
                prenom: prenom || data.demandeur.prenom,
                email: acct.email || data.demandeur.email,
                telephone: acct.phone || data.demandeur.telephone,
            }
        }
    } catch (e) {
        console.warn('[dossiers POST] identity pre-fill skipped:', e)
    }

    // Terrain pre-seed from the landing page (address + coords drive the Étape 2 cadastre autofill).
    const ta = body.terrainAddress
    if (ta && typeof ta === 'object' && (ta.adresse || ta.commune)) {
        data.terrain = {
            ...data.terrain,
            adresse: typeof ta.adresse === 'string' ? ta.adresse.slice(0, 200) : '',
            code_postal: typeof ta.code_postal === 'string' ? ta.code_postal.slice(0, 10) : '',
            commune: typeof ta.commune === 'string' ? ta.commune.slice(0, 120) : '',
            coords: (ta.coords && Number.isFinite(ta.coords.lat) && Number.isFinite(ta.coords.lon))
                ? { lat: ta.coords.lat, lon: ta.coords.lon } : undefined,
            meme_adresse: false,
        }
        if (title === 'Nouveau dossier') {
            title = `Projet — ${[ta.adresse, ta.commune].filter(Boolean).join(', ')}`.slice(0, 120)
        }
    }

    const [row] = await db.insert(dossiers).values({
        userId: session.userId,
        title,
        data,
        summary: summarizeDossier(data),
        status: 'draft',
        lastStep: 1,
    }).returning({
        id: dossiers.id, title: dossiers.title, status: dossiers.status,
        lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
    })

    return NextResponse.json({ dossier: row }, { status: 201 })
}
