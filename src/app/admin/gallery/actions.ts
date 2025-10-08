'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { getServerEnv } from '@/lib/env';

function getBaseUrl(): string {
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const protocol = hdrs.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https');
  if (!host) throw new Error('Unable to resolve host for admin action');
  return `${protocol}://${host}`;
}

export async function updateCreationStatus(formData: FormData) {
  const slug = formData.get('slug');
  const status = formData.get('status');
  const notes = formData.get('moderationNotes');

  if (typeof slug !== 'string' || !slug) {
    throw new Error('Missing creation identifier');
  }

  if (typeof status !== 'string' || !status) {
    throw new Error('Missing status');
  }

  const { GALLERY_REVIEWER_TOKEN, GALLERY_REVIEWER_ID } = getServerEnv();

  try {
    const response = await fetch(`${getBaseUrl()}/api/gallery/review/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GALLERY_REVIEWER_TOKEN}`,
      },
      body: JSON.stringify({
        status,
        moderationNotes: typeof notes === 'string' && notes.length ? notes : undefined,
        reviewedBy: GALLERY_REVIEWER_ID,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to update creation';
      try {
        const body = await response.json();
        if (typeof body?.error === 'string') {
          message = body.error;
        }
      } catch (error) {
        console.warn('Failed to parse review update error response', error);
      }
      throw new Error(message);
    }

    revalidatePath('/admin/gallery');
  } catch (error) {
    console.error('[gallery-review-action]', error);
    throw error;
  }
}
