// Storage unit types and interfaces for building management system

// 🏢 ENTERPRISE: Extended storage types for all use cases
export type StorageType = 'large' | 'small' | 'basement' | 'ground' | 'special' | 'storage' | 'parking' | 'garage' | 'warehouse';

// 🏢 ENTERPRISE: Extended storage status for all use cases
export type StorageStatus = 'available' | 'occupied' | 'maintenance' | 'reserved' | 'sold' | 'unavailable';

export interface Coordinates {
  x: number;
  y: number;
}

// Main Storage interface for centralized architecture
export interface Storage {
  id: string;
  name: string;
  type: StorageType;
  status: StorageStatus;
  /** @deprecated Use buildingId instead. Kept for backward compatibility. */
  building: string;
  /** 🏢 ENTERPRISE: Building document ID (foreign key) - added via migration 006 */
  buildingId?: string;
  floor: string;
  area: number; // in square meters
  description?: string;
  price?: number; // in euros
  lastUpdated?: Date | string;
  projectId?: string;
  owner?: string;
  notes?: string;
}

// Legacy interface for backward compatibility
export interface StorageUnit {
  id: string;
  code: string;
  type: StorageType;
  floor: string;
  area: number; // in square meters
  price: number; // in euros
  status: StorageStatus;
  description: string;
  building: string;
  /** 🏢 ENTERPRISE: Building document ID (foreign key) - added via migration 006 */
  buildingId?: string;
  project: string;
  company: string;
  linkedProperty: string | null; // Code of linked property/apartment
  coordinates: Coordinates; // Position on building map
  features: string[]; // Array of features like "Ηλεκτρικό ρεύμα", "Φωτισμός", etc.
  level?: string; // Level/floor information
  owner?: string; // Current owner if sold
  projectId?: string; // Project identifier
  propertyCode?: string; // Connected property code
  constructedBy?: string; // Who constructed/added it
  createdAt?: string;
  updatedAt?: string;
  soldAt?: string;
  soldTo?: string; // Customer who bought it
  notes?: string;
  // 🏢 ENTERPRISE: Extended properties for StorageCard component (2026-01-19)
  /** Display identifier (alias for code) */
  identifier?: string;
  /** Display name */
  name?: string;
  /** Section/zone within building */
  section?: string;
  /** Dimensions (e.g., "3x4m") */
  dimensions?: string;
  /** Height in meters */
  height?: number;
  /** Has electricity connection */
  hasElectricity?: boolean;
  /** Has water connection */
  hasWater?: boolean;
  /** Has climate control */
  hasClimateControl?: boolean;
  /** Has security features */
  hasSecurity?: boolean;
}

export interface StorageFilter {
  type?: 'storage' | 'parking' | 'all';
  status?: 'available' | 'sold' | 'reserved' | 'maintenance' | 'all';
  floor?: string | 'all';
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  hasLinkedProperty?: boolean;
  searchTerm?: string;
}

export interface StorageStats {
  total: number;
  byType: {
    storage: number;
  };
  byStatus: {
    available: number;
    sold: number;
    reserved: number;
    maintenance: number;
  };
  byFloor: Record<string, number>;
  totalValue: number;
  totalArea: number;
  averagePricePerSqm: number;
  linkedUnits: number;
  unlinkedUnits: number;
}

export interface StorageTransaction {
  id: string;
  storageUnitId: string;
  type: 'sale' | 'reservation' | 'cancellation';
  amount: number;
  customerName: string;
  customerContact: string;
  date: string;
  notes?: string;
  linkedPropertyCode?: string;
}

// Utility functions type definitions
export type StorageValidator = (unit: Partial<StorageUnit>) => { isValid: boolean; errors: string[] };

export type StorageCalculator = {
  calculatePricePerSqm: (unit: StorageUnit) => number;
  calculateTotalValue: (units: StorageUnit[]) => number;
  calculateAverageArea: (units: StorageUnit[]) => number;
  calculateOccupancyRate: (units: StorageUnit[]) => number;
};

export type StorageReportData = {
  summary: StorageStats;
  salesData: StorageTransaction[];
  availabilityByFloor: Record<string, { available: number; total: number }>;
  priceAnalysis: {
    averageStoragePrice: number;
    priceRangeStorage: { min: number; max: number };
  };
  revenueProjection: {
    currentRevenue: number;
    potentialRevenue: number;
    projectedMonthlyRevenue: number;
  };
};