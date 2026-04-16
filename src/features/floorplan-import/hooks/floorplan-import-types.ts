/**
 * @fileoverview Types, interfaces, and constants for Floorplan Import wizard (SPEC-237D)
 * @description Extracted from useFloorplanImportState for SRP compliance.
 */

import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import type { FloorplanPurpose } from '@/config/domain-constants';

// =============================================================================
// TYPES
// =============================================================================

export type FloorplanType = 'project' | 'building' | 'floor' | 'property';

export interface FloorplanImportSelection {
  companyId: string | null;
  companyName: string | null;
  projectId: string | null;
  projectName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  floorId: string | null;
  floorName: string | null;
  floorplanType: FloorplanType | null;
  propertyId: string | null;
  propertyName: string | null;
  /** For multi-level units: which level's floorplan to upload */
  levelFloorId: string | null;
  levelName: string | null;
}

export interface EntityOption {
  id: string;
  label: string;
}

export interface UseFloorplanImportStateReturn {
  step: number;
  handleNext: () => void;
  handleBack: () => void;
  /** Navigate to a completed step (click on step number) */
  goToStep: (step: number) => void;
  canProceed: boolean;

  selection: FloorplanImportSelection;
  selectEntity: (id: string) => void;
  selectProperty: (id: string) => void;

  /** Shortcut: set floorplanType and jump to upload (step 6) */
  jumpToUpload: (type: FloorplanType) => void;
  /**
   * Load mode only: from step 6, continue to the next deeper entity selection.
   * project→step 3, building→step 4, floor→step 5. No-op if already at deepest.
   */
  continueDeeper: () => void;
  /** True when continueDeeper() has a valid destination (load mode helper). */
  canContinueDeeper: boolean;

  currentStepItems: EntityOption[];
  currentStepLoading: boolean;
  currentStepEmpty: boolean;

  uploadConfig: import('@/hooks/useFloorplanUpload').FloorplanUploadConfig | null;
  reset: () => void;

  unitItems: EntityOption[];
  unitLoading: boolean;

  /** Multi-level unit support (ADR-236) */
  selectedPropertyIsMultiLevel: boolean;
  unitLevelItems: EntityOption[];
  selectLevel: (floorId: string) => void;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface CompanyItem {
  id: string;
  companyName?: string;
  tradeName?: string;
  legalName?: string;
}

export interface CompaniesApiResponse {
  companies: CompanyItem[];
}

export interface BuildingItem {
  id: string;
  name: string;
  projectId?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  title?: string;
  companyId?: string;
  linkedCompanyId?: string;
}

export interface ProjectsByCompanyResponse {
  projects: ProjectItem[];
}

export interface FloorItem {
  id: string;
  number: number;
  name: string;
  buildingId?: string;
}

export interface FloorsApiResponse {
  floors: FloorItem[];
}

export interface PropertyItem {
  id: string;
  name: string;
  isMultiLevel?: boolean;
  levels?: import('@/types/property').PropertyLevel[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const INITIAL_SELECTION: FloorplanImportSelection = {
  companyId: null,
  companyName: null,
  projectId: null,
  projectName: null,
  buildingId: null,
  buildingName: null,
  floorId: null,
  floorName: null,
  floorplanType: null,
  propertyId: null,
  propertyName: null,
  levelFloorId: null,
  levelName: null,
};

export const TOTAL_STEPS = 6;

/** Maps wizard floorplanType → centralized FLOORPLAN_PURPOSES constant */
export const FLOORPLAN_PURPOSE_BY_TYPE: Record<FloorplanType, FloorplanPurpose> = {
  project: FLOORPLAN_PURPOSES.PROJECT,
  building: FLOORPLAN_PURPOSES.BUILDING,
  floor: FLOORPLAN_PURPOSES.FLOOR,
  property: FLOORPLAN_PURPOSES.PROPERTY,
};

// =============================================================================
// OPTIONS
// =============================================================================

export interface UseFloorplanImportStateOptions {
  /** Whether the wizard dialog is currently open */
  isOpen: boolean;
}
