
import type { ProjectCustomer } from "@/types/project";

export interface ProjectCustomersTabProps {
  projectId: string;
}

export interface UseProjectCustomersState {
  customers: ProjectCustomer[];
  loading: boolean;
  error: string | null;
}
