import 'server-only';

/**
 * @fileoverview **ΜΙΑ ΣΥΝΟΜΙΛΙΑ, ΜΕ ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΤΗΣ** — `GET /api/network/threads/{threadId}` (ADR-867 Β9γ).
 * @related services/network-messaging/thread-context.ts · `_shared/thread-reader-route.ts`
 *
 * 🔑 Η οθόνη της συνομιλίας (`/messages/{threadId}`) χρειάζεται **τρία** πράγματα που ο πελάτης δεν
 * επιτρέπεται να συμπεράνει μόνος του: την **πλευρά** (τη λέει η γραμμή ακροατηρίου), την **ομάδα**
 * (κλειδί από τον εσωτερικό σπόρο της πράξης) και τα **συμφραζόμενα** — τίτλος πάντα, σύνδεσμος
 * **μόνο** όταν ανοίγει. Το περιεχόμενο των μηνυμάτων το διαβάζει η ζωντανή οθόνη κατευθείαν
 * (onSnapshot), μέσα από τον κανόνα· εδώ δεν περνά **κανένα** μήνυμα.
 *
 * ⚠️ **Ξένο και ανύπαρκτο νήμα απαντούν ΙΔΙΑ** (ADR-742) — τη μετάφραση την κάνει ο κοινός handler,
 * όχι αυτό το αρχείο: μια δεύτερη χειρόγραφη διαδρομή θα ήταν δίδυμο (CHECK 3.28).
 *
 * Ρυθμός: **HIGH** — ανάγνωση που κάνει κάθε άνοιγμα συνομιλίας (ADR-855), όπως η παρουσία.
 */

import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readThreadContext } from '@/services/network-messaging/thread-context';
import type { NetworkThreadContextResult } from '@/types/network-wire';

import { withNetworkDoor } from '../../_shared/network-door';
import { threadReaderHandler } from '../../_shared/thread-reader-route';

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

const handler = threadReaderHandler({
  read: readThreadContext,
  logger: createModuleLogger('NetworkThreadContextRoute'),
  failure: '[NETWORK] Τα συμφραζόμενα συνομιλίας απέτυχαν',
});

export const GET = withHighRateLimit(withNetworkDoor<NetworkThreadContextResult, ThreadRoute>(handler));
