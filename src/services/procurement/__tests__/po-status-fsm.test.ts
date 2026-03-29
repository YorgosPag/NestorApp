/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * PO Status FSM — Unit Tests (ADR-267)
 * =============================================================================
 *
 * Tests for PO_STATUS_TRANSITIONS validation and assertTransition logic.
 * Covers: all valid transitions, all invalid transitions, terminal states,
 *         cancellation rules, auto delivery status.
 *
 * @module tests/procurement/po-status-fsm
 * @see ADR-267 §4.3 (Status State Machine)
 */

import {
  PO_STATUS_TRANSITIONS,
  PO_MATCHABLE_STATUSES,
  PO_COMMITTED_STATUSES,
  type PurchaseOrderStatus,
} from '@/types/procurement';

// ─── Re-implement assertTransition locally for testing ─────────────────
// (The original is a private function in procurement-service.ts)

function assertTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): void {
  const allowed = PO_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ')}`
    );
  }
}

// ============================================================================
// PO_STATUS_TRANSITIONS — Structure
// ============================================================================

describe('PO_STATUS_TRANSITIONS — structure', () => {
  const ALL_STATUSES: PurchaseOrderStatus[] = [
    'draft', 'approved', 'ordered', 'partially_delivered',
    'delivered', 'closed', 'cancelled',
  ];

  it('defines transitions for all 7 statuses', () => {
    ALL_STATUSES.forEach(status => {
      expect(PO_STATUS_TRANSITIONS).toHaveProperty(status);
      expect(Array.isArray(PO_STATUS_TRANSITIONS[status])).toBe(true);
    });
  });

  it('closed is a terminal state (no transitions)', () => {
    expect(PO_STATUS_TRANSITIONS.closed).toEqual([]);
  });

  it('cancelled is a terminal state (no transitions)', () => {
    expect(PO_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});

// ============================================================================
// assertTransition — Valid Transitions
// ============================================================================

describe('assertTransition — valid transitions', () => {
  const VALID_TRANSITIONS: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
    ['draft', 'approved'],
    ['draft', 'cancelled'],
    ['approved', 'ordered'],
    ['approved', 'cancelled'],
    ['ordered', 'partially_delivered'],
    ['ordered', 'delivered'],
    ['ordered', 'cancelled'],
    ['partially_delivered', 'partially_delivered'], // more deliveries
    ['partially_delivered', 'delivered'],
    ['delivered', 'closed'],
  ];

  test.each(VALID_TRANSITIONS)(
    '%s → %s should be allowed',
    (from, to) => {
      expect(() => assertTransition(from, to)).not.toThrow();
    },
  );
});

// ============================================================================
// assertTransition — Invalid Transitions
// ============================================================================

describe('assertTransition — invalid transitions', () => {
  const INVALID_TRANSITIONS: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
    // Cannot go backwards
    ['approved', 'draft'],
    ['ordered', 'approved'],
    ['ordered', 'draft'],
    ['delivered', 'ordered'],
    ['delivered', 'partially_delivered'],
    ['closed', 'delivered'],

    // Cannot skip states
    ['draft', 'ordered'],
    ['draft', 'delivered'],
    ['draft', 'closed'],
    ['approved', 'delivered'],
    ['approved', 'closed'],

    // Terminal states cannot transition
    ['closed', 'draft'],
    ['closed', 'cancelled'],
    ['cancelled', 'draft'],
    ['cancelled', 'approved'],
    ['cancelled', 'ordered'],

    // Cannot cancel after delivery
    ['partially_delivered', 'cancelled'],
    ['delivered', 'cancelled'],
  ];

  test.each(INVALID_TRANSITIONS)(
    '%s → %s should throw',
    (from, to) => {
      expect(() => assertTransition(from, to)).toThrow('Invalid status transition');
    },
  );
});

// ============================================================================
// PO_MATCHABLE_STATUSES — Invoice matching filter
// ============================================================================

describe('PO_MATCHABLE_STATUSES', () => {
  it('includes ordered, partially_delivered, delivered', () => {
    expect(PO_MATCHABLE_STATUSES.has('ordered')).toBe(true);
    expect(PO_MATCHABLE_STATUSES.has('partially_delivered')).toBe(true);
    expect(PO_MATCHABLE_STATUSES.has('delivered')).toBe(true);
  });

  it('excludes draft, approved, closed, cancelled', () => {
    expect(PO_MATCHABLE_STATUSES.has('draft')).toBe(false);
    expect(PO_MATCHABLE_STATUSES.has('approved')).toBe(false);
    expect(PO_MATCHABLE_STATUSES.has('closed')).toBe(false);
    expect(PO_MATCHABLE_STATUSES.has('cancelled')).toBe(false);
  });
});

// ============================================================================
// PO_COMMITTED_STATUSES — Budget commitment filter
// ============================================================================

describe('PO_COMMITTED_STATUSES', () => {
  it('includes ordered through closed', () => {
    expect(PO_COMMITTED_STATUSES.has('ordered')).toBe(true);
    expect(PO_COMMITTED_STATUSES.has('partially_delivered')).toBe(true);
    expect(PO_COMMITTED_STATUSES.has('delivered')).toBe(true);
    expect(PO_COMMITTED_STATUSES.has('closed')).toBe(true);
  });

  it('excludes draft, approved, cancelled', () => {
    expect(PO_COMMITTED_STATUSES.has('draft')).toBe(false);
    expect(PO_COMMITTED_STATUSES.has('approved')).toBe(false);
    expect(PO_COMMITTED_STATUSES.has('cancelled')).toBe(false);
  });
});

// ============================================================================
// Auto Delivery Status Logic
// ============================================================================

describe('Auto delivery status calculation', () => {
  /**
   * Business rule from ADR-267:
   * - 0% received → ordered
   * - 1-99% received → partially_delivered
   * - 100% received → delivered
   */
  function computeDeliveryStatus(
    items: Array<{ quantity: number; quantityReceived: number }>
  ): 'ordered' | 'partially_delivered' | 'delivered' {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const totalReceived = items.reduce((s, i) => s + i.quantityReceived, 0);

    if (totalQty === 0) return 'ordered';
    const pct = totalReceived / totalQty;
    if (pct <= 0) return 'ordered';
    if (pct >= 1) return 'delivered';
    return 'partially_delivered';
  }

  it('0% received → ordered', () => {
    const items = [{ quantity: 100, quantityReceived: 0 }];
    expect(computeDeliveryStatus(items)).toBe('ordered');
  });

  it('50% received → partially_delivered', () => {
    const items = [{ quantity: 100, quantityReceived: 50 }];
    expect(computeDeliveryStatus(items)).toBe('partially_delivered');
  });

  it('100% received → delivered', () => {
    const items = [{ quantity: 100, quantityReceived: 100 }];
    expect(computeDeliveryStatus(items)).toBe('delivered');
  });

  it('multi-item partial → partially_delivered', () => {
    const items = [
      { quantity: 100, quantityReceived: 100 }, // fully received
      { quantity: 50, quantityReceived: 0 },     // not received
    ];
    expect(computeDeliveryStatus(items)).toBe('partially_delivered');
  });

  it('all items fully received → delivered', () => {
    const items = [
      { quantity: 100, quantityReceived: 100 },
      { quantity: 50, quantityReceived: 50 },
    ];
    expect(computeDeliveryStatus(items)).toBe('delivered');
  });

  it('handles zero quantity items', () => {
    const items = [{ quantity: 0, quantityReceived: 0 }];
    expect(computeDeliveryStatus(items)).toBe('ordered');
  });
});
