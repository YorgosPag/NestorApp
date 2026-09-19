import 'server-only';

/**
 * @fileoverview **ΠΟΙΟΙ ΕΙΝΑΙ** — `GET /api/network/threads/{threadId}/people` (ADR-867 Β7 · §8 #8).
 * @related services/network-messaging/thread-people.ts · ADR-834 §5 Β (γ) ③
 *
 * 🔑 Τα ονόματα της λίστας «ποιοι διαβάζουν» — **μόνο** για όποιον διαβάζει ήδη το νήμα (ξένο και
 * ανύπαρκτο ⇒ ίδιο 404, ADR-742). Ο πελάτης **δεν μπορεί** να τα διαβάσει μόνος του: ο κανόνας
 * `users/{uid}` κλείνει τον ξένο χώρο (δες την κεφαλίδα του `thread-people.ts`).
 *
 * Ρυθμός: **HIGH** — ανάγνωση που κάνει κάθε ανοιχτή οθόνη νήματος (ADR-855), όπως η παρουσία.
 */

import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readThreadPeople } from '@/services/network-messaging/thread-people';
import type { NetworkPeopleResult } from '@/types/network-wire';

import { withNetworkDoor } from '../../../_shared/network-door';
import { threadReaderHandler } from '../../../_shared/thread-reader-route';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

const handler = threadReaderHandler({
  read: readThreadPeople,
  logger: createModuleLogger('NetworkPeopleRoute'),
  failure: '[NETWORK] Τα ονόματα νήματος απέτυχαν',
});

export const GET = withHighRateLimit(withNetworkDoor<NetworkPeopleResult, ThreadRoute>(handler));
