import type { ParkingSpot, ParkingFilters } from "@/types/parking";

export interface ParkingSpotTableProps {
  spots: ParkingSpot[];
  selectedSpots: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (spot: ParkingSpot) => void;
  onView: (spot: ParkingSpot) => void;
  onViewFloorPlan: (spot: ParkingSpot) => void;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}
