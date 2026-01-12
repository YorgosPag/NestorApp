// Building hierarchy interfaces
export interface Contact {
    id: string;
    name: string;
    type: 'individual' | 'company' | 'government';
    email?: string;
    phone?: string;
    address?: string;
  }
  
  export interface Project {
    id: string;
    name: string;
    contactId: string; // References Contact
    description?: string;
    startDate?: string;
    expectedCompletionDate?: string;
    status: 'planning' | 'active' | 'completed' | 'cancelled';
    totalValue?: number;
  }
  
  export interface Building {
    id: string;
    name: string;
    projectId: string; // References Project
    description?: string;
    address?: string;
    city?: string;
    totalArea: number;
    builtArea?: number;
    floors: number;
    units?: number;
    status: 'planning' | 'construction' | 'completed' | 'active';
    progress: number; // 0-100
    startDate?: string;
    completionDate?: string;
    totalValue?: number;
    company?: string;
    companyId?: string;
    project?: string;
    category?: 'mixed' | 'residential' | 'commercial' | 'industrial';
    features?: string[];
  }
  
  export interface Floor {
    id: string;
    buildingId: string; // References Building
    name: string; // "Υπόγειο", "Ισόγειο", "1ος Όροφος", etc.
    level: number; // -2, -1, 0, 1, 2, etc.
    area: number;
    properties: Property[];
    storageUnits: unknown[]; // Using 'unknown' to avoid circular dependency, StorageUnit defined elsewhere
  }
  
  export interface Property {
    id: string;
    floorId: string; // References Floor
    code: string;
    type: 'studio' | 'apartment_1br' | 'apartment_2br' | 'apartment_3br' | 'maisonette' | 'store';
    area: number;
    price: number;
    status: 'available' | 'sold' | 'reserved';
    rooms?: number;
    bathrooms?: number;
    hasBalcony?: boolean;
    balconyArea?: number;
    features: string[];
    linkedStorageUnits?: string[]; // Array of StorageUnit IDs
  }
  