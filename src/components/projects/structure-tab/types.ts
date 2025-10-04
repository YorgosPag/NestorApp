import type { ProjectStructure } from "@/services/projects.service";

export interface ProjectStructureTabProps {
  projectId: number;
}

export type BuildingModel = ProjectStructure["buildings"][number];
export type UnitModel = BuildingModel["units"][number];

export interface UseProjectStructureState {
  structure: ProjectStructure | null;
  loading: boolean;
  error: string | null;
}
