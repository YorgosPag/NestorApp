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

  it('over-delivery (received > quantity) → still delivered', () => {
    const items = [{ quantity: 100, quantityReceived: 120 }];
    expect(computeDeliveryStatus(items)).toBe('delivered');
  });

  it('single item with tiny quantity → partial delivery fraction', () => {
    const items = [{ quantity: 1, quantityReceived: 0.5 }];
    expect(computeDeliveryStatus(items)).toBe('partially_delivered');
  });
});

// ============================================================================
// validateCreateDTO — Business Validation Rules
// ============================================================================

describe('validateCreateDTO logic', () => {
  /**
   * Mirror the private validateCreateDTO from procurement-service.ts
   * to test validation logic independently.
   */
  interface ValidateItem {
    description: string;
    quantity: number;
    unitPrice: number;
    categoryCode: string;
  }
  interface ValidateDTO {
    projectId: string;
    supplierId: string;
    items: ValidateItem[];
  }

  function validateCreateDTO(dto: ValidateDTO): string | null {
    if (!dto.projectId) return 'projectId is required';
    if (!dto.supplierId) return 'supplierId is required';
    if (!dto.items || dto.items.length === 0) return 'At least 1 item is required';
    if (dto.items.length > 100) return 'Max 100 items per PO';
    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      if (!item.description) return `Item ${i + 1}: description is required`;
      if (item.quantity <= 0) return `Item ${i + 1}: quantity must be > 0`;
      if (item.unitPrice < 0) return `Item ${i + 1}: unitPrice must be >= 0`;
      if (!item.categoryCode) return `Item ${i + 1}: categoryCode (ΑΤΟΕ) is required`;
    }
    return null;
  }

  const validItem: ValidateItem = {
    description: 'Τσιμέντο',
    quantity: 100,
    unitPrice: 10,
    categoryCode: 'OIK-2',
  };

  it('valid DTO → returns null (no error)', () => {
    expect(validateCreateDTO({
      projectId: 'proj_1',
      supplierId: 'supp_1',
      items: [validItem],
    })).toBeNull();
  });

  it('missing projectId → error', () => {
    expect(validateCreateDTO({ projectId: '', supplierId: 'supp_1', items: [validItem] }))
      .toBe('projectId is required');
  });

  it('missing supplierId → error', () => {
    expect(validateCreateDTO({ projectId: 'proj_1', supplierId: '', items: [validItem] }))
      .toBe('supplierId is required');
  });

  it('empty items → error', () => {
    expect(validateCreateDTO({ projectId: 'p', supplierId: 's', items: [] }))
      .toBe('At least 1 item is required');
  });

  it('more than 100 items → error', () => {
    const items = Array.from({ length: 101 }, () => validItem);
    expect(validateCreateDTO({ projectId: 'p', supplierId: 's', items }))
      .toBe('Max 100 items per PO');
  });

  it('item with empty description → error', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, description: '' }],
    })).toBe('Item 1: description is required');
  });

  it('item with zero quantity → error', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, quantity: 0 }],
    })).toBe('Item 1: quantity must be > 0');
  });

  it('item with negative quantity → error', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, quantity: -5 }],
    })).toBe('Item 1: quantity must be > 0');
  });

  it('item with negative unitPrice → error', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, unitPrice: -1 }],
    })).toBe('Item 1: unitPrice must be >= 0');
  });

  it('item with zero unitPrice → valid (free items allowed)', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, unitPrice: 0 }],
    })).toBeNull();
  });

  it('item missing categoryCode → error', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [{ ...validItem, categoryCode: '' }],
    })).toBe('Item 1: categoryCode (ΑΤΟΕ) is required');
  });

  it('validates each item — error on 3rd item', () => {
    expect(validateCreateDTO({
      projectId: 'p', supplierId: 's',
      items: [validItem, validItem, { ...validItem, quantity: -1 }],
    })).toBe('Item 3: quantity must be > 0');
  });
});

// ============================================================================
// PO Financial Calculations
// ============================================================================

describe('PO financial calculations', () => {
  /** Mirror repository calculation logic */
  function calculatePOTotals(
    items: Array<{ quantity: number; unitPrice: number }>,
    taxRate: number,
  ): { subtotal: number; taxAmount: number; total: number } {
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    return { subtotal, taxAmount, total };
  }

  it('calculates subtotal, tax, and total correctly (24% VAT)', () => {
    const result = calculatePOTotals(
      [{ quantity: 100, unitPrice: 10 }, { quantity: 50, unitPrice: 20 }],
      24,
    );
    // subtotal = 1000 + 1000 = 2000
    // taxAmount = 2000 * 0.24 = 480
    // total = 2480
    expect(result.subtotal).toBe(2000);
    expect(result.taxAmount).toBe(480);
    expect(result.total).toBe(2480);
  });

  it('handles 0% VAT (ενδοκοινοτική)', () => {
    const result = calculatePOTotals([{ quantity: 10, unitPrice: 100 }], 0);
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(1000);
  });

  it('handles 13% reduced VAT', () => {
    const result = calculatePOTotals([{ quantity: 10, unitPrice: 100 }], 13);
    expect(result.subtotal).toBe(1000);
    expect(result.taxAmount).toBe(130);
    expect(result.total).toBe(1130);
  });

  it('rounds tax to 2 decimal places', () => {
    const result = calculatePOTotals([{ quantity: 3, unitPrice: 7.33 }], 24);
    // subtotal = 21.99, tax = 21.99 * 0.24 = 5.2776 → 5.28
    expect(result.subtotal).toBeCloseTo(21.99, 2);
    expect(result.taxAmount).toBeCloseTo(5.28, 2);
  });
});

// ============================================================================
// PO Number Format
// ============================================================================

describe('PO number format', () => {
  function formatPONumber(n: number): string {
    return `PO-${String(n).padStart(4, '0')}`;
  }

  it('pads single digit → PO-0001', () => {
    expect(formatPONumber(1)).toBe('PO-0001');
  });

  it('pads double digit → PO-0042', () => {
    expect(formatPONumber(42)).toBe('PO-0042');
  });

  it('pads triple digit → PO-0123', () => {
    expect(formatPONumber(123)).toBe('PO-0123');
  });

  it('no padding needed → PO-9999', () => {
    expect(formatPONumber(9999)).toBe('PO-9999');
  });

  it('overflow beyond 4 digits → PO-10000 (no truncation)', () => {
    expect(formatPONumber(10000)).toBe('PO-10000');
  });
});
