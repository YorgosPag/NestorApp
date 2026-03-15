/**
 * ADR-235: Ownership Table — Barrel Export
 */

export {
  roundWithLargestRemainder,
  calculateByArea,
  calculateByValue,
  calculateByVolume,
  validateTotal,
  calculateCategorySummary,
  calculateBartexSummary,
} from './ownership-calculation-engine';

export {
  getTable,
  getRevisions,
  createTable,
  saveTable,
  finalizeTable,
  unlockTable,
  autoPopulateRows,
} from './ownership-table-service';
