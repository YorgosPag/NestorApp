// 🏢 ENTERPRISE: Types imported from contracts (not server actions file)
import type { ProjectStructure, ProjectBuilding, ProjectProperty, ProjectStorage, ProjectParking } from "@/services/projects/contracts";

export interface ProjectStructureTabProps {
  projectId: string;
}

/** 🏢 ENTERPRISE: Building model with full hierarchy */
export type BuildingModel = ProjectBuilding;

/** 🏢 ENTERPRISE: Property model */
export type PropertyModel = ProjectProperty;

/** 🏢 ENTERPRISE: Storage model */
export type StorageModel = ProjectStorage;

/** 🏢 ENTERPRISE: Parking model */
export type ParkingModel = ProjectParking;

export interface UseProjectStructureState {
  structure: ProjectStructure | null;
  loading: boolean;
  error: string | null;
}
