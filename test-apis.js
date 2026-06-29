// Use native fetch

async function test() {
    const insee = '38544'; // Vienne
    const lat = 45.5244;
    const lon = 4.8822;
    
    console.log("--- Testing GeoRisques Sismique ---");
    try {
        const res = await fetch(`https://georisques.gouv.fr/api/v1/zonage_sismique?code_insee=${insee}`);
        console.log("Sismique Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Sismique data sample:", JSON.stringify(data, null, 2).slice(0, 1000));
        }
    } catch (e) {
        console.error("Sismique Error:", e.message);
    }

    console.log("\n--- Testing Vienne with camelCase codeInsee ---");
    const targetInsee = '38544'; // Vienne
    const endpoints = [
        { path: 'gaspar/pprn', param: 'codeInsee' },
        { path: 'gaspar/pprt', param: 'codeInsee' },
        { path: 'gaspar/catnat', param: 'code_insee' },
        { path: 'gaspar/tim', param: 'code_insee' },
        { path: 'gaspar/dicrim', param: 'code_insee' }
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(`https://georisques.gouv.fr/api/v1/${ep.path}?${ep.param}=${targetInsee}`);
            if (res.ok) {
                const data = await res.json();
                const count = data.totalElements !== undefined ? data.totalElements : (data.results !== undefined ? data.results : (data.data ? data.data.length : 'N/A'));
                console.log(`  Endpoint ${ep.path} with ${ep.param} -> total/results: ${count}`);
            }
        } catch (e) {
            console.log(`  Endpoint ${ep.path} -> Failed: ${e.message}`);
        }
    }

    console.log("\n--- Testing APICarto SUP ---");
    try {
        const geomParam = JSON.stringify({
            type: 'Point',
            coordinates: [lon, lat]
        });
        const res = await fetch(`https://apicarto.ign.fr/api/gpu/acte-sup?geom=${encodeURIComponent(geomParam)}`);
        console.log("Acte SUP status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Acte SUP features count:", data.features ? data.features.length : 0);
            if (data.features && data.features.length > 0) {
                console.log("Acte SUP sample:", JSON.stringify(data.features[0].properties, null, 2));
            }
        }

        const res2 = await fetch(`https://apicarto.ign.fr/api/gpu/assiette-sup-s?geom=${encodeURIComponent(geomParam)}`);
        console.log("Assiette SUP-S status:", res2.status);
        if (res2.ok) {
            const data = await res2.json();
            console.log("Assiette SUP-S features count:", data.features ? data.features.length : 0);
            if (data.features) {
                data.features.forEach((f, idx) => {
                    console.log(`Feature ${idx + 1}: type=${f.properties.suptype}, name=${f.properties.nomsuplitt}, file=${f.properties.fichier}`);
                });
            }
        }
    } catch (e) {
        console.error("APICarto SUP Error:", e.message);
    }
}

test();
