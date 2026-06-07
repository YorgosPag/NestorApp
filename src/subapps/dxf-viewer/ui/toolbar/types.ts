import * as React from 'react';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';

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
  | 'text'                 // ADR-344 Phase 6.E follow-up: TEXT creation tool (single-line)
  | 'mtext'               // ADR-344 Phase 6.F: MTEXT creation tool (multiline, width-bounded)

  | 'move'
  | 'rotate'
  | 'scale'             // ADR-348: Scale command (uniform + non-uniform + reference + copy)
  | 'mirror'            // ADR-2xx: Mirror command
  | 'copy'
  | 'bim-copy'            // ADR-363 R1: BIM clipboard copy (AutoCAD COPY pattern)
  | 'delete'
  // ADR-349 Phase 1a: Stretch command (crossing-window displacement)
  | 'stretch'
  | 'mstretch'
  // ADR-350: Trim command (Ψαλίδισμα — quick + standard, with SHIFT→EXTEND inverse)
  | 'trim'
  // ADR-353: Extend command (Επέκταση — quick + standard, with SHIFT→TRIM inverse)
  | 'extend'
  // ADR-353: Rectangular Array command (Πίνακας — Phase A: rect only)
  | 'array-rect'
  // ADR-353: Polar Array command (Πίνακας Πολικός — Phase B)
  | 'array-polar'
  | 'measure'
  | 'measure-distance'
  | 'measure-distance-continuous'
  | 'measure-area'
  | 'auto-measure-area'
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
  | 'guide-from-selection'    // ADR-189 B37: Batch guide from selection
  | 'crop-window'             // Crop scene to drawn window region
  | 'polygon-crop'            // Crop scene to click-to-add-points polygon
  | 'lasso-crop'              // Crop scene to freehand drawn polygon
  // ADR-358: Stair drawing tool (Phase 0 stub — ribbon button + hotkey wire-up only)
  | 'stair'
  // ADR-363 Phase 1: BIM Wall drawing tool (parametric wall με WallDna composition)
  | 'wall'
  // ADR-363 Phase 1J: BIM Wall on existing 2D entity (pick line/rectangle → wall(s))
  | 'wall-on-entity'
  // ADR-419: BIM Wall in region — 3 διακριτές εντολές (split του πρώην 'wall-in-region'):
  // «από 4 γραμμές» / «μέσα σε περιοχή» / «με πλαίσιο». ΙΔΙΑ region-detection SSoT.
  | 'wall-region-lines'
  | 'wall-region-inside'
  | 'wall-region-box'
  // ADR-363 «Τοίχος από περίγραμμα»: box-select the faces of a structural element → leg walls
  | 'wall-from-perimeter'
  // ADR-363 Phase 5.6: BIM Wall Split tool (Revit Split Element pattern)
  | 'wall-split'
  // ADR-401 Phase E.1: BIM Wall Attach Top/Base pick-host (Revit Attach Top/Base)
  | 'wall-attach-top'
  | 'wall-attach-base'
  // ADR-401 Phase F.3: BIM Column Attach Top/Base pick-host (Revit Attach Top/Base)
  | 'column-attach-top'
  | 'column-attach-base'
  // ADR-401 Phase G.3: BIM Stair Attach Top/Base pick-host (Revit Attach Top/Base)
  | 'stair-attach-top'
  | 'stair-attach-base'
  // ADR-363 Phase 2: BIM Opening drawing tool (5 kinds — door/window/sliding/french/fixed)
  | 'opening'
  // ADR-363 Phase 3: BIM Slab drawing tool (polygon — floor/ceiling/roof/ground/foundation)
  | 'slab'
  // ADR-363 Phase 4: BIM Column drawing tool (rectangular/circular/L-shape/T-shape)
  | 'column'
  // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα»: box-select faces → ΕΝΑ ColumnEntity/περίμετρο
  | 'column-from-perimeter'
  // ADR-363 Φάση 3c «Κολώνα από περίγραμμα»: box-select faces → ΧΩΡΙΣ ένωση, αυτόματη
  // ταξινόμηση κολώνα/τοιχίο ανά αναλογία πλευρών + ενημερωτικό confirm dialog
  | 'column-discrete-from-perimeter'
  // ADR-419 «Κολώνα σε περιοχή»: 3 διακριτές εντολές (split του πρώην 'column-in-region'):
  // «από 4 γραμμές» / «μέσα σε περιοχή» / «με πλαίσιο» → ColumnEntity ανά εσώκλειστο
  // ορθογώνιο (ΙΔΙΑ region-detection SSoT με τα 'wall-region-*')
  | 'column-region-lines'
  | 'column-region-inside'
  | 'column-region-box'
  // ADR-419 «Πολλαπλή δημιουργία τοιχίων» — discrete-from-perimeter με intent=walls
  // (καθρέφτης του 'column-discrete-from-perimeter' intent=columns· ίδια εντολή/SSoT)
  | 'column-discrete-from-perimeter-walls'
  // ADR-363 Phase 5: BIM Beam drawing tool (straight/curved/cantilever)
  | 'beam'
  // ADR-363 «Δοκάρι από τοίχο» — 1-click pick wall → beam on its axis
  | 'beam-from-wall'
  // ADR-363 Phase 3.7: BIM Slab-Opening drawing tool (shaft/well/duct/chimney)
  | 'slab-opening'
  // ADR-417: BIM Roof drawing tool (footprint polygon + per-edge slopes)
  | 'roof'
  // ADR-419: BIM Floor Finish drawing tool (covering polygon, IfcCovering FLOORING)
  | 'floor-finish'
  // ADR-406: point-based MEP fixture drawing tool (light fixture first)
  | 'mep-fixture'
  // ADR-408 Φ3: point-based electrical panel drawing tool (circuit source)
  | 'electrical-panel'
  // ADR-408 Φ12: point-based plumbing manifold drawing tool (συλλέκτης, pipe-network source)
  | 'mep-manifold'
  // ADR-408 Εύρος Β: point-based heating radiator drawing tool (καλοριφέρ, hydronic terminal)
  | 'mep-radiator'
  // ADR-408 Εύρος Β #2: point-based heating boiler drawing tool (λέβητας, hydronic source)
  | 'mep-boiler'
  // ADR-408 Εύρος Β #3: area-based radiant floor heating loop drawing tool (ενδοδαπέδια)
  | 'mep-underfloor'
  // ADR-408 Φ14: drainage collector (φρεάτιο) — point-based manifold, N inlets + 1 outlet
  | 'mep-drainage-collector'
  // ADR-408 Φ14: floor drain (σιφώνι) — point-based mep-fixture kind, 1 sanitary-drainage outlet
  | 'mep-floor-drain'
  // ADR-408 Φ14: sanitary terminals (WC/washbasin/shower/bathtub/bidet) — point-based mep-fixture kinds, 1 sanitary-drainage outlet each
  | 'mep-wc'
  | 'mep-washbasin'
  | 'mep-shower'
  | 'mep-bathtub'
  | 'mep-bidet'
  // ADR-407: path-based railing drawing tool (2-click straight guardrail)
  | 'railing'
  // ADR-410: mesh-based CC0 furniture drawing tool (single-click placement)
  | 'furniture'
  // ADR-415: pure-vector 2D floorplan symbol drawing tool (single-click placement)
  | 'floorplan-symbol'
  // ADR-408 Φ8: linear MEP segment tools (duct/pipe, 2-click; one entity, two tools like Revit)
  | 'mep-duct'
  | 'mep-pipe'
  // ADR-408 Φ14: sanitary drainage pipe (mep-segment domain 'pipe' preset sanitary-drainage + slope)
  | 'mep-drain-pipe'
  // ADR-359 Phase 1: Auxiliary geometry tools (infinite/semi-infinite construction lines)
  | 'xline'             // Infinite line through basePoint in direction (AutoCAD XLINE)
  | 'ray'               // Semi-infinite line from basePoint in direction (AutoCAD RAY)
  // ADR-362 Phase D1: Enterprise Dimension System — Smart DIM + 4 manual overrides
  | 'dim-smart'           // AutoCAD 2016+ Smart DIM — detector auto-picks type from hover
  | 'dim-linear'          // Manual linear (horizontal/vertical/rotated)
  | 'dim-aligned'         // Manual aligned (parallel to measured segment)
  | 'dim-angular2L'       // Manual angular between 2 line picks
  | 'dim-angular3P'       // Manual angular from vertex + 2 rays
  // ADR-362 Phase D2: Radial family + Ordinate creation tools
  | 'dim-radius'          // AutoCAD DIMRADIUS — pick arc/circle + text position
  | 'dim-diameter'        // AutoCAD DIMDIAMETER — pick circle + text position (side2 auto-derived)
  | 'dim-arc-length'      // AutoCAD DIMARC — pick arc (start/end derived from arc angles)
  | 'dim-jogged-radius'   // AutoCAD DIMJOGGED — pick arc + arcPoint + jogPoint + jogVertex
  | 'dim-ordinate'        // AutoCAD DIMORDINATE — feature + leader endpoint (axis auto, datum {0,0})
  // ADR-362 Phase D3: Chained dim creation tools (parent = auto-last linear/aligned/chained)
  | 'dim-baseline'        // AutoCAD DIMBASELINE — share extOrigin1 with parent; offset += DIMDLI per ancestor
  | 'dim-continued'       // AutoCAD DIMCONTINUE — chain end-to-end on parent's dim line
  // ADR-362 Phase L2: Standalone center mark + centerline tools
  | 'dim-center-mark'     // AutoCAD CENTERMARK — click circle/arc → CenterMarkEntity
  | 'dim-centerline';     // AutoCAD CENTERLINE — 2-click on 2 circles/arcs → CenterLineEntity


export interface ToolDefinition {
  id: ToolType;
  icon: React.ComponentType<React.ComponentProps<'svg'>> | string;
  label: string;
  hotkey: string;
  /** 🎨 ENTERPRISE: Color class for icon (from HOVER_TEXT_EFFECTS) */
  colorClass?: string;
  dropdownOptions?: { id: ToolType; icon: React.ComponentType<React.ComponentProps<'svg'>> | string; label: string; hotkey?: string; group?: string; }[];
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
    /** ADR-040 Phase VII: optional — EnhancedDXFToolbar reads from ZoomStore directly */
    currentZoom?: number;
    commandCount?: number;
}

// MEASUREMENT TOOLS - Προσθήκη νέων εργαλείων
export type MeasurementTool =
  | 'measure-distance'
  | 'measure-distance-continuous'
  | 'measure-area'
  | 'auto-measure-area'
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
  'auto-measure-area': {
    id: 'auto-measure-area',
    name: 'Αυτόματο Εμβαδό',
    icon: 'ScanLine',
    shortcut: '',
    description: 'Κλικ εντός κλειστού πολυγώνου — αυτόματος υπολογισμός',
    requiredPoints: 1
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
  /** ADR-040 Phase VII: optional — reads from ZoomStore internally */
  currentZoom?: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string, saveContext?: DxfSaveContext, targetLevelId?: string) => void;
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

  /** ADR-241: Fullscreen state for toolbar icon toggle */
  isFullscreen?: boolean;

  /** Disable layering tool when overlay count >= property count for current floor */
  layeringDisabled?: boolean;
}
