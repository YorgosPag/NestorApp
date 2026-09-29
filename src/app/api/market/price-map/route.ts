/**
 * @fileoverview `GET /api/market/price-map` — **ο χάρτης ΖΗΤΟΥΜΕΝΩΝ τιμών €/τ.μ. της τελευταίας νύχτας**, για τη
 * στρώση τιμών του χάρτη αναζήτησης (ADR-890 §14.4 · πηγή Α).
 * @related `services/market/area-market-snapshot.reader.ts` (`readLatestAreaMarketMap`) · `lib/market/price-map.ts`
 *
 * 🔑 **ΔΗΜΟΣΙΑ, ΧΩΡΙΣ `withAuth`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: σερβίρει μόνο δημοσιεύσιμα συγκεντρωτικά (`[n, διάμεσος]`,
 * κατώφλι 5) από δημοσιευμένες αγγελίες — κανένα στοιχείο μισθωτή, καμία αγγελία, καμία εγγραφή.
 *
 * 🔑 **Γιατί endpoint και όχι ανάγνωση πελάτη**: η συλλογή είναι `read: false` (ελάχιστο προνόμιο), και με CDN 15′
 * η Firestore πληρώνει **2 αναγνώσεις ανά αστοχία cache** (σημάδι + χάρτης), όχι ανά επισκέπτη.
 * (Οι τιμές συμβολαίων — πηγή Β — είναι στατικό αρχείο: `public/data/market-transactions/price-map.json`.)
 *
 * ⚠️ **503, ποτέ «καμία περιοχή»**, όταν η ανάγνωση αποτύχει: η σιωπή θα διαβαζόταν ως «λίγα δεδομένα παντού».
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { marketDayOf } from '@/lib/listings/listing-stats';
import type { AskingPriceMapResponse } from '@/lib/market/price-map';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readLatestAreaMarketMap } from '@/services/market/area-market-snapshot.reader';

const logger = createModuleLogger('api-market-price-map');

/** 15′ στο CDN (ίδιο με τη σελίδα περιοχής): ο χάρτης αλλάζει μία φορά τη νύχτα. */
const CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=86400';

async function handler(_request: NextRequest): Promise<NextResponse<AskingPriceMapResponse | { error: string }>> {
  try {
    // Το ρολόι διαβάζεται στο σύνορο: ημέρα αγοράς Αθήνας.
    const map = await readLatestAreaMarketMap(getAdminFirestore(), marketDayOf(Date.now()));
    const body: AskingPriceMapResponse = map === null ? { kind: 'none' } : { kind: 'ready', day: map.day, offers: map.offers };
    return NextResponse.json(body, { headers: { 'Cache-Control': CACHE_CONTROL } });
  } catch (error) {
    logger.error('Ο χάρτης ζητούμενων τιμών δεν διαβάστηκε', { error: getErrorMessage(error) });
    return NextResponse.json({ error: 'MARKET_DATA_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '30' } });
  }
}

export const GET = withStandardRateLimit(handler);
