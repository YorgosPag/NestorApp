/**
 * Migration helper functions for property name transformations
 * Extracted from migrationRegistry.ts per ADR-065 (file size limit: max 500 lines)
 *
 * Contains the fix/revert functions used by migration entries (v1→v2 rollback).
 */

import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// ENTITY SETTINGS TYPE (shared by all helpers)
// ============================================================================

interface EntitySettings {
  general: Record<string, unknown>;
  specific: Record<string, Record<string, unknown>>;
  overrides: Record<string, Record<string, unknown>>;
}

/** Apply a transformation function to all settings levels (general, specific, overrides) */
function applyToAllLevels(
  entitySettings: unknown,
  transform: (settings: Record<string, unknown>) => Record<string, unknown>
): EntitySettings {
  const entity = entitySettings as EntitySettings;
  return {
    general: transform(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? transform(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? transform(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

// ============================================================================
// FIX FUNCTIONS (v1 → v2 migration)
// ============================================================================

/**
 * Fix Line property names: lineColor → color, lineStyle → lineType
 */
export function fixLinePropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const fixed = { ...settings };
    // lineColor → color
    if ('lineColor' in fixed) {
      fixed.color = fixed.lineColor;
      delete fixed.lineColor;
    }
    // lineStyle → lineType
    if ('lineStyle' in fixed) {
      fixed.lineType = fixed.lineStyle;
      delete fixed.lineStyle;
    }
    // ✅ FIX: Add enabled property if missing (for LinePreview)
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }
    return fixed;
  });
}

/**
 * Fix Text property names: textColor → color
 */
export function fixTextPropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const fixed = { ...settings };
    // textColor → color
    if ('textColor' in fixed) {
      fixed.color = fixed.textColor;
      delete fixed.textColor;
    }
    // ✅ FIX: Add enabled property if missing
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }
    return fixed;
  });
}

/**
 * Fix Grip property names: size → gripSize, color/hoverColor → colors{cold,warm,hot,contour}
 */
export function fixGripPropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const fixed = { ...settings };
    // size → gripSize
    if ('size' in fixed) {
      fixed.gripSize = fixed.size;
      delete fixed.size;
    }
    // color/hoverColor → colors{cold,warm,hot,contour}
    if ('color' in fixed || 'hoverColor' in fixed) {
      fixed.colors = {
        cold: fixed.color || UI_COLORS.SNAP_CENTER,
        warm: fixed.hoverColor || UI_COLORS.SNAP_INTERSECTION,
        hot: UI_COLORS.SNAP_ENDPOINT,
        contour: UI_COLORS.BLACK
      };
      delete fixed.color;
      delete fixed.hoverColor;
    }
    // ✅ FIX: Add enabled property if missing
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }
    return fixed;
  });
}

// ============================================================================
// REVERT FUNCTIONS (v2 → v1 rollback)
// ============================================================================

/**
 * Revert Line property names: color → lineColor, lineType → lineStyle (rollback)
 */
export function revertLinePropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const reverted = { ...settings };
    if ('color' in reverted) {
      reverted.lineColor = reverted.color;
      delete reverted.color;
    }
    if ('lineType' in reverted) {
      reverted.lineStyle = reverted.lineType;
      delete reverted.lineType;
    }
    return reverted;
  });
}

/**
 * Revert Text property names: color → textColor (rollback)
 */
export function revertTextPropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const reverted = { ...settings };
    if ('color' in reverted) {
      reverted.textColor = reverted.color;
      delete reverted.color;
    }
    return reverted;
  });
}

/**
 * Revert Grip property names: gripSize → size, colors{} → color/hoverColor (rollback)
 */
export function revertGripPropertyNames(entitySettings: unknown): unknown {
  return applyToAllLevels(entitySettings, (settings) => {
    const reverted = { ...settings };
    if ('gripSize' in reverted) {
      reverted.size = reverted.gripSize;
      delete reverted.gripSize;
    }
    if ('colors' in reverted && typeof reverted.colors === 'object') {
      const colors = reverted.colors as { cold?: string; warm?: string };
      reverted.color = colors.cold || UI_COLORS.SNAP_CENTER;
      reverted.hoverColor = colors.warm || UI_COLORS.SNAP_INTERSECTION;
      delete reverted.colors;
    }
    return reverted;
  });
}

/**
 * Utility: Rename a field in an object
 */
export function renameField<T extends Record<string, unknown>>(
  obj: T,
  oldKey: string,
  newKey: string
): T {
  if (oldKey in obj) {
    const { [oldKey]: value, ...rest } = obj;
    return { ...rest, [newKey]: value } as T;
  }
  return obj;
}
