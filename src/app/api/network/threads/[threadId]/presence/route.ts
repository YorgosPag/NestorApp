import 'server-only';

/**
 * @fileoverview **ΠΟΙΟΣ ΛΕΙΠΕΙ, ΠΟΙΟΣ ΔΙΑΒΑΖΕΙ** — `GET /api/network/threads/{threadId}/presence` (ADR-867 Β5).
 * @related services/network-messaging/network-away.ts (`readThreadPresence`) · ADR-834 §5 Β (ε) 🏆
 *
 * 🏆 Η λωρίδα «ο Κώστας απουσιάζει ως 24/9 — διαβάζει η Ελένη» **πριν** πατήσει «στείλε» ο
 * αποστολέας. Intercom κάνει μόνο ανάθεση, HubSpot τίποτα, Outlook στέλνει κείμενο **μετά**.
 * 🔑 **Μόνο** για όποιον διαβάζει **ήδη** το νήμα — ξένο και ανύπαρκτο ⇒ ίδιο 404 (ADR-742).
 *
 * Ρυθμός: **HIGH** — ανάγνωση που ανανεώνει η ανοιχτή οθόνη (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readThreadPresence, type ThreadPresence } from '@/services/network-messaging/network-away';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../_shared/network-door';
import { requireRouteParam } from '../../../_shared/network-params';

const logger = createModuleLogger('NetworkPresenceRoute');

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };
type PresenceResponse = { readonly success: true } & ThreadPresence;

async function handler(_request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) {
  const thread = await requireRouteParam(routeContext, 'threadId');
  if (!thread.ok) return thread.response;
  const threadId = thread.value;

  try {
    const outcome = await readThreadPresence(getAdminFirestore(), threadId, actor.uid, nowISO());
    if (outcome.kind === 'not-audience') return networkRefusal('not-audience');
    return NextResponse.json<PresenceResponse>({ success: true, ...outcome.presence });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η παρουσία νήματος απέτυχε', error, { threadId });
  }
}

export const GET = withHighRateLimit(withNetworkDoor<PresenceResponse, ThreadRoute>(handler));
