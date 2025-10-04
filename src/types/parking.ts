export interface ParkingSpot {
    id: string;
    code: string;
    type: 'underground' | 'covered' | 'open';
    propertyCode: string;
    level: string;
    area: number;
    price: number;
    value: number;
    valueWithSyndicate: number;
    status: 'sold' | 'owner' | 'available' | 'reserved';
    owner: string;
    floorPlan: string;
    constructedBy: string;
    projectId: number;
    buildingId?: string;
    notes?: string;
    saleDate?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface ParkingStats {
    totalSpots: number;
    soldSpots: number;
    availableSpots: number;
    ownerSpots: number;
    reservedSpots: number;
    totalValue: number;
    totalArea: number;
    averagePrice: number;
    spotsByType: Record<string, number>;
    spotsByLevel: Record<string, number>;
    spotsByStatus: Record<string, number>;
  }
  
  export interface ParkingFilters {
    searchTerm: string;
    type: string;
    status: string;
    level: string;
    owner: string;
    minArea: number | null;
    maxArea: number | null;
    minPrice: number | null;
    maxPrice: number | null;
  }
  
  export type ParkingSpotType = 'underground' | 'covered' | 'open';
  export type ParkingSpotStatus = 'sold' | 'owner' | 'available' | 'reserved';
  
  export const PARKING_TYPE_LABELS: Record<ParkingSpotType, string> = {
    underground: 'Υπόγεια',
    covered: 'Σκεπαστή',
    open: 'Υπαίθρια'
  };
  
  export const PARKING_STATUS_LABELS: Record<ParkingSpotStatus, string> = {
    sold: 'Πουλημένο',
    owner: 'Οικοπεδούχου',
    available: 'Διαθέσιμο',
    reserved: 'Κρατημένο'
  };
  
  export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
    sold: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    available: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  };
