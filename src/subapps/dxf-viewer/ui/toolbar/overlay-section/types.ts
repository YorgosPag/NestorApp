/**
 * ui/toolbar/overlay-section/types.ts
 * Type definitions for overlay toolbar section components
 *
 * 🏢 ADR-050: UNIFIED TOOLBAR INTEGRATION (2027-01-27)
 * Type definitions για το overlay toolbar section που ενσωματώνεται
 * στο EnhancedDXFToolbar ως Row 2 (collapsible section)
 */

import type { Status, OverlayKind, OverlayEditorMode } from '../../../overlays/types';
import type { ToolType } from '../types';

/**
 * Overlay toolbar state (passed from DxfViewerContent)
 */
export interface OverlayToolbarState {
  mode: OverlayEditorMode;              // 'draw' | 'edit' | 'select'
  currentStatus: Status;                // Current selected status color
  currentKind: OverlayKind;             // Current selected kind (unit/parking/storage/footprint)
  draftPolygonInfo: {
    pointCount: number;                 // Number of points in draft polygon
    canSave: boolean;                   // Whether polygon can be saved (≥3 points)
  };
}

/**
 * Overlay toolbar event handlers (callbacks to DxfViewerContent)
 */
export interface OverlayToolbarHandlers {
  onModeChange: (mode: OverlayEditorMode) => void;
  onStatusChange: (status: Status) => void;
  onKindChange: (kind: OverlayKind) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToolChange: (tool: ToolType) => void;
}

/**
 * Props for OverlayToolbarSection (main container)
 */
export interface OverlayToolbarSectionProps {
  state: OverlayToolbarState;
  handlers: OverlayToolbarHandlers;
  selectedOverlayId: string | null;    // ID of selected overlay (for delete button state)
  canDelete: boolean;                   // Whether delete button is enabled
  isCollapsed: boolean;                 // Whether section is collapsed
  onToggleCollapse: () => void;         // Toggle collapse callback
}
