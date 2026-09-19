// Storage unit types and interfaces for building management system

// 🏢 ENTERPRISE: Extended storage types for all use cases
export type StorageType = 'large' | 'small' | 'basement' | 'ground' | 'special' | 'storage' | 'parking' | 'garage' | 'warehouse';

// ⛔ Εδώ ζούσε το ανάμεικτο `StorageStatus` — βλ. `types/parking.ts` και ADR-777 §8.60.20.
// Εμπορικό → `commercialStatus` · φυσικό → `operationalStatus` · κάδος → `status`.
type RecordLifecycleStatus = import('@/lib/firestore/trashed-status').RecordLifecycleStatus;
type OperationalStatus = import('@/constants/operational-statuses').OperationalStatus;

export interface Coordinates {
  x: number;
  y: number;
}

// Main Storage interface for centralized architecture
export interface Storage {
  id: string;
  name: string;
  /** ADR-233: Entity coding system identifier, e.g. "A-AP-Y1.01" */
  code?: string;
  type: StorageType;
  /** Κύκλος ζωής εγγραφής — ζωντανή ή στον κάδο (ADR-281). **Όχι** εμπορική ή φυσική κατάσταση. */
  status: RecordLifecycleStatus;
  /** Φυσική χρηστικότητα — ίδιο λεξιλόγιο με τα ακίνητα (ADR-777 §8.60.20). Απούσα = αδήλωτη. */
  operationalStatus?: OperationalStatus;
  /** @deprecated Use buildingId instead. Kept for backward compatibility. */
  building: string;
  /** 🏢 ENTERPRISE: Building document ID (foreign key) - added via migration 006 */
  buildingId?: string;
  /** 🏢 ENTERPRISE: Company ID for tenant isolation */
  companyId?: string;
  /** 🏢 ADR-232: Business entity link (inherited from project via cascade) */
  linkedCompanyId?: string | null;
  floor: string;
  /** Floor document ID (Firestore doc reference) */
  floorId?: string;
  area: number; // in square meters
  description?: string;
  price?: number; // in euros
  lastUpdated?: Date | string;
  projectId?: string;
  owner?: string;
  notes?: string;
  /**
   * 🏢 SPEC-256A: Optimistic-concurrency version counter. Acquired lazily on
   * first versioned update — absent on documents never updated since migration.
   */
  _v?: number;

  // ADR-199: Sales appurtenance fields
  /** Millesimal shares (χιλιοστά) — 0 = common, >0 = independently sellable */
  millesimalShares?: number | null;
  /** Commercial status for sales context */
  commercialStatus?: import('@/constants/commercial-statuses').CommercialStatus;
  /** Commercial data overlay for sales */
  commercial?: import('@/types/sales-shared').SpaceCommercialData;
}

// Legacy interface for backward compatibility
export interface StorageUnit {
  id: string;
  code: string;
  type: StorageType;
  floor: string;
  area: number; // in square meters
  /** @deprecated ADR-777 §8.60.18 — δεν γράφεται πια· η τιμή ζει στο `commercial`, ανά ρόλο. */
  price: number; // in euros
  /** ADR-777 §8.60.18 — η διάθεση (ίδιο λεξιλόγιο με τα ακίνητα) που οδηγεί την τιμή. */
  commercialStatus?: import('@/constants/commercial-statuses').CommercialStatus;
  /** ADR-777 §8.60.18 — τα ποσά ανά ρόλο (`askingPrice` · `rentPrice`). */
  commercial?: import('@/types/sales-shared').SpaceCommercialData;
  status: RecordLifecycleStatus;
  /** ADR-777 §8.60.20 — φυσική χρηστικότητα (ίδιο λεξιλόγιο με τα ακίνητα). */
  operationalStatus?: OperationalStatus;
  description: string;
  building: string;
  /** 🏢 ENTERPRISE: Building document ID (foreign key) - added via migration 006 */
  buildingId?: string;
  project: string;
  company: string;
  linkedProperty: string | null; // Code of linked property/apartment
  coordinates: Coordinates; // Position on building map
  features: string[]; // Array of features like "Ηλεκτρικό ρεύμα", "Φωτισμός", etc.
  level?: string; // Level/floor information
  owner?: string; // Current owner if sold
  projectId?: string; // Project identifier
  propertyCode?: string; // Connected property code
  constructedBy?: string; // Who constructed/added it
  createdAt?: string;
  updatedAt?: string;
  soldAt?: string;
  soldTo?: string; // Customer who bought it
  notes?: string;
  // 🏢 ENTERPRISE: Extended properties for StorageCard component (2026-01-19)
  /** Display identifier (alias for code) */
  identifier?: string;
  /** Display name */
  name?: string;
  /** Section/zone within building */
  section?: string;
  /** Dimensions (e.g., "3x4m") */
  dimensions?: string;
  /** Height in meters */
  height?: number;
  /** Has electricity connection */
  hasElectricity?: boolean;
  /** Has water connection */
  hasWater?: boolean;
  /** Has climate control */
  hasClimateControl?: boolean;
  /** Has security features */
  hasSecurity?: boolean;
}

// Utility functions type definitions
export type StorageValidator = (unit: Partial<StorageUnit>) => { isValid: boolean; errors: string[] };

export type StorageCalculator = {
  calculatePricePerSqm: (unit: StorageUnit) => number;
  calculateTotalValue: (units: StorageUnit[]) => number;
  calculateAverageArea: (units: StorageUnit[]) => number;
  calculateOccupancyRate: (units: StorageUnit[]) => number;
};
