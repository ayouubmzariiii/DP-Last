import { NextRequest, NextResponse } from 'next/server';
import { getIGNMapUrl } from '@/lib/ignMaps';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const commune = searchParams.get('commune');
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');

    let coords: { lat: number; lon: number } | null = null;

    if (latParam && lonParam) {
        coords = { lat: parseFloat(latParam), lon: parseFloat(lonParam) };
    } else if (!address || !commune) {
        return NextResponse.json({ error: 'Missing address or coords' }, { status: 400 });
    }

    try {
        if (!coords) {
            const cleanAddress = (address || '').split(',')[0].trim();
            const cleanCommune = (commune || '').trim();
            
            // Construct a clean query: avoid repeating the city if it's already in the address
            let queryStr = cleanAddress;
            if (cleanCommune && !cleanAddress.toLowerCase().includes(cleanCommune.toLowerCase())) {
                queryStr += ` ${cleanCommune}`;
            }

            // Try API Adresse Gouv first (better for France)
            const gouvQuery = encodeURIComponent(queryStr);
            const gouvUrl = `https://api-adresse.data.gouv.fr/search/?q=${gouvQuery}&limit=1`;
            const gouvRes = await fetch(gouvUrl);
            const gouvData = await gouvRes.json();

            if (gouvData.features && gouvData.features.length > 0) {
                const feature = gouvData.features[0];
                coords = {
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0]
                };
            } else {
                // Fallback to Nominatim
                const query = encodeURIComponent(`${queryStr} France`);
                const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;

                const response = await fetch(nominatimUrl, {
                    headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' }
                });
                const data = await response.json();

                if (!data || data.length === 0) {
                    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
                }

                coords = {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
            }
        }

        const zoom = searchParams.get('zoom') ? parseInt(searchParams.get('zoom')!) : undefined;
        const ts = Date.now();
        return NextResponse.json({
            coords,
            dp1Url: `/api/proxy-map?url=${encodeURIComponent(getIGNMapUrl('DP1', coords, zoom))}&_ts=${ts}`,
            dp2Url: `/api/proxy-map?url=${encodeURIComponent(getIGNMapUrl('DP2', coords))}&_ts=${ts}`
        });
    } catch (error) {
        console.error('Error in preview-maps:', error);
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
    }
}
