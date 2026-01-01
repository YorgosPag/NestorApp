/**
 * @file Settings Core Types - Single Entry Point
 * @module settings-core/types
 *
 * ENTERPRISE STANDARD - Barrel Export for All Types
 *
 * This is the CANONICAL source for all DXF settings types.
 * Import from here for consistent type usage across the application.
 *
 * @example
 * ```typescript
 * // CORRECT - Import from barrel
 * import type { LineSettings, ViewerMode, SettingsState } from '../settings-core/types';
 *
 * // DEPRECATED - Do NOT import from settings/core/types
 * // import type { LineSettings } from '../settings/core/types'; // ❌
 * ```
 *
 * Structure:
 * - domain.ts: Domain/business types (LineSettings, TextSettings, GripSettings, validation)
 * - state.ts: State management types (ViewerMode, SettingsState, OverrideFlags)
 *
 * @version 2.0.0
 * @since 2026-01-01
 */

// ============================================================================
// DOMAIN TYPES (from domain.ts)
// ============================================================================

export type {
  // Line Types
  LineType,
  LineCapStyle,
  LineJoinStyle,
  LineSettings,

  // Text Types
  TextAlign,
  TextBaseline,
  TextSettings,

  // Grip Types
  GripColors,
  GripSettings,

  // Enterprise Types
  EnterpriseCursorSettings,
  EnterpriseGridSettings,
  EnterpriseRulerSettings,

  // Combined Types
  DxfSettings,
  PartialDxfSettings,

  // Entity ID
  EntityId,
} from './domain';

export {
  // Validation Functions
  validateLineWidth,
  validateColor,
  validateFontSize,
  validateGripSize,
  validateLineSettings,
  validateTextSettings,
  validateGripSettings,
} from './domain';

// ============================================================================
// STATE TYPES (from state.ts)
// ============================================================================

export type {
  // Viewer Modes
  ViewerMode,
  StorageMode,

  // Entity Types
  EntityType,
  EntitySettings,

  // State
  SettingsState,
  OverrideFlags,

  // Templates
  Template,
  TemplateRegistry,
} from './state';

export {
  // Constants
  SUPPORTED_MODES,
  ENTITY_TYPES,
  DEFAULT_OVERRIDE_FLAGS,

  // Type Guards
  isViewerMode,
  isEntityType,
  isStorageMode,

  // Helpers
  toStorageMode,
} from './state';
