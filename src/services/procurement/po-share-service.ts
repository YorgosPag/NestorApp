/**
 * PO Share Service — Token-Based Public Access
 *
 * Creates, validates, and revokes share tokens for read-only PO views.
 * Server-only: uses Firebase Admin SDK.
 *
 * @module services/procurement/po-share-service
 * @enterprise ADR-267 Phase B — Share Link
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { generateShareId } from '@/services/enterprise-id.service';
import type { PurchaseOrder } from '@/types/procurement';
import { toPublicPurchaseOrder, type PublicPurchaseOrder } from './po-public-projection';

const logger = createModuleLogger('PO_SHARE');

// ============================================================================
// TYPES
// ============================================================================

export interface POShareRecord {
  id: string;
  poId: string;
  token: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  accessCount: number;
  companyId: string;
}

export interface CreateShareResult {
  token: string;
  shareId: string;
  expiresAt: string;
}

export interface ValidateShareResult {
  valid: boolean;
  po?: PublicPurchaseOrder;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_EXPIRY_HOURS = 7 * 24; // 7 days

// ============================================================================
// SERVICE
// ============================================================================

export async function createPOShare(
  poId: string,
  userId: string,
  companyId: string,
  expiryHours: number = DEFAULT_EXPIRY_HOURS
): Promise<CreateShareResult> {
  const db = getAdminFirestore();

  const shareId = generateShareId();
  // Token is the share_xxx ID itself (unique, URL-safe after replacing underscores)
  const token = shareId.replace('share_', '');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const record: POShareRecord = {
    id: shareId,
    poId,
    token,
    createdBy: userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true,
    accessCount: 0,
    companyId,
  };

  await db.collection(COLLECTIONS.PO_SHARES).doc(shareId).set(record);

  logger.info('PO share created', { poId, shareId, expiryHours });

  return {
    token,
    shareId,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function validatePOShare(
  token: string
): Promise<ValidateShareResult> {
  try {
    const db = getAdminFirestore();

    // Find share by token
    const snapshot = await db
      .collection(COLLECTIONS.PO_SHARES)
      .where('token', '==', token)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { valid: false, error: 'Share link not found or revoked' };
    }

    const shareDoc = snapshot.docs[0];
    const share = shareDoc.data() as POShareRecord;

    // Check expiry
    if (new Date(share.expiresAt) < new Date()) {
      return { valid: false, error: 'Share link has expired' };
    }

    // Fetch PO
    const poDoc = await db
      .collection(COLLECTIONS.PURCHASE_ORDERS)
      .doc(share.poId)
      .get();

    if (!poDoc.exists) {
      return { valid: false, error: 'Purchase order not found' };
    }

    const po = poDoc.data() as PurchaseOrder;

    if (po.isDeleted) {
      return { valid: false, error: 'Purchase order has been deleted' };
    }

    // Increment access count (fire-and-forget).
    // Explicit collection path so CHECK 3.17's backward-nearest-COLLECTIONS
    // heuristic attributes this write to PO_SHARES (untracked) instead of
    // PURCHASE_ORDERS (the preceding read at line ~125). No behavior change.
    db.collection(COLLECTIONS.PO_SHARES)
      .doc(shareDoc.id)
      .update({ accessCount: FieldValue.increment(1) })
      .catch(() => { /* non-critical */ });

    // ADR-923 «3γ» Α12: explicit allowlist — never the stored document minus a denylist.
    return { valid: true, po: toPublicPurchaseOrder(po) };
  } catch (err) {
    logger.error('PO share validation failed', { error: getErrorMessage(err) });
    return { valid: false, error: 'Validation failed' };
  }
}

/** Η απάντηση όταν ο σύνδεσμος λείπει **ή** ανήκει σε άλλη παραγγελία — αδιάκριτα (ADR-742 §7.1). */
export const PO_SHARE_NOT_FOUND_MESSAGE = 'Share link not found';

interface RevokePOShareQuery {
  readonly shareId: string;
  /**
   * Η παραγγελία της διαδρομής, **ήδη περασμένη από τον φράχτη** (`findOwnedPO`). Αυτή είναι η
   * μόνη απόδειξη δικαιώματος που χρειάζεται: ο σύνδεσμος ανήκει σε όποιον ανήκει η PO του.
   */
  readonly poId: string;
}

type RevokePOShareOutcome = 'revoked' | 'not_found' | 'failed';

/**
 * Ανακαλεί σύνδεσμο **μόνο** αν δείχνει στη συγκεκριμένη (ήδη ελεγμένη) παραγγελία.
 *
 * ADR-923 κύμα 3 Λ5 — πριν, η ανάκληση έπαιρνε σκέτο `shareId` και έγραφε χωρίς να ρωτήσει τίποτα:
 * οποιοσδήποτε συνδεδεμένος έσβηνε σύνδεσμο ξένης εταιρείας. Σύνδεσμος άλλης PO ή ανύπαρκτος ⇒ `'not_found'`.
 *
 * 🔑 Λ5β — η σύγκριση είναι με το `poId` του συνδέσμου, **όχι** με το `companyId` που γράφτηκε πάνω του.
 * Ο κάτοχος ενός συνδέσμου είναι ο κάτοχος της PO (GitHub: τα deploy keys ενός repo τα ανακαλεί ο
 * κάτοχος του repo, όποιος κι αν τα έφτιαξε). Το `companyId` του συνδέσμου ήταν η εταιρεία του
 * **δημιουργού** — ένας παλιός σύνδεσμος που έφτιαξε ο υπερδιαχειριστής για ξένη PO έγραφε τη
 * δική του εταιρεία, και ο πραγματικός κάτοχος δεν θα μπορούσε ποτέ να τον ανακαλέσει.
 */
export async function revokePOShare(query: RevokePOShareQuery): Promise<RevokePOShareOutcome> {
  const { shareId, poId } = query;
  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.PO_SHARES).doc(shareId);
    const snap = await ref.get();
    const share = snap.exists ? (snap.data() as Partial<POShareRecord>) : null;
    if (!share || poId === '' || share.poId !== poId) {
      logger.warn('PO share revoke refused — missing share or share of another PO', { shareId, poId });
      return 'not_found';
    }

    await ref.update({ isActive: false });

    logger.info('PO share revoked', { shareId });
    return 'revoked';
  } catch (err) {
    logger.error('PO share revoke failed', {
      shareId,
      error: getErrorMessage(err),
    });
    return 'failed';
  }
}
