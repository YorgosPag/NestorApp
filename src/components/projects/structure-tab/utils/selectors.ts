import type { ProjectStructure } from "@/services/projects.service";

/**
 * 🏢 ENTERPRISE: Project Structure Statistics
 *
 * Calculates totals for all building spaces:
 * - Units (Μονάδες)
 * - Storage (Αποθήκες)
 * - Parking (Θέσεις Στάθμευσης)
 */
export interface ProjectTotals {
  // Units stats
  totalUnits: number;
  soldUnits: number;
  availableUnits: number;
  reservedUnits: number;
  unitsArea: number;

  // Storage stats
  totalStorages: number;
  soldStorages: number;
  availableStorages: number;
  storagesArea: number;

  // Parking stats
  totalParkingSpots: number;
  soldParkingSpots: number;
  availableParkingSpots: number;
  parkingArea: number;

  // Combined stats
  totalSpaces: number;
  totalArea: number;
  soldPct: number;
}

export const getTotals = (structure: ProjectStructure): ProjectTotals => {
  // ==========================================================================
  // UNITS STATS
  // ==========================================================================
  const totalUnits = structure.buildings.reduce((s, b) => s + (b.units?.length || 0), 0);
  const soldUnits = structure.buildings.reduce(
    (s, b) => s + (b.units?.filter(u => u.status === "sold").length || 0), 0
  );
  const availableUnits = structure.buildings.reduce(
    (s, b) => s + (b.units?.filter(u => u.status === "available").length || 0), 0
  );
  const reservedUnits = structure.buildings.reduce(
    (s, b) => s + (b.units?.filter(u => u.status === "reserved").length || 0), 0
  );
  const unitsArea = structure.buildings.reduce(
    (s, b) => s + (b.units?.reduce((x, u) => x + (u.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // STORAGE STATS
  // ==========================================================================
  const totalStorages = structure.buildings.reduce((s, b) => s + (b.storages?.length || 0), 0);
  const soldStorages = structure.buildings.reduce(
    (s, b) => s + (b.storages?.filter(st => st.status === "sold").length || 0), 0
  );
  const availableStorages = structure.buildings.reduce(
    (s, b) => s + (b.storages?.filter(st => st.status === "available").length || 0), 0
  );
  const storagesArea = structure.buildings.reduce(
    (s, b) => s + (b.storages?.reduce((x, st) => x + (st.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // PARKING STATS
  // ==========================================================================
  const totalParkingSpots = structure.buildings.reduce((s, b) => s + (b.parkingSpots?.length || 0), 0);
  const soldParkingSpots = structure.buildings.reduce(
    (s, b) => s + (b.parkingSpots?.filter(p => p.status === "sold").length || 0), 0
  );
  const availableParkingSpots = structure.buildings.reduce(
    (s, b) => s + (b.parkingSpots?.filter(p => p.status === "available").length || 0), 0
  );
  const parkingArea = structure.buildings.reduce(
    (s, b) => s + (b.parkingSpots?.reduce((x, p) => x + (p.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // COMBINED STATS
  // ==========================================================================
  const totalSpaces = totalUnits + totalStorages + totalParkingSpots;
  const totalArea = unitsArea + storagesArea + parkingArea;
  const totalSold = soldUnits + soldStorages + soldParkingSpots;
  const soldPct = totalSpaces > 0 ? (totalSold / totalSpaces) * 100 : 0;

  return {
    // Units
    totalUnits,
    soldUnits,
    availableUnits,
    reservedUnits,
    unitsArea,
    // Storage
    totalStorages,
    soldStorages,
    availableStorages,
    storagesArea,
    // Parking
    totalParkingSpots,
    soldParkingSpots,
    availableParkingSpots,
    parkingArea,
    // Combined
    totalSpaces,
    totalArea,
    soldPct
  };
};
