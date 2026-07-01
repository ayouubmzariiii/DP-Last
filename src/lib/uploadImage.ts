// Client helper: upload one image (data: URL, http(s) URL, or Blob) to Vercel Blob
// via /api/blob/upload and return its https URL to store in the dossier — so the
// dossier JSON never carries base64. Used by étape 5 (photos) and étape 6 (AI + maps).

export type ImageKind = 'before' | 'after' | 'croquis' | 'dp7' | 'dp8' | 'dp1' | 'dp2'

interface UploadOpts {
    facadeId?: string
    previousUrl?: string | null
}

async function toBlob(src: string | Blob): Promise<{ blob: Blob; ext: string }> {
    if (src instanceof Blob) {
        const ext = src.type.includes('png') ? 'png' : src.type.includes('webp') ? 'webp' : 'jpg'
        return { blob: src, ext }
    }
    // data: or http(s) URL → fetch into a Blob (works for both in the browser).
    const res = await fetch(src)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
    return { blob, ext }
}

/**
 * Upload an image and return its Blob https URL.
 * Already-hosted images that are NOT in this dossier's namespace (e.g. cached /test assets)
 * are returned unchanged so we don't needlessly re-host them.
 */
export async function uploadImage(
    dossierId: string,
    kind: ImageKind,
    source: string | Blob,
    opts: UploadOpts = {},
): Promise<string> {
    if (typeof source === 'string') {
        // Leave public /test fixtures and already-uploaded blobs for THIS dossier as-is.
        if (source.startsWith('/')) return source
        if (source.includes('.blob.vercel-storage.com') && source.includes(`/dossiers/${dossierId}/`)) return source
    }

    const { blob, ext } = await toBlob(source)
    const form = new FormData()
    form.append('file', blob, `${kind}.${ext}`)
    form.append('dossierId', dossierId)
    form.append('kind', kind)
    form.append('ext', ext)
    if (opts.facadeId) form.append('facadeId', opts.facadeId)
    if (opts.previousUrl) form.append('previousUrl', opts.previousUrl)

    const res = await fetch('/api/blob/upload', { method: 'POST', body: form })
    if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg.error || `Téléversement échoué (${res.status})`)
    }
    return (await res.json()).url as string
}
