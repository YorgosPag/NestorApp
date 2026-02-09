/**
 * @fileoverview Accounting Services — Factory & Barrel Exports
 * @description Factory function to instantiate the full accounting service stack
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ── Services ────────────────────────────────────────────────────────────────
export { AccountingService } from './accounting-service';

// ── Repository ──────────────────────────────────────────────────────────────
export { FirestoreAccountingRepository } from './repository/firestore-accounting-repository';

// ── Engines ─────────────────────────────────────────────────────────────────
export { VATEngine } from './engines/vat-engine';
export { TaxEngine } from './engines/tax-engine';
export { DepreciationEngine } from './engines/depreciation-engine';

// ── Config ──────────────────────────────────────────────────────────────────
export {
  GREEK_VAT_RATES,
  getVatRateForDate,
  getVatDeductibilityRules,
  getMyDataVatCategory,
} from './config/vat-config';
export {
  GREEK_TAX_SCALES,
  getTaxScaleForYear,
  getAvailableTaxYears,
} from './config/tax-config';
export {
  DEPRECIATION_RATES,
  getDepreciationRate,
  calculateUsefulLife,
} from './config/depreciation-config';
export {
  EFKA_YEAR_CONFIGS,
  getEfkaConfigForYear,
  calculateMonthlyBreakdown,
  calculateAnnualTotal,
} from './config/efka-config';

// ── Helpers ─────────────────────────────────────────────────────────────────
export {
  sanitizeForFirestore,
  isoNow,
  isoToday,
  getQuarterFromDate,
  getFiscalYearFromDate,
} from './repository/firestore-helpers';

// ── Types (re-export from types for convenience) ────────────────────────────
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

// ============================================================================
// FACTORY — Instantiate Full Accounting Service Stack
// ============================================================================

import { FirestoreAccountingRepository } from './repository/firestore-accounting-repository';
import { VATEngine } from './engines/vat-engine';
import { TaxEngine } from './engines/tax-engine';
import { DepreciationEngine } from './engines/depreciation-engine';
import { AccountingService } from './accounting-service';

/**
 * Δημιουργία πλήρους stack λογιστικών services
 *
 * Factory pattern — instantiates repository, engines, and orchestrator.
 *
 * @example
 * ```typescript
 * const { service, repository, vatEngine, taxEngine, depreciationEngine } = createAccountingServices();
 *
 * // Use the orchestrator
 * const vatSummary = await service.getVATQuarterDashboard(2026, 1);
 *
 * // Or use individual engines
 * const vatCalc = vatEngine.calculateOutputVat(1000, 24);
 * ```
 */
export function createAccountingServices() {
  const repository = new FirestoreAccountingRepository();
  const vatEngine = new VATEngine(repository);
  const taxEngine = new TaxEngine(repository);
  const depreciationEngine = new DepreciationEngine(repository);
  const service = new AccountingService(repository, vatEngine, taxEngine, depreciationEngine);

  return {
    service,
    repository,
    vatEngine,
    taxEngine,
    depreciationEngine,
  };
}
