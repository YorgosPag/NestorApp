// Storage unit types and interfaces for building management system

export type StorageType = 'storage' | 'parking';

export type StorageStatus = 'available' | 'sold' | 'reserved' | 'maintenance';

export interface Coordinates {
  x: number;
  y: number;
}

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
}

export interface StorageFilter {
  type?: StorageType | 'all';
  status?: StorageStatus | 'all';
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
