/**
 * @fileoverview **Ο ΜΥΣΤΙΚΟΣ ΣΥΝΔΕΣΜΟΣ ΕΞΑΓΩΓΗΣ** — `GET /api/stay-ical/<token>.ics`.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · services/stay-calendar/stay-channel-export.service.ts ·
 *   CHECK 3.78 (δηλωμένο όριο ρυθμού)
 *
 * 🔑 **Ανώνυμη διαδρομή με ΙΚΑΝΟΤΗΤΑ**: κανένα cookie, κανένα header — η υπογραφή
 * **είναι** η εξουσιοδότηση, και ελέγχεται **πριν** από κάθε ανάγνωση βάσης (πλαστός
 * σύνδεσμος = μηδέν κόστος).
 *
 * 🔴 **ΠΟΤΕ ΑΔΕΙΟ `VCALENDAR` ΣΕ ΑΜΦΙΒΟΛΙΑ.** Ένα κενό ημερολόγιο διαβάζεται από το
 * κανάλι ως *«όλες οι νύχτες ελεύθερες»* — δηλαδή είναι **εντολή** overbooking. Ό,τι δεν
 * ξέρουμε φεύγει ως **503**, και το κανάλι κρατά ό,τι είχε.
 *
 * ⚠️ **Ενιαίο 404** για άκυρη υπογραφή, ανακλημένη γενιά, ανύπαρκτο ακίνητο και ακίνητο
 * χωρίς βραχυχρόνια: ο σύνδεσμος δεν αποκαλύπτει **τίποτα** για το τι υπάρχει.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { ownerPropertyOfferKinds } from '@/types/owner-property';
import { STAY_RULES_NONE } from '@/types/stay-rules';
import { nowISO } from '@/lib/date-local';
import {
  readStayCalendar,
  stayPropertyRef,
} from '@/services/stay-calendar/stay-calendar-read.service';
import {
  stayExportBody,
  stayExportClaimOf,
} from '@/services/stay-calendar/stay-channel-export.service';
import { createHash } from 'node:crypto';

type RouteContext = { params: Promise<{ feed: string }> };

/** Πέντε λεπτά ιδιωτικής μνήμης: τα κανάλια δημοσκοπούν ανά 1–3h, δεν χρειάζονται λιγότερο. */
const CACHE = { 'Cache-Control': 'private, max-age=300' } as const;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const notFound = (): NextResponse => new NextResponse(null, { status: 404, headers: NO_STORE });
/** «Δεν ξέρω» ⇒ το κανάλι ξαναρωτά και κρατά ό,τι είχε — ποτέ άδειο ημερολόγιο. */
const unavailable = (): NextResponse => new NextResponse(null, { status: 503, headers: NO_STORE });

function etagOf(body: string): string {
  return `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;
}

async function handler(request: NextRequest, routeContext?: RouteContext): Promise<NextResponse> {
  const params = await routeContext?.params;
  const raw = params?.feed ?? '';
  if (!raw.endsWith('.ics')) return notFound();

  const claim = stayExportClaimOf(raw.slice(0, -'.ics'.length));
  // Λείπει το μυστικό **από εμάς** ⇒ 503 (δικό μας χρέος)· άκυρη υπογραφή ⇒ 404.
  if (!claim.ok) return claim.reason === 'server-config' ? unavailable() : notFound();

  const adminDb = getAdminFirestore();
  const snap = await stayPropertyRef(adminDb, claim.propertyId).get();
  const property = ownerPropertyFromDocument(snap.data(), claim.propertyId);
  if (property === null || !ownerPropertyOfferKinds(property).includes('leaseShort')) return notFound();

  const snapshot = await readStayCalendar(adminDb, claim.propertyId, null);
  if (snapshot.kind === 'unreadable') return unavailable();
  // 🔑 Η **ανάκληση** είναι κατάσταση, όχι λήξη μέσα στο token: παλιά γενιά ⇒ 404.
  const generation = snapshot.channelDoc?.exportGeneration ?? 0;
  if (claim.generation !== generation) return notFound();

  const body = stayExportBody(
    snapshot.entries,
    snapshot.head?.rules ?? STAY_RULES_NONE,
    claim.scope,
    property.title.trim(),
    // 🔑 Ληγμένο αίτημα δεν εξάγεται, με ή χωρίς cron (Στάδιο Δ, §23.1).
    nowISO(),
  );
  const etag = etagOf(body);
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ...CACHE, ETag: etag } });
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...CACHE,
      ETag: etag,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="nestor-stay.ics"',
    },
  });
}

export const GET = withHighRateLimit<RouteContext>(handler);
