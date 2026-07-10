import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { DPFormData } from './models'
import { isProtectedSector } from './validation'
import path from 'path'

// ─── French transliteration (no accented chars in PDF StandardFonts) ─────────
function s(text: string): string {
    const map: Record<string, string> = {
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'ô': 'o', 'ö': 'o',
        'û': 'u', 'ù': 'u', 'ü': 'u',
        'î': 'i', 'ï': 'i',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'à': 'a', 'â': 'a', 'ä': 'a',
        'ô': 'o', 'ö': 'o',
        'û': 'u', 'ù': 'u', 'ü': 'u',
        'î': 'i', 'ï': 'i',
        'ç': 'c', 'æ': 'ae', 'œ': 'oe',
        'É': 'E', 'È': 'E', 'Ê': 'E',
        'À': 'A', 'Â': 'A',
        'Ô': 'O', 'Û': 'U', 'Î': 'I',
        'Ç': 'C', 'Æ': 'AE', 'Œ': 'OE',
        '–': '-', '—': '-', '’': "'", '‘': "'",
        '°': 'deg', '²': 'm2', '×': 'x', '€': 'EUR',
        '«': '"', '»': '"', '…': '...', '•': '-',
    }
    return (text || '').replace(/[^\x00-\x7F]/g, c => map[c] ?? '')
}

/**
 * Generates the Cerfa 16702*03 PDF ("Déclaration préalable — Constructions et travaux non soumis
 * à permis de construire") by loading the base PDF and filling all fields.
 * Reads cerfa.pdf directly from the filesystem (server) or via fetch (browser).
 *
 * Field-name reference (16702*03 AcroForm), mapped from the app's DPFormData:
 *   1. Déclarant particulier  D1N/D1P/D1A/D1C/D1D/D1E   · morale D2D/D2R/D2S/D2J/D2N/D2P
 *   2. Coordonnées            D3N/D3V/D3W/D3L/D3C/D3B/D3X/D3T/D3K/D3P/D3D · email D5GE1/D5GE2 · D5A
 *   3. Terrain                T2Q/T2V/T2W/T2L/T2C · cadastre T2F/T2S/T2N/T2T (+P2/P3) · total D5T
 *   4. Nature                 C2ZA1 (nouvelle) / C2ZB1 (existante) / C2ZC3 (clôture) · desc C2ZD1
 *      Type                   C5ZE1..C5ZE6 / C5ZK1..K3 · destination C2ZF1/C2ZF2
 *      Surface de plancher    Habitation-Logement row = W2L{A..F}1 · totals row W2S{A..F}1
 *   5. Législation connexe    X1{T,E,D,C,A,L,U,V} = Oui / X1*0 = Non · heritage X2R/X2H/X2C
 *   7. Engagement             E1L/E1D
 *   Bordereau pièces jointes  DPC1=P5PA2 DPC2=P5PB1 DPC3=P3GE1 DPC4=P3GD1 DPC5=P5PC1
 *                             DPC6=P3GF1 DPC7=P3GG1 DPC8=P3GH1 DPC11=P4CD1
 */
export async function generateCerfaPdf(data: DPFormData): Promise<Uint8Array> {
    const { demandeur, terrain } = data

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
                form.getTextField(name.trim()).setText(s(value))
            } catch {
                console.debug(`[CERFA] Field not found or not text: "${name}"`)
            }
        }

        // Helper: safely check/uncheck a checkbox (pdf-lib resolves the field's on-value, /Oui here)
        const checkBox = (name: string, val: boolean) => {
            try {
                const field = form.getCheckBox(name.trim())
                if (val) field.check()
                else field.uncheck()
            } catch {
                console.debug(`[CERFA] Checkbox not found: "${name}"`)
            }
        }

        // 16702 date fields are 8-char comb fields (maxLen 8): the slashes are pre-printed, so we
        // write DDMMYYYY digits only. Accepts "JJ/MM/AAAA" or ISO "AAAA-MM-JJ".
        const formatDate = (dateStr: string): string => {
            if (!dateStr) return ''
            let j = '', m = '', a = ''
            if (dateStr.includes('-')) {
                const [Y, M, D] = dateStr.split('-')
                a = Y || ''; m = M || ''; j = D || ''
            } else {
                const [D, M, Y] = dateStr.split('/')
                j = D || ''; m = M || ''; a = Y || ''
            }
            if (!j || !m || !a) return ''
            return j.padStart(2, '0') + m.padStart(2, '0') + a.padStart(4, '0')
        }

        // Split "jean.martin@example.com" across the form's two email cells (before/after @).
        const setEmail = (f1: string, f2: string, emailStr: string) => {
            if (!emailStr) return
            const [local, ...rest] = emailStr.split('@')
            setField(f1, local || '')
            if (rest.length) setField(f2, rest.join('@'))
        }

        // "12 rue des Lilas" → { numero: "12", voie: "rue des Lilas" }
        const extractAddress = (fullAddress: string) => {
            const match = (fullAddress || '').match(/^(\d+(?:\s*(?:bis|ter|quater|[a-zA-Z]\b))?)\s+(.*)$/i)
            return match ? { numero: match[1].trim(), voie: match[2].trim() } : { numero: '', voie: fullAddress || '' }
        }

        // ── 1. DÉCLARANT (personne physique ou morale) ─────────────────────────
        if (!demandeur.est_societe) {
            setField('D1N_nom', demandeur.nom)
            setField('D1P_prenom', demandeur.prenom)
            setField('D1A_naissance', formatDate(demandeur.date_naissance))
            setField('D1C_commune', demandeur.lieu_naissance)
            setField('D1D_dept', demandeur.departement_naissance)
            setField('D1E_pays', demandeur.pays_naissance)
        } else {
            setField('D2D_denomination', demandeur.nom_societe)
            setField('D2R_raison', demandeur.nom_societe)
            setField('D2S_siret', (demandeur.siret || '').replace(/\s+/g, ''))
            setField('D2J_type', demandeur.type_societe)
            setField('D2N_nom', demandeur.representant_nom)
            setField('D2P_prenom', demandeur.representant_prenom)
        }

        // ── 2. COORDONNÉES DU DÉCLARANT ────────────────────────────────────────
        const declarantAddr = extractAddress(demandeur.adresse)
        setField('D3N_numero', declarantAddr.numero)
        setField('D3V_voie', declarantAddr.voie)
        setField('D3W_lieudit', demandeur.lieu_dit)
        setField('D3L_localite', demandeur.commune)
        setField('D3C_code', (demandeur.code_postal || '').replace(/\s+/g, ''))
        setField('D3B_boite', demandeur.boite_postale)
        setField('D3X_cedex', demandeur.cedex)
        setField('D3T_telephone', (demandeur.telephone || '').replace(/\s+/g, ''))
        setField('D3K_indicatif', demandeur.indicatif_etranger)
        setField('D3P_pays', demandeur.pays)
        setField('D3D_division', demandeur.division_territoriale)
        setEmail('D5GE1_email', 'D5GE2_email', demandeur.email)
        checkBox('D5A_acceptation', !!data.accord_dematerialisation)

        // ── 3. TERRAIN ─────────────────────────────────────────────────────────
        const landAddr = extractAddress(terrain.adresse)
        setField('T2Q_numero', landAddr.numero)
        setField('T2V_voie', landAddr.voie)
        setField('T2W_lieudit', terrain.lieu_dit)
        setField('T2L_localite', terrain.commune)
        setField('T2C_code', (terrain.code_postal || '').replace(/\s+/g, ''))

        // Cadastre — main parcel + up to two supplementary parcels (Étape 2).
        setField('T2F_prefixe', terrain.prefixe_cadastral)
        setField('T2S_section', terrain.section_cadastrale)
        setField('T2N_numero', terrain.numero_parcelle)
        setField('T2T_superficie', (terrain.surface_terrain || '').toString().replace(/[^0-9]/g, ''))
        const extra = data.cadastrales_multiparcelles || []
        if (extra[0]) { setField('T2FP2_prefixe', extra[0].prefixe); setField('T2SP2_section', extra[0].section); setField('T2NP2_numero', extra[0].numero) }
        if (extra[1]) { setField('T2FP3_prefixe', extra[1].prefixe); setField('T2SP3_section', extra[1].section); setField('T2NP3_numero', extra[1].numero) }
        setField('D5T_total', (terrain.surface_terrain || '').toString().replace(/[^0-9]/g, ''))

        // 3.2 Situation juridique — lotissement from the declared value; the other (optional)
        // statuses (CU / ZAC / AFU / PUP) are left blank for the user to complete if applicable.
        checkBox('T3I_lotoui', !!data.terrain_lotissement)
        checkBox('T3L_lotnon', !data.terrain_lotissement)

        // ── 4.1 NATURE DES TRAVAUX ─────────────────────────────────────────────
        const isCloture = (data.travaux.type as string) === 'cloture'
        const isNouvelle = data.nature_travaux === 'nouvelle_construction'
        checkBox('C2ZA1_nouvelle', isNouvelle && !isCloture)
        checkBox('C2ZB1_existante', !isNouvelle && !isCloture)
        checkBox('C2ZC3_cloture', isCloture)
        setField('C2ZD1_description', data.terrain.description_projet || data.travaux.description_projet || '')

        // ── 4.2 TYPE DE TRAVAUX (sous-nature) ──────────────────────────────────
        const sn = data.sous_nature_nouvelle
        const se = data.sous_nature_existante
        checkBox('C5ZE1_piscine', !!sn?.piscine)
        checkBox('C5ZE2_garage', !!sn?.garage)
        checkBox('C5ZE3_veranda', !!sn?.veranda)
        checkBox('C5ZE4_abri', !!sn?.abri_jardin)
        checkBox('C5ZE5_annexes', !!sn?.autre)
        checkBox('C5ZK1_extension', !!se?.extension)
        checkBox('C5ZK2_surelevation', !!se?.surelevation)
        checkBox('C5ZK3_supplementaires', !!se?.creation_niveaux)

        // Destination (occupation personnelle → résidence principale/secondaire)
        const secondaire = data.projet_concerne === 'secondaire'
        checkBox('C2ZF1_principale', !secondaire)
        checkBox('C2ZF2_secondaire', secondaire)

        // ── 4.4 SURFACE DE PLANCHER (m²) — Habitation / Logement row (L) ────────
        // Only written when the works actually change floor area (aspect works → all 0/blank).
        const sExist = Number(data.travaux?.surfaces?.existante) || 0
        const sCreee = Number(data.travaux?.surfaces?.creee) || 0
        const sSupp = Number(data.travaux?.surfaces?.supprimee) || 0
        if (sExist || sCreee || sSupp) {
            const total = sExist + sCreee - sSupp
            setField('W2LA1', String(sExist))
            setField('W2LB1', String(sCreee))
            setField('W2LD1', String(sSupp))
            setField('W2LF1', String(total))
            // Totals row (S)
            setField('W2SA1', String(sExist))
            setField('W2SB1', String(sCreee))
            setField('W2SD1', String(sSupp))
            setField('W2SF1', String(total))
        }
        // NB: 4.2.1 (puissance crête C2ZP1 / agrivoltaïque) is for GROUND-mounted or ombrières PV.
        // The app's photovoltaïque is roof-mounted on an existing house → declared as "travaux sur
        // construction existante" above; these solar-farm fields must stay blank.

        // ── 5. INFORMATIONS POUR L'APPLICATION D'UNE LÉGISLATION CONNEXE ────────
        // For a house-renovation DP none of these connex regimes apply → tick "Non" (the *0 boxes).
        for (const n of ['X1T0_eau', 'X1E0_environnement', 'X1D0_derogation', 'X1C0_classe', 'X1A0_ABF', 'X1L0_legislation', 'X1U0_raccordement', 'X1V0_toiture']) {
            checkBox(n, true)
        }

        // Périmètres de protection — driven by the PLU heritage detection (user-editable below).
        const hasSPR = !!data.terrain?.plu?.overlays?.hasSPR
        const hasAbordsMH = (data.terrain?.plu?.overlays?.monumentsWithin500m?.length || 0) > 0
        checkBox('X2R_remarquable', hasSPR)
        checkBox('X2H_historique', hasAbordsMH)
        checkBox('X2C_classe', false)

        // ── 7. ENGAGEMENT DU DÉCLARANT ─────────────────────────────────────────
        if (data.engagement) {
            setField('E1L_lieu', data.engagement.lieu)
            setField('E1D_date', formatDate(data.engagement.date))
            // E1S_signature is signed by hand on the printed form — left blank.
        }

        // ── BORDEREAU DES PIÈCES JOINTES (DPC1…DPC11) ──────────────────────────
        // P-codes mapped from the bordereau reading order (see header). Ticked from what the DP
        // document actually produces. DPC1 (plan de situation) is the only mandatory piece.
        const p = data.plans
        const ph = data.photos
        const hasFacades = ph.facades.some(f => f.before) || (ph.facades.length > 0 && !!ph.facade_avant)
        const hasAfter = ph.facades.some(f => f.after)
        const hasCroquis = ph.facades.some(f => f.croquis)
        const dp3Required = isNouvelle
            || !!(se && (se.extension || se.surelevation || se.creation_niveaux))
            || !!(sn && (sn.veranda || sn.garage || sn.abri_jardin || sn.autre))
        checkBox('P5PA2', !!p.dp1_carte_situation)            // DPC1 — plan de situation (obligatoire)
        checkBox('P5PB1', !!p.dp2_plan_masse)                 // DPC2 — plan de masse
        checkBox('P3GE1', dp3Required)                        // DPC3 — plan en coupe
        checkBox('P3GD1', hasFacades)                         // DPC4 — plan des façades et toitures
        checkBox('P5PC1', hasCroquis || hasAfter)             // DPC5 — représentation de l'aspect extérieur
        checkBox('P3GF1', hasAfter)                           // DPC6 — insertion paysagère
        checkBox('P3GG1', !!ph.dp7_vue_proche)                // DPC7 — photo vue proche
        checkBox('P3GH1', !!ph.dp8_vue_lointaine)             // DPC8 — photo vue lointaine
        checkBox('P4CD1', isProtectedSector(data))            // DPC11 — notice matériaux (secteur protégé)

        // Make fields read-only to prevent casual edits after generation. EXCEPTION: leave the
        // heritage declarations (§5 périmètres de protection) editable so the user can correct an
        // edge case the APIs can't detect (e.g. a site classé) in their PDF reader before filing.
        const editable = new Set(['X2R_remarquable', 'X2H_historique', 'X2C_classe', 'X1P_precisions'])
        for (const field of form.getFields()) {
            if (editable.has(field.getName())) continue
            try { field.enableReadOnly() } catch { /* ignore */ }
        }

        // ── ANNEXE FISCALITÉ (DENI) — appended summary page (base form has no fields for it) ────
        if (data.taxation) {
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
            const deniPage = pdfDoc.addPage(PageSizes.A4)
            const { height } = deniPage.getSize()
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
            const taxExist = (Number(data.taxation.destination_habitation_existante) || 0)
                || (Number(data.travaux?.surfaces?.existante) || 0)
            deniPage.drawText(`- Surface taxable existante conservée: ${taxExist} m²`, { x: 70, y: yOffset, size: 10, font: helvetica })
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

        // NB: we intentionally do NOT flatten — some official CERFA appearance streams make pdf-lib's
        // flatten throw; the fields are made read-only above, which prevents casual edits reliably.
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
    safeTx('Cerfa n16702*03  |  Resume du dossier constitue', M, PH - 46, 9, font, rgb(0.75, 0.75, 0.75))
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
        'DPC1 - Plan de situation du terrain',
        'DPC2 - Plan de masse des constructions',
        'DPC4 - Plan des facades et toitures',
        'DPC5 - Representation de l\'aspect exterieur (avant et apres)',
        'DPC7 - Photographie de la construction (vue rapprochee)',
        'DPC8 - Photographie de la construction (vue eloignee)',
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
