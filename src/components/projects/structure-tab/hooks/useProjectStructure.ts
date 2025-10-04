
import { useEffect, useState } from "react";
import { getProjectStructure } from "@/services/projects.service";
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
        const data = await getProjectStructure(projectId);
        if (mounted) setStructure(data);
      } catch (e) {
        console.error("Failed to fetch project structure:", e);
        if (mounted) setError("Αποτυχία φόρτωσης δομής έργου.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  return { structure, loading, error };
}
