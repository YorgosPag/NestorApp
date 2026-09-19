// 🏢 ENTERPRISE: Types imported from contracts (not server actions file)
import type { ProjectStructure } from "@/services/projects/contracts";
import { countSpaceStatuses } from "@/lib/spaces/space-availability";

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
  totalProperties: number;
  soldProperties: number;
  availableProperties: number;
  reservedProperties: number;
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
  const totalProperties = structure.buildings.reduce((s, b) => s + (b.properties?.length || 0), 0);
  const soldProperties = structure.buildings.reduce(
    (s, b) => s + (b.properties?.filter(u => u.status === "sold").length || 0), 0
  );
  // 🏢 ENTERPRISE: "for-sale" and "for-rent" are the "available" states in property-viewer
  const availableProperties = structure.buildings.reduce(
    (s, b) => s + (b.properties?.filter(u => u.status === "for-sale" || u.status === "for-rent").length || 0), 0
  );
  const reservedProperties = structure.buildings.reduce(
    (s, b) => s + (b.properties?.filter(u => u.status === "reserved").length || 0), 0
  );
  const unitsArea = structure.buildings.reduce(
    (s, b) => s + (b.properties?.reduce((x, u) => x + (u.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // STORAGE STATS
  // ==========================================================================
  // ADR-777 §8.60.20 — από το `commercialStatus`, μέσω του ΕΝΟΣ SSoT (όχι το παλιό ανάμεικτο `status`).
  const storageCounts = countSpaceStatuses(structure.buildings.flatMap(b => b.storages ?? []));
  const totalStorages = storageCounts.total;
  const soldStorages = storageCounts.byAvailability.sold;
  const availableStorages = storageCounts.byAvailability.listed;
  const storagesArea = structure.buildings.reduce(
    (s, b) => s + (b.storages?.reduce((x, st) => x + (st.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // PARKING STATS
  // ==========================================================================
  const parkingCounts = countSpaceStatuses(structure.buildings.flatMap(b => b.parkingSpots ?? []));
  const totalParkingSpots = parkingCounts.total;
  const soldParkingSpots = parkingCounts.byAvailability.sold;
  const availableParkingSpots = parkingCounts.byAvailability.listed;
  const parkingArea = structure.buildings.reduce(
    (s, b) => s + (b.parkingSpots?.reduce((x, p) => x + (p.area || 0), 0) || 0), 0
  );

  // ==========================================================================
  // COMBINED STATS
  // ==========================================================================
  const totalSpaces = totalProperties + totalStorages + totalParkingSpots;
  const totalArea = unitsArea + storagesArea + parkingArea;
  const totalSold = soldProperties + soldStorages + soldParkingSpots;
  const soldPct = totalSpaces > 0 ? (totalSold / totalSpaces) * 100 : 0;

  return {
    // Units
    totalProperties,
    soldProperties,
    availableProperties,
    reservedProperties,
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
