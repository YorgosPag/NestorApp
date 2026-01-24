// ============================================================================
// 🎨 DXF VIEWER TOOLBAR COLORS - Enterprise Centralized System
// ============================================================================
//
// 🏢 ENTERPRISE: Follows the same pattern as CompactToolbar/icon-colors.ts
// Single source of truth for all DXF Viewer toolbar icon colors
//
// Pattern: Autodesk/Bentley - Each module has its own tool colors config
// that follows the enterprise-wide design system (HOVER_TEXT_EFFECTS)
//
// ============================================================================

import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

/**
 * 🎨 DXF Tool Group Colors
 * Maps tool groups to their semantic colors
 * Based on CAD industry standards (Autodesk AutoCAD, Bentley MicroStation)
 */
export const DXF_TOOL_GROUP_COLORS = {
  /** Selection tools - neutral slate for non-destructive operations */
  SELECTION: HOVER_TEXT_EFFECTS.SLATE,

  /** Drawing tools - cyan for creation/construction */
  DRAWING: HOVER_TEXT_EFFECTS.CYAN,

  /** Editing tools - violet for modification operations */
  TOOLS: HOVER_TEXT_EFFECTS.VIOLET,

  /** Measurement tools - amber for analysis/information */
  MEASUREMENTS: HOVER_TEXT_EFFECTS.AMBER,

  /** Zoom/Navigation tools - emerald for view control */
  ZOOM: HOVER_TEXT_EFFECTS.EMERALD,
} as const;

/**
 * 🎨 DXF Action Button Colors
 * Individual action button colors (following CompactToolbar pattern)
 */
export const DXF_ACTION_COLORS = {
  // History actions
  undo: HOVER_TEXT_EFFECTS.INDIGO,
  redo: HOVER_TEXT_EFFECTS.INDIGO,

  // View controls
  cursorSettings: HOVER_TEXT_EFFECTS.SLATE,
  grid: HOVER_TEXT_EFFECTS.GREEN,
  autocrop: HOVER_TEXT_EFFECTS.TEAL,
  fit: HOVER_TEXT_EFFECTS.BLUE,

  // Export/Import
  export: HOVER_TEXT_EFFECTS.EMERALD,
  import: HOVER_TEXT_EFFECTS.SKY,
  importEnhanced: HOVER_TEXT_EFFECTS.TEAL,

  // Development tools
  tests: HOVER_TEXT_EFFECTS.PURPLE,
  togglePerf: HOVER_TEXT_EFFECTS.ORANGE,

  // Background controls
  pdfBackground: HOVER_TEXT_EFFECTS.PINK,
} as const;

/**
 * 🎨 Tool-specific color overrides
 * For tools that need different colors than their group
 */
export const DXF_TOOL_OVERRIDES: Record<string, string> = {
  // Delete is always RED (danger action) - regardless of group
  'delete': HOVER_TEXT_EFFECTS.RED,
};

/**
 * 🔧 Get color for a DXF tool
 * Automatically assigns color based on group, with override support
 *
 * @param groupName - The tool group name (from DXF_TOOL_GROUP_KEYS)
 * @param toolId - Optional specific tool ID for overrides
 * @returns The appropriate color class string
 *
 * @example
 * getDxfToolColor('DRAWING') // Returns CYAN
 * getDxfToolColor('TOOLS', 'delete') // Returns RED (override)
 */
export const getDxfToolColor = (
  groupName: keyof typeof DXF_TOOL_GROUP_COLORS,
  toolId?: string
): string => {
  // Check for tool-specific override first
  if (toolId && DXF_TOOL_OVERRIDES[toolId]) {
    return DXF_TOOL_OVERRIDES[toolId];
  }

  // Return group color or empty string if not found
  return DXF_TOOL_GROUP_COLORS[groupName] ?? '';
};

/**
 * 🔧 Get color for a DXF action button
 *
 * @param actionId - The action button ID
 * @returns The appropriate color class string
 *
 * @example
 * getDxfActionColor('undo') // Returns INDIGO
 * getDxfActionColor('export') // Returns EMERALD
 */
export const getDxfActionColor = (
  actionId: keyof typeof DXF_ACTION_COLORS
): string => {
  return DXF_ACTION_COLORS[actionId] ?? '';
};

/**
 * 🎨 Type exports for TypeScript support
 */
export type DxfToolGroup = keyof typeof DXF_TOOL_GROUP_COLORS;
export type DxfActionId = keyof typeof DXF_ACTION_COLORS;
