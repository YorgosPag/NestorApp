import { useState, useMemo, useCallback } from "react";
import type { ParkingSpot } from "@/types/parking";

export function useParkingFilters(spots: ParkingSpot[]) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const handleFilterChange = useCallback((columnKey: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [columnKey]: value }));
  }, []);

  const filteredSpots = useMemo(() => {
    let out = [...spots];
    for (const [key, value] of Object.entries(activeFilters)) {
      if (!value) continue;
      out = out.filter(spot =>
        String((spot as any)[key] ?? "").toLowerCase().includes(value.toLowerCase())
      );
    }
    return out;
  }, [spots, activeFilters]);

  return { activeFilters, handleFilterChange, filteredSpots };
}
