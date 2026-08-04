// Contrôle rapide d'un CERFA généré : quel formulaire, et les champs sensibles.
//
//   node scripts/verify-cerfa.mjs test-output/TEST_CERFA.pdf
//
// Le formulaire est reconnu à la présence du tableau des destinations, qui
// n'existe que sur le 16702 ; les libellés s'adaptent, car les deux formulaires
// ne nomment pas de la même façon les surfaces, le lotissement et la première
// pièce jointe (voir la table de correspondance dans lib/cerfaForms.ts).
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'

const file = process.argv[2] || 'test-output/TEST_CERFA.pdf'
const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true })
const form = doc.getForm()
const names = new Set(form.getFields().map(f => f.getName()))
const is13703 = !names.has('W2LA1')

const cb = n => { try { return form.getCheckBox(n).isChecked() } catch { return '—' } }
const tf = n => { try { return form.getTextField(n).getText() || '' } catch { return '—' } }

console.log(`Fichier    : ${file}`)
console.log(`Formulaire : ${is13703 ? 'Cerfa 13703*12 — maison individuelle' : 'Cerfa 16702*03 — autre bien'} (${names.size} champs)`)

console.log('\nDéclarant & terrain')
console.log('  nom / prénom     :', tf('D1N_nom'), '/', tf('D1P_prenom'))
console.log('  parcelle         :', tf('T2F_prefixe'), tf('T2S_section'), tf('T2N_numero'), '—', tf('T2T_superficie'), 'm²')
console.log('  lotissement      :', is13703 ? cb('T2J_lotissement') : cb('T3I_lotoui'))

console.log('\nSurfaces de plancher')
console.log('  existante        :', is13703 ? tf('C7A_surface') : tf('W2LA1'))
console.log('  créée            :', is13703 ? tf('C7U_creee') : tf('W2LB1'))
console.log('  supprimée        :', is13703 ? tf('C7K_supprimee') : tf('W2LD1'))

console.log('\nPérimètres de protection (§5)')
console.log('  site patrimonial :', cb('X2R_remarquable'))
console.log('  abords monument  :', cb('X2H_historique'))
console.log('  site classé      :', cb('X2C_classe'))

console.log('\nBordereau des pièces jointes')
for (const [label, field] of [
    ['DP1 plan de situation', is13703 ? 'P5PA1' : 'P5PA2'],
    ['DP2 plan de masse', 'P5PB1'],
    ['DP3 plan en coupe', 'P3GE1'],
    ['DP4 façades & toitures', 'P3GD1'],
    ['DP5 aspect extérieur', 'P5PC1'],
    ['DP6 insertion', 'P3GF1'],
    ['DP7 vue proche', 'P3GG1'],
    ['DP8 vue lointaine', 'P3GH1'],
    ['DP11 notice matériaux', 'P4CD1'],
]) console.log(`  ${label.padEnd(23)}:`, cb(field))
