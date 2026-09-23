import 'server-only';

/**
 * @fileoverview `POST /api/public-listings/[listingId]/view` — **μία προβολή, αν είναι προβολή** (ADR-777 §8.72).
 * @related services/listings/listing-view-recorder.ts (η κρίση) · hooks/listing-detail/useListingViewBeacon.ts
 * @module app/api/public-listings/[listingId]/view/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΑΝΤΑ 204 — Η ΑΠΑΝΤΗΣΗ ΔΕΝ ΛΕΕΙ ΠΟΤΕ ΑΝ ΜΕΤΡΗΘΗΚΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα «μετρήθηκε / δεν μετρήθηκε» στο σύρμα θα ήταν **μαντείο**: *«είναι αυτός ο λογαριασμός ο
 * κάτοχος;»* · *«υπάρχει αυτή η αγγελία;»*. Ο φυλλομετρητής δεν έχει καμία χρήση για την
 * απάντηση — ο beacon **δεν την περιμένει καν**.
 *
 * 🔒 **Σύνορο**: `withAuth` με `allowUnauthenticated` — η σελίδα είναι δημόσια, ο θεατής συνήθως
 * ανώνυμος. Η ταυτότητα, **αν υπάρχει**, χρησιμεύει μόνο για να **αφαιρέσει** τον κάτοχο
 * (`optionalListingActorOf`). Ιδεμποτία **φυσική**: το σημάδι «ένας επισκέπτης / ημέρα» κάνει
 * την επανάληψη αδύνατο να μετρήσει δεύτερη φορά (CHECK 3.92 Κ1).
 *
 * ⚠️ `withHighRateLimit` (100/λεπτό ανά IP): ο άνθρωπος που ξεφυλλίζει 40 αγγελίες σε ένα λεπτό
 * είναι **πελάτης**, όχι επίθεση. Το φούσκωμα το σταματά το σημάδι, όχι το όριο.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth';
import { optionalListingActorOf } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isAutomatedUserAgent, isPrefetchRequest } from '@/lib/http/automated-request';
import { clientIpOf } from '@/lib/http/client-ip';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { isPublicListingId } from '@/lib/stay/stay-public-request';
import { recordListingView } from '@/services/listings/listing-view-recorder';

type RouteContext = { params: Promise<{ listingId: string }> };

const NO_CONTENT = { status: 204, headers: { 'Cache-Control': 'no-store' } } as const;

async function viewHandler(
  request: NextRequest,
  _ctx: unknown,
  _cache: unknown,
  routeContext?: RouteContext,
): Promise<NextResponse<null>> {
  const listingId = (await routeContext?.params)?.listingId ?? '';
  const userAgent = request.headers.get('user-agent');
  if (!isPublicListingId(listingId) || isAutomatedUserAgent(userAgent) || isPrefetchRequest(request.headers)) {
    return new NextResponse<null>(null, NO_CONTENT);
  }

  await recordListingView(getAdminFirestore(), {
    listingId,
    ip: clientIpOf(request.headers),
    userAgent: userAgent ?? '',
    viewer: await optionalListingActorOf(request),
    nowMs: Date.now(),
  });
  return new NextResponse<null>(null, NO_CONTENT);
}

export const POST = withHighRateLimit(
  withAuth<null, RouteContext>(viewHandler, {
    allowUnauthenticated: true,
    idempotency: {
      mode: 'natural',
      why: 'Το σημάδι «ένας επισκέπτης ανά ημέρα» (create στο listing_view_marks) κάνει τη δεύτερη εκτέλεση no-op',
    },
  }),
);
