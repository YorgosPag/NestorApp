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
  po?: Omit<PurchaseOrder, 'internalNotes'>;
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

    // Strip internal notes for public view
    const { internalNotes: _stripped, ...publicPO } = po;

    return { valid: true, po: publicPO };
  } catch (err) {
    logger.error('PO share validation failed', { error: getErrorMessage(err) });
    return { valid: false, error: 'Validation failed' };
  }
}

export async function revokePOShare(shareId: string): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    await db
      .collection(COLLECTIONS.PO_SHARES)
      .doc(shareId)
      .update({ isActive: false });

    logger.info('PO share revoked', { shareId });
    return true;
  } catch (err) {
    logger.error('PO share revoke failed', {
      shareId,
      error: getErrorMessage(err),
    });
    return false;
  }
}
