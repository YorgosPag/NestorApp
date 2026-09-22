import 'server-only';

/**
 * @fileoverview **ΤΟ ΕΙΔΑ** — `POST /api/network/threads/{threadId}/read` (ADR-867 Β5).
 * @related services/network-messaging/thread-messages.ts (`markNetworkThreadRead`) · §8 #4
 *
 * 🔑 Η ώρα ανάγνωσης είναι η ώρα του **διακομιστή**, ποτέ του πελάτη: ένα ρολόι πελάτη μπροστά
 * κατά δέκα λεπτά θα «διάβαζε» μηνύματα που δεν έχουν φτάσει ακόμη.
 * ⚠️ **Καμία ένδειξη ανά μήνυμα** (§8 #4) — μόνο `lastReadAt` ανά μέλος.
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { markNetworkThreadRead } from '@/services/network-messaging/thread-messages';
import type { NetworkReadResult } from '@/types/network-wire';

import {
  networkRefusal,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../../../_shared/network-door';
import { requireRouteParam } from '../../../_shared/network-params';

const logger = createModuleLogger('NetworkReadRoute');

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };
type ReadResponse = NetworkReadResult;

async function handler(_request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) {
  const thread = await requireRouteParam(routeContext, 'threadId');
  if (!thread.ok) return thread.response;
  const threadId = thread.value;

  const at = nowISO();
  try {
    const outcome = await markNetworkThreadRead(getAdminFirestore(), threadId, actor.uid, at);
    if (outcome === 'not-audience') return networkRefusal('not-audience');
    return NextResponse.json<ReadResponse>({ success: true, lastReadAt: at });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Το «το είδα» απέτυχε', error, { threadId });
  }
}

// 🔑 ADR-853 Ε3 — ιδεμποτικό εκ κατασκευής, και τρέχει σε ΚΑΘΕ άνοιγμα νήματος: η αποθήκη θα ήταν κόστος.
export const POST = withStandardRateLimit(withNetworkDoor<ReadResponse, ThreadRoute>(handler, {
  idempotency: { mode: 'natural', why: '«διάβασα ως τώρα» — η επανάληψη μετακινεί μόνο το ίδιο δικό του σημάδι μπροστά' },
}));
