/**
 * Procurement Services — Barrel Export
 * @module services/procurement
 * @see ADR-267: Lightweight Procurement Module
 */

export {
  createPO,
  listPOs,
  updatePO,
  recordPODelivery,
  deletePO,
  duplicatePO,
  getPriceHistory,
  type PriceHistoryEntry,
} from './procurement-service';

export {
  approvePO,
  markOrdered,
  closePO,
  cancelPO,
} from './po-status-service';

export { findOwnedPO } from './po-tenant-scope';

export {
  getNextPONumber,
  type POListFilters,
} from './procurement-repository';

export { matchInvoiceToPO } from './po-invoice-matcher';

export {
  calculateSupplierMetrics,
  getSupplierComparison,
  getSupplierPriceTrend,
} from './supplier-metrics-service';
