import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function resolveUrlFromPartition(insee: string): Promise<string> {
    if (!insee) return ''
    try {
        const url = `https://apicarto.ign.fr/api/gpu/zone-urba?partition=DU_${insee}`
        const res = await fetch(url)
        if (res.ok) {
            const data = await res.json()
            if (data.features && data.features.length > 0) {
                // Find a feature that has both gpu_doc_id and nomfic
                const feature = data.features.find((f: any) => f.properties?.gpu_doc_id && f.properties?.nomfic)
                if (feature) {
                    const props = feature.properties
                    const pdfUrl = `https://data.geopf.fr/annexes/gpu/documents/DU_${insee}/${props.gpu_doc_id}/${props.nomfic}`
                    // Do a quick HEAD check to be sure it's alive
                    const check = await fetch(pdfUrl, { method: 'HEAD' })
                    if (check.ok) {
                        console.log(`Resolved PLU document from partition DU_${insee} features: ${pdfUrl}`)
                        return pdfUrl
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error in resolveUrlFromPartition:', e)
    }
    return ''
}

async function findOfficialPluPdf(geomParam: string): Promise<string> {
    try {
        const docUrl = `https://apicarto.ign.fr/api/gpu/document?geom=${encodeURIComponent(geomParam)}`
        const res = await fetch(docUrl)
        if (!res.ok) return ''
        const data = await res.json()
        if (!data.features || data.features.length === 0) return ''
        
        const props = data.features[0].properties
        if (!props) return ''
        
        const partition = props.partition || ''
        const docId = props.gpu_doc_id || ''
        const insee = props.grid_name || ''
        const docName = props.name || ''
        
        if (!partition || !docId) return ''
        
        const parts = docName.split('_')
        const date = parts.length > 0 ? parts[parts.length - 1] : ''
        
        const baseUrl = `https://data.geopf.fr/annexes/gpu/documents/${partition}/${docId}/`
        
        const candidates = [
            `${insee}_reglement_${date}.pdf`,
            `${insee}_reglement.pdf`,
            `${insee}_piece_ecrite_reglement_${date}.pdf`,
            `reglement.pdf`,
            `${insee}_règlement_${date}.pdf`,
            `${insee}_règlement.pdf`
        ]
        
        const checks = candidates.map(async (file) => {
            const url = baseUrl + file
            try {
                const checkRes = await fetch(url, { method: 'HEAD' })
                if (checkRes.ok) return url
            } catch {}
            return ''
        })
        
        const results = await Promise.all(checks)
        const found = results.find(url => url !== '')
        if (found) {
            console.log(`Discovered official PLU document via IGN: ${found}`)
            return found
        }
    } catch (e) {
        console.error('Error in findOfficialPluPdf:', e)
    }
    return ''
}

async function fallbackSearchPlu(commune: string, postcode: string, departmentName: string, zoneLibelle: string): Promise<string> {
    if (!commune) return ''
    
    const cleanCommune = commune.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, ' ')
    const cleanDept = departmentName ? departmentName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, ' ') : ''
    const deptNum = postcode ? postcode.substring(0, 2) : ''
    
    const queries = [
        `PLU ${cleanCommune} ${postcode || ''} reglement ${zoneLibelle || ''} pdf`,
        `PLU ${cleanCommune} ${cleanDept || ''} reglement pdf`,
        `Plan Local Urbanisme ${cleanCommune} reglement pdf`
    ]
    
    for (const query of queries) {
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
            const res = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                next: { revalidate: 3600 }
            })
            if (!res.ok) continue
            const html = await res.text()
            
            if (html.includes('anomaly-modal') || html.includes('challenge')) {
                console.warn("DuckDuckGo search fallback blocked by captcha.")
                continue
            }
            
            const pdfRegex = /href="([^"]+\.pdf[^"]*)"/gi
            let match
            const urls: string[] = []
            while ((match = pdfRegex.exec(html)) !== null) {
                let url = match[1]
                url = url.replace(/&amp;/g, '&')
                
                if (url.includes('/l/?')) {
                    try {
                        const searchParamsStr = url.split('?')[1]
                        if (searchParamsStr) {
                            const urlParams = new URLSearchParams(searchParamsStr)
                            const uddg = urlParams.get('uddg')
                            if (uddg) url = uddg
                        }
                    } catch (e) {}
                }
                
                if (url.startsWith('//')) url = 'https:' + url
                if (url.startsWith('http')) {
                    const lowerUrl = url.toLowerCase()
                    
                    if (lowerUrl.includes('.gouv.fr')) {
                        const matchesGouv = lowerUrl.match(/https?:\/\/www\.([a-z-]+)\.gouv\.fr/)
                        if (matchesGouv) {
                            const subd = matchesGouv[1]
                            if (cleanDept && !subd.includes(cleanDept.toLowerCase()) && subd !== deptNum) {
                                console.log(`Skipping wrong department subdomain: ${url} (Expected: ${cleanDept})`)
                                continue
                            }
                        }
                    }
                    
                    urls.push(url)
                }
            }
            
            const rankedUrls = urls.map(u => {
                const lower = u.toLowerCase()
                let score = 0
                
                if (cleanCommune && cleanCommune.split(' ').some(word => word.length > 2 && lower.includes(word.toLowerCase()))) {
                    score += 10
                }
                if (lower.includes('reglement') || lower.includes('règlement')) {
                    score += 5
                }
                if (lower.includes('plu') || lower.includes('plan-local-urbanisme')) {
                    score += 3
                }
                if (zoneLibelle && lower.includes(zoneLibelle.toLowerCase())) {
                    score += 4
                }
                
                return { url: u, score }
            })
            
            rankedUrls.sort((a, b) => b.score - a.score)

            // Only accept a web-scraped PDF if the commune name actually appears in the URL
            // (score includes +10 for a commune match) — never grab another commune's règlement.
            const minScore = cleanCommune ? 10 : 1
            for (const item of rankedUrls) {
                if (item.score >= minScore) {
                    try {
                        const checkRes = await fetch(item.url, { method: 'HEAD' })
                        if (checkRes.ok) {
                            console.log(`Validated fallback PDF: ${item.url}`)
                            return item.url
                        }
                    } catch {}
                }
            }
        } catch (e) {
            console.error(`Search failed for query "${query}":`, e)
        }
    }
    return ''
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const latStr = searchParams.get('lat')
        const lonStr = searchParams.get('lon')

        if (!latStr || !lonStr) {
            return NextResponse.json({ error: 'Latitude and Longitude are required' }, { status: 400 })
        }

        const lat = parseFloat(latStr)
        const lon = parseFloat(lonStr)

        if (isNaN(lat) || isNaN(lon)) {
            return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
        }

        const geomParam = JSON.stringify({
            type: 'Point',
            coordinates: [lon, lat]
        })

        const zoneUrbaUrl = `https://apicarto.ign.fr/api/gpu/zone-urba?geom=${encodeURIComponent(geomParam)}`
        const prescSurfUrl = `https://apicarto.ign.fr/api/gpu/prescription-surf?geom=${encodeURIComponent(geomParam)}`
        const prescLinUrl = `https://apicarto.ign.fr/api/gpu/prescription-lin?geom=${encodeURIComponent(geomParam)}`
        const prescPctUrl = `https://apicarto.ign.fr/api/gpu/prescription-pct?geom=${encodeURIComponent(geomParam)}`

        // Fetch concurrently and gracefully handle errors for each endpoint
        const [zoneRes, surfRes, linRes, pctRes] = await Promise.all([
            fetch(zoneUrbaUrl).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(prescSurfUrl).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(prescLinUrl).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(prescPctUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

        // Parse Zone Urba features
        let zoneData = undefined
        if (zoneRes && zoneRes.features && zoneRes.features.length > 0) {
            const props = zoneRes.features[0].properties
            zoneData = {
                libelle: props.libelle || '',
                typezone: props.typezone || '',
                nomzone: props.nomzone || '',
                libelong: props.libelong || '',
                url_doc: props.url_doc || ''
            }
        }

        // Parse prescriptions features
        const prescriptions: Array<{ libelle: string; typepresc: string }> = []
        
        const parsePrescriptions = (res: any) => {
            if (res && res.features) {
                for (const feature of res.features) {
                    const props = feature.properties
                    if (props && props.libelle) {
                        prescriptions.push({
                            libelle: props.libelle,
                            typepresc: props.typepresc || ''
                        })
                    }
                }
            }
        }

        parsePrescriptions(surfRes)
        parsePrescriptions(linRes)
        parsePrescriptions(pctRes)

        // Deduplicate prescriptions by libelle
        const uniquePrescriptions = Array.from(
            new Map(prescriptions.map(p => [p.libelle, p])).values()
        )

        // Resolve location details from api-adresse (postcode, city, department)
        let communeName = searchParams.get('commune') || ''
        let postcode = searchParams.get('postcode') || ''
        let inseeCode = ''
        let departmentName = ''
        
        try {
            const revRes = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}`)
            if (revRes.ok) {
                const revData = await revRes.json()
                if (revData.features && revData.features.length > 0) {
                    const props = revData.features[0].properties
                    if (!communeName) communeName = props.city || ''
                    if (!postcode) postcode = props.postcode || ''
                    inseeCode = props.citycode || ''
                    const context = props.context || ''
                    const ctxParts = context.split(',')
                    if (ctxParts.length > 1) {
                        departmentName = ctxParts[1].trim()
                    }
                }
            }
        } catch (e) {
            console.error('Reverse geocode failed:', e)
        }

        // Resolve INSEE code by searching communeName if not retrieved
        if (!inseeCode && communeName) {
            try {
                const searchRes = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(communeName)}&type=municipality&limit=1`)
                if (searchRes.ok) {
                    const searchData = await searchRes.json()
                    if (searchData.features && searchData.features.length > 0) {
                        inseeCode = searchData.features[0].properties.citycode || ''
                        if (!postcode) postcode = searchData.features[0].properties.postcode || ''
                    }
                }
            } catch (e) {
                console.error('INSEE search by commune failed:', e)
            }
        }

        let isRnu = false
        if (inseeCode) {
            try {
                const munUrl = `https://apicarto.ign.fr/api/gpu/municipality?insee=${inseeCode}`
                const munRes = await fetch(munUrl)
                if (munRes.ok) {
                    const munData = await munRes.json()
                    if (munData.features && munData.features.length > 0) {
                        isRnu = !!munData.features[0].properties?.is_rnu
                        console.log(`Commune ${communeName} (${inseeCode}) RNU status: ${isRnu}`)
                    }
                }
            } catch (e) {
                console.error('Failed to query municipality endpoint:', e)
            }
        }

        // Fallback: If geometry-based zone lookup failed, try to query by city partition
        if (isRnu) {
            zoneData = {
                libelle: 'RNU',
                typezone: 'RNU',
                nomzone: 'RNU',
                libelong: 'Règlement National d\'Urbanisme (RNU) applicable par défaut.',
                url_doc: ''
            }
        } else if (!zoneData && inseeCode) {
            console.log(`Zoning query failed for coordinates. Falling back to city partition: DU_${inseeCode}`)
            try {
                const partitionUrl = `https://apicarto.ign.fr/api/gpu/zone-urba?partition=DU_${inseeCode}`
                const partRes = await fetch(partitionUrl)
                if (partRes.ok) {
                    const partData = await partRes.json()
                    if (partData.features && partData.features.length > 0) {
                        // Find a good fallback zone (e.g. UC or UA or first zone of type U)
                        const features = partData.features
                        const uZone = features.find((f: any) => f.properties?.typezone === 'U' || f.properties?.libelle?.toUpperCase().startsWith('U'))
                        const fallbackFeature = uZone || features[0]
                        const props = fallbackFeature.properties
                        
                        let docUrl = ''
                        if (props.gpu_doc_id && props.nomfic) {
                            docUrl = `https://data.geopf.fr/annexes/gpu/documents/DU_${inseeCode}/${props.gpu_doc_id}/${props.nomfic}`
                        }
                        
                        zoneData = {
                            libelle: props.libelle || 'UC',
                            typezone: props.typezone || 'U',
                            nomzone: props.nomzone || `Zone Urbaine ${props.libelle || 'UC'}`,
                            libelong: props.libelong || 'Zone urbaine de la commune.',
                            url_doc: docUrl
                        }
                        console.log(`Resolved fallback zone from city partition: ${zoneData.libelle}`)
                    }
                }
            } catch (e) {
                console.error('Fallback partition query failed:', e)
            }
        }

        // Resolve PDF URL
        let pdfUrl = ''
        
        if (!isRnu) {
            // 1. Try to resolve URL from partition features first (most reliable, matches nomfic directly)
            if (inseeCode) {
                pdfUrl = await resolveUrlFromPartition(inseeCode)
            }
            
            // 2. Try to find official PDF via document endpoint
            if (!pdfUrl) {
                pdfUrl = await findOfficialPluPdf(geomParam)
            }
            
            // 3. Try web search fallback if no official URL could be resolved
            if (!pdfUrl && communeName) {
                const zoneLibelle = zoneData?.libelle || ''
                console.log(`Official document not found on IGN for ${communeName}. Attempting web search fallback...`)
                pdfUrl = await fallbackSearchPlu(communeName, postcode, departmentName, zoneLibelle)
            }
        }

        // Apply URL to zoneData
        if (pdfUrl) {
            if (zoneData) {
                zoneData.url_doc = pdfUrl
            } else {
                zoneData = {
                    libelle: 'UC',
                    typezone: 'U',
                    nomzone: 'Zone Urbaine UC',
                    libelong: 'Zone urbaine à dominante pavillonnaire ou mixte.',
                    url_doc: pdfUrl
                }
            }
        }

        // Fetch overlays concurrently with resilience and timeouts
        const overlays = {
            seismicZone: 'inconnue',
            seismicClass: '1 - TRES FAIBLE',
            hasFloodRisk: false,
            floodRisks: [] as Array<{ libelle: string; dateEvt?: string }>,
            hasPPRN: false,
            pprnList: [] as Array<{ idGaspar: string; libPpr: string; modeleProcedure: string }>,
            hasPPRT: false,
            pprtList: [] as Array<{ idGaspar: string; libPpr: string; modeleProcedure: string }>,
            hasSPR: false,
            sprName: '',
            monumentsWithin500m: [] as Array<{ reference: string; title: string; distance: number; protection: string }>
        }

        if (inseeCode) {
            try {
                const fetchWithTimeout = (url: string, timeoutMs = 5000) => {
                    const controller = new AbortController()
                    const id = setTimeout(() => controller.abort(), timeoutMs)
                    return fetch(url, { signal: controller.signal })
                        .finally(() => clearTimeout(id))
                }

                const [seismicRes, pprnRes, pprtRes, catnatRes, monumentsRes, supRes] = await Promise.allSettled([
                    fetchWithTimeout(`https://georisques.gouv.fr/api/v1/zonage_sismique?code_insee=${inseeCode}`),
                    fetchWithTimeout(`https://georisques.gouv.fr/api/v1/gaspar/pprn?codeInsee=${inseeCode}`),
                    fetchWithTimeout(`https://georisques.gouv.fr/api/v1/gaspar/pprt?codeInsee=${inseeCode}`),
                    fetchWithTimeout(`https://georisques.gouv.fr/api/v1/gaspar/catnat?code_insee=${inseeCode}`),
                    fetchWithTimeout(`https://data.culture.gouv.fr/api/records/1.0/search/?dataset=liste-des-immeubles-proteges-au-titre-des-monuments-historiques&geofilter.distance=${lat},${lon},500`),
                    fetchWithTimeout(`https://apicarto.ign.fr/api/gpu/assiette-sup-s?geom=${encodeURIComponent(geomParam)}`)
                ])

                // Parse Seismic
                if (seismicRes.status === 'fulfilled' && seismicRes.value.ok) {
                    const data = await seismicRes.value.json()
                    if (data.data && data.data.length > 0) {
                        overlays.seismicZone = data.data[0].code_zone || 'inconnue'
                        overlays.seismicClass = data.data[0].zone_sismicite || '1 - TRES FAIBLE'
                    }
                }

                // Parse PPRN
                if (pprnRes.status === 'fulfilled' && pprnRes.value.ok) {
                    const data = await pprnRes.value.json()
                    if (data.content && data.content.length > 0) {
                        overlays.hasPPRN = true
                        overlays.pprnList = data.content.map((item: any) => ({
                            idGaspar: item.idGaspar || '',
                            libPpr: item.libPpr || '',
                            modeleProcedure: item.modeleProcedure || ''
                        }))
                    }
                }

                // Parse PPRT
                if (pprtRes.status === 'fulfilled' && pprtRes.value.ok) {
                    const data = await pprtRes.value.json()
                    if (data.content && data.content.length > 0) {
                        overlays.hasPPRT = true
                        overlays.pprtList = data.content.map((item: any) => ({
                            idGaspar: item.idGaspar || '',
                            libPpr: item.libPpr || '',
                            modeleProcedure: item.modeleProcedure || ''
                        }))
                    }
                }

                // Parse CatNat (Flood Risk history)
                if (catnatRes.status === 'fulfilled' && catnatRes.value.ok) {
                    const data = await catnatRes.value.json()
                    if (data.data && data.data.length > 0) {
                        const floods = data.data.filter((item: any) => 
                            item.libelle_risque_jo && item.libelle_risque_jo.toLowerCase().includes('inondation')
                        )
                        if (floods.length > 0) {
                            overlays.hasFloodRisk = true
                            overlays.floodRisks = floods.map((item: any) => ({
                                libelle: item.libelle_risque_jo,
                                dateEvt: item.date_debut_evt
                            }))
                        }
                    }
                }

                // Parse Monuments Historiques
                if (monumentsRes.status === 'fulfilled' && monumentsRes.value.ok) {
                    const data = await monumentsRes.value.json()
                    if (data.records && data.records.length > 0) {
                        overlays.monumentsWithin500m = data.records.map((rec: any) => {
                            const fields = rec.fields || {}
                            const dist = rec.geometry?.distance || 0
                            return {
                                reference: fields.reference || '',
                                title: fields.titre_editorial_de_la_notice || fields.titre || 'Monument Historique',
                                distance: Math.round(dist),
                                protection: fields.typologie_de_la_protection || fields.protection || 'Inscrit/Classé MH'
                            }
                        })
                    }
                }

                // Parse APICarto SUP (Servitudes)
                if (supRes.status === 'fulfilled' && supRes.value.ok) {
                    const data = await supRes.value.json()
                    if (data.features && data.features.length > 0) {
                        for (const feat of data.features) {
                            const props = feat.properties || {}
                            const suptype = (props.suptype || '').toLowerCase()
                            if (suptype === 'ac4') {
                                overlays.hasSPR = true
                                overlays.sprName = props.nomsuplitt || 'Site Patrimonial Remarquable'
                            }
                            if (suptype === 'pm1' || suptype.startsWith('ppr')) {
                                overlays.hasFloodRisk = true
                            }
                        }
                    }
                }

            } catch (e) {
                console.error('Error fetching overlays in fetch-plu:', e)
            }
        }

        return NextResponse.json({
            zone: zoneData,
            prescriptions: uniquePrescriptions,
            fetchedAt: new Date().toISOString(),
            isRnu,
            overlays
        })

    } catch (err: any) {
        console.error('Error fetching PLU data:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
