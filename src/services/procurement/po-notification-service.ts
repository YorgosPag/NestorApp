/**
 * PO Notification Service — Procurement Event Dispatcher
 *
 * Thin wrapper around the centralized notification orchestrator.
 * Routes procurement events (approval, overdue) through the SSOT system.
 *
 * @module services/procurement/po-notification-service
 * @enterprise ADR-267 Phase B — Notifications
 */

import 'server-only';

import {
  dispatchNotification,
  type DispatchRequest,
} from '@/server/notifications/notification-orchestrator';
import {
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
  NOTIFICATION_ENTITY_TYPES,
  getCurrentEnvironment,
} from '@/config/notification-events';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { PurchaseOrder } from '@/types/procurement';

const logger = createModuleLogger('PO_NOTIFICATIONS');

// ============================================================================
// HELPERS
// ============================================================================

function buildEventId(action: string, poId: string): string {
  return `procurement.${action}.${poId}.${Date.now()}`;
}

function buildSource(): DispatchRequest['source'] {
  return {
    service: SOURCE_SERVICES.PROCUREMENT,
    feature: 'purchase_orders',
    env: getCurrentEnvironment(),
  };
}

// ============================================================================
// DISPATCH FUNCTIONS
// ============================================================================


/**
 * Notify that a PO has been approved.
 * Fire-and-forget: never throws.
 */
export async function notifyPOApproved(
  po: PurchaseOrder,
  creatorUserId: string
): Promise<void> {
  try {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.PROCUREMENT_PO_APPROVED,
      recipientId: creatorUserId,
      tenantId: po.companyId,
      title: `Παραγγελία ${po.poNumber} — Εγκρίθηκε`,
      body: `Η παραγγελία ${po.poNumber} εγκρίθηκε και είναι έτοιμη για αποστολή.`,
      severity: 'success',
      source: buildSource(),
      eventId: buildEventId('approved', po.id),
      entityId: po.id,
      entityType: NOTIFICATION_ENTITY_TYPES.PURCHASE_ORDER,
      actions: [
        {
          id: 'view',
          label: 'Προβολή PO',
          url: `/procurement/${po.id}`,
        },
      ],
      titleKey: 'procurement.notifications.poApproved',
      titleParams: { poNumber: po.poNumber },
    });
  } catch (err) {
    logger.warn('Failed to notify PO approved', { poId: po.id, err });
  }
}


