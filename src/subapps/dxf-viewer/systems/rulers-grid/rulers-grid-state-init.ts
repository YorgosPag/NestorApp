/**
 * RULERS GRID STATE INITIALIZATION
 * Extracted from RulersGridSystem.tsx for SRP (ADR-065)
 *
 * Contains:
 * - Deep merge utility for nested objects
 * - Initial state factories for rulers and grid settings
 * - Property migration (ensures new properties exist)
 */

import { safeJsonParse } from '@/lib/json-utils';
import type {
  RulerSettings,
  GridSettings,
  RulersGridOperationResult,
  RulersGridOperation,
} from './config';
import {
  DEFAULT_RULER_SETTINGS,
  DEFAULT_GRID_SETTINGS,
} from './config';
import { UI_COLORS } from '../../config/color-config';
import { storageGet } from '../../utils/storage-utils';
import { SettingsValidationUtils } from './utils';
import type { Point2D } from './config';

// ── Types ────────────────────────────────────────────────────────────

export interface PersistedRulersGridData {
  rulers?: Partial<RulerSettings>;
  grid?: Partial<GridSettings>;
  origin?: { x: number; y: number };
  isVisible?: boolean;
  timestamp?: number;
}

// ── Utilities ────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge<T extends object>(target: T, source?: Partial<T>): T {
  if (!source) return target;
  const result = { ...target } as T;
  for (const key of Object.keys(source as object)) {
    const typedKey = key as keyof T;
    const sourceValue = source[typedKey];
    const resultValue = result[typedKey];
    if (isPlainObject(sourceValue) && isPlainObject(resultValue)) {
      const merged = deepMerge(
        resultValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
      result[typedKey] = merged as T[typeof typedKey];
    } else if (sourceValue !== undefined) {
      result[typedKey] = sourceValue as T[typeof typedKey];
    }
  }
  return result;
}

// ── Persisted Data Loading ───────────────────────────────────────────

export function loadPersistedData(
  enablePersistence: boolean,
  persistenceKey: string,
): PersistedRulersGridData | null {
  if (!enablePersistence) return null;
  return storageGet<PersistedRulersGridData | null>(persistenceKey, null);
}

// ── State Factories ──────────────────────────────────────────────────

/**
 * Create initial RulerSettings with deep merge + property migration.
 * Ensures all new properties exist (showLabels, showUnits, showBackground, etc.)
 */
export function createInitialRulerSettings(
  initialOverrides?: Partial<RulerSettings>,
  persisted?: Partial<RulerSettings>,
): RulerSettings {
  let result: RulerSettings = { ...DEFAULT_RULER_SETTINGS };

  if (persisted) {
    result = deepMerge(result, persisted);
  }
  if (initialOverrides) {
    result = deepMerge(result, initialOverrides);
  }

  // Migration: ensure new properties exist
  migrateRulerAxis(result.horizontal);
  migrateRulerAxis(result.vertical);

  return result;
}

function migrateRulerAxis(axis: RulerSettings['horizontal']) {
  if (axis.showLabels === undefined) axis.showLabels = true;
  if (axis.showUnits === undefined) axis.showUnits = true;
  if (axis.showBackground === undefined) axis.showBackground = true;
  if (axis.unitsFontSize === undefined) axis.unitsFontSize = axis.fontSize || 10;
  if (axis.showMajorTicks === undefined) axis.showMajorTicks = true;
  if (axis.majorTickColor === undefined) axis.majorTickColor = axis.tickColor || UI_COLORS.WHITE;
  if (axis.minorTickColor === undefined) axis.minorTickColor = UI_COLORS.WHITE;
  if (axis.unitsColor === undefined) axis.unitsColor = axis.textColor || UI_COLORS.WHITE;
}

/**
 * Create initial GridSettings with deep merge + property migration.
 * Ensures grid style property exists.
 */
export function createInitialGridSettings(
  initialOverrides?: Partial<GridSettings>,
  persisted?: Partial<GridSettings>,
): GridSettings {
  let result: GridSettings = { ...DEFAULT_GRID_SETTINGS };

  if (persisted) {
    result = deepMerge(result, persisted);
  }
  if (initialOverrides) {
    result = deepMerge(result, initialOverrides);
  }

  // Migration: ensure style property exists
  if (result.visual.style === undefined) {
    result.visual.style = 'lines';
  }

  return result;
}

// ── Settings Validation ──────────────────────────────────────────────

export function validateRulersGridSettings(settings: unknown): { valid: boolean; errors: string[] } {
  if (!isPlainObject(settings)) {
    return { valid: false, errors: ['Invalid settings object'] };
  }

  if ('horizontal' in settings && 'vertical' in settings) {
    return SettingsValidationUtils.validateRulerSettings(settings as unknown as RulerSettings);
  }

  if ('visual' in settings && 'behavior' in settings) {
    return SettingsValidationUtils.validateGridSettings(settings as unknown as GridSettings);
  }

  return { valid: false, errors: ['Unknown settings shape'] };
}

// ── Operations ───────────────────────────────────────────────────────

interface OperationHandlers {
  toggleRulers: () => void;
  toggleGrid: () => void;
  toggleRulerSnap: () => void;
  toggleGridSnap: () => void;
  resetOrigin: () => void;
}

export async function executeRulersGridOperation(
  operation: RulersGridOperation,
  handlers: OperationHandlers,
): Promise<RulersGridOperationResult> {
  try {
    switch (operation) {
      case 'toggle-rulers': handlers.toggleRulers(); break;
      case 'toggle-grid': handlers.toggleGrid(); break;
      case 'toggle-ruler-snap': handlers.toggleRulerSnap(); break;
      case 'toggle-grid-snap': handlers.toggleGridSnap(); break;
      case 'reset-origin': handlers.resetOrigin(); break;
      default: throw new Error(`Unknown operation: ${operation}`);
    }
    return { success: true, operation };
  } catch (error) {
    return { success: false, operation, error: error instanceof Error ? error.message : 'Operation failed' };
  }
}

// ── Import/Export ────────────────────────────────────────────────────

export function exportRulersGridSettings(
  rulers: RulerSettings,
  grid: GridSettings,
  origin: Point2D,
  isVisible: boolean,
): string {
  return JSON.stringify({ rulers, grid, origin, isVisible, version: '1.0', timestamp: Date.now() });
}

export function parseImportedSettings(data: string): {
  rulers?: RulerSettings;
  grid?: GridSettings;
  origin?: Point2D;
  isVisible?: boolean;
} | null {
  return safeJsonParse<{
    rulers?: RulerSettings;
    grid?: GridSettings;
    origin?: Point2D;
    isVisible?: boolean;
  }>(data, null as unknown as { rulers?: RulerSettings; grid?: GridSettings; origin?: Point2D; isVisible?: boolean });
}
