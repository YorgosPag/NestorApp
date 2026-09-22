/**
 * @fileoverview **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΑΤΑΛΥΜΑΤΟΣ** — ανάγνωση (`GET`) και οι πράξεις του οικοδεσπότη (`POST`).
 * @related ADR-835 §20 (Στάδιο Α) · §23 (Στάδιο Δ: `accept` · `decline`) · services/stay-calendar/* ·
 *   lib/stay/stay-calendar-command.ts · lib/stay/stay-command-authority.ts
 *
 * 🔑 **ΜΙΑ διαδρομή, πράξη στο σώμα** — ίδιο ιδίωμα με το `PATCH /api/owner-properties/[id]`
 * (CHECK 3.78: παραλλαγή σώματος, όχι νέα διαδρομή ανά πράξη).
 *
 * ⚠️ **`withPersonalOrOrgAuth`**, όχι `withAuth`: ο ιδιώτης οικοδεσπότης δεν έχει εταιρεία.
 * Ποιος **διαχειρίζεται** το κρίνει η υπηρεσία με τον έναν κριτή (`mayAdminister`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  listingActorOf,
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { stayCalendarCommandFrom } from '@/lib/stay/stay-calendar-command';
import type { StayCalendarView } from '@/lib/stay/stay-calendar-view';
import { readStayCalendarView } from '@/services/stay-calendar/stay-calendar-read.service';
import { executeStayCalendarCommand } from '@/services/stay-calendar/stay-calendar-write.service';
import {
  STAY_CALENDAR_WRITE_STATUS,
  type StayCalendarWriteResult,
} from '@/services/stay-calendar/stay-calendar-write-result';

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type ErrorBody = { readonly error: 'MISSING_ID' | 'ABSENT' | 'MALFORMED'; readonly malformed?: readonly string[] };

/** Ανώτατο παράθυρο ανάγνωσης — 18 μήνες. Η οθόνη ζητά 2–3 μήνες τη φορά. */
const MAX_WINDOW_DAYS = 550;

async function propertyIdOf(routeContext?: RouteContext): Promise<string> {
  const params = await routeContext?.params;
  return params?.ownerPropertyId?.trim() ?? '';
}

function malformed(fields: readonly string[]): NextResponse<ErrorBody> {
  return NextResponse.json({ error: 'MALFORMED', malformed: fields }, { status: 400 });
}

async function getHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayCalendarView | ErrorBody>> {
  const propertyId = await propertyIdOf(routeContext);
  if (propertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const span = isDateKey(from) && isDateKey(to) ? daysBetweenDateKeys(from, to) : null;
  if (from === null || to === null || span === null || span < 1 || span > MAX_WINDOW_DAYS) {
    return malformed(['from', 'to']);
  }

  const view = await readStayCalendarView(getAdminFirestore(), propertyId, listingActorOf(actor), { from, to });
  if (view.kind === 'absent') return NextResponse.json({ error: 'ABSENT' }, { status: 404 });
  // 🔑 Το `unreadable` είναι **κατάσταση οθόνης** με 200 — δες `StayCalendarView`.
  return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } });
}

async function postHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayCalendarWriteResult | ErrorBody>> {
  const propertyId = await propertyIdOf(routeContext);
  if (propertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

  const parsed = stayCalendarCommandFrom(await request.json().catch(() => null));
  if (!parsed.ok) return malformed(parsed.malformed);

  // 🔑 Εδώ ενεργεί **πάντα** ο οικοδεσπότης: πράξη επισκέπτη ή συστήματος σε αυτή την πόρτα ⇒ ο
  //    πίνακας εξουσίας την αρνείται ως `absent` (ADR-835 §23.4) — ποτέ σιωπηλή εκτέλεση.
  const result = await executeStayCalendarCommand(
    getAdminFirestore(), propertyId, parsed.command, { kind: 'host', actor: listingActorOf(actor) },
  );
  return NextResponse.json(result, { status: STAY_CALENDAR_WRITE_STATUS[result.kind] });
}

export const GET = withStandardRateLimit(
  withPersonalOrOrgAuth<StayCalendarView | ErrorBody, RouteContext>(getHandler),
);

export const POST = withStandardRateLimit(
  withPersonalOrOrgAuth<StayCalendarWriteResult | ErrorBody, RouteContext>(postHandler),
);
