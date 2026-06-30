import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
const doc = await PDFDocument.load(await readFile('test-output/TEST_CERFA_13703.pdf'), { ignoreEncryption: true })
const form = doc.getForm()
const cb = n => { try { return form.getCheckBox(n).isChecked() } catch { return '??' } }
const tf = n => { try { return form.getTextField(n).getText() || '' } catch { return '??' } }
console.log('§5 heritage / connexe checkboxes:')
console.log('  1 déroge(2018-937)      :', cb('5_checkbox_1'))
console.log('  2 L632-2-1              :', cb('5_checkbox_2'))
console.log('  3 autre législation     :', cb('5_checkbox_3'))
console.log('  4 réseau chaleur/froid  :', cb('5_checkbox_4'))
console.log('  5 SITE PATRIMONIAL REM. :', cb('5_checkbox_5'), '  <-- expect TRUE (test = SPR Vienne)')
console.log('  6 ABORDS MONUMENT HIST. :', cb('5_checkbox_6'), '  <-- expect TRUE (22 MH < 500m)')
console.log('  7 site classé           :', cb('5_checkbox_7'), '  <-- expect FALSE (no data source)')
console.log('pièces:')
console.log('  dp5_checkbox :', cb('dp5_checkbox'))
console.log('  dp6_checkbox :', cb('dp6_checkbox'))
console.log('  dp11_checkbox:', cb('dp11_checkbox'), '  <-- expect TRUE (protected sector)')
console.log('fields:')
console.log('  4_1_construction_existante_autre :', JSON.stringify(tf('4_1_construction_existante_autre')))
console.log('  4_1_description_projet           :', JSON.stringify(tf('4_1_description_projet').slice(0,90)))
console.log('  4_2_surface_plancher_existante   :', JSON.stringify(tf('4_2_surface_plancher_existante')))
