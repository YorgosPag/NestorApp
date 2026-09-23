import 'server-only';

/**
 * @fileoverview `PUT` / `DELETE /api/saved-listings/[listingId]` — **κράτα · άφησε** μια αγγελία (ADR-777 §8.74).
 * @related services/listings/saved-listing.service.ts · hooks/listings/useSavedListings.ts
 * @module app/api/saved-listings/[listingId]/route
 *
 * 🔑 **Δύο ρήματα HTTP, όχι ένα «toggle»**: το `PUT` λέει *«να είναι κρατημένη»*, το `DELETE` *«να μην
 * είναι»*. Ένα toggle που ξαναστέλνεται από τον `apiClient` (δίκτυο/`5xx`) θα **αναιρούσε** την πράξη·
 * εδώ η επανάληψη καταλήγει στην **ίδια** κατάσταση — ιδεμποτία από τη σημασία, όχι από κλειδί.
 *
 * ⚠️ `withPersonalOrOrgAuth` — ο επισκέπτης που ψάχνει σπίτι είναι, τυπικά, **ιδιώτης χωρίς εταιρεία**.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { listingActorOf, withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { saveListing, unsaveListing } from '@/services/listings/saved-listing.service';
import type { SaveRefusal, SaveToggleResponse } from '@/types/saved-listing';

type RouteContext = { params: Promise<{ listingId: string }> };

type SaveError = { readonly error: 'MISSING_ID' | 'UNAVAILABLE' } | { readonly error: 'REFUSED'; readonly reason: SaveRefusal };

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

type SaveResponse = NextResponse<SaveToggleResponse | SaveError>;

/** Το id της αγγελίας από το τμήμα διαδρομής — κενό ⇒ `400`, αλλιώς η πράξη. Ένα σημείο για τα δύο ρήματα. */
async function withListingId(routeContext: RouteContext | undefined, act: (listingId: string) => Promise<SaveResponse>): Promise<SaveResponse> {
  const listingId = (await routeContext?.params)?.listingId?.trim() ?? '';
  if (listingId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400, headers: NO_STORE });
  return act(listingId);
}

function putHandler(_request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<SaveResponse> {
  return withListingId(routeContext, async (listingId) => {
    const outcome = await saveListing(getAdminFirestore(), listingActorOf(actor), listingId, Date.now());
    if (outcome === 'saved') return NextResponse.json({ saved: true }, { headers: NO_STORE });
    if (outcome === 'unavailable') return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ error: 'REFUSED', reason: outcome }, { status: 409, headers: NO_STORE });
  });
}

function deleteHandler(_request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<SaveResponse> {
  return withListingId(routeContext, async (listingId) => {
    try {
      await unsaveListing(getAdminFirestore(), actor.ctx.uid, listingId);
      return NextResponse.json({ saved: false }, { headers: NO_STORE });
    } catch {
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503, headers: NO_STORE });
    }
  });
}

export const PUT = withStandardRateLimit(
  withPersonalOrOrgAuth<SaveToggleResponse | SaveError, RouteContext>(putHandler, {
    idempotency: {
      mode: 'natural',
      why: 'Ντετερμινιστική ταυτότητα (άνθρωπος, αγγελία) + create(): η επανάληψη βρίσκει το ίδιο έγγραφο και απαντά «κρατημένη»',
    },
  }),
);

export const DELETE = withStandardRateLimit(
  withPersonalOrOrgAuth<SaveToggleResponse | SaveError, RouteContext>(deleteHandler, {
    idempotency: {
      mode: 'natural',
      why: 'Διαγραφή ντετερμινιστικού εγγράφου: η επανάληψη σβήνει κάτι που δεν υπάρχει ήδη ⇒ ίδια κατάσταση «μη κρατημένη»',
    },
  }),
);
