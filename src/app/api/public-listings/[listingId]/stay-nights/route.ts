/**
 * @fileoverview **ΤΟ ΔΗΜΟΣΙΟ ΗΜΕΡΟΛΟΓΙΟ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ανά νύχτα, χωρίς ποιος ή γιατί (ADR-835 §4.5 · §21).
 * @related services/stay-calendar/stay-calendar-public.service.ts · lib/stay/stay-nights-view.ts
 * @module app/api/public-listings/[listingId]/stay-nights/route
 *
 * `GET /api/public-listings/{id}/stay-nights?from=YYYY-MM&months=1..3`
 *
 * 🔑 **Ανώνυμο, όπως η σελίδα της αγγελίας.** Φεύγει μόνο `state · checkInAllowed ·
 * checkOutAllowed · minNights · maxNights` ανά νύχτα — το ελάχιστο που **όλη** η αγορά ήδη
 * δημοσιεύει (Airbnb PDP calendar).
 *
 * ⚠️ **Ίδιο 404** για «δεν υπάρχει» και «δεν είναι κατάλυμα»: η διαδρομή δεν επιβεβαιώνει
 * ύπαρξη αγγελιών που δεν δέχονται κρατήσεις.
 *
 * ⏱️ **Cache σύντομο (60″ + 5′ stale-while-revalidate)**: η απάντηση είναι ένδειξη — η
 * κράτηση κρίνεται ξανά μέσα στη συναλλαγή — και ένα δημοφιλές κατάλυμα δεν πρέπει να
 * ξαναδιαβάζει όλο το ημερολόγιο σε κάθε ανανέωση σελίδας.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import type { StayPublicNights } from '@/lib/stay/stay-nights-view';
import { isPublicListingId, stayNightsRequestFrom } from '@/lib/stay/stay-public-request';
import { readPublicStayNights } from '@/services/stay-calendar/stay-calendar-public.service';

interface StayNightsSegment {
  readonly params: Promise<{ readonly listingId: string }>;
}

type StayNightsError =
  | { readonly error: 'NOT_FOUND' }
  | { readonly error: 'MALFORMED'; readonly malformed: readonly string[] };

const PUBLIC_CACHE = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } as const;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function stayNightsHandler(
  request: NextRequest,
  segment?: StayNightsSegment,
): Promise<NextResponse<StayPublicNights | StayNightsError>> {
  const listingId = segment === undefined ? '' : (await segment.params).listingId;
  if (!isPublicListingId(listingId)) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
  }

  const params = request.nextUrl.searchParams;
  const parsed = stayNightsRequestFrom(params.get('from'), params.get('months'));
  if (!parsed.ok) {
    return NextResponse.json({ error: 'MALFORMED', malformed: parsed.malformed }, { status: 400, headers: NO_STORE });
  }

  const nights = await readPublicStayNights(
    getAdminFirestore(), listingId, parsed.value.fromMonth, parsed.value.months, new Date(),
  );
  if (nights === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
  return NextResponse.json(nights, { headers: PUBLIC_CACHE });
}

export const GET = withHighRateLimit<StayNightsSegment>(stayNightsHandler);
