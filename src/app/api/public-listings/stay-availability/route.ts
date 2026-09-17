/**
 * @fileoverview **ΕΙΝΑΙ ΕΛΕΥΘΕΡΑ ΣΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΜΟΥ;** — απαντήσεις της μηχανής για πολλές αγγελίες (ADR-835 §18.1 · §21).
 * @related services/stay-calendar/stay-calendar-public.service.ts · lib/stay/stay-availability.ts ·
 *   hooks/listings/useStayAnswers.ts
 * @module app/api/public-listings/stay-availability/route
 *
 * `POST /api/public-listings/stay-availability` · σώμα `{ listingIds, checkIn, checkOut, guests }`
 *
 * 🔑 **Η αναζήτηση παίρνει ΠΡΑΓΜΑΤΙΚΟ ημερολόγιο** — το §18.1 έκλεισε: ο κριτής τρέχει εδώ,
 * και φεύγει μόνο η **ονομασμένη απάντηση** (+ τιμολόγηση), ποτέ εγγραφές.
 *
 * ⚠️ **POST, όχι GET**, επειδή κουβαλά έως 60 ταυτότητες· **`no-store`**, επειδή είναι
 * εξατομικευμένο στις ημερομηνίες και ένα κοινό cache θα έδινε μπαγιάτικη απάντηση σε άλλον.
 * ⚠️ Ο διακομιστής διαβάζει **δική του** προβολή κάθε αγγελίας — ποτέ ό,τι στείλει ο πελάτης.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { stayAnswersRequestFrom, type PublicStayAnswer } from '@/lib/stay/stay-public-request';
import { readPublicStayAnswers } from '@/services/stay-calendar/stay-calendar-public.service';

type StayAnswersBody = { readonly answers: Readonly<Record<string, PublicStayAnswer>> };
type StayAnswersError = { readonly error: 'MALFORMED'; readonly malformed: readonly string[] };

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function stayAvailabilityHandler(
  request: NextRequest,
): Promise<NextResponse<StayAnswersBody | StayAnswersError>> {
  const parsed = stayAnswersRequestFrom(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: 'MALFORMED', malformed: parsed.malformed }, { status: 400, headers: NO_STORE });
  }
  const answers = await readPublicStayAnswers(
    getAdminFirestore(), parsed.value.listingIds, parsed.value.query, new Date(),
  );
  return NextResponse.json({ answers }, { headers: NO_STORE });
}

export const POST = withStandardRateLimit(stayAvailabilityHandler);
