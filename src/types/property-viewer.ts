// 🏢 ADR-051: Import GenericFilterState for type compatibility
import type { GenericFilterState, NumericRange } from '@/components/core/AdvancedFilters/types';

// Re-export PropertyStats from property.ts
export type { PropertyStats } from './property';
// Re-export UnitCoverage from unit.ts for property compatibility
// Also import for local use in Property interface
import type { UnitCoverage } from './unit';
export type { UnitCoverage };

// 🏢 PHASE 3-5: Import all unit feature types
import type {
  OrientationType,
  ViewTypeValue,
  ViewQuality,
  ConditionType,
  EnergyClassType,
  HeatingType,
  FuelType,
  CoolingType,
  WaterHeatingType,
  FlooringType,
  FrameType,
  GlazingType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType
} from '@/constants/unit-features-enterprise';
import type { Timestamp } from 'firebase/firestore';
// 🏢 PHASE 2: LinkedSpaces type
import type { LinkedSpace } from './unit';

/**
 * ✅ DOMAIN SEPARATION: Operational status type (re-imported from unit.ts)
 * Represents construction/maintenance status, NOT sales/commercial status
 */
export type OperationalStatus =
  | 'ready'                 // Έτοιμο (construction complete)
  | 'under-construction'    // υπό ολοκλήρωση (not ready)
  | 'inspection'            // σε επιθεώρηση (under inspection)
  | 'maintenance'           // υπό συντήρηση (under maintenance)
  | 'draft';                // πρόχειρο (not finalized)

export interface Property {
    id: string;
    code?: string;
    name: string;
    type: string;
    building: string;
    floor: number;

    /**
     * ⚠️ DEPRECATED: Sales status (commercial state)
     * @deprecated Use operationalStatus for physical state
     */
    status: 'for-sale' | 'for-rent' | 'sold' | 'rented' | 'reserved';

    /**
     * ✅ NEW: Operational status (physical state)
     * Use this for construction/readiness status
     * @migration PR1 - Units List Cleanup
     */
    operationalStatus?: OperationalStatus;

    /**
     * ⚠️ DEPRECATED: Price (commercial data)
     * @deprecated Will be moved to SalesAsset type
     */
    price?: number;

    area?: number;
    project: string;
    description?: string;
    buildingId: string;
    floorId: string;
    vertices: Array<{x: number, y: number}>;
    isMultiLevel?: boolean;
    levels?: { floorId: string; name: string; }[];
    parentPropertyId?: string;
    features?: string[];
    attachments?: {
        parkingSpots: string[];
        storageRooms: string[];
    }

    /**
     * ⚠️ DEPRECATED: Customer reference (commercial data)
     * @deprecated Will be moved to SalesAsset type
     */
    soldTo?: string | null; // ID of the contact

    /**
     * ⚠️ DEPRECATED: Sale date (commercial data)
     * @deprecated Will be moved to SalesAsset type
     */
    saleDate?: string | null; // Date of sale

    /**
     * ✅ ENTERPRISE: Documentation coverage tracking
     * Used for Πληρότητα dashboard card and filtering
     * @since PR1.2 - Coverage/Completeness implementation
     */
    unitCoverage?: UnitCoverage;

    // === LAYOUT (room configuration) - Phase 1 Unit Fields ===
    layout?: {
      bedrooms?: number;
      bathrooms?: number;
      wc?: number;
      totalRooms?: number;
      levels?: number;
      balconies?: number;
    };

    // === AREAS (measurements) - Phase 2 Unit Fields ===
    areas?: {
      gross: number;
      net?: number;
      balcony?: number;
      terrace?: number;
      garden?: number;
    };

    // === ORIENTATION & VIEWS - Phase 3 Unit Fields ===
    orientations?: OrientationType[];
    views?: Array<{
      type: ViewTypeValue;
      quality?: ViewQuality;
    }>;

    // === CONDITION & ENERGY - Phase 4 Unit Fields ===
    condition?: ConditionType;
    energy?: {
      class: EnergyClassType;
      certificateId?: string;
      certificateDate?: Timestamp;
      validUntil?: Timestamp;
    };

    // === SYSTEMS, FINISHES & FEATURES - Phase 5 Unit Fields ===
    systemsOverride?: Partial<{
      heatingType: HeatingType;
      heatingFuel: FuelType;
      coolingType: CoolingType;
      waterHeating: WaterHeatingType;
    }>;
    finishes?: {
      flooring?: FlooringType[];
      windowFrames?: FrameType;
      glazing?: GlazingType;
    };
    interiorFeatures?: InteriorFeatureCodeType[];
    securityFeatures?: SecurityFeatureCodeType[];

    // === LINKED SPACES - Phase 2 (Parking/Storage) ===
    /** Relationships to parking and storage spaces */
    linkedSpaces?: LinkedSpace[];
  }
  
export interface StorageUnitStub {
    id: string;
    code: string;
    floor: string;
    area: number;
}

export interface ParkingSpotStub {
    id: string;
    code: string;
    type: 'underground' | 'covered' | 'open';
    level: string;
}

// Extended type for full details panel, can be expanded later
export interface ExtendedPropertyDetails extends Property {
    rooms?: number;
    bathrooms?: number;
    owner?: {
      name: string;
      phone?: string;
      email?: string;
    };
    agent?: {
      name: string;
      phone?: string;
      email?: string;
    };
    dates?: {
      created: string;
      updated: string;
      available?: string;
    };
    documents?: Array<{
      id: string;
      name: string;
      type: string;
      url: string;
    }>;
  }

/**
 * 🏢 ADR-051: FilterState extends GenericFilterState for centralized filter system compatibility
 * Uses NumericRange (undefined) instead of null for enterprise-grade type consistency
 *
 * @see centralized_systems.md ADR-051
 */
export interface FilterState extends GenericFilterState {
  searchTerm: string;
  project: string[];
  building: string[];
  floor: string[];
  propertyType: string[];
  status: string[];
  /** 🏢 ADR-051: Uses NumericRange for type compatibility with useGenericFilters */
  priceRange: NumericRange;
  /** 🏢 ADR-051: Uses NumericRange for type compatibility with useGenericFilters */
  areaRange: NumericRange;
  features: string[];

  /** ✅ ENTERPRISE: Coverage filters for "missing X" functionality
   * @since PR1.2 - Coverage/Completeness card click-to-filter
   */
  coverage?: {
    /** Show only units missing photos */
    missingPhotos?: boolean;
    /** Show only units missing floorplans */
    missingFloorplans?: boolean;
    /** Show only units missing documents */
    missingDocuments?: boolean;
  };
}
