import type { Project } from "@/types/project";
import type { ProjectCustomer, ProjectStats } from "@/types/project";

export interface GeneralProjectTabProps {
  project: Project & { companyName: string };
}

export interface StatCardProps {
  icon: React.ElementType;
  value: string | number;
  label: string;
  loading: boolean;
  colorClass: string;
  subtitle?: string;
}

export interface ProjectCustomersTableProps {
  projectId: number;
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
