export interface StorageUnitStub {
    id: string;
    code: string;
    type: 'storage' | 'parking';
    floor: string;
    area: number;
    price: number;
    status: 'sold' | 'available' | 'reserved' | 'owner';
    linkedPropertyId?: string;
    buyer?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Property {
  id: string;
  code: string;
  type: 'apartment' | 'maisonette' | 'store';
  building: string;
  floor: string;
  orientation: 'north' | 'south' | 'east' | 'west';
  rooms: number;
  bathrooms: number;
  area: number;
  balconyArea: number;
  price: number;
  status: 'sold' | 'available' | 'reserved' | 'owner';
  buyer?: string;
  saleDate?: string;
  salePrice?: number;
  projectId: number;
  buildingId: string;
  floorNumber: number;
  description: string;
  features: string[];
  storageUnits: StorageUnitStub[];
  parkingSpots: string[]; // IDs of parking spots
  createdAt: string;
  updatedAt: string;
  attachments?: {
    parkingSpots: string[]; // IDs from 'parkings' collection
    storageRooms: string[]; // IDs from 'storages' collection
  };
  soldTo?: string | null;
}

export interface PropertyFilters {
  searchTerm: string;
  type: string;
  status: string;
  floor: string;
  building: string;
  minArea: number | null;
  maxArea: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface PropertyStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalValue: number;
  totalArea: number;
  averagePrice: number;
  propertiesByStatus: Record<string, number>;
  propertiesByType: Record<string, number>;
  propertiesByFloor: Record<string, number>;
  totalStorageUnits: number;
  availableStorageUnits: number;
  soldStorageUnits: number;
  uniqueBuildings: number;
  reserved: number;
}
