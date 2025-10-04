import type { Point2D } from './scene';
import { PropertyStatus, PROPERTY_STATUS_COLORS } from '../../../constants/statuses';

export type { Point2D } from './scene';

export interface RegionStyle {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface Region {
  id: string;
  vertices: Point2D[];
  status: RegionStatus;
  layer: OverlayLayer;
  metadata?: Record<string, any>;
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

export type RegionStatus = 'draft' | 'active' | 'locked' | 'hidden' | PropertyStatus;
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

// --- ADDED CONSTANTS & FUNCTIONS ---

export const STATUS_COLORS: Record<RegionStatus, string> = {
  draft: '#a0aec0',
  active: '#48bb78', 
  locked: '#f56565',
  hidden: '#718096',
  ...PROPERTY_STATUS_COLORS, // Use centralized property status colors
};

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
