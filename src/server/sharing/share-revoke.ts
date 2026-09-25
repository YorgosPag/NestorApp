import 'server-only';

/**
 * =============================================================================
 * SHARE REVOKE — ανάκληση συνδέσμου, μόνο από τον μισθωτή του (ADR-884 Φ0.12 · ADR-315 §5)
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
 * 🔑 **Το «ανήκει ο σύνδεσμος στον μισθωτή;» ζει ΜΟΝΟ εδώ** (`findOwnedShare`) — το ρωτούν
 * η ανάκληση **και** η αλλαγή ρυθμίσεων (`share-update.ts`, Α13). Ένα σημείο κλήσης του
 * `isPayloadOwnedByCompany` ανά αρχείο (anchor ADR-742).
 *
 * 🔑 **Ίχνος** (ADR-315 §5): η ανάκληση συνδέσμου αρχείου αφήνει `share_revoke` στο ίχνος του
 * αρχείου — το ζεύγος του `share` που γράφει η δημιουργία. Η αποτυχία του ίχνους **δεν**
 * ακυρώνει την ανάκληση (ADR-862 §5.7): η ασφάλεια προηγείται της λογιστικής.
 *
 * @module server/sharing/share-revoke
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import type { RevokeAllSharesRequest } from '@/types/sharing';
import type { ShareCreator } from './share-create';
import { mayManageEntityLinks, queryActiveShareDocs } from './share-links-list';
import type { StoredShareSource } from './share-token-lookup';

const logger = createModuleLogger('ShareRevoke');

export type ShareRevokeOutcome = 'revoked' | 'already-revoked' | 'not-found';

/** Ένα έγγραφο κοινοποίησης του μισθωτή, με την πηγή του. */
export interface OwnedShare {
  readonly source: StoredShareSource;
  readonly ref: DocumentReference;
  readonly data: Record<string, unknown>;
}

const SOURCES: ReadonlyArray<readonly [StoredShareSource, string]> = [
  ['shares', COLLECTIONS.SHARES],
  ['file_shares', COLLECTIONS.FILE_SHARES],
];

/** Μέγεθος παρτίδας της μαζικής ανάκλησης (όριο batch Firestore = 500). */
const REVOKE_ALL_BATCH = 400;
/**
 * Φρένο: ο βρόχος τερματίζει επειδή κάθε γύρος ανακαλεί ό,τι βρήκε — αν μια εγγραφή «δεν
 * πιάσει» (π.χ. αναπαραγωγή με καθυστέρηση), **δεν** γυρίζει επ' άπειρον. 50 × 400 = 20.000.
 */
const REVOKE_ALL_MAX_ROUNDS = 50;

/**
 * Ο σύνδεσμος `shareId` αν ανήκει στον μισθωτή `companyId`· `null` για ξένο **και** για
 * ανύπαρκτο — η διαδρομή δεν επιβεβαιώνει ποια ids υπάρχουν σε άλλον μισθωτή (Α10).
 */
export async function findOwnedShare(
  adminDb: Firestore,
  companyId: string,
  shareId: string,
): Promise<OwnedShare | null> {
  for (const [source, collection] of SOURCES) {
    const ref = adminDb.collection(collection).doc(shareId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    return isPayloadOwnedByCompany(data as { companyId?: string }, companyId) ? { source, ref, data } : null;
  }
  return null;
}

/** Το αρχείο ενός συνδέσμου αρχείου — `null` για κάθε άλλο είδος (και για showcase του παλιού σχήματος). */
function sharedFileIdOf(source: StoredShareSource, data: Record<string, unknown>): string | null {
  const id = source === 'shares'
    ? (data.entityType === 'file' ? data.entityId : null)
    : (data.showcaseMode === true ? null : data.fileId);
  return typeof id === 'string' && id !== '' ? id : null;
}

/** `share_revoke` στο ίχνος του αρχείου — ποτέ δεν ακυρώνει την ανάκληση. */
async function auditFileRevoke(actor: ShareCreator, owned: Pick<OwnedShare, 'source' | 'data'>, shareId: string) {
  const fileId = sharedFileIdOf(owned.source, owned.data);
  if (fileId === null) return;
  await recordFileAudit({
    fileId,
    action: 'share_revoke',
    performedBy: actor.uid,
    companyId: actor.companyId,
    metadata: { shareId },
  });
}

function revocationStamp(actor: ShareCreator) {
  return { isActive: false, revokedAt: nowISO(), revokedBy: actor.uid };
}

/** Ανακαλεί τον σύνδεσμο `shareId` αν ανήκει στον μισθωτή του καλούντα. */
export async function revokeShareOnServer(
  adminDb: Firestore,
  actor: ShareCreator,
  shareId: string,
): Promise<ShareRevokeOutcome> {
  const owned = await findOwnedShare(adminDb, actor.companyId, shareId);
  if (owned === null) return 'not-found';
  if (owned.data.isActive !== true) return 'already-revoked';
  await owned.ref.update(revocationStamp(actor));
  logger.info('Share revoked', { shareId, source: owned.source, revokedBy: actor.uid });
  await auditFileRevoke(actor, owned, shareId);
  return 'revoked';
}

/**
 * «Ανάκληση όλων» (προαιρετικά «εκτός από αυτόν») για μία οντότητα. Ιδεμποτική: δεύτερη
 * κλήση ⇒ `0`. `null` ⇒ η οντότητα δεν είναι του μισθωτή (404).
 *
 * Σε παρτίδες: κάθε γύρος ανακαλεί ό,τι βρήκε, άρα ο επόμενος ρωτά **μόνο** όσα έμειναν —
 * τερματίζει όταν δεν μένει τίποτα προς ανάκληση.
 */
export async function revokeAllShareLinks(
  adminDb: Firestore,
  actor: ShareCreator,
  request: RevokeAllSharesRequest,
): Promise<number | null> {
  if (!(await mayManageEntityLinks(adminDb, actor.companyId, request))) return null;
  let revoked = 0;
  for (let round = 0; round < REVOKE_ALL_MAX_ROUNDS; round++) {
    const docs = (await queryActiveShareDocs(adminDb, actor.companyId, request, REVOKE_ALL_BATCH))
      .filter(({ snap }) => snap.id !== request.exceptShareId);
    if (docs.length === 0) break;
    const batch = adminDb.batch();
    for (const { snap } of docs) batch.update(snap.ref, revocationStamp(actor));
    await batch.commit();
    revoked += docs.length;
    for (const { source, snap } of docs) {
      await auditFileRevoke(actor, { source, data: (snap.data() ?? {}) as Record<string, unknown> }, snap.id);
    }
  }
  logger.info('Share links revoked in bulk', { entityType: request.entityType, revoked, revokedBy: actor.uid });
  return revoked;
}
