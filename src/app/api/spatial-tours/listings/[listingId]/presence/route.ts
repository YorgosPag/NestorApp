/**
 * @fileoverview **GET /api/spatial-tours/listings/{listingId}/presence** — «έχει η αγγελία περιήγηση που φαίνεται;»
 * @related ADR-884 Κ3β · `server/spatial-tour/tour-presence.ts` (η κρίση) · `components/spatial-tour/TourAccessCard.tsx`
 * @module app/api/spatial-tours/listings/[listingId]/presence/route
 *
 * 🔒 **Δημόσιο, χωρίς ταυτότητα**: η δημόσια σελίδα είναι ανώνυμη. Η θέση του **δικού μου** αιτήματος ρωτιέται
 * χωριστά, με λογαριασμό (`…/my-access`) — εδώ δεν υπάρχει κανένας «εγώ».
 * Ιδεμποτία: GET, καμία εγγραφή.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { readTourPresence, type TourPresence } from '@/server/spatial-tour/tour-presence';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ listingId: string }> };
type PresenceResponse = { readonly tour: TourPresence | null };

async function handler(
  _request: NextRequest,
  _ctx: unknown,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<PresenceResponse>> {
  const listingId = decodeRouteParam((await routeContext?.params)?.listingId ?? '').trim();
  const tour = listingId === '' ? null : await readTourPresence(getAdminFirestore(), listingId);
  // Σύντομη κρυφή μνήμη **μόνο** στον browser: η δημοσίευση αλλάζει σπάνια, αλλά δεν δίνουμε ποτέ στο CDN.
  return NextResponse.json({ tour }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}

export const GET = withHighRateLimit(withAuth<PresenceResponse, RouteContext>(handler, { allowUnauthenticated: true }));
