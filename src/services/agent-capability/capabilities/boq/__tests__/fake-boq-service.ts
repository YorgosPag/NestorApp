/**
 * Ψεύτικο `IBOQService` για τα tests των BOQ δυνατοτήτων.
 *
 * Δεν είναι test suite (δεν ταιριάζει στο `testMatch`) — μόνο υλοποίηση του
 * συμβολαίου πάνω σε πίνακα στη μνήμη. Χάρη στην ένεση εξαρτήσεων
 * (`BoqCapabilityDeps`) τα εργαλεία ελέγχονται **χωρίς** Firestore.
 *
 * ⚠️ Οι μέθοδοι εγγραφής ρίχνουν: αν κάποια δυνατότητα ανάγνωσης τις καλέσει,
 * το test σπάει — αυτό είναι ο έλεγχος «read-only», όχι το `readOnlyHint`.
 *
 * @module services/agent-capability/capabilities/boq/__tests__/fake-boq-service
 */

import type { BOQCategory, BOQItem, BOQSummary } from '@/types/boq';
import type { BOQSearchFilters, BOQStats, IBOQService } from '@/services/measurements/contracts';
import { computeBuildingSummary } from '@/services/measurements/cost-engine';

const WRITE_FORBIDDEN = 'Read-only capability called a write method.';

export interface FakeBoqOptions {
  readonly items: readonly BOQItem[];
  readonly categories?: readonly BOQCategory[];
  /** Προσομοιώνει την αστοχία που το πραγματικό service καταπίνει σε `null`. */
  readonly summaryFails?: boolean;
}

/** Καταγραφή κλήσεων — για να αποδεικνύεται ΤΙ κλήθηκε, όχι μόνο τι γύρισε. */
export interface FakeBoqCalls {
  getById: Array<{ companyId: string; itemId: string }>;
  getByBuilding: Array<{ companyId: string; buildingId: string }>;
  search: Array<{ companyId: string; buildingId: string; filters?: BOQSearchFilters }>;
  getCategories: string[];
}

export interface FakeBoqService {
  readonly service: IBOQService;
  readonly calls: FakeBoqCalls;
}

function tenantItems(items: readonly BOQItem[], companyId: string, buildingId: string): BOQItem[] {
  return items.filter((i) => i.companyId === companyId && i.buildingId === buildingId);
}

export function createFakeBoqService(options: FakeBoqOptions): FakeBoqService {
  const { items, categories = [], summaryFails = false } = options;

  const calls: FakeBoqCalls = { getById: [], getByBuilding: [], search: [], getCategories: [] };

  const service: IBOQService = {
    getByBuilding(companyId, buildingId) {
      calls.getByBuilding.push({ companyId, buildingId });
      return Promise.resolve(tenantItems(items, companyId, buildingId));
    },

    getByProject(companyId, projectId) {
      return Promise.resolve(items.filter((i) => i.companyId === companyId && i.projectId === projectId));
    },

    /**
     * ⚠️ **Τιμά τον tenant, όπως το πραγματικό service** (ADR-734 §7, επιλογή Β).
     *
     * Ξένη γραμμή επιστρέφει `null` — ίδιο αποτέλεσμα με ανύπαρκτη. Ένας ψεύτης
     * πιο ανεκτικός από την πραγματικότητα θα έκανε τα tests να περνούν για
     * λάθος λόγο: θα αποδείκνυαν ότι δουλεύει ο guard, ενώ η άμυνα έχει
     * μετακομίσει στο ίδιο το service.
     */
    getById(companyId, itemId) {
      calls.getById.push({ companyId, itemId });
      const found = items.find((i) => i.id === itemId) ?? null;
      return Promise.resolve(found?.companyId === companyId ? found : null);
    },

    search(companyId, buildingId, filters) {
      calls.search.push({ companyId, buildingId, filters });
      let result = tenantItems(items, companyId, buildingId);
      if (filters?.categoryCode !== undefined) {
        result = result.filter((i) => i.categoryCode === filters.categoryCode);
      }
      if (filters?.status !== undefined && filters.status !== 'all') {
        result = result.filter((i) => i.status === filters.status);
      }
      if (filters?.scope !== undefined) {
        result = result.filter((i) => i.scope === filters.scope);
      }
      if (filters?.searchText !== undefined) {
        const term = filters.searchText.toLowerCase();
        result = result.filter((i) => i.title.toLowerCase().includes(term));
      }
      return Promise.resolve(result);
    },

    getStatistics(companyId, buildingId): Promise<BOQStats> {
      const scoped = tenantItems(items, companyId, buildingId);
      const countBy = (status: BOQItem['status']): number =>
        scoped.filter((i) => i.status === status).length;
      return Promise.resolve({
        total: scoped.length,
        draft: countBy('draft'),
        submitted: countBy('submitted'),
        approved: countBy('approved'),
        certified: countBy('certified'),
        locked: countBy('locked'),
        totalEstimatedCost: scoped.reduce(
          (sum, i) =>
            sum
            + i.estimatedQuantity
              * (1 + i.wasteFactor)
              * (i.materialUnitCost + i.laborUnitCost + i.equipmentUnitCost),
          0,
        ),
      });
    },

    getCategories(companyId) {
      calls.getCategories.push(companyId);
      return Promise.resolve(categories.filter((c) => c.companyId === companyId));
    },

    getBuildingSummary(companyId, buildingId): Promise<BOQSummary | null> {
      const scoped = tenantItems(items, companyId, buildingId);
      if (summaryFails || scoped.length === 0) return Promise.resolve(null);
      return Promise.resolve(computeBuildingSummary(buildingId, scoped, new Map()));
    },

    create() { throw new Error(WRITE_FORBIDDEN); },
    update() { throw new Error(WRITE_FORBIDDEN); },
    delete() { throw new Error(WRITE_FORBIDDEN); },
    bulkDelete() { throw new Error(WRITE_FORBIDDEN); },
    duplicate() { throw new Error(WRITE_FORBIDDEN); },
    transition() { throw new Error(WRITE_FORBIDDEN); },
    reopenToDraft() { throw new Error(WRITE_FORBIDDEN); },
  };

  return { service, calls };
}
