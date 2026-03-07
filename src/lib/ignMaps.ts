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
        const query = encodeURIComponent(`${address} ${commune} France`);
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
 * Generates the IGN WMS URL
 * VERSION=1.3.0 is REQUIRED by data.geopf.fr
 */
export function getIGNMapUrl(type: 'DP1' | 'DP2', coords: MapCoords): string {
    // Standard IGN Geoplateforme WMS endpoint (VERSION 1.3.0 mandatory)
    const baseUrl = 'https://data.geopf.fr/wms-r/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=EPSG:3857&WIDTH=1000&HEIGHT=1000&STYLES=';

    if (type === 'DP1') {
        const bbox = getBBox3857(coords.lat, coords.lon, 1200); // ~1.2km: zoomed-in situation plan
        return `${baseUrl}&LAYERS=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png&BBOX=${bbox}`;
    } else {
        const bbox = getBBox3857(coords.lat, coords.lon, 150);
        // Orthophoto + Cadastre
        return `${baseUrl}&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS,CADASTRALPARCELS.PARCELS&FORMAT=image/png&BBOX=${bbox}`;
    }
}
