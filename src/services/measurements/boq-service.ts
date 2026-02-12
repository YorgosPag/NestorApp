/**
 * BOQ Service — Business Logic & Governance
 *
 * Singleton service που wraps τo repository, προσθέτει validation,
 * governance transitions, default values, και cost computation.
 *
 * Pattern: src/services/obligations/ObligationsService.ts
 *
 * @module services/measurements/boq-service
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import type {
  BOQItem,
  BOQCategory,
  BOQSummary,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { IBOQService, IBOQRepository, BOQSearchFilters, BOQStats } from './contracts';
import { FirestoreBOQRepository } from './boq-repository';
import { computeBuildingSummary } from './cost-engine';
import { getDefaultWasteFactor } from '@/config/boq-categories';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BOQService');

// ============================================================================
// GOVERNANCE — ALLOWED TRANSITIONS
// ============================================================================

/** Επιτρεπόμενες μεταβάσεις status: from → [to] */
const BOQ_ALLOWED_TRANSITIONS: Record<BOQItemStatus, BOQItemStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'draft'],
  approved: ['certified', 'submitted'],
  certified: ['locked', 'approved'],
  locked: [],
};

/**
 * Validate status transition
 */
function isTransitionAllowed(from: BOQItemStatus, to: BOQItemStatus): boolean {
  if (from === to) return true;
  return BOQ_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

class BOQService implements IBOQService {
  private static instance: BOQService;
  private repository: IBOQRepository;

  private constructor(repository: IBOQRepository) {
    this.repository = repository;
  }

  public static getInstance(): BOQService {
    if (!BOQService.instance) {
      const repository = new FirestoreBOQRepository();
      BOQService.instance = new BOQService(repository);
    }
    return BOQService.instance;
  }

  // --- READ ---

  getByBuilding(buildingId: string): Promise<BOQItem[]> {
    return this.repository.getByBuilding(buildingId);
  }

  getById(id: string): Promise<BOQItem | null> {
    return this.repository.getById(id);
  }

  // --- CREATE ---

  async create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem> {
    // Validation
    if (!data.title.trim()) {
      throw new Error('VALIDATION_ERROR: Ο τίτλος είναι υποχρεωτικός');
    }
    if (!data.buildingId) {
      throw new Error('VALIDATION_ERROR: Το building ID είναι υποχρεωτικό');
    }
    if (!data.projectId) {
      throw new Error('VALIDATION_ERROR: Το project ID είναι υποχρεωτικό');
    }
    if (data.estimatedQuantity < 0) {
      throw new Error('VALIDATION_ERROR: Η ποσότητα δεν μπορεί να είναι αρνητική');
    }

    // Apply default waste factor from category if not provided
    const wasteFactor = data.wasteFactor ?? getDefaultWasteFactor(data.categoryCode);

    const enrichedData: CreateBOQItemInput = {
      ...data,
      wasteFactor,
    };

    return this.repository.create(enrichedData, userId, companyId);
  }

  // --- UPDATE ---

  async update(id: string, data: UpdateBOQItemInput): Promise<BOQItem | null> {
    const current = await this.repository.getById(id);
    if (!current) {
      return null;
    }

    // Governance: locked items cannot be updated
    if (current.status === 'locked') {
      logger.warn('Attempted to update locked BOQ item', { id });
      throw new Error('GOVERNANCE_ERROR: Κλειδωμένο item — δεν επιτρέπεται ενημέρωση');
    }

    // Governance: certified items — μόνο actualQuantity
    if (current.status === 'certified') {
      const allowedFieldsForCertified: (keyof UpdateBOQItemInput)[] = ['actualQuantity', 'qaStatus', 'notes'];
      const attemptedFields = Object.keys(data) as (keyof UpdateBOQItemInput)[];
      const disallowedFields = attemptedFields.filter((f) => !allowedFieldsForCertified.includes(f));

      if (disallowedFields.length > 0) {
        logger.warn('Attempted to modify certified BOQ item beyond allowed fields', { id, disallowedFields });
        throw new Error(
          `GOVERNANCE_ERROR: Πιστοποιημένο item — μόνο actualQuantity/qaStatus/notes επιτρέπονται`
        );
      }
    }

    // Validation: quantities cannot be negative
    if (data.estimatedQuantity !== undefined && data.estimatedQuantity < 0) {
      throw new Error('VALIDATION_ERROR: Η ποσότητα δεν μπορεί να είναι αρνητική');
    }
    if (data.actualQuantity !== undefined && data.actualQuantity !== null && data.actualQuantity < 0) {
      throw new Error('VALIDATION_ERROR: Η πραγματική ποσότητα δεν μπορεί να είναι αρνητική');
    }

    return this.repository.update(id, data);
  }

  // --- DELETE ---

  async delete(id: string): Promise<boolean> {
    const current = await this.repository.getById(id);
    if (!current) {
      return false;
    }

    // Governance: μόνο draft items μπορούν να διαγραφούν
    if (current.status !== 'draft') {
      logger.warn('Attempted to delete non-draft BOQ item', { id, status: current.status });
      throw new Error('GOVERNANCE_ERROR: Μόνο draft items μπορούν να διαγραφούν');
    }

    return this.repository.delete(id);
  }

  async bulkDelete(ids: string[]): Promise<number> {
    // Validate all items are draft before deleting
    let deletedCount = 0;
    for (const id of ids) {
      try {
        const success = await this.delete(id);
        if (success) {
          deletedCount += 1;
        }
      } catch {
        // Skip non-draft items silently (governance prevents deletion)
      }
    }
    return deletedCount;
  }

  // --- DUPLICATE ---

  duplicate(id: string): Promise<BOQItem | null> {
    return this.repository.duplicate(id);
  }

  // --- GOVERNANCE TRANSITIONS ---

  async transition(id: string, targetStatus: BOQItemStatus, userId: string): Promise<boolean> {
    const current = await this.repository.getById(id);
    if (!current) {
      logger.warn('BOQ item not found for transition', { id });
      return false;
    }

    if (!isTransitionAllowed(current.status, targetStatus)) {
      logger.warn('Invalid BOQ status transition', {
        id,
        fromStatus: current.status,
        toStatus: targetStatus,
      });
      return false;
    }

    return this.repository.updateStatus(id, targetStatus, userId);
  }

  // --- SEARCH & STATS ---

  search(buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]> {
    return this.repository.search(buildingId, filters);
  }

  getStatistics(buildingId: string): Promise<BOQStats> {
    return this.repository.getStatistics(buildingId);
  }

  // --- CATEGORIES ---

  getCategories(companyId: string): Promise<BOQCategory[]> {
    return this.repository.getCategories(companyId);
  }

  // --- BUILDING SUMMARY ---

  async getBuildingSummary(buildingId: string): Promise<BOQSummary | null> {
    try {
      const items = await this.repository.getByBuilding(buildingId);
      if (items.length === 0) {
        return null;
      }

      // Build category name map from the items' categories
      const categoryCodes = [...new Set(items.map((i) => i.categoryCode))];
      const categoryNames = new Map<string, string>();

      // Try to get category names — fallback to code
      const firstItem = items[0];
      if (firstItem) {
        const categories = await this.repository.getCategories(firstItem.companyId);
        for (const cat of categories) {
          categoryNames.set(cat.code, cat.nameEL);
        }
      }

      // Ensure all codes have a name
      for (const code of categoryCodes) {
        if (!categoryNames.has(code)) {
          categoryNames.set(code, code);
        }
      }

      return computeBuildingSummary(buildingId, items, categoryNames);
    } catch (error) {
      logger.error('Error computing building summary', { error, buildingId });
      return null;
    }
  }
}

export { BOQService };
