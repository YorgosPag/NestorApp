
import { PropertyStatus } from '@/constants/property-statuses-enterprise';
import type { Timestamp } from 'firebase/firestore';
import type { LegalPhase } from '@/types/legal-contracts';
import type { PaymentSummary } from '@/types/payment-plan';
import type { AllocationSpaceType, SpaceInclusionType } from '@/config/domain-constants';
import type {
  OrientationType,
  ViewTypeValue,
  ViewQuality,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
  AmenityCodeType,
  EnergyClassType,
  ConditionType,
  HeatingType,
  FuelType,
  CoolingType,
  WaterHeatingType,
  FlooringType,
  FrameType,
  GlazingType
} from '@/constants/unit-features-enterprise';

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
// 🏢 COMMERCIAL STATUS (Sales/Rental Truth — ADR-197)
// =============================================================================

/**
 * ✅ ENTERPRISE: Commercial status for unit market disposition
 * Independent from operationalStatus (a unit can be under-construction AND for-sale)
 *
 * @since ADR-197 — Sales Pages Implementation
 * @pattern Yardi Voyager, SAP RE-FX, MRI Software — single disposition field
 *
 * @example "unavailable" — Not listed on market (default)
 * @example "for-sale" — Listed for sale
 * @example "for-rent" — Listed for rent
 * @example "for-sale-and-rent" — Dual listing
 * @example "reserved" — Deposit paid, pending completion
 * @example "sold" — Sale completed
 * @example "rented" — Active lease
 */
export type CommercialStatus =
  | 'unavailable'         // Μη διαθέσιμη (default — not on market)
  | 'for-sale'            // Προς πώληση
  | 'for-rent'            // Προς ενοικίαση
  | 'for-sale-and-rent'   // Πώληση & Ενοικίαση (dual listing)
  | 'reserved'            // Κρατημένη (προκαταβολή)
  | 'sold'                // Πωλημένη
  | 'rented';             // Ενοικιασμένη

// =============================================================================
// 🏢 COMMERCIAL DATA (Sales/Rental Pricing — ADR-197)
// =============================================================================

/**
 * ✅ ENTERPRISE: Commercial/pricing data for units on market
 * Attached to Unit type as optional `commercial` field
 *
 * @since ADR-197 — Sales Pages Implementation
 * @pattern Salesforce Property Cloud, HubSpot CRM — pricing + buyer tracking
 */
export interface UnitCommercialData {
  /** Ζητούμενη τιμή καταλόγου */
  askingPrice: number | null;

  /** Τελική τιμή πώλησης μετά διαπραγμάτευση (γράφεται στο συμβόλαιο) */
  finalPrice: number | null;

  /** Ποσό προκαταβολής κράτησης */
  reservationDeposit: number | null;

  /** Reference → contacts collection (αγοραστής/ενοικιαστής) */
  buyerContactId: string | null;

  /** Όνομα αγοραστή (denormalized για εμφάνιση σε κάρτες/emails χωρίς extra fetch) */
  buyerName: string | null;

  /** Ημερομηνία κράτησης */
  reservationDate: Timestamp | null;

  /** Ημερομηνία ολοκλήρωσης πώλησης */
  saleDate: Timestamp | null;

  /** Ημερομηνία ακύρωσης κράτησης/πώλησης */
  cancellationDate: Timestamp | null;

  /** Ημερομηνία εισαγωγής στην αγορά (για υπολογισμό "ημέρες στην αγορά") */
  listedDate: Timestamp | null;

  /** Αλυσίδα συναλλαγών — κοινό ID για deposit/final/credit invoices (ADR-198) */
  transactionChainId: string | null;

  /** Νομική φάση — denormalized από LegalContractService (ADR-230) */
  legalPhase: LegalPhase | null;

  /** Σύνοψη πληρωμών — denormalized από PaymentPlanService (ADR-234) */
  paymentSummary: PaymentSummary | null;
}

// =============================================================================
// 🏢 UNIT TYPE - CANONICAL ENGLISH CODES
// =============================================================================
// 📅 Updated 2026-01-24: Changed to canonical English codes
// 🏢 ENTERPRISE: Data layer uses English codes, i18n handles translations
// Legacy Greek values ('Στούντιο', 'Διαμέρισμα 2Δ', etc.) may still exist in Firestore
// UI should use i18n mapping: t(`types.${unit.type}`, { defaultValue: unit.type })

export type UnitType =
  | 'studio'          // Στούντιο
  | 'apartment_1br'   // Γκαρσονιέρα
  | 'apartment'       // Διαμέρισμα (generic)
  | 'apartment_2br'   // Διαμέρισμα 2Δ
  | 'apartment_3br'   // Διαμέρισμα 3Δ
  | 'maisonette'      // Μεζονέτα
  | 'penthouse'       // Ρετιρέ (ADR-233)
  | 'loft'            // Loft (ADR-233)
  | 'detached_house'  // Μονοκατοικία (ADR-233)
  | 'villa'           // Βίλα (ADR-233)
  | 'shop'            // Κατάστημα
  | 'office'          // Γραφείο
  | 'hall'            // Αίθουσα (ADR-233)
  | 'storage'         // Αποθήκη
  // Legacy Greek values (backward compatibility)
  | 'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' | 'Διαμέρισμα 3Δ' | 'Μεζονέτα' | 'Κατάστημα' | 'Αποθήκη';

// =============================================================================
// 🏢 COVERAGE INTERFACE (Documentation Completeness)
// =============================================================================

/**
 * ✅ ENTERPRISE: Unit documentation coverage tracking
 * Tracks whether unit has required documentation for completeness metrics
 *
 * @enterprise Used for dashboard Πληρότητα card and "missing X" filters
 * @since PR1.2 - Coverage/Completeness card implementation
 *
 * ⚠️ QUERYABLE CONTRACT: All boolean flags are NON-OPTIONAL for Firestore filtering
 * - hasPhotos/hasFloorplans/hasDocuments MUST be explicit true/false (not undefined)
 * - Requires backfill to set false where missing for existing units
 * - Firestore where(hasPhotos, '==', false) only matches explicit false, not undefined
 */
export interface UnitCoverage {
  /** Unit has at least 1 photo - MUST be explicit true/false for filtering */
  hasPhotos: boolean;
  /** Unit has at least 1 floorplan - MUST be explicit true/false for filtering */
  hasFloorplans: boolean;
  /** Unit has basic documents - MUST be explicit true/false for filtering */
  hasDocuments: boolean;
  /** Last updated timestamp - Canonical Firestore Timestamp */
  updatedAt: Timestamp;
}

// =============================================================================
// 🏢 LINKED SPACES (Relationships)
// =============================================================================

/**
 * ✅ ENTERPRISE: LinkedSpace defines relationships to parking/storage spaces
 *
 * Enables units to have associated parking spots and storage units
 * without duplicating the space data.
 *
 * @created 2026-01-23
 * @enterprise Phase 2 implementation
 */
export interface LinkedSpace {
  /** ID of the parking or storage space document */
  spaceId: string;

  /** Type of linked space */
  spaceType: AllocationSpaceType;

  /** How many spaces (for bundled allocations) */
  quantity: number;

  /** How the space is included with the unit */
  inclusion: SpaceInclusionType;

  /** Human-readable allocation code (e.g., "P-101", "S-42") */
  allocationCode?: string;

  /** Additional notes about the relationship */
  notes?: string;

  /** Optional metadata for extensions (must not use 'any') */
  metadata?: Record<string, string | number | boolean>;

  // === ADR-199: Sale Appurtenances ===

  /** Whether this linked space is included in the unit's sale transaction */
  includedInSale?: boolean;

  /** Sale price for this specific space (null = no separate price) */
  salePrice?: number | null;
}

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
  // === EXISTING FIELDS ===
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
  /** 🏢 ADR-232: Business entity link (inherited from project via cascade) */
  linkedCompanyId?: string | null;

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

  /**
   * ✅ ENTERPRISE: Documentation coverage tracking
   * Used for Πληρότητα dashboard card and filtering
   * @since PR1.2 - Coverage/Completeness implementation
   */
  unitCoverage?: UnitCoverage;

  /**
   * ✅ NEW: Commercial status (market disposition)
   * Independent from operationalStatus — a unit can be under-construction AND for-sale
   * @since ADR-197 — Sales Pages Implementation
   * @default 'unavailable'
   */
  commercialStatus?: CommercialStatus;

  /**
   * ✅ NEW: Commercial/pricing data
   * Contains asking price, final price, buyer, dates
   * @since ADR-197 — Sales Pages Implementation
   */
  commercial?: UnitCommercialData;

  unitName?: string; // ✅ ENTERPRISE FIX: Optional fallback property for backward compatibility

  // === NEW EXTENDED FIELDS (v1.0.5) ===

  /** Human-readable code like "A-101" */
  code?: string;

  /** Use category for the unit */
  useCategory?: 'residential' | 'commercial' | 'mixed';

  // === AREAS (measurements) ===
  areas?: {
    gross: number;              // Total area (required in areas object)
    net?: number;               // Usable area
    balcony?: number;           // Balcony area
    terrace?: number;           // Terrace area
    garden?: number;            // Garden area (ground floor)
  };

  // === LAYOUT (room configuration) ===
  layout?: {
    bedrooms?: number;
    bathrooms?: number;
    wc?: number;               // Separate WC
    totalRooms?: number;       // Total room count
    levels?: number;           // For maisonettes
    balconies?: number;        // Number of balconies
  };

  // === ORIENTATION & VIEWS ===
  /** Orientations using full names: ['north', 'east'] NOT ['N', 'E'] */
  orientations?: OrientationType[];

  /** Views with type and quality */
  views?: Array<{
    type: ViewTypeValue;
    quality?: ViewQuality;
  }>;

  // === CONDITION & READINESS ===
  /** Physical condition of the unit */
  condition?: ConditionType;

  /** Year of last renovation */
  renovationYear?: number;

  /** Expected delivery date */
  deliveryDate?: Timestamp;

  // === SYSTEMS (with override capability) ===
  systemsOverride?: Partial<{
    heatingType: HeatingType;
    heatingFuel: FuelType;
    coolingType: CoolingType;
    waterHeating: WaterHeatingType;
  }>;

  // === ENERGY PERFORMANCE ===
  energy?: {
    class: EnergyClassType;
    certificateId?: string;
    certificateDate?: Timestamp;
    validUntil?: Timestamp;
  };

  // === MATERIALS & FINISHES ===
  finishes?: {
    flooring?: FlooringType[];
    windowFrames?: FrameType;
    glazing?: GlazingType;
  };

  // === FEATURES (Arrays, NOT booleans) ===
  /** Interior features like 'fireplace', 'jacuzzi' */
  interiorFeatures?: InteriorFeatureCodeType[];

  /** Security features like 'alarm', 'security-door' */
  securityFeatures?: SecurityFeatureCodeType[];

  /** Private unit amenities */
  unitAmenities?: AmenityCodeType[];

  // === LINKED SPACES ===
  /** Relationships to parking and storage spaces */
  linkedSpaces?: LinkedSpace[];
}

// =============================================================================
// 🏢 MIGRATION TYPES (UnitDoc vs UnitModel Pattern)
// =============================================================================

/**
 * Firestore Document type - allows missing fields for backward compatibility
 * Used when reading from Firestore during migration period
 */
export interface UnitDoc {
  // Legacy fields - all optional
  id?: string;
  name?: string;
  type?: UnitType;

  // New extended fields - all optional during migration
  code?: string;
  useCategory?: 'residential' | 'commercial' | 'mixed';
  orientations?: OrientationType[];
  views?: Array<{ type: ViewTypeValue; quality?: ViewQuality }>;
  interiorFeatures?: InteriorFeatureCodeType[];
  securityFeatures?: SecurityFeatureCodeType[];
  areas?: Partial<{
    gross: number;
    net: number;
    balcony: number;
    terrace: number;
    garden: number;
  }>;
  layout?: Partial<{
    bedrooms: number;
    bathrooms: number;
    wc: number;
    totalRooms: number;
    levels: number;
    balconies: number;
  }>;
  unitCoverage?: Partial<UnitCoverage>;

  // Additional extended fields (optional during migration)
  operationalStatus?: OperationalStatus;
  condition?: ConditionType;
  renovationYear?: number;
  deliveryDate?: Timestamp;
  systemsOverride?: Partial<{
    heatingType: HeatingType;
    heatingFuel: FuelType;
    coolingType: CoolingType;
    waterHeating: WaterHeatingType;
  }>;
  energy?: {
    class: EnergyClassType;
    certificateId?: string;
    certificateDate?: Timestamp;
    validUntil?: Timestamp;
  };
  finishes?: {
    flooring?: FlooringType[];
    windowFrames?: FrameType;
    glazing?: GlazingType;
  };
  unitAmenities?: AmenityCodeType[];
  linkedSpaces?: LinkedSpace[];

  // Commercial fields (ADR-197, ADR-230)
  commercialStatus?: CommercialStatus;
  commercial?: Partial<UnitCommercialData>; // includes legalPhase via ADR-230

  // Legacy fields that might exist in old documents
  status?: LegacySalesStatus;
  price?: number;
  area?: number;
  /** @deprecated Use projectId. Some code still references this alias. */
  project?: string;
  /** Project ID (Firestore field name) */
  projectId?: string;
  description?: string;
  building?: string;
  buildingId?: string;
  floorId?: string;
  floor?: number;
  soldTo?: string | null;
  saleDate?: string;
  unitName?: string;
}

/**
 * Application Model type - normalized with defaults
 * Used in application after normalization
 */
export interface UnitModel extends Unit {
  // All required fields have values (never undefined)
  id: string;
  name: string;
  type: UnitType;

  // Arrays default to empty (never undefined)
  orientations: OrientationType[];
  views: Array<{ type: ViewTypeValue; quality?: ViewQuality }>;
  interiorFeatures: InteriorFeatureCodeType[];
  securityFeatures: SecurityFeatureCodeType[];

  // Coverage defaults to false (never undefined)
  unitCoverage: UnitCoverage;
}

/**
 * Backfill defaults provided by server during migration
 * All required fields MUST be provided by server - NO hardcoded defaults!
 */
export interface BackfillDefaults {
  // Identity fields (server-generated)
  id: string;
  name: string;
  type: UnitType;

  // Hierarchy fields (from building/project context)
  building: string;
  buildingId: string;
  project: string;
  floorId: string;
  floor: number;

  // Status (business logic)
  status: 'available' | 'reserved' | 'sold' | 'unavailable' | 'draft';

  // Coverage timestamp
  updatedAt: Timestamp; // Server timestamp, NOT Timestamp.now()
}

// =============================================================================
// 🏢 SORT KEYS
// =============================================================================

/**
 * ⚠️ PARTIAL DEPRECATION: 'price' sort key will be removed
 * @migration PR1: Remove price sorting from UnitsList
 */
export type UnitSortKey = 'name' | 'price' | 'area';
