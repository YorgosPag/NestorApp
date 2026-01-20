import type { ProjectStructure, ProjectBuilding, ProjectUnit, ProjectStorage, ProjectParking } from "@/services/projects.service";

export interface ProjectStructureTabProps {
  projectId: number;
}

/** 🏢 ENTERPRISE: Building model with full hierarchy */
export type BuildingModel = ProjectBuilding;

/** 🏢 ENTERPRISE: Unit model */
export type UnitModel = ProjectUnit;

/** 🏢 ENTERPRISE: Storage model */
export type StorageModel = ProjectStorage;

/** 🏢 ENTERPRISE: Parking model */
export type ParkingModel = ProjectParking;

export interface UseProjectStructureState {
  structure: ProjectStructure | null;
  loading: boolean;
  error: string | null;
}
