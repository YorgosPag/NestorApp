/**
 * @file Core Module Exports
 * @module settings/core
 *
 * ENTERPRISE STANDARD - Public API for core settings logic
 *
 * 
 */

// Types
export type {
  ViewerMode,
  StorageMode,
  EntityType,
  LineSettings,
  TextSettings,
  GripSettings,
  EntitySettings,
  OverrideFlags,
  SettingsState,
  Template,
  TemplateRegistry
} from './types';

export {
  SUPPORTED_MODES,
  ENTITY_TYPES,
  isViewerMode,
  isEntityType,
  isStorageMode
} from './types';

// Mode Mapping
export {
  modeMap,
  ensureStorageMode,
  isStorageMode as isStorageModeValidator
} from './modeMap';

// Merge Algorithm
export {
  computeEffective,
  computeBase,
  hasActiveOverrides,
  getOverriddenKeys,
  settingsEqual
} from './computeEffective';
