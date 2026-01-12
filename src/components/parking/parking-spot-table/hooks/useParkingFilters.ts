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
      // 🏢 ENTERPRISE: Type-safe dynamic property access using keyof
      out = out.filter(spot => {
        const spotKey = key as keyof ParkingSpot;
        const spotValue = spot[spotKey];
        return String(spotValue ?? "").toLowerCase().includes(value.toLowerCase());
      });
    }
    return out;
  }, [spots, activeFilters]);

  return { activeFilters, handleFilterChange, filteredSpots };
}
