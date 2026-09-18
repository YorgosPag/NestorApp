import 'server-only';

/**
 * @fileoverview **ΣΤΕΙΛΕ** — `POST /api/network/threads/{threadId}/messages` (ADR-867 Β5).
 * @related services/network-messaging/thread-messages.ts (`sendNetworkMessage`) · `_shared/network-door.ts`
 *
 * 🔑 **ΠΟΡΤΑ, ΟΧΙ ΛΟΓΙΚΗ**: το «μπορεί να γράψει;» το απαντά ο γραφέας **μέσα** στη συναλλαγή
 * (ζωντανή γραμμή ακροατηρίου, ανοιχτό νήμα, μήκος). Εδώ μόνο σχήμα εισόδου και μετάφραση.
 * ⚠️ Ο αποστολέας είναι **πάντα** ο συνδεδεμένος (`actor.uid`) — δεν υπάρχει πεδίο «από» στο σώμα.
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { sendNetworkMessage } from '@/services/network-messaging/thread-messages';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../_shared/network-door';
import { SendMessageBodySchema, threadInput } from '../../../_shared/network-params';

const logger = createModuleLogger('NetworkSendRoute');

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };
type SendResponse = { readonly success: true; readonly messageId: string };

async function handler(request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) {
  const input = await threadInput(request, routeContext, SendMessageBodySchema);
  if (!input.ok) return input.response;
  const { threadId, body } = input.value;

  try {
    const outcome = await sendNetworkMessage(getAdminFirestore(), {
      threadId,
      senderUid: actor.uid,
      text: body.text,
      nowISO: nowISO(),
    });
    if (outcome.kind === 'refused') return networkRefusal(outcome.reason);
    return NextResponse.json<SendResponse>({ success: true, messageId: outcome.messageId }, { status: 201 });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η αποστολή απέτυχε', error, { threadId, uid: actor.uid });
  }
}

export const POST = withStandardRateLimit(withNetworkDoor<SendResponse, ThreadRoute>(handler));
