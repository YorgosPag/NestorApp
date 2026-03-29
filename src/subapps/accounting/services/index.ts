/**
 * @fileoverview Accounting Services — Barrel Exports
 * @description Minimal barrel: factory + helpers + types only.
 *
 * ARCHITECTURE NOTE — TDZ PREVENTION:
 * The factory (create-accounting-services.ts) imports the same sub-modules
 * (AccountingService, VATEngine, etc.) that were previously re-exported here.
 * This creates a diamond dependency in Webpack: barrel → sub-module AND
 * barrel → factory → sub-module. During minification, the binding is not
 * yet initialized when the factory tries to read it → TDZ error:
 * "Cannot access 'f' before initialization".
 *
 * SOLUTION: Only re-export the factory, helpers, and type interfaces.
 * All class/engine/config exports are consumed ONLY by the factory internally.
 * If external code needs them, import directly from the sub-module path.
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 3.0.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 */

// ── Factory ─────────────────────────────────────────────────────────────────
export { createAccountingServices } from './create-accounting-services';

// ── Helpers (used by API routes: isoNow, isoToday, getQuarterFromDate) ────
export {
  sanitizeForFirestore,
  isoNow,
  isoToday,
  getQuarterFromDate,
  getFiscalYearFromDate,
} from './repository/firestore-helpers';

// ── Reversal Service (standalone functions — no TDZ risk) ─────────────────
export {
  reverseJournalEntryForCancelledInvoice,
  createCreditNoteForInvoice,
} from './reversal-service';

// ── Balance Service (standalone functions — no TDZ risk) ─────────────────
export {
  calculateAgingBuckets,
  recalculateCustomerBalance,
  updateCustomerBalance,
  reconcileAllBalances,
  checkCreditLimit,
} from './balance-service';

// ── Fiscal Period Service (standalone functions — no TDZ risk) ───────────
export {
  createFiscalYear,
  getPeriodForDate,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  validatePostingAllowed,
  getCurrentOpenPeriod,
  getYearEndChecklist,
} from './fiscal-period-service';

// ── Types (type-only re-exports — erased at runtime, no TDZ risk) ─────────
export type {
  IAccountingRepository,
  IVATEngine,
  ITaxEngine,
  IDepreciationEngine,
  IMatchingEngine,
  IMyDataService,
  ICSVImportService,
  IDocumentAnalyzer,
} from '../types/interfaces';
