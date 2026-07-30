/**
 * Κοινά fixtures για τα tests του VQE.
 *
 * Δεν είναι test suite (δεν ταιριάζει στο `testMatch`) — μόνο εργοστάσιο
 * δεδομένων, ώστε κάθε suite να δηλώνει **μόνο** ό,τι αφορά τον έλεγχό της.
 *
 * @module services/agent-capability/vqe/__tests__/vqe-test-fixtures
 */

import type { BOQItem } from '@/types/boq';

const BASE_ITEM: BOQItem = {
  id: 'boq-1',
  companyId: 'co-1',
  projectId: 'prj-1',
  buildingId: 'bld-1',
  scope: 'building',
  linkedFloorId: null,
  linkedUnitId: null,
  linkedUnitIds: null,
  costAllocationMethod: 'by_area',
  customAllocations: null,
  categoryCode: 'OIK-2',
  subCategoryCode: null,
  title: 'fixture item',
  description: null,
  unit: 'm3',
  estimatedQuantity: 100,
  actualQuantity: null,
  wasteFactor: 0.05,
  wastePolicy: 'inherited',
  materialUnitCost: 10,
  laborUnitCost: 5,
  equipmentUnitCost: 2,
  priceAuthority: 'master',
  linkedPhaseId: null,
  linkedTaskId: null,
  linkedInvoiceId: null,
  linkedContractorId: null,
  source: 'manual',
  measurementMethod: 'manual',
  status: 'draft',
  qaStatus: 'pending',
  notes: null,
  createdBy: null,
  approvedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** BOQ item με ρητές μόνο τις ιδιότητες που ενδιαφέρουν τον εκάστοτε έλεγχο. */
export function makeItem(overrides: Partial<BOQItem> = {}): BOQItem {
  return { ...BASE_ITEM, ...overrides };
}

/** Σταθερό ISO timestamp — το ρολόι δεν συμμετέχει ποτέ σε assertion. */
export const FIXED_NOW = '2026-07-30T12:00:00.000Z';
