// Copy the pdfjs worker into /public so it's served as a static asset and always matches the
// installed pdfjs-dist version (the worker and API versions must match, or pdfjs throws). Runs on
// prebuild. Bundling the worker via webpack fails on the minified module, hence the static copy.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const destDir = join(root, 'public')
const dest = join(destDir, 'pdf.worker.min.mjs')

try {
    if (!existsSync(src)) {
        console.warn('[copy-pdf-worker] source not found:', src, '— skipping (existing /public copy kept).')
        process.exit(0)
    }
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
    copyFileSync(src, dest)
    console.log('[copy-pdf-worker] copied pdf.worker.min.mjs → public/')
} catch (e) {
    console.warn('[copy-pdf-worker] failed:', e?.message || e)
    process.exit(0) // never block the build
}
