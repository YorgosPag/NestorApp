// ============================================================================
// ⌨️ DXF VIEWER KEYBOARD SHORTCUTS - Enterprise Centralized System
// ============================================================================
//
// 🏢 ENTERPRISE: Single Source of Truth for ALL keyboard shortcuts
// Pattern: Autodesk AutoCAD / Bentley MicroStation / Blender
//
// Industry Reference:
// - AutoCAD: Single-letter shortcuts (L=Line, C=Circle, M=Move)
// - Blender: Modal shortcuts with consistent patterns
// - Figma: Ctrl+combinations for actions
//
// ============================================================================

import type { ToolType } from '../ui/toolbar/types';
import { DXF_TIMING } from './dxf-timing';

// ============================================================================
// 📋 TYPE DEFINITIONS
// ============================================================================

/**
 * Modifier keys for keyboard shortcuts
 */
export type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta' | 'ctrlShift' | 'ctrlAlt' | 'none';

/**
 * Shortcut category for organization
 */
export type ShortcutCategory =
  | 'tool'        // Tool activation (S, L, R, C...)
  | 'action'      // Actions (Ctrl+Z, Ctrl+S...)
  | 'snap'        // Snap controls (F9, F10, F11...)
  | 'zoom'        // Zoom controls (+, -, Shift+1...)
  | 'navigation'  // Navigation (Arrows, Pan...)
  | 'special'     // Special keys (Escape, Delete...)
  | 'view3d';     // 3D canonical view jumps (ADR-366 Phase 4.4 / A.6)

/**
 * ADR-366 Phase 4.4 / A.6.Q3 — applicability per viewport mode.
 *
 * - `universal`   → fires unchanged in both 2D and 3D (zoom, undo/redo, ESC, Ctrl+A...)
 * - `2D-only`     → fires in 2D; pressing in 3D auto-switches to 2D + toast (drawing tools)
 * - `3D-only`     → fires only in 3D; ignored in 2D (canonical views, orbit)
 * - `mode-aware`  → dispatches different behavior per mode (F = fit extents 2D vs frame selection 3D)
 *
 * Default when omitted: `universal` (backward-compatible for legacy entries).
 */
export type ShortcutMode = '2D-only' | '3D-only' | 'mode-aware' | 'universal';

/**
 * Single shortcut definition
 */
export interface ShortcutDefinition {
  /** The key code (e.g., 'S', 'F9', 'Delete') */
  key: string;
  /** Modifier key combination */
  modifier: ModifierKey;
  /** Human-readable description (i18n key) */
  descriptionKey: string;
  /** Action identifier */
  action: string;
  /** Category for organization */
  category: ShortcutCategory;
  /** Optional: Associated tool type */
  toolType?: ToolType;
  /** Display label for UI (computed from key + modifier) */
  displayLabel?: string;
  /** ADR-366 Phase 4.4: viewport applicability — defaults to 'universal' when omitted. */
  mode?: ShortcutMode;
}

// ============================================================================
// 🎯 TOOL SHORTCUTS (Single Letter - No Modifier)
// Pattern: AutoCAD - Most used tools get single letters
// ============================================================================

// ADR-366 Phase 4.4 / A.6.Q3 — `mode` field audit:
//
// Entries explicitly tagged below: `select`/`pan` (universal — navigation in both
// modes), and `fit`/`zoomExtents`/`fitToView`/`fitToViewHome` (mode-aware — split
// fit-extents 2D vs frame-selection 3D). All other DXF_TOOL_SHORTCUTS entries
// are drawing/measurement tools — left untagged so the shortcut-dispatcher
// auto-switches to 2D when pressed in 3D (default falls into 2D-only branch via
// `match2DOnlyDrawingTool`). When future work classifies the remaining ~40
// entries individually, tag them as `'2D-only'` for explicitness.
export const DXF_TOOL_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Selection Tools — universal: navigation primitives in both 2D and 3D
  select: {
    key: 'S',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.select',
    action: 'tool:select',
    category: 'tool',
    toolType: 'select',
    mode: 'universal',
  },
  pan: {
    key: 'P',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.pan',
    action: 'tool:pan',
    category: 'tool',
    toolType: 'pan',
    mode: 'universal',
  },

  // Drawing Tools
  line: {
    key: 'L',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.line',
    action: 'tool:line',
    category: 'tool',
    toolType: 'line',
  },
  rectangle: {
    key: 'R',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.rectangle',
    action: 'tool:rectangle',
    category: 'tool',
    toolType: 'rectangle',
  },
  circle: {
    key: 'C',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.circle',
    action: 'tool:circle',
    category: 'tool',
    toolType: 'circle',
  },
  polyline: {
    key: 'Y',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.polyline',
    action: 'tool:polyline',
    category: 'tool',
    toolType: 'polyline',
  },
  polygon: {
    key: 'N',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.polygon',
    action: 'tool:polygon',
    category: 'tool',
    toolType: 'polygon',
  },
  // ADR-507 S2 — Hatch (γραμμοσκίαση), AutoCAD HATCH = H.
  hatch: {
    key: 'H',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.hatch',
    action: 'tool:hatch',
    category: 'tool',
    toolType: 'hatch',
  },
  // 🏢 ENTERPRISE (2026-01-31): Arc drawing tool - ADR-059
  // Note: 'A' is taken by measureArea, using 'Q' (Quadrant of circle reference)
  arc: {
    key: 'Q',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.arc',
    action: 'tool:arc-3p',
    category: 'tool',
    toolType: 'arc-3p',
  },
  // ADR-358: Stair drawing tool — 2-char mnemonic 'ST' (industry: AutoCAD/ArchiCAD/Bricsys).
  // Phase 0: declared only. Multi-char sequence dispatcher lands Phase 5a (button is comingSoon meanwhile).
  stair: {
    key: 'ST',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.stair',
    action: 'tool:stair',
    category: 'tool',
    toolType: 'stair',
  },
  // ADR-363 Phase 1B / Phase 7B: Wall drawing tool — 'W' alone (BIM chord fallback).
  // Phase 7B: W is a BIM chord leader; W+1/2/3 → straight/curved/polyline variant.
  // Resolved via MultiCharKeySequence (useDxfToolbarShortcuts). matchesShortcut() not used.
  wall: {
    key: 'W',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wall',
    action: 'tool:wall',
    category: 'tool',
    toolType: 'wall',
  },
  // ADR-363 Phase 7B: wall variant chords — activate wall tool + set kind.
  // Dispatched via MultiCharKeySequence + EventBus 'bim:set-wall-kind'.
  // ADR-363 Phase A: wall category chords — activate wall tool + set category.
  // Dispatched via MultiCharKeySequence + EventBus 'bim:set-wall-category'.
  wallStraight: {
    key: 'W1',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallStraight',
    action: 'tool:wall:straight',
    category: 'tool',
    toolType: 'wall',
  },
  wallCurved: {
    key: 'W2',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallCurved',
    action: 'tool:wall:curved',
    category: 'tool',
    toolType: 'wall',
  },
  wallPolyline: {
    key: 'W3',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallPolyline',
    action: 'tool:wall:polyline',
    category: 'tool',
    toolType: 'wall',
  },
  // ADR-565 — NOTE: no separate "arc" chord. Following big-player practice
  // (Revit exposes ONE wall tool with a Draw gallery of shape modes, NOT a
  // hotkey per curve variant), the curved wall = circular arc is the single
  // `W2` (curved) entry; arc draw-variants belong in a contextual options bar.
  wallExterior: {
    key: 'WE',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallExterior',
    action: 'wall:category:exterior',
    category: 'tool',
    toolType: 'wall',
  },
  wallInterior: {
    key: 'WI',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallInterior',
    action: 'wall:category:interior',
    category: 'tool',
    toolType: 'wall',
  },
  wallParapet: {
    key: 'WP',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallParapet',
    action: 'wall:category:parapet',
    category: 'tool',
    toolType: 'wall',
  },
  wallFence: {
    key: 'WF',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallFence',
    action: 'wall:category:fence',
    category: 'tool',
    toolType: 'wall',
  },
  wallPartition: {
    key: 'WT',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.wallPartition',
    action: 'wall:category:partition',
    category: 'tool',
    toolType: 'wall',
  },
  // ADR-363 Phase 7: BIM 2-char hotkeys — resolved by MultiCharKeySequence dispatcher.
  // 'O' alone → layering (fallback); O+P → opening.
  opening: {
    key: 'OP',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.opening',
    action: 'tool:opening',
    category: 'tool',
    toolType: 'opening',
  },
  // ADR-363 Phase 7B: D key — sets opening kind to 'door' when opening tool is active.
  // Context-sensitive: D = door only while activeTool === 'opening'; otherwise D = measureDistance.
  // Dispatched via EventBus 'bim:set-opening-kind'. matchesShortcut() not used for this.
  openingDoor: {
    key: 'D',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.openingDoor',
    action: 'bim:set-opening-kind:door',
    category: 'tool',
    toolType: 'opening',
  },
  // 'S' alone → select (fallback); S+T → stair; S+L → slab.
  slab: {
    key: 'SL',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.slab',
    action: 'tool:slab',
    category: 'tool',
    toolType: 'slab',
  },
  // 'C' alone → circle (fallback); C+L → column.
  column: {
    key: 'CL',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.column',
    action: 'tool:column',
    category: 'tool',
    toolType: 'column',
  },
  // 'B' alone → no fallback; B+M → beam.
  beam: {
    key: 'BM',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.beam',
    action: 'tool:beam',
    category: 'tool',
    toolType: 'beam',
  },

  // Editing Tools
  move: {
    key: 'M',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.move',
    action: 'tool:move',
    category: 'tool',
    toolType: 'move',
  },
  // 🏢 ADR-188: Entity Rotation System
  // 'R' is taken by rectangle → Shift+R for rotate
  rotate: {
    key: 'R',
    modifier: 'shift',
    descriptionKey: 'shortcuts.tools.rotate',
    action: 'tool:rotate',
    category: 'tool',
    toolType: 'rotate',
  },
  gripEdit: {
    key: 'G',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.gripEdit',
    action: 'tool:grip-edit',
    category: 'tool',
    toolType: 'grip-edit',
  },

  // Measurement Tools
  measureDistance: {
    key: 'D',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.measureDistance',
    action: 'tool:measure-distance',
    category: 'tool',
    toolType: 'measure-distance',
  },
  measureArea: {
    key: 'A',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.measureArea',
    action: 'tool:measure-area',
    category: 'tool',
    toolType: 'measure-area',
  },
  measureAngle: {
    key: 'T',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.measureAngle',
    action: 'tool:measure-angle',
    category: 'tool',
    toolType: 'measure-angle',
  },

  // ADR-353: Extend tool (display-only — same pattern as trim/TR in ribbon)
  extend: {
    key: 'EX',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.extend',
    action: 'tool:extend',
    category: 'tool',
    toolType: 'extend',
  },

  // ADR-353 Phase A: Rectangular Array (display-only label, Phase A ships rect only)
  arrayRect: {
    key: 'AR',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.arrayRect',
    action: 'tool:array-rect',
    category: 'tool',
    toolType: 'array-rect',
  },

  // Zoom Tools
  zoomWindow: {
    key: 'W',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.zoomWindow',
    action: 'tool:zoom-window',
    category: 'tool',
    toolType: 'zoom-window',
  },
  // ADR-366 Phase 4.4 / A.6.Q4 — mode-aware F:
  //   2D → fit-extents (existing). 3D → selection-aware (frame selection if any,
  //   else fit-extents over BIM+DXF). Resolved by `bim-3d/shortcuts/shortcut-dispatcher.ts`.
  zoomExtents: {
    key: 'F',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.zoomExtents',
    action: 'action:fit-to-view',
    category: 'tool',
    mode: 'mode-aware',
  },

  // Layering Tool
  layering: {
    key: 'O',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.layering',
    action: 'tool:layering',
    category: 'tool',
    toolType: 'layering',
  },
} as const;

// ============================================================================
// ⌘ CTRL/CMD SHORTCUTS (Actions)
// Pattern: Industry standard - Ctrl+Z, Ctrl+S, Ctrl+C, etc.
// ============================================================================

export const DXF_ACTION_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // View Toggles (No Modifier)
  grid: {
    key: 'G',
    modifier: 'none',
    descriptionKey: 'shortcuts.actions.toggleGrid',
    action: 'action:grid',
    category: 'action',
  },
  autocrop: {
    key: 'A',
    modifier: 'none',
    descriptionKey: 'shortcuts.actions.toggleAutocrop',
    action: 'action:autocrop',
    category: 'action',
  },
  // ADR-366 Phase 4.4 / A.6.Q4 — mode-aware (mirror of zoomExtents tagging).
  fit: {
    key: 'F',
    modifier: 'none',
    descriptionKey: 'shortcuts.actions.fitToView',
    action: 'action:fit-to-view',
    category: 'action',
    mode: 'mode-aware',
  },
} as const;

export const DXF_CTRL_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // History
  undo: {
    key: 'Z',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.undo',
    action: 'action:undo',
    category: 'action',
  },
  redo: {
    key: 'Y',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.redo',
    action: 'action:redo',
    category: 'action',
  },
  redoAlt: {
    key: 'Z',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.actions.redo',
    action: 'action:redo',
    category: 'action',
  },

  // Clipboard (ADR-466 — Revit/AutoCAD COPYCLIP / PASTECLIP)
  copy: {
    key: 'C',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.copy',
    action: 'action:clipboard-copy',
    category: 'action',
  },
  paste: {
    key: 'V',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.paste',
    action: 'action:clipboard-paste',
    category: 'action',
  },
  selectAll: {
    key: 'A',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.selectAll',
    action: 'action:select-all',
    category: 'action',
  },

  // Panels
  toggleLayers: {
    key: 'L',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.toggleLayers',
    action: 'action:toggle-layers',
    category: 'action',
  },
  toggleProperties: {
    key: 'P',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.toggleProperties',
    action: 'action:toggle-properties',
    category: 'action',
  },

  // Export
  export: {
    key: 'E',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.export',
    action: 'action:export',
    category: 'action',
  },

  // Development
  runTests: {
    key: 'T',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.actions.runTests',
    action: 'action:run-tests',
    category: 'action',
  },
  togglePerf: {
    key: 'P',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.actions.togglePerf',
    action: 'action:toggle-perf',
    category: 'action',
  },
  togglePdfBackground: {
    key: 'P',
    modifier: 'ctrlAlt',
    descriptionKey: 'shortcuts.actions.togglePdfBackground',
    action: 'action:toggle-pdf-background',
    category: 'action',
  },
  toggleCursorSettings: {
    key: 'C',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.actions.toggleCursorSettings',
    action: 'action:toggle-cursor-settings',
    category: 'action',
  },
} as const;

// ============================================================================
// 🔧 FUNCTION KEY SHORTCUTS (Snap & System)
// Pattern: AutoCAD - F-keys for system toggles
// Reference: AutoCAD F1-F12 standard
// ============================================================================

export const DXF_FUNCTION_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // F7 - Grid Display toggle (AutoCAD standard)
  gridDisplay: {
    key: 'F7',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.gridDisplay',
    action: 'snap:grid-display',
    category: 'snap',
  },
  // F8 - Ortho Mode (AutoCAD standard)
  orthoMode: {
    key: 'F8',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.orthoMode',
    action: 'snap:ortho-mode',
    category: 'snap',
  },
  // F9 - Grid Snap toggle (AutoCAD standard)
  gridSnap: {
    key: 'F9',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.gridSnap',
    action: 'snap:grid-snap',
    category: 'snap',
  },
  // F10 - Polar Tracking (AutoCAD standard)
  polarTracking: {
    key: 'F10',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.polarTracking',
    action: 'snap:polar-tracking',
    category: 'snap',
  },
  // F11 - Object Snap (OSNAP) (AutoCAD standard)
  objectSnap: {
    key: 'F11',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.objectSnap',
    action: 'snap:object-snap',
    category: 'snap',
  },
  // Dynamic Input — F12 omitted: browser-reserved (DevTools). AutoCAD web pattern: status-bar toggle only.
  dynamicInput: {
    key: '',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.dynamicInput',
    action: 'snap:dynamic-input',
    category: 'snap',
  },
  // Legacy aliases for backward compatibility
  toggleGrid: {
    key: 'F9',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.gridSnap',
    action: 'snap:grid-snap',
    category: 'snap',
  },
  toggleOrtho: {
    key: 'F10',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.polarTracking',
    action: 'snap:polar-tracking',
    category: 'snap',
  },
  toggleAutoSnap: {
    key: 'F11',
    modifier: 'none',
    descriptionKey: 'shortcuts.snap.objectSnap',
    action: 'snap:object-snap',
    category: 'snap',
  },
} as const;

// ============================================================================
// 🔍 ZOOM SHORTCUTS
// Pattern: Blender/Figma - Numeric shortcuts for zoom levels
// ============================================================================

export const DXF_ZOOM_SHORTCUTS: Record<string, ShortcutDefinition> = {
  zoomIn: {
    key: '+',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.zoomIn',
    action: 'zoom:in',
    category: 'zoom',
  },
  zoomInNumpad: {
    key: 'NumpadAdd',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.zoomIn',
    action: 'zoom:in',
    category: 'zoom',
  },
  zoomOut: {
    key: '-',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.zoomOut',
    action: 'zoom:out',
    category: 'zoom',
  },
  zoomOutNumpad: {
    key: 'NumpadSubtract',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.zoomOut',
    action: 'zoom:out',
    category: 'zoom',
  },
  // ADR-366 Phase 4.4 / A.6.Q4 — mode-aware Shift+1 and Home.
  fitToView: {
    key: '1',
    modifier: 'shift',
    descriptionKey: 'shortcuts.zoom.fitToView',
    action: 'zoom:fit-to-view',
    category: 'zoom',
    mode: 'mode-aware',
  },
  fitToViewHome: {
    key: 'Home',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.fitToView',
    action: 'zoom:fit-to-view',
    category: 'zoom',
    mode: 'mode-aware',
  },
  // ADR-394 — Fit to View to the current selection (DXF + BIM). Mirrors Home
  // (fit-all). Single key 'Z' (AutoCAD ZOOM alias). When no entity is selected,
  // useKeyboardShortcuts lets the keystroke fall through to the command-line
  // activation, preserving the AutoCAD-style 'Z' ZOOM command entry point.
  fitToViewSelected: {
    key: 'Z',
    modifier: 'none',
    descriptionKey: 'shortcuts.zoom.fitToViewSelected',
    action: 'zoom:fit-to-view-selected',
    category: 'zoom',
    mode: 'mode-aware',
  },
  zoom100: {
    key: '0',
    modifier: 'shift',
    descriptionKey: 'shortcuts.zoom.zoom100',
    action: 'zoom:100',
    category: 'zoom',
  },
} as const;

// ============================================================================
// ➡️ NAVIGATION SHORTCUTS (Arrows for Nudging)
// ============================================================================

export const DXF_NAVIGATION_SHORTCUTS: Record<string, ShortcutDefinition> = {
  nudgeUp: {
    key: 'ArrowUp',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.nudgeUp',
    action: 'navigate:nudge-up',
    category: 'navigation',
  },
  nudgeDown: {
    key: 'ArrowDown',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.nudgeDown',
    action: 'navigate:nudge-down',
    category: 'navigation',
  },
  nudgeLeft: {
    key: 'ArrowLeft',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.nudgeLeft',
    action: 'navigate:nudge-left',
    category: 'navigation',
  },
  nudgeRight: {
    key: 'ArrowRight',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.nudgeRight',
    action: 'navigate:nudge-right',
    category: 'navigation',
  },
  // Shift + Arrow = larger nudge (3x)
  nudgeUpLarge: {
    key: 'ArrowUp',
    modifier: 'shift',
    descriptionKey: 'shortcuts.navigation.nudgeUpLarge',
    action: 'navigate:nudge-up-large',
    category: 'navigation',
  },
  nudgeDownLarge: {
    key: 'ArrowDown',
    modifier: 'shift',
    descriptionKey: 'shortcuts.navigation.nudgeDownLarge',
    action: 'navigate:nudge-down-large',
    category: 'navigation',
  },
  nudgeLeftLarge: {
    key: 'ArrowLeft',
    modifier: 'shift',
    descriptionKey: 'shortcuts.navigation.nudgeLeftLarge',
    action: 'navigate:nudge-left-large',
    category: 'navigation',
  },
  nudgeRightLarge: {
    key: 'ArrowRight',
    modifier: 'shift',
    descriptionKey: 'shortcuts.navigation.nudgeRightLarge',
    action: 'navigate:nudge-right-large',
    category: 'navigation',
  },
  cycleSnap: {
    key: 'Tab',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.cycleSnap',
    action: 'navigate:cycle-snap',
    category: 'navigation',
  },
  // Z-order: PageUp = bring to front, PageDown = send to back (AutoCAD/BricsCAD parity)
  bringToFront: {
    key: 'PageUp',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.bringToFront',
    action: 'navigate:bring-to-front',
    category: 'navigation',
  },
  sendToBack: {
    key: 'PageDown',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.sendToBack',
    action: 'navigate:send-to-back',
    category: 'navigation',
  },
  // Canvas pan — same arrow keys as nudge but active when NO entity is selected.
  // Priority: nudge (selection exists) > pan (no selection). AutoCAD parity.
  panUp: {
    key: 'ArrowUp',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.panUp',
    action: 'navigate:pan-up',
    category: 'navigation',
  },
  panDown: {
    key: 'ArrowDown',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.panDown',
    action: 'navigate:pan-down',
    category: 'navigation',
  },
  panLeft: {
    key: 'ArrowLeft',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.panLeft',
    action: 'navigate:pan-left',
    category: 'navigation',
  },
  panRight: {
    key: 'ArrowRight',
    modifier: 'none',
    descriptionKey: 'shortcuts.navigation.panRight',
    action: 'navigate:pan-right',
    category: 'navigation',
  },
} as const;

// ============================================================================
// 🎨 OVERLAY TOOLBAR SHORTCUTS (Drawing/Editing Overlays)
// Pattern: Mode-specific shortcuts for overlay creation and editing
// ============================================================================

export const DXF_OVERLAY_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Mode Shortcuts
  overlayDraw: {
    key: 'N',
    modifier: 'none',
    descriptionKey: 'shortcuts.overlay.draw',
    action: 'overlay:draw-mode',
    category: 'tool',
  },
  overlayEdit: {
    key: 'E',
    modifier: 'none',
    descriptionKey: 'shortcuts.overlay.edit',
    action: 'overlay:edit-mode',
    category: 'tool',
  },
  overlaySelect: {
    key: 'V',
    modifier: 'none',
    descriptionKey: 'shortcuts.overlay.select',
    action: 'overlay:select-mode',
    category: 'tool',
  },
  // Action Shortcuts (Overlay-specific)
  overlayDuplicate: {
    key: 'D',
    modifier: 'none',
    descriptionKey: 'shortcuts.overlay.duplicate',
    action: 'overlay:duplicate',
    category: 'action',
  },
} as const;

// ============================================================================
// ⚡ SPECIAL SHORTCUTS (Escape, Delete, etc.)
// ============================================================================

export const DXF_SPECIAL_SHORTCUTS: Record<string, ShortcutDefinition> = {
  escape: {
    key: 'Escape',
    modifier: 'none',
    descriptionKey: 'shortcuts.special.escape',
    action: 'special:cancel',
    category: 'special',
  },
  delete: {
    key: 'Delete',
    modifier: 'none',
    descriptionKey: 'shortcuts.special.delete',
    action: 'special:delete-selected',
    category: 'special',
  },
  backspace: {
    key: 'Backspace',
    modifier: 'none',
    descriptionKey: 'shortcuts.special.delete',
    action: 'special:delete-selected',
    category: 'special',
  },
  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction during arc drawing
  // Pattern: AutoCAD X command for direction toggle
  flipArc: {
    key: 'X',
    modifier: 'none',
    descriptionKey: 'shortcuts.special.flipArc',
    action: 'special:flip-arc',
    category: 'special',
  },
} as const;

// ============================================================================
// 🐛 DEBUG SHORTCUTS (Development & Testing)
// Pattern: Ctrl+F-keys and Ctrl+Shift combinations for debug tools
// ============================================================================

export const DXF_DEBUG_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Ctrl+F2 - Layering Workflow Test
  debugLayeringTest: {
    key: 'F2',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.debug.layeringTest',
    action: 'debug:layering-workflow-test',
    category: 'special',
  },
  // Ctrl+Shift+T - Layering Workflow Test (alternative)
  debugLayeringTestAlt: {
    key: 'T',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.debug.layeringTest',
    action: 'debug:layering-workflow-test',
    category: 'special',
  },
  // F3 - Cursor-Crosshair Alignment Test
  debugCursorTest: {
    key: 'F3',
    modifier: 'none',
    descriptionKey: 'shortcuts.debug.cursorTest',
    action: 'debug:cursor-crosshair-test',
    category: 'special',
  },
  // Ctrl+Shift+L - Layout Mapper (debug tool)
  debugLayoutMapper: {
    key: 'L',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.debug.layoutMapper',
    action: 'debug:layout-mapper',
    category: 'special',
  },
} as const;

// ============================================================================
// 📐 GUIDE SHORTCUTS (ADR-189: Construction Grid & Guide System)
// Pattern: Chord shortcuts — press G (leader), then second key within 350ms
// Reference: AutoCAD custom aliases, Vim leader-key pattern
// ============================================================================

/**
 * Guide chord shortcuts — not matched via `matchesShortcut()` because they
 * are two-key sequences (G → X). Instead, the chord resolution logic in
 * EnhancedDXFToolbar reads this map to resolve the second key.
 *
 * Leader key: G (shared with grip-edit — 350ms chord window)
 */
export const DXF_GUIDE_CHORD_MAP: Record<string, { action: string; toolType?: ToolType; descriptionKey: string }> = {
  X: { action: 'tool:guide-x', toolType: 'guide-x' as ToolType, descriptionKey: 'shortcuts.guides.guideX' },
  Z: { action: 'tool:guide-z', toolType: 'guide-z' as ToolType, descriptionKey: 'shortcuts.guides.guideZ' },
  K: { action: 'tool:guide-xz', toolType: 'guide-xz' as ToolType, descriptionKey: 'shortcuts.guides.guideXZ' },
  P: { action: 'tool:guide-parallel', toolType: 'guide-parallel' as ToolType, descriptionKey: 'shortcuts.guides.guideParallel' },
  N: { action: 'tool:guide-perpendicular', toolType: 'guide-perpendicular' as ToolType, descriptionKey: 'shortcuts.guides.guidePerpendicular' },
  S: { action: 'tool:guide-segments', toolType: 'guide-segments' as ToolType, descriptionKey: 'shortcuts.guides.guideSegments' },
  A: { action: 'tool:guide-distance', toolType: 'guide-distance' as ToolType, descriptionKey: 'shortcuts.guides.guideDistance' },
  Q: { action: 'tool:guide-add-point', toolType: 'guide-add-point' as ToolType, descriptionKey: 'shortcuts.guides.guideAddPoint' },
  W: { action: 'tool:guide-delete-point', toolType: 'guide-delete-point' as ToolType, descriptionKey: 'shortcuts.guides.guideDeletePoint' },
  D: { action: 'tool:guide-delete', toolType: 'guide-delete' as ToolType, descriptionKey: 'shortcuts.guides.guideDelete' },
  T: { action: 'tool:guide-arc-segments', toolType: 'guide-arc-segments' as ToolType, descriptionKey: 'shortcuts.guides.guideArcSegments' },
  U: { action: 'tool:guide-arc-distance', toolType: 'guide-arc-distance' as ToolType, descriptionKey: 'shortcuts.guides.guideArcDistance' },
  I: { action: 'tool:guide-arc-line-intersect', toolType: 'guide-arc-line-intersect' as ToolType, descriptionKey: 'shortcuts.guides.guideArcLineIntersect' },
  O: { action: 'tool:guide-circle-intersect', toolType: 'guide-circle-intersect' as ToolType, descriptionKey: 'shortcuts.guides.guideCircleIntersect' },
  M: { action: 'tool:guide-move', toolType: 'guide-move' as ToolType, descriptionKey: 'shortcuts.guides.guideMove' },
  R: { action: 'tool:guide-rect-center', toolType: 'guide-rect-center' as ToolType, descriptionKey: 'shortcuts.guides.guideRectCenter' },
  E: { action: 'tool:guide-line-midpoint', toolType: 'guide-line-midpoint' as ToolType, descriptionKey: 'shortcuts.guides.guideLineMidpoint' },
  C: { action: 'tool:guide-circle-center', toolType: 'guide-circle-center' as ToolType, descriptionKey: 'shortcuts.guides.guideCircleCenter' },
  B: { action: 'tool:guide-grid', toolType: 'guide-grid' as ToolType, descriptionKey: 'shortcuts.guides.guideGrid' },
  H: { action: 'tool:guide-rotate', toolType: 'guide-rotate' as ToolType, descriptionKey: 'shortcuts.guides.guideRotate' },
  J: { action: 'tool:guide-rotate-all', toolType: 'guide-rotate-all' as ToolType, descriptionKey: 'shortcuts.guides.guideRotateAll' },
  F: { action: 'tool:guide-rotate-group', toolType: 'guide-rotate-group' as ToolType, descriptionKey: 'shortcuts.guides.guideRotateGroup' },
  Y: { action: 'tool:guide-equalize', toolType: 'guide-equalize' as ToolType, descriptionKey: 'shortcuts.guides.guideEqualize' },
  '2': { action: 'tool:guide-polar-array', toolType: 'guide-polar-array' as ToolType, descriptionKey: 'shortcuts.guides.guidePolarArray' },
  '3': { action: 'tool:guide-scale', toolType: 'guide-scale' as ToolType, descriptionKey: 'shortcuts.guides.guideScale' },
  '4': { action: 'tool:guide-angle', toolType: 'guide-angle' as ToolType, descriptionKey: 'shortcuts.guides.guideAngle' },
  '5': { action: 'tool:guide-mirror', toolType: 'guide-mirror' as ToolType, descriptionKey: 'shortcuts.guides.guideMirror' },
  '6': { action: 'tool:guide-select', toolType: 'guide-select' as ToolType, descriptionKey: 'shortcuts.guides.guideSelect' },
  '7': { action: 'tool:guide-copy-pattern', toolType: 'guide-copy-pattern' as ToolType, descriptionKey: 'shortcuts.guides.guideCopyPattern' },
  '8': { action: 'tool:guide-from-entity', toolType: 'guide-from-entity' as ToolType, descriptionKey: 'shortcuts.guides.guideFromEntity' },
  '9': { action: 'tool:guide-offset-entity', toolType: 'guide-offset-entity' as ToolType, descriptionKey: 'shortcuts.guides.guideOffsetEntity' },
  '1': { action: 'tool:guide-preset-grid', toolType: 'guide-preset-grid' as ToolType, descriptionKey: 'shortcuts.guides.guidePresetGrid' },
  '0': { action: 'tool:guide-from-selection', toolType: 'guide-from-selection' as ToolType, descriptionKey: 'shortcuts.guides.guideFromSelection' },
  V: { action: 'action:toggle-guides', descriptionKey: 'shortcuts.guides.toggleVisibility' },
  L: { action: 'action:toggle-guide-panel', descriptionKey: 'shortcuts.guides.guidePanel' },
} as const;

/** Leader key for guide chords */
export const GUIDE_CHORD_LEADER = 'G' as const;

/** Chord window timeout in ms (time to press second key after leader) */
export const GUIDE_CHORD_TIMEOUT_MS = DXF_TIMING.gesture.CHORD_TIMEOUT; // ADR-516

// ============================================================================
// 🔗 COMBINED SHORTCUTS MAP (All shortcuts in one place)
// ============================================================================

// ============================================================================
// 🪜 LAYER ISOLATE SHORTCUTS (ADR-358 §5.6.bis — Phase 10)
// ============================================================================

export const DXF_LAYER_SHORTCUTS: Record<string, ShortcutDefinition> = {
  layerIsolate: {
    key: 'I',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.layer.isolate',
    action: 'layer:isolate',
    category: 'action',
  },
  layerIsolateInverse: {
    key: 'I',
    modifier: 'ctrlAlt',
    descriptionKey: 'shortcuts.layer.isolateInverse',
    action: 'layer:isolate-inverse',
    category: 'action',
  },
  layerUnisolate: {
    key: 'U',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.layer.unisolate',
    action: 'layer:unisolate',
    category: 'action',
  },
  layerThawAll: {
    key: 'T',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.layer.thawAll',
    action: 'layer:thaw-all',
    category: 'action',
  },
  layerOnAll: {
    key: 'O',
    modifier: 'ctrlShift',
    descriptionKey: 'shortcuts.layer.onAll',
    action: 'layer:on-all',
    category: 'action',
  },
} as const;

export const ALL_DXF_SHORTCUTS = {
  ...DXF_TOOL_SHORTCUTS,
  ...DXF_ACTION_SHORTCUTS,
  ...DXF_CTRL_SHORTCUTS,
  ...DXF_FUNCTION_SHORTCUTS,
  ...DXF_ZOOM_SHORTCUTS,
  ...DXF_NAVIGATION_SHORTCUTS,
  ...DXF_OVERLAY_SHORTCUTS,
  ...DXF_SPECIAL_SHORTCUTS,
  ...DXF_DEBUG_SHORTCUTS,
  ...DXF_LAYER_SHORTCUTS,
} as const;

// ============================================================================
// 🔧 HELPER FUNCTIONS
// ============================================================================

/**
 * Get display label for a shortcut (e.g., "Ctrl+Z", "Shift+1", "S")
 */
export const getShortcutDisplayLabel = (shortcutId: string): string => {
  const shortcut = ALL_DXF_SHORTCUTS[shortcutId as keyof typeof ALL_DXF_SHORTCUTS];
  if (!shortcut) return '';

  const modifierLabels: Record<ModifierKey, string> = {
    ctrl: 'Ctrl+',
    shift: 'Shift+',
    alt: 'Alt+',
    meta: 'Cmd+',
    ctrlShift: 'Ctrl+Shift+',
    ctrlAlt: 'Ctrl+Alt+',
    none: '',
  };

  return `${modifierLabels[shortcut.modifier]}${shortcut.key}`;
};

/**
 * Get the hotkey string for toolDefinitions (backward compatibility)
 */
export const getToolHotkey = (toolType: ToolType): string => {
  const toolShortcut = Object.values(DXF_TOOL_SHORTCUTS).find(
    (s) => s.toolType === toolType
  );
  if (toolShortcut) {
    return getShortcutDisplayLabel(
      Object.keys(DXF_TOOL_SHORTCUTS).find(
        (key) => DXF_TOOL_SHORTCUTS[key as keyof typeof DXF_TOOL_SHORTCUTS] === toolShortcut
      ) ?? ''
    );
  }
  return '';
};

/**
 * Check if a keyboard event matches a `ShortcutDefinition` object directly.
 *
 * Reusable core matcher — ADR-366 Phase 4.4 extracted from `matchesShortcut(event, id)`
 * so the 3D shortcuts SSoT (`bim-3d/shortcuts/keyboard-shortcuts-3d.ts`) can reuse it
 * without forcing every 3D entry into `ALL_DXF_SHORTCUTS`.
 */
export const matchesShortcutDef = (
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
): boolean => {
  // Check modifier
  const modifierMatch = (() => {
    switch (shortcut.modifier) {
      case 'ctrl':
        return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
      case 'shift':
        return event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
      case 'alt':
        return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      case 'meta':
        return event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
      case 'ctrlShift':
        return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey;
      case 'ctrlAlt':
        return (event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey;
      case 'none':
        return !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
      default:
        return false;
    }
  })();

  if (!modifierMatch) return false;

  // Check key
  const eventKey = event.key.toUpperCase();
  const shortcutKey = shortcut.key.toUpperCase();

  // Handle special keys
  if (shortcut.key.startsWith('F') && shortcut.key.length > 1) {
    return event.key === shortcut.key;
  }
  if (shortcut.key === 'Escape' || shortcut.key === 'Delete' || shortcut.key === 'Backspace' || shortcut.key === 'Home' || shortcut.key === 'End' || shortcut.key === 'PageUp' || shortcut.key === 'PageDown') {
    return event.key === shortcut.key;
  }
  if (shortcut.key.startsWith('Arrow')) {
    return event.key === shortcut.key;
  }
  if (shortcut.key === 'Tab') {
    return event.key === 'Tab';
  }
  if (shortcut.key === '+' || shortcut.key === '-') {
    return event.key === shortcut.key || event.key === '=' || event.code === `Numpad${shortcut.key === '+' ? 'Add' : 'Subtract'}`;
  }
  if (shortcut.key.startsWith('Numpad')) {
    return event.code === shortcut.key;
  }

  // Standard letter/number keys.
  // Layout-independent fallback: when a non-Latin keyboard layout is active
  // (e.g. Greek), pressing the physical Z key yields event.key='ζ' → 'Ζ'
  // (U+0396), which never equals the Latin 'Z' (U+005A). event.code reports the
  // physical key position ('KeyZ') regardless of layout, so single Latin
  // letter shortcuts keep working in any language. (AutoCAD-style behavior.)
  if (eventKey === shortcutKey) return true;
  if (/^[A-Z]$/.test(shortcutKey) && event.code === `Key${shortcutKey}`) {
    return true;
  }
  return false;
};

/**
 * Check if a keyboard event matches a registered 2D shortcut by ID.
 */
export const matchesShortcut = (
  event: KeyboardEvent,
  shortcutId: string,
): boolean => {
  const shortcut = ALL_DXF_SHORTCUTS[shortcutId as keyof typeof ALL_DXF_SHORTCUTS];
  if (!shortcut) return false;
  return matchesShortcutDef(event, shortcut);
};

/**
 * Find shortcut by action
 */
export const findShortcutByAction = (action: string): ShortcutDefinition | undefined => {
  return Object.values(ALL_DXF_SHORTCUTS).find((s) => s.action === action);
};

/**
 * Get all shortcuts for a category
 */
export const getShortcutsByCategory = (category: ShortcutCategory): ShortcutDefinition[] => {
  return Object.values(ALL_DXF_SHORTCUTS).filter((s) => s.category === category);
};

// ============================================================================
// 📋 TYPE EXPORTS
// ============================================================================

export type ShortcutId = keyof typeof ALL_DXF_SHORTCUTS;
export type ToolShortcutId = keyof typeof DXF_TOOL_SHORTCUTS;
export type ActionShortcutId = keyof typeof DXF_ACTION_SHORTCUTS;
export type CtrlShortcutId = keyof typeof DXF_CTRL_SHORTCUTS;
export type FunctionShortcutId = keyof typeof DXF_FUNCTION_SHORTCUTS;
export type ZoomShortcutId = keyof typeof DXF_ZOOM_SHORTCUTS;
export type NavigationShortcutId = keyof typeof DXF_NAVIGATION_SHORTCUTS;
export type OverlayShortcutId = keyof typeof DXF_OVERLAY_SHORTCUTS;
export type SpecialShortcutId = keyof typeof DXF_SPECIAL_SHORTCUTS;
