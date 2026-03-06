import * as React from 'react';

// Επεκτεταμένοι τύποι για measurement system
export type ToolType =
  | 'select'
  | 'pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-window'
  | 'zoom-extents'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'circle-diameter'
  | 'circle-2p-diameter'
  | 'circle-3p'
  | 'circle-chord-sagitta'
  | 'circle-2p-radius'
  | 'circle-best-fit'
  | 'circle-ttt'      // 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines (AutoCAD TTT)
  // 🏢 ENTERPRISE (2026-01-31): Arc drawing tools - ADR-059
  | 'arc'                  // Parent dropdown for arc tools
  | 'arc-3p'               // 3-Point Arc (Start → Point on Arc → End)
  | 'arc-cse'              // Center → Start → End
  | 'arc-sce'              // Start → Center → End
  // 🏢 ENTERPRISE (2026-01-31): Line drawing tools - ADR-060
  | 'line-perpendicular'   // Perpendicular line to reference line
  | 'line-parallel'        // Parallel line with offset
  | 'polyline'
  | 'polygon'
  | 'ellipse'
  | 'move'
  | 'rotate'
  | 'copy'
  | 'delete'
  | 'measure'
  | 'measure-distance'
  | 'measure-distance-continuous'
  | 'measure-area'
  | 'measure-angle'
  | 'measure-angle-line-arc'
  | 'measure-angle-two-arcs'
  | 'measure-angle-measuregeom'
  | 'measure-angle-constraint'
  | 'measure-radius'
  | 'measure-perimeter'
  | 'layering'
  | 'grip-edit'
  // ADR-189: Construction guide tools
  | 'guide-x'
  | 'guide-z'
  | 'guide-xz'         // ADR-189 §3.3: Diagonal guide (3-click)
  | 'guide-parallel'
  | 'guide-perpendicular'  // ADR-189 §3.4: Perpendicular guide (1-click)
  | 'guide-segments'       // ADR-189 §3.7: Snap points at equal segments
  | 'guide-distance'       // ADR-189 §3.8: Snap points at fixed distance
  | 'guide-add-point'      // ADR-189 §3.15: Add single snap point
  | 'guide-delete-point'   // ADR-189 §3.16: Delete snap point
  | 'guide-arc-segments'   // ADR-189 §3.9: Arc segment construction points
  | 'guide-arc-distance'   // ADR-189 §3.10: Arc distance construction points
  | 'guide-arc-line-intersect' // ADR-189 §3.12: Arc-Line intersection points
  | 'guide-circle-intersect'   // ADR-189 §3.11: Circle-Circle intersection points
  | 'guide-move'               // ADR-189 B5: Drag move guide
  | 'guide-delete'
  | 'guide-rect-center'        // Center of rectangle formed by 4 guides
  | 'guide-line-midpoint'      // Construction point at midpoint of line entity
  | 'guide-circle-center'     // Construction point at center of circle/arc entity
  | 'guide-grid'              // ADR-189 B2: Automatic grid generation
  | 'guide-rotate'            // ADR-189 B28: Rotate guide by typed angle
  | 'guide-rotate-all'        // ADR-189 B30: Rotate all guides around pivot
  | 'guide-rotate-group'      // ADR-189 B29: Rotate selected group of guides
  | 'guide-equalize'          // ADR-189 B33: Smart equalize spacing between guides
  | 'guide-polar-array'       // ADR-189 B31: Polar array of guides around center
  | 'guide-scale'             // ADR-189 B32: Scale all guides from origin
  | 'guide-angle'             // ADR-189 B16: Guide at typed angle through point
  | 'guide-mirror'            // ADR-189 B19: Mirror guides across axis
  | 'guide-from-entity'       // ADR-189 B8: Guide from DXF entity (LINE/CIRCLE/ARC/POLYLINE)
  | 'guide-select'            // ADR-189 B14: Multi-select guides for batch operations
  | 'guide-copy-pattern'      // ADR-189 B17: Copy/offset pattern of selected guides
  | 'guide-offset-entity'     // ADR-189 B24: Guide offset from entity edge
  | 'guide-preset-grid'       // ADR-189 B23: Structural preset grid
  | 'guide-from-selection';   // ADR-189 B37: Batch guide from selection


export interface ToolDefinition {
  id: ToolType;
  icon: React.ComponentType<React.ComponentProps<'svg'>> | string;
  label: string;
  hotkey: string;
  /** 🎨 ENTERPRISE: Color class for icon (from HOVER_TEXT_EFFECTS) */
  colorClass?: string;
  dropdownOptions?: { id: ToolType; icon: React.ComponentType<React.ComponentProps<'svg'>> | string; label: string; hotkey?: string; }[];
}

export interface ActionDefinition {
  id: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>> | string;
  label: string;
  hotkey?: string;  // ✅ ENTERPRISE: Fix type inconsistency - hotkey can be undefined
  active?: boolean;
  disabled?: boolean;
  /** 🎨 ENTERPRISE: Color class for icon (from HOVER_TEXT_EFFECTS) */
  colorClass?: string;
  onClick?: () => void;
}

export interface ToolbarState {
    activeTool: ToolType;
    showGrid: boolean;
    autoCrop: boolean;
    canUndo: boolean;
    canRedo: boolean;
    snapEnabled: boolean;
    showLayers: boolean;
    showCalibration?: boolean;
    currentZoom: number;
    commandCount?: number;
}

// MEASUREMENT TOOLS - Προσθήκη νέων εργαλείων
export type MeasurementTool =
  | 'measure-distance'
  | 'measure-distance-continuous'
  | 'measure-area'
  | 'measure-angle' 
  | 'measure-angle-line-arc'
  | 'measure-angle-two-arcs'
  | 'measure-angle-measuregeom'
  | 'measure-angle-constraint'
  | 'measure-radius' 
  | 'measure-perimeter';

// Επέκταση υπάρχοντος ToolType (αν δεν υπάρχει ήδη)
export type ExtendedToolType = ToolType | MeasurementTool;

export interface MeasurementToolConfig {
  id: MeasurementTool;
  name: string;
  icon: string;
  shortcut?: string;
  description: string;
  requiredPoints: number;
}

export const MEASUREMENT_TOOL_CONFIGS: Record<MeasurementTool, MeasurementToolConfig> = {
  'measure-distance': {
    id: 'measure-distance',
    name: 'Απόσταση',
    icon: 'Ruler',
    shortcut: 'D',
    description: 'Μέτρηση απόστασης μεταξύ 2 σημείων',
    requiredPoints: 2
  },
  // 🏢 ENTERPRISE (2026-01-27): Continuous distance measurement
  'measure-distance-continuous': {
    id: 'measure-distance-continuous',
    name: 'Συνεχόμενη Απόσταση',
    icon: 'Ruler',
    shortcut: 'D',
    description: 'Συνεχόμενη μέτρηση απόστασης (πολλαπλά σημεία)',
    requiredPoints: 2
  },
  'measure-area': {
    id: 'measure-area',
    name: 'Εμβαδό',
    icon: 'Square',
    shortcut: 'A', 
    description: 'Μέτρηση εμβαδού πολυγώνου (3+ σημεία)',
    requiredPoints: 3
  },
  'measure-angle': {
    id: 'measure-angle',
    name: 'Γωνία',
    icon: 'AngleIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας (3 σημεία)',
    requiredPoints: 3
  },
  'measure-radius': {
    id: 'measure-radius', 
    name: 'Ακτίνα',
    icon: 'Circle',
    description: 'Μέτρηση ακτίνας κύκλου',
    requiredPoints: 2
  },
  'measure-perimeter': {
    id: 'measure-perimeter',
    name: 'Περίμετρος',
    icon: 'Pentagon',
    description: 'Μέτρηση περιμέτρου σχήματος',
    requiredPoints: 2
  },
  // ✅ ENTERPRISE FIX: Add missing angle measurement tool configs
  'measure-angle-line-arc': {
    id: 'measure-angle-line-arc',
    name: 'Γωνία Γραμμή-Τόξο',
    icon: 'AngleLineArcIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας μεταξύ γραμμής και τόξου',
    requiredPoints: 3
  },
  'measure-angle-two-arcs': {
    id: 'measure-angle-two-arcs',
    name: 'Γωνία Δύο Τόξων',
    icon: 'AngleTwoArcsIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας μεταξύ δύο τόξων',
    requiredPoints: 3
  },
  'measure-angle-measuregeom': {
    id: 'measure-angle-measuregeom',
    name: 'Γωνία MeasureGeom',
    icon: 'AngleMeasureGeomIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας με MEASUREGEOM (χωρίς διάσταση)',
    requiredPoints: 3
  },
  'measure-angle-constraint': {
    id: 'measure-angle-constraint',
    name: 'Παραμετρικό Constraint Γωνίας',
    icon: 'AngleConstraintIcon',
    shortcut: 'T',
    description: 'Παραμετρικό angle constraint',
    requiredPoints: 3
  }
};

// ============================================================================
// 🏢 ADR-050: OVERLAY TOOLBAR INTEGRATION (2027-01-27)
// Extended props for unified toolbar with overlay section
// ============================================================================

import type { OverlayToolbarState, OverlayToolbarHandlers } from './overlay-section/types';

// ============================================================================
// 🏢 ADR-082: TOOL HINTS SYSTEM (2026-01-31)
// Portable step-by-step guidance for drawing tools
// ============================================================================

/**
 * Tool hint data for step-by-step guidance
 * Localized via i18n (tool-hints namespace)
 */
export interface ToolHint {
  /** Tool display name (localized) */
  name: string;
  /** Tool description (localized) */
  description: string;
  /** Step-by-step instructions (localized, with color emojis) */
  steps: string[];
  /** Available keyboard shortcuts for this tool */
  shortcuts: string;
}

/**
 * Return type of useToolHints hook
 * Provides current hint state based on active tool and drawing progress
 */
export interface ToolHintsResult {
  /** Current tool hint data (null if no hints for tool) */
  hint: ToolHint | null;
  /** Current step index (0-based, based on pointCount) */
  currentStep: number;
  /** Total number of steps for this tool */
  totalSteps: number;
  /** Current step text (with emoji, ready to display) */
  currentStepText: string;
  /** Whether hints are available for this tool */
  hasHints: boolean;
  /** Whether i18n namespace is ready */
  isReady: boolean;
}

/**
 * Extended props for EnhancedDXFToolbar (backward compatible)
 * These props are optional for gradual migration
 */
export interface EnhancedDXFToolbarPropsExtended {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showLayers?: boolean;
  showCursorSettings?: boolean;
  currentZoom: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string) => void;
  mouseCoordinates?: { x: number; y: number } | null;
  showCoordinates?: boolean;

  // 🏢 ADR-050: Overlay toolbar integration (optional for feature flag)
  overlayToolbarState?: OverlayToolbarState;
  overlayToolbarHandlers?: OverlayToolbarHandlers;
  showOverlaySection?: boolean;
  selectedOverlayId?: string | null;
  isOverlaySectionCollapsed?: boolean;
  onToggleOverlaySection?: () => void;

  /** ADR-176: Mobile sidebar toggle callback */
  onSidebarToggle?: () => void;

  /** ADR-189: Whether construction guides are visible */
  guidesVisible?: boolean;
}
