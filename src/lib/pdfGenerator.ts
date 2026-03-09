import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { DPFormData } from './models'
import path from 'path'

// ─── French transliteration (no accented chars in PDF StandardFonts) ─────────
function s(text: string): string {
    const map: Record<string, string> = {
        'e\u0301': 'e', 'e\u0300': 'e', 'e\u0302': 'e', 'e\u0308': 'e',
        'a\u0300': 'a', 'a\u0302': 'a', 'a\u0308': 'a',
        'o\u0302': 'o', 'o\u0308': 'o',
        'u\u0302': 'u', 'u\u0300': 'u', 'u\u0308': 'u',
        'i\u0302': 'i', 'i\u0308': 'i',
        '\u00e9': 'e', '\u00e8': 'e', '\u00ea': 'e', '\u00eb': 'e',
        '\u00e0': 'a', '\u00e2': 'a', '\u00e4': 'a',
        '\u00f4': 'o', '\u00f6': 'o',
        '\u00fb': 'u', '\u00f9': 'u', '\u00fc': 'u',
        '\u00ee': 'i', '\u00ef': 'i',
        '\u00e7': 'c', '\u00e6': 'ae', '\u0153': 'oe',
        '\u00c9': 'E', '\u00c8': 'E', '\u00ca': 'E',
        '\u00c0': 'A', '\u00c2': 'A',
        '\u00d4': 'O', '\u00db': 'U', '\u00ce': 'I',
        '\u00c7': 'C', '\u00c6': 'AE', '\u0152': 'OE',
        '\u2013': '-', '\u2014': '-', '\u2019': "'", '\u2018': "'",
        '\u00b0': 'deg', '\u00b2': 'm2', '\u00d7': 'x', '\u20ac': 'EUR',
        '\u00ab': '"', '\u00bb': '"', '\u2026': '...', '\u2022': '-',
    }
    return (text || '').replace(/[^\x00-\x7F]/g, c => map[c] ?? '')
}

/**
 * Generates the Cerfa 13703* PDF by loading the base PDF and filling all fields.
 * Reads cerfa.pdf directly from the filesystem (server) or via fetch (browser).
 */
export async function generateCerfaPdf(data: DPFormData): Promise<Uint8Array> {
    const { demandeur, terrain, travaux } = data

    try {
        let pdfBytes: ArrayBuffer

        if (typeof window === 'undefined') {
            // ── Server-side: read directly from filesystem ────────────────
            const fs = await import('fs/promises')
            const filePath = path.join(process.cwd(), 'public', 'cerfa.pdf')
            try {
                const buf = await fs.readFile(filePath)
                pdfBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
            } catch (e) {
                console.error('[CERFA] cerfa.pdf not found at', filePath, e)
                return generateFallbackCerfa(data)
            }
        } else {
            // ── Client-side: fetch from server ────────────────────────────
            const response = await fetch('/cerfa.pdf')
            if (!response.ok) {
                console.warn('[CERFA] Base PDF fetch failed:', response.status)
                return generateFallbackCerfa(data)
            }
            pdfBytes = await response.arrayBuffer()
        }

        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

        const form = pdfDoc.getForm()

        // Helper: safely set a text field (handles missing fields gracefully)
        const setField = (name: string, value: string) => {
            if (!value) return
            try {
                const field = form.getTextField(name.trim())
                field.setText(s(value))
            } catch {
                console.debug(`[CERFA] Field not found or not text: "${name}"`)
            }
        }

        // Helper: safely check/uncheck a checkbox
        const checkBox = (name: string, val: boolean) => {
            try {
                const field = form.getCheckBox(name.trim())
                if (val) field.check()
                else field.uncheck()
            } catch {
                console.debug(`[CERFA] Checkbox not found: "${name}"`)
            }
        }

        // Helper: set fragmented fields like "2_adresse_code_postal_1" to "5". 
        const setFragmented = (prefix: string, value: string, max: number) => {
            if (!value) return
            const cleanValue = s(value).replace(/\s+/g, '') // remove spaces for zip, phone, siret
            for (let i = 0; i < max; i++) {
                if (cleanValue[i]) {
                    setField(`${prefix}_${i + 1}`, cleanValue[i])
                }
            }
        }

        // Helper: set email specifically. Example: "jean.martin@example.com" -> email_1 = jean.martin, email_2 = example.com
        const setEmailField = (prefix: string, emailStr: string) => {
            if (!emailStr) return
            const parts = emailStr.split('@')
            setField(`${prefix}_1`, parts[0] || '')
            if (parts.length > 1) {
                setField(`${prefix}_2`, parts.slice(1).join('@'))
            }
        }


        // Helper: set date specifically. Example: "15/06/1984" -> j_1, j_2, m_1, m_2, a_1, a_2, a_3, a_4
        const setDateField = (prefix: string, dateStr: string) => {
            if (!dateStr) return
            let j, m, a;
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-')
                if (parts.length === 3) {
                    a = parts[0].padStart(4, '0')
                    m = parts[1].padStart(2, '0')
                    j = parts[2].padStart(2, '0')
                }
            } else {
                const parts = dateStr.split('/')
                if (parts.length === 3) {
                    j = parts[0].padStart(2, '0')
                    m = parts[1].padStart(2, '0')
                    a = parts[2].padStart(4, '0')
                }
            }
            if (j && m && a) {
                setField(`${prefix}_j_1`, j[0])
                setField(`${prefix}_j_2`, j[1])
                setField(`${prefix}_m_1`, m[0])
                setField(`${prefix}_m_2`, m[1])
                setField(`${prefix}_a_1`, a[0])
                setField(`${prefix}_a_2`, a[1])
                setField(`${prefix}_a_3`, a[2])
                setField(`${prefix}_a_4`, a[3])
            }
        }

        const extractAddress = (fullAddress: string) => {
            // Regex enforces word boundary so "rue" doesn't falsely get captured as an address number suffix (like "bis")
            const match = fullAddress.match(/^(\d+(?:\s*(?:bis|ter|quater|[a-zA-Z]\b))?)\s+(.*)$/i);
            if (match) {
                return { numero: match[1].trim(), voie: match[2].trim() };
            }
            return { numero: '', voie: fullAddress };
        }

        const c = data.cerfa
        if (!c) {
            console.warn('[CERFA] data.cerfa sub-object missing, fallback logic initiated.')
            return generateFallbackCerfa(data)
        }

        // ── 1. DECLARANT (PERSONNE PHYSIQUE OR MORALE) ──────────────────────────────
        if (!demandeur.est_societe) {
            setField('1_1_nom', demandeur.nom)
            setField('1_1_prenom', demandeur.prenom)
            setDateField('1_1_date', demandeur.date_naissance)
            setField('1_1_commune', demandeur.lieu_naissance)
            setFragmented('1_1_departement', demandeur.departement_naissance, 3)
            setField('1_1_pays', demandeur.pays_naissance)

            // clear 1.2
            setField('1_2_morale_denomination', '')
            setField('1_2_morale_raison_sociale', '')
            setField('1_2_morale_type_societe', '')
            setField('1_2_morale_represantant_nom', '')
            setField('1_2_morale_represantant_prenom', '')
            setFragmented('1_2_morale_num_siret', '', 14)
        } else {
            // clear 1.1
            setField('1_1_nom', '')
            setField('1_1_prenom', '')
            setDateField('1_1_date', '')
            setField('1_1_commune', '')
            setFragmented('1_1_departement', '', 3)
            setField('1_1_pays', '')

            setField('1_2_morale_denomination', demandeur.nom_societe)
            setField('1_2_morale_raison_sociale', demandeur.nom_societe)
            setField('1_2_morale_type_societe', demandeur.type_societe)
            setField('1_2_morale_represantant_nom', demandeur.representant_nom)
            setField('1_2_morale_represantant_prenom', demandeur.representant_prenom)
            setFragmented('1_2_morale_num_siret', demandeur.siret, 14)
        }

        // ── 2 DECLARANT ADDRESS ──────────────────────────────
        const declarantAddr = extractAddress(demandeur.adresse);
        setField('2_adresse_numero', declarantAddr.numero)
        setField('2_adresse_voie', declarantAddr.voie)
        setField('2_adresse_lieu', demandeur.lieu_dit)
        setField('2_adresse_localité', demandeur.commune)
        setFragmented('2_adresse_code_postal', demandeur.code_postal, 5)
        setFragmented('2_adresse_BP', demandeur.boite_postale, 3)
        setFragmented('2_adresse_cedex', demandeur.cedex, 2)
        setField('2_adresse_declarant_etranger_pays', demandeur.pays)
        setField('2_adresse_declarant_etranger_division_territoriale', demandeur.division_territoriale)
        setFragmented('2_adresse_telephone', demandeur.telephone, 10)
        setFragmented('2_adresse_indicatif_etranger', demandeur.indicatif_etranger, 4)
        setEmailField('2_adresse_email', demandeur.email)
        checkBox('2_adresse-si_reponse_email_checkbox', c.adresse.accept_email || true)

        // ── 2BIS ADDITIONAL DECLARANT ──────────────────────────────
        // The user requested to fill new/omitted sections with placeholders for now to minimize pressure
        const placeholder = 'À COMPLÉTER'
        setField('2BIS_particulier_nom', '')
        setField('2BIS_particulier_prenom', '')
        setField('2BIS_morale_raison_sociale', '')
        setField('2BIS_morale_denomination', '')
        setField('2BIS_morale_type_societe', '')
        setField('2BIS_morale_represantant_nom', '')
        setField('2BIS_morale_represantant_prenom', '')
        setField('2BIS_morale_adresse_voie', '')
        setField('2BIS_morale_adresse_numero', '')
        setField('2BIS_morale_adresse_lieu_dit', '')
        setField('2BIS_morale_adresse_localite', '')
        setFragmented('2BIS_morale_adresse_code_postal', '', 5)
        setField('2BIS_morale_si_etranger_pays', '')
        setField('2BIS_morale_si_etranger_division_territoriale', '')
        setFragmented('2BIS_morale_num_siret', '', 14)
        setFragmented('2BIS_morale_telephone', '', 10)
        setFragmented('2BIS_morale_telephone_indicatif', '', 4)
        setEmailField('2BIS_morale_email', '')

        // ── 3 TERRAIN (LAND) ──────────────────────────────
        const landAddr = extractAddress(terrain.adresse);
        setField('3_terrain_addresse_numero', landAddr.numero)
        setField('3_terrain_addresse_voie', landAddr.voie)
        setField('3_terrain_addresse_lieu-dit', terrain.lieu_dit)
        setField('3_terrain_addresse_localité', terrain.commune)
        setFragmented('3_terrain_addresse_code_postal', terrain.code_postal, 5)
        checkBox('3_terrain_si_lotissement_checkbox', !!data.terrain_lotissement)

        // Maps the single cadastre from Etape 2 into the multi-slot array on the PDF
        setFragmented('3_terrain_cadastrales_prefixe', terrain.prefixe_cadastral, 3)
        setFragmented('3_terrain_cadastrales_section', terrain.section_cadastrale, 2)
        setFragmented('3_terrain_cadastrales_numero', terrain.numero_parcelle, 4)
        setField('3_terrain_cadastrales_parcelle_superficie_m2', terrain.surface_terrain)

        // ── 4 PROJECT TYPE ──────────────────────────────
        // The app strictly creates renovation dossiers (Menuiseries, Isolation, PV)
        checkBox('4_1_nouvelle_construction_checkbox', false)
        checkBox('4_1_nouvelle_construction_checkbox_piscine', false)
        checkBox('4_1_nouvelle_construction_checkbox_garage', false)
        checkBox('4_1_nouvelle_construction_checkbox_veranda', false)
        checkBox('4_1_nouvelle_construction_checkbox_abri_jardin', false)
        setField('4_1_nouvelle_construction_autre', '')

        checkBox('4_1_construction_existante_checkbox', true)
        checkBox('4_1_construction_existante_checkbox_extension', false)
        checkBox('4_1_construction_existante_checkbox_surelevation', false)
        checkBox('4_1_construction_existante_checkbox_creation_niveaux', false)
        setField('4_1_construction_existante_autre', data.travaux.type)

        checkBox('4_1_cloture_checkbox', false)
        setField('4_1_description_projet', data.travaux.description_projet || '')

        // Fallback or deduce from UI if needed, right now we default to Principale
        checkBox('4_1_residence_principale_checkbox', true)
        checkBox('4_1_residence_secondaire_checkbox', false)

        // ── 4.2 SURFACES ──────────────────────────────
        setField('4_2_surface_plancher_existante', data.travaux.surfaces?.existante || '')
        setField('4_2_surface_plancher_creee', data.travaux.surfaces?.creee || '')
        setField('4_2_surface_plancher_supprimee', data.travaux.surfaces?.supprimee || '')

        // ── 5 SPECIAL DECLARATIONS ──────────────────────────────
        checkBox('5_checkbox_1', false)
        checkBox('5_checkbox_2', false)
        checkBox('5_checkbox_3', false)
        setField('5_checkbox_3_precisez', '')
        checkBox('5_checkbox_4', false)
        checkBox('5_checkbox_5', false)
        checkBox('5_checkbox_6', false)
        checkBox('5_checkbox_7', false)

        // ── 8 DECLARATION ──────────────────────────────
        if (data.engagement) {
            setField('8_engagement_lieu', data.engagement.lieu)
            setDateField('8_engagement_date', data.engagement.date)
            checkBox('signature_309udhn', data.engagement.signature)
        }

        // ── ATTACHMENTS (DP DOCUMENTS) ──────────────────────────────
        // Dynamically deduce checked boxes based on what the user actually uploaded in Etaoes 4 and 5
        const p = data.plans
        const ph = data.photos
        checkBox('dp1_checkbox', !!p.dp1_carte_situation)
        checkBox('dp2_checkbox', !!p.dp2_plan_masse)
        checkBox('dp3_checkbox', false)
        checkBox('dp4_checkbox', !!p.dp4_notice)
        // DP5 = Plans des façades (Existant = facade_avant, Projet = facade_apres_ai)
        checkBox('dp5_checkbox', !!(ph.facade_avant || ph.facade_arriere || ph.facade_droite || ph.facade_gauche || ph.facade_apres_ai))
        checkBox('dp6_checkbox', !!(ph.facade_apres_ai || ph.facade_croquis_ai))
        checkBox('dp7_checkbox', !!ph.dp7_vue_proche)
        checkBox('dp8_checkbox', !!ph.dp8_vue_lointaine)
        checkBox('dp8_1_checkbox', false)
        checkBox('dp11_checkbox', !!ph.facade_apres_ai) // Using 'après' AI for DP11 simulation

        // Log key fields for debugging
        console.log('[CERFA] Fields set. demandeur.date_naissance:', demandeur.date_naissance)
        console.log('[CERFA] demandeur.lieu_naissance:', demandeur.lieu_naissance)

        // Make fields read-only to avoid pdf-lib 'Unexpected N type' errors on custom checkboxes
        const fields = form.getFields()
        fields.forEach(field => {
            try {
                field.enableReadOnly()
            } catch (e) {
                // Ignore if a specific field cannot be made read-only
            }
        })

        // ── 8. Annexe Fiscalité (DENI) Custom Page ───────────────────────
        // Since the base PDF lacks fillable fields for the DENI section, we append a clean summary page
        if (data.taxation) {
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
            const deniPage = pdfDoc.addPage(PageSizes.A4)
            const { width, height } = deniPage.getSize()

            let yOffset = height - 50

            deniPage.drawText('ANNEXE - DÉCLARATION DES ÉLÉMENTS NÉCESSAIRES AU CALCUL DE L\'IMPOSITION (DENI)', {
                x: 50, y: yOffset, size: 12, font: helveticaBold, color: rgb(0, 0, 0)
            })
            yOffset -= 30

            deniPage.drawText('1. Informations Générales:', { x: 50, y: yOffset, size: 10, font: helveticaBold })
            yOffset -= 20
            deniPage.drawText(`- Nombre de logements créés: ${data.taxation.logements_crees || 0}`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Places de stationnement couvertes: ${data.taxation.stationnement_couvert || 0}`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Places de stationnement non couvertes: ${data.taxation.stationnement_non_couvert || 0}`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Surface de bassin de piscine: ${data.taxation.surface_bassin_piscine || 0} m²`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 30

            deniPage.drawText('2. Destination des Surfaces (Habitation):', { x: 50, y: yOffset, size: 10, font: helveticaBold })
            yOffset -= 20
            deniPage.drawText(`- Surface taxable existante conservée: ${data.taxation.destination_habitation_existante || 0} m²`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Surface taxable créée: ${data.taxation.destination_habitation_creee || 0} m²`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Surface taxable supprimée: ${data.taxation.destination_habitation_supprimee || 0} m²`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 30

            deniPage.drawText('3. Financement / Prêts Aidés:', { x: 50, y: yOffset, size: 10, font: helveticaBold })
            yOffset -= 20
            deniPage.drawText(`- Projet financé par un Prêt à Taux Zéro (PTZ): ${data.taxation.financement_ptz ? 'OUI' : 'NON'}`, { x: 70, y: yOffset, size: 10, font: helvetica })
            yOffset -= 15
            deniPage.drawText(`- Projet financé par d'autres prêts aidés: ${data.taxation.financement_pret_social ? 'OUI' : 'NON'}`, { x: 70, y: yOffset, size: 10, font: helvetica })
        }

        return await pdfDoc.save()

    } catch (err) {
        console.error('[CERFA] Error generating PDF:', err)
        return generateFallbackCerfa(data)
    }
}

/**
 * Fallback: generates a clean structured summary PDF
 * Uses only 7-bit ASCII (via the san() helper) to avoid StandardFonts encoding issues.
 */
async function generateFallbackCerfa(data: DPFormData): Promise<Uint8Array> {
    const { demandeur, terrain, travaux } = data
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const pages = [pdfDoc.addPage(PageSizes.A4)]
    let pageIdx = 0
    const PW = PageSizes.A4[0]
    const PH = PageSizes.A4[1]
    const M = 50
    const cW = PW - M * 2

    let y = PH - M

    const newPage = () => {
        pages.push(pdfDoc.addPage(PageSizes.A4))
        pageIdx++
        y = PH - M
    }

    const safeTx = (text: string, x: number, yy: number, size: number, f = font, color = rgb(0.1, 0.1, 0.1)) => {
        pages[pageIdx].drawText(s(text), { x, y: yy, size, font: f, color })
    }

    const line = (text: string, x = M, size = 9, f = font, col = rgb(0.15, 0.15, 0.15)) => {
        if (y < 60) newPage()
        safeTx(text, x, y, size, f, col)
        y -= size + 5
    }

    const heading = (text: string) => {
        if (y < 80) newPage()
        y -= 6
        pages[pageIdx].drawRectangle({ x: M, y: y - 16, width: cW, height: 18, color: rgb(0.1, 0.1, 0.1) })
        safeTx(s(text).toUpperCase(), M + 8, y - 11, 9, bold, rgb(1, 1, 1))
        y -= 24
    }

    const kv = (label: string, value: string) => {
        if (y < 60) newPage()
        safeTx(s(label) + ' :', M + 4, y, 8, bold, rgb(0.3, 0.3, 0.3))
        safeTx(s(value || '—'), M + 130, y, 8, font, rgb(0.1, 0.1, 0.1))
        y -= 13
    }

    const divider = () => {
        pages[pageIdx].drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) })
        y -= 8
    }

    // ── Header ───────────────────────────────────────────────────────────
    pages[pageIdx].drawRectangle({ x: 0, y: PH - 70, width: PW, height: 70, color: rgb(0.08, 0.08, 0.08) })
    safeTx('DEMANDE PREALABLE DE TRAVAUX', M, PH - 28, 16, bold, rgb(1, 1, 1))
    safeTx('Cerfa n13703*  |  Resume du dossier constitue', M, PH - 46, 9, font, rgb(0.75, 0.75, 0.75))
    safeTx('REPUBLIQUE FRANCAISE', PW - M - 110, PH - 28, 8, font, rgb(0.6, 0.6, 0.6))
    y = PH - 90

    // ── Summary identity box ─────────────────────────────────────────────
    pages[pageIdx].drawRectangle({ x: M, y: y - 60, width: cW, height: 62, color: rgb(0.95, 0.95, 0.95) })
    const nomFull = s(`${demandeur.civilite} ${demandeur.nom} ${demandeur.prenom}`.trim())
    const addr = terrain.meme_adresse
        ? s(`${demandeur.adresse}, ${demandeur.code_postal} ${demandeur.commune}`)
        : s(`${terrain.adresse}, ${terrain.code_postal} ${terrain.commune}`)
    safeTx('Demandeur : ' + nomFull, M + 10, y - 16, 9, bold)
    safeTx('Adresse des travaux : ' + addr, M + 10, y - 30, 8.5, font)
    safeTx('Date : ' + new Date().toLocaleDateString('fr-FR'), M + 10, y - 44, 8, font)
    y -= 78

    // ── Identite ─────────────────────────────────────────────────────────
    heading('1. Identite du demandeur')
    kv('Civilite', demandeur.civilite)
    kv('Nom', demandeur.nom)
    kv('Prenom', demandeur.prenom)
    kv('Date de naissance', demandeur.date_naissance)
    kv('Lieu de naissance', demandeur.lieu_naissance)
    kv('Telephone', demandeur.telephone)
    kv('Email', demandeur.email)
    kv('Adresse', s(`${demandeur.adresse}, ${demandeur.code_postal} ${demandeur.commune}`))
    if (demandeur.est_societe) {
        divider()
        kv('Societe', demandeur.nom_societe)
        kv('SIRET', demandeur.siret)
        kv('Representant', s(`${demandeur.representant_nom} ${demandeur.representant_prenom}`))
    }

    // ── Terrain ──────────────────────────────────────────────────────────
    heading('2. Identification du terrain')
    kv('Adresse', addr)
    kv('Section cadastrale', terrain.section_cadastrale)
    kv('Numero de parcelle', terrain.numero_parcelle)
    kv('Surface du terrain', terrain.surface_terrain ? terrain.surface_terrain + ' m2' : '')
    kv('Surface plancher', terrain.surface_plancher ? terrain.surface_plancher + ' m2' : '')

    // ── Nature des travaux ────────────────────────────────────────────────
    heading('3. Nature des travaux')
    if (travaux.type === 'menuiseries' && travaux.menuiseries) {
        const m = travaux.menuiseries
        kv('Type', 'Changement de menuiseries exterieures')
        kv('Materiau', m.materiau)
        kv('Couleur', s(`${m.couleur}${m.couleur_ral ? ` (${m.couleur_ral})` : ''}`))
        kv('Nombre', m.nombre)
        kv('Dimensions', m.largeur && m.hauteur ? `${m.largeur} cm x ${m.hauteur} cm` : '')
        kv('Mode', m.remplacement ? 'Remplacement a l\'identique' : 'Creation de nouvelles ouvertures')
    } else if (travaux.type === 'isolation' && travaux.isolation) {
        const iso = travaux.isolation
        kv('Type', 'Isolation thermique par l\'exterieur (ITE)')
        kv('Finition', iso.type_finition)
        kv('Couleur', iso.couleur)
        kv('Isolant', `${iso.materiau_isolant} - ${iso.epaisseur_isolant} cm`)
        kv('Facades', (iso.facades_concernees || []).join(', '))
    } else if (travaux.type === 'photovoltaique' && travaux.photovoltaique) {
        const pv = travaux.photovoltaique
        kv('Type', 'Panneaux photovoltaiques en toiture')
        kv('Nombre', pv.nombre_panneaux)
        kv('Puissance', pv.puissance_kw + ' kWc')
        kv('Surface', pv.surface_totale + ' m2')
        kv('Orientation', pv.orientation)
        kv('Inclinaison', pv.inclinaison + ' deg')
        kv('Integration', pv.integration)
    }

    if (terrain.description_projet) {
        divider()
        line(s(`Description : ${terrain.description_projet}`), M + 4, 8)
    }

    // ── Pieces jointes ───────────────────────────────────────────────────
    heading('4. Pieces constituant le dossier')
    const pieces = [
        'DP1 - Plan de situation du terrain',
        'DP2 - Plan de masse des constructions',
        'DP4 - Notice descriptive du projet de travaux',
        'DP5 - Plans des facades (avant et apres travaux)',
        'DP7 - Photographie de la construction (vue rapprochee)',
        'DP8 - Photographie de la construction (vue eloignee)',
    ]
    pieces.forEach(p => line('   [x]  ' + p, M + 4, 8.5))

    // ── Signature ────────────────────────────────────────────────────────
    y -= 20
    divider()
    const sigY = Math.max(y - 50, 70)
    pages[pageIdx].drawRectangle({ x: M, y: sigY - 10, width: cW / 2 - 8, height: 50, color: rgb(0.95, 0.95, 0.95) })
    safeTx('Signature du demandeur :', M + 8, sigY + 26, 8, bold)
    safeTx(s(`A ${demandeur.commune || '...'}, le ${new Date().toLocaleDateString('fr-FR')}`), M + 8, sigY + 12, 8, font)

    return await pdfDoc.save()
}
