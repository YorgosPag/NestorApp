// src/subapps/dxf-viewer/overlays/types.ts
// Overlay types, constants και enums για το DXF Viewer Βήμα 2

import { PropertyStatus, PROPERTY_STATUS_LABELS, PROPERTY_STATUS_COLORS, DEFAULT_PROPERTY_STATUS } from '../../../constants/statuses';
import { Point2D } from '../types/shared';

export type Scope = 'project' | 'building' | 'floor' | 'unit' | 'parking' | 'storage';
export type OverlayKind = 'unit' | 'parking' | 'storage' | 'footprint';

// Use centralized PropertyStatus instead of local Status
export type Status = PropertyStatus;

/**
 * Κύριο Overlay interface
 * Κάθε overlay είναι ένα κλειστό polygon με status, label και metadata
 */
export interface OverlayStyle {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface Overlay {
  id: string;
  levelId: string;            // τρέχον Level ως «plan holder» (προς το παρόν)
  kind: OverlayKind;          // unit/parking/storage/footprint
  polygon: Array<[number, number]>; // world coords, κλειστό polyline
  status?: Status;
  label?: string;             // A-12, P-034 κτλ
  linked?: { 
    unitId?: string; 
    parkingId?: string; 
    storageId?: string; 
  };
  style?: OverlayStyle;       // ToolStyle colors and properties
  createdAt: number; 
  updatedAt: number; 
  createdBy: string;
}

/**
 * Partial overlay για δημιουργία νέων
 */
export type CreateOverlayData = Omit<Overlay, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

/**
 * Patch data για updates
 */
export type UpdateOverlayData = Partial<Pick<Overlay, 'polygon' | 'status' | 'label' | 'kind' | 'linked' | 'style'>>;

/**
 * Σταθερά χρώματα status - χρησιμοποιούμε τα κεντρικά
 */
export const STATUS_COLORS = PROPERTY_STATUS_COLORS;

/**
 * Display labels για UI - χρησιμοποιούμε τα κεντρικά  
 */
export const STATUS_LABELS = PROPERTY_STATUS_LABELS;

export const KIND_LABELS: Record<OverlayKind, string> = {
  unit:      'Μονάδα',
  parking:   'Parking',
  storage:   'Αποθήκη',
  footprint: 'Αποτύπωμα',
};

/**
 * Rendering constants
 */
export const OVERLAY_ALPHA_FILL = 0.05;        // πολύ διαφανές γέμισμα
export const OVERLAY_STROKE_WIDTH = 12;        // πολύ χοντρό περίγραμμα
export const OVERLAY_SELECTED_STROKE_WIDTH = 15; // ακόμα πιο χοντρό όταν επιλεγμένο

/**
 * Validation constants
 */
import { MIN_POLY_POINTS, MIN_POLY_AREA, VERTEX_HANDLE_SIZE, SNAP_TOLERANCE } from '../config/tolerance-config';

// Re-export central tolerance constants
export { MIN_POLY_POINTS, MIN_POLY_AREA, VERTEX_HANDLE_SIZE, SNAP_TOLERANCE };

/**
 * Editor modes
 */
export type OverlayEditorMode = 'select' | 'draw' | 'edit';

/**
 * Undo/Redo action types
 */
export type OverlayActionType = 'add' | 'delete' | 'move' | 'edit-vertex' | 'duplicate' | 'set-status' | 'set-label' | 'set-kind' | 'set-link';

export interface OverlayAction {
  type: OverlayActionType;
  overlayId: string;
  before?: any;
  after?: any;
  timestamp: number;
}

/**
 * Hit test result
 */
export interface HitTestResult {
  overlayId: string;
  type: 'fill' | 'stroke' | 'vertex';
  vertexIndex?: number;
  distance: number;
}

/**
 * Geometry utilities types
 */
// Point2D now imported from shared types

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Default values
 */
export const DEFAULT_STATUS: Status = DEFAULT_PROPERTY_STATUS;
export const DEFAULT_KIND: OverlayKind = 'unit';
export const AUTOSAVE_DEBOUNCE_MS = 600;
export const UNDO_STACK_SIZE = 50;

/**
 * Firestore collection names
 */
export const OVERLAY_COLLECTION_PREFIX = 'dxf-overlay-levels';

/**
 * Shared overlay handler functions to eliminate duplicates
 * Used by CanvasSection.tsx and LevelPanel.tsx
 */
export const createOverlayHandlers = (overlayStore: any) => ({
  handleOverlaySelect: (id: string | null) => {
    overlayStore.setSelectedOverlay(id);
  },
  handleOverlayEdit: (id: string) => {
    overlayStore.setSelectedOverlay(id);
  },
  handleOverlayDelete: (id: string) => {
    overlayStore.remove(id);
  },
  handleOverlayUpdate: (id: string, updates: any) => {
    overlayStore.update(id, updates);
  }
});
