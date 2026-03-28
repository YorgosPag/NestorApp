/**
 * Procurement Services — Barrel Export
 * @module services/procurement
 * @see ADR-267: Lightweight Procurement Module
 */

export {
  createPO,
  getPO,
  listPOs,
  updatePO,
  approvePO,
  markOrdered,
  closePO,
  cancelPO,
  recordPODelivery,
  linkInvoiceToPO,
  deletePO,
  duplicatePO,
  getPriceHistory,
  type PriceHistoryEntry,
} from './procurement-service';

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
