// ─────────────────────────────────────────────────────────────────────────────
// Garde-fou : les visuels de démonstration ne doivent JAMAIS sortir dans un
// document réel.
//
// Le mode test charge une maquette complète (photos de façade, vues « après »
// et croquis pré-générés, notice mise en cache) servie depuis /test/. C'est
// voulu : la maquette sert à contrôler la mise en page sans dépenser d'appels
// au modèle. Le risque est qu'un dossier produit dans cet état sorte de
// l'application sous forme de PDF et soit déposé en mairie : il porterait alors
// la façade de quelqu'un d'autre.
//
// Ces assets ne peuvent atteindre un document que par le mode test ou le
// harnais de développement — jamais par un dossier réel, qui part de
// `emptyFormData`. La vérification ci-dessous est donc une ceinture en plus des
// bretelles : en production, la génération est refusée si un visuel de
// démonstration figure encore dans le dossier.
//
// Un dossier déjà enregistré n'est pas concerné : ses images sont les siennes,
// stockées sur Blob sous une URL https — seuls les chemins /test/ sont visés.
// ─────────────────────────────────────────────────────────────────────────────
import type { DPFormData } from '@/lib/models'

/** Un visuel est « de démonstration » s'il pointe vers les assets embarqués /test/. */
export function isSampleAsset(v: unknown): boolean {
    return typeof v === 'string' && /^\/test\//.test(v.trim())
}

/**
 * Liste les visuels de démonstration encore présents dans un dossier.
 * Retourne les libellés lisibles des pièces concernées (vide = dossier propre).
 */
export function sampleAssetsIn(data: DPFormData): string[] {
    const hits: string[] = []
    const ph = data?.photos
    const pl = data?.plans

    if (isSampleAsset(pl?.dp1_carte_situation)) hits.push('DP1 — plan de situation')
    if (isSampleAsset(pl?.dp2_plan_masse)) hits.push('DP2 — plan de masse')
    if (isSampleAsset(pl?.dp3_coupe)) hits.push('DP3 — plan en coupe')
    if (isSampleAsset(ph?.dp7_vue_proche)) hits.push('DP7 — photo de l’environnement proche')
    if (isSampleAsset(ph?.dp8_vue_lointaine)) hits.push('DP8 — photo du paysage lointain')

    for (const f of ph?.facades ?? []) {
        const label = f.label || 'façade'
        if (isSampleAsset(f.before)) hits.push(`Photo « ${label} » (état existant)`)
        if (isSampleAsset(f.after)) hits.push(`Simulation « ${label} » (état projeté)`)
        if (isSampleAsset(f.croquis)) hits.push(`Croquis « ${label} »`)
    }
    for (const k of ['facade_avant', 'facade_droite', 'facade_gauche', 'facade_arriere'] as const) {
        if (isSampleAsset(ph?.[k])) hits.push(`Photo de façade (${k.replace('facade_', '')})`)
    }

    return hits.filter((h, i) => hits.indexOf(h) === i)
}

/**
 * En production, un dossier contenant encore des visuels de démonstration ne
 * doit pas être généré. En développement, le harnais de test doit continuer de
 * fonctionner : on laisse passer.
 */
export function blocksGeneration(data: DPFormData): string[] {
    if (process.env.NODE_ENV !== 'production') return []
    return sampleAssetsIn(data)
}
