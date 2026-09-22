import 'server-only';

/**
 * @fileoverview **ΑΚΟΛΟΥΘΩ** — `PUT /api/network/threads/{threadId}/follow` `{ following }` (ADR-867 Β7 · §8 #10).
 * @related services/network-messaging/thread-messages.ts (`setNetworkThreadFollowing`) ·
 *   network-notification-plan.ts (`alwaysNotified`)
 *
 * 🔑 Ο **συνεργάτης** ζητά να ειδοποιείται για κάθε εισερχόμενο, όχι μόνο όταν αναπληρώνει (HubSpot
 * «Follow a record»). Μονομερές, ιδεμποτές, χωρίς ειδοποίηση του άλλου — ίδιο σχήμα με τη σίγαση.
 * ⚠️ Στα κύρια πρόσωπα **δεν αλλάζει τίποτα** (ειδοποιούνται πάντα)· η οθόνη δεν τους δείχνει διακόπτη.
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { setNetworkThreadFollowing } from '@/services/network-messaging/thread-messages';

import { withNetworkDoor } from '../../../_shared/network-door';
import { FollowBodySchema } from '../../../_shared/network-params';
import { OWN_SEAT_IDEMPOTENCY, ownSeatHandler, type OwnSeatResponse } from '../../../_shared/own-seat-route';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

const handler = ownSeatHandler({
  field: 'following',
  schema: FollowBodySchema,
  write: setNetworkThreadFollowing,
  logger: createModuleLogger('NetworkFollowRoute'),
  failure: '[NETWORK] Το «ακολουθώ» απέτυχε',
});

export const PUT = withStandardRateLimit(withNetworkDoor<OwnSeatResponse<'following'>, ThreadRoute>(handler, { idempotency: OWN_SEAT_IDEMPOTENCY }));
