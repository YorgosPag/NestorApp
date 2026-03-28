/**
 * @module reports/sections/spaces/types
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) view-model types
 */

export interface SpacesReportPayload {
  parking: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byZone: Record<string, number>;
    byBuilding: Record<string, number>;
    utilizationRate: number;
    totalValue: number;
    soldCount: number;
    salesRate: number;
  };
  storage: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byBuilding: Record<string, number>;
    utilizationRate: number;
    totalArea: number;
    totalValue: number;
    avgPricePerSqm: number;
    soldCount: number;
    salesRate: number;
  };
  linkedSpaces: number;
  unlinkedSpaces: number;
  generatedAt: string;
}

export interface BuildingValueItem {
  building: string;
  parkingValue: number;
  storageValue: number;
}
