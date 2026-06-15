// 🏢 ENTERPRISE: Import centralized building features registry
import type { BuildingFeatureKey } from './features';
// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { BuildingAddressReference, ProjectAddress } from '../project/addresses';
import type { PropertyType } from '@/types/property';
// ADR-287 — PriorityLevel SSoT (shared across Building/Project domains)
import type { PriorityLevel } from '@/constants/priority-levels';
// ADR-287 — SSoT imports (χρειάζονται locally για use στο Building interface,
// επιπρόσθετα των κάτωθι `export type {X}` re-exports για backward-compat).
import type { BuildingStatus } from '@/constants/building-statuses';
import type { BuildingType } from '@/constants/building-types';
import type { EnergyClass } from '@/constants/energy-classes';
import type { RenovationStatus } from '@/constants/renovation-statuses';

// ADR-369 — Multi-building elevation reference (baseElevation chain)
import type {
  BuildingBaseElevationReference,
  BuildingSiteOrigin,
  BuildingPhase,
} from '@/types/building/elevation.schemas';
export type {
  BuildingBaseElevationReference,
  BuildingSiteOrigin,
  BuildingPhase,
} from '@/types/building/elevation.schemas';

// Building hierarchy interfaces
// NOTE: Contact → @/types/contacts, Project → @/types/project (canonical types)
// Dead Contact/Project interfaces removed 2026-03-13 (centralization audit)

  // ADR-287 — Re-export των SSoT types από τα leaf modules για backward-compat.
  // (Τα ίδια names εισάγονται locally στην κορυφή του αρχείου για use στο
  // Building interface.)
  export type { BuildingType, BuildingStatus, EnergyClass, RenovationStatus };

  // ADR-287 — BuildingPriority: semantic alias πάνω στο shared PriorityLevel
  // (canonical στο `src/constants/priority-levels.ts`). Το ίδιο 4-value scale
  // χρησιμοποιείται και στο Project domain (domain-definitions.ts).
  export type BuildingPriority = PriorityLevel;

  export interface Building {
    // 🏢 ENTERPRISE: Index signature for SelectedItemBase compatibility (2026-01-20)
    [key: string]: unknown;
    id: string;
    name: string;
    /**
     * 🏢 ENTERPRISE: Locked system identifier (ADR-233 §3.4).
     * Auto-generated sequential code per project: "Κτήριο Α", "Κτήριο Β", ...
     * Used as source-of-truth for unit code generation (e.g. "A-DI-1.01").
     * Optional during migration phase; required for newly created buildings.
     * @see suggestNextBuildingCode() in entity-code-config.ts
     */
    code?: string;
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
    status: BuildingStatus;
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

    // ─── GPS coordinates (ADR-266 Weather Risk Rule) ──────────────────────
    /** WGS84 decimal degrees — used by Open-Meteo weather alert rule */
    latitude?: number;
    longitude?: number;

    // ─── ADR-369: Multi-building elevation reference ───────────────────────
    /** METRES — Base elevation relative to Project Base Point (default 0). */
    baseElevation?: number;
    /** Semantic interpretation του baseElevation. */
    baseElevationReference?: BuildingBaseElevationReference;
    /** XY offset στο site (METRES) για multi-building layouts. */
    siteOrigin?: BuildingSiteOrigin;
    /** Building orientation, DEGREES (default 0). */
    rotation?: number;
    /** Lifecycle phase: planned → permitted → under_construction → completed. */
    phase?: BuildingPhase;

    // ─── ADR-451: Building vertical setup (foundation datum) ───────────────
    /** Building has a foundation datum below the lowest storey (default true). */
    hasFoundation?: boolean;
    /** METRES — foundation depth below the lowest storey FFL (auto-derived datum). */
    foundationDepth?: number;

    // ─── ADR-461: Stair penthouse special level (απόληξη κλιμακοστασίου) ────
    /** Building has a stair-penthouse special level above the top storey (default true when ≥1 storey). */
    hasStairPenthouse?: boolean;
    /** METRES — stair-penthouse storey height (default 2.40). */
    stairPenthouseHeight?: number;

    // ─── ADR-396 P8: Θερμική απόδοση (ΚΕΝΑΚ) ───────────────────────────────
    /**
     * Κλιματική ζώνη Ελλάδας (ΤΟΤΕΕ 20701-3) — καθορίζει το ανώτατο U_max για
     * τον έλεγχο συμμόρφωσης της θερμοπρόσοψης (ETICS). Inline union (όχι import
     * από subapp — dependency direction)· ταυτίζεται με `ClimateZone` στο
     * `bim/thermal/kenak-thermal-config.ts`.
     */
    climateZone?: 'A' | 'B' | 'C' | 'D';

    // ─── ADR-456: Building structural design settings (Revit code-driven) ──
    /**
     * Δομοστατικές ρυθμίσεις κτιρίου: ενεργός κανονισμός σχεδιασμού + προεπιλ.
     * κατηγορία σκυροδέματος. Building-wide (ένα κτίριο = ένας κανονισμός).
     * Inline shape (ΟΧΙ import από dxf-viewer subapp — dependency direction)·
     * ταυτίζεται με `StructuralSettings` στο
     * `subapps/dxf-viewer/bim/structural/structural-settings.ts` (ο resolver
     * εκεί επικυρώνει τις τιμές κατά την ανάγνωση).
     */
    structuralSettings?: {
      codeId: 'eurocode' | 'greek-legacy';
      defaultConcreteGrade: string;
    };
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
  