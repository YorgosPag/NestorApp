'use client';

import type { Property } from '@/types/property-viewer';
import type { Suggestion } from '@/types/suggestions';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { LayerState } from '@/features/floorplan-viewer/types';

export interface FloorData {
  id: string;
  name: string;
  level: number;
  buildingId: string;
  floorPlanUrl?: string;
  properties: Property[];
}

export type Point = { x: number; y: number };

export interface MeasurementLine {
  id: string;
  start: Point;
  end: Point;
  length: number;
  unit: string;
}

export interface PolyLine {
  id: string;
  points: Point[];
  closed: boolean;
  strokeStyle: string;
  lineWidth: number;
}

export type CanvasMode = 'view' | 'measure' | 'polyline' | 'create' | 'edit';

export interface UIState {
  isDrawing: boolean;
  activeMode: CanvasMode;
  selectedElements: string[];
  // 🏢 ENTERPRISE: Additional UI state properties
  isDragging?: boolean;
  isCreating?: boolean;
  hoveredPropertyId?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ConnectionPair {
  start: Property;
  end: Property;
  type: 'connection' | 'group';
}

export interface CanvasDimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}
