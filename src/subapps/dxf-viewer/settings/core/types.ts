/**
 * @file Core Type Definitions for DxfSettings
 * @module settings/core/types
 *
 * ENTERPRISE STANDARD - Single Source of Truth for all settings types
 *
 * 
 */

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
// LINE SETTINGS
// ============================================================================

export interface LineSettings {
  lineWidth: number;        // 0.1 - 10.0 mm
  lineColor: string;        // Hex color (#RRGGBB)
  lineStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;          // 0.0 - 1.0
}

// ============================================================================
// TEXT SETTINGS
// ============================================================================

export interface TextSettings {
  fontSize: number;         // 8 - 72 pt
  fontFamily: string;       // Font name
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textColor: string;        // Hex color (#RRGGBB)
  opacity: number;          // 0.0 - 1.0
}

// ============================================================================
// GRIP SETTINGS
// ============================================================================

export interface GripSettings {
  size: number;             // 4 - 20 px
  color: string;            // Hex color (#RRGGBB)
  hoverColor: string;       // Hex color (#RRGGBB)
  shape: 'square' | 'circle';
  opacity: number;          // 0.0 - 1.0
}

// ============================================================================
// SETTINGS STATE STRUCTURE
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
