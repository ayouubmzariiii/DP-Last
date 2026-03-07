import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[Proxy] IGN Error ${response.status}:`, errBody);
            // Return a 200 with a transparent pixel if IGN fails, to avoid UI breakage
            // but log it so we know.
            return new NextResponse(
                Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
                { headers: { 'Content-Type': 'image/png' } }
            );
        }

        const data = await response.arrayBuffer();
        return new NextResponse(data, {
            headers: {
                'Content-Type': response.headers.get('content-type') || 'image/png',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e: any) {
        console.error('[Proxy] Fatal Error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
