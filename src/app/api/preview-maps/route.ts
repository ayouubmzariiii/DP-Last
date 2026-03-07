import { NextRequest, NextResponse } from 'next/server';
import { getIGNMapUrl } from '@/lib/ignMaps';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const commune = searchParams.get('commune');

    if (!address || !commune) {
        return NextResponse.json({ error: 'Missing address or commune' }, { status: 400 });
    }

    try {
        const query = encodeURIComponent(`${address} ${commune} France`);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;

        const response = await fetch(nominatimUrl, {
            headers: { 'User-Agent': 'DP-Travaux-Generator/1.0' }
        });
        const data = await response.json();

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        const coords = {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };

        return NextResponse.json({
            coords,
            dp1Url: `/api/proxy-map?url=${encodeURIComponent(getIGNMapUrl('DP1', coords))}`,
            dp2Url: `/api/proxy-map?url=${encodeURIComponent(getIGNMapUrl('DP2', coords))}`
        });
    } catch (error) {
        console.error('Error in preview-maps:', error);
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
    }
}
