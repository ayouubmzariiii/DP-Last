import { facadeElevation, layoutElevation, scaleLabel, num } from '../src/lib/planFacade'
import { defaultFormData, DPFormData } from '../src/lib/models'

const clone = () => JSON.parse(JSON.stringify(defaultFormData)) as DPFormData

// Zone de dessin réelle de la planche DP4 (cf. dpDocGenerator) : A3 paysage.
const AVAIL_W = 1190.55 - 110 - 300 - 100
const AVAIL_H = 506

function show(label: string, mutate: (d: DPFormData) => void) {
    const d = clone()
    mutate(d)
    const e = facadeElevation(d)
    if (!e) { console.log(`${label.padEnd(26)} → null (aucune géométrie cotable)`); return }
    const L = layoutElevation(e, AVAIL_W, AVAIL_H)
    const wPt = L.totalW * L.ptPerM, hPt = L.totalH * L.ptPerM
    const fits = wPt <= AVAIL_W + 0.01 && hPt <= AVAIL_H + 0.01
    console.log(
        `${label.padEnd(26)} ${e.kind.padEnd(9)} ${L.totalW.toFixed(2)}x${L.totalH.toFixed(2)} m` +
        ` → ${scaleLabel(L.denom).padEnd(6)} ${(wPt * 0.352778).toFixed(0)}x${(hPt * 0.352778).toFixed(0)} mm ` +
        `${fits ? 'OK' : '*** DÉBORDE ***'}${hPt < 70 ? ' *** TROP BAS ***' : ''}`
    )
    console.log(`   cotes: ${e.dims.join(' | ')}`)
    if (L.fragmentNote) console.log(`   fragment: ${L.fragmentNote}`)
    if (e.caveats.length) console.log(`   réserves: ${e.caveats.join(' | ')}`)
}

console.log('=== Élévations cotées DP4 ===\n')
show('menuiseries (fixture)', d => { d.travaux.type = 'menuiseries' })
show('ouverture (fixture)', d => { d.travaux.type = 'ouverture' })
show('cloture (fixture)', d => { d.travaux.type = 'cloture' })
show('extension (fixture)', d => { d.travaux.type = 'extension' })
show('abri (fixture)', d => { d.travaux.type = 'abri' })
show('piscine', d => { d.travaux.type = 'piscine' })
show('ravalement', d => { d.travaux.type = 'ravalement' })
show('isolation', d => { d.travaux.type = 'isolation' })
show('toiture', d => { d.travaux.type = 'toiture' })
show('photovoltaique', d => { d.travaux.type = 'photovoltaique' })
show('terrassement', d => { d.travaux.type = 'terrassement' })

console.log('\n=== Cas limites ===\n')
show('extension 12x6 toit plat', d => {
    d.travaux.type = 'extension'
    Object.assign(d.travaux.extension!, { largeur: '12', profondeur: '6', hauteur_egout: '3', hauteur_faitage: '3', type_toit: 'flat', cote_adossement: 'droite' })
})
show('clôture 60 m x 1,80', d => {
    d.travaux.type = 'cloture'
    Object.assign(d.travaux.cloture!, { hauteur: '1.80', longueur: '60', type_cloture: 'mur_bahut' })
})
show('clôture 2 m x 2,50 (mur)', d => {
    d.travaux.type = 'cloture'
    Object.assign(d.travaux.cloture!, { hauteur: '2.50', longueur: '2', type_cloture: 'mur' })
})
show('baie 4,00 x 2,40, x5', d => {
    d.travaux.type = 'ouverture'
    Object.assign(d.travaux.ouverture!, { largeur: '400', hauteur: '240', nombre: '5', type_ouverture: 'porte_fenetre', operation: 'creation' })
})
show('fenêtre 60x60 cm', d => {
    d.travaux.type = 'ouverture'
    Object.assign(d.travaux.ouverture!, { largeur: '60', hauteur: '60', nombre: '1', type_ouverture: 'fenetre', operation: 'creation' })
})
show('suppression ouverture', d => {
    d.travaux.type = 'ouverture'
    Object.assign(d.travaux.ouverture!, { largeur: '120', hauteur: '150', nombre: '2', type_ouverture: 'fenetre', operation: 'suppression' })
})
show('extension sans hauteurs', d => {
    d.travaux.type = 'extension'
    Object.assign(d.travaux.extension!, { largeur: '4', profondeur: '5', hauteur_egout: '', hauteur_faitage: '', type_toit: 'double' })
})
show('extension largeur vide', d => {
    d.travaux.type = 'extension'
    Object.assign(d.travaux.extension!, { largeur: '', hauteur_egout: '2.6', hauteur_faitage: '4.1' })
})
show('saisie à la virgule', d => {
    d.travaux.type = 'cloture'
    Object.assign(d.travaux.cloture!, { hauteur: '1,75', longueur: '12,5', type_cloture: 'claire_voie' })
})

console.log('\n=== num() ===')
for (const v of ['1,75', '1.75', ' 2 m ', '', 'abc', '-3']) console.log(`  ${JSON.stringify(v).padEnd(8)} → ${num(v)}`)

console.log('\n=== Échelle : vérification du ratio imprimé ===')
// 1 m réel à 1/50 doit mesurer exactement 20 mm sur le papier.
for (const denom of [5, 10, 20, 25, 50, 100, 200]) {
    const ptPerM = (72 / 0.0254) / denom
    console.log(`  1/${String(denom).padEnd(4)} : 1 m réel = ${(ptPerM * 0.352778).toFixed(2)} mm imprimés (attendu ${(1000 / denom).toFixed(2)})`)
}
