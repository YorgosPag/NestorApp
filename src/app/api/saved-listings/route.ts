import 'server-only';

/**
 * @fileoverview `GET /api/saved-listings` — **οι αγγελίες που κράτησα** (ADR-777 §8.74).
 * @related services/listings/saved-listing.service.ts · hooks/listings/useSavedListings.ts
 * @module app/api/saved-listings/route
 *
 * 🔑 **ΜΙΑ διαδρομή για τη σελίδα «Αποθηκευμένα» ΚΑΙ για τις καρδιές** της αναζήτησης: οι κάρτες
 * ρωτούν το **ίδιο** αποτέλεσμα (ποιες ταυτότητες είναι κρατημένες). Δύο διαδρομές θα ήταν δύο
 * απαντήσεις στο «την έχω κρατήσει;», ελεύθερες να αποκλίνουν ανάμεσα σε δύο οθόνες.
 *
 * 🔒 Κανένα `uid` από το σύρμα: η λίστα είναι **πάντα** του δρώντος.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readSavedListingRows } from '@/services/listings/saved-listing.service';
import type { SavedListingsResponse } from '@/types/saved-listing';

type SavedListingsError = { readonly error: 'UNAVAILABLE' };

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

async function handler(
  _request: NextRequest, actor: ApiActor,
): Promise<NextResponse<SavedListingsResponse | SavedListingsError>> {
  try {
    const { rows, truncated } = await readSavedListingRows(getAdminFirestore(), actor.ctx.uid);
    return NextResponse.json({ rows, truncated }, { headers: NO_STORE });
  } catch {
    // 🔴 «Δεν μάθαμε» ⇒ 503, ΠΟΤΕ άδεια λίστα (N.12): η οθόνη λέει «δεν φορτώθηκαν», όχι «καμία».
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503, headers: NO_STORE });
  }
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<SavedListingsResponse | SavedListingsError>(handler));
