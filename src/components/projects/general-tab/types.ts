import type {
  Project,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity,
} from "@/types/project";
import type { ProjectStats } from "@/types/project";

export interface GeneralProjectTabProps {
  project: Project & { companyName: string };
}

export interface ProjectFormData {
  // Βασικά πεδία
  name: string;
  licenseTitle: string;
  description: string;
  buildingBlock: string;
  protocolNumber: string;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate: string;
  status: ProjectStatus;
  companyName: string;
  // Λεπτομέρειες (inline editing — moved from modal)
  type: ProjectType | '';
  priority: ProjectPriority | '';
  riskLevel: ProjectRiskLevel | '';
  complexity: ProjectComplexity | '';
  budget: number | '';
  totalValue: number | '';
  totalArea: number | '';
  duration: number | '';
  startDate: string;
  completionDate: string;
  client: string;
  location: string;
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
