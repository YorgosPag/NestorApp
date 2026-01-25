/**
 * CANVAS V2 - LAYER SPECIFIC TYPES
 * Τύποι μόνο για το Layer canvas module
 */

import type { Point2D } from '../../rendering/types/Types';
import type { RegionStatus } from '../../types/overlay';
// ✅ REMOVED DUPLICATE: Use main RulerSettings from systems/rulers-grid/config.ts
import type { RulerSettings as CoreRulerSettings } from '../../systems/rulers-grid/config';

// === LAYER TYPES ===
export interface ColorLayer {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  zIndex: number;
  status?: RegionStatus;       // ✅ OPTIONAL: Status for STATUS_COLORS mapping (backward compatibility)
  polygons: LayerPolygon[];
  // 🔧 DRAFT POLYGON GRIPS (2026-01-24): Show vertex grips during polygon drawing
  isDraft?: boolean;           // True if this is a draft/preview layer
  showGrips?: boolean;         // Show grips at each vertex
  isNearFirstPoint?: boolean;  // True if cursor is near first point (for close polygon highlight)
  // 🏢 ENTERPRISE (2026-01-25): Edge midpoint grips for vertex insertion (Autodesk pattern)
  showEdgeMidpoints?: boolean; // Show midpoint grips on edges for adding new vertices
  hoveredEdgeIndex?: number;   // Index of currently hovered edge (for visual feedback)
  hoveredVertexIndex?: number; // Index of currently hovered vertex grip (for visual feedback)
}

export interface LayerPolygon {
  id: string;
  vertices: Point2D[];
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  selected: boolean;
}

// === CROSSHAIR TYPES ===
// ✅ REMOVED DUPLICATE: CrosshairSettings μεταφέρθηκε στο rendering/ui/crosshair/CrosshairTypes.ts
// export interface CrosshairSettings {
//   enabled: boolean;
//   color: string;
//   size: number;
//   opacity: number;
//   style: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
//   // Extended properties από CursorSystem
//   lineWidth?: number;
//   useCursorGap?: boolean;
//   centerGapPx?: number;
// }

// === SNAP TYPES ===
export interface SnapSettings {
  enabled: boolean;
  types: SnapType[];
  tolerance: number;
}

export type SnapType = 'endpoint' | 'midpoint' | 'center' | 'intersection';

export interface SnapResult {
  point: Point2D;
  type: SnapType;
  entityId?: string;
}

// === GRID TYPES ===
export interface GridSettings {
  enabled: boolean;
  visible?: boolean;  // ✅ ENTERPRISE: Visibility control
  size: number;
  color: string;
  opacity: number;
  style: 'dots' | 'lines' | 'crosses'; // ✅ ENTERPRISE: Added 'crosses' style

  // ✅ EXTENDED PROPERTIES: Advanced grid configuration
  majorGridColor?: string;
  minorGridColor?: string;
  lineWidth?: number;
  majorGridWeight?: number;
  minorGridWeight?: number;
  majorInterval?: number;
  showMajorGrid?: boolean;
  showMinorGrid?: boolean;
  adaptiveOpacity?: boolean;
  minVisibleSize?: number;
}

// === RULERS TYPES ===
// Type alias για Layer canvas compatibility - references main RulerSettings
export type RulerSettings = {
  enabled: boolean;
  visible?: boolean;    // ✅ ENTERPRISE: Visibility control
  opacity?: number;     // ✅ ENTERPRISE: Opacity control (0.0 - 1.0)
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  unit?: 'mm' | 'cm' | 'm';
  textColor?: string;
  showLabels?: boolean;
  showUnits?: boolean;
  showBackground?: boolean;
  showMajorTicks?: boolean;
  showMinorTicks?: boolean;
  majorTickColor?: string;
  minorTickColor?: string;
  majorTickLength?: number;
  minorTickLength?: number;
  tickInterval?: number;  // ✅ ENTERPRISE: Tick interval for ruler marks
  height?: number;  // Extracted from CoreRulerSettings.horizontal.height
  width?: number;   // Extracted from CoreRulerSettings.vertical.width
  position?: 'top' | 'bottom' | 'left' | 'right';
  unitsFontSize?: number;
  unitsColor?: string;
  labelPrecision?: number; // ✅ ENTERPRISE: Decimal precision for labels
  borderColor?: string;    // ✅ ENTERPRISE: Border color
  borderWidth?: number;    // ✅ ENTERPRISE: Border width
};

// === CURSOR TYPES ===
// ✅ REMOVED DUPLICATE: Χρησιμοποιούμε μόνο το CursorSettings από systems/cursor/config.ts
// import type { CursorSettings } from '../../systems/cursor/config';

// === SELECTION TYPES ===
export interface SelectionSettings {
  window: {
    fillColor: string;
    fillOpacity: number;
    borderColor: string;
    borderOpacity: number;
    borderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
    borderWidth: number;
  };
  crossing: {
    fillColor: string;
    fillOpacity: number;
    borderColor: string;
    borderOpacity: number;
    borderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
    borderWidth: number;
  };
}

export interface SelectionBox {
  startPoint: Point2D;
  endPoint: Point2D;
  type: 'window' | 'crossing';
}

// === LAYER RENDER OPTIONS ===
// 🏢 ENTERPRISE: Import centralized GripSettings type
import type { GripSettings } from '../../types/gripSettings';

export interface LayerRenderOptions {
  showCrosshair: boolean;
  showCursor: boolean;
  showSnapIndicators: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showSelectionBox: boolean;
  crosshairPosition: Point2D | null;
  cursorPosition: Point2D | null;
  snapResults: SnapResult[];
  selectionBox: SelectionBox | null;
  // 🏢 ENTERPRISE (2026-01-25): Centralized grip settings for vertex/edge grips
  gripSettings?: GripSettings;
}