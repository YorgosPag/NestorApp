import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import type {
  RFQ,
  RfqCancellationReason,
} from '../types/rfq';
import { RFQ_STATUS_TRANSITIONS, RFQ_CANCELLATION_REASONS } from '../types/rfq';
import type { AuthContext } from '@/lib/auth';
import type { PurchaseOrder } from '@/types/procurement/purchase-order';
import { recomputeSourcingEventStatus } from './sourcing-event-service';

const logger = createModuleLogger('RFQ_LIFECYCLE');

// ============================================================================
// CANCEL — ADR-335 Q2
// ============================================================================

export interface CancelRfqOptions {
  reason?: RfqCancellationReason | null;
  detail?: string | null;
  notifyVendors?: boolean;
}

export async function cancelRfq(
  ctx: AuthContext,
  rfqId: string,
  options: CancelRfqOptions = {},
): Promise<RFQ> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.RFQS).doc(rfqId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`RFQ ${rfqId} not found`);
    const current = { id: snap.id, ...snap.data() } as RFQ;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    if (!RFQ_STATUS_TRANSITIONS[current.status].includes('cancelled')) {
      throw new Error(`Cannot cancel RFQ in status ${current.status}`);
    }

    const isActive = current.status === 'active';
    if (isActive && (!options.reason || !RFQ_CANCELLATION_REASONS.includes(options.reason))) {
      throw new Error('Cancellation reason is required for active RFQ');
    }
    if (isActive && options.reason === 'other' && !options.detail?.trim()) {
      throw new Error('Detail is required when reason is "other"');
    }

    const now = admin.firestore.Timestamp.now();
    const detail = options.detail?.trim() || null;
    const reason = options.reason ?? null;
    const notifyVendors = !!options.notifyVendors;

    const auditEntry = {
      timestamp: now,
      userId: ctx.uid,
      action: 'cancelled',
      detail: reason ? `${reason}${detail ? `: ${detail}` : ''}` : null,
    };

    const updates: Partial<RFQ> = {
      status: 'cancelled',
      cancellationReason: reason,
      cancellationDetail: detail,
      cancelledAt: now,
      cancelledBy: ctx.uid,
      cancellationNotifiedVendors: notifyVendors,
      auditTrail: [...current.auditTrail, auditEntry],
      updatedAt: now,
    };

    await ref.update(sanitizeForFirestore(updates));
    logger.info('RFQ cancelled', { rfqId, reason, notifyVendors, uid: ctx.uid });

    if (current.sourcingEventId) {
      await recomputeSourcingEventStatus(ctx, current.sourcingEventId).catch((err) => {
        logger.warn('Failed to recompute sourcing event status after cancel', {
          rfqId,
          sourcingEventId: current.sourcingEventId,
          error: String(err),
        });
      });
    }

    return { ...current, ...updates };
  });
}

// ============================================================================
// REOPEN — ADR-335 Q3 (PO-gated)
// ============================================================================

async function rfqHasActivePurchaseOrder(
  companyId: string,
  rfq: RFQ,
): Promise<boolean> {
  if (!rfq.winnerQuoteId) return false;
  const db = admin.firestore();
  const poSnap = await db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', companyId)
    .where('sourceQuoteId', '==', rfq.winnerQuoteId)
    .get();
  return poSnap.docs.some((d) => {
    const po = d.data() as PurchaseOrder;
    return po.status !== 'cancelled';
  });
}

export async function reopenRfq(
  ctx: AuthContext,
  rfqId: string,
): Promise<RFQ> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.RFQS).doc(rfqId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`RFQ ${rfqId} not found`);
    const current = { id: snap.id, ...snap.data() } as RFQ;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    if (current.status !== 'closed') {
      throw new Error(`Reopen only allowed from 'closed' status (current: ${current.status})`);
    }

    if (await rfqHasActivePurchaseOrder(ctx.companyId, current)) {
      const err = new Error('PO_EXISTS');
      (err as Error & { code: string }).code = 'PO_EXISTS';
      throw err;
    }

    const now = admin.firestore.Timestamp.now();
    const auditEntry = {
      timestamp: now,
      userId: ctx.uid,
      action: 'reopened',
      detail: current.winnerQuoteId ? `previous winner cleared: ${current.winnerQuoteId}` : null,
    };

    const updates: Partial<RFQ> = {
      status: 'active',
      winnerQuoteId: null,
      auditTrail: [...current.auditTrail, auditEntry],
      updatedAt: now,
    };

    await ref.update(sanitizeForFirestore(updates));
    logger.info('RFQ reopened', { rfqId, uid: ctx.uid });

    if (current.sourcingEventId) {
      await recomputeSourcingEventStatus(ctx, current.sourcingEventId).catch((err) => {
        logger.warn('Failed to recompute sourcing event status after reopen', {
          rfqId,
          sourcingEventId: current.sourcingEventId,
          error: String(err),
        });
      });
    }

    return { ...current, ...updates };
  });
}
