import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db, dossiers, users } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { emptyFormData, DPFormData } from '@/lib/models'
import { getTravauxDef } from '@/lib/travauxRegistry'

// Derive a lightweight summary from a dossier's data: the key identity/works details to show on the
// profile card, the saved/generated files, and whether the dossier is still "empty" (nothing but the
// account-seeded identity — no terrain, no works, no content, no files). Empty dossiers are not shown
// as real projects on the profile.
function summarizeDossier(data: DPFormData) {
    const d = data?.demandeur || ({} as DPFormData['demandeur'])
    const t = data?.terrain || ({} as DPFormData['terrain'])
    const tr = data?.travaux || ({} as DPFormData['travaux'])
    const ph = data?.photos || ({} as DPFormData['photos'])
    const pl = data?.plans || ({} as DPFormData['plans'])
    const facades = ph.facades || []

    const applicant = (d.est_societe ? d.nom_societe : [d.prenom, d.nom].filter(Boolean).join(' ')).trim()
    const fmtAddr = (voie?: string, cp?: string, ville?: string) =>
        [voie, [cp, ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const address = t.meme_adresse
        ? fmtAddr(d.adresse, d.code_postal, d.commune)
        : fmtAddr(t.adresse, t.code_postal, t.commune)
    const worksType = getTravauxDef(tr.type)?.natureLabel || ''

    const files = {
        situation: !!pl.dp1_carte_situation,
        masse: !!pl.dp2_plan_masse,
        notice: !!pl.dp4_notice,
        photos: facades.filter(f => f.before).length + (ph.dp7_vue_proche ? 1 : 0) + (ph.dp8_vue_lointaine ? 1 : 0),
        simulations: facades.filter(f => f.after).length,
        croquis: facades.filter(f => f.croquis).length,
    }
    const hasFiles = files.situation || files.masse || files.notice || files.photos > 0 || files.simulations > 0 || files.croquis > 0
    const hasWork = !!tr.type
    const hasTerrain = !!(t.adresse || t.section_cadastrale || t.coords)
    const hasContent = !!(t.description_projet || tr.description_projet)
    const empty = !hasWork && !hasTerrain && !hasContent && !hasFiles

    return { empty, summary: { applicant, address, worksType, files } }
}

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

// GET /api/dossiers — list the current user's dossiers (metadata only, never `data`).
export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const rows = await db
        .select({
            id: dossiers.id, title: dossiers.title, status: dossiers.status,
            lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
            data: dossiers.data,
        })
        .from(dossiers)
        .where(eq(dossiers.userId, session.userId))
        .orderBy(desc(dossiers.updatedAt))

    const out = rows.map(({ data, ...meta }) => ({ ...meta, ...summarizeDossier(data) }))
    return NextResponse.json({ dossiers: out })
}

// POST /api/dossiers — create a new (empty) dossier for the current user.
export async function POST(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    let body: { title?: string } = {}
    try { body = await req.json() } catch { /* empty body is fine */ }
    const title = (typeof body.title === 'string' && body.title.trim()) ? body.title.trim().slice(0, 120) : 'Nouveau dossier'

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

    const [row] = await db.insert(dossiers).values({
        userId: session.userId,
        title,
        data,
        status: 'draft',
        lastStep: 1,
    }).returning({
        id: dossiers.id, title: dossiers.title, status: dossiers.status,
        lastStep: dossiers.lastStep, createdAt: dossiers.createdAt, updatedAt: dossiers.updatedAt,
    })

    return NextResponse.json({ dossier: row }, { status: 201 })
}
