
import { PropertyStatus } from '@/constants/property-statuses-enterprise';

// =============================================================================
// 🏢 OPERATIONAL STATUS (Physical Truth - Construction/Readiness State)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Operational status for physical unit state
 * Represents construction/maintenance status, NOT sales/commercial status
 *
 * @example "ready" - Unit is construction-complete and ready
 * @example "under-construction" - Unit is not yet complete
 * @example "inspection" - Unit is under technical inspection
 * @example "maintenance" - Unit is under maintenance/repairs
 * @example "draft" - Unit record is not finalized (data entry)
 */
export type OperationalStatus =
  | 'ready'                 // Έτοιμο (construction complete)
  | 'under-construction'    // υπό ολοκλήρωση (not ready)
  | 'inspection'            // σε επιθεώρηση (under inspection)
  | 'maintenance'           // υπό συντήρηση (under maintenance)
  | 'draft';                // πρόχειρο (not finalized)

// =============================================================================
// 🏢 LEGACY SALES STATUS (Commercial Truth - DEPRECATED IN UNITS)
// =============================================================================

/**
 * ⚠️ DEPRECATED: Sales status should NOT be in Unit type (domain separation)
 * Use this ONLY for backward compatibility during migration
 *
 * @deprecated Use OperationalStatus for units, move sales data to SalesAsset type
 * @migration PR1: Remove from UnitListCard, PR2: Remove from detail tabs
 */
export type LegacySalesStatus = PropertyStatus | 'rented';

// =============================================================================
// 🏢 UNIT TYPE
// =============================================================================

export type UnitType = 'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' | 'Διαμέρισμα 3Δ' | 'Μεζονέτα' | 'Κατάστημα' | 'Αποθήκη';

// =============================================================================
// 🏢 UNIT INTERFACE (Physical Truth)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Unit = Physical Space (NOT Sales Asset)
 *
 * Contains ONLY physical/technical/operational data
 * Sales data (price, soldTo, saleDate) are DEPRECATED and will be removed
 *
 * @migration PR1: Remove price display from list
 * @migration PR2: Remove customer tab, add sales bridge
 * @future Move sales data to SalesAsset type in /sales module
 */
export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  building: string;
  floor: number;

  /**
   * ✅ NEW: Operational status (physical state)
   * Use this for construction/readiness status
   */
  operationalStatus?: OperationalStatus;

  /**
   * ⚠️ DEPRECATED: Sales status (commercial state)
   * Use operationalStatus instead
   * @deprecated Will be removed after full migration to operationalStatus
   */
  status: LegacySalesStatus;

  /**
   * ⚠️ DEPRECATED: Price (commercial data)
   * @deprecated Will be moved to SalesAsset type
   * @migration PR1: Remove from list display
   */
  price?: number;

  area?: number;
  project: string;
  description?: string;
  buildingId: string;
  floorId: string;

  /**
   * ⚠️ DEPRECATED: Customer reference (commercial data)
   * @deprecated Will be moved to SalesAsset type
   * @migration PR2: Remove customer tab
   */
  soldTo?: string | null;

  /**
   * ⚠️ DEPRECATED: Sale date (commercial data)
   * @deprecated Will be moved to SalesAsset type
   */
  saleDate?: string;

  unitName?: string; // ✅ ENTERPRISE FIX: Optional fallback property for backward compatibility
}

// =============================================================================
// 🏢 SORT KEYS
// =============================================================================

/**
 * ⚠️ PARTIAL DEPRECATION: 'price' sort key will be removed
 * @migration PR1: Remove price sorting from UnitsList
 */
export type UnitSortKey = 'name' | 'price' | 'area';
