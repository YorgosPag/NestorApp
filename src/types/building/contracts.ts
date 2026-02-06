// 🏢 ENTERPRISE: Import centralized building features registry
import type { BuildingFeatureKey } from './features';
// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { BuildingAddressReference, ProjectAddress } from '../project/addresses';

// Building hierarchy interfaces
export interface Contact {
    id: string;
    name: string;
    type: 'individual' | 'company' | 'government';
    email?: string;
    phone?: string;
    address?: string;
  }
  
  export interface Project {
    id: string;
    name: string;
    contactId: string; // References Contact
    description?: string;
    startDate?: string;
    expectedCompletionDate?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    totalValue?: number;
  }
  
  /** 🏢 ENTERPRISE: Building types for construction industry */
  export type BuildingType = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'office' | 'warehouse';

  /** 🏢 ENTERPRISE: Priority levels for building management */
  export type BuildingPriority = 'low' | 'medium' | 'high' | 'critical';

  /** 🏢 ENTERPRISE: Energy efficiency classes (EU standard) */
  export type EnergyClass = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

  /** 🏢 ENTERPRISE: Renovation status */
  export type RenovationStatus = 'none' | 'partial' | 'full' | 'planned';

  export interface Building {
    // 🏢 ENTERPRISE: Index signature for SelectedItemBase compatibility (2026-01-20)
    [key: string]: unknown;
    id: string;
    name: string;
    projectId: string; // References Project
    description?: string;

    // 🏢 LEGACY: Backward compatibility (kept for migration)
    // Use addressConfig for new data, these for existing records
    address?: string;
    city?: string;

    // 🏢 ENTERPRISE: Multi-address support (ADR-167)
    /** Direct addresses array - same pattern as Project */
    addresses?: ProjectAddress[];

    // 🏢 ENTERPRISE: Address inheritance system (ADR-167, future use)
    /** Address configurations - references to project addresses */
    addressConfigs?: BuildingAddressReference[];
    /** Primary address ID from project addresses */
    primaryProjectAddressId?: string;

    totalArea: number;
    builtArea?: number;
    floors: number;
    units?: number;
    status: 'planning' | 'construction' | 'completed' | 'active';
    progress: number; // 0-100
    startDate?: string;
    completionDate?: string;
    totalValue?: number;
    company?: string;
    companyId?: string;
    project?: string;
    category?: 'mixed' | 'residential' | 'commercial' | 'industrial';
    // 🏢 ENTERPRISE: Type-safe building features (keys, not strings)
    features?: BuildingFeatureKey[];

    // 🏢 ENTERPRISE: Extended building fields for advanced filtering (2026-01-19)
    /** Location (city/region) for filtering */
    location?: string;
    /** Building type classification */
    type?: BuildingType;
    /** Building priority level */
    priority?: BuildingPriority;
    /** Energy efficiency class */
    energyClass?: EnergyClass;
    /** Renovation status */
    renovation?: RenovationStatus;
    /** Total number of units */
    totalUnits?: number;
    /** Year of construction */
    constructionYear?: number;

    // 🏢 ENTERPRISE: Boolean amenity flags for filtering
    /** Has parking facilities */
    hasParking?: boolean;
    /** Has elevator */
    hasElevator?: boolean;
    /** Has garden/outdoor space */
    hasGarden?: boolean;
    /** Has swimming pool */
    hasPool?: boolean;
    /** Wheelchair accessible */
    accessibility?: boolean;
    /** Furnished units available */
    furnished?: boolean;

    // 🏢 ENTERPRISE: Timestamps for audit trail (2026-01-20)
    /** Creation timestamp */
    createdAt?: string | Date;
    /** Last update timestamp */
    updatedAt?: string | Date;
  }
  
  export interface Floor {
    id: string;
    buildingId: string; // References Building
    name: string; // "Υπόγειο", "Ισόγειο", "1ος Όροφος", etc.
    level: number; // -2, -1, 0, 1, 2, etc.
    area: number;
    properties: Property[];
    storageUnits: unknown[]; // Using 'unknown' to avoid circular dependency, StorageUnit defined elsewhere
  }
  
  export interface Property {
    id: string;
    floorId: string; // References Floor
    code: string;
    type: 'studio' | 'apartment_1br' | 'apartment_2br' | 'apartment_3br' | 'maisonette' | 'store';
    area: number;
    price: number;
    status: 'available' | 'sold' | 'reserved';
    rooms?: number;
    bathrooms?: number;
    hasBalcony?: boolean;
    balconyArea?: number;
    features: string[];
    linkedStorageUnits?: string[]; // Array of StorageUnit IDs
  }
  