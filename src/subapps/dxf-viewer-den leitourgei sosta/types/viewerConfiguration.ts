/**
 * UNIFIED CONFIGURATION SYSTEM
 * Enterprise-grade configuration για DXF Viewer
 * Αντικαθιστά 12+ contexts με unified approach
 */

import type { LineSettings } from './lineSettings';
import type { TextSettings } from './textSettings';
import type { GripSettings } from './gripSettings';

// ===== CORE TYPES =====

export type ViewerMode = 'normal' | 'preview' | 'completion';

export type EntityType = 'line' | 'text' | 'grip';

// ===== ENTITY CONFIGURATION =====

export interface EntityConfig<T> {
  /** Γενικές ρυθμίσεις (από General Settings) */
  general: T;

  /** Ειδικές ρυθμίσεις για διαφορετικά modes */
  specific: {
    preview?: Partial<T>;
    completion?: Partial<T>;
  };

  /** Αν είναι ενεργό το override system για αυτό το entity */
  overrideEnabled: boolean;
}

// ===== USER OVERRIDES =====

export interface UserOverrides {
  line: {
    preview?: Partial<LineSettings>;
    completion?: Partial<LineSettings>;
  };
  text: {
    preview?: Partial<TextSettings>;
  };
  grip: {
    preview?: Partial<GripSettings>;
  };
}

// ===== MAIN CONFIGURATION =====

export interface ViewerConfiguration {
  /** Ρυθμίσεις για κάθε entity type */
  entities: {
    line: EntityConfig<LineSettings>;
    text: EntityConfig<TextSettings>;
    grip: EntityConfig<GripSettings>;
  };

  /** Τρέχων mode της εφαρμογής */
  mode: ViewerMode;

  /** User overrides (από Specific Settings UI) */
  overrides: UserOverrides;
}

// ===== EFFECTIVE SETTINGS CALCULATION =====

export interface EffectiveSettings {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
}

// ===== CONFIGURATION PROVIDER PROPS =====

export interface ConfigurationProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<ViewerConfiguration>;
}

// ===== CONFIGURATION CONTEXT TYPE =====

export interface ConfigurationContextType {
  config: ViewerConfiguration;
  updateConfig: (updates: Partial<ViewerConfiguration>) => void;
  updateEntityConfig: <T extends EntityType>(
    entityType: T,
    updates: Partial<EntityConfig<unknown>>
  ) => void;
  updateOverrides: (updates: Partial<UserOverrides>) => void;
  setMode: (mode: ViewerMode) => void;
  getEffectiveSettings: () => EffectiveSettings;
}

// ===== STYLE MANAGER TYPES =====

export interface StyleManagerContextType {
  /** Συγχρονισμός με stores όταν αλλάζουν τα effective settings */
  syncStores: (settings: EffectiveSettings) => void;

  /** Άμεση ενημέρωση ενός συγκεκριμένου store */
  updateStore: (entityType: EntityType, settings: LineSettings | TextSettings | GripSettings) => void;
}

// ===== CUSTOM HOOKS RETURN TYPES =====

export interface EntityStylesHookResult<T> {
  settings: T;
  isOverridden: boolean;
  update: (updates: Partial<T>) => void;
  reset: () => void;
}

export interface PreviewModeHookResult {
  mode: ViewerMode;
  setMode: (mode: ViewerMode) => void;
  isPreview: boolean;
  isCompletion: boolean;
  isNormal: boolean;
}

export interface OverrideSystemHookResult {
  isEnabled: (entityType: EntityType) => boolean;
  toggle: (entityType: EntityType) => void;
  enable: (entityType: EntityType) => void;
  disable: (entityType: EntityType) => void;
}