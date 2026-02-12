/**
 * BOQ Service Contracts — Interfaces
 *
 * Repository και Service interfaces για το σύστημα επιμετρήσεων.
 * Pattern: src/services/obligations/contracts.ts
 *
 * @module services/measurements/contracts
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import type {
  BOQItem,
  BOQCategory,
  BOQSummary,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
  BOQFilters,
} from '@/types/boq';

// ============================================================================
// SEARCH FILTERS
// ============================================================================

export type BOQSearchFilters = BOQFilters;

// ============================================================================
// STATISTICS
// ============================================================================

export interface BOQStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  certified: number;
  locked: number;
  totalEstimatedCost: number;
}

// ============================================================================
// REPOSITORY INTERFACE — CRUD + QUERIES
// ============================================================================

export interface IBOQRepository {
  /** Λήψη όλων των items ανά building */
  getByBuilding(buildingId: string): Promise<BOQItem[]>;

  /** Λήψη ενός item βάσει ID */
  getById(id: string): Promise<BOQItem | null>;

  /** Δημιουργία νέου item */
  create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem>;

  /** Ενημέρωση item */
  update(id: string, data: UpdateBOQItemInput): Promise<BOQItem | null>;

  /** Διαγραφή item */
  delete(id: string): Promise<boolean>;

  /** Μαζική διαγραφή */
  bulkDelete(ids: string[]): Promise<number>;

  /** Αντιγραφή item */
  duplicate(id: string): Promise<BOQItem | null>;

  /** Αλλαγή status */
  updateStatus(id: string, status: BOQItemStatus, userId: string): Promise<boolean>;

  /** Αναζήτηση με φίλτρα */
  search(buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]>;

  /** Στατιστικά ανά building */
  getStatistics(buildingId: string): Promise<BOQStats>;

  /** Λήψη κατηγοριών (ΑΤΟΕ) */
  getCategories(companyId: string): Promise<BOQCategory[]>;
}

// ============================================================================
// SERVICE INTERFACE — BUSINESS LOGIC + GOVERNANCE
// ============================================================================

export interface IBOQService {
  /** Λήψη items ανά building */
  getByBuilding(buildingId: string): Promise<BOQItem[]>;

  /** Λήψη ενός item */
  getById(id: string): Promise<BOQItem | null>;

  /** Δημιουργία item (validation + defaults) */
  create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem>;

  /** Ενημέρωση item (validation + governance check) */
  update(id: string, data: UpdateBOQItemInput): Promise<BOQItem | null>;

  /** Διαγραφή item (μόνο draft) */
  delete(id: string): Promise<boolean>;

  /** Μαζική διαγραφή (μόνο draft) */
  bulkDelete(ids: string[]): Promise<number>;

  /** Αντιγραφή item */
  duplicate(id: string): Promise<BOQItem | null>;

  /** Governance transition (draft→submitted→approved→certified→locked) */
  transition(id: string, targetStatus: BOQItemStatus, userId: string): Promise<boolean>;

  /** Αναζήτηση */
  search(buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]>;

  /** Στατιστικά */
  getStatistics(buildingId: string): Promise<BOQStats>;

  /** Κατηγορίες ΑΤΟΕ */
  getCategories(companyId: string): Promise<BOQCategory[]>;

  /** Σύνοψη κτιρίου (αθροιστικά) */
  getBuildingSummary(buildingId: string): Promise<BOQSummary | null>;
}
