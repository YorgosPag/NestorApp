import 'server-only';

/**
 * @fileoverview **ΤΑ ΝΗΜΑΤΑ ΜΟΥ** — `GET /api/network/threads?limit=&cursor=` (ADR-867 Β5).
 * @related services/network-messaging/thread-directory.ts · `_shared/network-door.ts`
 *
 * 🔑 Ο διακομιστής λέει **ποια** νήματα διαβάζει ο άνθρωπος **τώρα**, με σειρά δραστηριότητας
 * και δρομέα σελίδας· το **περιεχόμενο** το διαβάζει η ζωντανή οθόνη κατευθείαν (onSnapshot),
 * μέσα από τον κανόνα. Κανένα φίλτρο χώρου: το νήμα ανήκει σε **δύο** πλευρές, και το «ποιος
 * διαβάζει» το απαντά **μόνο** η γραμμή ακροατηρίου (ADR-867 §4.2).
 *
 * Ρυθμός: **HIGH** — ανάγνωση καταλόγου (ADR-855).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decodeDirectoryCursor,
  listNetworkThreads,
  type NetworkThreadDirectoryResult,
} from '@/services/network-messaging/thread-directory';

import {
  networkBadRequest,
  networkServerError,
  withNetworkDoor,
  type NetworkActor,
} from '../_shared/network-door';
import { ThreadListQuerySchema } from '../_shared/network-params';

const logger = createModuleLogger('NetworkThreadsRoute');

type ThreadListResponse = { readonly success: true } & NetworkThreadDirectoryResult;

async function handler(request: NextRequest, actor: NetworkActor) {
  const query = ThreadListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return networkBadRequest({ issues: query.error.issues });

  // 🔴 Χαλασμένος δρομέας ⇒ 400, **ποτέ** «πρώτη σελίδα» σιωπηλά: η οθόνη θα έδειχνε διπλά νήματα.
  const after = query.data.cursor === undefined ? null : decodeDirectoryCursor(query.data.cursor);
  if (query.data.cursor !== undefined && after === null) return networkBadRequest({ cursor: 'invalid' });

  try {
    const page = await listNetworkThreads(getAdminFirestore(), { uid: actor.uid, limit: query.data.limit, after });
    return NextResponse.json<ThreadListResponse>({ success: true, ...page });
  } catch (error) {
    return networkServerError(logger, '[NETWORK] Ο κατάλογος νημάτων απέτυχε', error, { uid: actor.uid });
  }
}

export const GET = withHighRateLimit(withNetworkDoor<ThreadListResponse>(handler));
