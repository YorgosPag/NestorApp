/**
 * @fileoverview `GET /api/market/listing-context/[listingId]` — **τιμές συμβολαίων για μία δημόσια αγγελία**:
 * διάμεσος της περιοχής, τιμή ζώνης, εκατοστημόριο της ζητούμενης, συγκρίσιμες πωλήσεις (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `services/market/listing-market-context.service.ts` · `lib/market/listing-market-context.ts` (το συμβόλαιο)
 *
 * 🔑 **ΔΗΜΟΣΙΑ, ΧΩΡΙΣ `withAuth`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: διαβάζει μόνο ό,τι είναι ήδη δημόσιο — τη δημοσιευμένη
 * προβολή της αγγελίας (`public_listings`, `read: if true`) και ανοιχτά δεδομένα CC-BY (ADR-889 §2.1). Καμία
 * εγγραφή, κανένα στοιχείο μισθωτή.
 *
 * 🔑 **Γιατί server και όχι αρχείο στον browser**: οι συγκρίσιμες θέλουν τις γραμμές της περιοχής (Αθήνα 2,2 MB)·
 * εδώ φτάνουν στον browser οκτώ.
 *
 * ⚠️ **503, ποτέ «κανένα συμβόλαιο»**, όταν δεν διαβάστηκαν τα αρχεία: η σιωπή θα διαβαζόταν ως γεγονός.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { marketDayOf } from '@/lib/listings/listing-stats';
import type { ListingMarketContext } from '@/lib/market/listing-market-context';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readPublicListingById } from '@/services/listings/public-listing-by-id.reader';
import { loadListingMarketContext } from '@/services/market/listing-market-context.service';

type RouteContext = { params: Promise<{ listingId: string }> };

/**
 * 15′ στο CDN, όσο και η σελίδα περιοχής (ISR): τα αρχεία αλλάζουν μία φορά τον μήνα, η τιμή της αγγελίας σπάνια.
 * Το `stale-while-revalidate` κρατά τη σελίδα γρήγορη όταν λήξει.
 */
const CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=86400';

async function handler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<ListingMarketContext | { error: string }>> {
  // ⚠️ Next 15: το `params` είναι **Promise**.
  const listingId = (await context?.params)?.listingId ?? '';
  if (listingId.trim() === '') return NextResponse.json({ error: 'MISSING_LISTING_ID' }, { status: 400 });

  const adminDb = getAdminFirestore();
  const listing = await readPublicListingById(adminDb, listingId);
  if (listing === null) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 404 });

  // Το ρολόι διαβάζεται στο σύνορο (ίδιο ιδίωμα με τη σελίδα περιοχής): ημέρα αγοράς Αθήνας.
  const body = await loadListingMarketContext(listing, adminDb, marketDayOf(Date.now()));
  if (body === null) {
    return NextResponse.json({ error: 'MARKET_DATA_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '30' } });
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': CACHE_CONTROL } });
}

export const GET = withStandardRateLimit<RouteContext>(handler);
