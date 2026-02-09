/**
 * @fileoverview Accounting Services — Factory Function
 * @description Separate module for the factory to avoid duplicate import bindings
 *              with the barrel export in index.ts (causes TDZ errors in Webpack)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-10
 * @version 2.0.0
 * @see ADR-ACC-010 Portability & Abstraction Layers
 *
 * NOTE: Document analyzer is NOT included in this factory.
 * It is loaded on-demand only by routes that need it (/api/accounting/documents)
 * to avoid TDZ errors from openai-document-analyzer's module evaluation.
 */

import { AccountingService } from './accounting-service';
import { FirestoreAccountingRepository } from './repository/firestore-accounting-repository';
import { VATEngine } from './engines/vat-engine';
import { TaxEngine } from './engines/tax-engine';
import { DepreciationEngine } from './engines/depreciation-engine';

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
