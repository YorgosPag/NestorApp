import 'server-only';

/**
 * @fileoverview **ΣΙΓΑΣΗ** — `PUT /api/network/threads/{threadId}/mute` `{ muted }` (ADR-867 Β5).
 * @related services/network-messaging/thread-messages.ts (`setNetworkThreadMuted`) · ADR-834 (α) ②
 *
 * 🔑 **Μονομερής, χωρίς ειδοποίηση του άλλου** (α) ②: το νήμα μένει ανοιχτό και τα μηνύματα
 * φτάνουν — απλώς δεν χτυπά το καμπανάκι (Β6). **Δεν** είναι φραγή (Β8).
 * ⚠️ `PUT` με **τελική κατάσταση**, όχι «εναλλαγή»: δύο διπλά κλικ δεν πρέπει να ακυρώνουν το ένα
 * το άλλο (ιδεμποτησία, N.7.2 #3). Το σχήμα ζει στο `_shared/own-seat-route.ts` (Β7: κοινό με το follow).
 *
 * Ρυθμός: **STANDARD** (ADR-855).
 */

import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { setNetworkThreadMuted } from '@/services/network-messaging/thread-messages';

import { withNetworkDoor } from '../../../_shared/network-door';
import { MuteBodySchema } from '../../../_shared/network-params';
import { OWN_SEAT_IDEMPOTENCY, ownSeatHandler, type OwnSeatResponse } from '../../../_shared/own-seat-route';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

const handler = ownSeatHandler({
  field: 'muted',
  schema: MuteBodySchema,
  write: setNetworkThreadMuted,
  logger: createModuleLogger('NetworkMuteRoute'),
  failure: '[NETWORK] Η σίγαση απέτυχε',
});

export const PUT = withStandardRateLimit(withNetworkDoor<OwnSeatResponse<'muted'>, ThreadRoute>(handler, { idempotency: OWN_SEAT_IDEMPOTENCY }));
