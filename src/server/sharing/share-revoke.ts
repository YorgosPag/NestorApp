import 'server-only';

/**
 * =============================================================================
 * SHARE REVOKE — ανάκληση συνδέσμου, μόνο από τον μισθωτή του (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Μέχρι το Κ4 η ανάκληση ήταν `updateDoc` από τον browser, και ο κανόνας επέτρεπε στον
 * μισθωτή **οποιαδήποτε** αλλαγή — δηλαδή και «ξαναενεργοποίηση» ή επέκταση λήξης ενός
 * ανακληθέντος συνδέσμου. Πλέον ο πελάτης **δεν γράφει**· η ανάκληση είναι **μονόδρομη**
 * (`isActive: false`, ποτέ ξανά `true`) και ιδεμποτική: δεύτερη ανάκληση = καμία αλλαγή.
 *
 * 🔑 Ψάχνει **και** στις δύο συλλογές (ενιαίο `shares` + παλιό `file_shares`), γιατί ο
 * κάτοχος μπορεί να κρατά σύνδεσμο που γεννήθηκε πριν την ενοποίηση.
 *
 * @module server/sharing/share-revoke
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShareCreator } from './share-create';

const logger = createModuleLogger('ShareRevoke');

export type ShareRevokeOutcome = 'revoked' | 'already-revoked' | 'not-found';

/**
 * Ανακαλεί τον σύνδεσμο `shareId` αν ανήκει στον μισθωτή του καλούντα.
 *
 * Ξένος σύνδεσμος ⇒ `not-found`, **όχι** «απαγορεύεται»: η διαδρομή δεν επιβεβαιώνει ποια
 * ids υπάρχουν σε άλλον μισθωτή.
 */
export async function revokeShareOnServer(
  adminDb: Firestore,
  actor: ShareCreator,
  shareId: string,
): Promise<ShareRevokeOutcome> {
  for (const collection of [COLLECTIONS.SHARES, COLLECTIONS.FILE_SHARES]) {
    const ref = adminDb.collection(collection).doc(shareId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = (snap.data() ?? {}) as { companyId?: string; isActive?: unknown };
    if (!isPayloadOwnedByCompany(data, actor.companyId)) return 'not-found';
    if (data.isActive !== true) return 'already-revoked';
    await ref.update({ isActive: false, revokedAt: nowISO(), revokedBy: actor.uid });
    logger.info('Share revoked', { shareId, collection, revokedBy: actor.uid });
    return 'revoked';
  }
  return 'not-found';
}
