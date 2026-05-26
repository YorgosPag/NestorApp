/**
 * ONE-SHOT FIX: Update super_admin_registry channels map.
 * Called once from browser DevTools after code deploy.
 * Delete this file after use.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';

export const POST = withAuth<{ success: boolean; updated: string[] }>(async (_req: Request, ctx: AuthContext) => {
  if (ctx.globalRole !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getAdminFirestore();

  await db.collection(COLLECTIONS.SETTINGS).doc(SYSTEM_DOCS.SUPER_ADMIN_REGISTRY).update({
    updatedAt: nowISO(),
    admins: [
      {
        isActive: true,
        displayName: 'Γιώργος Παγώνης',
        createdAt: '2026-02-09T09:23:31.209Z',
        updatedAt: nowISO(),
        firebaseUid: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1',
        channels: {
          telegram: { userId: '5618410820', chatId: '5618410820' },
          email: { addresses: ['georgios.pagonis@gmail.com'] },
          instagram: { igsid: '17841403201916682' },
          messenger: { psid: '25577455211956767' },
        },
      },
    ],
  });

  return NextResponse.json({
    success: true,
    updated: [`${COLLECTIONS.SETTINGS}/${SYSTEM_DOCS.SUPER_ADMIN_REGISTRY}`],
  });
});
