/**
 * 🛒 ENTERPRISE PROCUREMENT FILTERS CONFIGURATION
 *
 * Single source of truth per i filtri della pagina Procurement.
 * Segue lo stesso pattern di parkingFiltersConfig.ts / storageFiltersConfig.ts.
 *
 * @see ADR-267 Phase E — Procurement Layout Unification
 */

import type { FilterPanelConfig } from '../types';
import type { POFilters, PurchaseOrderStatus } from '@/types/procurement';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

// =============================================================================
// 🛒 PROCUREMENT FILTER STATE TYPE
// =============================================================================

/**
 * Filter state compatibile con GenericFilterState.
 * L'indice signature [key: string]: unknown è richiesto da AdvancedFiltersPanel.
 */
export interface ProcurementFilterState {
  [key: string]: unknown;
  searchTerm: string;
  /** Array max 1 elemento — il pannello filtri usa select (single value) */
  status: string[];
  projectId: string[];
  supplierId: string[];
}

// =============================================================================
// 🛒 DEFAULT FILTERS
// =============================================================================

export const defaultProcurementFilters: ProcurementFilterState = {
  searchTerm: '',
  status: [],
  projectId: [],
  supplierId: [],
};

// =============================================================================
// 🛒 BRIDGE: ProcurementFilterState → POFilters (per usePurchaseOrders)
// =============================================================================

/**
 * Converte lo stato dei filtri centralizzato nel formato atteso da usePurchaseOrders.
 * Le select del pannello sono single-value (array con max 1 elemento).
 */
export function procurementFiltersToPOFilters(f: ProcurementFilterState): POFilters {
  return {
    search: f.searchTerm,
    status: f.status[0] === SELECT_CLEAR_VALUE || !f.status[0] ? null : (f.status[0] as PurchaseOrderStatus),
    projectId: f.projectId[0] === SELECT_CLEAR_VALUE || !f.projectId[0] ? null : f.projectId[0],
    supplierId: f.supplierId[0] === SELECT_CLEAR_VALUE || !f.supplierId[0] ? null : f.supplierId[0],
  };
}

// =============================================================================
// 🛒 FILTER CONFIG
// =============================================================================

/**
 * Configurazione AdvancedFiltersPanel per la pagina Procurement.
 * Le label sono i18n keys del namespace 'procurement' (translateLabel le risolve).
 */
export const procurementFiltersConfig: FilterPanelConfig = {
  title: 'header.title',
  i18nNamespace: 'procurement',
  rows: [
    {
      id: 'procurement-row1',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'list.search',
          placeholder: 'list.search',
          width: 2,
          ariaLabel: 'Search purchase orders',
        },
        {
          id: 'status',
          type: 'select',
          label: 'list.status',
          placeholder: 'filter.allStatuses',
          width: 1,
          options: [
            { value: SELECT_CLEAR_VALUE, label: 'filter.allStatuses' },
            { value: 'draft', label: 'status.draft' },
            { value: 'approved', label: 'status.approved' },
            { value: 'ordered', label: 'status.ordered' },
            { value: 'partially_delivered', label: 'status.partially_delivered' },
            { value: 'delivered', label: 'status.delivered' },
            { value: 'closed', label: 'status.closed' },
            { value: 'cancelled', label: 'status.cancelled' },
          ],
        },
        {
          id: 'projectId',
          type: 'select',
          label: 'form.project',
          placeholder: 'filter.allProjects',
          width: 1,
          options: [
            { value: SELECT_CLEAR_VALUE, label: 'filter.allProjects' },
          ],
        },
        {
          id: 'supplierId',
          type: 'select',
          label: 'form.supplier',
          placeholder: 'filter.allSuppliers',
          width: 1,
          options: [
            { value: SELECT_CLEAR_VALUE, label: 'filter.allSuppliers' },
          ],
        },
      ],
    },
  ],
};
