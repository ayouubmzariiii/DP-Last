import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/adminGuard'
import { getSettingsWithMeta, setSetting, resetSetting, SETTING_DEFS } from '@/lib/appSettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/settings — tous les réglages avec valeur effective + provenance (db/env/défaut).
export async function GET() {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })
    return NextResponse.json({ settings: await getSettingsWithMeta() })
}

const putSchema = z.object({
    key: z.string().min(1),
    // null = réinitialiser (supprimer la surcharge base, retour env/défaut).
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

// PUT /api/admin/settings — écrit (ou réinitialise) UN réglage de la liste blanche.
export async function PUT(req: NextRequest) {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }) }
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides.' }, { status: 422 })

    const { key, value } = parsed.data
    if (!SETTING_DEFS.some(d => d.key === key)) return NextResponse.json({ error: `Réglage inconnu : ${key}` }, { status: 404 })

    try {
        if (value === null) await resetSetting(key)
        else await setSetting(key, value, admin.email)
        console.log(`[admin] ${admin.email} set ${key} = ${value === null ? '(reset)' : JSON.stringify(value)}`)
        return NextResponse.json({ settings: await getSettingsWithMeta() })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Écriture impossible.' }, { status: 422 })
    }
}
