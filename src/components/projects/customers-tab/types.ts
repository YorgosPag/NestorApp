
import type { ProjectCustomer } from "@/types/project";

export interface ProjectCustomersTabProps {
  projectId: number;
}

export interface UseProjectCustomersState {
  customers: ProjectCustomer[];
  loading: boolean;
  error: string | null;
}
