'use client';

import { useEffect, useState } from "react";
import { getProjectStats } from "@/services/projects.service";
import type { UseProjectStatsState } from "../types";
import type { ProjectStats } from "@/types/project";

// 🏢 ENTERPRISE: projectId is string (Firestore document ID)
export function useProjectStats(projectId: string): UseProjectStatsState {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectStats(projectId);
        if (mounted) setStats(data);
      } catch (e) {
        console.error("❌ Failed to fetch project stats:", e);
        if (mounted) setStats({ totalUnits: 0, soldUnits: 0, totalSoldArea: 0 });
        if (mounted) setError("Αποτυχία φόρτωσης στατιστικών.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  return { stats, loading, error };
}
