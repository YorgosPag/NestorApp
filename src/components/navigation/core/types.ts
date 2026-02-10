/**
 * Core types for the centralized Navigation System
 * Extracted from DXF Viewer for reusability across the application
 */

import type { LucideIcon } from 'lucide-react';

export interface NavigationCompany {
  id: string;
  companyName: string;
  industry?: string;
  vatNumber?: string;
}

export interface NavigationProject {
  id: string;
  name: string;
  company: string;
  companyId?: string; // The ID of the company that owns this project
  buildings: NavigationBuilding[];
  parkingSpots?: NavigationParkingSpot[];
  // 🏢 PERF-001: Building count from bootstrap (eliminates realtime listener)
  buildingCount?: number;
}

export interface NavigationBuilding {
  id: string;
  name: string;
  floors: NavigationFloor[];
  storageAreas?: NavigationUnit[];
  /** 🏢 ENTERPRISE: Direct units for buildings without floors */
  units?: NavigationUnit[];
}

export interface NavigationFloor {
  id: string;
  number: number;
  name: string;
  units: NavigationUnit[];
}

export interface NavigationUnit {
  id: string;
  name: string;
  type: 'studio' | 'apartment' | 'maisonette' | 'commercial';
  floor: number;
  area: number;
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
}

export interface NavigationParkingSpot {
  id: string;
  number: string;
  type: 'standard' | 'disabled' | 'electric';
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
  location: 'ground' | 'basement' | 'pilotis';
}

/** 🏢 ENTERPRISE: Selected unit for breadcrumb navigation */
export interface NavigationSelectedUnit {
  id: string;
  name: string;
  type?: string;
}

/**
 * 🏢 ENTERPRISE: Lightweight reference type for breadcrumb display
 *
 * This is a "display-only" reference containing just id and name.
 * It is NOT a full domain entity - do not use for business logic or data fetching.
 *
 * @example
 * // Correct usage: display in breadcrumb UI
 * const breadcrumb = `${company.name} → ${project.name}`;
 *
 * // INCORRECT usage: do not use for business logic
 * // const buildings = selectedProject.buildings; // MAY BE EMPTY!
 */
export interface BreadcrumbEntityRef {
  id: string;
  name: string;
}

/**
 * 🏢 ENTERPRISE: Breadcrumb sync parameters
 *
 * Used by entity pages to sync the navigation display hierarchy with NavigationContext.
 * Names are passed directly from the page (not looked up) to ensure accuracy.
 *
 * ⚠️ IMPORTANT CONTRACT:
 * - This updates DISPLAY-ONLY navigation selection for breadcrumb/UI context
 * - The resulting selected* objects are NOT full domain entities
 * - Fields like `buildings`, `floors` arrays MAY BE EMPTY
 * - MUST NOT be used for business logic or data fetching
 *
 * @see BreadcrumbEntityRef - The lightweight type used for display
 */
export interface BreadcrumbSyncParams {
  /** Required: Company ID and name */
  company: BreadcrumbEntityRef;
  /** Required: Project ID and name */
  project: BreadcrumbEntityRef;
  /** Optional: Building info (for /buildings, /units pages) */
  building?: BreadcrumbEntityRef;
  /** Optional: Unit info (for /units page) */
  unit?: BreadcrumbEntityRef & { type?: string };
  /** Optional: Space info for parking/storage (for /parking, /storage pages) */
  space?: BreadcrumbEntityRef & { type: 'parking' | 'storage' };
  /** The navigation level to set */
  currentLevel: NavigationLevel;
}

/**
 * 🏢 ENTERPRISE: Navigation State
 *
 * ⚠️ CRITICAL CONTRACT FOR selected* FIELDS:
 * The `selectedCompany`, `selectedProject`, `selectedBuilding`, and `selectedUnit` fields
 * are **DISPLAY-ONLY navigation selections** for breadcrumb/UI context.
 *
 * When populated via `syncBreadcrumb()`:
 * - They are NOT guaranteed to be full domain entities
 * - Nested arrays (e.g., `buildings`, `floors`, `units`) MAY BE EMPTY
 * - They contain only the minimum fields needed for breadcrumb display (id, name)
 *
 * ❌ DO NOT USE for:
 * - Business logic decisions
 * - Data fetching based on nested arrays
 * - Expecting full entity data
 *
 * ✅ USE for:
 * - Breadcrumb display
 * - Navigation UI context
 * - Current selection highlighting
 *
 * For full domain entities, fetch directly from the appropriate data source/API.
 */
export interface NavigationState {
  /** Full list of companies (loaded from API) */
  companies: NavigationCompany[];
  /**
   * Currently selected company for breadcrumb display.
   * ⚠️ DISPLAY-ONLY - may not contain full entity data when set via syncBreadcrumb()
   */
  selectedCompany: NavigationCompany | null;
  /** Full list of projects (loaded from API) */
  projects: NavigationProject[];
  /**
   * Currently selected project for breadcrumb display.
   * ⚠️ DISPLAY-ONLY - `buildings` array may be empty when set via syncBreadcrumb()
   */
  selectedProject: NavigationProject | null;
  /**
   * Currently selected building for breadcrumb display.
   * ⚠️ DISPLAY-ONLY - `floors` array may be empty when set via syncBreadcrumb()
   */
  selectedBuilding: NavigationBuilding | null;
  /**
   * 🏢 ENTERPRISE: Selected unit/space for breadcrumb display.
   * ⚠️ DISPLAY-ONLY - contains only id, name, and optional type
   */
  selectedUnit: NavigationSelectedUnit | null;
  /**
   * @deprecated 🏢 ENTERPRISE (Επιλογή Α): Floors αφαιρέθηκαν από navigation.
   * Παραμένει για backward compatibility - θα αφαιρεθεί σε μελλοντική έκδοση.
   */
  selectedFloor: NavigationFloor | null;
  currentLevel: NavigationLevel;
  loading: boolean;
  projectsLoading: boolean;
  error: string | null;
}

/**
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * 'floors' αφαιρέθηκε από navigation levels.
 * Οι όροφοι είναι δομικοί κόμβοι - εμφανίζονται μόνο στο Building Detail View.
 * Ιεραρχία: Companies → Projects → Buildings → Units
 */
export type NavigationLevel = 'companies' | 'projects' | 'buildings' | 'units' | 'spaces';

export interface NavigationActions {
  loadCompanies: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  selectBuilding: (buildingId: string) => void;
  /** 🏢 ENTERPRISE: Select unit for breadcrumb display */
  selectUnit: (unit: NavigationSelectedUnit | null) => void;
  /**
   * 🏢 ENTERPRISE: Atomic breadcrumb sync from entity pages
   *
   * Sets the navigation display hierarchy in a single atomic state update
   * to avoid race conditions when syncing from entity pages.
   *
   * ⚠️ CRITICAL CONTRACT:
   * - Updates DISPLAY-ONLY navigation selection for breadcrumb/UI context
   * - The resulting selected* objects are NOT full domain entities
   * - Nested arrays (`buildings`, `floors`) will be EMPTY
   * - MUST NOT be used for business logic or data fetching
   *
   * ✅ CORRECT USAGE:
   * ```typescript
   * syncBreadcrumb({
   *   company: { id: company.id, name: company.companyName },
   *   project: { id: project.id, name: project.name },
   *   building: { id: building.id, name: building.name },
   *   currentLevel: 'buildings'
   * });
   * ```
   *
   * ❌ INCORRECT - Do not expect full entities after sync:
   * ```typescript
   * const buildings = selectedProject.buildings; // MAY BE EMPTY!
   * ```
   *
   * @param params - Breadcrumb sync parameters with names (not just IDs)
   * @see BreadcrumbSyncParams - The parameter type with full documentation
   * @see BreadcrumbEntityRef - The lightweight display-only reference type
   */
  syncBreadcrumb: (params: BreadcrumbSyncParams) => void;
  /**
   * @deprecated 🏢 ENTERPRISE (Επιλογή Α): Floors αφαιρέθηκαν από navigation.
   * Παραμένει για backward compatibility - θα αφαιρεθεί σε μελλοντική έκδοση.
   */
  selectFloor: (floorId: string) => void;
  navigateToLevel: (level: NavigationLevel) => void;
  reset: () => void;
  navigateToExistingPages: (
    type: 'properties' | 'projects' | 'buildings' | 'floorplan',
    filters?: NavigationFilters
  ) => void;
  /** 🏢 ENTERPRISE: Get real-time building count for a project */
  getBuildingCount: (projectId: string) => number;
  /** 🏢 ENTERPRISE: Get all buildings for a project in real-time */
  getBuildingsForProject: (projectId: string) => RealtimeBuildingRef[];
  /** 🏢 ENTERPRISE: Get real-time unit count for a building */
  getUnitCount: (buildingId: string) => number;
  /** 🏢 ENTERPRISE: Get all units for a building in real-time */
  getUnitsForBuilding: (buildingId: string) => RealtimeUnitRef[];
}

/** 🏢 ENTERPRISE: Reference to a building from real-time system */
export interface RealtimeBuildingRef {
  id: string;
  name: string;
  projectId: string | null;
}

/** 🏢 ENTERPRISE: Reference to a unit from real-time system */
export interface RealtimeUnitRef {
  id: string;
  name: string;
  buildingId: string | null;
  type?: string;
  status?: string;
  area?: number;
  floor?: number;
}

/** 🏢 ENTERPRISE: Filters for navigation */
export interface NavigationFilters {
  companyId?: string;
  projectId?: string;
  buildingId?: string;
  [key: string]: string | undefined;
}

export interface NavigationOption {
  id: string;
  label: string;
  type: 'company' | 'project' | 'building' | 'floor' | 'unit' | 'storage' | 'parking';
  icon: string;
  subtitle?: string;
  extraInfo?: string;
  parentId?: string;
  metadata?: {
    floorNumber?: number;
    category?: 'parking' | 'storage' | 'general';
  };
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  /** Icon can be emoji string or React component (Lucide) */
  icon: string | LucideIcon;
  /** 🏢 ENTERPRISE: Tailwind color class from NAVIGATION_ENTITIES */
  color?: string;
  level: NavigationLevel;
  onClick: () => void;
}