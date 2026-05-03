/**
 * Material — Procurement Material Catalog (ADR-330 Phase 4)
 *
 * Company-wide material master with code uniqueness, ATOE category link,
 * preferred suppliers (FK contacts), and price history snapshot.
 *
 * Schema decisions (ADR-330 D5):
 *   - Greenfield collection `materials/` (separate from boq-categories)
 *   - Soft-delete (`isDeleted`) for audit trail consistency with PO pattern
 *   - `code` unique per (companyId, code) — validated server-side
 *   - `preferredSupplierContactIds` max 5, FK contacts with supplier persona
 *   - `avgPrice`/`lastPrice` editable manually in MVP (auto-update from PO = Phase 4.5)
 */

import type { Timestamp } from 'firebase/firestore';
import type { BOQMeasurementUnit } from '@/types/boq';

export const MAX_PREFERRED_SUPPLIERS = 5;

export interface Material {
  id: string;                              // mat_*
  companyId: string;
  code: string;                            // unique per (companyId, code), e.g. "CEM-001"
  name: string;
  unit: BOQMeasurementUnit;
  atoeCategoryCode: string;                // FK boq-categories OIK-1..OIK-12
  description: string | null;
  preferredSupplierContactIds: string[];   // FK contacts (supplier persona), max 5
  avgPrice: number | null;
  lastPrice: number | null;
  lastPurchaseDate: Timestamp | null;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CreateMaterialDTO {
  code: string;
  name: string;
  unit: BOQMeasurementUnit;
  atoeCategoryCode: string;
  description?: string | null;
  preferredSupplierContactIds?: string[];
  avgPrice?: number | null;
  lastPrice?: number | null;
  lastPurchaseDate?: string | null;        // ISO at API boundary
}

export interface UpdateMaterialDTO {
  code?: string;
  name?: string;
  unit?: BOQMeasurementUnit;
  atoeCategoryCode?: string;
  description?: string | null;
  preferredSupplierContactIds?: string[];
  avgPrice?: number | null;
  lastPrice?: number | null;
  lastPurchaseDate?: string | null;
}

export interface MaterialFilters {
  atoeCategoryCode?: string;
  search?: string;                         // matches code OR name (substring, case-insensitive)
  supplierContactId?: string;              // filter by preferred supplier
  includeDeleted?: boolean;
}

export class MaterialCodeConflictError extends Error {
  readonly conflictingMaterialId: string;
  constructor(code: string, conflictingMaterialId: string) {
    super(`Material code "${code}" already exists`);
    this.name = 'MaterialCodeConflictError';
    this.conflictingMaterialId = conflictingMaterialId;
  }
}

export class MaterialValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'MaterialValidationError';
    this.field = field;
  }
}
