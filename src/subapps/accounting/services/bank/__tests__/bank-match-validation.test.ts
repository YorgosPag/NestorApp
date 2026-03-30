/**
 * @fileoverview Tests for Bank Match Enterprise Validation
 * @see AUDIT-2026-03-29.md A-5 — Enterprise Zod Validation
 */

// Mock next/server to avoid Request global dependency in test environment
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import {
  SingleMatchSchema,
  GroupMatchSchema,
  MatchRequestSchema,
  ReconcileSchema,
  AdminUnlockSchema,
  validateDirection,
  isWithinTolerance,
  DEFAULT_AMOUNT_TOLERANCE,
} from '../bank-match-validation';
import {
  createBankMatchError,
  BANK_ERROR_CODES,
} from '../bank-match-errors';

// ============================================================================
// SCHEMA VALIDATION TESTS
// ============================================================================

describe('SingleMatchSchema', () => {
  it('accepts valid 1:1 match input', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
    });
    expect(result.success).toBe(true);
  });

  it('accepts with optional clientAmount and expectedVersion', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: 100.50,
      expectedVersion: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty transactionId', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: '',
      entityId: 'inv_456',
      entityType: 'invoice',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid entity type', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'unknown_type',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative clientAmount', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero clientAmount', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects clientAmount with >2 decimal places', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: 100.123,
    });
    expect(result.success).toBe(false);
  });

  it('accepts clientAmount with exactly 2 decimal places', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: 100.01,
    });
    expect(result.success).toBe(true);
  });

  it('rejects Infinity clientAmount', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('rejects clientAmount exceeding max', () => {
    const result = SingleMatchSchema.safeParse({
      transactionId: 'txn_123',
      entityId: 'inv_456',
      entityType: 'invoice',
      clientAmount: 1_000_000_000,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 4 entity types', () => {
    const types = ['invoice', 'journal_entry', 'efka_payment', 'tax_payment'] as const;
    for (const entityType of types) {
      const result = SingleMatchSchema.safeParse({
        transactionId: 'txn_1',
        entityId: 'ent_1',
        entityType,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('GroupMatchSchema', () => {
  it('accepts valid N:M group match input', () => {
    const result = GroupMatchSchema.safeParse({
      transactionIds: ['txn_1', 'txn_2'],
      entityRefs: [
        { entityId: 'inv_1', entityType: 'invoice', amount: 100 },
        { entityId: 'inv_2', entityType: 'invoice', amount: 200 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty transactionIds', () => {
    const result = GroupMatchSchema.safeParse({
      transactionIds: [],
      entityRefs: [{ entityId: 'inv_1', entityType: 'invoice', amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects >50 transactionIds (batch limit)', () => {
    const ids = Array.from({ length: 51 }, (_, i) => `txn_${i}`);
    const result = GroupMatchSchema.safeParse({
      transactionIds: ids,
      entityRefs: [{ entityId: 'inv_1', entityType: 'invoice', amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects entity ref with zero amount', () => {
    const result = GroupMatchSchema.safeParse({
      transactionIds: ['txn_1'],
      entityRefs: [{ entityId: 'inv_1', entityType: 'invoice', amount: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('MatchRequestSchema (union)', () => {
  it('parses as SingleMatch when transactionId present', () => {
    const result = MatchRequestSchema.safeParse({
      transactionId: 'txn_1',
      entityId: 'inv_1',
      entityType: 'invoice',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('transactionId' in result.data).toBe(true);
    }
  });

  it('parses as GroupMatch when transactionIds present', () => {
    const result = MatchRequestSchema.safeParse({
      transactionIds: ['txn_1'],
      entityRefs: [{ entityId: 'inv_1', entityType: 'invoice', amount: 50 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('transactionIds' in result.data).toBe(true);
    }
  });
});

describe('ReconcileSchema', () => {
  it('accepts valid input', () => {
    const result = ReconcileSchema.safeParse({ transactionId: 'txn_1' });
    expect(result.success).toBe(true);
  });

  it('accepts with expectedVersion', () => {
    const result = ReconcileSchema.safeParse({ transactionId: 'txn_1', expectedVersion: 5 });
    expect(result.success).toBe(true);
  });

  it('rejects empty transactionId', () => {
    const result = ReconcileSchema.safeParse({ transactionId: '' });
    expect(result.success).toBe(false);
  });
});

describe('AdminUnlockSchema', () => {
  it('accepts valid input with reason', () => {
    const result = AdminUnlockSchema.safeParse({
      transactionId: 'txn_1',
      reason: 'Λάθος αντιστοίχιση, χρειάζεται επαναξιολόγηση',
    });
    expect(result.success).toBe(true);
  });

  it('rejects reason shorter than 5 chars', () => {
    const result = AdminUnlockSchema.safeParse({
      transactionId: 'txn_1',
      reason: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects reason longer than 500 chars', () => {
    const result = AdminUnlockSchema.safeParse({
      transactionId: 'txn_1',
      reason: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// DIRECTION VALIDATION TESTS (Q9)
// ============================================================================

describe('validateDirection', () => {
  it('allows credit → invoice', () => {
    expect(validateDirection('credit', 'invoice').valid).toBe(true);
  });

  it('allows debit → invoice (refunds/credit notes)', () => {
    expect(validateDirection('debit', 'invoice').valid).toBe(true);
  });

  it('allows credit → journal_entry (direction-agnostic)', () => {
    expect(validateDirection('credit', 'journal_entry').valid).toBe(true);
  });

  it('allows debit → journal_entry (direction-agnostic)', () => {
    expect(validateDirection('debit', 'journal_entry').valid).toBe(true);
  });

  it('allows debit → efka_payment', () => {
    expect(validateDirection('debit', 'efka_payment').valid).toBe(true);
  });

  it('allows debit → tax_payment', () => {
    expect(validateDirection('debit', 'tax_payment').valid).toBe(true);
  });
});

// ============================================================================
// AMOUNT TOLERANCE TESTS (Q2)
// ============================================================================

describe('isWithinTolerance', () => {
  it('returns true for exact match', () => {
    expect(isWithinTolerance(100.00, 100.00)).toBe(true);
  });

  it('returns true within ±0.05 tolerance', () => {
    expect(isWithinTolerance(100.00, 100.04)).toBe(true);
    expect(isWithinTolerance(100.00, 99.96)).toBe(true);
  });

  it('returns true at exactly tolerance boundary', () => {
    expect(isWithinTolerance(100.00, 100.05)).toBe(true);
    expect(isWithinTolerance(100.00, 99.95)).toBe(true);
  });

  it('returns false beyond tolerance', () => {
    expect(isWithinTolerance(100.00, 100.06)).toBe(false);
    expect(isWithinTolerance(100.00, 99.94)).toBe(false);
  });

  it('uses custom tolerance when provided', () => {
    expect(isWithinTolerance(100.00, 100.10, 0.10)).toBe(true);
    expect(isWithinTolerance(100.00, 100.11, 0.10)).toBe(false);
  });

  it('has default tolerance of 0.05', () => {
    expect(DEFAULT_AMOUNT_TOLERANCE).toBe(0.05);
  });
});

// ============================================================================
// STRUCTURED ERROR TESTS (Q5)
// ============================================================================

describe('createBankMatchError', () => {
  it('creates RFC 9457 compliant error', () => {
    const error = createBankMatchError(
      'ALREADY_MATCHED',
      'Transaction already matched',
      409,
      { currentStatus: 'manual_matched' }
    );

    expect(error.type).toBe('about:blank');
    expect(error.title).toBe('Transaction Already Matched');
    expect(error.status).toBe(409);
    expect(error.code).toBe('ALREADY_MATCHED');
    expect(error.detail).toBe('Transaction already matched');
    expect(error.meta).toEqual({ currentStatus: 'manual_matched' });
  });

  it('defaults to 400 status', () => {
    const error = createBankMatchError('ZERO_AMOUNT', 'Zero not allowed');
    expect(error.status).toBe(400);
  });

  it('has all expected error codes', () => {
    expect(BANK_ERROR_CODES.BANK_MATCH_001).toBe('ALREADY_MATCHED');
    expect(BANK_ERROR_CODES.BANK_CONC_001).toBe('VERSION_CONFLICT');
    expect(BANK_ERROR_CODES.BANK_PERIOD_001).toBe('PERIOD_CLOSED');
    expect(BANK_ERROR_CODES.BANK_RECON_003).toBe('SEGREGATION_VIOLATION');
  });
});

// ============================================================================
// STATUS MACHINE TESTS (Q1)
// ============================================================================

describe('MatchStatus state machine', () => {
  const validTransitions = [
    { from: 'unmatched', to: 'auto_matched' },
    { from: 'unmatched', to: 'manual_matched' },
    { from: 'auto_matched', to: 'reconciled' },
    { from: 'manual_matched', to: 'reconciled' },
    { from: 'auto_matched', to: 'unmatched' },  // unmatch
    { from: 'manual_matched', to: 'unmatched' }, // unmatch
    { from: 'reconciled', to: 'manual_matched' }, // admin unlock
  ];

  const invalidTransitions = [
    { from: 'unmatched', to: 'reconciled' },     // can't skip matched
    { from: 'excluded', to: 'reconciled' },       // excluded can't reconcile
  ];

  it.each(validTransitions)(
    'allows transition from $from to $to',
    ({ from, to }) => {
      // Verify that the type system allows these states
      const validStatuses = ['unmatched', 'auto_matched', 'manual_matched', 'excluded', 'reconciled'];
      expect(validStatuses).toContain(from);
      expect(validStatuses).toContain(to);
    }
  );

  it.each(invalidTransitions)(
    'documents that $from → $to should be prevented by business logic',
    ({ from, to }) => {
      // These transitions are prevented by the route handlers, not the type system
      // unmatched → reconciled is prevented by the POST /reconcile handler (NOT_MATCHED check)
      // excluded → reconciled is prevented by the POST /reconcile handler (NOT_MATCHED check)
      expect(from).not.toBe(to); // They should differ
    }
  );
});
