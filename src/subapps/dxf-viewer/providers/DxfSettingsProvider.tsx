/**
 * DxfSettingsProvider - Central Settings Provider
 *
 * @description
 * Κεντρικός React Context Provider που διαχειρίζεται ΟΛΑ τα settings του DXF Viewer.
 * Single source of truth για Line, Text, Grip, Grid, Ruler, Cursor settings.
 *
 * @features
 * - 🎯 Central settings storage (Single source of truth)
 * - 💾 Auto-save to localStorage (500ms debounce)
 * - 🔄 Mode-based settings (normal/preview/completion)
 * - 📊 Effective settings calculation (General → Specific → Overrides)
 * - ✅ Settings validation & migration system
 * - 🔧 Automatic legacy settings migration
 *
 * @problem_solved
 * Αντικαθιστά:
 * - ConfigurationProvider (mode-based, NO persistence)
 * - Διάσπαρτα auto-save systems (κυκλικά loops)
 * - Πολλαπλές φορτώσεις από localStorage
 * - Δύο providers χωρίς συγχρονισμό
 *
 * @architecture
 * ```
 * DxfSettingsProvider (Root)
 *   ├── State: { line, text, grip, grid, ruler, cursor, mode, specific, overrides }
 *   ├── Reducer: settingsReducer (handles all actions)
 *   ├── Auto-Save: 500ms debounce → localStorage
 *   ├── Context: DxfSettingsContext
 *   └── Hooks: useDxfSettings(), getEffectiveSettings()
 * ```
 *
 * @usage
 * ```tsx
 * // Wrap your app
 * <DxfSettingsProvider>
 *   <DxfViewerContent />
 * </DxfSettingsProvider>
 *
 * // Access settings
 * const { settings, updateLineSettings } = useDxfSettings();
 * const effectiveSettings = getEffectiveLineSettings('preview');
 * ```
 *
 * @see {@link docs/settings-system/03-DXFSETTINGSPROVIDER.md} - Complete documentation (1,006 lines)
 * @see {@link docs/settings-system/01-ARCHITECTURE_OVERVIEW.md} - Architecture diagrams
 * @see {@link docs/settings-system/06-SETTINGS_FLOW.md} - Settings lifecycle flow
 * @see {@link docs/SETTINGS_ARCHITECTURE.md} - Overview
 *
 * @migration
 * Automatically migrates from legacy keys:
 * - 'line-settings' → 'dxf-settings-v1'.line
 * - 'text-settings' → 'dxf-settings-v1'.text
 * - 'grip-settings' → 'dxf-settings-v1'.grip
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type { LineSettings } from '../settings-core/types';
import type { TextSettings } from '../contexts/TextSettingsContext';
import type { GripSettings } from '../types/gripSettings';
import type { GridSettings, RulerSettings } from '../systems/rulers-grid/config';
import type { CursorSettings } from '../systems/cursor/config';
import type { LineTemplate } from '../contexts/LineSettingsContext';
import { DEFAULT_GRID_SETTINGS, DEFAULT_RULER_SETTINGS } from '../systems/rulers-grid/config';
import { DEFAULT_CURSOR_SETTINGS } from '../systems/cursor/config';
import { textStyleStore } from '../stores/TextStyleStore';
import { toolStyleStore } from '../stores/ToolStyleStore';
import { useUnifiedLinePreview } from '../ui/hooks/useUnifiedSpecificSettings';
import { getDashArray } from '../settings-core/defaults';

// ===== RULERS GRID SYNC STORES =====
// Κεντρικά stores για συγχρονισμό Grid & Rulers settings χωρίς κυκλικές εξαρτήσεις

interface GridSettingsStore {
  settings: GridSettings;
  listeners: Set<(settings: GridSettings) => void>;
  update: (updates: Partial<GridSettings>) => void;
  subscribe: (listener: (settings: GridSettings) => void) => () => void;
}

interface RulerSettingsStore {
  settings: RulerSettings;
  listeners: Set<(settings: RulerSettings) => void>;
  update: (updates: Partial<RulerSettings>) => void;
  subscribe: (listener: (settings: RulerSettings) => void) => () => void;
}

// Grid Settings Store
const createGridStore = (): GridSettingsStore => {
  let current = { ...DEFAULT_GRID_SETTINGS };
  const listeners = new Set<(settings: GridSettings) => void>();

  return {
    get settings() { return current; },
    listeners,
    update: (updates) => {
      current = { ...current, ...updates };
      listeners.forEach(listener => listener(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

// Ruler Settings Store
const createRulerStore = (): RulerSettingsStore => {
  let current = { ...DEFAULT_RULER_SETTINGS };
  const listeners = new Set<(settings: RulerSettings) => void>();

  return {
    get settings() { return current; },
    listeners,
    update: (updates) => {
      console.log('🔍 GLOBAL RULER STORE UPDATE:', {
        before: { horizontal: current.horizontal.enabled, vertical: current.vertical.enabled },
        updates: updates,
        updateHorizontalEnabled: updates.horizontal?.enabled,
        updateVerticalEnabled: updates.vertical?.enabled
      });
      current = { ...current, ...updates };
      console.log('🔍 GLOBAL RULER STORE AFTER UPDATE:', {
        after: { horizontal: current.horizontal.enabled, vertical: current.vertical.enabled }
      });
      listeners.forEach(listener => listener(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

// Global stores για sync
export const globalGridStore = createGridStore();
export const globalRulerStore = createRulerStore();

// ===== TYPES =====

// 🆕 MERGE: Mode type from ConfigurationProvider
export type ViewerMode = 'normal' | 'preview' | 'completion';

// 🆕 MERGE: Specific settings structure (from ConfigurationProvider)
// 🔧 EXTENDED (2025-10-06): Added draft/hover/selection modes for enterprise CAD standard
interface SpecificSettings {
  line: {
    draft?: Partial<LineSettings>;      // 🆕 Προσχεδίαση (Drawing preview - first click)
    hover?: Partial<LineSettings>;      // 🆕 Αιώρηση (Mouse hover state)
    selection?: Partial<LineSettings>;  // 🆕 Επιλογή (Selected entity state)
    completion?: Partial<LineSettings>; // ✅ Ολοκλήρωση (Final entity state)
  };
  text: {
    draft?: Partial<TextSettings>;      // 🆕 RENAMED from 'preview' for consistency
  };
  grip: {
    draft?: Partial<GripSettings>;      // 🆕 RENAMED from 'preview' for consistency
  };
}

// 🆕 MERGE: Override settings structure (from ConfigurationProvider)
// 🔧 EXTENDED (2025-10-06): Added draft/hover/selection modes for enterprise CAD standard
interface OverrideSettings {
  line: {
    draft?: Partial<LineSettings>;      // 🆕 Προσχεδίαση overrides
    hover?: Partial<LineSettings>;      // 🆕 Αιώρηση overrides
    selection?: Partial<LineSettings>;  // 🆕 Επιλογή overrides
    completion?: Partial<LineSettings>; // ✅ Ολοκλήρωση overrides
  };
  text: {
    draft?: Partial<TextSettings>;      // 🆕 RENAMED from 'preview' for consistency
  };
  grip: {
    draft?: Partial<GripSettings>;      // 🆕 RENAMED from 'preview' for consistency
  };
}

// 🆕 MERGE: Override enabled flags
// 🔧 EXTENDED (2025-10-06): Per-mode override flags for granular control
interface OverrideEnabledFlags {
  line: {
    draft: boolean;      // 🆕 Προσχεδίαση override enabled
    hover: boolean;      // 🆕 Αιώρηση override enabled
    selection: boolean;  // 🆕 Επιλογή override enabled
    completion: boolean; // 🆕 Ολοκλήρωση override enabled
  };
  text: {
    draft: boolean;      // 🆕 Κείμενο προσχεδίασης override enabled
  };
  grip: {
    draft: boolean;      // 🆕 Grips προσχεδίασης override enabled
  };
}

// 🆕 TEMPLATE OVERRIDES: User customizations on top of templates
interface TemplateOverrides {
  line?: Partial<LineSettings>;
  text?: Partial<TextSettings>;
  grip?: Partial<GripSettings>;
}

// 🆕 ACTIVE TEMPLATES: Track which template is currently selected
interface ActiveTemplates {
  line: string | null;
  text: string | null;
  grip: string | null;
}

interface DxfSettingsState {
  // ===== EXISTING SETTINGS (General) =====
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
  grid: GridSettings;           // 🆕 ΠΡΟΣΘΗΚΗ: Grid settings
  ruler: RulerSettings;         // 🆕 ΠΡΟΣΘΗΚΗ: Ruler settings
  cursor: CursorSettings;       // 🆕 ΠΡΟΣΘΗΚΗ: Cursor settings

  // ===== NEW: MODE-BASED SETTINGS (from ConfigurationProvider) =====
  mode: ViewerMode;                      // 🆕 MERGE: Current viewer mode (normal/preview/completion)
  specific: SpecificSettings;            // 🆕 MERGE: Mode-specific settings (preview/completion overrides)
  overrides: OverrideSettings;           // 🆕 MERGE: User overrides per mode
  overrideEnabled: OverrideEnabledFlags; // 🆕 MERGE: Which entities have override enabled

  // ===== TEMPLATE SYSTEM (2025-10-06) =====
  templateOverrides: TemplateOverrides;  // 🆕 User customizations on templates
  activeTemplates: ActiveTemplates;      // 🆕 Currently selected templates

  // ===== EXISTING META =====
  isLoaded: boolean;
  lastSaved: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

type SettingsAction =
  // ===== EXISTING ACTIONS =====
  | { type: 'LOAD_ALL_SETTINGS'; payload: Partial<DxfSettingsState> }
  | { type: 'UPDATE_LINE_SETTINGS'; payload: Partial<LineSettings> }
  | { type: 'UPDATE_TEXT_SETTINGS'; payload: Partial<TextSettings> }
  | { type: 'UPDATE_GRIP_SETTINGS'; payload: Partial<GripSettings> }
  | { type: 'UPDATE_GRID_SETTINGS'; payload: Partial<GridSettings> }
  | { type: 'UPDATE_RULER_SETTINGS'; payload: Partial<RulerSettings> }
  | { type: 'UPDATE_CURSOR_SETTINGS'; payload: Partial<CursorSettings> }
  | { type: 'SET_SAVE_STATUS'; payload: DxfSettingsState['saveStatus'] }
  | { type: 'MARK_SAVED'; payload: Date }
  | { type: 'RESET_TO_DEFAULTS' }

  // ===== NEW: MODE-BASED ACTIONS (from ConfigurationProvider) =====
  // 🔧 EXTENDED (2025-10-06): Per-mode actions for draft/hover/selection/completion
  | { type: 'SET_MODE'; payload: ViewerMode }
  | { type: 'UPDATE_SPECIFIC_LINE_SETTINGS'; payload: { mode: 'draft' | 'hover' | 'selection' | 'completion'; settings: Partial<LineSettings> } }
  | { type: 'UPDATE_SPECIFIC_TEXT_SETTINGS'; payload: { mode: 'draft'; settings: Partial<TextSettings> } }
  | { type: 'UPDATE_SPECIFIC_GRIP_SETTINGS'; payload: { mode: 'draft'; settings: Partial<GripSettings> } }
  | { type: 'UPDATE_LINE_OVERRIDES'; payload: { mode: 'draft' | 'hover' | 'selection' | 'completion'; settings: Partial<LineSettings> } }
  | { type: 'UPDATE_TEXT_OVERRIDES'; payload: { mode: 'draft'; settings: Partial<TextSettings> } }
  | { type: 'UPDATE_GRIP_OVERRIDES'; payload: { mode: 'draft'; settings: Partial<GripSettings> } }
  | { type: 'TOGGLE_LINE_OVERRIDE'; payload: { mode: 'draft' | 'hover' | 'selection' | 'completion'; enabled: boolean } }
  | { type: 'TOGGLE_TEXT_OVERRIDE'; payload: { mode: 'draft'; enabled: boolean } }
  | { type: 'TOGGLE_GRIP_OVERRIDE'; payload: { mode: 'draft'; enabled: boolean } }

  // ===== TEMPLATE SYSTEM ACTIONS (2025-10-06) =====
  | { type: 'APPLY_LINE_TEMPLATE'; payload: { templateName: string; settings: LineSettings } }
  | { type: 'UPDATE_LINE_TEMPLATE_OVERRIDES'; payload: Partial<LineSettings> }
  | { type: 'CLEAR_LINE_TEMPLATE_OVERRIDES' }
  | { type: 'RESET_LINE_TO_FACTORY' };

interface DxfSettingsContextType {
  // State
  settings: DxfSettingsState;

  // ===== EXISTING ACTIONS =====
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  updateRulerSettings: (updates: Partial<RulerSettings>) => void;
  updateCursorSettings: (updates: Partial<CursorSettings>) => void;
  resetToDefaults: () => void;

  // ===== NEW: MODE-BASED ACTIONS (from ConfigurationProvider) =====
  // 🔧 EXTENDED (2025-10-06): Per-mode methods for draft/hover/selection/completion
  setMode: (mode: ViewerMode) => void;
  updateSpecificLineSettings: (mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => void;
  updateSpecificTextSettings: (mode: 'draft', settings: Partial<TextSettings>) => void;
  updateSpecificGripSettings: (mode: 'draft', settings: Partial<GripSettings>) => void;
  updateLineOverrides: (mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => void;
  updateTextOverrides: (mode: 'draft', settings: Partial<TextSettings>) => void;
  updateGripOverrides: (mode: 'draft', settings: Partial<GripSettings>) => void;
  toggleLineOverride: (mode: 'draft' | 'hover' | 'selection' | 'completion', enabled: boolean) => void;
  toggleTextOverride: (mode: 'draft', enabled: boolean) => void;
  toggleGripOverride: (mode: 'draft', enabled: boolean) => void;

  // ===== NEW: EFFECTIVE SETTINGS CALCULATION (from ConfigurationProvider) =====
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;

  // ===== TEMPLATE SYSTEM METHODS (2025-10-06) =====
  applyLineTemplate: (templateName: string, templateSettings: LineSettings) => void;
  updateLineTemplateOverrides: (overrides: Partial<LineSettings>) => void;
  clearLineTemplateOverrides: () => void;
  resetLineToFactory: () => void;

  // Computed
  isAutoSaving: boolean;
  hasUnsavedChanges: boolean;
  // 🆕 MIGRATION UTILITIES: Εργαλεία για migration diagnostics και manual triggers
  migrationUtils: {
    getDiagnostics: () => ReturnType<typeof getMigrationDiagnostics>;
    triggerMigration: () => ReturnType<typeof performComprehensiveMigration>;
    cleanupLegacy: () => void;
  };
}

// ===== DEFAULT SETTINGS =====

const defaultLineSettings: LineSettings = {
  enabled: true,               // Default: γραμμές ενεργοποιημένες
  lineType: 'solid',           // ✅ ISO 128: Continuous line as default
  lineWidth: 0.25,             // ✅ ISO 128: Standard 0.25mm line weight
  color: '#FFFFFF',            // ✅ AutoCAD ACI 7: White for main lines
  opacity: 1.0,                // ✅ Full opacity standard
  dashScale: 1.0,              // ✅ Standard dash scale
  dashOffset: 0,               // ✅ No offset standard
  lineCap: 'round',            // ✅ Round caps standard
  lineJoin: 'round',           // ✅ Round joins standard
  breakAtCenter: false,        // ✅ No break at center default
  hoverColor: '#FFFF00',       // ✅ AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',          // ✅ Solid hover type
  hoverWidth: 0.35,            // ✅ ISO 128: Next standard width
  hoverOpacity: 0.8,           // ✅ Reduced opacity for hover
  finalColor: '#00FF00',       // ✅ AutoCAD ACI 3: Green for final state
  finalType: 'solid',          // ✅ Solid final type
  finalWidth: 0.35,            // ✅ ISO 128: Slightly thicker for final
  finalOpacity: 1.0,           // ✅ Full opacity for final
  activeTemplate: null,        // ✅ No active template default
};

const defaultTextSettings: TextSettings = {
  enabled: true,               // Default: κείμενο ενεργοποιημένο
  fontFamily: 'Arial, sans-serif', // ✅ ISO 3098: Sans-serif font recommended
  fontSize: 2.5,               // ✅ ISO 3098: Standard 2.5mm text height
  color: '#FFFFFF',            // ✅ AutoCAD ACI 7: White for text
  isBold: false,               // ✅ ISO 3098: Normal weight default
  isItalic: false,             // ✅ ISO 3098: Upright text default
  isUnderline: false,          // ✅ ISO 3098: No underline default
  isStrikethrough: false,      // ✅ ISO 3098: No strikethrough default
  isSuperscript: false,        // ✅ ISO 3098: Normal script default
  isSubscript: false           // ✅ ISO 3098: Normal script default
};

const defaultGripSettings: GripSettings = {
  enabled: true,            // ✅ Enable grip system by default
  showGrips: true,          // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση grips
  gripSize: 5,              // ✅ AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,           // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,         // ✅ AutoCAD APERTURE default: 10 pixels
  showAperture: true,       // ✅ AutoCAD APBOX default: enabled
  colors: {
    cold: '#0000FF',        // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',        // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',         // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: '#000000'      // ✅ AutoCAD standard: Black contour
  },
  multiGripEdit: true,      // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση multi grips
  snapToGrips: true,        // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση snap to grips
  showGripTips: false,      // ✅ Default: no grip tips
  dpiScale: 1.0,            // ✅ Standard DPI scale
  showMidpoints: true,      // ✅ Show midpoint grips
  showCenters: true,        // ✅ Show center grips
  showQuadrants: true,      // ✅ Show quadrant grips
  maxGripsPerEntity: 50,    // ✅ Default maximum grips per entity
  opacity: 1.0              // ✅ Full opacity by default
};

const initialState: DxfSettingsState = {
  // ===== EXISTING GENERAL SETTINGS =====
  line: defaultLineSettings,
  text: defaultTextSettings,
  grip: defaultGripSettings,
  grid: DEFAULT_GRID_SETTINGS,
  ruler: DEFAULT_RULER_SETTINGS,
  cursor: DEFAULT_CURSOR_SETTINGS,

  // ===== NEW: MODE-BASED SETTINGS (from ConfigurationProvider) =====
  mode: 'normal',  // 🆕 MERGE: Default mode is 'normal'
  specific: {      // 🆕 MERGE: Specific settings per mode (CAD enterprise standard)
    line: {
      // 🆕 Προσχεδίαση (Draft) - First click, temporary line
      draft: {
        lineType: 'dashed',
        color: '#FFFF00',    // ✅ AutoCAD ACI 2: Yellow for draft
        opacity: 0.7,
        lineWidth: 0.25
      },
      // 🆕 Αιώρηση (Hover) - Mouse over entity
      hover: {
        lineType: 'solid',
        color: '#FF8C00',    // ✅ AutoCAD: Orange for hover
        opacity: 0.8,
        lineWidth: 0.35
      },
      // 🆕 Επιλογή (Selection) - Entity selected
      selection: {
        lineType: 'solid',
        color: '#00BFFF',    // ✅ AutoCAD: Light blue for selection
        opacity: 1.0,
        lineWidth: 0.35
      },
      // ✅ Ολοκλήρωση (Completion) - Final entity state
      completion: {
        lineType: 'solid',
        color: '#00FF00',    // ✅ AutoCAD ACI 3: Green for completion
        opacity: 1.0,
        lineWidth: 0.25
      }
    },
    text: {
      // 🆕 Προσχεδίαση (Draft) - Temporary text
      draft: {
        color: '#FFFF00',    // ✅ Yellow for text draft
        opacity: 0.8,
        fontSize: 2.5
      }
    },
    grip: {
      // 🆕 Προσχεδίαση (Draft) - Grips during drawing
      draft: {
        colors: {
          cold: '#0000FF',   // ✅ Blue - unselected
          warm: '#FF69B4',   // ✅ Hot Pink - hover
          hot: '#FF0000',    // ✅ Red - selected
          contour: '#000000' // ✅ Black contour
        },
        gripSize: 8,
        showGrips: true,
        opacity: 0.9
      }
    }
  },
  overrides: {     // 🆕 MERGE: User overrides (empty by default)
    line: {
      draft: {},
      hover: {},
      selection: {},
      completion: {}
    },
    text: {
      draft: {}
    },
    grip: {
      draft: {}
    }
  },
  overrideEnabled: { // 🆕 MERGE: Per-mode override flags (disabled by default)
    line: {
      draft: false,
      hover: false,
      selection: false,
      completion: false
    },
    text: {
      draft: false
    },
    grip: {
      draft: false
    }
  },

  // ===== TEMPLATE SYSTEM (2025-10-06) =====
  templateOverrides: {  // 🆕 User customizations on templates (empty by default)
    line: undefined,
    text: undefined,
    grip: undefined
  },
  activeTemplates: {    // 🆕 Currently selected templates (none by default)
    line: null,
    text: null,
    grip: null
  },

  // ===== EXISTING META =====
  isLoaded: false,
  lastSaved: null,
  saveStatus: 'idle'
};

// ===== REDUCER =====

function settingsReducer(state: DxfSettingsState, action: SettingsAction): DxfSettingsState {
  switch (action.type) {
    case 'LOAD_ALL_SETTINGS':
      return {
        ...state,
        ...action.payload,
        isLoaded: true
      };

    case 'UPDATE_LINE_SETTINGS':
      return {
        ...state,
        line: { ...state.line, ...action.payload }
      };

    case 'UPDATE_TEXT_SETTINGS':
      return {
        ...state,
        text: { ...state.text, ...action.payload }
      };

    case 'UPDATE_GRIP_SETTINGS':
      return {
        ...state,
        grip: { ...state.grip, ...action.payload }
      };

    case 'UPDATE_GRID_SETTINGS':    // 🆕 ΠΡΟΣΘΗΚΗ: Grid reducer case
      return {
        ...state,
        grid: { ...state.grid, ...action.payload }
      };

    case 'UPDATE_RULER_SETTINGS':   // 🆕 ΠΡΟΣΘΗΚΗ: Ruler reducer case
      return {
        ...state,
        ruler: { ...state.ruler, ...action.payload }
      };

    case 'UPDATE_CURSOR_SETTINGS':  // 🆕 ΠΡΟΣΘΗΚΗ: Cursor reducer case
      return {
        ...state,
        cursor: { ...state.cursor, ...action.payload }
      };

    case 'SET_SAVE_STATUS':
      return {
        ...state,
        saveStatus: action.payload
      };

    case 'MARK_SAVED':
      return {
        ...state,
        lastSaved: action.payload,
        saveStatus: 'saved'
      };

    case 'RESET_TO_DEFAULTS':
      return {
        ...state,
        line: defaultLineSettings,
        text: defaultTextSettings,
        grip: defaultGripSettings,
        grid: DEFAULT_GRID_SETTINGS,
        ruler: DEFAULT_RULER_SETTINGS,
        cursor: DEFAULT_CURSOR_SETTINGS
      };

    // ===== NEW: MODE-BASED REDUCER CASES (from ConfigurationProvider) =====

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload
      };

    case 'UPDATE_SPECIFIC_LINE_SETTINGS':
      return {
        ...state,
        specific: {
          ...state.specific,
          line: {
            ...state.specific.line,
            [action.payload.mode]: {
              ...state.specific.line[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'UPDATE_SPECIFIC_TEXT_SETTINGS':
      return {
        ...state,
        specific: {
          ...state.specific,
          text: {
            ...state.specific.text,
            [action.payload.mode]: {
              ...state.specific.text[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'UPDATE_SPECIFIC_GRIP_SETTINGS':
      return {
        ...state,
        specific: {
          ...state.specific,
          grip: {
            ...state.specific.grip,
            [action.payload.mode]: {
              ...state.specific.grip[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'UPDATE_LINE_OVERRIDES':
      return {
        ...state,
        overrides: {
          ...state.overrides,
          line: {
            ...state.overrides.line,
            [action.payload.mode]: {
              ...state.overrides.line[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'UPDATE_TEXT_OVERRIDES':
      return {
        ...state,
        overrides: {
          ...state.overrides,
          text: {
            ...state.overrides.text,
            [action.payload.mode]: {
              ...state.overrides.text[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'UPDATE_GRIP_OVERRIDES':
      return {
        ...state,
        overrides: {
          ...state.overrides,
          grip: {
            ...state.overrides.grip,
            [action.payload.mode]: {
              ...state.overrides.grip[action.payload.mode],
              ...action.payload.settings
            }
          }
        }
      };

    case 'TOGGLE_LINE_OVERRIDE':
      // 🔧 FIXED (2025-10-06): Per-mode override toggle for line
      return {
        ...state,
        overrideEnabled: {
          ...state.overrideEnabled,
          line: {
            ...state.overrideEnabled.line,
            [action.payload.mode]: action.payload.enabled
          }
        }
      };

    case 'TOGGLE_TEXT_OVERRIDE':
      // 🔧 FIXED (2025-10-06): Per-mode override toggle for text
      return {
        ...state,
        overrideEnabled: {
          ...state.overrideEnabled,
          text: {
            ...state.overrideEnabled.text,
            [action.payload.mode]: action.payload.enabled
          }
        }
      };

    case 'TOGGLE_GRIP_OVERRIDE':
      // 🔧 FIXED (2025-10-06): Per-mode override toggle for grip
      return {
        ...state,
        overrideEnabled: {
          ...state.overrideEnabled,
          grip: {
            ...state.overrideEnabled.grip,
            [action.payload.mode]: action.payload.enabled
          }
        }
      };

    // ===== TEMPLATE SYSTEM REDUCER CASES (2025-10-06) =====

    case 'APPLY_LINE_TEMPLATE':
      return {
        ...state,
        line: action.payload.settings,  // Apply template as base
        activeTemplates: {
          ...state.activeTemplates,
          line: action.payload.templateName  // Track active template
        },
        saveStatus: 'idle'  // Mark as unsaved
      };

    case 'UPDATE_LINE_TEMPLATE_OVERRIDES':
      return {
        ...state,
        templateOverrides: {
          ...state.templateOverrides,
          line: {
            ...state.templateOverrides.line,
            ...action.payload  // Merge user overrides
          }
        },
        saveStatus: 'idle'  // Mark as unsaved
      };

    case 'CLEAR_LINE_TEMPLATE_OVERRIDES':
      return {
        ...state,
        templateOverrides: {
          ...state.templateOverrides,
          line: undefined  // Clear all overrides
        },
        saveStatus: 'idle'
      };

    case 'RESET_LINE_TO_FACTORY':
      return {
        ...state,
        line: defaultLineSettings,  // Reset to factory defaults
        templateOverrides: {
          ...state.templateOverrides,
          line: undefined  // Clear overrides
        },
        activeTemplates: {
          ...state.activeTemplates,
          line: null  // Clear template selection
        },
        saveStatus: 'idle'
      };

    default:
      return state;
  }
}

// ===== PERSISTENCE UTILITIES =====

const STORAGE_KEYS = {
  line: 'dxf-line-general-settings',
  text: 'dxf-text-general-settings',
  grip: 'dxf-grip-general-settings',
  grid: 'dxf-grid-specific-settings',     // 🆕 ΠΡΟΣΘΗΚΗ: Grid storage key
  ruler: 'dxf-ruler-specific-settings',   // 🆕 ΠΡΟΣΘΗΚΗ: Ruler storage key
  cursor: 'dxf-cursor-specific-settings', // 🆕 ΠΡΟΣΘΗΚΗ: Cursor storage key (will migrate from 'autocad_cursor_settings')
  templateOverrides: 'dxf-template-overrides',  // 🆕 TEMPLATE SYSTEM: User overrides
  activeTemplates: 'dxf-active-templates'       // 🆕 TEMPLATE SYSTEM: Selected templates
} as const;

// ✅ ΔΙΕΘΝΗ ΠΡΟΤΥΠΑ VERSION - αν αλλάξει αυτό, τα παλιά localStorage settings θα επανεγκατασταθούν
const INTERNATIONAL_STANDARDS_VERSION = '2024.09.21-ISO-AutoCAD-v3.0-GRIP-COLORS-FIXED';

// 🆕 MIGRATION SUPPORT: Παλιά storage keys που χρειάζονται migration
const LEGACY_STORAGE_KEYS = {
  cursor: 'autocad_cursor_settings',
  // Μελλοντική επέκταση για άλλα legacy keys
  grid: 'old-grid-settings-key',
  rulers: 'old-rulers-settings-key'
} as const;

// 🆕 MIGRATION UTILITIES
interface MigrationResult {
  success: boolean;
  data?: any;
  source: string;
  error?: string;
}

/**
 * 🔄 MIGRATION: Γενική function για migration από παλιά keys
 */
function attemptMigrationFromLegacyKey(
  legacyKey: string,
  settingsType: keyof typeof STORAGE_KEYS,
  defaultSettings: any
): MigrationResult {
  try {
    const legacyData = localStorage.getItem(legacyKey);
    if (!legacyData) {
      return { success: false, source: 'no-legacy-data' };
    }

    const parsed = JSON.parse(legacyData);
    const migratedData = { ...defaultSettings, ...parsed };

    // Αυτόματη αποθήκευση στο νέο key με metadata
    const timestamp = Date.now();
    const dataWithMetadata = {
      ...migratedData,
      __autosave_timestamp: timestamp,
      __autosave_key: STORAGE_KEYS[settingsType],
      __standards_version: INTERNATIONAL_STANDARDS_VERSION,
      __migration_source: legacyKey // Tracking migration source
    };

    localStorage.setItem(STORAGE_KEYS[settingsType], JSON.stringify(dataWithMetadata));

    return {
      success: true,
      data: migratedData,
      source: legacyKey
    };

  } catch (error) {
    const errorMsg = `Αδυναμία migration ${settingsType} από ${legacyKey}`;
    console.warn(`⚠️ [DxfSettings] ${errorMsg}:`, error);
    return {
      success: false,
      source: legacyKey,
      error: errorMsg
    };
  }
}

/**
 * 🔄 COMPREHENSIVE MIGRATION: Ελέγχει και μεταφέρει όλα τα legacy settings
 */
function performComprehensiveMigration(): { [key: string]: MigrationResult } {
  const migrationResults: { [key: string]: MigrationResult } = {};

  // Migration για cursor settings
  if (LEGACY_STORAGE_KEYS.cursor) {
    migrationResults.cursor = attemptMigrationFromLegacyKey(
      LEGACY_STORAGE_KEYS.cursor,
      'cursor',
      DEFAULT_CURSOR_SETTINGS
    );
  }

  // Εδώ μπορούν να προστεθούν άλλα migrations στο μέλλον
  // migrationResults.grid = attemptMigrationFromLegacyKey(...);
  // migrationResults.rulers = attemptMigrationFromLegacyKey(...);

  return migrationResults;
}

/**
 * 🧹 CLEANUP: Διαγραφή παλιών legacy keys μετά από επιτυχημένη migration
 */
function cleanupLegacyKeys(): void {
  const keysToRemove: string[] = [];

  Object.entries(LEGACY_STORAGE_KEYS).forEach(([settingsType, legacyKey]) => {
    if (localStorage.getItem(legacyKey) && localStorage.getItem(STORAGE_KEYS[settingsType as keyof typeof STORAGE_KEYS])) {
      keysToRemove.push(legacyKey);
    }
  });

  if (keysToRemove.length > 0) {
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);

    });

  }
}

/**
 * 🔍 DIAGNOSTIC: Εξέταση κατάστασης migration
 */
function getMigrationDiagnostics(): { [key: string]: { hasNew: boolean; hasLegacy: boolean; needsMigration: boolean } } {
  const diagnostics: { [key: string]: { hasNew: boolean; hasLegacy: boolean; needsMigration: boolean } } = {};

  Object.entries(LEGACY_STORAGE_KEYS).forEach(([settingsType, legacyKey]) => {
    const hasNew = !!localStorage.getItem(STORAGE_KEYS[settingsType as keyof typeof STORAGE_KEYS]);
    const hasLegacy = !!localStorage.getItem(legacyKey);
    const needsMigration = !hasNew && hasLegacy;

    diagnostics[settingsType] = { hasNew, hasLegacy, needsMigration };
  });

  return diagnostics;
}

function loadAllSettings(): Partial<DxfSettingsState> {
  try {
    console.log('🔍 [DEBUG] loadAllSettings started - checking localStorage...');

    // 🔄 ΠΡΩΤΑ: Εκτέλεση comprehensive migration για legacy settings
    const migrationResults = performComprehensiveMigration();
    let migrationOccurred = false;

    // Logging migration results
    Object.entries(migrationResults).forEach(([settingsType, result]) => {
      if (result.success) {
        migrationOccurred = true;

      } else if (result.error) {
        console.warn(`⚠️ [DxfSettings] Αποτυχία migration ${settingsType}: ${result.error}`);
      }
    });

    const line = localStorage.getItem(STORAGE_KEYS.line);
    const text = localStorage.getItem(STORAGE_KEYS.text);
    const grip = localStorage.getItem(STORAGE_KEYS.grip);
    const grid = localStorage.getItem(STORAGE_KEYS.grid);     // 🆕 ΠΡΟΣΘΗΚΗ: Grid loading
    const ruler = localStorage.getItem(STORAGE_KEYS.ruler);   // 🆕 ΠΡΟΣΘΗΚΗ: Ruler loading
    const cursor = localStorage.getItem(STORAGE_KEYS.cursor); // 🆕 ΠΡΟΣΘΗΚΗ: Cursor loading (μετά τη migration)

    console.log('🔍 [DEBUG] localStorage keys found:', {
      line: !!line,
      text: !!text,
      grip: !!grip,
      grid: !!grid,
      ruler: !!ruler,
      cursor: !!cursor
    });

    const result: Partial<DxfSettingsState> = {};

    // ✅ ΕΛΕΓΧΟΣ VERSION - αν τα αποθηκευμένα δεδομένα δεν έχουν το σωστό version, χρησιμοποίησε defaults
    if (line) {
      const parsed = JSON.parse(line);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      console.log('🔍 [DEBUG] Line settings version check:', {
        saved: __standards_version,
        expected: INTERNATIONAL_STANDARDS_VERSION,
        match: __standards_version === INTERNATIONAL_STANDARDS_VERSION
      });

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.line = { ...defaultLineSettings, ...actualData };
        console.log('✅ [DEBUG] Line settings loaded from localStorage');
      } else {
        console.warn('⚠️ [DEBUG] Line settings version mismatch - using defaults');
        result.line = defaultLineSettings;
      }
    }

    if (text) {
      const parsed = JSON.parse(text);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.text = { ...defaultTextSettings, ...actualData };
      } else {

        result.text = defaultTextSettings;
      }
    }

    if (grip) {
      const parsed = JSON.parse(grip);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.grip = { ...defaultGripSettings, ...actualData };
      } else {

        result.grip = defaultGripSettings;
      }
    }

    // 🆕 ΠΡΟΣΘΗΚΗ: Grid Settings Loading
    if (grid) {
      const parsed = JSON.parse(grid);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.grid = { ...DEFAULT_GRID_SETTINGS, ...actualData };
      } else {

        result.grid = DEFAULT_GRID_SETTINGS;
      }
    }

    // 🆕 ΠΡΟΣΘΗΚΗ: Ruler Settings Loading
    if (ruler) {
      const parsed = JSON.parse(ruler);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.ruler = { ...DEFAULT_RULER_SETTINGS, ...actualData };
      } else {

        result.ruler = DEFAULT_RULER_SETTINGS;
      }
    }

    // 🆕 ΠΡΟΣΘΗΚΗ: Cursor Settings Loading (με unified migration support)
    if (cursor) {
      const parsed = JSON.parse(cursor);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.cursor = { ...DEFAULT_CURSOR_SETTINGS, ...actualData };
      } else {

        result.cursor = DEFAULT_CURSOR_SETTINGS;
      }
    } else {
      // Χρησιμοποίησε το migration result αν διαθέσιμο, αλλιώς defaults
      if (migrationResults.cursor && migrationResults.cursor.success) {
        result.cursor = migrationResults.cursor.data;
      } else {
        result.cursor = DEFAULT_CURSOR_SETTINGS;
      }
    }

    // 🆕 TEMPLATE SYSTEM: Load templateOverrides
    const templateOverridesStr = localStorage.getItem(STORAGE_KEYS.templateOverrides);
    if (templateOverridesStr) {
      try {
        const parsed = JSON.parse(templateOverridesStr);
        const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

        if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
          result.templateOverrides = actualData;
          console.log('✅ [DEBUG] Template overrides loaded from localStorage');
        } else {
          console.warn('⚠️ [DEBUG] Template overrides version mismatch - using empty');
          result.templateOverrides = { line: undefined, text: undefined, grip: undefined };
        }
      } catch (e) {
        console.error('❌ [DEBUG] Failed to parse templateOverrides:', e);
        result.templateOverrides = { line: undefined, text: undefined, grip: undefined };
      }
    }

    // 🆕 TEMPLATE SYSTEM: Load activeTemplates
    const activeTemplatesStr = localStorage.getItem(STORAGE_KEYS.activeTemplates);
    if (activeTemplatesStr) {
      try {
        const parsed = JSON.parse(activeTemplatesStr);
        const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

        if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
          result.activeTemplates = actualData;
          console.log('✅ [DEBUG] Active templates loaded from localStorage');
        } else {
          console.warn('⚠️ [DEBUG] Active templates version mismatch - using null');
          result.activeTemplates = { line: null, text: null, grip: null };
        }
      } catch (e) {
        console.error('❌ [DEBUG] Failed to parse activeTemplates:', e);
        result.activeTemplates = { line: null, text: null, grip: null };
      }
    }

    // 🆕 ENHANCED LOGGING & CLEANUP: Migration summary με automatic cleanup
    if (migrationOccurred) {

      // Αυτόματη διαγραφή των legacy keys μετά από επιτυχημένη migration
      setTimeout(() => {
        cleanupLegacyKeys();
      }, 1000); // 1 δευτερόλεπτο delay για safety
    } else {

    }

    return result;

  } catch (error) {
    console.error('❌ [DxfSettings] Σφάλμα φόρτωσης ρυθμίσεων:', error);
    return {};
  }
}

function saveAllSettings(settings: Pick<DxfSettingsState, 'line' | 'text' | 'grip' | 'grid' | 'ruler' | 'cursor' | 'templateOverrides' | 'activeTemplates'>) {
  try {
    const timestamp = Date.now();
    console.log('🔍 [DEBUG] saveAllSettings called with keys:', Object.keys(settings));

    // Save basic settings (line, text, grip, grid, ruler, cursor)
    ['line', 'text', 'grip', 'grid', 'ruler', 'cursor'].forEach((key) => {
      const storageKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
      const data = settings[key as keyof typeof settings];

      // 🚨 DEBUG: Check if data exists
      if (!data) {
        console.warn(`⚠️ [DxfSettings] Missing data for ${key}, skipping...`);
        return; // Skip this iteration
      }

      const dataWithMetadata = {
        ...data,
        __autosave_timestamp: timestamp,
        __autosave_key: storageKey,
        __standards_version: INTERNATIONAL_STANDARDS_VERSION
      };

      console.log(`🔍 [DEBUG] Writing to localStorage:`, {
        key: storageKey,
        dataSize: JSON.stringify(dataWithMetadata).length,
        hasData: !!data
      });

      localStorage.setItem(storageKey, JSON.stringify(dataWithMetadata));

      // 🔍 Verify write immediately
      const readBack = localStorage.getItem(storageKey);
      console.log(`🔍 [DEBUG] Verified write for ${storageKey}:`, readBack ? '✅ Success' : '❌ Failed');
    });

    // 🆕 TEMPLATE SYSTEM: Save templateOverrides
    if (settings.templateOverrides) {
      const overridesWithMetadata = {
        ...settings.templateOverrides,
        __autosave_timestamp: timestamp,
        __autosave_key: STORAGE_KEYS.templateOverrides,
        __standards_version: INTERNATIONAL_STANDARDS_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.templateOverrides, JSON.stringify(overridesWithMetadata));
      console.log(`🔍 [DEBUG] Saved templateOverrides to localStorage`);
    }

    // 🆕 TEMPLATE SYSTEM: Save activeTemplates
    if (settings.activeTemplates) {
      const templatesWithMetadata = {
        ...settings.activeTemplates,
        __autosave_timestamp: timestamp,
        __autosave_key: STORAGE_KEYS.activeTemplates,
        __standards_version: INTERNATIONAL_STANDARDS_VERSION
      };
      localStorage.setItem(STORAGE_KEYS.activeTemplates, JSON.stringify(templatesWithMetadata));
      console.log(`🔍 [DEBUG] Saved activeTemplates to localStorage`);
    }

    return true;

  } catch (error) {
    console.error('❌ [DxfSettings] Σφάλμα αποθήκευσης:', error);
    return false;
  }
}

// ===== CONTEXT =====

const DxfSettingsContext = createContext<DxfSettingsContextType | null>(null);

// ===== PROVIDER =====

export function DxfSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, initialState);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout>();

  // ===== PREVIEW SETTINGS INTEGRATION =====
  // 🗑️ REMOVED: useUnifiedLinePreview() - Replaced by getEffectiveLineSettings() method
  // const { settings: linePreviewSettings, getEffectiveLineSettings } = useUnifiedLinePreview();

  // Load settings on mount - ΜΟΝΟ ΜΙΑ ΦΟΡΑ
  useEffect(() => {
    if (!state.isLoaded) {

      const savedSettings = loadAllSettings();

      // 🚨 FORCE DEFAULT SETTINGS: Εξασφάλιση ότι όλα τα settings υπάρχουν
      const completeSettings = {
        line: savedSettings.line || defaultLineSettings,
        text: savedSettings.text || defaultTextSettings,
        grip: savedSettings.grip || defaultGripSettings,
        cursor: savedSettings.cursor || DEFAULT_CURSOR_SETTINGS,
        grid: savedSettings.grid || DEFAULT_GRID_SETTINGS,
        ruler: savedSettings.ruler || DEFAULT_RULER_SETTINGS,
        isLoaded: true,
        lastSaved: null,
        saveStatus: 'idle' as const
      };

      dispatch({ type: 'LOAD_ALL_SETTINGS', payload: completeSettings });
    }
  }, [state.isLoaded]);

  // ✅ ENABLED: Cursor event listener with error handling
  useEffect(() => {
    const handleCursorSettingsUpdate = (event: CustomEvent) => {
      try {
        if (!event.detail) {
          console.warn('[DxfSettingsProvider] Cursor event missing detail');
          return;
        }

        const { cursorSettings, source, timestamp } = event.detail;
        if (!cursorSettings) {
          console.warn('[DxfSettingsProvider] Cursor event missing cursorSettings');
          return;
        }

        dispatch({ type: 'UPDATE_CURSOR_SETTINGS', payload: cursorSettings });
      } catch (error) {
        console.error('[DxfSettingsProvider] Error handling cursor settings update:', error);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dxf-cursor-settings-update', handleCursorSettingsUpdate as EventListener);

    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dxf-cursor-settings-update', handleCursorSettingsUpdate as EventListener);

      }
    };
  }, []);

  // 🚨 DISABLED: Grid event listener causing infinite loops
  useEffect(() => {

    // const handleGridSettingsUpdate = (event: CustomEvent) => {
    //   const { gridSettings, source, timestamp } = event.detail;

    //   dispatch({ type: 'UPDATE_GRID_SETTINGS', payload: gridSettings });
    // };
    // if (typeof window !== 'undefined') {
    //   window.addEventListener('dxf-grid-settings-update', handleGridSettingsUpdate as EventListener);

    // }
    // return () => {
    //   if (typeof window !== 'undefined') {
    //     window.removeEventListener('dxf-grid-settings-update', handleGridSettingsUpdate as EventListener);

    //   }
    // };
  }, []);

  // 🚨 DISABLED: Ruler event listener causing infinite loops
  useEffect(() => {

    // const handleRulerSettingsUpdate = (event: CustomEvent) => {
    //   const { rulerSettings, source, timestamp } = event.detail;

    //   dispatch({ type: 'UPDATE_RULER_SETTINGS', payload: rulerSettings });
    // };
    // if (typeof window !== 'undefined') {
    //   window.addEventListener('dxf-ruler-settings-update', handleRulerSettingsUpdate as EventListener);

    // }
    // return () => {
    //   if (typeof window !== 'undefined') {
    //     window.removeEventListener('dxf-ruler-settings-update', handleRulerSettingsUpdate as EventListener);

    //   }
    // };
  }, []);

  // 🚨 DISABLED: Bidirectional sync causing infinite loops
  // useEffect(() => {
  //   if (state.isLoaded && state.cursor) {
  //     const cursorSyncEvent = new CustomEvent('dxf-provider-cursor-sync', {
  //       detail: { cursorSettings: state.cursor, source: 'DxfSettingsProvider', timestamp: Date.now() }
  //     });
  //     setTimeout(() => {
  //       if (typeof window !== 'undefined') {
  //         window.dispatchEvent(cursorSyncEvent);
  //       }
  //     }, 10);
  //   }
  // }, [state.cursor, state.isLoaded]);

  // 🚨 DISABLED: Grid sync causing infinite loops
  // useEffect(() => {
  //   if (state.isLoaded && state.grid) {
  //     const gridSyncEvent = new CustomEvent('dxf-provider-grid-sync', {
  //       detail: { gridSettings: state.grid, source: 'DxfSettingsProvider', timestamp: Date.now() }
  //     });
  //     setTimeout(() => {
  //       if (typeof window !== 'undefined') {
  //         window.dispatchEvent(gridSyncEvent);
  //       }
  //     }, 10);
  //   }
  // }, [state.grid, state.isLoaded]);

  // 🚨 DISABLED: Ruler sync causing infinite loops
  // useEffect(() => {
  //   if (state.isLoaded && state.ruler) {
  //     const rulerSyncEvent = new CustomEvent('dxf-provider-ruler-sync', {
  //       detail: { rulerSettings: state.ruler, source: 'DxfSettingsProvider', timestamp: Date.now() }
  //     });
  //     setTimeout(() => {
  //       if (typeof window !== 'undefined') {
  //         window.dispatchEvent(rulerSyncEvent);
  //       }
  //     }, 10);
  //   }
  // }, [state.ruler, state.isLoaded]);

  // ✅ AUTO-SAVE RE-ENABLED: Fixed infinite loop by using useRef for tracking
  const settingsRef = React.useRef(state);

  // Update ref when settings change (doesn't trigger re-render)
  useEffect(() => {
    settingsRef.current = state;
  }, [state]);

  // Auto-save function with 500ms debouncing
  useEffect(() => {
    if (!state.isLoaded) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving status (optimistic)
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });

    // Debounced save (500ms)
    saveTimeoutRef.current = setTimeout(() => {
      console.log('💾 [DxfSettings] Auto-saving settings...');

      const success = saveAllSettings({
        line: settingsRef.current.line,
        text: settingsRef.current.text,
        grip: settingsRef.current.grip,
        grid: settingsRef.current.grid,
        ruler: settingsRef.current.ruler,
        cursor: settingsRef.current.cursor,
        templateOverrides: settingsRef.current.templateOverrides,  // 🆕 TEMPLATE SYSTEM
        activeTemplates: settingsRef.current.activeTemplates       // 🆕 TEMPLATE SYSTEM
      });

      if (success) {
        console.log('✅ [DxfSettings] Auto-save successful');
        dispatch({ type: 'MARK_SAVED', payload: new Date() });
        // Reset to idle after 1 second
        setTimeout(() => {
          dispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
        }, 1000);
      } else {
        console.error('❌ [DxfSettings] Auto-save failed');
        dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
      }
    }, 500);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state.line, state.text, state.grip, state.grid, state.ruler, state.cursor, state.isLoaded]);

  // 🚨 REMOVED DUPLICATE: This was causing infinite save loop

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Actions
  const updateLineSettings = useCallback((updates: Partial<LineSettings>) => {
    dispatch({ type: 'UPDATE_LINE_SETTINGS', payload: updates });
  }, []);

  const updateTextSettings = useCallback((updates: Partial<TextSettings>) => {
    dispatch({ type: 'UPDATE_TEXT_SETTINGS', payload: updates });
  }, []);

  const updateGripSettings = useCallback((updates: Partial<GripSettings>) => {
    dispatch({ type: 'UPDATE_GRIP_SETTINGS', payload: updates });
  }, []);

  const updateGridSettings = useCallback((updates: Partial<GridSettings>) => {   // 🆕 ΠΡΟΣΘΗΚΗ: Grid update method
    dispatch({ type: 'UPDATE_GRID_SETTINGS', payload: updates });
  }, []);

  const updateRulerSettings = useCallback((updates: Partial<RulerSettings>) => { // 🆕 ΠΡΟΣΘΗΚΗ: Ruler update method
    dispatch({ type: 'UPDATE_RULER_SETTINGS', payload: updates });
  }, []);

  const updateCursorSettings = useCallback((updates: Partial<CursorSettings>) => { // 🆕 ΠΡΟΣΘΗΚΗ: Cursor update method
    dispatch({ type: 'UPDATE_CURSOR_SETTINGS', payload: updates });
  }, []);

  const resetToDefaults = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEFAULTS' });
  }, []);

  // ===== NEW: MODE-BASED METHODS (from ConfigurationProvider) =====

  const setMode = useCallback((mode: ViewerMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  // 🔧 FIXED (2025-10-06): Per-mode specific settings methods
  const updateSpecificLineSettings = useCallback((mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => {
    dispatch({ type: 'UPDATE_SPECIFIC_LINE_SETTINGS', payload: { mode, settings } });
  }, []);

  const updateSpecificTextSettings = useCallback((mode: 'draft', settings: Partial<TextSettings>) => {
    dispatch({ type: 'UPDATE_SPECIFIC_TEXT_SETTINGS', payload: { mode, settings } });
  }, []);

  const updateSpecificGripSettings = useCallback((mode: 'draft', settings: Partial<GripSettings>) => {
    dispatch({ type: 'UPDATE_SPECIFIC_GRIP_SETTINGS', payload: { mode, settings } });
  }, []);

  // 🔧 FIXED (2025-10-06): Per-mode override methods
  const updateLineOverrides = useCallback((mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => {
    dispatch({ type: 'UPDATE_LINE_OVERRIDES', payload: { mode, settings } });
  }, []);

  const updateTextOverrides = useCallback((mode: 'draft', settings: Partial<TextSettings>) => {
    dispatch({ type: 'UPDATE_TEXT_OVERRIDES', payload: { mode, settings } });
  }, []);

  const updateGripOverrides = useCallback((mode: 'draft', settings: Partial<GripSettings>) => {
    dispatch({ type: 'UPDATE_GRIP_OVERRIDES', payload: { mode, settings } });
  }, []);

  // 🔧 FIXED (2025-10-06): Per-mode toggle methods
  const toggleLineOverride = useCallback((mode: 'draft' | 'hover' | 'selection' | 'completion', enabled: boolean) => {
    dispatch({ type: 'TOGGLE_LINE_OVERRIDE', payload: { mode, enabled } });
  }, []);

  const toggleTextOverride = useCallback((mode: 'draft', enabled: boolean) => {
    dispatch({ type: 'TOGGLE_TEXT_OVERRIDE', payload: { mode, enabled } });
  }, []);

  const toggleGripOverride = useCallback((mode: 'draft', enabled: boolean) => {
    dispatch({ type: 'TOGGLE_GRIP_OVERRIDE', payload: { mode, enabled } });
  }, []);

  // ===== TEMPLATE SYSTEM METHODS (2025-10-06) =====

  const applyLineTemplate = useCallback((templateName: string, templateSettings: LineSettings) => {
    console.log('🎨 [Template] Applying template:', templateName);
    dispatch({
      type: 'APPLY_LINE_TEMPLATE',
      payload: { templateName, settings: templateSettings }
    });
  }, []);

  const updateLineTemplateOverrides = useCallback((overrides: Partial<LineSettings>) => {
    console.log('🎨 [Template] Updating user overrides:', overrides);
    dispatch({ type: 'UPDATE_LINE_TEMPLATE_OVERRIDES', payload: overrides });
  }, []);

  const clearLineTemplateOverrides = useCallback(() => {
    console.log('🎨 [Template] Clearing all overrides');
    dispatch({ type: 'CLEAR_LINE_TEMPLATE_OVERRIDES' });
  }, []);

  const resetLineToFactory = useCallback(() => {
    console.log('🏭 [Template] Resetting to factory defaults');
    dispatch({ type: 'RESET_LINE_TO_FACTORY' });
  }, []);

  // ===== NEW: EFFECTIVE SETTINGS CALCULATION (from ConfigurationProvider) =====

  const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
    const currentMode = mode || state.mode;
    let settings = state.line; // Start with general (template base)

    // 🆕 TEMPLATE SYSTEM: Apply user template overrides FIRST (they persist across template changes)
    if (state.templateOverrides.line) {
      settings = { ...settings, ...state.templateOverrides.line };
    }

    // Apply specific settings for current mode
    if (currentMode !== 'normal' && state.specific.line[currentMode]) {
      settings = { ...settings, ...state.specific.line[currentMode] };
    }

    // Apply user overrides if enabled
    if (state.overrideEnabled.line && state.overrides.line[currentMode]) {
      settings = { ...settings, ...state.overrides.line[currentMode] };
    }

    return settings;
  }, [state.mode, state.line, state.specific.line, state.overrides.line, state.overrideEnabled.line, state.templateOverrides.line]);

  const getEffectiveTextSettings = useCallback((mode?: ViewerMode): TextSettings => {
    const currentMode = mode || state.mode;
    let settings = state.text; // Start with general

    // Apply specific settings for current mode
    if (currentMode !== 'normal' && state.specific.text[currentMode]) {
      settings = { ...settings, ...state.specific.text[currentMode] };
    }

    // Apply user overrides if enabled
    if (state.overrideEnabled.text && state.overrides.text[currentMode]) {
      settings = { ...settings, ...state.overrides.text[currentMode] };
    }

    return settings;
  }, [state.mode, state.text, state.specific.text, state.overrides.text, state.overrideEnabled.text]);

  const getEffectiveGripSettings = useCallback((mode?: ViewerMode): GripSettings => {
    const currentMode = mode || state.mode;
    let settings = state.grip; // Start with general

    // Apply specific settings for current mode
    if (currentMode !== 'normal' && state.specific.grip[currentMode]) {
      settings = { ...settings, ...state.specific.grip[currentMode] };
    }

    // Apply user overrides if enabled
    if (state.overrideEnabled.grip && state.overrides.grip[currentMode]) {
      settings = { ...settings, ...state.overrides.grip[currentMode] };
    }

    return settings;
  }, [state.mode, state.grip, state.specific.grip, state.overrides.grip, state.overrideEnabled.grip]);

  // Computed values
  const isAutoSaving = state.saveStatus === 'saving';
  const hasUnsavedChanges = state.saveStatus === 'idle' && state.lastSaved === null;

  // 🆕 MIGRATION UTILITIES: Memoized migration functions
  const migrationUtils = useMemo(() => ({
    getDiagnostics: getMigrationDiagnostics,
    triggerMigration: performComprehensiveMigration,
    cleanupLegacy: cleanupLegacyKeys
  }), []);

  const contextValue = useMemo(() => ({
    settings: state,
    // ===== EXISTING METHODS =====
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    updateGridSettings,
    updateRulerSettings,
    updateCursorSettings,
    resetToDefaults,
    // ===== NEW: MODE-BASED METHODS (from ConfigurationProvider) =====
    setMode,
    updateSpecificLineSettings,
    updateSpecificTextSettings,
    updateSpecificGripSettings,
    updateLineOverrides,
    updateTextOverrides,
    updateGripOverrides,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    // ===== TEMPLATE SYSTEM METHODS (2025-10-06) =====
    applyLineTemplate,
    updateLineTemplateOverrides,
    clearLineTemplateOverrides,
    resetLineToFactory,
    // ===== NEW: EFFECTIVE SETTINGS (from ConfigurationProvider) =====
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings,
    // ===== EXISTING COMPUTED =====
    isAutoSaving,
    hasUnsavedChanges,
    migrationUtils
  }), [
    state,
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    updateGridSettings,
    updateRulerSettings,
    updateCursorSettings,
    resetToDefaults,
    setMode,
    updateSpecificLineSettings,
    updateSpecificTextSettings,
    updateSpecificGripSettings,
    updateLineOverrides,
    updateTextOverrides,
    updateGripOverrides,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    applyLineTemplate,              // 🆕 TEMPLATE SYSTEM (2025-10-06)
    updateLineTemplateOverrides,    // 🆕 TEMPLATE SYSTEM (2025-10-06)
    clearLineTemplateOverrides,     // 🆕 TEMPLATE SYSTEM (2025-10-06)
    resetLineToFactory,             // 🆕 TEMPLATE SYSTEM (2025-10-06)
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings,
    isAutoSaving,
    hasUnsavedChanges,
    migrationUtils
  ]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ TEXTSTYLESTORE =====
  // Συγχρονίζει το textStyleStore με τις ρυθμίσεις από το DxfSettingsProvider
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    const textSettings = state.text;

    // Μετατρέπουμε τις ρυθμίσεις από το DxfSettingsProvider σε format για το textStyleStore
    textStyleStore.set({
      enabled: textSettings.enabled,
      fontFamily: textSettings.fontFamily,
      fontSize: textSettings.fontSize,
      color: textSettings.color,
      fontWeight: textSettings.isBold ? 'bold' : 'normal',
      fontStyle: textSettings.isItalic ? 'italic' : 'normal',
      textDecoration: [
        textSettings.isUnderline ? 'underline' : '',
        textSettings.isStrikethrough ? 'line-through' : ''
      ].filter(Boolean).join(' ') || 'none',
      opacity: 1.0, // Default opacity για preview
      isSuperscript: textSettings.isSuperscript,
      isSubscript: textSettings.isSubscript
    });

  }, [state.text, state.isLoaded]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ TOOLSTYLESTORE =====
  // Συγχρονίζει το toolStyleStore με τις ρυθμίσεις γραμμών (γενικές ή ειδικές)
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    // ✅ MERGE: Χρησιμοποιούμε την κεντρική getEffectiveLineSettings()
    const effectiveLineSettings = getEffectiveLineSettings();
    // const isOverrideActive = state.overrideEnabled.line; // 🗑️ Not used

    // Μετατρέπουμε τις effective ρυθμίσεις σε format για το toolStyleStore
    toolStyleStore.set({
      enabled: effectiveLineSettings.enabled,
      strokeColor: effectiveLineSettings.color,
      lineWidth: effectiveLineSettings.lineWidth,
      opacity: effectiveLineSettings.opacity,
      lineType: effectiveLineSettings.lineType,
      fillColor: '#00000000' // Default transparent fill
    });

  }, [state.line, state.templateOverrides.line, state.isLoaded, state.mode, state.specific.line, state.overrides.line, state.overrideEnabled.line, getEffectiveLineSettings]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ GRID SETTINGS =====
  // Συγχρονίζει το globalGridStore με τις ρυθμίσεις από το DxfSettingsProvider
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    globalGridStore.update(state.grid);

  }, [state.grid, state.isLoaded]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ RULER SETTINGS =====
  // Συγχρονίζει το globalRulerStore με τις ρυθμίσεις από το DxfSettingsProvider
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    globalRulerStore.update(state.ruler);

  }, [state.ruler, state.isLoaded]);

  return (
    <DxfSettingsContext.Provider value={contextValue}>
      {children}
    </DxfSettingsContext.Provider>
  );
}

// ===== HOOK =====

export function useDxfSettings(): DxfSettingsContextType {
  const context = useContext(DxfSettingsContext);
  if (!context) {
    throw new Error('useDxfSettings must be used within a DxfSettingsProvider');
  }
  return context;
}

// ===== UTILITY HOOKS =====

// ===== CENTRALIZED ERROR HANDLING =====
function useDxfSettingsSafe() {
  try {
    return useDxfSettings();
  } catch (error) {
    return null;
  }
}


export function useLineSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    const getCurrentDashPattern = () => {
      return getDashArray(defaultLineSettings.lineType, defaultLineSettings.dashScale);
    };

    return {
      settings: defaultLineSettings,
      updateSettings: () => {},
      resetToDefaults: () => {},
      resetToFactory: () => {},  // 🆕 TEMPLATE SYSTEM: Factory reset
      getCurrentDashPattern,
      applyTemplate: () => {}
    };
  }

  const { settings, updateLineSettings, applyLineTemplate, updateLineTemplateOverrides, resetLineToFactory, getEffectiveLineSettings } = dxfSettings;

  // 🆕 TEMPLATE SYSTEM: Get effective settings (template base + template overrides)
  const effectiveLineSettings = getEffectiveLineSettings();

  const getCurrentDashPattern = () => {
    return getDashArray(effectiveLineSettings.lineType, effectiveLineSettings.dashScale);
  };

  const applyTemplate = (template: LineTemplate) => {
    console.log('🎨 [Template Hook] Applying template:', template.name);
    // Templates have settings nested inside - use template.settings
    const templateSettings = template.settings || template;

    // 🆕 TEMPLATE SYSTEM: Use new applyLineTemplate action (tracks template, resets overrides)
    applyLineTemplate(template.name, {
      lineType: templateSettings.lineType,
      lineWidth: templateSettings.lineWidth,
      color: templateSettings.color,
      opacity: templateSettings.opacity,
      dashScale: templateSettings.dashScale,
      dashOffset: templateSettings.dashOffset,
      lineCap: templateSettings.lineCap,
      lineJoin: templateSettings.lineJoin,
      breakAtCenter: templateSettings.breakAtCenter,
      // Copy remaining fields from template or use defaults
      enabled: templateSettings.enabled ?? true,
      hoverColor: templateSettings.hoverColor ?? '#FFFF00',
      hoverType: templateSettings.hoverType ?? 'solid',
      hoverWidth: templateSettings.hoverWidth ?? 0.35,
      hoverOpacity: templateSettings.hoverOpacity ?? 0.8,
      finalColor: templateSettings.finalColor ?? '#00FF00',
      finalType: templateSettings.finalType ?? 'solid',
      finalWidth: templateSettings.finalWidth ?? 0.35,
      finalOpacity: templateSettings.finalOpacity ?? 1.0,
      activeTemplate: template.name
    });
    console.log('✅ [Template Hook] Template applied via applyLineTemplate action');
  };

  // 🆕 TEMPLATE SYSTEM: Smart update function που ξέρει αν υπάρχει active template
  const updateSettings = (updates: Partial<LineSettings>) => {
    const hasActiveTemplate = settings.activeTemplates.line !== null;

    if (hasActiveTemplate) {
      // Αν υπάρχει active template, οι user changes πάνε στα overrides
      console.log('🎨 [Template Hook] User change detected - saving to overrides');
      updateLineTemplateOverrides(updates);
    } else {
      // Αν δεν υπάρχει template, οι αλλαγές πάνε κανονικά στα line settings
      console.log('🎨 [Template Hook] No active template - updating line settings directly');
      updateLineSettings(updates);
    }
  };

  return {
    settings: effectiveLineSettings,  // ✅ FIX: Return effective settings (template base + overrides)
    updateSettings,
    resetToDefaults: () => updateLineSettings(defaultLineSettings),
    resetToFactory: resetLineToFactory,  // 🆕 TEMPLATE SYSTEM: Reset to ISO/AutoCAD factory defaults
    getCurrentDashPattern,
    applyTemplate
  };
}

export function useTextSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: defaultTextSettings,
      updateSettings: () => {},
      resetToDefaults: () => {},
      resetToFactory: () => {}  // 🏭 Factory reset (ISO 3098 standards)
    };
  }

  const { settings, updateTextSettings } = dxfSettings;
  const resetToFactory = () => updateTextSettings(defaultTextSettings);

  return {
    settings: settings.text,
    updateSettings: updateTextSettings,
    resetToDefaults: resetToFactory,  // Same as factory for text
    resetToFactory  // 🏭 Factory reset to ISO 3098 standards
  };
}

export function useGripSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: defaultGripSettings,
      updateSettings: () => {},
      resetToDefaults: () => {},
      resetToFactory: () => {}  // 🏭 Factory reset (AutoCAD standards)
    };
  }

  const { settings, updateGripSettings } = dxfSettings;
  const resetToFactory = () => updateGripSettings(defaultGripSettings);

  return {
    settings: settings.grip,
    updateSettings: updateGripSettings,
    resetToDefaults: resetToFactory,  // Same as factory for grips
    resetToFactory  // 🏭 Factory reset to AutoCAD standards
  };
}

export function useGridSettingsFromProvider() {     // 🆕 ΠΡΟΣΘΗΚΗ: Grid helper hook
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: DEFAULT_GRID_SETTINGS,
      updateSettings: () => {},
      resetToDefaults: () => {}
    };
  }

  const { settings, updateGridSettings } = dxfSettings;
  return {
    settings: settings.grid,
    updateSettings: updateGridSettings,
    resetToDefaults: () => updateGridSettings(DEFAULT_GRID_SETTINGS)
  };
}

export function useRulerSettingsFromProvider() {    // 🆕 ΠΡΟΣΘΗΚΗ: Ruler helper hook
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: DEFAULT_RULER_SETTINGS,
      updateSettings: () => {},
      resetToDefaults: () => {}
    };
  }

  const { settings, updateRulerSettings } = dxfSettings;
  return {
    settings: settings.ruler,
    updateSettings: updateRulerSettings,
    resetToDefaults: () => updateRulerSettings(DEFAULT_RULER_SETTINGS)
  };
}

// ===== NEW: MODE-AWARE HOOKS (Replacement for useEntityStyles from ConfigurationProvider) =====

/**
 * 🆕 MERGE: Unified hook για Line settings με mode support
 * Αντικαθιστά το useEntityStyles('line', mode) από ConfigurationProvider
 *
 * @param mode - Viewer mode (normal, preview, completion)
 * @returns Effective line settings για το συγκεκριμένο mode
 */
export function useLineStyles(mode?: ViewerMode) {
  const dxfSettings = useDxfSettingsSafe();

  if (!dxfSettings) {
    return {
      settings: defaultLineSettings,
      isOverridden: false,
      update: () => {},
      reset: () => {}
    };
  }

  const {
    getEffectiveLineSettings,
    updateLineSettings,
    updateSpecificLineSettings,
    updateLineOverrides,
    toggleLineOverride,
    settings: state
  } = dxfSettings;

  const currentMode = mode || state.mode;
  const effectiveSettings = getEffectiveLineSettings(currentMode);
  const isOverridden = state.overrideEnabled.line;

  return {
    settings: effectiveSettings,
    isOverridden,
    update: (updates: Partial<LineSettings>) => {
      if (isOverridden && currentMode !== 'normal') {
        // Update overrides
        updateLineOverrides(currentMode as 'preview' | 'completion', updates);
      } else if (currentMode === 'normal') {
        // Update general settings
        updateLineSettings(updates);
      } else {
        // Update specific settings
        updateSpecificLineSettings(currentMode as 'preview' | 'completion', updates);
      }
    },
    reset: () => {
      if (isOverridden) {
        toggleLineOverride(false);
      }
    }
  };
}

/**
 * 🆕 MERGE: Unified hook για Text settings με mode support
 * Αντικαθιστά το useEntityStyles('text', mode) από ConfigurationProvider
 */
export function useTextStyles(mode?: ViewerMode) {
  const dxfSettings = useDxfSettingsSafe();

  if (!dxfSettings) {
    return {
      settings: defaultTextSettings,
      isOverridden: false,
      update: () => {},
      reset: () => {}
    };
  }

  const {
    getEffectiveTextSettings,
    updateTextSettings,
    updateSpecificTextSettings,
    updateTextOverrides,
    toggleTextOverride,
    settings: state
  } = dxfSettings;

  const currentMode = mode || state.mode;
  const effectiveSettings = getEffectiveTextSettings(currentMode);
  const isOverridden = state.overrideEnabled.text;

  return {
    settings: effectiveSettings,
    isOverridden,
    update: (updates: Partial<TextSettings>) => {
      if (isOverridden && currentMode !== 'normal') {
        // Update overrides
        updateTextOverrides(currentMode as 'preview', updates);
      } else if (currentMode === 'normal') {
        // Update general settings
        updateTextSettings(updates);
      } else {
        // Update specific settings
        updateSpecificTextSettings(currentMode as 'preview', updates);
      }
    },
    reset: () => {
      if (isOverridden) {
        toggleTextOverride(false);
      }
    }
  };
}

/**
 * 🆕 MERGE: Unified hook για Grip settings με mode support
 * Αντικαθιστά το useEntityStyles('grip', mode) από ConfigurationProvider
 */
export function useGripStyles(mode?: ViewerMode) {
  const dxfSettings = useDxfSettingsSafe();

  if (!dxfSettings) {
    return {
      settings: defaultGripSettings,
      isOverridden: false,
      update: () => {},
      reset: () => {}
    };
  }

  const {
    getEffectiveGripSettings,
    updateGripSettings,
    updateSpecificGripSettings,
    updateGripOverrides,
    toggleGripOverride,
    settings: state
  } = dxfSettings;

  const currentMode = mode || state.mode;
  const effectiveSettings = getEffectiveGripSettings(currentMode);
  const isOverridden = state.overrideEnabled.grip;

  return {
    settings: effectiveSettings,
    isOverridden,
    update: (updates: Partial<GripSettings>) => {
      if (isOverridden && currentMode !== 'normal') {
        // Update overrides
        updateGripOverrides(currentMode as 'preview', updates);
      } else if (currentMode === 'normal') {
        // Update general settings
        updateGripSettings(updates);
      } else {
        // Update specific settings
        updateSpecificGripSettings(currentMode as 'preview', updates);
      }
    },
    reset: () => {
      if (isOverridden) {
        toggleGripOverride(false);
      }
    }
  };
}

// ===== ViewerMode TYPE ALREADY EXPORTED at line 102 =====
// export type { ViewerMode }; // ❌ Duplicate - Already exported above