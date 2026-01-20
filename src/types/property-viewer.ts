

// Re-export PropertyStats from property.ts
export type { PropertyStats } from './property';

export interface Property {
    id: string;
    code?: string;
    name: string;
    type: string;
    building: string;
    floor: number;
    status: 'for-sale' | 'for-rent' | 'sold' | 'rented' | 'reserved';
    price?: number;
    area?: number;
    project: string;
    description?: string;
    buildingId: string;
    floorId: string;
    vertices: Array<{x: number, y: number}>;
    isMultiLevel?: boolean;
    levels?: { floorId: string; name: string; }[];
    parentPropertyId?: string;
    features?: string[];
    attachments?: {
        parkingSpots: string[];
        storageRooms: string[];
    }
    soldTo?: string | null; // ID of the contact
    saleDate?: string | null; // Date of sale
  }
  
export interface StorageUnitStub {
    id: string;
    code: string;
    floor: string;
    area: number;
}

export interface ParkingSpotStub {
    id: string;
    code: string;
    type: 'underground' | 'covered' | 'open';
    level: string;
}

// Extended type for full details panel, can be expanded later
export interface ExtendedPropertyDetails extends Property {
    rooms?: number;
    bathrooms?: number;
    owner?: {
      name: string;
      phone?: string;
      email?: string;
    };
    agent?: {
      name: string;
      phone?: string;
      email?: string;
    };
    dates?: {
      created: string;
      updated: string;
      available?: string;
    };
    documents?: Array<{
      id: string;
      name: string;
      type: string;
      url: string;
    }>;
  }

export interface FilterState {
  searchTerm: string;
  project: string[];
  building: string[];
  floor: string[];
  propertyType: string[];
  status: string[];
  priceRange: { min: number | null; max: number | null };
  areaRange: { min: number | null; max: number | null };
  features: string[];
}
