import { useState, useMemo, useCallback } from "react";
import type { ParkingSpot } from "@/types/parking";
import type { SortConfig } from "../types";

export function useParkingSort(spots: ParkingSpot[]) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = useCallback((columnKey: string) => {
    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return { key: columnKey, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key: columnKey, direction: "asc" };
    });
  }, []);

  const sortedSpots = useMemo(() => {
    if (!sortConfig) return spots;
    const { key, direction } = sortConfig;
    return [...spots].sort((a: any, b: any) => {
      const av = a[key]; const bv = b[key];
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [spots, sortConfig]);

  return { sortConfig, handleSort, sortedSpots };
}
