/**
 * @fileoverview **«Πώς θα δει ο αγοραστής την αγγελία μου;»** — η εφήμερη προβολή του ακινήτου του αιτούντος, με τα
 * γεγονότα δημοσίευσης (ADR-898 Φ3β-3). Ιδιώτης **και** γραφείο, από την ΙΔΙΑ διαδρομή.
 * @related `services/listings/owned-listing-projection.ts` (εντοπισμός με θεματοφυλακή · προβολή) ·
 *   `lib/listings/listing-preview-request.ts` (συμβόλαιο) · `app/api/demand/interest/route.ts` (ίδιο σύνορο)
 * @module app/api/listings/preview/route
 *
 * 🔑 **Γιατί διαδρομή και όχι προβολή στον browser**: το έτος κατασκευής (δημόσια εγγραφή / δήλωση κτιρίου) και ο τόπος
 * του γραφείου (κτίριο → έργο) ζουν σε άλλα έγγραφα· τα δένει **μόνο** ο server, με τον ίδιο δέτη που χρησιμοποιεί ο
 * γραφέας. Μια οθόνη που προβάλλει μόνη της θα έλεγε άλλα από τη δημόσια αγγελία.
 *
 * 🔴 **«Δεν υπάρχει» = «δεν είναι δικό σου» = 404** — καμία απογραφή ξένου χαρτοφυλακίου με μαντεψιά ταυτοτήτων.
 * ⛔ **Ιδιωτική απάντηση, ποτέ σε κρυφή μνήμη**: είναι η αγγελία **πριν** τη δημοσίευση.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { actorWorkspace, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readListingPreviewPropertyId, type ListingPreviewResponse } from '@/lib/listings/listing-preview-request';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readOwnedListingPreview } from '@/services/listings/owned-listing-projection';

const logger = createModuleLogger('api/listings/preview');

const PRIVATE = { 'Cache-Control': 'private, no-store' } as const;

async function handler(
  request: NextRequest,
  actor: ApiActor,
): Promise<NextResponse<ListingPreviewResponse | { error: string }>> {
  const propertyId = readListingPreviewPropertyId(request.nextUrl.searchParams);
  if (propertyId === null) return NextResponse.json({ error: 'MISSING_PROPERTY_ID' }, { status: 400 });

  try {
    const listing = await readOwnedListingPreview(getAdminFirestore(), propertyId, actor.ctx.uid, actorWorkspace(actor));
    if (listing === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ listing }, { headers: PRIVATE });
  } catch (error) {
    logger.error('Η προεπισκόπηση της αγγελίας δεν συντέθηκε', {
      data: { propertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'PREVIEW_FAILED' }, { status: 500 });
  }
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth(handler));
