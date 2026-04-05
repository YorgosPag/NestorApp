// 🏢 ENTERPRISE: Import centralized building features registry
import type { BuildingFeatureKey } from './features';
// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { BuildingAddressReference, ProjectAddress } from '../project/addresses';
import type { PropertyType } from '@/types/property';

// Building hierarchy interfaces
// NOTE: Contact → @/types/contacts, Project → @/types/project (canonical types)
// Dead Contact/Project interfaces removed 2026-03-13 (centralization audit)

  /** 🏢 ENTERPRISE: Building types for construction industry */
  export type BuildingType = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'office' | 'warehouse';

  /** 🏢 ENTERPRISE: Priority levels for building management */
  export type BuildingPriority = 'low' | 'medium' | 'high' | 'critical';

  // ADR-287 — EnergyClass SSoT: canonical union lives στο
  // `src/constants/energy-classes.ts`. Re-export για backward-compat.
  export type { EnergyClass } from '@/constants/energy-classes';

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
    status: 'planning' | 'construction' | 'completed' | 'active' | 'deleted';
    progress: number; // 0-100
    startDate?: string;
    completionDate?: string;
    totalValue?: number;
    company?: string;
    companyId?: string;
    /** 🏢 ENTERPRISE: Company association (contact ID) — separate from tenant companyId */
    linkedCompanyId?: string;
    linkedCompanyName?: string;
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
    /** Total number of properties */
    totalProperties?: number;
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
    // ADR-145: Centralized via @/types/property (SSoT → @/constants/property-types)
    type: PropertyType;
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
  