// ─────────────────────────────────────────────────────────────────────────────
// PLU conformity engine — deterministic, field-by-field.
//
// EVERY détail of the work type is accounted for (type, matériau, couleur,
// hauteur, …), each with its own verdict, so the UI can show a field-by-field
// checklist and the verdict can never silently skip a field. The verdict lists
// (violations / warnings) are DERIVED from these checks: one source of truth,
// re-computed in full on every analysis — including re-checks after the user
// applies a suggestion (the whole travaux object is re-evaluated, never a diff).
//
// Lives in lib (not the API route) so it is unit-testable and importable by
// both the route and any future server code.
// ─────────────────────────────────────────────────────────────────────────────

// Accent- and case-insensitive normalisation for robust keyword matching.
export const norm = (s: any): string => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
export const normList = (arr: any): string[] => (Array.isArray(arr) ? arr : []).map(norm).filter(Boolean)

export type DetailVerdict = 'ok' | 'violation' | 'warning' | 'missing' | 'na'
export interface DetailCheck {
    key: string                                   // form field key (or synthetic)
    label: string
    value: string                                 // raw value as typed by the user
    kind: 'material' | 'color' | 'number' | 'text'
    verdict: DetailVerdict
    note: string                                  // short per-row explanation
    message?: string                              // full sentence for the violations/warnings lists
    category?: string                             // violation category → drives the editable proposal
}

// Heritage (SPR / abords MH) proscriptions — reliable regardless of the règlement PDF.
const HERITAGE_MAT = ['pvc', 'tole', 'bac acier', 'bardage metal', 'aluminium brut', 'fibrociment', 'beton brut', 'plastique']
const HERITAGE_ROOF = ['bac acier', 'tole', 'zinc', 'fibrociment', 'bardeau', 'shingle', 'plastique']
const BRIGHT_COLORS = ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'rose', 'violet', 'turquoise', 'fuchsia', 'fluo', 'flashy', 'vif']
const NEUTRAL_COLORS = ['fonce', 'sombre', 'pastel', 'sable', 'naturel', 'anthracite', 'ardoise', 'taupe', 'gris', 'beige', 'blanc', 'creme', 'ecru', 'pierre', 'bois', 'vieux']

type CheckCtx = { rules: any; heritage: boolean; strict: boolean }

// A material-ish field vs the règlement lists + heritage proscriptions.
// bucket picks which rules section applies; fence falls back to facade rules.
function checkMaterial(key: string, label: string, raw: string, ctx: CheckCtx, bucket: 'facade' | 'roof' | 'fence', category: string, required: boolean): DetailCheck {
    const base: Omit<DetailCheck, 'verdict' | 'note'> = { key, label, value: (raw || '').trim(), kind: 'material', category }
    const v = norm(raw)
    if (!v) return { ...base, verdict: required ? 'missing' : 'na', note: required ? 'Non renseigné — complétez ce champ à l’étape Travaux.' : 'Non renseigné.' }
    const R = bucket === 'roof' ? ctx.rules?.roof : bucket === 'fence' ? (ctx.rules?.fence || ctx.rules?.facade) : ctx.rules?.facade
    // Fences: the clôture article's own lists apply, but a matériau the règlement forbids on
    // façades stays forbidden on the clôture too (the fence section may simply not repeat it).
    // The allowed-list is NOT inherited — a façade "enduit only" rule must not flag a grillage.
    const forbidden = bucket === 'fence'
        ? Array.from(new Set([...normList(R?.forbidden_materials), ...normList(ctx.rules?.facade?.forbidden_materials)]))
        : normList(R?.forbidden_materials)
    const allowedRaw: string[] = Array.isArray(R?.allowed_materials) ? R.allowed_materials : []
    const allowed = normList(allowedRaw)
    const heritageList = bucket === 'roof' ? HERITAGE_ROOF : HERITAGE_MAT
    if (ctx.heritage && heritageList.some(x => v.includes(x))) {
        return { ...base, verdict: 'violation', note: 'Proscrit en secteur protégé : l’ABF impose des matériaux traditionnels.', message: `${label} « ${raw} » proscrit en secteur protégé (SPR / PSMV / abords de Monument Historique) : l'ABF impose des matériaux traditionnels (bois, pierre, enduit à la chaux). Refus très probable en l'état.` }
    }
    if (forbidden.some(x => v.includes(x))) {
        return { ...base, verdict: 'violation', note: 'Figure parmi les matériaux interdits par le règlement de la zone.', message: `${label} « ${raw} » interdit par le règlement de la zone.` }
    }
    if (allowed.length) {
        if (allowed.some(x => v.includes(x) || x.includes(v))) return { ...base, verdict: 'ok', note: 'Dans la liste des matériaux autorisés par le règlement.' }
        const list = allowedRaw.join(', ')
        return ctx.strict
            ? { ...base, verdict: 'violation', note: `Hors de la liste des matériaux autorisés par le règlement (${list}).`, message: `${label} « ${raw} » hors de la liste des matériaux autorisés par le règlement de la zone (${list}).` }
            : { ...base, verdict: 'warning', note: `Hors des matériaux explicitement autorisés (${list}) — à confirmer.`, message: `${label} « ${raw} » hors de la liste des matériaux explicitement autorisés (${list}) : à confirmer avec le règlement officiel.` }
    }
    return { ...base, verdict: 'ok', note: 'Aucune interdiction détectée dans le règlement.' }
}

// A teinte/couleur field vs forbidden/allowed colour lists + the heritage "sober palette" rule.
function checkColor(key: string, label: string, raw: string, ctx: CheckCtx, bucket: 'facade' | 'roof', required: boolean): DetailCheck {
    const base: Omit<DetailCheck, 'verdict' | 'note'> = { key, label, value: (raw || '').trim(), kind: 'color', category: 'color' }
    const v = norm(raw)
    if (!v) return { ...base, verdict: required ? 'missing' : 'na', note: required ? 'Non renseigné — complétez ce champ à l’étape Travaux.' : 'Non renseigné.' }
    // Roof colours fall back to the façade colour lists when the règlement has no roof-specific ones.
    const roofR = ctx.rules?.roof, facR = ctx.rules?.facade
    const pick = (field: 'forbidden_colors' | 'allowed_colors'): string[] => {
        if (bucket === 'roof' && Array.isArray(roofR?.[field]) && roofR[field].length) return roofR[field]
        return Array.isArray(facR?.[field]) ? facR[field] : []
    }
    const forbiddenRaw = pick('forbidden_colors'), allowedRaw = pick('allowed_colors')
    const forbidden = normList(forbiddenRaw), allowed = normList(allowedRaw)
    const isBright = v.includes('vif') || (BRIGHT_COLORS.some(b => v.includes(b)) && !NEUTRAL_COLORS.some(n => v.includes(n)))
    if (ctx.heritage && isBright) {
        return { ...base, verdict: 'violation', note: 'Teinte vive, proscrite en secteur protégé : palette sobre locale exigée (ABF).', message: `Teinte « ${raw} » proscrite en secteur protégé : seules les teintes sobres de la palette locale, validées par l'ABF, sont admises.` }
    }
    if (forbidden.some(x => v.includes(x))) {
        return { ...base, verdict: 'violation', note: 'Figure parmi les teintes interdites par le règlement de la zone.', message: `Teinte « ${raw} » interdite par le règlement de la zone.` }
    }
    if (allowed.length) {
        if (allowed.some(x => v.includes(x) || x.includes(v))) return { ...base, verdict: 'ok', note: 'Dans la palette de teintes autorisée par le règlement.' }
        const list = allowedRaw.join(', ')
        return ctx.strict
            ? { ...base, verdict: 'violation', note: `Hors de la palette autorisée par le règlement (${list}).`, message: `Teinte « ${raw} » hors de la palette de teintes autorisée par le règlement de la zone (${list}).` }
            : { ...base, verdict: 'warning', note: `Hors de la palette explicitement autorisée (${list}) — à confirmer.`, message: `Teinte « ${raw} » hors de la palette explicitement autorisée (${list}) : à confirmer avec le règlement officiel.` }
    }
    return { ...base, verdict: 'ok', note: 'Aucune restriction de teinte détectée dans le règlement.' }
}

const naCheck = (key: string, label: string, value: any, note = 'Sans incidence sur la conformité PLU.'): DetailCheck | null => {
    const v = (value ?? '').toString().trim()
    if (!v) return null
    return { key, label, value: v, kind: 'text', verdict: 'na', note }
}

// The full field-by-field checklist for the current work type.
export function buildDetailChecks(travaux: any, rules: any, overlays: any, strict: boolean): DetailCheck[] {
    const heritage = !!(overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0))
    const ctx: CheckCtx = { rules, heritage, strict }
    const t = travaux.type
    const out: (DetailCheck | null)[] = []

    if (t === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        out.push(
            m.type
                ? { key: 'type', label: 'Type de menuiserie', value: m.type, kind: 'text', verdict: 'ok', note: 'Aucune restriction de type détectée dans le règlement.' }
                : { key: 'type', label: 'Type de menuiserie', value: '', kind: 'text', verdict: 'missing', note: 'Non renseigné — complétez ce champ à l’étape Travaux.' },
            checkMaterial('materiau', 'Matériau', m.materiau, ctx, 'facade', 'facade_mat', true),
            checkColor('couleur', 'Couleur', `${m.couleur || ''}${m.couleur_ral ? ` (${m.couleur_ral})` : ''}`.trim(), ctx, 'facade', false),
            naCheck('nombre', 'Nombre d’éléments', m.nombre),
            naCheck('dimensions', 'Dimensions', m.largeur && m.hauteur ? `${m.largeur} × ${m.hauteur} cm` : ''),
            naCheck('remplacement', 'Mode', m.remplacement == null ? '' : (m.remplacement ? 'Remplacement de l’existant' : 'Création'), m.remplacement === false ? 'Une création modifie l’aspect : veillez à l’harmonie avec les baies existantes.' : 'Sans incidence sur la conformité PLU.'),
        )
    } else if (t === 'isolation' && travaux.isolation) {
        const iso = travaux.isolation
        out.push(
            checkMaterial('type_finition', 'Type de finition', (iso.type_finition || '').replace(/_/g, ' '), ctx, 'facade', 'facade_mat', true),
            checkColor('couleur', 'Couleur de finition', iso.couleur, ctx, 'facade', false),
            naCheck('materiau_isolant', 'Matériau isolant', iso.materiau_isolant, 'Non visible une fois posé : sans incidence sur l’aspect extérieur.'),
        )
        const ep = parseFloat((iso.epaisseur_isolant || '').toString().replace(',', '.'))
        if (Number.isFinite(ep) && ep > 0) {
            out.push(ep > 30
                ? { key: 'epaisseur_isolant', label: 'Épaisseur de l’isolant', value: `${ep} cm`, kind: 'number', verdict: 'warning', note: 'Débord important : vérifiez l’emprise sur le domaine public / les limites séparatives.', message: `Épaisseur d'isolant de ${ep} cm : le débord sur le domaine public ou en limite séparative doit être vérifié (dérogation d'implantation le cas échéant).` }
                : { key: 'epaisseur_isolant', label: 'Épaisseur de l’isolant', value: `${ep} cm`, kind: 'number', verdict: 'ok', note: 'Débord usuel, sans incidence PLU particulière.' })
        }
        out.push(naCheck('facades_concernees', 'Façades concernées', iso.facades_concernees?.join(', ')))
    } else if (t === 'photovoltaique' && travaux.photovoltaique) {
        const pv = travaux.photovoltaique
        const pvVisible = norm(pv.integration) === 'surimposition' || /rue|visible|voie|public/.test(norm(pv.description))
        out.push(
            pv.integration
                ? (heritage && pvVisible
                    ? { key: 'integration', label: 'Mode d’intégration', value: pv.integration, kind: 'text', verdict: 'violation', category: 'pv', note: 'Surimposition visible en secteur protégé : généralement refusée par l’ABF.', message: `Panneaux photovoltaïques en surimposition visibles depuis l'espace public : généralement refusés en secteur protégé (SPR / abords de Monument Historique). Une pose non visible depuis la rue, ou intégrée, est requise.` }
                    : { key: 'integration', label: 'Mode d’intégration', value: pv.integration, kind: 'text', verdict: 'ok', note: heritage ? 'Intégration compatible avec le secteur protégé (à confirmer avec l’ABF).' : 'Aucune restriction détectée dans le règlement.' })
                : { key: 'integration', label: 'Mode d’intégration', value: '', kind: 'text', verdict: 'missing', note: 'Non renseigné — complétez ce champ à l’étape Travaux.' },
            naCheck('nombre_panneaux', 'Nombre de panneaux', pv.nombre_panneaux),
            naCheck('surface_totale', 'Surface totale', pv.surface_totale ? `${pv.surface_totale} m²` : '', 'Les panneaux ne créent pas de surface de plancher.'),
            naCheck('puissance_kw', 'Puissance', pv.puissance_kw ? `${pv.puissance_kw} kWc` : ''),
            naCheck('orientation', 'Orientation', pv.orientation),
            naCheck('inclinaison', 'Inclinaison', pv.inclinaison ? `${pv.inclinaison}°` : ''),
            naCheck('marque', 'Marque / modèle', pv.marque),
        )
    } else if (t === 'cloture' && travaux.cloture) {
        const c = travaux.cloture
        out.push(
            checkMaterial('type_cloture', 'Type de clôture', (c.type_cloture || '').replace(/_/g, ' '), ctx, 'fence', 'facade_mat', true),
            checkMaterial('materiau', 'Matériau', c.materiau, ctx, 'fence', 'facade_mat', false),
            checkColor('couleur', 'Couleur', c.couleur, ctx, 'facade', false),
        )
        const h = parseFloat((c.hauteur || '').toString().replace(',', '.'))
        const maxH = Number(rules?.fence?.max_height_m) > 0 ? Number(rules.fence.max_height_m) : null
        if (!Number.isFinite(h) || h <= 0) {
            out.push({ key: 'hauteur', label: 'Hauteur', value: '', kind: 'number', verdict: 'missing', note: 'Non renseignée — la hauteur est nécessaire pour vérifier la conformité.' })
        } else if (maxH && h > maxH) {
            out.push({ key: 'hauteur', label: 'Hauteur', value: `${h} m`, kind: 'number', verdict: 'violation', category: 'fence_height', note: `Supérieure au maximum autorisé par le règlement (${maxH} m).`, message: `Hauteur de clôture (${h} m) supérieure au maximum autorisé par le règlement de la zone (${maxH} m).` })
        } else if (!maxH && h > 2) {
            out.push({ key: 'hauteur', label: 'Hauteur', value: `${h} m`, kind: 'number', verdict: 'warning', note: 'Supérieure au plafond usuel (≈ 2 m) : à confirmer avec le règlement communal.', message: `Hauteur de clôture (${h} m) supérieure au plafond usuel (≈ 2 m) en centre ancien : à confirmer avec le règlement communal.` })
        } else {
            out.push({ key: 'hauteur', label: 'Hauteur', value: `${h} m`, kind: 'number', verdict: 'ok', note: maxH ? `Sous le maximum autorisé (${maxH} m).` : 'Sous le plafond usuel (≈ 2 m).' })
        }
        out.push(
            naCheck('longueur', 'Longueur', c.longueur ? `${c.longueur} m` : ''),
            naCheck('sur_voie', 'Implantation', c.sur_voie == null ? '' : (c.sur_voie ? 'Sur rue / voie publique' : 'Limite séparative'), c.sur_voie ? 'Les clôtures sur rue sont les plus encadrées par le règlement.' : 'Sans incidence sur la conformité PLU.'),
        )
    } else if (t === 'ravalement' && travaux.ravalement) {
        const r = travaux.ravalement
        out.push(
            checkMaterial('finition', 'Finition', (r.finition || '').replace(/_/g, ' '), ctx, 'facade', 'facade_mat', true),
            checkColor('couleur', 'Teinte / couleur', r.couleur, ctx, 'facade', true),
            checkMaterial('materiau', 'Matériau', r.materiau, ctx, 'facade', 'facade_mat', false),
            naCheck('facades_concernees', 'Façades concernées', r.facades_concernees?.join(', ')),
        )
    } else if (t === 'toiture' && travaux.toiture) {
        const to = travaux.toiture
        out.push(
            naCheck('operation', 'Opération', (to.operation || '').replace(/_/g, ' '), norm(to.operation) === 'refection identique' ? 'Une réfection à l’identique est la plus simple à faire accepter.' : 'Un changement de matériau est contrôlé au titre de l’aspect extérieur.'),
            checkMaterial('materiau_couverture', 'Matériau de couverture', to.materiau_couverture, ctx, 'roof', 'roof', true),
            checkColor('couleur', 'Teinte / couleur', to.couleur, ctx, 'roof', false),
        )
    } else if (t === 'ouverture' && travaux.ouverture) {
        const o = travaux.ouverture
        const visible = /rue|voie|visible|facade avant|toit/.test(norm(o.facade))
        out.push(
            o.type_ouverture
                ? (heritage && norm(o.type_ouverture).replace(/_/g, ' ') === 'fenetre toit'
                    ? { key: 'type_ouverture', label: 'Type d’ouverture', value: o.type_ouverture, kind: 'text', verdict: 'warning', note: 'Fenêtre de toit en secteur protégé : privilégiez un versant non visible depuis la rue.', message: 'Fenêtre de toit en secteur protégé : l’ABF refuse généralement les châssis sur les versants visibles depuis l’espace public — privilégiez le versant arrière.' }
                    : { key: 'type_ouverture', label: 'Type d’ouverture', value: o.type_ouverture, kind: 'text', verdict: 'ok', note: 'Aucune restriction de type détectée dans le règlement.' })
                : { key: 'type_ouverture', label: 'Type d’ouverture', value: '', kind: 'text', verdict: 'missing', note: 'Non renseigné — complétez ce champ à l’étape Travaux.' },
            naCheck('operation', 'Opération', o.operation),
            o.facade
                ? (heritage && visible
                    ? { key: 'facade', label: 'Façade concernée', value: o.facade, kind: 'text', verdict: 'violation', category: 'opening', note: 'Façade / versant visible depuis la rue en secteur protégé : avis conforme ABF, refus fréquent.', message: `Création / modification d'ouverture sur une façade ou un versant de toiture visible depuis la rue, en secteur protégé : soumise à l'avis conforme de l'ABF et généralement refusée lorsqu'elle altère la composition d'origine (ex. fenêtre de toit sur le versant donnant sur rue).` }
                    : { key: 'facade', label: 'Façade concernée', value: o.facade, kind: 'text', verdict: 'ok', note: heritage ? 'Façade non visible depuis l’espace public : plus facilement acceptée.' : 'Aucune restriction détectée dans le règlement.' })
                : { key: 'facade', label: 'Façade concernée', value: '', kind: 'text', verdict: 'missing', note: 'Non renseignée — complétez ce champ à l’étape Travaux.' },
        )
    }

    return out.filter((c): c is DetailCheck => !!c)
}

export function evaluateProject(travaux: any, rules: any, overlays: any, strict = false) {
    // Dedupe violations by category so the règlement-based and heritage checks never double-count.
    const V = new Map<string, string>()
    const warnings: string[] = []
    const violate = (cat: string, msg: string) => { if (!V.has(cat)) V.set(cat, msg) }
    let decision = 'DECLARATION_PREALABLE_OK'

    const heritage = !!(overlays?.hasSPR || (overlays?.monumentsWithin500m && overlays.monumentsWithin500m.length > 0))

    // ── 1. Surfaces (extension) ──────────────────────────────────────────────
    const creeeSurface = parseFloat(travaux.surfaces?.creee || '0')
    const maxArea = rules?.extension?.max_area_m2 || 20
    if (creeeSurface > 0) {
        if (creeeSurface > 150) {
            decision = 'PERMIS_CONSTRUIRE'
            violate('surface', `La surface de plancher créée porte le total au-delà de 150 m² : un Permis de Construire avec recours à un architecte est requis (au-delà de la Déclaration Préalable).`)
        } else if (creeeSurface > maxArea) {
            decision = 'PERMIS_CONSTRUIRE'
            violate('surface', `La surface créée (${creeeSurface} m²) dépasse le seuil de la Déclaration Préalable pour cette zone (${maxArea} m²) : un Permis de Construire est requis.`)
        }
    }

    // ── 2. EVERY détail of the work type, checked one by one (single source of truth:
    //       the same rows are shown to the user as the field-by-field checklist). ──
    const detailChecks = buildDetailChecks(travaux, rules, overlays, strict)
    for (const c of detailChecks) {
        if (c.verdict === 'violation') violate(c.category || c.key, c.message || `${c.label} « ${c.value} » non conforme au règlement de la zone.`)
        else if (c.verdict === 'warning' && c.message) warnings.push(c.message)
    }

    // ── 3. Overlays (heritage / flood / seismic) ─────────────────────────────
    if (heritage) {
        if (decision !== 'PERMIS_CONSTRUIRE') decision = 'DECLARATION_PREALABLE_ABF'
        warnings.push(`Projet en secteur sauvegardé (SPR / PSMV) ou aux abords d'un Monument Historique : l'avis conforme de l'Architecte des Bâtiments de France (ABF) est obligatoire (délai d'instruction porté à 2 mois).`)
    }
    if (overlays?.hasFloodRisk || overlays?.hasPPRN) {
        warnings.push(`Le terrain est concerné par un risque d'inondation / un Plan de Prévention des Risques Naturels (PPRN) : les prescriptions de sécurité correspondantes devront être respectées.`)
    }
    if (overlays?.seismicZone && parseInt(overlays.seismicZone) >= 3) {
        warnings.push(`Commune en zone de sismicité ${overlays.seismicClass} : les normes de construction parasismiques s'appliquent.`)
    }

    const violations = Array.from(V.values())
    const status = violations.length ? 'NON CONFORME' : 'PROBABLEMENT CONFORME'
    return { status, decision, violations, warnings, categories: Array.from(V.keys()), detailChecks }
}
