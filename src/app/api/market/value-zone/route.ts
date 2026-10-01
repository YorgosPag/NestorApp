/**
 * @fileoverview `GET /api/market/value-zone?lat=&lng=` — **η ζώνη αντικειμενικής αξίας σε ένα σημείο** που έβαλε ο
 * επισκέπτης (πινέζα ή ακριβής διεύθυνση), για τον δημόσιο υπολογιστή αντικειμενικής αξίας (ADR-898 Φ2).
 * @related `services/market/value-zones.reader.ts` (ο ΕΝΑΣ αναγνώστης) · `lib/market/value-zone-request.ts` (το συμβόλαιο)
 *
 * 🔑 **ΔΗΜΟΣΙΑ, ΧΩΡΙΣ `withAuth`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** (ίδια με το `listing-context`): διαβάζει μόνο ανοιχτά δεδομένα
 * CC-BY (ADR-889 §2.1). Καμία εγγραφή, καμία ταυτότητα.
 *
 * 🔑 **Η ακρίβεια κρίνεται στον browser με τον ΙΔΙΟ κανόνα** (`valueZonePointOf`): γεωκωδικοποίηση «κέντρο πόλης»
 * δεν φτάνει ποτέ εδώ. Ό,τι φτάνει είναι σημείο που ο άνθρωπος **δήλωσε** ως θέση του ακινήτου ⇒ `provenance:
 * 'manual'`. Γι' αυτό ο server δεν δέχεται «ακρίβεια» ως παράμετρο: θα ήταν ισχυρισμός χωρίς απόδειξη.
 *
 * ⚠️ **503, ποτέ `unavailable` με 200**: η σιωπή θα διαβαζόταν ως «δεν υπάρχει ζώνη».
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { readValueZoneRequestPoint, type ValueZoneResponse } from '@/lib/market/value-zone-request';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readValueZoneAt } from '@/services/market/value-zones.reader';

/** 15′ στο CDN· τα αρχεία ζωνών αλλάζουν το πολύ μία φορά τον μήνα (ADR-889 §11). */
const CACHE_CONTROL = 'public, s-maxage=900, stale-while-revalidate=86400';

async function handler(request: NextRequest): Promise<NextResponse<ValueZoneResponse | { error: string }>> {
  const point = readValueZoneRequestPoint(request.nextUrl.searchParams);
  if (point === null) return NextResponse.json({ error: 'INVALID_POINT' }, { status: 400 });

  const verdict = await readValueZoneAt({
    kind: 'known',
    provenance: 'manual',
    point,
    locatedAt: nowISO(),
  });
  if (verdict.kind === 'unavailable') {
    return NextResponse.json({ error: 'VALUE_ZONES_UNAVAILABLE' }, { status: 503, headers: { 'Retry-After': '30' } });
  }
  return NextResponse.json({ verdict }, { headers: { 'Cache-Control': CACHE_CONTROL } });
}

export const GET = withStandardRateLimit(handler);
