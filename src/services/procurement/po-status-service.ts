/**
 * PO Status Transitions Service
 *
 * Encapsulates the four FSM transitions for a Purchase Order: approve →
 * markOrdered → close, plus the cancel branch. Each transition validates the
 * source/target via the SSoT in `PO_STATUS_TRANSITIONS`, persists via
 * `updatePOStatus`, and writes both the legacy logger entry and the
 * `EntityAuditService` row.
 *
 * Extracted from `procurement-service.ts` on 2026-05-04 to keep that file
 * under the Google 500-line per-file limit (CLAUDE.md N.7.1).
 *
 * @module services/procurement/po-status-service
 * @see ADR-267 §4.3 (Status State Machine)
 */

import { logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import type {
  PurchaseOrderStatus,
  POCancellationReason,
  ProcurementAuditAction,
} from '@/types/procurement';
import { PO_STATUS_TRANSITIONS } from '@/types/procurement';
import { EntityAuditService } from '@/services/entity-audit.service';
import { notifyPOApproved } from './po-notification-service';
import { getPurchaseOrder, updatePOStatus } from './procurement-repository';

// ============================================================================
// SHARED HELPERS (private to status transitions)
// ============================================================================

function assertTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): void {
  const allowed = PO_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ')}`,
    );
  }
}

async function audit(
  ctx: AuthContext,
  action: ProcurementAuditAction,
  poId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent(ctx, action, poId, 'purchase_order', {
    metadata: meta as Record<string, string | number | boolean | null> | undefined,
  });
}

// ============================================================================
// APPROVE
// ============================================================================

export async function approvePO(
  ctx: AuthContext,
  poId: string,
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'approved');

  await updatePOStatus(poId, 'approved', { approvedBy: ctx.uid });

  await audit(ctx, 'procurement.po.approved', poId, { poNumber: po.poNumber });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: 'draft', newValue: 'approved', label: 'Status' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});

  notifyPOApproved(po, po.createdBy).catch(() => {});
}

// ============================================================================
// MARK ORDERED
// ============================================================================

export async function markOrdered(
  ctx: AuthContext,
  poId: string,
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'ordered');

  const paymentDueDate =
    po.paymentTermsDays != null
      ? new Date(Date.now() + po.paymentTermsDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  await updatePOStatus(poId, 'ordered', { paymentDueDate });

  await audit(ctx, 'procurement.po.ordered', poId, { poNumber: po.poNumber });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: 'approved', newValue: 'ordered', label: 'Status' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

// ============================================================================
// CLOSE
// ============================================================================

export async function closePO(
  ctx: AuthContext,
  poId: string,
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'closed');

  await updatePOStatus(poId, 'closed');

  await audit(ctx, 'procurement.po.status_changed', poId, {
    poNumber: po.poNumber,
    from: po.status,
    to: 'closed',
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [{ field: 'status', oldValue: po.status, newValue: 'closed', label: 'Status' }],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}

// ============================================================================
// CANCEL
// ============================================================================

export async function cancelPO(
  ctx: AuthContext,
  poId: string,
  reason: POCancellationReason,
  comment?: string,
): Promise<void> {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error(`PO not found: ${poId}`);

  assertTransition(po.status, 'cancelled');

  await updatePOStatus(poId, 'cancelled', {
    cancellationReason: reason,
    cancellationComment: comment ?? null,
  });

  await audit(ctx, 'procurement.po.cancelled', poId, {
    poNumber: po.poNumber,
    reason,
  });

  EntityAuditService.recordChange({
    entityType: 'purchase_order',
    entityId: poId,
    entityName: po.poNumber,
    action: 'status_changed',
    changes: [
      { field: 'status', oldValue: po.status, newValue: 'cancelled', label: 'Status' },
      { field: 'cancellationReason', oldValue: null, newValue: reason, label: 'Reason' },
    ],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  }).catch(() => {});
}
