import 'server-only';

/**
 * @fileoverview **ΠΑΡΕ ΠΙΣΩ ΤΟ ΜΗΝΥΜΑ** — `POST /api/network/threads/{threadId}/messages/{messageId}/retraction`
 * (ADR-867 Β4β · Β5).
 * @related services/network-messaging/thread-messages.ts (`retractNetworkMessage`) · XMPP XEP-0424
 *
 * 🔑 **Η ανάκληση είναι ΓΕΓΟΝΟΣ που αναφέρεται στο μήνυμα** (XEP-0424), γι' αυτό είναι **δικός της
 * πόρος** (`…/retraction`) και όχι `DELETE` στο μήνυμα: το μήνυμα **δεν** σβήνεται — μένει
 * ταφόπλακα, και το κείμενο πάει στο αντίγραφο συμμόρφωσης. Ένα `DELETE` θα υποσχόταν κάτι που
 * το σύστημα επίτηδες **δεν** κάνει.
 *
 * 🏆 Η απάντηση λέει **«το πρόλαβε κάποιος;»** (`readBeforeRetraction`) — το κενό του WhatsApp.
 * ⚠️ Μόνο ο **αποστολέας**, μέσα σε **60′** — τα κρίνει ο γραφέας (`judgeRetraction`).
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { retractNetworkMessage } from '@/services/network-messaging/thread-messages';
import type { NetworkRetractionResult } from '@/types/network-wire';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../../../_shared/network-door';
import { messageRouteParams, type MessageRouteContext } from '../../../../../_shared/network-params';

const logger = createModuleLogger('NetworkRetractionRoute');

type MessageRoute = MessageRouteContext;
type RetractionResponse = NetworkRetractionResult;

async function handler(_request: NextRequest, actor: NetworkActor, routeContext?: MessageRoute) {
  const params = await messageRouteParams(routeContext);
  if (!params.ok) return params.response;
  const { threadId, messageId } = params.value;

  try {
    const outcome = await retractNetworkMessage(getAdminFirestore(), {
      threadId,
      messageId,
      actorUid: actor.uid,
      nowISO: nowISO(),
    });
    if (outcome.kind === 'refused') return networkRefusal(outcome.reason);
    return NextResponse.json<RetractionResponse>({
      success: true,
      readBeforeRetraction: outcome.readBeforeRetraction,
    });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η ανάκληση απέτυχε', error, { threadId, messageId });
  }
}

export const POST = withStandardRateLimit(withNetworkDoor<RetractionResponse, MessageRoute>(handler));
