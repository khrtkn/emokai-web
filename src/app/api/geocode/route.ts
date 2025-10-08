import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerEnv } from '@/lib/env';

const bodySchema = z.object({
  query: z.string().min(1),
  locale: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }

    const { query, locale } = parsed.data;
    const { GOOGLE_MAPS_API_KEY } = getServerEnv();

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 501 });
    }

    const params = new URLSearchParams({
      address: query,
      key: GOOGLE_MAPS_API_KEY,
      language: locale && ['ja', 'en'].includes(locale) ? locale : 'en'
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: 'Geocoding request failed', details: text }, { status: 502 });
    }

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
        formatted_address?: string;
      }>;
      error_message?: string;
    };

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json(
        {
          error: 'Geocoding returned no results',
          status: data.status,
          message: data.error_message ?? null
        },
        { status: 404 }
      );
    }

    const top = data.results[0];
    const lat = top.geometry?.location?.lat;
    const lng = top.geometry?.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Geocoding result missing coordinates' }, { status: 500 });
    }

    return NextResponse.json({
      latitude: lat,
      longitude: lng,
      formattedAddress: top.formatted_address ?? null
    });
  } catch (error) {
    console.error('[geocode] failure', error);
    return NextResponse.json({ error: 'Failed to geocode location' }, { status: 500 });
  }
}
