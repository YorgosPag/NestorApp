/**
 * ProjectHierarchy — type definitions.
 * Extracted from `ProjectHierarchyContext.tsx` for file-size compliance (<500 lines).
 * Behavior-preserving; all types are re-exported from `ProjectHierarchyContext.tsx`.
 *
 * @module subapps/dxf-viewer/contexts/project-hierarchy-types
 */

import type { CompanyContact } from '../../../types/contacts';
import type { ParkingSpot as CanonicalParkingSpot } from '@/types/parking';
import type { FloorKind } from '@/utils/floor-naming';

export interface Unit {
  id: string;
  name: string;
  type: 'studio' | 'apartment' | 'maisonette' | 'commercial';
  floor: number;
  area: number;
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
  // ✅ ENTERPRISE FIX: Missing Unit properties for SimpleProjectDialog TS2339 errors
  buildingId: string;                // Building ID reference (required)
  building: string;                  // Building name/identifier (required)
  unitName?: string;                 // Optional unit name for backward compatibility
}

export interface Floor {
  id: string;
  number: number;
  name: string;
  elevation?: number;
  /** ADR-461 — Revit-style classification; lets the level card flag special levels. */
  kind?: FloorKind;
  units: Unit[];
}

export interface Building {
  id: string;
  name: string;
  code?: string;
  companyId?: string; // 🏢 ENTERPRISE: Inherited from Firestore — used for FileRecord save companyId resolution
  floors: Floor[];
  storageAreas?: Unit[]; // Αποθήκες (συνήθως υπόγεια)
}

export interface Project {
  id: string;
  name: string;
  company: string;
  buildings: Building[];
  parkingSpots?: ParkingSpot[];
}

// ADR-191: Re-export canonical ParkingSpot (was local divergent type)
export type ParkingSpot = CanonicalParkingSpot;

export interface ProjectHierarchy {
  companies: CompanyContact[];
  selectedCompany: CompanyContact | null;
  projects: Project[];
  selectedProject: Project | null;
  selectedBuilding: Building | null;
  selectedFloor: Floor | null;
  loading: boolean;
  error: string | null;
}

export interface ProjectHierarchyActions {
  loadCompanies: (forceRefresh?: boolean) => Promise<void>;
  selectCompany: (companyId: string) => void;
  loadProjects: () => Promise<void>;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  selectBuilding: (buildingId: string) => void;
  selectFloor: (floorId: string) => void;
  /** Direct setter — bypasses lookup, sets building object directly (e.g. from SimpleProjectDialog) */
  setBuildingDirect: (building: Building | null) => void;
  /** Direct setter — bypasses lookup, sets floor object directly (e.g. from SimpleProjectDialog) */
  setFloorDirect: (floor: Floor | null) => void;
  getAvailableDestinations: () => DestinationOption[];
}

export interface DestinationOption {
  id: string;
  label: string;
  type: 'project' | 'building' | 'floor' | 'property' | 'storage' | 'parking';
  parentId?: string;
  metadata?: {
    floorNumber?: number;
    category?: 'parking' | 'storage' | 'general';
  };
}

export interface ProjectHierarchyContextType extends ProjectHierarchy, ProjectHierarchyActions {}
