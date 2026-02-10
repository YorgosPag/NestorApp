import type { Project, ProjectStatus } from "@/types/project";
import type { ProjectStats } from "@/types/project";

export interface GeneralProjectTabProps {
  project: Project & { companyName: string };
}

export interface ProjectFormData {
  name: string;
  licenseTitle: string;
  description: string;
  buildingBlock: string;
  protocolNumber: string;
  licenseNumber: string;
  issuingAuthority: string;
  status: ProjectStatus;
  showOnWeb: boolean;
  mapPath: string;
  floorPlanPath: string;
  percentagesPath: string;
  companyName: string;
}

export interface ProjectCustomersTableProps {
  projectId: string;
}

export interface UseProjectStatsState {
  stats: ProjectStats | null;
  loading: boolean;
  error: string | null;
}

export interface UseAutosaveState {
  autoSaving: boolean;
  lastSaved: Date | null;
  startEditing: () => void;
  stopEditing: () => void;
  setDirty: () => void;
}
