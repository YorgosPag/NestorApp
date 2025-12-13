
import { useEffect, useState } from "react";
import type { ProjectCustomer } from "@/types/project";
import type { UseProjectCustomersState } from "../types";
// import { getProjectCustomers } from "@/services/projects.service"; // Server action - can't use from client

export function useProjectCustomers(projectId: number): UseProjectCustomersState {
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!projectId) {
        if(mounted) setLoading(false);
        return;
      };
      setLoading(true);
      setError(null);
      try {
        console.log(`🔄 Fetching project customers via API for projectId: ${projectId}`);

        const response = await fetch(`/api/projects/${projectId}/customers`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Handle new API format with success flag
        if (result.success === false) {
          throw new Error(result.error || 'Άγνωστο σφάλμα από το API');
        }

        // Handle both old format (direct array) and new format (with customers property)
        const customersData = result.customers || result;

        console.log(`✅ Project customers loaded successfully:`, result.summary || `${customersData.length} customers`);
        if (mounted) setCustomers(customersData);

      } catch (err) {
        console.error("❌ Failed to fetch project customers:", err);
        const errorMessage = err instanceof Error ? err.message : "Αποτυχία φόρτωσης πελατών.";
        if (mounted) setError(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [projectId]);

  return { customers, loading, error };
}
