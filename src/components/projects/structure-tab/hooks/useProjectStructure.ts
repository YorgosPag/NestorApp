
import { useEffect, useState } from "react";
import type { UseProjectStructureState } from "../types";
import type { ProjectStructure } from "@/services/projects.service";

export function useProjectStructure(projectId: number): UseProjectStructureState {
  const [structure, setStructure] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`🔄 Fetching project structure via API for projectId: ${projectId}`);

        // Use the API route directly instead of the problematic service
        const response = await fetch(`/api/projects/structure/${projectId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Άγνωστο σφάλμα από το API');
        }

        console.log(`✅ Project structure loaded successfully:`, result.summary);
        if (mounted) setStructure(result.structure);

      } catch (e) {
        console.error("❌ Failed to fetch project structure:", e);
        const errorMessage = e instanceof Error ? e.message : "Αποτυχία φόρτωσης δομής έργου.";
        if (mounted) setError(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  return { structure, loading, error };
}
