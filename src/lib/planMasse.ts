// ─────────────────────────────────────────────────────────────────────────────
// Plan de masse (DP2) — framework-agnostic SVG generator.
//
// Consolidates the projection + drawing logic that used to live inline in Étape 6's
// Dp2VectorCard, and adds a "localisation des travaux" marker (which building/parcel
// edge the works concern) — the thing an instructeur looks for on an aspect-works DP.
//
// Pure: takes cadastre + bâti GeoJSON (EPSG:3857, from IGN Géoplateforme WFS) and
// returns a complete <svg> string. No React, no DOM, no network — so it runs in the
// browser (component), on the server (PDF), and in tests/scripts identically.
// ─────────────────────────────────────────────────────────────────────────────

type Ring = number[][]
interface Feature { geometry?: { type?: string; coordinates?: any }; properties?: Record<string, any> }
interface FeatureCollection { features?: Feature[] }

export interface PlanMasseInput {
    cadastre: FeatureCollection | null
    bati: FeatureCollection | null
    center: [number, number]        // EPSG:3857 [cx, cy] — the geocoded terrain
    wantSection?: string            // applicant's cadastral section (highlight this parcel)
    wantNumero?: string             // applicant's parcel number
    worksLabel?: string             // e.g. "Ravalement de façade" — drawn as the works marker label
    annotations?: string[]          // extra lines for the "Dimensions du projet" box
    width?: number
    height?: number
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const ringsOf = (f: Feature): Ring[] => {
    const t = f.geometry?.type
    if (t === 'Polygon') return f.geometry!.coordinates as Ring[]
    if (t === 'MultiPolygon') return (f.geometry!.coordinates as Ring[][]).flat(1)
    return []
}
const bboxOfRing = (r: Ring) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of r) { if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]; if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1] }
    return { minX, minY, maxX, maxY }
}
const ringArea = (r: Ring) => {
    let a = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * r[i][1]) - (r[i][0] * r[j][1])
    return Math.abs(a / 2)
}
const pointInRing = (x: number, y: number, r: Ring) => {
    let inside = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside
    }
    return inside
}

/** Distance d'un point au segment [a,b], et point du segment le plus proche. */
export function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    // t = projection du point sur le segment, bornée à [0,1] pour rester sur le segment.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const cx = ax + t * dx, cy = ay + t * dy
    return { dist: Math.hypot(px - cx, py - cy), cx, cy }
}

/**
 * Recul de la construction aux limites séparatives : pour chaque côté de la
 * parcelle, le point du bâtiment qui en est le plus proche et la distance
 * correspondante.
 *
 * C'est LA vérification que fait un instructeur sur un plan de masse — le
 * règlement impose un recul minimal aux limites — et R. 431-36 b) demande un
 * plan « coté dans les 3 dimensions ». Coter les côtés de la parcelle, comme le
 * faisait ce fichier, décrit le terrain mais pas l'implantation du projet.
 */
export function reculsToBoundaries(building: number[][], parcel: number[][]) {
    const out: { dist: number; bx: number; by: number; cx: number; cy: number; edge: number }[] = []
    for (let e = 0; e < parcel.length - 1; e++) {
        const [ax, ay] = parcel[e], [bx2, by2] = parcel[e + 1]
        if (Math.hypot(bx2 - ax, by2 - ay) < 1) continue          // côté négligeable
        let best: typeof out[number] | null = null
        for (const [px, py] of building) {
            const { dist, cx, cy } = pointToSegment(px, py, ax, ay, bx2, by2)
            if (!best || dist < best.dist) best = { dist, bx: px, by: py, cx, cy, edge: e }
        }
        if (best) out.push(best)
    }
    return out.sort((a, b) => a.dist - b.dist)
}

/** Build the full plan de masse as an SVG string. */
export function buildPlanMasseSvg(input: PlanMasseInput): string {
    const VW = input.width ?? 640, VH = input.height ?? 360
    const [cx, cy] = input.center
    const fC = input.cadastre?.features ?? []
    const fB = input.bati?.features ?? []

    // EPSG:3857 → true-ground metre correction (Mercator over-states by 1/cos(lat)).
    const R = 6378137
    const gf = Math.cos(2 * Math.atan(Math.exp(cy / R)) - Math.PI / 2)

    // ── Pick the subject parcel: the applicant's exact section+numéro, else nearest to centre ──
    const normSec = (s: any) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '')
    const normNum = (n: any) => String(parseInt(String(n || '').replace(/[^0-9]/g, ''), 10) || '')
    const wantSec = normSec(input.wantSection), wantNum = normNum(input.wantNumero)
    let targetIdx = -1
    if (wantSec && wantNum) {
        targetIdx = fC.findIndex(f => normSec(f.properties?.section) === wantSec && normNum(f.properties?.numero) === wantNum)
    }
    // Fallback 1: the parcel that actually CONTAINS the geocoded point (the address's parcel).
    if (targetIdx < 0) {
        outer: for (let i = 0; i < fC.length; i++) {
            for (const ring of ringsOf(fC[i])) {
                if (ring && ring.length > 2 && pointInRing(cx, cy, ring)) { targetIdx = i; break outer }
            }
        }
    }
    // Fallback 2: nearest parcel by centroid (point fell on a road / boundary).
    if (targetIdx < 0) {
        let min = Infinity
        fC.forEach((f, i) => {
            const ring = ringsOf(f)[0]; if (!ring) return
            let fx = 0, fy = 0; for (const c of ring) { fx += c[0]; fy += c[1] }
            fx /= ring.length; fy /= ring.length
            const d = (fx - cx) ** 2 + (fy - cy) ** 2
            if (d < min) { min = d; targetIdx = i }
        })
    }

    // ── View window: fit the subject parcel (padded), else a 120 m box around the centre ──
    let vMinX = cx - 60, vMaxX = cx + 60, vMinY = cy - 60, vMaxY = cy + 60
    let targetBbox: { minX: number; minY: number; maxX: number; maxY: number } | null = null
    if (targetIdx >= 0) {
        const ring = ringsOf(fC[targetIdx])[0]
        if (ring) {
            targetBbox = bboxOfRing(ring)
            const pad = 20
            vMinX = targetBbox.minX - pad; vMaxX = targetBbox.maxX + pad
            vMinY = targetBbox.minY - pad; vMaxY = targetBbox.maxY + pad
        }
    }
    const srcW = vMaxX - vMinX, srcH = vMaxY - vMinY
    const scale = Math.min(VW / srcW, VH / srcH) * 0.96
    const offX = (VW - srcW * scale) / 2, offY = (VH - srcH * scale) / 2
    const toSvg = (gx: number, gy: number) => ({ x: (gx - vMinX) * scale + offX, y: VH - ((gy - vMinY) * scale + offY) })
    const toPath = (rings: Ring[]) => {
        let d = ''
        for (const ring of rings) {
            if (!ring || ring.length < 3) continue
            ring.forEach((c, i) => { const p = toSvg(c[0], c[1]); d += (i === 0 ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`) })
            d += 'Z'
        }
        return d
    }

    // Skip features whose bbox doesn't intersect the view window (a margin lets edges cross in).
    const m = Math.max(srcW, srcH) * 0.15
    const inView = (f: Feature) => {
        const ring = ringsOf(f)[0]; if (!ring) return false
        const b = bboxOfRing(ring)
        return !(b.maxX < vMinX - m || b.minX > vMaxX + m || b.maxY < vMinY - m || b.minY > vMaxY + m)
    }

    const parts: string[] = []
    parts.push(`<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" style="width:100%;height:100%;display:block;background:#fbfaf7">`)
    parts.push(`<rect x="0" y="0" width="${VW}" height="${VH}" fill="#fbfaf7"/>`)

    // ── Parcels ──
    fC.forEach((f, i) => {
        if (i !== targetIdx && !inView(f)) return
        const d = toPath(ringsOf(f)); if (!d) return
        const isT = i === targetIdx
        parts.push(`<path d="${d}" fill="${isT ? '#d7e8c4' : '#f2efe9'}" stroke="${isT ? '#2D5A4C' : '#b9b3a8'}" stroke-width="${isT ? 2 : 0.8}"/>`)
    })

    // ── Buildings — grey; the largest one inside the subject parcel is the "works" building ──
    let subjIdx = -1, subjArea = 0
    fB.forEach((f, i) => {
        const ring = ringsOf(f)[0]; if (!ring) return
        if (!targetBbox) return
        const b = bboxOfRing(ring); const bcx = (b.minX + b.maxX) / 2, bcy = (b.minY + b.maxY) / 2
        if (bcx < targetBbox.minX || bcx > targetBbox.maxX || bcy < targetBbox.minY || bcy > targetBbox.maxY) return
        const a = ringArea(ring)
        if (a > subjArea) { subjArea = a; subjIdx = i }
    })
    fB.forEach((f, i) => {
        if (i !== subjIdx && !inView(f)) return
        const d = toPath(ringsOf(f)); if (!d) return
        const isSubj = i === subjIdx
        parts.push(`<path d="${d}" fill="${isSubj ? '#e7cbb6' : '#c9c4ba'}" stroke="${isSubj ? '#B0552F' : '#6f6a61'}" stroke-width="${isSubj ? 1.8 : 0.7}"/>`)
    })

    // ── Building cotes (width/height) for buildings inside the subject parcel ──
    if (targetBbox) {
        fB.forEach((f, bi) => {
            const ring = ringsOf(f)[0]; if (!ring) return
            const b = bboxOfRing(ring); const bcx = (b.minX + b.maxX) / 2, bcy = (b.minY + b.maxY) / 2
            if (bcx < targetBbox!.minX || bcx > targetBbox!.maxX || bcy < targetBbox!.minY || bcy > targetBbox!.maxY) return
            const wM = b.maxX - b.minX, hM = b.maxY - b.minY
            if (wM < 2 || hM < 2) return
            const bl = toSvg(b.minX, b.minY), br = toSvg(b.maxX, b.minY), tr = toSvg(b.maxX, b.maxY)
            if (Math.hypot(br.x - bl.x, br.y - bl.y) < 12 && Math.hypot(bl.x - tr.x, bl.y - tr.y) < 12) return
            const wmx = (bl.x + br.x) / 2, wmy = (bl.y + br.y) / 2 + 10
            parts.push(`<g><line x1="${bl.x}" y1="${bl.y + 8}" x2="${br.x}" y2="${br.y + 8}" stroke="#111" stroke-width="1.1"/><line x1="${bl.x}" y1="${bl.y + 4}" x2="${bl.x}" y2="${bl.y + 12}" stroke="#111" stroke-width="1.1"/><line x1="${br.x}" y1="${br.y + 4}" x2="${br.x}" y2="${br.y + 12}" stroke="#111" stroke-width="1.1"/><rect x="${wmx - 16}" y="${wmy - 6}" width="32" height="12" fill="#fff" rx="2" stroke="#ccc" stroke-width="0.5"/><text x="${wmx}" y="${wmy + 2.5}" text-anchor="middle" font-size="8" font-weight="700" fill="#000">${(wM * gf).toFixed(1)} m</text></g>`)
            const hmx = (tr.x + br.x) / 2 + 10, hmy = (tr.y + br.y) / 2
            parts.push(`<g><line x1="${tr.x + 8}" y1="${tr.y}" x2="${br.x + 8}" y2="${br.y}" stroke="#111" stroke-width="1.1"/><line x1="${tr.x + 4}" y1="${tr.y}" x2="${tr.x + 12}" y2="${tr.y}" stroke="#111" stroke-width="1.1"/><line x1="${br.x + 4}" y1="${br.y}" x2="${br.x + 12}" y2="${br.y}" stroke="#111" stroke-width="1.1"/><rect x="${hmx - 16}" y="${hmy - 6}" width="32" height="12" fill="#fff" rx="2" stroke="#ccc" stroke-width="0.5"/><text x="${hmx}" y="${hmy + 2.5}" text-anchor="middle" font-size="8" font-weight="700" fill="#000">${(hM * gf).toFixed(1)} m</text></g>`)
        })
    }

    // ── Parcel cotes: the two longest sides ──
    if (targetIdx >= 0) {
        const ring = ringsOf(fC[targetIdx])[0] || []
        const sides: { i: number; distM: number }[] = []
        for (let i = 0; i < ring.length - 1; i++) {
            const dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1]
            const distM = Math.hypot(dx, dy)
            if (distM >= 3) sides.push({ i, distM })
        }
        sides.sort((a, b) => b.distM - a.distM)
        for (const { i, distM } of sides.slice(0, 2)) {
            const p1 = toSvg(ring[i][0], ring[i][1]), p2 = toSvg(ring[i + 1][0], ring[i + 1][1])
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y); if (len < 8) continue
            const off = 12, perpX = -(p2.y - p1.y) / len * off, perpY = (p2.x - p1.x) / len * off
            const ox1 = p1.x + perpX, oy1 = p1.y + perpY, ox2 = p2.x + perpX, oy2 = p2.y + perpY
            const mx = (ox1 + ox2) / 2, my = (oy1 + oy2) / 2
            parts.push(`<g><line x1="${p1.x}" y1="${p1.y}" x2="${ox1}" y2="${oy1}" stroke="#2D5A4C" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/><line x1="${p2.x}" y1="${p2.y}" x2="${ox2}" y2="${oy2}" stroke="#2D5A4C" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/><line x1="${ox1}" y1="${oy1}" x2="${ox2}" y2="${oy2}" stroke="#2D5A4C" stroke-width="1"/><rect x="${mx - 14}" y="${my - 5}" width="28" height="10" fill="#fff" rx="1" opacity="0.9"/><text x="${mx}" y="${my + 2}" text-anchor="middle" font-size="7" fill="#2D5A4C">${(distM * gf).toFixed(1)} m</text></g>`)
        }
    }

    // ── Reculs aux limites séparatives ──────────────────────────────────────
    // Le premier réflexe de l'instructeur : à quelle distance des limites la
    // construction s'implante-t-elle ? On cote les quatre plus courts reculs,
    // un par côté de parcelle, en trait fin perpendiculaire à la limite.
    if (targetIdx >= 0 && subjIdx >= 0) {
        const parcelRing = ringsOf(fC[targetIdx])[0] || []
        const bldRing = ringsOf(fB[subjIdx])[0] || []
        if (parcelRing.length > 2 && bldRing.length > 2) {
            const reculs = reculsToBoundaries(bldRing, parcelRing).slice(0, 4)
            for (const r of reculs) {
                const a = toSvg(r.bx, r.by), b = toSvg(r.cx, r.cy)
                const px = b.x - a.x, py = b.y - a.y
                const lenPx = Math.hypot(px, py)
                const m = r.dist * gf
                // Cadastre et BD TOPO se recalent à ~1 m près : en deçà du mètre on
                // qualifie l'implantation (en limite) plutôt que d'afficher une précision
                // que la donnée ne porte pas. Même seuil que le PDF.
                const enLimite = m < 1
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
                const label = enLimite ? 'en limite' : `${m.toFixed(1)} m`
                const w = label.length * 3.6 + 8
                parts.push(
                    `<g>` +
                    (lenPx > 2
                        ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#B0552F" stroke-width="0.9"/>` +
                          `<circle cx="${a.x}" cy="${a.y}" r="1.6" fill="#B0552F"/><circle cx="${b.x}" cy="${b.y}" r="1.6" fill="#B0552F"/>`
                        : `<circle cx="${b.x}" cy="${b.y}" r="2.4" fill="none" stroke="#B0552F" stroke-width="1"/>`) +
                    `<rect x="${mx - w / 2}" y="${my - 5}" width="${w}" height="10" fill="#fff" stroke="#B0552F" stroke-width="0.5" rx="1.5" opacity="0.95"/>` +
                    `<text x="${mx}" y="${my + 2.5}" text-anchor="middle" font-size="6.6" font-weight="600" fill="#8A3F20">${esc(label)}</text>` +
                    `</g>`,
                )
            }
        }
    }

    // ── NEW: works localisation marker — a pin on the subject building + a labelled callout ──
    if (input.worksLabel && subjIdx >= 0) {
        const ring = ringsOf(fB[subjIdx])[0]
        const b = bboxOfRing(ring); const c = toSvg((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2)
        // Callout box in the top-left, leader line to the building.
        const boxX = 10, boxY = 10, boxW = Math.min(230, 70 + input.worksLabel.length * 5.2), boxH = 30
        parts.push(`<line x1="${boxX + 14}" y1="${boxY + boxH}" x2="${c.x}" y2="${c.y}" stroke="#B0552F" stroke-width="1.1" stroke-dasharray="3,2"/>`)
        parts.push(`<circle cx="${c.x}" cy="${c.y}" r="4.5" fill="#B0552F" stroke="#fff" stroke-width="1.4"/>`)
        parts.push(`<g><rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" fill="#fff" stroke="#B0552F" stroke-width="1.2"/><rect x="${boxX}" y="${boxY}" width="6" height="${boxH}" rx="0" fill="#B0552F"/><text x="${boxX + 13}" y="${boxY + 12}" font-size="7" font-weight="700" fill="#B0552F" letter-spacing="0.4">LOCALISATION DES TRAVAUX</text><text x="${boxX + 13}" y="${boxY + 23}" font-size="8.5" font-weight="600" fill="#2b2620">${esc(input.worksLabel)}</text></g>`)
    }

    // ── Centre crosshair (geocoded point) ──
    const cc = toSvg(cx, cy)
    parts.push(`<g><circle cx="${cc.x}" cy="${cc.y}" r="7" fill="none" stroke="#444" stroke-width="0.9"/><circle cx="${cc.x}" cy="${cc.y}" r="2.5" fill="#444"/><line x1="${cc.x - 12}" y1="${cc.y}" x2="${cc.x + 12}" y2="${cc.y}" stroke="#444" stroke-width="0.8"/><line x1="${cc.x}" y1="${cc.y - 12}" x2="${cc.x}" y2="${cc.y + 12}" stroke="#444" stroke-width="0.8"/></g>`)

    // ── Dimensions box ──
    const anns = input.annotations ?? []
    if (anns.length) {
        const lh = 13, bw = 150, bh = anns.length * lh + 22, bx = VW - bw - 6, by = VH - bh - 70
        parts.push(`<g><rect x="${bx - 1}" y="${by - 1}" width="${bw + 2}" height="${bh + 2}" fill="rgba(0,0,0,0.12)" rx="4"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#E8F0EC" stroke="#2D5A4C" stroke-width="0.9" rx="3"/><rect x="${bx}" y="${by}" width="${bw}" height="15" fill="#2D5A4C" rx="3"/><rect x="${bx}" y="${by + 10}" width="${bw}" height="5" fill="#2D5A4C"/><text x="${bx + bw / 2}" y="${by + 10.5}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fff">DIMENSIONS DU PROJET</text>${anns.map((a, i) => `<text x="${bx + 8}" y="${by + 28 + i * lh}" font-size="7.5" fill="#244A3E">• ${esc(a)}</text>`).join('')}</g>`)
    }

    // ── North arrow ──
    const nOx = 28, nOy = VH - 28
    parts.push([0, 45, 90, 135, 180, 225, 270, 315].map(a => { const rad = a * Math.PI / 180, r = a % 90 === 0 ? 16 : 10; return `<line x1="${nOx}" y1="${nOy}" x2="${nOx + Math.cos(rad) * r}" y2="${nOy + Math.sin(rad) * r}" stroke="#333" stroke-width="${a % 90 === 0 ? 1.4 : 0.8}"/>` }).join(''))
    parts.push(`<circle cx="${nOx}" cy="${nOy}" r="2.5" fill="#333"/><text x="${nOx}" y="${VH - 50}" text-anchor="middle" font-size="8" font-weight="bold" fill="#111">N</text>`)

    // ── Legend ──
    const lx = 8, ly = VH - 72
    parts.push(`<rect x="${lx}" y="${ly}" width="140" height="66" fill="#fff" stroke="#bbb" stroke-width="0.7" rx="2"/>`)
    const legend: [string, string, string][] = [
        ['#d7e8c4', '#2D5A4C', 'Parcelle concernée'],
        ['#f2efe9', '#b9b3a8', 'Autres parcelles'],
        ['#e7cbb6', '#B0552F', 'Bâtiment des travaux'],
        ['#c9c4ba', '#6f6a61', 'Autres bâtiments'],
    ]
    legend.forEach((row, i) => {
        const y = ly + 8 + i * 14
        parts.push(`<rect x="${lx + 6}" y="${y}" width="9" height="7" fill="${row[0]}" stroke="${row[1]}" stroke-width="1"/><text x="${lx + 20}" y="${y + 6}" font-size="7" fill="#333">${row[2]}</text>`)
    })
    parts.push(`<text x="${VW - 4}" y="${VH - 3}" text-anchor="end" font-size="5.5" fill="#888">Fond : IGN BD TOPO® — Parcellaire Express (PCI)</text>`)

    parts.push('</svg>')
    return parts.join('')
}
