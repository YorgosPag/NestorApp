import 'server-only';

/**
 * @fileoverview **ΔΙΟΡΘΩΣΕ ΤΟ ΜΗΝΥΜΑ** — `PATCH /api/network/threads/{threadId}/messages/{messageId}` `{ text }`
 * (ADR-867 Β7 · §4.1 `editedAt`).
 * @related services/network-messaging/thread-messages.ts (`editNetworkMessage`) · message-edit.ts (ο κριτής)
 *
 * 🔑 **Χωρίς όριο χρόνου** (Teams · Slack · Google Chat), **μόνο ο αποστολέας**, με την προηγούμενη μορφή σε
 * αντίγραφο συμμόρφωσης. 🏆 Η απάντηση λέει **αν το είχαν ήδη διαβάσει** (`readBeforeEdit`).
 * ⚠️ `PATCH` στο **ίδιο** μήνυμα (η ανάκληση είναι δικός της πόρος, `…/retraction`: εκείνη είναι γεγονός
 * που **αναφέρεται** στο μήνυμα, XEP-0424· η επεξεργασία **αλλάζει** το σώμα του).
 * ⚠️ Ίδιο κείμενο ⇒ `edited: false`, **όχι** σφάλμα — η επανάληψη ενός αιτήματος είναι ιδεμποτής.
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { editNetworkMessage } from '@/services/network-messaging/thread-messages';
import type { NetworkEditResult } from '@/types/network-wire';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../../_shared/network-door';
import {
  messageRouteParams,
  MessageTextBodySchema,
  readNetworkBody,
  type MessageRouteContext,
} from '../../../../_shared/network-params';

const logger = createModuleLogger('NetworkEditRoute');

type EditResponse = NetworkEditResult;

async function handler(request: NextRequest, actor: NetworkActor, routeContext?: MessageRouteContext) {
  const params = await messageRouteParams(routeContext);
  if (!params.ok) return params.response;
  // 🔑 Το **ίδιο** σχήμα κειμένου με την αποστολή — ίδιο φράγμα, ίδιο όριο στον γραφέα. Κλειδί ιδεμποτησίας
  //    δεν χρειάζεται: η επανάληψη της ίδιας διόρθωσης δίνει `unchanged`.
  const body = await readNetworkBody(request, MessageTextBodySchema);
  if (!body.ok) return body.response;
  const { threadId, messageId } = params.value;

  try {
    const outcome = await editNetworkMessage(getAdminFirestore(), {
      threadId,
      messageId,
      actorUid: actor.uid,
      text: body.value.text,
      nowISO: nowISO(),
    });
    if (outcome.kind === 'refused') return networkRefusal(outcome.reason);
    if (outcome.kind === 'unchanged') return NextResponse.json<EditResponse>({ success: true, edited: false });
    return NextResponse.json<EditResponse>({
      success: true,
      edited: true,
      editedAt: outcome.editedAt,
      readBeforeEdit: outcome.readBeforeEdit,
    });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Η επεξεργασία απέτυχε', error, { threadId, messageId });
  }
}

export const PATCH = withStandardRateLimit(withNetworkDoor<EditResponse, MessageRouteContext>(handler));
