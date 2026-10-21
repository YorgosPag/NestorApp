/**
 * BOQ / Measurements Services — Barrel Exports
 *
 * @module services/measurements
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import { BOQService as _BOQService } from './boq-service';

// Contracts
export type { IBOQRepository, IBOQService, BOQSearchFilters, BOQStats } from './contracts';

// Repository
export { FirestoreBOQRepository } from './boq-repository';

// Service (singleton)
export { BOQService } from './boq-service';

// Cost engine (pure functions)
export {
  computeGrossQuantity,
  computeItemCost,
  computeVariance,
  computeBaselineDrift,
  computeBuildingSummary,
} from './cost-engine';

// «Μετράει η γραμμή;» — ο ΕΝΑΣ ορισμός για κάθε αθροιστή (ADR-917 Λ7)
export { countableBoqLines, excludedSummaryIds, isSummaryBoqLine } from './boq-line-role';
export { deriveSummaryCost, derivedSummaryCosts, groupBoqCost, type DerivedSummaryCost } from './boq-cost-groups';

/** Pre-configured singleton instance */
export const boqService = _BOQService.getInstance();
