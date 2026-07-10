// ─────────────────────────────────────────────────────────────────────────────
// Resolve the URL of a commune's PLU règlement PDF from a point (lat/lon), via IGN's GPU.
//
// apicarto/zone-urba often returns an empty `nomfic`, and apicarto is intermittently flaky, so this
// resolver: (1) reads the GPU document metadata (partition, doc id, name), (2) tries a broad set of
// règlement filename patterns under the geopf annexes folder with a HEAD check, (3) retries. Shared
// by fetch-plu and analyze-plu so a transient miss in one is recovered by the other.
// ─────────────────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id))
}

export async function resolvePluDocUrl(lat: number, lon: number): Promise<string> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
    const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetchWithTimeout(`https://apicarto.ign.fr/api/gpu/document?geom=${geom}`)
            if (!res.ok) continue
            const data = await res.json()
            const props = data?.features?.[0]?.properties
            if (!props) continue

            const partition: string = props.partition || ''
            const docId: string = props.gpu_doc_id || ''
            const insee: string = props.grid_name || (partition.startsWith('DU_') ? partition.slice(3) : '')
            const name: string = props.name || ''
            if (!partition || !docId) continue

            // Date suffix e.g. "24520_PLU_20180409" → "20180409".
            const tail = name.split('_').pop() || ''
            const date = /^\d{6,8}$/.test(tail) ? tail : ''
            const base = `https://data.geopf.fr/annexes/gpu/documents/${partition}/${docId}/`

            // Common règlement filenames across communes (with and without the date suffix).
            const cands = [
                date && `${insee}_reglement_${date}.pdf`,
                `${insee}_reglement.pdf`,
                date && `${insee}_reglement_ecrit_${date}.pdf`,
                date && `${insee}_piece_ecrite_reglement_${date}.pdf`,
                date && `${insee}_PLU_reglement_${date}.pdf`,
                date && `${insee}_1_reglement_${date}.pdf`,
                date && `${insee}_reglement_écrit_${date}.pdf`,
                date && `reglement_${date}.pdf`,
                'reglement.pdf',
                name && `${name}.pdf`,
                date && `${insee}_règlement_${date}.pdf`,
            ].filter((c): c is string => !!c)

            const checks = await Promise.all(cands.map(async (file) => {
                try {
                    const r = await fetchWithTimeout(base + file, { method: 'HEAD' }, 6000)
                    return r.ok ? base + file : ''
                } catch { return '' }
            }))
            const found = checks.find(Boolean)
            if (found) return found
        } catch { /* retry */ }
    }
    return ''
}
