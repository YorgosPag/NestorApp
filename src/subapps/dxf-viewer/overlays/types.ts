// src/subapps/dxf-viewer/overlays/types.ts
// Overlay types, constants και enums για το DXF Viewer Βήμα 2

import { PropertyStatus, ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS, DEFAULT_PROPERTY_STATUS } from '../../../constants/property-statuses-enterprise';
// 🏢 ADR-044: Centralized line widths (import at top of file to avoid hoisting issues)
import { RENDER_LINE_WIDTHS } from '../config/text-rendering-config';
// 🏢 ENTERPRISE: Unified EventBus for type-safe event dispatch
import { EventBus } from '../systems/events';

export type Scope = 'project' | 'building' | 'floor' | 'property' | 'parking' | 'storage';
export type OverlayKind = 'property' | 'parking' | 'storage' | 'footprint';

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
  kind: OverlayKind;          // property/parking/storage/footprint
  polygon: Array<[number, number]>; // world coords, κλειστό polyline
  /** @deprecated ADR-258: Χρωματισμός γίνεται δυναμικά βάσει linked entity → commercialStatus */
  status?: Status;
  label?: string;             // A-12, P-034 κτλ
  linked?: {
    propertyId?: string;
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
 * ADR-258B: `linked` accepts `null` to clear the entity link (Firestore rejects undefined but accepts null)
 */
export type UpdateOverlayData = Partial<Pick<Overlay, 'polygon' | 'status' | 'label' | 'kind' | 'style'>> & {
  linked?: Overlay['linked'] | null;
};

/**
 * 🎯 OVERLAY STATUS KEYS - Only the 5 basic statuses for overlay toolbar
 * These are the statuses that have proper colors and translations
 */
export const OVERLAY_STATUS_KEYS: Status[] = [
  'for-sale',
  'for-rent',
  'reserved',
  'sold',
  'landowner'
] as const;

/**
 * Σταθερά χρώματα status - χρησιμοποιούμε τα κεντρικά
 * ⚠️ CAUTION: This contains ALL enhanced statuses (27+)
 * For overlay toolbar iteration, use OVERLAY_STATUS_KEYS instead
 */
export const STATUS_COLORS = PROPERTY_STATUS_COLORS;

/**
 * Display labels για UI - χρησιμοποιούμε τα κεντρικά
 * ⚠️ CAUTION: This contains ALL enhanced statuses (27+)
 * For overlay toolbar iteration, use OVERLAY_STATUS_KEYS instead
 */
export const STATUS_LABELS = PROPERTY_STATUS_LABELS;

/**
 * Display labels για UI - i18n keys για translation
 * 🌐 i18n: Uses keys from dxf-viewer:overlayProperties.kindLabels namespace
 */
export const KIND_LABELS: Record<OverlayKind, string> = {
  property:  'dxf-viewer:overlayProperties.kindLabels.property',
  parking:   'dxf-viewer:overlayProperties.kindLabels.parking',
  storage:   'dxf-viewer:overlayProperties.kindLabels.storage',
  footprint: 'dxf-viewer:overlayProperties.kindLabels.footprint',
};

/**
 * Rendering constants
 * 🏢 ADR-044: Using centralized RENDER_LINE_WIDTHS (backward compatibility)
 */
export const OVERLAY_ALPHA_FILL = 0.05;        // πολύ διαφανές γέμισμα
// 🏢 ADR-044: Use centralized line widths
export const OVERLAY_STROKE_WIDTH = RENDER_LINE_WIDTHS.OVERLAY;
export const OVERLAY_SELECTED_STROKE_WIDTH = RENDER_LINE_WIDTHS.OVERLAY_SELECTED;

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
  before?: Partial<Overlay>;
  after?: Partial<Overlay>;
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
export const DEFAULT_KIND: OverlayKind = 'property';
export const UNDO_STACK_SIZE = 50;

/**
 * Firestore collection names
 */
export const OVERLAY_COLLECTION_PREFIX = 'dxf-overlay-levels';

/**
 * Shared overlay handler functions to eliminate duplicates
 * Used by CanvasSection.tsx and LevelPanel.tsx
 */
export const createOverlayHandlers = (overlayStore: {
  setSelectedOverlay: (id: string | null) => void;
  remove: (id: string) => void;
  update: (id: string, updates: UpdateOverlayData) => void;
  getSelectedOverlay: () => Overlay | null;
  overlays: Record<string, Overlay>;
}, levelSwitcher?: {
  setCurrentLevel: (levelId: string) => void;
}) => ({
  handleOverlaySelect: (id: string | null) => {
    overlayStore.setSelectedOverlay(id);

    // ✅ AUTO-SWITCH LEVEL: Όταν επιλέγεται overlay, αλλάζει αυτόματα στο level του overlay
    if (id && overlayStore.overlays[id] && levelSwitcher) {
      const overlay = overlayStore.overlays[id];
      const overlayLevelId = overlay.levelId;

      // Καλώ ΑΠΕΥΘΕΙΑΣ την setCurrentLevel function (όπως στο κλικ της κάρτας επιπέδου)
      levelSwitcher.setCurrentLevel(overlayLevelId);

      // 🔥 MISSING STEP: Καλώ τα ίδια functions που καλεί το level card click!
      // 🏢 ENTERPRISE: Unified EventBus dispatch (type-safe, reaches EventBus.on listeners)
      EventBus.emit('level-panel:layering-activate', { levelId: overlayLevelId, source: 'overlay-click' });
    }
  },
  handleOverlayEdit: (id: string) => {
    overlayStore.setSelectedOverlay(id);
  },
  handleOverlayDelete: (id: string) => {
    overlayStore.remove(id);
  },
  handleOverlayUpdate: (id: string, updates: UpdateOverlayData) => {
    overlayStore.update(id, updates);
  }
});
