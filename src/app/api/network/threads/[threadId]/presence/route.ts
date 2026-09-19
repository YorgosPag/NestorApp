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

import { nowISO } from '@/lib/date-local';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readThreadPresence } from '@/services/network-messaging/network-away';
import type { NetworkPresenceResult } from '@/types/network-wire';

import { withNetworkDoor } from '../../../_shared/network-door';
import { threadReaderHandler } from '../../../_shared/thread-reader-route';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

const handler = threadReaderHandler({
  read: (adminDb, threadId, callerUid) => readThreadPresence(adminDb, threadId, callerUid, nowISO()),
  logger: createModuleLogger('NetworkPresenceRoute'),
  failure: '[NETWORK] Η παρουσία νήματος απέτυχε',
});

export const GET = withHighRateLimit(withNetworkDoor<NetworkPresenceResult, ThreadRoute>(handler));
