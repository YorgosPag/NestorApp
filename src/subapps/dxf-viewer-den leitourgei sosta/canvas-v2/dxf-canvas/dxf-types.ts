/**
 * CANVAS V2 - DXF SPECIFIC TYPES
 * Τύποι μόνο για το DXF canvas module
 */

import type { Point2D } from '../../rendering/types/Types';

// === DXF ENTITY TYPES ===
export interface DxfEntity {
  id: string;
  type: 'line' | 'circle' | 'arc' | 'polyline' | 'text';
  layer: string;
  color: string;
  lineWidth: number;
  visible: boolean;
}

export interface DxfLine extends DxfEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface DxfCircle extends DxfEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface DxfPolyline extends DxfEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export interface DxfArc extends DxfEntity {
  type: 'arc';
  center: Point2D;
  radius: number;
  startAngle: number; // in degrees
  endAngle: number; // in degrees
}

export interface DxfText extends DxfEntity {
  type: 'text';
  position: Point2D;
  text: string;
  height: number;
  rotation?: number; // in degrees
}

export type DxfEntityUnion = DxfLine | DxfCircle | DxfPolyline | DxfArc | DxfText;

// === DXF SCENE ===
export interface DxfScene {
  entities: DxfEntityUnion[];
  layers: string[];
  bounds: {
    min: Point2D;
    max: Point2D;
  } | null;
}

// === DXF RENDERING ===
export interface DxfRenderOptions {
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
  selectedEntityIds: string[];
}

// === DXF SELECTION ===
export interface DxfSelectionResult {
  entityId: string;
  distance: number;
  point: Point2D;
}