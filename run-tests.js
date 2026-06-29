// run-tests.js
// Script to test the urbanism compliance engine for:
// Address: 12 Rue Saint-Jean, 69005 Lyon (Vieux Lyon)
// Famous historic district in France with strict SPR / Monument Historique protections.

const http = require('http');
const https = require('https');

async function apiRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function geocode(q) {
    return new Promise((resolve, reject) => {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.features && parsed.features.length > 0) {
                        const coords = parsed.features[0].geometry.coordinates;
                        const props = parsed.features[0].properties;
                        resolve({
                            lon: coords[0],
                            lat: coords[1],
                            commune: props.city,
                            postcode: props.postcode
                        });
                    } else {
                        reject(new Error("No address found"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    const address = "12 Rue Saint-Jean, 69005 Lyon";
    console.log(`=== Geocoding Address: "${address}" ===`);
    let location;
    try {
        location = await geocode(address);
        console.log(`Coords: Lat=${location.lat}, Lon=${location.lon}, Commune=${location.commune}, CodePostal=${location.postcode}\n`);
    } catch (e) {
        console.error("Geocoding failed:", e.message);
        return;
    }

    console.log("=== 1. Fetching PLU and Overlay Data ===");
    const fetchPath = `/api/fetch-plu?lat=${location.lat}&lon=${location.lon}&commune=${encodeURIComponent(location.commune)}`;
    const fetchRes = await apiRequest(fetchPath);
    
    if (fetchRes.status !== 200) {
        console.error(`fetch-plu returned status ${fetchRes.status}:`, fetchRes.raw || fetchRes.data);
        return;
    }

    const pluData = fetchRes.data;
    console.log("PLU Zone Code:", pluData.zone?.libelle);
    console.log("PLU Document Link:", pluData.zone?.url_doc);
    console.log("Zoning details:", pluData.zone?.libelong);
    console.log("Overlays detected:");
    console.log(`- Seismic Zone: ${pluData.overlays?.seismicClass}`);
    console.log(`- Flood Risk: ${pluData.overlays?.hasFloodRisk ? 'YES' : 'NO'}`);
    console.log(`- Historic District (SPR): ${pluData.overlays?.hasSPR ? 'YES (' + pluData.overlays.sprName + ')' : 'NO'}`);
    console.log(`- Monuments Historiques within 500m: ${pluData.overlays?.monumentsWithin500m?.length || 0}`);
    if (pluData.overlays?.monumentsWithin500m?.length > 0) {
        pluData.overlays.monumentsWithin500m.forEach(m => {
            console.log(`  * ${m.title} (${m.distance}m) - [${m.protection}]`);
        });
    }
    console.log("\n--------------------------------------------------\n");

    // ==========================================
    // TEST A: Correct Building Practices
    // ==========================================
    console.log("=== TEST A: Correct Building Practices ===");
    console.log("Project Details:");
    console.log("- Type: Menuiseries (replacing windows)");
    console.log("- Material: Bois (conforming wood)");
    console.log("- Surfaces: existante=120m², creee=0m², supprimee=0m² (no extension)");
    
    const travauxA = {
        type: 'menuiseries',
        menuiseries: {
            type: 'fenetre',
            materiau: 'bois',
            couleur: 'Bois naturel verni',
            couleur_ral: '',
            nombre: '4',
            largeur: '120',
            hauteur: '115',
            remplacement: true,
            description: 'Remplacement de fenêtres existantes en bois simple vitrage par du bois double vitrage de même aspect.'
        },
        surfaces: {
            existante: '120',
            creee: '0',
            supprimee: '0'
        }
    };

    console.log("Running AI Analysis for Test A...");
    const analyzePath = '/api/analyze-plu';
    const resA = await apiRequest(analyzePath, 'POST', {
        plu: pluData,
        travaux: travauxA,
        description_projet: "Remplacement de fenêtres anciennes en bois à petits carreaux par des modèles en bois double vitrage."
    });

    if (resA.status !== 200) {
        console.error("Test A analyze-plu failed:", resA.status, resA.raw || resA.data);
    } else {
        const resultA = resA.data;
        console.log("\n>>> Test A Decision Engine Output:");
        console.log(`- Verdict Decision: ${resultA.evaluationResult?.decision}`);
        console.log(`- Status: ${resultA.evaluationResult?.status}`);
        console.log(`- Violations (${resultA.evaluationResult?.violations?.length || 0}):`, resultA.evaluationResult?.violations);
        console.log(`- Warnings (${resultA.evaluationResult?.warnings?.length || 0}):`, resultA.evaluationResult?.warnings);
        console.log("- Extracted Rules (Facade):", JSON.stringify(resultA.extractedRules?.facade, null, 2));
    }
    
    console.log("\n--------------------------------------------------\n");

    // ==========================================
    // TEST B: Wrong Building Practices
    // ==========================================
    console.log("=== TEST B: Wrong Building Practices ===");
    console.log("Project Details:");
    console.log("- Type: Menuiseries (replacing windows + large extension)");
    console.log("- Material: PVC (explicitly non-conforming in historic sectors like Vieux Lyon)");
    console.log("- Surfaces: existante=120m², creee=55m² (exceeds the 20m² DP threshold, forcing PC)");
    
    const travauxB = {
        type: 'menuiseries',
        menuiseries: {
            type: 'fenetre',
            materiau: 'pvc', // Wrong material
            couleur: 'Bleu fluorescent', // Non-conforming color
            couleur_ral: 'RAL 5015',
            nombre: '4',
            largeur: '120',
            hauteur: '115',
            remplacement: true,
            description: 'Remplacement de fenêtres par du PVC blanc brillant.'
        },
        surfaces: {
            existante: '120',
            creee: '55', // Too large for DP (exceeds 20m2 threshold)
            supprimee: '0'
        }
    };

    console.log("Running AI Analysis for Test B...");
    const resB = await apiRequest(analyzePath, 'POST', {
        plu: pluData,
        travaux: travauxB,
        description_projet: "Remplacement des fenêtres par du PVC blanc brillant et construction d'une extension de 55m²."
    });

    if (resB.status !== 200) {
        console.error("Test B analyze-plu failed:", resB.status, resB.raw || resB.data);
    } else {
        const resultB = resB.data;
        console.log("\n>>> Test B Decision Engine Output:");
        console.log(`- Verdict Decision: ${resultB.evaluationResult?.decision}`);
        console.log(`- Status: ${resultB.evaluationResult?.status}`);
        console.log(`- Violations (${resultB.evaluationResult?.violations?.length || 0}):`, resultB.evaluationResult?.violations);
        console.log(`- Warnings (${resultB.evaluationResult?.warnings?.length || 0}):`, resultB.evaluationResult?.warnings);
        console.log("- Extracted Rules (Facade):", JSON.stringify(resultB.extractedRules?.facade, null, 2));
    }
}

run();
