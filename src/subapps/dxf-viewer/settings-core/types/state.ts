/**
 * @file State Management Types for DXF Settings
 * @module settings-core/types/state
 *
 * ENTERPRISE STANDARD - Single Source of Truth for State Types
 *
 * Contains all state management types:
 * - ViewerMode, StorageMode
 * - EntityType, EntitySettings
 * - SettingsState, OverrideFlags
 * - Type guards
 *
 * @see domain.ts for domain types (LineSettings, TextSettings, etc.)
 * @version 2.0.0
 * @since 2026-01-01
 */

import type { LineSettings, TextSettings, GripSettings } from './domain';

// ============================================================================
// VIEWER MODES
// ============================================================================

/**
 * All supported viewer modes
 * - normal: Standard viewing
 * - draft: Drawing/editing mode
 * - hover: Mouse hover state
 * - selection: Entity selection state
 * - completion: Final completion phase
 * - preview: Preview mode (maps to 'draft' internally)
 */
export const SUPPORTED_MODES = [
  'normal',
  'draft',
  'hover',
  'selection',
  'completion',
  'preview'
] as const;

export type ViewerMode = typeof SUPPORTED_MODES[number];

/**
 * Viewer modes excluding 'preview' (used for internal storage)
 * Preview mode is always mapped to 'draft' for storage
 */
export type StorageMode = Exclude<ViewerMode, 'preview'>;

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * All entity types that can have settings
 */
export const ENTITY_TYPES = ['line', 'text', 'grip'] as const;
export type EntityType = typeof ENTITY_TYPES[number];

// ============================================================================
// ENTITY SETTINGS STRUCTURE
// ============================================================================

/**
 * Settings structure for a single entity type
 *
 * 3-Layer Architecture:
 * 1. General: Base settings (applies to all modes)
 * 2. Specific: Mode-specific settings (overrides general per mode)
 * 3. Overrides: User overrides (overrides general + specific when enabled)
 */
export interface EntitySettings<T> {
  general: T;
  specific: Record<StorageMode, Partial<T>>;
  overrides: Record<StorageMode, Partial<T>>;
}

/**
 * Override enabled flags per mode
 */
export type OverrideFlags = Record<StorageMode, boolean>;

// ============================================================================
// SETTINGS STATE (Main State Structure)
// ============================================================================

/**
 * Complete settings state for all entities
 */
export interface SettingsState {
  __standards_version: number;  // Schema version for migrations

  // Entity settings
  line: EntitySettings<LineSettings>;
  text: EntitySettings<TextSettings>;
  grip: EntitySettings<GripSettings>;

  // Override flags (per entity, per mode)
  overrideEnabled: {
    line: OverrideFlags;
    text: OverrideFlags;
    grip: OverrideFlags;
  };
}

// ============================================================================
// TEMPLATES
// ============================================================================

export interface Template<T> {
  id: string;
  name: string;
  settings: T;
  createdAt: number;
  updatedAt: number;
}

export type TemplateRegistry<T> = Record<string, Template<T>>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isViewerMode(value: unknown): value is ViewerMode {
  return typeof value === 'string' && SUPPORTED_MODES.includes(value as ViewerMode);
}

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && ENTITY_TYPES.includes(value as EntityType);
}

export function isStorageMode(value: unknown): value is StorageMode {
  return typeof value === 'string' &&
    value !== 'preview' &&
    SUPPORTED_MODES.includes(value as ViewerMode);
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Maps ViewerMode to StorageMode (preview -> draft)
 */
export function toStorageMode(mode: ViewerMode): StorageMode {
  return mode === 'preview' ? 'draft' : mode;
}

/**
 * Default override flags (all false)
 */
export const DEFAULT_OVERRIDE_FLAGS: OverrideFlags = {
  normal: false,
  draft: false,
  hover: false,
  selection: false,
  completion: false
};
