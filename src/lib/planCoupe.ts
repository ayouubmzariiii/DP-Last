// ─────────────────────────────────────────────────────────────────────────────
// Plan de coupe (DP3) — framework-agnostic SVG generator.
//
// Draws the section an instructeur expects when works modify the terrain profile
// or built volume (piscine, extension, abri, terrassement) :
//   • profil du TERRAIN NATUREL (TN) from real IGN RGE ALTI elevations,
//   • profil du TERRAIN FINI (TF) where the project modifies it (excavation…),
//   • the project in section (bassin / bâtiment + toiture) with vertical cotes,
//   • altitudes NGF, limites séparatives + distances, échelle graphique,
//   • the A–A′ cut reference matching the plan de masse (DP2).
//
// SAME SCALE on both axes (no vertical exaggeration) — a section filed with the
// mairie must be homogeneous, otherwise every cote reads wrong on paper.
//
// Pure: takes an elevation profile + a parametric project spec and returns a
// complete <svg> string. No React, no DOM, no network — usable from the wizard,
// the PDF generator and test scripts identically (same contract as planMasse.ts).
// ─────────────────────────────────────────────────────────────────────────────

export interface CoupeProfilePoint {
    d: number   // distance along the cut line, metres from point A
    z: number   // altitude NGF, metres (IGN RGE ALTI)
}

export interface PlanCoupeExisting {
    startD: number          // left edge of the existing building along the line (m)
    widthM: number
    heightEgoutM: number    // hauteur à l'égout du toit (m above TN)
    heightFaitageM: number  // hauteur au faîtage (m above TN)
    /** Les hauteurs ci-dessus ont-elles été DÉCLARÉES ? BD TOPO ne fournit que l'emprise :
     *  quand elles sont estimées, la silhouette est tracée en pointillé et annoncée comme
     *  telle, au lieu d'affirmer un faîtage que rien ne soutient sur une pièce où se lisent
     *  précisément les hauteurs et les prospects. */
    declared?: boolean
}

export interface PlanCoupeProject {
    kind: 'piscine' | 'extension' | 'abri' | 'terrassement'
    startD: number          // left edge of the works along the line (m from A)
    widthM: number
    label?: string          // e.g. "Bassin 8 × 4 m"
    // ── piscine ──
    depthM?: number         // profondeur du bassin sous le TN (m)
    margelleM?: number      // hauteur de la margelle au-dessus du TN (m, default 0.05)
    // ── extension / abri ──
    heightEgoutM?: number   // hauteur à l'égout (m above TN)
    heightFaitageM?: number // hauteur au faîtage (m above TN)
    roof?: 'mono' | 'double' | 'flat'
    existing?: PlanCoupeExisting   // adjoining existing building (extension case)
    // ── terrassement ──
    deltaZM?: number        // final platform level relative to mean TN (+remblai / −déblai)
}

export interface PlanCoupeInput {
    profile: CoupeProfilePoint[]   // TN samples A → A′ (ordered by d)
    project: PlanCoupeProject
    parcelStartD?: number          // boundary côté A (m from A)
    parcelEndD?: number            // boundary côté A′
    parcelStartKind?: 'sep' | 'voie'   // séparative (default) or voie publique / alignement
    parcelEndKind?: 'sep' | 'voie'
    cutLabel?: string              // default "Coupe A – A′"
    worksLabel?: string            // callout, e.g. "Piscine enterrée 8 × 4 m"
    annotations?: string[]         // "Dimensions du projet" box lines
    // Title block (cartouche) — printed top-right.
    cartouche?: { piece?: string; project?: string; ref?: string; date?: string; scale?: string }
    // Embedded "plan de composition de la coupe" — a schematic top-view locating the A–A' cut.
    // worksFrac = where the works sits along A→A' (0..1); worksCross = across the parcel (0..1).
    miniPlan?: { worksFrac?: number; worksCross?: number; label?: string }
    width?: number                 // viewBox, default 640
    height?: number                // default 360
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

/** Linear interpolation of the TN altitude at distance d. */
function zAt(profile: CoupeProfilePoint[], d: number): number {
    if (!profile.length) return 0
    if (d <= profile[0].d) return profile[0].z
    for (let i = 1; i < profile.length; i++) {
        if (d <= profile[i].d) {
            const a = profile[i - 1], b = profile[i]
            const t = b.d === a.d ? 0 : (d - a.d) / (b.d - a.d)
            return a.z + t * (b.z - a.z)
        }
    }
    return profile[profile.length - 1].z
}

/** Light 3-point smoothing — RGE ALTI at 1 m resolution carries ±dm noise that
 *  would make the TN line jitter without changing any filed cote. */
export function smoothProfile(profile: CoupeProfilePoint[]): CoupeProfilePoint[] {
    if (profile.length < 3) return profile
    return profile.map((p, i) => {
        if (i === 0 || i === profile.length - 1) return p
        return { d: p.d, z: (profile[i - 1].z + p.z + profile[i + 1].z) / 3 }
    })
}

/** Round a raw metre length to a "nice" scale-bar length (1/2/5×10^k). */
function niceLength(rawM: number): number {
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rawM, 0.1))))
    for (const m of [5, 2, 1]) if (m * pow <= rawM) return m * pow
    return pow
}

export function buildPlanCoupeSvg(input: PlanCoupeInput): string {
    const VW = input.width ?? 640, VH = input.height ?? 360
    const profile = input.profile
    if (profile.length < 2) return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="40" font-size="12">Profil altimétrique indisponible</text></svg>`
    const prj = input.project

    // ── Project levels (all in metres NGF) ───────────────────────────────────
    const pLeft = prj.startD, pRight = prj.startD + prj.widthM
    const tnLeft = zAt(profile, pLeft), tnRight = zAt(profile, pRight)
    const tnMean = (tnLeft + tnRight) / 2
    const isPool = prj.kind === 'piscine'
    const isBld = prj.kind === 'extension' || prj.kind === 'abri'
    const depth = prj.depthM ?? 1.5
    const margelle = prj.margelleM ?? 0.05
    const zBottom = isPool ? tnMean - depth : (prj.kind === 'terrassement' ? tnMean + (prj.deltaZM ?? 0) : tnMean)
    const zTopBld = isBld ? tnMean + (prj.heightFaitageM ?? prj.heightEgoutM ?? 3) : tnMean
    const zTopExisting = prj.existing ? zAt(profile, prj.existing.startD + prj.existing.widthM / 2) + prj.existing.heightFaitageM : -Infinity

    // ── Vertical range: everything drawn + breathing room ────────────────────
    const zProfileMin = Math.min(...profile.map(p => p.z))
    const zProfileMax = Math.max(...profile.map(p => p.z))
    const zMin = Math.min(zProfileMin, zBottom) - 0.8
    const zMax = Math.max(zProfileMax, zTopBld, zTopExisting, tnMean + margelle) + 1.2

    // ── Same-scale projection (no vertical exaggeration) ─────────────────────
    // padB reserves a bottom band for the furniture (légende · plan de composition · dimensions).
    const padL = 54, padR = 14, padT = 64, padB = 112
    const dMin = profile[0].d, dMax = profile[profile.length - 1].d
    const spanD = dMax - dMin, spanZ = zMax - zMin
    const s = Math.min((VW - padL - padR) / spanD, (VH - padT - padB) / spanZ)
    const offX = padL + ((VW - padL - padR) - spanD * s) / 2
    const baseY = padT + ((VH - padT - padB) - spanZ * s) / 2 + spanZ * s
    const X = (d: number) => offX + (d - dMin) * s
    const Y = (z: number) => baseY - (z - zMin) * s

    const parts: string[] = []
    parts.push(`<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" style="width:100%;height:100%;display:block;background:#fbfaf7">`)
    parts.push(`<rect x="0" y="0" width="${VW}" height="${VH}" fill="#fbfaf7"/>`)

    // ── TN polyline + earth hatching under it ─────────────────────────────────
    const tnPts = profile.map(p => `${X(p.d).toFixed(1)},${Y(p.z).toFixed(1)}`).join(' ')
    const groundFloorY = Y(zMin) + 4
    const groundPath = `M${X(dMin).toFixed(1)} ${groundFloorY.toFixed(1)} L${tnPts.split(' ').map(pt => pt.replace(',', ' ')).join(' L')} L${X(dMax).toFixed(1)} ${groundFloorY.toFixed(1)} Z`
    parts.push(`<defs><clipPath id="pcGround"><path d="${groundPath}"/></clipPath></defs>`)
    parts.push(`<path d="${groundPath}" fill="#efe9df"/>`)
    parts.push('<g clip-path="url(#pcGround)" stroke="#c9bfae" stroke-width="0.7">')
    for (let hx = -VH; hx < VW + VH; hx += 9) parts.push(`<line x1="${hx}" y1="${VH}" x2="${hx + VH}" y2="0"/>`)
    parts.push('</g>')

    // ── Existing building (context + prospect reference) — drawn under the project ──
    // Shown for ANY project kind (a pool's DP3 is judged partly on its distance to the house).
    if (prj.existing) {
        const ex = prj.existing
        const ex0 = X(ex.startD), ex1 = X(ex.startD + ex.widthM)
        const eTN = Y(zAt(profile, ex.startD + ex.widthM / 2))
        const eyE = eTN - ex.heightEgoutM * s, eyF = eTN - ex.heightFaitageM * s
        // Hauteurs non déclarées → contour en pointillé : la silhouette situe le bâtiment sans
        // prétendre en donner le niveau. Un trait plein sur une coupe se lit comme une cote.
        const dash = ex.declared ? '' : ' stroke-dasharray="4,3"'
        parts.push(`<rect x="${ex0}" y="${eyE}" width="${ex1 - ex0}" height="${eTN - eyE}" fill="#dedad2" stroke="#6f6a61" stroke-width="1"${dash}/>`)
        parts.push(`<path d="M${ex0} ${eyE} L${(ex0 + ex1) / 2} ${eyF} L${ex1} ${eyE} Z" fill="#cfc9bf" stroke="#6f6a61" stroke-width="1"${dash}/>`)
        parts.push(`<text x="${(ex0 + ex1) / 2}" y="${(eyE + eTN) / 2}" text-anchor="middle" font-size="7.5" fill="#6f6a61">EXISTANT</text>`)
        if (!ex.declared) parts.push(`<text x="${(ex0 + ex1) / 2}" y="${(eyE + eTN) / 2 + 9}" text-anchor="middle" font-size="6" fill="#8a8378">hauteurs non renseignées</text>`)
    }

    // ── The project in section ────────────────────────────────────────────────
    const x0 = X(pLeft), x1 = X(pRight)
    if (isPool) {
        const yTN = Y(tnMean), yBot = Y(zBottom), yWater = Y(zBottom + Math.max(depth - 0.15, 0.3))
        // Excavation: blank out the earth inside the bassin, then structure walls.
        parts.push(`<rect x="${x0}" y="${yTN}" width="${x1 - x0}" height="${yBot - yTN}" fill="#fbfaf7"/>`)
        parts.push(`<rect x="${x0}" y="${yWater}" width="${x1 - x0}" height="${yBot - yWater}" fill="#cfe3ef"/>`)
        parts.push(`<line x1="${x0}" y1="${yWater}" x2="${x1}" y2="${yWater}" stroke="#5d8aa8" stroke-width="1"/>`)
        parts.push(`<path d="M${x0} ${yTN} L${x0} ${yBot} L${x1} ${yBot} L${x1} ${yTN}" fill="none" stroke="#B0552F" stroke-width="1.8"/>`)
        // Margelle slabs each side.
        const mH = Math.max(margelle * s, 2.5), mW = Math.max(0.35 * s, 4)
        parts.push(`<rect x="${x0 - mW}" y="${yTN - mH}" width="${mW + 3}" height="${mH}" fill="#e7cbb6" stroke="#B0552F" stroke-width="1"/>`)
        parts.push(`<rect x="${x1 - 3}" y="${yTN - mH}" width="${mW + 3}" height="${mH}" fill="#e7cbb6" stroke="#B0552F" stroke-width="1"/>`)
        // Cote: profondeur (inside the bassin, right wall).
        const cx = x1 - 12
        parts.push(`<line x1="${cx}" y1="${yTN}" x2="${cx}" y2="${yBot}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<line x1="${cx - 4}" y1="${yTN}" x2="${cx + 4}" y2="${yTN}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<line x1="${cx - 4}" y1="${yBot}" x2="${cx + 4}" y2="${yBot}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<rect x="${cx - 37}" y="${(yTN + yBot) / 2 - 6}" width="34" height="12" fill="#fff" rx="2" stroke="#ccc" stroke-width="0.5"/>`)
        parts.push(`<text x="${cx - 20}" y="${(yTN + yBot) / 2 + 2.5}" text-anchor="middle" font-size="8" font-weight="700" fill="#000">${f2(depth)} m</text>`)
        // Niveau fond du bassin (NGF).
        parts.push(`<text x="${(x0 + x1) / 2}" y="${yBot + 10}" text-anchor="middle" font-size="6.5" fill="#6f6a61">Fond du bassin : ${f2(zBottom)} m NGF</text>`)
    } else if (isBld) {
        const hE = prj.heightEgoutM ?? 2.5, hF = Math.max(prj.heightFaitageM ?? hE, hE)
        const yTN = Y(tnMean), yE = Y(tnMean + hE), yF = Y(tnMean + hF)
        // Project volume — walls + roof (mono-pente leans onto the existing side).
        parts.push(`<rect x="${x0}" y="${yE}" width="${x1 - x0}" height="${yTN - yE}" fill="#f3ddcc" stroke="#B0552F" stroke-width="1.8"/>`)
        if ((prj.roof ?? 'double') === 'flat' || hF - hE < 0.05) {
            parts.push(`<line x1="${x0}" y1="${yE}" x2="${x1}" y2="${yE}" stroke="#B0552F" stroke-width="1.8"/>`)
        } else if ((prj.roof ?? 'double') === 'mono') {
            const highOnLeft = !!prj.existing && prj.existing.startD < prj.startD
            parts.push(`<path d="M${x0} ${highOnLeft ? yF : yE} L${x1} ${highOnLeft ? yE : yF} L${x1} ${yE} L${x0} ${yE} Z" fill="#e7cbb6" stroke="#B0552F" stroke-width="1.8"/>`)
        } else {
            parts.push(`<path d="M${x0} ${yE} L${(x0 + x1) / 2} ${yF} L${x1} ${yE} Z" fill="#e7cbb6" stroke="#B0552F" stroke-width="1.8"/>`)
        }
        // Cotes: hauteur égout + faîtage on the outer side.
        const outer = prj.existing && prj.existing.startD < prj.startD ? x1 + 12 : x0 - 12
        const anchor = prj.existing && prj.existing.startD < prj.startD ? 'start' : 'end'
        for (const [zz, lbl] of [[tnMean + hE, `égout ${f2(hE)} m`], [tnMean + hF, `faîtage ${f2(hF)} m`]] as [number, string][]) {
            if (lbl.startsWith('faîtage') && hF - hE < 0.05) continue
            const yy = Y(zz)
            parts.push(`<line x1="${outer}" y1="${yTN}" x2="${outer}" y2="${yy}" stroke="#111" stroke-width="0.9"/>`)
            parts.push(`<line x1="${outer - 4}" y1="${yy}" x2="${outer + 4}" y2="${yy}" stroke="#111" stroke-width="0.9"/>`)
            const tw = lbl.length * 4.3 + 6, txx = outer + (anchor === 'start' ? 7 : -7)
            parts.push(`<rect x="${anchor === 'start' ? txx - 2 : txx - tw + 2}" y="${yy - 6}" width="${tw}" height="11" fill="#fff" rx="2" opacity="0.9"/>`)
            parts.push(`<text x="${txx}" y="${yy + 3}" text-anchor="${anchor}" font-size="7.5" font-weight="700" fill="#000">${esc(lbl)}</text>`)
        }
        parts.push(`<line x1="${outer - 4}" y1="${yTN}" x2="${outer + 4}" y2="${yTN}" stroke="#111" stroke-width="0.9"/>`)
    } else {
        // Terrassement: platform line at zBottom across the works.
        const yP = Y(zBottom)
        parts.push(`<rect x="${x0}" y="${Math.min(yP, Y(tnMean))}" width="${x1 - x0}" height="${Math.abs(Y(tnMean) - yP) || 2}" fill="#fbfaf7" opacity="0.85"/>`)
        parts.push(`<line x1="${x0}" y1="${yP}" x2="${x1}" y2="${yP}" stroke="#B0552F" stroke-width="1.8"/>`)
        parts.push(`<text x="${(x0 + x1) / 2}" y="${yP - 5}" text-anchor="middle" font-size="7" fill="#B0552F">Plateforme ${f2(zBottom)} m NGF</text>`)
    }

    // ── TERRAIN FINI line (dashed) where the profile is modified ──────────────
    if (isPool || prj.kind === 'terrassement') {
        const yTF = Y(zBottom)
        parts.push(`<path d="M${X(dMin)} ${Y(profile[0].z)} L${x0} ${Y(tnMean)} L${x0} ${yTF} L${x1} ${yTF} L${x1} ${Y(tnMean)} L${X(dMax)} ${Y(profile[profile.length - 1].z)}" fill="none" stroke="#B0552F" stroke-width="1" stroke-dasharray="5,3"/>`)
    }

    // ── TN line ON TOP (the reference line of the whole piece) ───────────────
    parts.push(`<polyline points="${tnPts}" fill="none" stroke="#2b2620" stroke-width="1.6"/>`)

    // ── Prospect: horizontal distance between the works and the existing building ──
    if (prj.existing) {
        const exR = prj.existing.startD + prj.existing.widthM
        let gapM = -1, gx0 = 0, gx1 = 0
        if (prj.startD >= exR) { gapM = prj.startD - exR; gx0 = X(exR); gx1 = X(pLeft) }
        else if (pRight <= prj.existing.startD) { gapM = prj.existing.startD - pRight; gx0 = X(pRight); gx1 = X(prj.existing.startD) }
        if (gapM > 0.3) {
            const yP = Y(tnMean) - 9
            parts.push(`<line x1="${gx0}" y1="${yP}" x2="${gx1}" y2="${yP}" stroke="#7A5C1E" stroke-width="0.9"/>`)
            parts.push(`<line x1="${gx0}" y1="${yP - 3}" x2="${gx0}" y2="${yP + 3}" stroke="#7A5C1E" stroke-width="0.9"/>`)
            parts.push(`<line x1="${gx1}" y1="${yP - 3}" x2="${gx1}" y2="${yP + 3}" stroke="#7A5C1E" stroke-width="0.9"/>`)
            parts.push(`<rect x="${(gx0 + gx1) / 2 - 30}" y="${yP - 11}" width="60" height="11" fill="#fff" rx="2" stroke="#E5D5AC" stroke-width="0.6"/>`)
            parts.push(`<text x="${(gx0 + gx1) / 2}" y="${yP - 2.5}" text-anchor="middle" font-size="7" font-weight="700" fill="#7A5C1E">${f1(gapM)} m / maison</text>`)
        }
    }

    // ── Boundaries (limite séparative / voie publique) + distances to the works ──
    // When a works callout occupies the top-left (y 30–60), start the lines below it.
    const yLimTop = input.worksLabel ? 68 : padT - 8
    const limites: [number | undefined, string][] = [
        [input.parcelStartD, input.parcelStartKind === 'voie' ? 'Voie publique' : 'Limite séparative'],
        [input.parcelEndD, input.parcelEndKind === 'voie' ? 'Voie publique' : 'Limite séparative'],
    ]
    for (const [dd, name] of limites) {
        if (dd === undefined) continue
        const lx = X(dd)
        parts.push(`<line x1="${lx}" y1="${yLimTop}" x2="${lx}" y2="${Y(zAt(profile, dd)) + 14}" stroke="#2D5A4C" stroke-width="1" stroke-dasharray="7,3,2,3"/>`)
        parts.push(`<text x="${lx}" y="${yLimTop - 3}" text-anchor="middle" font-size="6.5" fill="#2D5A4C">${name}</text>`)
        parts.push(`<text x="${lx}" y="${Y(zAt(profile, dd)) + 24}" text-anchor="middle" font-size="6.5" fill="#6f6a61">TN ${f2(zAt(profile, dd))} m NGF</text>`)
        // Horizontal cote from the limite to the nearest project edge.
        const edge = Math.abs(dd - pLeft) < Math.abs(dd - pRight) ? pLeft : pRight
        const distM = Math.abs(edge - dd)
        if (distM > 0.4) {
            const ex = X(edge), yC = yLimTop + 12
            parts.push(`<line x1="${lx}" y1="${yC}" x2="${ex}" y2="${yC}" stroke="#2D5A4C" stroke-width="0.9"/>`)
            parts.push(`<line x1="${lx}" y1="${yC - 3}" x2="${lx}" y2="${yC + 3}" stroke="#2D5A4C" stroke-width="0.9"/>`)
            parts.push(`<line x1="${ex}" y1="${yC - 3}" x2="${ex}" y2="${yC + 3}" stroke="#2D5A4C" stroke-width="0.9"/>`)
            parts.push(`<rect x="${(lx + ex) / 2 - 15}" y="${yC - 5.5}" width="30" height="11" fill="#fff" rx="2" stroke="#cfe0d8" stroke-width="0.6"/>`)
            parts.push(`<text x="${(lx + ex) / 2}" y="${yC + 2.5}" text-anchor="middle" font-size="7" font-weight="700" fill="#2D5A4C">${f1(distM)} m</text>`)
        }
    }

    // ── Width cote of the works (below ground floor) ──────────────────────────
    {
        const yC = groundFloorY + 12
        parts.push(`<line x1="${x0}" y1="${yC}" x2="${x1}" y2="${yC}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<line x1="${x0}" y1="${yC - 4}" x2="${x0}" y2="${yC + 4}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<line x1="${x1}" y1="${yC - 4}" x2="${x1}" y2="${yC + 4}" stroke="#111" stroke-width="1"/>`)
        parts.push(`<rect x="${(x0 + x1) / 2 - 17}" y="${yC - 6}" width="34" height="12" fill="#fff" rx="2" stroke="#ccc" stroke-width="0.5"/>`)
        parts.push(`<text x="${(x0 + x1) / 2}" y="${yC + 2.5}" text-anchor="middle" font-size="8" font-weight="700" fill="#000">${f2(prj.widthM)} m</text>`)
        // TN levels at both project edges.
        parts.push(`<text x="${x0}" y="${yC + 15}" text-anchor="middle" font-size="6.5" fill="#6f6a61">TN ${f2(tnLeft)}</text>`)
        parts.push(`<text x="${x1}" y="${yC + 15}" text-anchor="middle" font-size="6.5" fill="#6f6a61">TN ${f2(tnRight)}</text>`)
    }

    // ── A / A′ endpoints (ties the section to the DP2 cut line) ──────────────
    for (const [dd, lbl] of [[dMin, 'A'], [dMax, 'A′']] as [number, string][]) {
        const lx = X(dd), ly = Y(zAt(profile, dd))
        parts.push(`<circle cx="${lx}" cy="${ly}" r="7" fill="#fff" stroke="#2b2620" stroke-width="1.2"/>`)
        parts.push(`<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#2b2620">${lbl}</text>`)
    }

    // ── Short centred title + works callout (top-left) ───────────────────────
    parts.push(`<text x="${VW / 2}" y="18" text-anchor="middle" font-size="10" font-weight="700" fill="#2b2620" letter-spacing="0.5">${esc(input.cutLabel ?? 'Coupe A – A′')}</text>`)
    if (input.worksLabel) {
        const boxW = Math.min(224, 70 + input.worksLabel.length * 5.2)
        parts.push(`<g><rect x="10" y="28" width="${boxW}" height="30" rx="4" fill="#fff" stroke="#B0552F" stroke-width="1.2"/><rect x="10" y="28" width="6" height="30" fill="#B0552F"/><text x="23" y="40" font-size="7" font-weight="700" fill="#B0552F" letter-spacing="0.4">LOCALISATION DES TRAVAUX</text><text x="23" y="51" font-size="8.5" font-weight="600" fill="#2b2620">${esc(input.worksLabel)}</text></g>`)
    }

    // ── Cartouche (title block) top-right ─────────────────────────────────────
    {
        const c = input.cartouche ?? {}
        const cl: [string, boolean][] = ([
            [c.piece ?? 'DP3 · Plan de coupe', true],
            [c.project ?? '', false],
            [`${c.ref ? 'Réf. ' + c.ref + '   ' : ''}${c.date ?? ''}`.trim(), false],
            [`Échelle ${c.scale ?? '1/100'} · X = Y (sans exagération)`, false],
        ] as [string, boolean][]).filter(l => l[0])
        const cw = 196, cx = VW - cw - 6, cy = 8, ch = cl.length * 11 + 7
        parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#fff" stroke="#2b2620" stroke-width="0.9" rx="3"/>`)
        cl.forEach((l, i) => parts.push(`<text x="${cx + 8}" y="${cy + 13 + i * 11}" font-size="${l[1] ? 8.5 : 7}" font-weight="${l[1] ? 700 : 400}" fill="#2b2620">${esc(l[0])}</text>`))
    }

    // ══════════════════ Bottom furniture band ═══════════════════════════════
    const BY = VH - 76

    // ── Légende (6 entries) ──
    {
        const lgX = 6, lgW = 160, lgH = 66
        parts.push(`<rect x="${lgX}" y="${BY}" width="${lgW}" height="${lgH}" fill="#fff" stroke="#bbb" stroke-width="0.7" rx="2"/>`)
        parts.push(`<text x="${lgX + 7}" y="${BY + 11}" font-size="7" font-weight="700" fill="#6f6a61" letter-spacing="0.3">LÉGENDE</text>`)
        const rows: { t: 'line' | 'fill'; c?: string; w?: number; d?: string; f?: string; s?: string; l: string }[] = [
            { t: 'line', c: '#2b2620', w: 1.6, l: 'Terrain naturel (TN)' },
            { t: 'line', c: '#B0552F', w: 1, d: '5,3', l: 'Terrain fini (TF) / projet' },
            { t: 'line', c: '#2D5A4C', w: 1, d: '7,3,2,3', l: 'Limite / voie publique' },
            { t: 'fill', f: '#e7cbb6', s: '#B0552F', l: 'Projet (bassin / bâti)' },
            { t: 'fill', f: '#dedad2', s: '#6f6a61', l: 'Bâti existant' },
            { t: 'fill', f: '#cfe3ef', s: '#5d8aa8', l: 'Plan d’eau' },
        ]
        rows.forEach((r, i) => {
            const y = BY + 20 + i * 8
            if (r.t === 'line') parts.push(`<line x1="${lgX + 7}" y1="${y - 2}" x2="${lgX + 26}" y2="${y - 2}" stroke="${r.c}" stroke-width="${r.w}"${r.d ? ` stroke-dasharray="${r.d}"` : ''}/>`)
            else parts.push(`<rect x="${lgX + 7}" y="${y - 6}" width="10" height="7" fill="${r.f}" stroke="${r.s}" stroke-width="0.9"/>`)
            parts.push(`<text x="${lgX + 31}" y="${y + 1}" font-size="6.8" fill="#333">${esc(r.l)}</text>`)
        })
    }

    // ── Plan de composition de la coupe (schematic top-view locating A–A') ──
    {
        const mpW = 150, mpH = 48, mpX = 317 - mpW / 2, mpY = BY
        parts.push(`<rect x="${mpX}" y="${mpY}" width="${mpW}" height="${mpH}" fill="#fff" stroke="#bbb" stroke-width="0.7" rx="2"/>`)
        const px = mpX + 12, py = mpY + 8, pw = mpW - 24, ph = mpH - 16
        parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#f2efe9" stroke="#2D5A4C" stroke-width="1"/>`)
        const wf = Math.min(0.85, Math.max(0.15, input.miniPlan?.worksFrac ?? (((pLeft + pRight) / 2 - dMin) / (dMax - dMin))))
        const wc = Math.min(0.78, Math.max(0.22, input.miniPlan?.worksCross ?? 0.55))
        const wW = Math.min(pw * 0.5, Math.max(10, (prj.widthM / (dMax - dMin)) * pw)), wH = 11
        parts.push(`<rect x="${px + wf * pw - wW / 2}" y="${py + wc * ph - wH / 2}" width="${wW}" height="${wH}" fill="#e7cbb6" stroke="#B0552F" stroke-width="1"/>`)
        const ay = py + wc * ph
        parts.push(`<line x1="${px - 7}" y1="${ay}" x2="${px + pw + 7}" y2="${ay}" stroke="#2b2620" stroke-width="1" stroke-dasharray="4,2"/>`)
        parts.push(`<path d="M${px - 7} ${ay} l6 -2.5 v5 z" fill="#2b2620"/><path d="M${px + pw + 7} ${ay} l-6 -2.5 v5 z" fill="#2b2620"/>`)
        parts.push(`<text x="${px - 10}" y="${ay + 2.5}" text-anchor="end" font-size="7" font-weight="700" fill="#2b2620">A</text>`)
        parts.push(`<text x="${px + pw + 10}" y="${ay + 2.5}" text-anchor="start" font-size="7" font-weight="700" fill="#2b2620">A′</text>`)
        parts.push(`<text x="${mpX + mpW / 2}" y="${mpY + mpH + 8}" text-anchor="middle" font-size="6.5" fill="#6f6a61">Plan de composition de la coupe</text>`)
    }

    // ── Dimensions du projet (right) ──
    const anns = input.annotations ?? []
    if (anns.length) {
        const lh = 12, bw = 158, bx = VW - bw - 6, by = BY, bh = Math.min(anns.length * lh + 20, 66)
        parts.push(`<g><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#E8F0EC" stroke="#2D5A4C" stroke-width="0.9" rx="3"/><rect x="${bx}" y="${by}" width="${bw}" height="14" fill="#2D5A4C" rx="3"/><rect x="${bx}" y="${by + 9}" width="${bw}" height="5" fill="#2D5A4C"/><text x="${bx + bw / 2}" y="${by + 10}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fff">DIMENSIONS DU PROJET</text>${anns.map((a, i) => `<text x="${bx + 7}" y="${by + 26 + i * lh}" font-size="7.2" fill="#244A3E">• ${esc(a)}</text>`).join('')}</g>`)
    }

    // ── Échelle graphique (centred, under the mini-plan) ──
    {
        const barM = niceLength(60 / s)
        const bx = 317 - (barM * s) / 2, by = VH - 6
        parts.push(`<line x1="${bx}" y1="${by}" x2="${bx + barM * s}" y2="${by}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<line x1="${bx}" y1="${by - 3}" x2="${bx}" y2="${by + 3}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<line x1="${bx + barM * s}" y1="${by - 3}" x2="${bx + barM * s}" y2="${by + 3}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<text x="${bx + barM * s + 5}" y="${by + 2.5}" text-anchor="start" font-size="6.5" fill="#2b2620">${barM} m</text>`)
    }
    parts.push(`<text x="${VW - 4}" y="${VH - 2}" text-anchor="end" font-size="5.5" fill="#888">Altimétrie : IGN RGE ALTI® (NGF-IGN69) — indicative</text>`)

    parts.push('</svg>')
    return parts.join('')
}
