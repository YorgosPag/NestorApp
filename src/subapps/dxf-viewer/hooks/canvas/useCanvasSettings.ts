'use client';

/**
 * 🏢 ENTERPRISE: useCanvasSettings Hook
 *
 * @description Centralized settings construction for Canvas V2 components
 * @see ADR-XXX: CanvasSection Decomposition
 *
 * Responsibilities:
 * - Convert context settings to Canvas V2 format
 * - Build crosshairSettings from CursorSystem
 * - Build gridSettings from RulersGridSystem
 * - Build rulerSettings from RulersGridSystem
 * - Build snapSettings (static)
 * - Build selectionSettings from CursorSystem
 *
 * Pattern: Single Responsibility Principle - Pure Computation (no side effects)
 * Extracted from: CanvasSection.tsx (2,463 lines → ~800 lines target)
 */

import { useMemo } from 'react';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import type { GridSettings, RulerSettings, SnapSettings, SelectionSettings } from '../../canvas-v2';
import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Grid context settings from RulersGridSystem
 * This is a partial type for the settings we need
 */
export interface GridContextSettings {
  visual?: {
    enabled?: boolean;
    step?: number;
    color?: string;
    majorGridColor?: string;
    minorGridColor?: string;
    opacity?: number;
    majorGridWeight?: number;
    minorGridWeight?: number;
    style?: 'lines' | 'dots' | 'crosses';
    subDivisions?: number;
  };
}

/**
 * Ruler context settings from RulersGridSystem
 * This is a partial type for the settings we need
 */
export interface RulerContextSettings {
  units?: string;
  horizontal?: {
    enabled?: boolean;
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
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
    height?: number;
    position?: string;
    unitsFontSize?: number;
    unitsColor?: string;
  };
  vertical?: {
    enabled?: boolean;
    width?: number;
  };
}

/**
 * Props για useCanvasSettings hook
 */
export interface UseCanvasSettingsProps {
  /** Cursor settings from CursorSystem */
  cursorSettings: CursorSettings;
  /** Grid context settings from RulersGridSystem */
  gridContextSettings: GridContextSettings | null;
  /** Ruler context settings from RulersGridSystem */
  rulerContextSettings: RulerContextSettings | null;
  /** Show grid from toolbar/props */
  showGrid?: boolean;
}

/**
 * Return type of useCanvasSettings hook
 */
export interface UseCanvasSettingsReturn {
  /** Crosshair settings for CrosshairOverlay */
  crosshairSettings: CrosshairSettings;
  /** Cursor settings for LayerCanvas */
  cursorCanvasSettings: CursorSettings;
  /** Snap settings for snapping system */
  snapSettings: SnapSettings;
  /** Ruler settings for rulers */
  rulerSettings: RulerSettings;
  /** Grid settings for grid overlay */
  gridSettings: GridSettings;
  /** Selection settings for selection boxes */
  selectionSettings: SelectionSettings;
  /** Grid major interval for ruler tick calculations */
  gridMajorInterval: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized settings construction hook
 *
 * This hook converts settings from various context sources (CursorSystem, RulersGridSystem)
 * into the formats expected by Canvas V2 components. All computations are memoized
 * for performance.
 *
 * @example
 * ```tsx
 * const {
 *   crosshairSettings,
 *   gridSettings,
 *   rulerSettings,
 *   snapSettings,
 *   selectionSettings,
 * } = useCanvasSettings({
 *   cursorSettings,
 *   gridContextSettings,
 *   rulerContextSettings,
 *   showGrid,
 * });
 * ```
 */
export function useCanvasSettings(props: UseCanvasSettingsProps): UseCanvasSettingsReturn {
  const {
    cursorSettings,
    gridContextSettings,
    rulerContextSettings,
    showGrid,
  } = props;

  // ============================================================================
  // CROSSHAIR SETTINGS
  // ============================================================================

  /**
   * 🔺 CURSOR SYSTEM INTEGRATION - Convert to CrosshairOverlay format
   */
  const crosshairSettings: CrosshairSettings = useMemo(() => ({
    enabled: cursorSettings.crosshair.enabled,
    visible: cursorSettings.crosshair.enabled, // visible follows enabled state
    color: cursorSettings.crosshair.color,
    size: cursorSettings.crosshair.size_percent,
    opacity: cursorSettings.crosshair.opacity,
    style: cursorSettings.crosshair.line_style,
    // Extended properties from CursorSystem
    lineWidth: cursorSettings.crosshair.line_width,
    useCursorGap: cursorSettings.crosshair.use_cursor_gap,
    centerGapPx: cursorSettings.crosshair.center_gap_px,
    showCenterDot: true,  // Default: show center dot
    centerDotSize: 2      // Default: 2px center dot
  }), [cursorSettings.crosshair]);

  // ============================================================================
  // CURSOR CANVAS SETTINGS
  // ============================================================================

  /**
   * 🔺 CURSOR SETTINGS INTEGRATION - Pass complete cursor settings to LayerCanvas
   * LayerCanvas expects the full CursorSettings object from systems/cursor/config.ts
   */
  const cursorCanvasSettings: CursorSettings = cursorSettings;

  // ============================================================================
  // SNAP SETTINGS
  // ============================================================================

  /**
   * Snap settings - static configuration
   */
  const snapSettings: SnapSettings = useMemo(() => ({
    enabled: true,
    types: ['endpoint', 'midpoint', 'center'],
    tolerance: 10
  }), []);

  // ============================================================================
  // RULER SETTINGS
  // ============================================================================

  /**
   * Convert RulersGridSystem settings to Canvas V2 RulerSettings format
   */
  const rulerSettings: RulerSettings = useMemo(() => ({
    enabled: true, // ✅ FORCE ENABLE RULERS
    unit: (rulerContextSettings?.units as 'mm' | 'cm' | 'm') ?? 'mm',
    color: rulerContextSettings?.horizontal?.color ?? UI_COLORS.WHITE,
    backgroundColor: rulerContextSettings?.horizontal?.backgroundColor ?? UI_COLORS.DARK_BACKGROUND,
    fontSize: rulerContextSettings?.horizontal?.fontSize ?? 12,
    // Extended properties from RulersGridSystem
    textColor: rulerContextSettings?.horizontal?.textColor ?? UI_COLORS.WHITE,
    showLabels: rulerContextSettings?.horizontal?.showLabels ?? true,
    showUnits: rulerContextSettings?.horizontal?.showUnits ?? true,
    showBackground: rulerContextSettings?.horizontal?.showBackground ?? true,
    showMajorTicks: rulerContextSettings?.horizontal?.showMajorTicks ?? true,
    showMinorTicks: rulerContextSettings?.horizontal?.showMinorTicks ?? true,
    majorTickColor: rulerContextSettings?.horizontal?.majorTickColor ?? UI_COLORS.WHITE,
    minorTickColor: rulerContextSettings?.horizontal?.minorTickColor ?? UI_COLORS.LIGHT_GRAY,
    majorTickLength: rulerContextSettings?.horizontal?.majorTickLength ?? 10,
    minorTickLength: rulerContextSettings?.horizontal?.minorTickLength ?? 5,
    height: rulerContextSettings?.horizontal?.height ?? 30,
    width: rulerContextSettings?.vertical?.width ?? 30,
    position: (rulerContextSettings?.horizontal?.position ?? 'bottom') as 'top' | 'bottom' | 'left' | 'right',
    // 🔺 MISSING UNITS SETTINGS - Connection with floating panel
    unitsFontSize: rulerContextSettings?.horizontal?.unitsFontSize ?? 10,
    unitsColor: rulerContextSettings?.horizontal?.unitsColor ?? UI_COLORS.WHITE
  }), [rulerContextSettings]);

  // ============================================================================
  // GRID SETTINGS
  // ============================================================================

  /**
   * Convert RulersGridSystem grid settings to Canvas V2 GridSettings format
   */
  const gridSettings: GridSettings = useMemo(() => ({
    // Enabled state: First from panel, then toolbar fallback, finally ALWAYS true for stability
    // 🛡️ NULL GUARD: Ensure grid is always enabled, even if context is temporarily undefined
    enabled: gridContextSettings?.visual?.enabled ?? showGrid ?? true,
    visible: gridContextSettings?.visual?.enabled ?? true,

    // ✅ SIZE: From panel settings
    size: gridContextSettings?.visual?.step ?? 10,

    // ✅ COLORS: From panel settings (NOT hardcoded!)
    color: gridContextSettings?.visual?.color ?? UI_COLORS.BLUE_DEFAULT,
    majorGridColor: gridContextSettings?.visual?.majorGridColor ?? UI_COLORS.MEDIUM_GRAY,
    minorGridColor: gridContextSettings?.visual?.minorGridColor ?? UI_COLORS.LIGHT_GRAY_ALT,

    // ✅ OPACITY: From panel settings
    opacity: gridContextSettings?.visual?.opacity ?? 0.6,

    // ✅ LINE WIDTHS: From panel settings
    lineWidth: gridContextSettings?.visual?.minorGridWeight ?? 0.5,
    majorGridWeight: gridContextSettings?.visual?.majorGridWeight ?? 1,
    minorGridWeight: gridContextSettings?.visual?.minorGridWeight ?? 0.5,

    // ✅ GRID STYLE: From panel settings (lines/dots/crosses)
    style: gridContextSettings?.visual?.style ?? 'lines',
    majorInterval: gridContextSettings?.visual?.subDivisions ?? 5,
    showMajorGrid: true,
    showMinorGrid: true,
    adaptiveOpacity: false, // ❌ DISABLE to always show
    minVisibleSize: 0 // ✅ ALWAYS SHOW regardless of zoom
  }), [gridContextSettings, showGrid]);

  /**
   * Grid major interval for ruler tick calculations
   */
  const gridMajorInterval = gridContextSettings?.visual?.subDivisions ?? 5;

  // ============================================================================
  // SELECTION SETTINGS
  // ============================================================================

  /**
   * 🔺 SELECTION SETTINGS INTEGRATION - Connect selection boxes with floating panel
   */
  const selectionSettings: SelectionSettings = useMemo(() => ({
    window: {
      fillColor: cursorSettings.selection.window.fillColor,
      fillOpacity: cursorSettings.selection.window.fillOpacity,
      borderColor: cursorSettings.selection.window.borderColor,
      borderOpacity: cursorSettings.selection.window.borderOpacity,
      borderStyle: cursorSettings.selection.window.borderStyle,
      borderWidth: cursorSettings.selection.window.borderWidth
    },
    crossing: {
      fillColor: cursorSettings.selection.crossing.fillColor,
      fillOpacity: cursorSettings.selection.crossing.fillOpacity,
      borderColor: cursorSettings.selection.crossing.borderColor,
      borderOpacity: cursorSettings.selection.crossing.borderOpacity,
      borderStyle: cursorSettings.selection.crossing.borderStyle,
      borderWidth: cursorSettings.selection.crossing.borderWidth
    }
  }), [cursorSettings.selection]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    crosshairSettings,
    cursorCanvasSettings,
    snapSettings,
    rulerSettings,
    gridSettings,
    selectionSettings,
    gridMajorInterval,
  };
}

export default useCanvasSettings;
