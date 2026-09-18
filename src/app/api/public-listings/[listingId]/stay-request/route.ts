/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΚΡΑΤΗΣΗΣ ΤΟΥ ΕΠΙΣΚΕΠΤΗ** — τα αιτήματά μου (`GET`) και οι πράξεις μου (`POST`).
 * @related ADR-835 §23 (Στάδιο Δ) · services/stay-calendar/stay-calendar-write.service.ts ·
 *   lib/stay/stay-command-authority.ts · lib/stay/stay-calendar-command.ts
 *
 * 🔑 **ΜΙΑ διαδρομή, πράξη στο σώμα** (CHECK 3.78) — `request` · `withdraw`, από τον **ΙΔΙΟ** αναλυτή
 * και τον **ΙΔΙΟ** γραφέα με τον οικοδεσπότη. Πράξη οικοδεσπότη σε αυτή την πόρτα (π.χ. `accept`) ⇒ ο
 * πίνακας εξουσίας την αρνείται ως `absent`: ο επισκέπτης **δεν μπορεί** να δεχτεί το δικό του αίτημα.
 *
 * ⚠️ **`withPersonalOrOrgAuth`**: ο επισκέπτης είναι **άνθρωπος**, όχι εταιρεία — και ταξιδεύει και
 * ο υπάλληλος γραφείου. Ποιος είναι ο επισκέπτης το λέει **μόνο** το `uid` της ταυτότητας.
 *
 * ⚠️ **`STANDARD`** όριο ρυθμού (όπως η πόρτα του οικοδεσπότη): η κατάχρηση «κλειδώνω όλο το καλοκαίρι»
 * **δεν** φράζεται εδώ — φράζεται από την κεφαλή του επισκέπτη (3 ζωντανά αιτήματα), δομικά.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { stayCalendarCommandFrom } from '@/lib/stay/stay-calendar-command';
import type { StayGuestRequests } from '@/lib/stay/stay-guest-request-view';
import { isPublicListingId } from '@/lib/stay/stay-public-request';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { readGuestStayRequests } from '@/services/stay-calendar/stay-guest-requests.service';
import { executeStayCalendarCommand } from '@/services/stay-calendar/stay-calendar-write.service';
import {
  STAY_CALENDAR_WRITE_STATUS,
  type StayCalendarWriteResult,
} from '@/services/stay-calendar/stay-calendar-write-result';

type RouteContext = { params: Promise<{ listingId: string }> };

type ErrorBody = { readonly error: 'NOT_FOUND' | 'MALFORMED'; readonly malformed?: readonly string[] };

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function listingIdOf(routeContext?: RouteContext): Promise<string | null> {
  const listingId = (await routeContext?.params)?.listingId ?? '';
  return isPublicListingId(listingId) ? listingId : null;
}

async function getHandler(
  _request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayGuestRequests | ErrorBody>> {
  const listingId = await listingIdOf(routeContext);
  if (listingId === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
  const requests = await readGuestStayRequests(getAdminFirestore(), listingId, actor.ctx.uid, nowISO());
  return NextResponse.json(requests, { headers: NO_STORE });
}

async function postHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayCalendarWriteResult | ErrorBody>> {
  const listingId = await listingIdOf(routeContext);
  if (listingId === null) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });

  const parsed = stayCalendarCommandFrom(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: 'MALFORMED', malformed: parsed.malformed }, { status: 400 });

  // 🔑 Το όνομα είναι **στιγμιότυπο** για τον οικοδεσπότη — ⛔ ΠΟΤΕ εφεδρεία το email (`null`): θα
  //    έστελνε στον οικοδεσπότη διεύθυνση που ο επισκέπτης δεν του έδωσε.
  const displayName = await resolveUserDisplayName(actor.ctx.uid, null);
  // 🔑 Η ταυτότητα της δημόσιας αγγελίας **είναι** η ταυτότητα του ακινήτου (ADR-777 Α3).
  const result = await executeStayCalendarCommand(getAdminFirestore(), listingId, parsed.command, {
    kind: 'guest', uid: actor.ctx.uid, displayName,
  });
  return NextResponse.json(result, { status: STAY_CALENDAR_WRITE_STATUS[result.kind], headers: NO_STORE });
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<StayGuestRequests | ErrorBody, RouteContext>(getHandler),
);

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<StayCalendarWriteResult | ErrorBody, RouteContext>(postHandler),
);
