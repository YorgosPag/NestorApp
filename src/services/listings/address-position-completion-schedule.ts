/**
 * **Η ΟΛΟΚΛΗΡΩΣΗ ΤΡΕΧΕΙ ΜΕΤΑ ΤΗΝ ΑΠΑΝΤΗΣΗ** — ο ένας προγραμματιστής, για έργα **και** κτίρια
 * (ADR-332 D29).
 *
 * 🔑 **Γιατί ξεχωριστό αρχείο από την ίδια την ολοκλήρωση**: εκείνη είναι καθαρή λογική πάνω σε
 * `AdminFirestore` (δοκιμάζεται με ένα έγγραφο στη μνήμη)· αυτό εδώ είναι το **πότε** — το `after()`
 * του Next, που υπάρχει μόνο μέσα σε αίτημα. Μαζί, κάθε test της ολοκλήρωσης θα έπρεπε να στήνει
 * πλαίσιο αιτήματος για κάτι που δεν δοκιμάζει.
 *
 * @module services/listings/address-position-completion-schedule
 */

import 'server-only';

import { after } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  completePendingAddressPositions,
  type PendingAddressPositions,
} from './address-position-completion';

type AdminDb = ReturnType<typeof getAdminFirestore>;

/**
 * Προγραμματίζει την ολοκλήρωση· καμία εκκρεμότητα ⇒ **καμία εργασία**.
 *
 * @param onWritten Ό,τι οφείλει να ακολουθήσει **μόνο όταν γράφτηκε** έστω μία θέση (έργο: άδειασμα
 *   μνήμης + επαναπροβολή αγγελιών). Δεν καλείται όταν η ολοκλήρωση δεν άλλαξε τίποτα.
 */
export function scheduleAddressPositionCompletion(
  job: PendingAddressPositions,
  onWritten?: (adminDb: AdminDb) => Promise<void> | void,
): void {
  if (job.pendingIds.length === 0) return;
  after(async () => {
    const adminDb = getAdminFirestore();
    const { written } = await completePendingAddressPositions(adminDb, job);
    if (written > 0) await onWritten?.(adminDb);
  });
}
