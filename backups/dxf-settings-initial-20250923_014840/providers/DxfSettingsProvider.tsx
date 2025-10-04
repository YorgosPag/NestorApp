/**
 * ΚΕΝΤΡΙΚΟΣ DXF SETTINGS PROVIDER
 * Αντικαθιστά το διάσπαρτο auto-save system με κεντρικοποιημένη διαχείριση
 *
 * Προβλήματα που λύνει:
 * - Κυκλικά loops στο auto-save
 * - Διάσπαρτη λογική αποθήκευσης
 * - Πολλαπλές φορτώσεις από localStorage
 * - Δύσκολο debugging
 *
 * Χαρακτηριστικά:
 * - Ενιαίος manager για όλες τις ρυθμίσεις
 * - Single source of truth
 * - Batch updates
 * - Centralized persistence
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type { LineSettings } from '../contexts/LineSettingsContext';
import type { TextSettings } from '../contexts/TextSettingsContext';
import type { GripSettings } from '../types/gripSettings';
import type { GridSettings, RulerSettings } from '../systems/rulers-grid/config';
import { DEFAULT_GRID_SETTINGS, DEFAULT_RULER_SETTINGS } from '../systems/rulers-grid/config';
import { textStyleStore } from '../stores/TextStyleStore';
import { toolStyleStore } from '../stores/ToolStyleStore';
import { useUnifiedLinePreview } from '../ui/hooks/useUnifiedSpecificSettings';

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
      current = { ...current, ...updates };
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

interface DxfSettingsState {
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
  grid: GridSettings;           // 🆕 ΠΡΟΣΘΗΚΗ: Grid settings
  ruler: RulerSettings;         // 🆕 ΠΡΟΣΘΗΚΗ: Ruler settings
  isLoaded: boolean;
  lastSaved: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

type SettingsAction =
  | { type: 'LOAD_ALL_SETTINGS'; payload: Partial<DxfSettingsState> }
  | { type: 'UPDATE_LINE_SETTINGS'; payload: Partial<LineSettings> }
  | { type: 'UPDATE_TEXT_SETTINGS'; payload: Partial<TextSettings> }
  | { type: 'UPDATE_GRIP_SETTINGS'; payload: Partial<GripSettings> }
  | { type: 'UPDATE_GRID_SETTINGS'; payload: Partial<GridSettings> }  // 🆕 ΠΡΟΣΘΗΚΗ: Grid action
  | { type: 'UPDATE_RULER_SETTINGS'; payload: Partial<RulerSettings> } // 🆕 ΠΡΟΣΘΗΚΗ: Ruler action
  | { type: 'SET_SAVE_STATUS'; payload: DxfSettingsState['saveStatus'] }
  | { type: 'MARK_SAVED'; payload: Date }
  | { type: 'RESET_TO_DEFAULTS' };

interface DxfSettingsContextType {
  // State
  settings: DxfSettingsState;

  // Actions
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;  // 🆕 ΠΡΟΣΘΗΚΗ: Grid method
  updateRulerSettings: (updates: Partial<RulerSettings>) => void; // 🆕 ΠΡΟΣΘΗΚΗ: Ruler method
  resetToDefaults: () => void;

  // Computed
  isAutoSaving: boolean;
  hasUnsavedChanges: boolean;
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
  line: defaultLineSettings,
  text: defaultTextSettings,
  grip: defaultGripSettings,
  grid: DEFAULT_GRID_SETTINGS,    // 🆕 ΠΡΟΣΘΗΚΗ: Grid default settings
  ruler: DEFAULT_RULER_SETTINGS,  // 🆕 ΠΡΟΣΘΗΚΗ: Ruler default settings
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
        grid: DEFAULT_GRID_SETTINGS,     // 🆕 ΠΡΟΣΘΗΚΗ: Grid reset
        ruler: DEFAULT_RULER_SETTINGS    // 🆕 ΠΡΟΣΘΗΚΗ: Ruler reset
      };

    default:
      return state;
  }
}

// ===== PERSISTENCE UTILITIES =====

const STORAGE_KEYS = {
  line: 'dxf-line-general-settings',
  text: 'dxf-text-general-settings',
  grip: 'dxf-grip-general-settings'
} as const;

// ✅ ΔΙΕΘΝΗ ΠΡΟΤΥΠΑ VERSION - αν αλλάξει αυτό, τα παλιά localStorage settings θα επανεγκατασταθούν
const INTERNATIONAL_STANDARDS_VERSION = '2024.09.21-ISO-AutoCAD-v3.0-GRIP-COLORS-FIXED';

function loadAllSettings(): Partial<DxfSettingsState> {
  try {
    const line = localStorage.getItem(STORAGE_KEYS.line);
    const text = localStorage.getItem(STORAGE_KEYS.text);
    const grip = localStorage.getItem(STORAGE_KEYS.grip);

    const result: Partial<DxfSettingsState> = {};

    // ✅ ΕΛΕΓΧΟΣ VERSION - αν τα αποθηκευμένα δεδομένα δεν έχουν το σωστό version, χρησιμοποίησε defaults
    if (line) {
      const parsed = JSON.parse(line);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.line = { ...defaultLineSettings, ...actualData };
      } else {
        // console.log('🔄 [DxfSettings] Ενημέρωση γραμμών σε διεθνή πρότυπα');
        result.line = defaultLineSettings;
      }
    }

    if (text) {
      const parsed = JSON.parse(text);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.text = { ...defaultTextSettings, ...actualData };
      } else {
        // console.log('🔄 [DxfSettings] Ενημέρωση κειμένων σε διεθνή πρότυπα');
        result.text = defaultTextSettings;
      }
    }

    if (grip) {
      const parsed = JSON.parse(grip);
      const { __autosave_timestamp, __autosave_key, __standards_version, ...actualData } = parsed;

      if (__standards_version === INTERNATIONAL_STANDARDS_VERSION) {
        result.grip = { ...defaultGripSettings, ...actualData };
      } else {
        // console.log('🔄 [DxfSettings] Ενημέρωση grips σε διεθνή πρότυπα');
        result.grip = defaultGripSettings;
      }
    }

    // console.log('📂 [DxfSettings] Φορτώθηκαν όλες οι ρυθμίσεις με διεθνή πρότυπα');
    return result;

  } catch (error) {
    console.error('❌ [DxfSettings] Σφάλμα φόρτωσης ρυθμίσεων:', error);
    return {};
  }
}

function saveAllSettings(settings: Pick<DxfSettingsState, 'line' | 'text' | 'grip'>) {
  try {
    const timestamp = Date.now();

    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      const data = settings[key as keyof typeof settings];
      const dataWithMetadata = {
        ...data,
        __autosave_timestamp: timestamp,
        __autosave_key: storageKey,
        __standards_version: INTERNATIONAL_STANDARDS_VERSION
      };
      localStorage.setItem(storageKey, JSON.stringify(dataWithMetadata));
    });

    console.log('✅ [DxfSettings] Αποθηκεύτηκαν όλες οι ρυθμίσεις με διεθνή πρότυπα');
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
  // Hook για να παίρνουμε τις ειδικές ρυθμίσεις προσχεδίασης
  const { settings: linePreviewSettings, getEffectiveLineSettings } = useUnifiedLinePreview();

  // Load settings on mount - ΜΟΝΟ ΜΙΑ ΦΟΡΑ
  useEffect(() => {
    if (!state.isLoaded) {
      const savedSettings = loadAllSettings();
      dispatch({ type: 'LOAD_ALL_SETTINGS', payload: savedSettings });
    }
  }, [state.isLoaded]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (!state.isLoaded) return; // Δεν αποθηκεύουμε κατά τη φόρτωση

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });

    saveTimeoutRef.current = setTimeout(() => {
      const success = saveAllSettings({
        line: state.line,
        text: state.text,
        grip: state.grip
      });

      if (success) {
        dispatch({ type: 'MARK_SAVED', payload: new Date() });
        setTimeout(() => {
          dispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
        }, 2000);
      } else {
        dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
      }
    }, 500);
  }, [state.line, state.text, state.grip, state.isLoaded]);

  // Auto-save on settings change
  useEffect(() => {
    if (state.isLoaded) {
      debouncedSave();
    }
  }, [state.line, state.text, state.grip, debouncedSave]);

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

  const resetToDefaults = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEFAULTS' });
  }, []);

  // Computed values
  const isAutoSaving = state.saveStatus === 'saving';
  const hasUnsavedChanges = state.saveStatus === 'idle' && state.lastSaved === null;

  const contextValue = useMemo(() => ({
    settings: state,
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    updateGridSettings,        // 🆕 ΠΡΟΣΘΗΚΗ: Grid στο context value
    updateRulerSettings,       // 🆕 ΠΡΟΣΘΗΚΗ: Ruler στο context value
    resetToDefaults,
    isAutoSaving,
    hasUnsavedChanges
  }), [
    state,
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    updateGridSettings,        // 🆕 ΠΡΟΣΘΗΚΗ: Grid στο dependency array
    updateRulerSettings,       // 🆕 ΠΡΟΣΘΗΚΗ: Ruler στο dependency array
    resetToDefaults,
    isAutoSaving,
    hasUnsavedChanges
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

    // console.log('🔄 [DxfSettings] Συγχρονισμός textStyleStore με γενικές ρυθμίσεις');
  }, [state.text, state.isLoaded]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ TOOLSTYLESTORE =====
  // Συγχρονίζει το toolStyleStore με τις ρυθμίσεις γραμμών (γενικές ή ειδικές)
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    // ✅ ΔΙΟΡΘΩΣΗ: Ελέγχουμε αν υπάρχει override για ειδικές ρυθμίσεις
    const effectiveLineSettings = getEffectiveLineSettings();
    const isOverrideActive = linePreviewSettings.overrideGlobalSettings;

    // Μετατρέπουμε τις effective ρυθμίσεις σε format για το toolStyleStore
    toolStyleStore.set({
      enabled: effectiveLineSettings.enabled,
      strokeColor: effectiveLineSettings.color,
      lineWidth: effectiveLineSettings.lineWidth,
      opacity: effectiveLineSettings.opacity,
      lineType: effectiveLineSettings.lineType,
      fillColor: '#00000000' // Default transparent fill
    });

    // console.log('🔄 [DxfSettings] Συγχρονισμός toolStyleStore:', {
    //   isOverrideActive,
    //   settingsSource: isOverrideActive ? 'ΕΙΔΙΚΕΣ ΡΥΘΜΙΣΕΙΣ' : 'ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ',
    //   enabled: effectiveLineSettings.enabled,
    //   strokeColor: effectiveLineSettings.color,
    //   lineWidth: effectiveLineSettings.lineWidth,
    //   opacity: effectiveLineSettings.opacity,
    //   lineType: effectiveLineSettings.lineType
    // });
  }, [state.line, state.isLoaded, linePreviewSettings.overrideGlobalSettings, getEffectiveLineSettings]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ GRID SETTINGS =====
  // Συγχρονίζει το globalGridStore με τις ρυθμίσεις από το DxfSettingsProvider
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    globalGridStore.update(state.grid);
    // console.log('🔄 [DxfSettings] Συγχρονισμός globalGridStore με γενικές ρυθμίσεις grid');
  }, [state.grid, state.isLoaded]);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ RULER SETTINGS =====
  // Συγχρονίζει το globalRulerStore με τις ρυθμίσεις από το DxfSettingsProvider
  useEffect(() => {
    if (!state.isLoaded) return; // Μόνο όταν έχουν φορτωθεί οι ρυθμίσεις

    globalRulerStore.update(state.ruler);
    // console.log('🔄 [DxfSettings] Συγχρονισμός globalRulerStore με γενικές ρυθμίσεις rulers');
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

// Dash patterns based on line type (copied from LineSettingsContext)
const DASH_PATTERNS: Record<string, number[]> = {
  solid: [],
  dotted: [1, 3],
  dashed: [5, 5],
  'dash-dot': [5, 3, 1, 3],
  'dash-dot-dot': [5, 3, 1, 3, 1, 3],
  'long-dash': [10, 5],
  'short-dash': [3, 3],
  'double-dot': [1, 3, 1, 6],
  custom: [5, 5]
};

export function useLineSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    const getCurrentDashPattern = () => {
      const basePattern = DASH_PATTERNS[defaultLineSettings.lineType] || [];
      if (basePattern.length === 0) return [];
      return basePattern.map(value => value * defaultLineSettings.dashScale);
    };

    return {
      settings: defaultLineSettings,
      updateSettings: () => {},
      resetToDefaults: () => {},
      getCurrentDashPattern
    };
  }

  const { settings, updateLineSettings } = dxfSettings;

  const getCurrentDashPattern = () => {
    const basePattern = DASH_PATTERNS[settings.line.lineType] || [];
    if (basePattern.length === 0) return [];
    return basePattern.map(value => value * settings.line.dashScale);
  };

  return {
    settings: settings.line,
    updateSettings: updateLineSettings,
    resetToDefaults: () => updateLineSettings(defaultLineSettings),
    getCurrentDashPattern
  };
}

export function useTextSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: defaultTextSettings,
      updateSettings: () => {},
      resetToDefaults: () => {}
    };
  }

  const { settings, updateTextSettings } = dxfSettings;
  return {
    settings: settings.text,
    updateSettings: updateTextSettings,
    resetToDefaults: () => updateTextSettings(defaultTextSettings)
  };
}

export function useGripSettingsFromProvider() {
  const dxfSettings = useDxfSettingsSafe();
  if (!dxfSettings) {
    return {
      settings: defaultGripSettings,
      updateSettings: () => {},
      resetToDefaults: () => {}
    };
  }

  const { settings, updateGripSettings } = dxfSettings;
  return {
    settings: settings.grip,
    updateSettings: updateGripSettings,
    resetToDefaults: () => updateGripSettings(defaultGripSettings)
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