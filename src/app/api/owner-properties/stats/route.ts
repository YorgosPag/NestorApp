import 'server-only';

/**
 * @fileoverview `GET /api/owner-properties/stats` — **τα στατιστικά όλου του χαρτοφυλακίου** (ADR-777 §8.72).
 * @related services/listings/listing-stats.service.ts · hooks/owner-property/useOwnerPortfolioStats.ts
 * @module app/api/owner-properties/stats/route
 *
 * 🔑 **ΜΙΑ διαδρομή για κάρτες ΚΑΙ λεπτομέρεια.** Η λίστα ζητά το χαρτοφυλάκιο μία φορά· η σελίδα
 * λεπτομέρειας διαβάζει το **ίδιο** αποτέλεσμα φιλτραρισμένο. Δύο διαδρομές θα ήταν δύο απαντήσεις
 * στο «πόσες προβολές έχω;» — ελεύθερες να αποκλίνουν ανάμεσα σε δύο οθόνες του ίδιου ανθρώπου.
 *
 * 🔒 **Κανένα `propertyId` από το σύρμα**: ο διακομιστής βρίσκει μόνος του **ποια** ακίνητα
 * διαχειρίζεσαι (`mayAdminister`, CHECK 3.56). Ξένη ταυτότητα δεν μπορεί καν να ζητηθεί ⇒ κανένα
 * μαντείο «υπάρχει αυτό το ακίνητο;».
 *
 * ⚠️ `withPersonalOrOrgAuth` — ο κάτοχος είναι, κατά την Α14, τυπικά **ιδιώτης χωρίς εταιρεία**.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { listingActorOf, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { OwnerPortfolioStats } from '@/lib/listings/listing-stats';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readOwnerPortfolioStats } from '@/services/listings/listing-stats.service';

type StatsError = { readonly error: 'UNAVAILABLE' };

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

async function handler(
  _request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<OwnerPortfolioStats | StatsError>> {
  const stats = await readOwnerPortfolioStats(getAdminFirestore(), listingActorOf(actor), Date.now());
  // 🔴 «Δεν μάθαμε» ⇒ 503, ΠΟΤΕ άδειο χαρτοφυλάκιο (N.12): η οθόνη λέει «δεν φορτώθηκαν», όχι «0».
  if (stats === null) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503, headers: NO_STORE });
  return NextResponse.json(stats, { headers: NO_STORE });
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<OwnerPortfolioStats | StatsError>(handler));
