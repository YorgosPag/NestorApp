/**
 * @fileoverview Bank Match — Structured Error Codes (RFC 9457)
 * @description Enterprise error catalog for bank matching/reconciliation
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see AUDIT-2026-03-29.md Q5 — Structured Errors
 * @compliance RFC 9457 Problem Details for HTTP APIs
 */

// ============================================================================
// ERROR CODE PREFIXES
// ============================================================================
// BANK_VAL_xxx   — Validation errors (input data)
// BANK_MATCH_xxx — Matching logic errors
// BANK_CONC_xxx  — Concurrency errors
// BANK_PERIOD_xxx — Fiscal period errors
// BANK_RECON_xxx — Reconciliation errors

// ============================================================================
// ERROR CODE CATALOG
// ============================================================================

export const BANK_ERROR_CODES = {
  // Validation
  BANK_VAL_001: 'INVALID_AMOUNT',
  BANK_VAL_002: 'ZERO_AMOUNT',
  BANK_VAL_003: 'INVALID_ENTITY_TYPE',
  BANK_VAL_004: 'BATCH_SIZE_EXCEEDED',
  BANK_VAL_005: 'INVALID_TRANSACTION_ID',

  // Matching
  BANK_MATCH_001: 'ALREADY_MATCHED',
  BANK_MATCH_002: 'AMOUNT_MISMATCH',
  BANK_MATCH_003: 'DUPLICATE_MATCH',
  BANK_MATCH_004: 'DIRECTION_MISMATCH',
  BANK_MATCH_005: 'TRANSACTION_NOT_FOUND',
  BANK_MATCH_006: 'ENTITY_NOT_FOUND',

  // Concurrency
  BANK_CONC_001: 'VERSION_CONFLICT',

  // Fiscal Period
  BANK_PERIOD_001: 'PERIOD_CLOSED',
  BANK_PERIOD_002: 'PERIOD_LOCKED',
  BANK_PERIOD_003: 'PERIOD_NOT_FOUND',

  // Reconciliation
  BANK_RECON_001: 'NOT_MATCHED',
  BANK_RECON_002: 'ALREADY_RECONCILED',
  BANK_RECON_003: 'SEGREGATION_VIOLATION',
  BANK_RECON_004: 'UNLOCK_REASON_REQUIRED',
  BANK_RECON_005: 'NOT_RECONCILED',
} as const;

export type BankErrorCode = typeof BANK_ERROR_CODES[keyof typeof BANK_ERROR_CODES];

// ============================================================================
// RFC 9457 ERROR RESPONSE
// ============================================================================

/** RFC 9457 Problem Details format */
export interface BankMatchProblem {
  /** URI reference (always "about:blank" for now) */
  type: string;
  /** Short human-readable title */
  title: string;
  /** HTTP status code */
  status: number;
  /** Machine-readable error code */
  code: BankErrorCode;
  /** Detailed human-readable description */
  detail: string;
  /** Additional context */
  meta?: Record<string, string | number | boolean | null>;
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export function createBankMatchError(
  code: BankErrorCode,
  detail: string,
  status: number = 400,
  meta?: BankMatchProblem['meta']
): BankMatchProblem {
  return {
    type: 'about:blank',
    title: bankErrorTitle(code),
    status,
    code,
    detail,
    meta,
  };
}

function bankErrorTitle(code: BankErrorCode): string {
  const titles: Record<BankErrorCode, string> = {
    INVALID_AMOUNT: 'Invalid Amount',
    ZERO_AMOUNT: 'Zero Amount Not Allowed',
    INVALID_ENTITY_TYPE: 'Invalid Entity Type',
    BATCH_SIZE_EXCEEDED: 'Batch Size Exceeded',
    INVALID_TRANSACTION_ID: 'Invalid Transaction ID',
    ALREADY_MATCHED: 'Transaction Already Matched',
    AMOUNT_MISMATCH: 'Amount Mismatch',
    DUPLICATE_MATCH: 'Duplicate Match',
    DIRECTION_MISMATCH: 'Direction Mismatch',
    TRANSACTION_NOT_FOUND: 'Transaction Not Found',
    ENTITY_NOT_FOUND: 'Entity Not Found',
    VERSION_CONFLICT: 'Concurrency Conflict',
    PERIOD_CLOSED: 'Fiscal Period Closed',
    PERIOD_LOCKED: 'Fiscal Period Locked',
    PERIOD_NOT_FOUND: 'Fiscal Period Not Found',
    NOT_MATCHED: 'Transaction Not Matched',
    ALREADY_RECONCILED: 'Already Reconciled',
    SEGREGATION_VIOLATION: 'Segregation of Duties Violation',
    UNLOCK_REASON_REQUIRED: 'Unlock Reason Required',
    NOT_RECONCILED: 'Transaction Not Reconciled',
  };
  return titles[code];
}
