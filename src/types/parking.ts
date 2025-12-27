import { COLOR_BRIDGE } from '@/design-system/color-bridge';

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
  
  /**
   * ✅ ENTERPRISE: DEPRECATED - Use useSemanticColors().getParkingStatusClass() instead
   *
   * Migration path:
   * ```typescript
   * // OLD (DEPRECATED):
   * className={PARKING_STATUS_COLORS[status]}
   *
   * // NEW (CENTRALIZED):
   * import { useSemanticColors } from '@/hooks/useSemanticColors';
   * const colors = useSemanticColors();
   * className={colors.getParkingStatusClass(status)}
   * ```
   *
   * @deprecated Use colors.getParkingStatusClass(status) from useSemanticColors hook
   */
  // ✅ ENTERPRISE: Semantic color mapping for parking statuses
  export const PARKING_STATUS_COLORS: Record<ParkingSpotStatus, string> = {
    sold: `${COLOR_BRIDGE.bg.success} ${COLOR_BRIDGE.text.success}`,     // Green -> Success semantic
    owner: `${COLOR_BRIDGE.bg.info} ${COLOR_BRIDGE.text.info}`,          // Blue -> Info semantic
    available: `${COLOR_BRIDGE.bg.neutralSubtle} ${COLOR_BRIDGE.text.secondary}`, // Slate -> Neutral semantic
    reserved: `${COLOR_BRIDGE.bg.warning} ${COLOR_BRIDGE.text.warning}`   // Yellow -> Warning semantic
  };
