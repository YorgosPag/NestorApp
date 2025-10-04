
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
        const response = await fetch(`/api/projects/${projectId}/customers`);
        if (!response.ok) throw new Error('Failed to fetch customers');
        const data = await response.json();
        if (mounted) setCustomers(data);
      } catch (err) {
        console.error("Failed to fetch project customers:", err);
        if (mounted) setError("Αποτυχία φόρτωσης πελατών.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [projectId]);

  return { customers, loading, error };
}
