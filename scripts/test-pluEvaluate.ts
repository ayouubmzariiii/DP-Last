// Unit tests for the deterministic PLU conformity engine.
// Run: npx tsx scripts/test-pluEvaluate.ts   (exits non-zero on any failure)
import { evaluateProject, buildDetailChecks, type DetailCheck } from '../src/lib/pluEvaluate'
import { pluAspectConflicts } from '../src/lib/validation'

let failures = 0
function check(name: string, cond: boolean, detail?: unknown) {
    if (cond) { console.log(`  ✓ ${name}`) }
    else { failures++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail, null, 2) : '') }
}
function section(t: string) { console.log(`\n── ${t}`) }

const HERITAGE = { hasSPR: true, monumentsWithin500m: [] }
const NO_OVERLAYS = {}
const RULES_EMPTY = {
    facade: { allowed_materials: [], forbidden_materials: [], allowed_colors: [], forbidden_colors: [] },
    roof: { allowed_materials: [], forbidden_materials: [], allowed_colors: [], forbidden_colors: [] },
    fence: { max_height_m: null, allowed_materials: [], forbidden_materials: [] },
}

const row = (checks: DetailCheck[], key: string) => checks.find(c => c.key === key)

section('Menuiseries PVC blanc en secteur protégé → matériau en violation, couleur OK')
{
    const travaux = { type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'pvc', couleur: 'Blanc', couleur_ral: 'RAL 9016', nombre: '4', largeur: '120', hauteur: '135', remplacement: true } }
    const r = evaluateProject(travaux, RULES_EMPTY, HERITAGE)
    check('statut NON CONFORME', r.status === 'NON CONFORME', r)
    check('matériau flagged', row(r.detailChecks, 'materiau')?.verdict === 'violation')
    check('couleur ok', row(r.detailChecks, 'couleur')?.verdict === 'ok')
    check('tous les détails présents (type, matériau, couleur, nombre, dimensions, mode)', r.detailChecks.length === 6, r.detailChecks.map(c => c.key))
    check('décision ABF', r.decision === 'DECLARATION_PREALABLE_ABF')
}

section('Recheck après correction du matériau : la COULEUR devient le problème (tout est re-vérifié)')
{
    // The user applied the "bois" suggestion but also set a vivid red — the recheck must catch it.
    const travaux = { type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'bois', couleur: 'Rouge vif', nombre: '4' } }
    const r = evaluateProject(travaux, RULES_EMPTY, HERITAGE)
    check('matériau désormais conforme', row(r.detailChecks, 'materiau')?.verdict === 'ok')
    check('couleur vive détectée en violation', row(r.detailChecks, 'couleur')?.verdict === 'violation')
    check('statut reste NON CONFORME', r.status === 'NON CONFORME')
    check('catégorie color présente (propose un correctif couleur)', r.categories.includes('color'))
}

section('« Vieux rose (RAL 3014) » : teinte sourde, PAS une teinte vive')
{
    const travaux = { type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'bois', couleur: 'Vieux rose (RAL 3014)' } }
    const r = evaluateProject(travaux, RULES_EMPTY, HERITAGE)
    check('couleur ok', row(r.detailChecks, 'couleur')?.verdict === 'ok', row(r.detailChecks, 'couleur'))
}

section('Liste blanche matériaux (règlement lu, strict) : hors-liste = violation ; non-strict = à confirmer')
{
    const rules = { ...RULES_EMPTY, facade: { ...RULES_EMPTY.facade, allowed_materials: ['bois'] } }
    const travaux = { type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'aluminium', couleur: '' } }
    const strict = evaluateProject(travaux, rules, NO_OVERLAYS, true)
    const loose = evaluateProject(travaux, rules, NO_OVERLAYS, false)
    check('strict → violation', row(strict.detailChecks, 'materiau')?.verdict === 'violation')
    check('non strict → warning', row(loose.detailChecks, 'materiau')?.verdict === 'warning')
    check('bois dans la liste → ok', row(evaluateProject({ type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'bois' } }, rules, NO_OVERLAYS, true).detailChecks, 'materiau')?.verdict === 'ok')
}

section('Palette de teintes autorisée (strict) : hors palette = violation')
{
    const rules = { ...RULES_EMPTY, facade: { ...RULES_EMPTY.facade, allowed_colors: ['blanc', 'gris'] } }
    const travaux = { type: 'ravalement', ravalement: { finition: 'enduit', couleur: 'Vieux rose (RAL 3014)' } }
    const r = evaluateProject(travaux, rules, NO_OVERLAYS, true)
    check('teinte hors palette → violation', row(r.detailChecks, 'couleur')?.verdict === 'violation', row(r.detailChecks, 'couleur'))
    check('teinte de la palette → ok', row(evaluateProject({ type: 'ravalement', ravalement: { finition: 'enduit', couleur: 'Blanc cassé' } }, rules, NO_OVERLAYS, true).detailChecks, 'couleur')?.verdict === 'ok')
}

section('Clôture : hauteur vs maximum du règlement + matériau interdit hérité de la façade')
{
    const rules = { ...RULES_EMPTY, facade: { ...RULES_EMPTY.facade, forbidden_materials: ['pvc'] }, fence: { max_height_m: 1.8, allowed_materials: [], forbidden_materials: [] } }
    const travaux = { type: 'cloture', cloture: { type_cloture: 'panneaux', materiau: 'PVC', couleur: 'Gris anthracite (RAL 7016)', hauteur: '2,20', longueur: '15', sur_voie: true } }
    const r = evaluateProject(travaux, rules, NO_OVERLAYS, true)
    check('hauteur 2,20 m > max 1,8 m → violation', row(r.detailChecks, 'hauteur')?.verdict === 'violation', row(r.detailChecks, 'hauteur'))
    check('catégorie fence_height présente', r.categories.includes('fence_height'))
    check('PVC interdit (hérité des règles façade) → violation', row(r.detailChecks, 'materiau')?.verdict === 'violation')
    check('hauteur 1,60 m → ok', row(evaluateProject({ type: 'cloture', cloture: { type_cloture: 'grillage', materiau: 'acier', hauteur: '1.6' } }, rules, NO_OVERLAYS, true).detailChecks, 'hauteur')?.verdict === 'ok')
    check('hauteur manquante → non renseigné (pas violation)', row(evaluateProject({ type: 'cloture', cloture: { type_cloture: 'grillage' } }, rules, NO_OVERLAYS, true).detailChecks, 'hauteur')?.verdict === 'missing')
}

section('Clôture sans règle de hauteur : > 2 m = avertissement (pas de fausse violation)')
{
    const travaux = { type: 'cloture', cloture: { type_cloture: 'mur', materiau: 'maçonnerie', hauteur: '2.4' } }
    const r = evaluateProject(travaux, RULES_EMPTY, NO_OVERLAYS, false)
    check('hauteur → warning', row(r.detailChecks, 'hauteur')?.verdict === 'warning')
    check('pas de violation', r.violations.length === 0, r.violations)
}

section('Toiture : bac acier proscrit en secteur protégé ; zinc interdit par le règlement')
{
    const rHeritage = evaluateProject({ type: 'toiture', toiture: { operation: 'changement_materiau', materiau_couverture: 'Bac acier', couleur: '' } }, RULES_EMPTY, HERITAGE)
    check('bac acier en SPR → violation', row(rHeritage.detailChecks, 'materiau_couverture')?.verdict === 'violation')
    const rules = { ...RULES_EMPTY, roof: { ...RULES_EMPTY.roof, forbidden_materials: ['zinc'] } }
    const rZinc = evaluateProject({ type: 'toiture', toiture: { operation: 'refection_identique', materiau_couverture: 'Zinc', couleur: 'Gris' } }, rules, NO_OVERLAYS, true)
    check('zinc interdit par le règlement → violation', row(rZinc.detailChecks, 'materiau_couverture')?.verdict === 'violation')
    // Roof colour falls back to the façade colour lists when no roof-specific list exists.
    const rulesC = { ...RULES_EMPTY, facade: { ...RULES_EMPTY.facade, forbidden_colors: ['noir'] } }
    const rColor = evaluateProject({ type: 'toiture', toiture: { operation: 'refection_identique', materiau_couverture: 'Tuile', couleur: 'Noir' } }, rulesC, NO_OVERLAYS, true)
    check('teinte de toiture interdite (repli sur listes façade) → violation', row(rColor.detailChecks, 'couleur')?.verdict === 'violation')
}

section('Photovoltaïque : surimposition visible en secteur protégé → violation ; intégré → ok')
{
    const bad = evaluateProject({ type: 'photovoltaique', photovoltaique: { integration: 'surimposition', nombre_panneaux: '12', orientation: 'Sud' } }, RULES_EMPTY, HERITAGE)
    check('surimposition en SPR → violation', row(bad.detailChecks, 'integration')?.verdict === 'violation')
    const good = evaluateProject({ type: 'photovoltaique', photovoltaique: { integration: 'integration', nombre_panneaux: '12' } }, RULES_EMPTY, HERITAGE)
    check('intégré au bâti → ok', row(good.detailChecks, 'integration')?.verdict === 'ok')
    check('détails annexes listés (nombre, …)', good.detailChecks.some(c => c.key === 'nombre_panneaux'))
}

section('Ouverture : façade sur rue en secteur protégé → violation ; façade arrière → ok')
{
    const bad = evaluateProject({ type: 'ouverture', ouverture: { type_ouverture: 'fenetre', operation: 'creation', facade: 'Façade avant sur rue' } }, RULES_EMPTY, HERITAGE)
    check('façade sur rue → violation', row(bad.detailChecks, 'facade')?.verdict === 'violation')
    const good = evaluateProject({ type: 'ouverture', ouverture: { type_ouverture: 'fenetre', operation: 'creation', facade: 'Façade arrière (jardin)' } }, RULES_EMPTY, HERITAGE)
    check('façade arrière → ok', row(good.detailChecks, 'facade')?.verdict === 'ok', row(good.detailChecks, 'facade'))
    const velux = evaluateProject({ type: 'ouverture', ouverture: { type_ouverture: 'fenetre_toit', operation: 'creation', facade: 'Façade arrière (jardin)' } }, RULES_EMPTY, HERITAGE)
    check('fenêtre de toit en SPR → avertissement sur le type', row(velux.detailChecks, 'type_ouverture')?.verdict === 'warning')
}

section('Champs manquants → « non renseigné », jamais une fausse conformité silencieuse')
{
    const r = evaluateProject({ type: 'menuiseries', menuiseries: {} }, RULES_EMPTY, NO_OVERLAYS)
    check('type manquant listé', row(r.detailChecks, 'type')?.verdict === 'missing')
    check('matériau manquant listé', row(r.detailChecks, 'materiau')?.verdict === 'missing')
    check('aucune violation inventée', r.violations.length === 0, r.violations)
}

section('Hors secteur protégé, sans règles : projet conforme')
{
    const r = evaluateProject({ type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'pvc', couleur: 'Blanc (RAL 9016)' } }, RULES_EMPTY, NO_OVERLAYS)
    check('statut PROBABLEMENT CONFORME', r.status === 'PROBABLEMENT CONFORME', r)
    check('PVC autorisé hors SPR', row(r.detailChecks, 'materiau')?.verdict === 'ok')
}

section('Scénario rapporté : porte aluminium rose — les DEUX défauts flagués ensemble, verdict et carte INTERDIT d’accord')
{
    // Règlement as extracted by the AI: forbidden lists phrased as in real documents.
    const rules = {
        ...RULES_EMPTY,
        facade: {
            ...RULES_EMPTY.facade,
            forbidden_materials: ['menuiseries aluminium', 'PVC'],
            forbidden_colors: ['rose', 'couleurs vives'],
            allowed_materials: ['bois'],
        },
    }
    const before = { type: 'menuiseries', menuiseries: { type: 'porte', materiau: 'aluminium', couleur: 'Rose' } }
    const r1 = evaluateProject(before, rules, NO_OVERLAYS, true)
    check('matériau aluminium détecté via « menuiseries aluminium » (alias/substring)', row(r1.detailChecks, 'materiau')?.verdict === 'violation', row(r1.detailChecks, 'materiau'))
    check('teinte rose détectée en même temps', row(r1.detailChecks, 'couleur')?.verdict === 'violation', row(r1.detailChecks, 'couleur'))
    check('les deux catégories présentes → la proposition corrigera matériau ET couleur', r1.categories.includes('facade_mat') && r1.categories.includes('color'), r1.categories)

    // The user applies the "bois" suggestion but keeps the pink: the verdict MUST stay non conforme.
    const after = { type: 'menuiseries', menuiseries: { type: 'porte', materiau: 'bois', couleur: 'Rose' } }
    const r2 = evaluateProject(after, rules, NO_OVERLAYS, true)
    check('après correction du matériau seul → toujours NON CONFORME (le rose reste interdit)', r2.status === 'NON CONFORME', r2.violations)
    check('matériau bois conforme', row(r2.detailChecks, 'materiau')?.verdict === 'ok')

    // The « INTERDIT » card / generation gate (pluAspectConflicts) delegates to the SAME engine.
    const data: any = { travaux: after, terrain: { plu: { extractedRules: rules, overlays: NO_OVERLAYS, source: 'reglement' } } }
    const conflicts = pluAspectConflicts(data)
    check('carte INTERDIT : teinte rose signalée', conflicts.color?.chosen === 'Rose' && !!conflicts.color?.rule, conflicts)
    check('carte INTERDIT : matériau bois non signalé', conflicts.material === null, conflicts.material)
    const dataBefore: any = { travaux: before, terrain: { plu: { extractedRules: rules, overlays: NO_OVERLAYS, source: 'reglement' } } }
    const conflictsBefore = pluAspectConflicts(dataBefore)
    check('carte INTERDIT (avant correction) : matériau ET teinte signalés', !!conflictsBefore.material && !!conflictsBefore.color, conflictsBefore)
}

section('Menuiserie bois : PAS flaguée par les règles de bardage (« bardage bois composite » proscrit)')
{
    const rules = { ...RULES_EMPTY, facade: { ...RULES_EMPTY.facade, forbidden_materials: ['bardage bois composite', 'bardage métallique'] } }
    const r = evaluateProject({ type: 'menuiseries', menuiseries: { type: 'fenetre', materiau: 'bois' } }, rules, NO_OVERLAYS, true)
    check('bois massif ok malgré « bardage bois composite » proscrit', row(r.detailChecks, 'materiau')?.verdict === 'ok', row(r.detailChecks, 'materiau'))
    const iso = evaluateProject({ type: 'isolation', isolation: { type_finition: 'bardage_metal' } }, rules, NO_OVERLAYS, true)
    check('bardage métal (ITE) bien flagué via son alias', row(iso.detailChecks, 'type_finition')?.verdict === 'violation', row(iso.detailChecks, 'type_finition'))
}

console.log(failures === 0 ? '\nAll PLU engine tests passed.' : `\n${failures} test(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
