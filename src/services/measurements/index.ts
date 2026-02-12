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
  computeBuildingSummary,
} from './cost-engine';

/** Pre-configured singleton instance */
export const boqService = _BOQService.getInstance();
