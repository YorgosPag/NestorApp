import 'server-only';

/**
 * @fileoverview **ΣΙΓΑΣΗ** — `PUT /api/network/threads/{threadId}/mute` `{ muted }` (ADR-867 Β5).
 * @related services/network-messaging/thread-messages.ts (`setNetworkThreadMuted`) · ADR-834 (α) ②
 *
 * 🔑 **Μονομερής, χωρίς ειδοποίηση του άλλου** (α) ②: το νήμα μένει ανοιχτό και τα μηνύματα
 * φτάνουν — απλώς δεν χτυπά το καμπανάκι (Β6). **Δεν** είναι φραγή (Β8).
 * ⚠️ `PUT` με **τελική κατάσταση**, όχι «εναλλαγή»: δύο διπλά κλικ δεν πρέπει να ακυρώνουν το ένα
 * το άλλο (ιδεμποτησία, N.7.2 #3).
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { setNetworkThreadMuted } from '@/services/network-messaging/thread-messages';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../_shared/network-door';
import { MuteBodySchema, threadInput } from '../../../_shared/network-params';

const logger = createModuleLogger('NetworkMuteRoute');

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };
type MuteResponse = { readonly success: true; readonly muted: boolean };

async function handler(request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) {
  const input = await threadInput(request, routeContext, MuteBodySchema);
  if (!input.ok) return input.response;
  const { threadId, body } = input.value;

  try {
    const outcome = await setNetworkThreadMuted(getAdminFirestore(), threadId, actor.uid, body.muted);
    if (outcome === 'not-audience') return networkRefusal('not-audience');
    return NextResponse.json<MuteResponse>({ success: true, muted: body.muted });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η σίγαση απέτυχε', error, { threadId });
  }
}

export const PUT = withStandardRateLimit(withNetworkDoor<MuteResponse, ThreadRoute>(handler));
