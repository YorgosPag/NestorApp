/**
 * @module DxfSettingsStore
 * @description Centralized Zustand store for DXF Settings management.
 * Implements an override pattern where general settings serve as base values
 * and entity-specific overrides are stored as deltas for memory efficiency.
 *
 * @features
 * - General settings for all entities
 * - Entity-specific overrides (deltas only)
 * - Selectors for granular updates
 * - LocalStorage persistence
 * - DevTools integration
 *
 * @example
 * ```tsx
 * // Get general line settings
 * const lineSettings = useGeneralLineSettings();
 *
 * // Set entity override
 * const store = useDxfSettingsStore();
 * store.setOverride('entity-123', { line: { color: '#FF0000' } });
 *
 * // Get effective settings (merged)
 * const effective = store.getEffective('entity-123');
 * ```
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  LineSettings,
  TextSettings,
  GripSettings,
  DxfSettings,
  PartialDxfSettings,
  EntityId
} from '../settings-core/types';
import {
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRIP_SETTINGS,
  DEFAULT_DXF_SETTINGS
} from '../settings-core/defaults';
import {
  mergeSettings,
  mergeDxfSettings,
  diffSettings,
  extractOverrides,
  hasOverrides,
  cleanEmptyOverrides
} from '../settings-core/override';
import {
  validateLineSettings,
  validateTextSettings,
  validateGripSettings
} from '../settings-core/types';
// 🏢 ADR-092: Centralized localStorage Service
import { storageGet, storageSet, storageRemove, STORAGE_KEYS } from '../utils/storage-utils';
// 🏢 ADR-098: Centralized Timing Constants
import { STORAGE_TIMING } from '../config/timing-config';

// ============================================================================
// STORE STATE TYPE
// ============================================================================

interface DxfSettingsState {
  // General Settings (base για όλα τα entities)
  general: DxfSettings;

  // Overrides ανά entity (μόνο deltas από τα general)
  overrides: Record<EntityId, PartialDxfSettings>;

  // Currently selected entities
  selection: EntityId[];

  // Persistence state
  isLoaded: boolean;
  lastSaved: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

// ============================================================================
// STORE ACTIONS TYPE
// ============================================================================

interface DxfSettingsActions {
  // General Settings Actions
  setGeneralLine: (patch: Partial<LineSettings>) => void;
  setGeneralText: (patch: Partial<TextSettings>) => void;
  setGeneralGrip: (patch: Partial<GripSettings>) => void;
  setGeneralAll: (patch: PartialDxfSettings) => void;
  resetGeneralToDefaults: () => void;

  // Override Actions
  setOverride: (entityId: EntityId, patch: PartialDxfSettings) => void;
  clearOverride: (entityId: EntityId) => void;
  clearAllOverrides: () => void;
  applyToSelection: (patch: PartialDxfSettings) => void;

  // Selection Actions
  setSelection: (entityIds: EntityId[]) => void;
  addToSelection: (entityId: EntityId) => void;
  removeFromSelection: (entityId: EntityId) => void;
  clearSelection: () => void;

  // Computed Getters
  getEffective: (entityId: EntityId) => DxfSettings;
  getEffectiveLine: (entityId: EntityId) => LineSettings;
  getEffectiveText: (entityId: EntityId) => TextSettings;
  getEffectiveGrip: (entityId: EntityId) => GripSettings;
  hasEntityOverrides: (entityId: EntityId) => boolean;

  // Persistence Actions
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  clearLocalStorage: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useDxfSettingsStore = create<DxfSettingsState & DxfSettingsActions>()(
  devtools(
    immer(
      subscribeWithSelector((set, get) => ({
        // ====================================================================
        // INITIAL STATE
        // ====================================================================

        general: DEFAULT_DXF_SETTINGS,
        overrides: {},
        selection: [],
        isLoaded: false,
        lastSaved: null,
        saveStatus: 'idle',

        // ====================================================================
        // GENERAL SETTINGS ACTIONS
        // ====================================================================

        setGeneralLine: (patch) => {
          set((state) => {
            state.general.line = validateLineSettings({
              ...state.general.line,
              ...patch
            });
          });
        },

        setGeneralText: (patch) => {
          set((state) => {
            state.general.text = validateTextSettings({
              ...state.general.text,
              ...patch
            });
          });
        },

        setGeneralGrip: (patch) => {
          set((state) => {
            state.general.grip = validateGripSettings({
              ...state.general.grip,
              ...patch
            });
          });
        },

        setGeneralAll: (patch) => {
          set((state) => {
            if (patch.line) {
              state.general.line = validateLineSettings({
                ...state.general.line,
                ...patch.line
              });
            }
            if (patch.text) {
              state.general.text = validateTextSettings({
                ...state.general.text,
                ...patch.text
              });
            }
            if (patch.grip) {
              state.general.grip = validateGripSettings({
                ...state.general.grip,
                ...patch.grip
              });
            }
          });
        },

        resetGeneralToDefaults: () => {
          set((state) => {
            state.general = DEFAULT_DXF_SETTINGS;
          });
        },

        // ====================================================================
        // OVERRIDE ACTIONS
        // ====================================================================

        setOverride: (entityId, patch) => {
          set((state) => {
            const currentOverrides = state.overrides[entityId] || {};

            const newOverrides = {
              line: patch.line ? { ...currentOverrides.line, ...patch.line } : currentOverrides.line,
              text: patch.text ? { ...currentOverrides.text, ...patch.text } : currentOverrides.text,
              grip: patch.grip ? { ...currentOverrides.grip, ...patch.grip } : currentOverrides.grip,
            };

            const cleanedOverrides = cleanEmptyOverrides(newOverrides);

            if (cleanedOverrides) {
              state.overrides[entityId] = cleanedOverrides;
            } else {
              delete state.overrides[entityId];
            }
          });
        },

        clearOverride: (entityId) => {
          set((state) => {
            delete state.overrides[entityId];
          });
        },

        clearAllOverrides: () => {
          set((state) => {
            state.overrides = {};
          });
        },

        applyToSelection: (patch) => {
          set((state) => {
            const selection = state.selection;
            if (selection.length === 0) return;

            for (const entityId of selection) {
              const currentOverrides = state.overrides[entityId] || {};

              const newOverrides = {
                line: patch.line ? { ...currentOverrides.line, ...patch.line } : currentOverrides.line,
                text: patch.text ? { ...currentOverrides.text, ...patch.text } : currentOverrides.text,
                grip: patch.grip ? { ...currentOverrides.grip, ...patch.grip } : currentOverrides.grip,
              };

              const cleanedOverrides = cleanEmptyOverrides(newOverrides);

              if (cleanedOverrides) {
                state.overrides[entityId] = cleanedOverrides;
              } else {
                delete state.overrides[entityId];
              }
            }
          });
        },

        // ====================================================================
        // SELECTION ACTIONS
        // ====================================================================

        setSelection: (entityIds) => {
          set((state) => {
            state.selection = entityIds;
          });
        },

        addToSelection: (entityId) => {
          set((state) => {
            if (!state.selection.includes(entityId)) {
              state.selection.push(entityId);
            }
          });
        },

        removeFromSelection: (entityId) => {
          set((state) => {
            const index = state.selection.indexOf(entityId);
            if (index !== -1) {
              state.selection.splice(index, 1);
            }
          });
        },

        clearSelection: () => {
          set((state) => {
            state.selection = [];
          });
        },

        // ====================================================================
        // COMPUTED GETTERS
        // ====================================================================

        getEffective: (entityId) => {
          const state = get();
          const override = state.overrides[entityId];
          return mergeDxfSettings(state.general, override);
        },

        getEffectiveLine: (entityId) => {
          const state = get();
          const override = state.overrides[entityId]?.line;
          return mergeSettings(state.general.line, override);
        },

        getEffectiveText: (entityId) => {
          const state = get();
          const override = state.overrides[entityId]?.text;
          return mergeSettings(state.general.text, override);
        },

        getEffectiveGrip: (entityId) => {
          const state = get();
          const override = state.overrides[entityId]?.grip;
          return mergeSettings(state.general.grip, override);
        },

        hasEntityOverrides: (entityId) => {
          const state = get();
          return hasOverrides(state.overrides[entityId]);
        },

        // ====================================================================
        // PERSISTENCE ACTIONS
        // ====================================================================

        // 🏢 ADR-092: Using centralized storage-utils
        saveToLocalStorage: () => {
          set((state) => {
            state.saveStatus = 'saving';
          });

          try {
            const state = get();
            const dataToSave = {
              general: state.general,
              overrides: state.overrides,
              savedAt: new Date().toISOString()
            };

            const success = storageSet(STORAGE_KEYS.DXF_SETTINGS, dataToSave);

            if (success) {
              set((state) => {
                state.lastSaved = new Date();
                state.saveStatus = 'saved';
              });

              // Reset status μετά από save status display duration
              // 🏢 ADR-098: Using STORAGE_TIMING.SAVE_STATUS_DISPLAY
              setTimeout(() => {
                set((state) => {
                  state.saveStatus = 'idle';
                });
              }, STORAGE_TIMING.SAVE_STATUS_DISPLAY);
            } else {
              throw new Error('storageSet returned false');
            }
          } catch (error) {
            console.error('Failed to save settings:', error);
            set((state) => {
              state.saveStatus = 'error';
            });
          }
        },

        // 🏢 ADR-092: Using centralized storage-utils
        loadFromLocalStorage: () => {
          interface PersistedSettings {
            general?: {
              line?: Partial<LineSettings>;
              text?: Partial<TextSettings>;
              grip?: Partial<GripSettings>;
            };
            overrides?: Record<EntityId, PartialDxfSettings>;
            savedAt?: string;
          }

          const saved = storageGet<PersistedSettings | null>(STORAGE_KEYS.DXF_SETTINGS, null);

          if (saved) {
            set((state) => {
              if (saved.general) {
                state.general = {
                  line: validateLineSettings(saved.general.line || DEFAULT_LINE_SETTINGS),
                  text: validateTextSettings(saved.general.text || DEFAULT_TEXT_SETTINGS),
                  grip: validateGripSettings(saved.general.grip || DEFAULT_GRIP_SETTINGS),
                };
              }

              if (saved.overrides) {
                state.overrides = saved.overrides;
              }

              state.isLoaded = true;
              state.lastSaved = saved.savedAt ? new Date(saved.savedAt) : null;
            });
          } else {
            set((state) => {
              state.isLoaded = true;
            });
          }
        },

        // 🏢 ADR-092: Using centralized storage-utils
        clearLocalStorage: () => {
          const success = storageRemove(STORAGE_KEYS.DXF_SETTINGS);
          if (success) {
            set((state) => {
              state.lastSaved = null;
            });
          } else {
            console.error('Failed to clear settings');
          }
        },
      }))
    ),
    {
      name: 'dxf-settings-store',
    }
  )
);

// ============================================================================
// SELECTORS για performance optimization
// ============================================================================

// Selector για general line settings
export const useGeneralLineSettings = () =>
  useDxfSettingsStore((state) => state.general.line);

// Selector για general text settings
export const useGeneralTextSettings = () =>
  useDxfSettingsStore((state) => state.general.text);

// Selector για general grip settings
export const useGeneralGripSettings = () =>
  useDxfSettingsStore((state) => state.general.grip);

// Selector για specific entity overrides
export const useEntityOverrides = (entityId: EntityId) =>
  useDxfSettingsStore((state) => state.overrides[entityId]);

// Selector για effective settings ενός entity
export const useEffectiveSettings = (entityId: EntityId) =>
  useDxfSettingsStore((state) => state.getEffective(entityId));

// Selector για selection
export const useSelectedEntities = () =>
  useDxfSettingsStore((state) => state.selection);

// Selector για save status
export const useSaveStatus = () =>
  useDxfSettingsStore((state) => ({
    status: state.saveStatus,
    lastSaved: state.lastSaved
  }));