/**
 * Logic for generating IGN (Institut Geographique National) Map URLs
 */

export interface MapCoords {
    lat: number;
    lon: number;
}

/**
 * Calculates a Bounding Box in Web Mercator (EPSG:3857) around a center point
 */
export function getBBox3857(lat: number, lon: number, sizeMeters: number): string {
    const R = 6378137;
    const x = R * lon * Math.PI / 180;
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

    const half = sizeMeters / 2;
    // WMS 1.3.0 BBOX axis order for EPSG:3857: Easting (X), Northing (Y)
    return `${(x - half).toFixed(2)},${(y - half).toFixed(2)},${(x + half).toFixed(2)},${(y + half).toFixed(2)}`;
}

export async function geocodeAddress(address: string, commune: string): Promise<MapCoords | null> {
    try {
        const cleanAddress = (address || '').split(',')[0].trim();
        const cleanCommune = (commune || '').trim();
        
        // Construct a clean query: avoid repeating the city if it's already in the address
        let queryStr = cleanAddress;
        if (cleanCommune && !cleanAddress.toLowerCase().includes(cleanCommune.toLowerCase())) {
            queryStr += ` ${cleanCommune}`;
        }
        
        // 1. Try API Adresse Gouv (Best for France, handles typos very well)
        const gouvQuery = encodeURIComponent(queryStr);
        const gouvUrl = `https://api-adresse.data.gouv.fr/search/?q=${gouvQuery}&limit=1`;
        const gouvRes = await fetch(gouvUrl);
        const gouvData = await gouvRes.json();
        
        if (gouvData.features && gouvData.features.length > 0) {
            const feature = gouvData.features[0];
            return {
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0]
            };
        }

        // 2. Fallback to Nominatim (More global, but sometimes slower/stricter)
        const query = encodeURIComponent(`${queryStr} France`);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' } });
        const data = await res.json();
        if (data && data[0]) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
    } catch (e) {
        console.error('Geocoding error:', e);
    }
    return null;
}

/**
 * Web Mercator units are NOT ground metres: at latitude φ, one EPSG:3857 unit covers
 * cos(φ) ground metres (~0.69 at 46°N). A bbox built from a raw metre count therefore
 * covers ~30 % LESS ground than asked — which is why a "500 m" plan de situation only
 * ever showed ~350 m of commune. Every caller below speaks TRUE GROUND METRES; this is
 * the single place the projection distortion is undone.
 */
export function groundToMercator(lat: number, groundMeters: number): number {
    const c = Math.cos(lat * Math.PI / 180);
    return groundMeters / Math.max(c, 0.2); // clamp guards the poles (never France, but cheap)
}

/** Default ground span of the DP1 plan de situation, in metres.
 *  R. 431-36 a) asks for "un plan permettant de connaître la situation du terrain à
 *  l'intérieur de la commune" — the terrain must be readable IN ITS COMMUNE, not just in
 *  its street. Printed 169 mm wide on the A3 sheet, 1200 m lands at ≈ 1/7000. */
export const DP1_DEFAULT_GROUND_M = 1200;
/** Default ground span of the DP2 fallback ortho image, in metres. */
export const DP2_DEFAULT_GROUND_M = 150;

/**
 * Generates the IGN WMS URL.
 * VERSION=1.3.0 is REQUIRED by data.geopf.fr
 * `groundMeters` is the TRUE ground span of the returned image (see groundToMercator).
 */
export function getIGNMapUrl(type: 'DP1' | 'DP2', coords: MapCoords, groundMeters?: number): string {
    // Standard IGN Geoplateforme WMS endpoint (VERSION 1.3.0 mandatory).
    // DP1 is requested at 1600² rather than 1000²: it now covers ~2.4× more ground, and at
    // 169 mm printed a 1000 px tile would drop to ~150 dpi — too coarse to read street names.
    const px = type === 'DP1' ? 1600 : 1000;
    const baseUrl = `https://data.geopf.fr/wms-r/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:3857&WIDTH=${px}&HEIGHT=${px}&STYLES=`;

    const timestamp = Date.now();
    const ground = groundMeters || (type === 'DP1' ? DP1_DEFAULT_GROUND_M : DP2_DEFAULT_GROUND_M);
    const bbox = getBBox3857(coords.lat, coords.lon, groundToMercator(coords.lat, ground));
    if (type === 'DP1') {
        return `${baseUrl}&LAYERS=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png&BBOX=${bbox}&ts=${timestamp}`;
    }
    // Orthophoto + Cadastre
    return `${baseUrl}&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS,CADASTRALPARCELS.PARCELS&FORMAT=image/png&BBOX=${bbox}&ts=${timestamp}`;
}

/** `radiusMeters` is a TRUE GROUND half-span (the WFS bbox is widened accordingly). */
export async function getVectorMapData(coords: MapCoords, radiusMeters: number) {
    const bboxStr = getBBox3857(coords.lat, coords.lon, groundToMercator(coords.lat, radiusMeters));
    const baseUrl = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&OUTPUTFORMAT=application/json&srsName=EPSG:3857';

    const urlCadastre = `${baseUrl}&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle&BBOX=${bboxStr},EPSG:3857`;
    const urlBati = `${baseUrl}&TYPENAMES=BDTOPO_V3:batiment&BBOX=${bboxStr},EPSG:3857`;

    try {
        const [resCad, resBati] = await Promise.all([
            fetch(urlCadastre, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' } }).then(r => r.json()),
            fetch(urlBati, { headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' } }).then(r => r.json())
        ]);
        return { cadastre: resCad, bati: resBati, bboxStr };
    } catch (e) {
        console.error('WFS Vector error:', e);
        return null;
    }
}
