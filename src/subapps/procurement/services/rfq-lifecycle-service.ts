import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import type {
  RFQ,
  RfqCancellationReason,
} from '../types/rfq';
import { RFQ_STATUS_TRANSITIONS, RFQ_CANCELLATION_REASONS } from '../types/rfq';
import type { AuthContext } from '@/lib/auth';
import { recomputeSourcingEventStatus } from './sourcing-event-service';
import { loadOwnedRfq } from './rfq-ownership';
import { rfqHasActivePurchaseOrder } from './rfq-po-guard';

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
    const { ref, current } = await loadOwnedRfq<RFQ>(db, ctx.companyId, rfqId);

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
// REOPEN — ADR-335 Q3 (PO-gated, guard σε ./rfq-po-guard)
// ============================================================================

export async function reopenRfq(
  ctx: AuthContext,
  rfqId: string,
): Promise<RFQ> {
  return safeFirestoreOperation(async (db) => {
    const { ref, current } = await loadOwnedRfq<RFQ>(db, ctx.companyId, rfqId);

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
