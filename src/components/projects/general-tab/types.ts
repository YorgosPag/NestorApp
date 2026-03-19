import type {
  Project,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity,
} from "@/types/project";

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
  /** Company ID — used in create mode to link project to company */
  companyId?: string;
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

/** @deprecated Use return type from useAutosave hook directly (ADR-248) */
export interface UseAutosaveState {
  autoSaving: boolean;
  lastSaved: Date | null;
  startEditing: () => void;
  stopEditing: () => void;
  setDirty: () => void;
}
