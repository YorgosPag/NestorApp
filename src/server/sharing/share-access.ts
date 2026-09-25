import 'server-only';

/**
 * =============================================================================
 * SHARE ACCESS — ο ΜΟΝΟΣ γραφέας του μετρητή πρόσβασης (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔴 **Πριν το Κ4** ο μετρητής γραφόταν από **τρία** σημεία με **τρεις** τρόπους:
 *   - ο **ανώνυμος browser** (`incrementAccessCount`: read-then-write, και ο κανόνας
 *     επέτρεπε **οποιαδήποτε** τιμή — ένας επισκέπτης μπορούσε να γράψει `accessCount: 0`
 *     και να ξαναγεμίσει ένα εξαντλημένο όριο)·
 *   - το `incrementPublicShareAccess` (`FieldValue.increment`, χωρίς έλεγχο ορίου)·
 *   - το PDF route της ιδιοκτησίας (read-then-write, διπλή εγγραφή σε δύο συλλογές).
 *
 * Και ο **έλεγχος** του ορίου γινόταν **στον browser, πριν** την αύξηση — δύο ταυτόχρονοι
 * επισκέπτες σε όριο 10 έβλεπαν και οι δύο «9» και περνούσαν και οι δύο.
 *
 * **Τώρα**: μία συναλλαγή ξαναδιαβάζει το έγγραφο, κρίνει ενεργό/λήξη/όριο **πάνω στο
 * φρέσκο** ανάγνωσμα και αυξάνει — ή αρνείται με **όνομα**. Δεν υπάρχει «11η λήψη» σε
 * όριο 10.
 *
 * @module server/sharing/share-access
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import {
  collectionOfShareSource,
  type StoredShare,
} from './share-token-lookup';

const logger = createModuleLogger('ShareAccess');

/** Τι απέγινε η προσπάθεια πρόσβασης — ονομασμένο, ποτέ boolean. */
export type ShareAccessOutcome = 'recorded' | 'gone' | 'expired' | 'exhausted';

/**
 * Τα ονόματα πεδίων διαφέρουν ανά συλλογή: το παλιό `file_shares` μετρά «λήψεις».
 * Διαβάζεται **εδώ και μόνο εδώ** — ο καλών δεν ξέρει ότι υπάρχουν δύο λεξιλόγια.
 */
const COUNTER_FIELDS = {
  shares: { count: 'accessCount', max: 'maxAccesses', last: 'lastAccessedAt' },
  file_shares: { count: 'downloadCount', max: 'maxDownloads', last: 'lastDownloadedAt' },
} as const;

/** Καθαρή κρίση πάνω σε φρέσκο ανάγνωσμα — δοκιμάσιμη χωρίς βάση. */
export function judgeShareAccess(
  data: Record<string, unknown> | undefined,
  fields: (typeof COUNTER_FIELDS)[keyof typeof COUNTER_FIELDS],
  nowMs: number,
): ShareAccessOutcome {
  if (!data || data.isActive !== true) return 'gone';
  const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt < nowMs) return 'expired';
  const max = typeof data[fields.max] === 'number' ? (data[fields.max] as number) : 0;
  const count = typeof data[fields.count] === 'number' ? (data[fields.count] as number) : 0;
  if (max > 0 && count >= max) return 'exhausted';
  return 'recorded';
}

/**
 * Καταγράφει **μία** πρόσβαση, ατομικά. Επιστρέφει `recorded` μόνο αν ο μετρητής αυξήθηκε.
 *
 * Καλείται **μετά** την κρίση κωδικού (ο κωδικός δεν «ξοδεύει» πρόσβαση) και **πριν**
 * σερβιριστεί οτιδήποτε.
 */
export async function recordShareAccess(adminDb: Firestore, share: StoredShare): Promise<ShareAccessOutcome> {
  const fields = COUNTER_FIELDS[share.source];
  const ref = adminDb.collection(collectionOfShareSource(share.source)).doc(share.id);

  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const verdict = judgeShareAccess(snap.data(), fields, Date.now());
    if (verdict !== 'recorded') return verdict;
    const count = (snap.data()?.[fields.count] as number | undefined) ?? 0;
    tx.update(ref, { [fields.count]: count + 1, [fields.last]: nowISO() });
    return verdict;
  });

  if (outcome !== 'recorded') {
    logger.info('Share access refused', { shareId: share.id, source: share.source, outcome });
  }
  return outcome;
}
