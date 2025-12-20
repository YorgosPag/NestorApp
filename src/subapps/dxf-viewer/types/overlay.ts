import type { Point2D } from '../rendering/types/Types';
import { PropertyStatus, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '../../../constants/property-statuses-enterprise';

export type { Point2D } from '../rendering/types/Types';

export interface RegionStyle {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface Region {
  id: string;
  vertices: Point2D[];
  status: PropertyStatus;
  layer: OverlayLayer;
  metadata?: Record<string, unknown>;
  locked?: boolean;
  visible?: boolean;
  opacity?: number;
  unitType?: UnitType;
  color?: string;
  area?: number;
  perimeter?: number;
  createdAt?: string;
  updatedAt?: string;
  levelId?: string;
  style?: RegionStyle; // ToolStyle colors and properties
}

// 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιεί PropertyStatus από enterprise system
export type RegionStatus = PropertyStatus;
export type UnitType = 'studio' | '1BR' | '2BR' | '3BR' | 'maisonette' | 'store' | 'office' | 'other';
export type OverlayLayer = 'base' | 'annotation' | 'measurement' | 'temp';

export interface OverlayState {
  regions: Region[];
  activeRegion: string | null;
  activeLayer: OverlayLayer;
  isDrawing: boolean;
  snapEnabled: boolean;
  gridVisible: boolean;
}

// --- UTILITY FUNCTIONS ---
// STATUS_COLORS διαγράφηκε - χρησιμοποιούμε κεντρικό getStatusColors() από config/color-mapping.ts

export const calculateRegionArea = (vertices: Point2D[]): number => {
  if (vertices.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    area += (vertices[j].x + vertices[i].x) * (vertices[j].y - vertices[i].y);
  }
  return Math.abs(area / 2);
};

export const calculateRegionPerimeter = (vertices: Point2D[]): number => {
  if (vertices.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const dx = vertices[i].x - vertices[j].x;
    const dy = vertices[i].y - vertices[j].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
};
