

export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

export interface Project {
  id: number;
  name: string;
  title: string;
  status: ProjectStatus;
  company: string;
  companyId: string;
  address: string;
  city: string;
  progress: number;
  totalValue: number;
  startDate?: string;
  completionDate?: string;
  lastUpdate: string;
  totalArea: number;
}

export interface ProjectCustomer {
  contactId: string;
  name: string;
  phone: string | null;
  unitsCount: number;
}

export interface ProjectStats {
  totalUnits: number;
  soldUnits: number;
  totalSoldArea: number;
}


export type ProjectSortKey = 'name' | 'progress' | 'totalValue' | 'status' | 'area';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'Σχεδιασμός',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρωμένο',
    on_hold: 'Σε αναμονή',
    cancelled: 'Ακυρωμένο'
};
