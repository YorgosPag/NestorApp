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
  | 'special';    // Special keys (Escape, Delete...)

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
}

// ============================================================================
// 🎯 TOOL SHORTCUTS (Single Letter - No Modifier)
// Pattern: AutoCAD - Most used tools get single letters
// ============================================================================

export const DXF_TOOL_SHORTCUTS: Record<string, ShortcutDefinition> = {
  // Selection Tools
  select: {
    key: 'S',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.select',
    action: 'tool:select',
    category: 'tool',
    toolType: 'select',
  },
  pan: {
    key: 'P',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.pan',
    action: 'tool:pan',
    category: 'tool',
    toolType: 'pan',
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

  // Zoom Tools
  zoomWindow: {
    key: 'W',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.zoomWindow',
    action: 'tool:zoom-window',
    category: 'tool',
    toolType: 'zoom-window',
  },
  zoomExtents: {
    key: 'F',
    modifier: 'none',
    descriptionKey: 'shortcuts.tools.zoomExtents',
    action: 'action:fit-to-view',
    category: 'tool',
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
  fit: {
    key: 'F',
    modifier: 'none',
    descriptionKey: 'shortcuts.actions.fitToView',
    action: 'action:fit-to-view',
    category: 'action',
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

  // Clipboard
  copy: {
    key: 'C',
    modifier: 'ctrl',
    descriptionKey: 'shortcuts.actions.copy',
    action: 'action:copy-selected',
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
  // F12 - Dynamic Input (AutoCAD standard)
  dynamicInput: {
    key: 'F12',
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
  fitToView: {
    key: '1',
    modifier: 'shift',
    descriptionKey: 'shortcuts.zoom.fitToView',
    action: 'zoom:fit-to-view',
    category: 'zoom',
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
  V: { action: 'action:toggle-guides', descriptionKey: 'shortcuts.guides.toggleVisibility' },
} as const;

/** Leader key for guide chords */
export const GUIDE_CHORD_LEADER = 'G' as const;

/** Chord window timeout in ms (time to press second key after leader) */
export const GUIDE_CHORD_TIMEOUT_MS = 350 as const;

// ============================================================================
// 🔗 COMBINED SHORTCUTS MAP (All shortcuts in one place)
// ============================================================================

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
 * Check if a keyboard event matches a specific shortcut
 */
export const matchesShortcut = (
  event: KeyboardEvent,
  shortcutId: string
): boolean => {
  const shortcut = ALL_DXF_SHORTCUTS[shortcutId as keyof typeof ALL_DXF_SHORTCUTS];
  if (!shortcut) return false;

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
  if (shortcut.key === 'Escape' || shortcut.key === 'Delete' || shortcut.key === 'Backspace') {
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

  // Standard letter/number keys
  return eventKey === shortcutKey;
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
