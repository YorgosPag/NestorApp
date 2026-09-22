/**
 * @fileoverview **ΤΑ ΚΑΝΑΛΙΑ ΕΝΟΣ ΚΑΤΑΛΥΜΑΤΟΣ** — ανάγνωση (`GET`) και οι τέσσερις
 *   πράξεις (`POST`).
 * @related ADR-835 §22 (Στάδιο Γ) · services/stay-calendar/stay-channel-commands.service.ts ·
 *   lib/stay/stay-channel-command.ts · CHECK 3.78
 *
 * 🔑 **ΜΙΑ διαδρομή, πράξη στο σώμα** — ίδιο ιδίωμα με το `stay-calendar` δίπλα.
 *
 * ⚠️ **`withSensitiveRateLimit`, ΟΧΙ standard**: κάθε `add-feed`/`sync-feed` κάνει
 * **εξωτερικό αίτημα** με το δικό μας δίκτυο. Χαλαρό όριο εδώ σημαίνει ότι ένας
 * λογαριασμός μπορεί να μας κάνει **αντλία** προς ξένους διακομιστές.
 *
 * ⚠️ **`withPersonalOrOrgAuth`**: ο ιδιώτης οικοδεσπότης δεν έχει εταιρεία. Ποιος
 * **διαχειρίζεται** το κρίνει η υπηρεσία με τον έναν κριτή (`mayAdminister`, CHECK 3.56).
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  listingActorOf,
  withPersonalOrOrgAuth,
  type ApiActor,
} from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  stayChannelCommandFrom,
  STAY_CHANNEL_WRITE_STATUS,
  type StayChannelsView,
  type StayChannelWriteResult,
} from '@/lib/stay/stay-channel-command';
import {
  executeStayChannelCommand,
  readStayChannelsView,
} from '@/services/stay-calendar/stay-channel-commands.service';

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type ErrorBody = { readonly error: 'MISSING_ID' | 'ABSENT' | 'MALFORMED'; readonly malformed?: readonly string[] };

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function propertyIdOf(routeContext?: RouteContext): Promise<string> {
  const params = await routeContext?.params;
  return params?.ownerPropertyId?.trim() ?? '';
}

async function getHandler(
  _request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayChannelsView | ErrorBody>> {
  const propertyId = await propertyIdOf(routeContext);
  if (propertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

  const view = await readStayChannelsView(getAdminFirestore(), propertyId, listingActorOf(actor));
  if (view.kind === 'absent') return NextResponse.json({ error: 'ABSENT' }, { status: 404 });
  // 🔑 Το `unreadable` είναι **κατάσταση οθόνης** με 200, όπως στο `stay-calendar`.
  return NextResponse.json(view, { headers: NO_STORE });
}

async function postHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<StayChannelWriteResult | ErrorBody>> {
  const propertyId = await propertyIdOf(routeContext);
  if (propertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

  const parsed = stayChannelCommandFrom(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: 'MALFORMED', malformed: parsed.malformed }, { status: 400 });
  }

  const result = await executeStayChannelCommand(
    getAdminFirestore(), propertyId, parsed.command, listingActorOf(actor),
  );
  return NextResponse.json(result, { status: STAY_CHANNEL_WRITE_STATUS[result.kind], headers: NO_STORE });
}

export const GET = withSensitiveRateLimit(
  withPersonalOrOrgAuth<StayChannelsView | ErrorBody, RouteContext>(getHandler),
);

export const POST = withSensitiveRateLimit(
  withPersonalOrOrgAuth<StayChannelWriteResult | ErrorBody, RouteContext>(postHandler),
);
