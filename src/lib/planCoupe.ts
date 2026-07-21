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
    parcelStartD?: number          // limite séparative côté A (m from A)
    parcelEndD?: number            // limite séparative côté A′
    cutLabel?: string              // default "Coupe A – A′"
    worksLabel?: string            // callout, e.g. "Piscine enterrée 8 × 4 m"
    annotations?: string[]         // "Dimensions du projet" box lines
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
    const padL = 54, padR = 14, padT = 64, padB = 92
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
        // Existing building (extension case) — drawn first, neutral grey.
        if (prj.existing) {
            const ex = prj.existing
            const ex0 = X(ex.startD), ex1 = X(ex.startD + ex.widthM)
            const eTN = Y(zAt(profile, ex.startD + ex.widthM / 2))
            const eyE = eTN - ex.heightEgoutM * s, eyF = eTN - ex.heightFaitageM * s
            parts.push(`<rect x="${ex0}" y="${eyE}" width="${ex1 - ex0}" height="${eTN - eyE}" fill="#dedad2" stroke="#6f6a61" stroke-width="1"/>`)
            parts.push(`<path d="M${ex0} ${eyE} L${(ex0 + ex1) / 2} ${eyF} L${ex1} ${eyE} Z" fill="#cfc9bf" stroke="#6f6a61" stroke-width="1"/>`)
            parts.push(`<text x="${(ex0 + ex1) / 2}" y="${(eyE + eTN) / 2}" text-anchor="middle" font-size="7.5" fill="#6f6a61">EXISTANT</text>`)
        }
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

    // ── Limites séparatives + distances to the works ──────────────────────────
    // When a works callout occupies the top-left (y 30–60), start the limite
    // lines below it so their labels are never hidden under the white box.
    const yLimTop = input.worksLabel ? 68 : padT - 8
    for (const [dd, name] of [[input.parcelStartD, 'Limite séparative'], [input.parcelEndD, 'Limite séparative']] as [number | undefined, string][]) {
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

    // ── Title + works callout ─────────────────────────────────────────────────
    parts.push(`<text x="${VW / 2}" y="20" text-anchor="middle" font-size="11" font-weight="700" fill="#2b2620" letter-spacing="0.5">${esc(input.cutLabel ?? 'Coupe A – A′')} — profil du terrain et de la construction</text>`)
    if (input.worksLabel) {
        const boxW = Math.min(230, 70 + input.worksLabel.length * 5.2)
        parts.push(`<g><rect x="10" y="30" width="${boxW}" height="30" rx="4" fill="#fff" stroke="#B0552F" stroke-width="1.2"/><rect x="10" y="30" width="6" height="30" fill="#B0552F"/><text x="23" y="42" font-size="7" font-weight="700" fill="#B0552F" letter-spacing="0.4">LOCALISATION DES TRAVAUX</text><text x="23" y="53" font-size="8.5" font-weight="600" fill="#2b2620">${esc(input.worksLabel)}</text></g>`)
    }

    // ── Legend TN / TF ────────────────────────────────────────────────────────
    const lgX = 10, lgY = VH - 58
    parts.push(`<rect x="${lgX}" y="${lgY}" width="176" height="50" fill="#fff" stroke="#bbb" stroke-width="0.7" rx="2"/>`)
    parts.push(`<line x1="${lgX + 7}" y1="${lgY + 12}" x2="${lgX + 30}" y2="${lgY + 12}" stroke="#2b2620" stroke-width="1.6"/><text x="${lgX + 36}" y="${lgY + 15}" font-size="7" fill="#333">Terrain naturel (TN)</text>`)
    parts.push(`<line x1="${lgX + 7}" y1="${lgY + 26}" x2="${lgX + 30}" y2="${lgY + 26}" stroke="#B0552F" stroke-width="1" stroke-dasharray="5,3"/><text x="${lgX + 36}" y="${lgY + 29}" font-size="7" fill="#333">Terrain fini (TF) / projet</text>`)
    parts.push(`<line x1="${lgX + 7}" y1="${lgY + 40}" x2="${lgX + 30}" y2="${lgY + 40}" stroke="#2D5A4C" stroke-width="1" stroke-dasharray="7,3,2,3"/><text x="${lgX + 36}" y="${lgY + 43}" font-size="7" fill="#333">Limite séparative</text>`)

    // ── Annotations box ("Dimensions du projet") ─────────────────────────────
    const anns = input.annotations ?? []
    if (anns.length) {
        const lh = 13, bw = 158, bh = anns.length * lh + 22, bx = VW - bw - 8, by = VH - bh - 8
        parts.push(`<g><rect x="${bx - 1}" y="${by - 1}" width="${bw + 2}" height="${bh + 2}" fill="rgba(0,0,0,0.12)" rx="4"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#E8F0EC" stroke="#2D5A4C" stroke-width="0.9" rx="3"/><rect x="${bx}" y="${by}" width="${bw}" height="15" fill="#2D5A4C" rx="3"/><rect x="${bx}" y="${by + 10}" width="${bw}" height="5" fill="#2D5A4C"/><text x="${bx + bw / 2}" y="${by + 10.5}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fff">DIMENSIONS DU PROJET</text>${anns.map((a, i) => `<text x="${bx + 8}" y="${by + 28 + i * lh}" font-size="7.5" fill="#244A3E">• ${esc(a)}</text>`).join('')}</g>`)
    }

    // ── Échelle graphique (same scale both axes — say it) ────────────────────
    {
        const barM = niceLength(60 / s)   // aim ≈ 60 px
        const bx = VW / 2 - (barM * s) / 2, by = VH - 16
        parts.push(`<line x1="${bx}" y1="${by}" x2="${bx + barM * s}" y2="${by}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<line x1="${bx}" y1="${by - 4}" x2="${bx}" y2="${by + 4}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<line x1="${bx + barM * s}" y1="${by - 4}" x2="${bx + barM * s}" y2="${by + 4}" stroke="#2b2620" stroke-width="1.4"/>`)
        parts.push(`<text x="${bx + (barM * s) / 2}" y="${by - 7}" text-anchor="middle" font-size="7" fill="#2b2620">${barM} m</text>`)
        parts.push(`<text x="${bx + (barM * s) / 2}" y="${by + 12}" text-anchor="middle" font-size="6" fill="#888">Échelle identique en X et Y (sans exagération verticale)</text>`)
    }
    parts.push(`<text x="${VW - 4}" y="${VH - 3}" text-anchor="end" font-size="5.5" fill="#888">Altimétrie : IGN RGE ALTI® (NGF-IGN69)</text>`)

    parts.push('</svg>')
    return parts.join('')
}
