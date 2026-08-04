// ─────────────────────────────────────────────────────────────────────────────
// Rasterisation de pages PDF en images, côté serveur.
//
// Pourquoi ne pas simplement embarquer le PDF dans une <iframe> : le lecteur PDF
// intégré n'existe pas partout. Plusieurs navigateurs Android ne l'ont pas, iOS
// n'affiche parfois que la première page, et il peut être désactivé par stratégie
// d'entreprise — l'aperçu tombe alors sur un cadre vide, ce qui est pire que pas
// d'aperçu du tout sur une page qui sert à convaincre. Une image s'affiche partout.
//
// Serveur uniquement (@napi-rs/canvas + pdfjs, comme pluExtractor).
// ─────────────────────────────────────────────────────────────────────────────
import { createCanvas, DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas'

// pdfjs a besoin de ces globals DOM sous Node : on les fournit AVANT de le charger.
const g = globalThis as any
g.DOMMatrix ??= DOMMatrix
g.Path2D ??= Path2D
g.ImageData ??= ImageData

class NodeCanvasFactory {
    create(w: number, h: number) {
        const canvas = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)))
        return { canvas, context: canvas.getContext('2d') }
    }
    reset(cc: any, w: number, h: number) { cc.canvas.width = Math.max(1, Math.ceil(w)); cc.canvas.height = Math.max(1, Math.ceil(h)) }
    destroy(cc: any) { if (cc?.canvas) { cc.canvas.width = 0; cc.canvas.height = 0 } }
}

/** Dossier des polices standard livré par pdfjs-dist, en CHEMIN de fichier terminé par « / ».
 *  La build Node de pdfjs lit ces fichiers avec `fs` : elle attend un chemin, pas une URL
 *  `file://` — qu'elle tente de récupérer par fetch, et échoue silencieusement, texte effacé. */
function standardFontsDir(): string {
    const req = eval('require') as NodeRequire
    const pkg = req.resolve('pdfjs-dist/package.json')
    return pkg.replace(/package\.json$/, 'standard_fonts/').replace(/\\/g, '/')
}

/**
 * Rend UNE page en JPEG.
 * @param bytes    PDF source
 * @param pageNum  page 1-indexée (bornée aux pages existantes)
 * @param maxW     largeur cible en pixels ; l'échelle en découle
 */
export async function renderPdfPage(bytes: Uint8Array, pageNum: number, maxW = 1000): Promise<{ jpeg: Buffer; pages: number } | null> {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(bytes),
        // Sans `standardFontDataUrl`, pdfjs ne peut pas charger les 14 polices standard :
        // le tracé sort mais le TEXTE s'efface presque entièrement — sur une planche cotée,
        // c'est précisément ce qu'on venait montrer qui disparaît. Le chemin est résolu
        // depuis le paquet installé, pour rester juste quelle que soit la version.
        standardFontDataUrl: standardFontsDir(),
        useSystemFonts: false,
        disableFontFace: true,
        isEvalSupported: false,
        canvasFactory: new NodeCanvasFactory(),
    }).promise
    try {
        const n = Math.min(Math.max(1, pageNum), doc.numPages)
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(3, maxW / base.width) })
        const cf = new NodeCanvasFactory()
        const cc = cf.create(viewport.width, viewport.height)
        // Fond blanc explicite : un PDF sans fond dessiné rendrait sur du transparent,
        // que le JPEG restitue en noir.
        cc.context.fillStyle = '#ffffff'
        cc.context.fillRect(0, 0, cc.canvas.width, cc.canvas.height)
        await page.render({ canvasContext: cc.context, viewport, canvasFactory: cf }).promise
        const jpeg = cc.canvas.toBuffer('image/jpeg', 0.86)
        cf.destroy(cc)
        return { jpeg, pages: doc.numPages }
    } finally {
        try { await doc.destroy() } catch { /* rien à faire */ }
    }
}
