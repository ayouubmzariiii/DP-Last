// Helpers over the image-bearing fields of a DPFormData dossier. Images must be
// stored as Blob (or /public) URLs — never inline base64 — so rows stay tiny and
// PUT payloads stay under Vercel's 4.5 MB request cap.
import type { DPFormData } from '@/lib/models'

/** Every image string currently held in the dossier (nulls filtered out). */
export function collectImageValues(data: DPFormData): string[] {
    const out: string[] = []
    const push = (v: unknown) => { if (typeof v === 'string' && v) out.push(v) }
    const photos = data?.photos
    if (photos) {
        push(photos.facade_avant); push(photos.facade_droite); push(photos.facade_gauche); push(photos.facade_arriere)
        push(photos.dp7_vue_proche); push(photos.dp8_vue_lointaine)
        push(photos.facade_apres_ai); push(photos.facade_croquis_ai)
        for (const f of photos.facades || []) { push(f.before); push(f.after); push(f.croquis) }
    }
    if (data?.plans) { push(data.plans.dp1_carte_situation); push(data.plans.dp2_plan_masse) }
    return out
}

/** True if any image field holds an inline base64 data: URL (rejected on save). */
export function hasInlineBase64Image(data: DPFormData): boolean {
    return collectImageValues(data).some(v => v.startsWith('data:'))
}
