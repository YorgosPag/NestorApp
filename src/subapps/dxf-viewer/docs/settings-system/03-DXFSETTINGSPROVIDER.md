# CHAPTER 03 - DXFSETTINGSPROVIDER

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [State Structure](#state-structure)
3. [Reducer Logic](#reducer-logic)
4. [Actions Reference](#actions-reference)
5. [Auto-Save Mechanism](#auto-save-mechanism)
6. [LocalStorage Integration](#localstorage-integration)
7. [Migration System](#migration-system)
8. [Context API](#context-api)
9. [Effective Settings Calculation](#effective-settings-calculation)
10. [Best Practices](#best-practices)

---

## 1. OVERVIEW

### Τι Είναι το DxfSettingsProvider;

Το `DxfSettingsProvider` είναι ο **κεντρικός React Context Provider** που διαχειρίζεται ΟΛΕΣ τις ρυθμίσεις του DXF Viewer:

**Responsibilities**:
- 🎯 Central settings storage (Single source of truth)
- 💾 Auto-save to localStorage (500ms debounce)
- 🔄 Mode-based settings (normal/preview/completion)
- 📊 Effective settings calculation (General → Specific → Overrides)
- ✅ Settings validation
- 🔧 Migration system (version compatibility)

**File**: `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx` (1,659 lines)

---

### Γιατί Χρειάζεται;

**Πρόβλημα Πριν**:
```typescript
// ❌ Διάσπαρτες ρυθμίσεις σε πολλά αρχεία
const lineSettings = { color: '#FFFFFF' }; // Hardcoded σε component A
const textSettings = { fontSize: 12 };     // Hardcoded σε component B
const gripSettings = { size: 5 };          // Hardcoded σε component C

// ❌ Δύο providers χωρίς συγχρονισμό
<ConfigurationProvider>  // Mode-based, NO persistence
  <DxfSettingsProvider>  // Persistence, NO mode system
    {/* Conflict! */}
  </DxfSettingsProvider>
</ConfigurationProvider>
```

**Λύση Τώρα**:
```typescript
// ✅ Κεντρικός provider για ΟΛΑ
<DxfSettingsProvider>
  {/* Single source of truth ✅ */}
  {/* Mode-based settings ✅ */}
  {/* Auto-save persistence ✅ */}
  {/* Effective settings calculation ✅ */}
</DxfSettingsProvider>
```

---

## 2. STATE STRUCTURE

### Complete State Interface

```typescript
interface DxfSettingsState {
  // ===== GENERAL SETTINGS (Base Layer) =====
  line: LineSettings;       // Γενικές ρυθμίσεις γραμμών
  text: TextSettings;       // Γενικές ρυθμίσεις κειμένου
  grip: GripSettings;       // Γενικές ρυθμίσεις grips
  grid: GridSettings;       // Ρυθμίσεις grid
  ruler: RulerSettings;     // Ρυθμίσεις rulers
  cursor: CursorSettings;   // Ρυθμίσεις cursor

  // ===== MODE-BASED SETTINGS (Merged from ConfigurationProvider) =====
  mode: ViewerMode;         // Current mode: 'normal' | 'preview' | 'completion'

  specific: {               // Ειδικές ρυθμίσεις ανά mode
    line: {
      preview?: Partial<LineSettings>;      // Preview-specific overrides
      completion?: Partial<LineSettings>;   // Completion-specific overrides
    };
    text: {
      preview?: Partial<TextSettings>;
    };
    grip: {
      preview?: Partial<GripSettings>;
    };
  };

  overrides: {              // User overrides (top priority)
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
  };

  overrideEnabled: {        // Which entities have override enabled
    line: boolean;
    text: boolean;
    grip: boolean;
  };

  // ===== META =====
  isLoaded: boolean;        // Loaded from localStorage?
  lastSaved: Date | null;   // Last save timestamp
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}
```

---

### Default State Values

**Line Settings (ISO 128 + AutoCAD Standards)**:
```typescript
const defaultLineSettings: LineSettings = {
  enabled: true,
  lineType: 'solid',         // ISO 128: Continuous line
  lineWidth: 0.25,           // ISO 128: Standard 0.25mm
  color: '#FFFFFF',          // AutoCAD ACI 7: White
  opacity: 1.0,              // Full opacity
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'round',
  lineJoin: 'round',
  breakAtCenter: false,
  hoverColor: '#FFFF00',     // AutoCAD ACI 2: Yellow
  hoverType: 'solid',
  hoverWidth: 0.35,          // ISO 128: Next standard width
  hoverOpacity: 0.8,
  finalColor: '#00FF00',     // AutoCAD ACI 3: Green
  finalType: 'solid',
  finalWidth: 0.35,
  finalOpacity: 1.0,
  activeTemplate: null,
};
```

**Mode-Based Defaults (Preview/Completion)**:
```typescript
const defaultSpecificSettings: SpecificSettings = {
  line: {
    preview: {
      lineType: 'dashed',      // Dashed for temporary preview
      color: '#FFFF00',        // Yellow (AutoCAD standard)
      opacity: 0.7,            // Semi-transparent
    },
    completion: {
      lineType: 'solid',       // Solid for final entity
      color: '#00FF00',        // Green (AutoCAD standard)
      opacity: 1.0,            // Fully opaque
    }
  },
  text: {
    preview: {
      color: '#FFFF00',        // Yellow for preview text
      opacity: 0.7,
    }
  },
  grip: {
    preview: {
      showGrips: true,         // Show grips in preview
      opacity: 0.8,
    }
  }
};
```

---

## 3. REDUCER LOGIC

### Reducer Pattern

```typescript
function settingsReducer(
  state: DxfSettingsState,
  action: SettingsAction
): DxfSettingsState {
  switch (action.type) {
    // ... handle all action types
  }
}
```

---

### Key Reducer Cases

#### 1. Update Line Settings
```typescript
case 'UPDATE_LINE_SETTINGS':
  return {
    ...state,
    line: { ...state.line, ...action.payload },
    saveStatus: 'idle' // Mark as unsaved
  };
```

#### 2. Update Specific Settings (Mode-Based)
```typescript
case 'UPDATE_SPECIFIC_LINE_SETTINGS': {
  const { mode, settings } = action.payload;
  return {
    ...state,
    specific: {
      ...state.specific,
      line: {
        ...state.specific.line,
        [mode]: {
          ...state.specific.line[mode],
          ...settings
        }
      }
    },
    saveStatus: 'idle'
  };
}
```

#### 3. Set Mode
```typescript
case 'SET_MODE':
  return {
    ...state,
    mode: action.payload
  };
```

#### 4. Toggle Override
```typescript
case 'TOGGLE_LINE_OVERRIDE':
  return {
    ...state,
    overrideEnabled: {
      ...state.overrideEnabled,
      line: action.payload
    },
    saveStatus: 'idle'
  };
```

#### 5. Load All Settings (From localStorage)
```typescript
case 'LOAD_ALL_SETTINGS':
  return {
    ...state,
    ...action.payload,
    isLoaded: true,
    saveStatus: 'saved'
  };
```

#### 6. Reset to Defaults
```typescript
case 'RESET_TO_DEFAULTS':
  return {
    ...INITIAL_STATE,
    isLoaded: true,
    saveStatus: 'idle'
  };
```

---

## 4. ACTIONS REFERENCE

### General Settings Actions

```typescript
// Update line settings (Γενικές Ρυθμίσεις)
updateLineSettings({ color: '#FF0000', lineWidth: 0.5 });

// Update text settings
updateTextSettings({ fontSize: 14, fontFamily: 'Arial' });

// Update grip settings
updateGripSettings({ gripSize: 6, colors: { cold: '#0000FF' } });

// Update grid settings
updateGridSettings({ spacing: 10, enabled: true });

// Update ruler settings
updateRulerSettings({ horizontal: { enabled: true } });

// Update cursor settings
updateCursorSettings({ crosshairSize: 20 });
```

---

### Mode-Based Actions

```typescript
// Set current mode
setMode('preview'); // or 'completion' or 'normal'

// Update preview-specific line settings (Ειδικές Ρυθμίσεις → Preview)
updateSpecificLineSettings('preview', {
  color: '#FFFF00',
  lineType: 'dashed',
  opacity: 0.7
});

// Update completion-specific line settings (Ειδικές Ρυθμίσεις → Completion)
updateSpecificLineSettings('completion', {
  color: '#00FF00',
  lineType: 'solid',
  opacity: 1.0
});

// Update preview text settings
updateSpecificTextSettings('preview', {
  color: '#FFFF00',
  fontSize: 12
});

// Update preview grip settings
updateSpecificGripSettings('preview', {
  showGrips: true,
  opacity: 0.8
});
```

---

### Override Actions

```typescript
// Enable/disable line overrides
toggleLineOverride(true);  // Enable user overrides
toggleLineOverride(false); // Disable (use specific settings)

// Update line overrides (when enabled)
updateLineOverrides('preview', {
  color: '#FF0000', // User-specific red color
  lineWidth: 0.8
});

// Update text overrides
toggleTextOverride(true);
updateTextOverrides('preview', {
  color: '#0000FF',
  fontSize: 16
});

// Update grip overrides
toggleGripOverride(true);
updateGripOverrides('preview', {
  gripSize: 8
});
```

---

### Utility Actions

```typescript
// Reset all settings to defaults
resetToDefaults();

// Get migration diagnostics
const diagnostics = migrationUtils.getDiagnostics();
console.log(diagnostics); // { version, migrated keys, errors, etc. }

// Manually trigger migration
migrationUtils.triggerMigration();

// Cleanup legacy localStorage keys
migrationUtils.cleanupLegacy();
```

---

## 5. AUTO-SAVE MECHANISM

### How Auto-Save Works

```
User changes setting in ColorPalettePanel
  ↓
dispatch({ type: 'UPDATE_LINE_SETTINGS', payload: { color: '#FF0000' } })
  ↓
Reducer updates state + sets saveStatus: 'idle'
  ↓
useEffect detects state change
  ↓
Debounce 500ms (batch multiple rapid changes)
  ↓
saveStatus: 'saving'
  ↓
localStorage.setItem('dxf-settings-v1', JSON.stringify(state))
  ↓
saveStatus: 'saved'
  ↓
lastSaved: new Date()
```

---

### Auto-Save Implementation

```typescript
// Auto-save effect (500ms debounce)
useEffect(() => {
  if (!state.isLoaded) return; // Don't save before initial load

  const timeoutId = setTimeout(() => {
    if (state.saveStatus === 'idle') {
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });

      try {
        const toSave = {
          line: state.line,
          text: state.text,
          grip: state.grip,
          grid: state.grid,
          ruler: state.ruler,
          cursor: state.cursor,
          mode: state.mode,
          specific: state.specific,
          overrides: state.overrides,
          overrideEnabled: state.overrideEnabled
        };

        localStorage.setItem('dxf-settings-v1', JSON.stringify(toSave));

        dispatch({ type: 'MARK_SAVED', payload: new Date() });
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
        dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
      }
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(timeoutId);
}, [state]);
```

---

### Debounce Benefits

**Problem Without Debounce**:
```typescript
// User drags color slider → 50 updates per second
updateLineSettings({ color: '#FF0000' }); // Save!
updateLineSettings({ color: '#FF0001' }); // Save!
updateLineSettings({ color: '#FF0002' }); // Save!
// ... 50 localStorage writes per second ❌
```

**Solution With 500ms Debounce**:
```typescript
// User drags color slider → 50 updates per second
updateLineSettings({ color: '#FF0000' }); // Wait...
updateLineSettings({ color: '#FF0001' }); // Wait...
updateLineSettings({ color: '#FF0002' }); // Wait...
// ... user stops dragging
// After 500ms: Save once! ✅
```

---

## 6. LOCALSTORAGE INTEGRATION

### Storage Key Structure

```typescript
const STORAGE_KEY = 'dxf-settings-v1'; // Version 1
```

**Future Versions**:
- `dxf-settings-v2` - Next version with new features
- `dxf-settings-v3` - Future version

**Migration Path**: v1 → v2 → v3 (automatic migration system)

---

### Load from localStorage

```typescript
useEffect(() => {
  try {
    const saved = localStorage.getItem('dxf-settings-v1');

    if (saved) {
      const parsed = JSON.parse(saved);

      // Validate and merge with defaults
      const validated = {
        ...INITIAL_STATE,
        ...parsed,
        // Ensure all required keys exist
        line: { ...defaultLineSettings, ...parsed.line },
        text: { ...defaultTextSettings, ...parsed.text },
        grip: { ...defaultGripSettings, ...parsed.grip },
        // ... other settings
      };

      dispatch({ type: 'LOAD_ALL_SETTINGS', payload: validated });
    } else {
      // No saved settings, use defaults
      dispatch({ type: 'LOAD_ALL_SETTINGS', payload: INITIAL_STATE });
    }
  } catch (error) {
    console.error('❌ Failed to load settings:', error);
    // Fallback to defaults
    dispatch({ type: 'LOAD_ALL_SETTINGS', payload: INITIAL_STATE });
  }
}, []); // Run once on mount
```

---

### Save to localStorage

```typescript
// Triggered by auto-save effect
const toSave = {
  line: state.line,
  text: state.text,
  grip: state.grip,
  grid: state.grid,
  ruler: state.ruler,
  cursor: state.cursor,
  mode: state.mode,
  specific: state.specific,
  overrides: state.overrides,
  overrideEnabled: state.overrideEnabled,
  // Metadata (optional)
  version: '1.0.0',
  savedAt: new Date().toISOString()
};

localStorage.setItem('dxf-settings-v1', JSON.stringify(toSave));
```

---

### Error Handling

```typescript
try {
  localStorage.setItem('dxf-settings-v1', JSON.stringify(toSave));
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    console.error('❌ localStorage quota exceeded!');
    // Notify user
  } else if (error.name === 'SecurityError') {
    console.error('❌ localStorage access denied (private browsing?)');
    // Fallback to in-memory storage
  } else {
    console.error('❌ Unknown localStorage error:', error);
  }

  dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
}
```

---

## 7. MIGRATION SYSTEM

### Migration Utilities

```typescript
interface MigrationUtils {
  getDiagnostics: () => {
    version: string;
    migratedKeys: string[];
    errors: string[];
    timestamp: Date;
  };

  triggerMigration: () => {
    success: boolean;
    migratedKeys: string[];
    errors: string[];
  };

  cleanupLegacy: () => void;
}
```

---

### Migration Flow

```
User opens app
  ↓
Check localStorage for 'dxf-settings-v1'
  ↓
Not found? Check legacy keys:
  - 'line-settings'
  - 'text-settings'
  - 'grip-settings'
  - 'grid-settings'
  ↓
Found legacy keys? Migrate:
  1. Read legacy settings
  2. Validate and transform
  3. Save to 'dxf-settings-v1'
  4. (Optional) Delete legacy keys
  ↓
Load unified settings ✅
```

---

### Migration Implementation

```typescript
function performComprehensiveMigration() {
  const legacyKeys = [
    'line-settings',
    'text-settings',
    'grip-settings',
    'grid-settings',
    'ruler-settings'
  ];

  const migratedSettings: Partial<DxfSettingsState> = {};
  const errors: string[] = [];

  for (const key of legacyKeys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);

        // Map legacy key to new structure
        switch (key) {
          case 'line-settings':
            migratedSettings.line = { ...defaultLineSettings, ...parsed };
            break;
          case 'text-settings':
            migratedSettings.text = { ...defaultTextSettings, ...parsed };
            break;
          // ... other keys
        }
      }
    } catch (error) {
      errors.push(`Failed to migrate ${key}: ${error.message}`);
    }
  }

  if (Object.keys(migratedSettings).length > 0) {
    // Save migrated settings
    localStorage.setItem('dxf-settings-v1', JSON.stringify(migratedSettings));

    // Load into provider
    dispatch({ type: 'LOAD_ALL_SETTINGS', payload: migratedSettings });

    return { success: true, migratedKeys: Object.keys(migratedSettings), errors };
  }

  return { success: false, migratedKeys: [], errors };
}
```

---

## 8. CONTEXT API

### Context Value Structure

```typescript
const contextValue: DxfSettingsContextType = {
  // State
  settings: state,

  // General actions
  updateLineSettings,
  updateTextSettings,
  updateGripSettings,
  updateGridSettings,
  updateRulerSettings,
  updateCursorSettings,
  resetToDefaults,

  // Mode-based actions
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

  // Effective settings
  getEffectiveLineSettings,
  getEffectiveTextSettings,
  getEffectiveGripSettings,

  // Computed
  isAutoSaving: state.saveStatus === 'saving',
  hasUnsavedChanges: state.saveStatus === 'idle',

  // Migration utilities
  migrationUtils: {
    getDiagnostics,
    triggerMigration,
    cleanupLegacy
  }
};
```

---

### useMemo Optimization

```typescript
const contextValue = useMemo(() => ({
  settings: state,
  updateLineSettings,
  updateTextSettings,
  // ... all other values
}), [
  state,
  updateLineSettings,
  updateTextSettings,
  // ... all dependencies
]);

return (
  <DxfSettingsContext.Provider value={contextValue}>
    {children}
  </DxfSettingsContext.Provider>
);
```

**Why useMemo?**: Prevent unnecessary re-renders when context value changes.

---

## 9. EFFECTIVE SETTINGS CALCULATION

### The Settings Hierarchy

```
EFFECTIVE SETTINGS = GENERAL → SPECIFIC → OVERRIDES
                       ↑          ↑          ↑
                     Base    Mode-based  User preference
```

---

### getEffectiveLineSettings Implementation

```typescript
const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
  const currentMode = mode || state.mode;

  // Step 1: Start with General settings (base layer)
  let effective = { ...state.line };

  // Step 2: Merge Specific settings (if exists for current mode)
  if (currentMode === 'preview' && state.specific.line.preview) {
    effective = { ...effective, ...state.specific.line.preview };
  } else if (currentMode === 'completion' && state.specific.line.completion) {
    effective = { ...effective, ...state.specific.line.completion };
  }

  // Step 3: Merge Overrides (if enabled and exists for current mode)
  if (state.overrideEnabled.line) {
    if (currentMode === 'preview' && state.overrides.line.preview) {
      effective = { ...effective, ...state.overrides.line.preview };
    } else if (currentMode === 'completion' && state.overrides.line.completion) {
      effective = { ...effective, ...state.overrides.line.completion };
    }
  }

  return effective;
}, [state.line, state.specific.line, state.overrides.line, state.overrideEnabled.line, state.mode]);
```

---

### Example Calculation

**State**:
```typescript
{
  line: {
    color: '#FFFFFF',    // General: White
    lineWidth: 0.25,
    opacity: 1.0
  },
  specific: {
    line: {
      preview: {
        color: '#FFFF00', // Specific Preview: Yellow
        opacity: 0.7
      }
    }
  },
  overrides: {
    line: {
      preview: {
        color: '#FF0000'  // Override Preview: Red
      }
    }
  },
  overrideEnabled: {
    line: true          // Overrides enabled!
  }
}
```

**Calculation for `getEffectiveLineSettings('preview')`**:
```typescript
// Step 1: Start with General
effective = { color: '#FFFFFF', lineWidth: 0.25, opacity: 1.0 }

// Step 2: Merge Specific Preview
effective = { color: '#FFFF00', lineWidth: 0.25, opacity: 0.7 }
            //       ↑ overridden               ↑ overridden

// Step 3: Merge Overrides (enabled = true)
effective = { color: '#FF0000', lineWidth: 0.25, opacity: 0.7 }
            //       ↑ final override

// Result:
{
  color: '#FF0000',      // From override ✅
  lineWidth: 0.25,       // From general ✅
  opacity: 0.7           // From specific ✅
}
```

---

## 10. BEST PRACTICES

### ✅ DO: Use Effective Settings

```typescript
// ✅ CORRECT: Always use effective settings
const lineStyles = getEffectiveLineSettings('preview');
entity.color = lineStyles.color; // Respects hierarchy
```

```typescript
// ❌ WRONG: Don't access state.line directly
entity.color = state.line.color; // Ignores specific/overrides!
```

---

### ✅ DO: Update Settings via Actions

```typescript
// ✅ CORRECT: Use action methods
updateLineSettings({ color: '#FF0000' });
```

```typescript
// ❌ WRONG: Don't mutate state directly
state.line.color = '#FF0000'; // Won't trigger re-render!
```

---

### ✅ DO: Check Override Enabled Before Using

```typescript
// ✅ CORRECT: Respect override flag
if (state.overrideEnabled.line && state.overrides.line.preview) {
  // Use override settings
}
```

---

### ✅ DO: Validate Settings Before Saving

```typescript
// ✅ CORRECT: Validate before update
const validateLineSettings = (settings: Partial<LineSettings>) => {
  if (settings.lineWidth && settings.lineWidth < 0) {
    throw new Error('lineWidth must be >= 0');
  }
  if (settings.opacity && (settings.opacity < 0 || settings.opacity > 1)) {
    throw new Error('opacity must be 0-1');
  }
  return settings;
};

updateLineSettings(validateLineSettings(newSettings));
```

---

### ✅ DO: Use useMemo for Derived Values

```typescript
// ✅ CORRECT: Memoize expensive calculations
const effectiveSettings = useMemo(() => {
  return getEffectiveLineSettings('preview');
}, [getEffectiveLineSettings]);
```

---

### ❌ DON'T: Update Settings in Render

```typescript
// ❌ WRONG: Side effect in render
function MyComponent() {
  updateLineSettings({ color: '#FF0000' }); // Causes infinite loop!
  return <div>...</div>;
}
```

```typescript
// ✅ CORRECT: Update in useEffect or event handler
function MyComponent() {
  useEffect(() => {
    updateLineSettings({ color: '#FF0000' });
  }, []);

  return <div>...</div>;
}
```

---

### ❌ DON'T: Access localStorage Directly

```typescript
// ❌ WRONG: Bypass provider
const settings = JSON.parse(localStorage.getItem('dxf-settings-v1'));
```

```typescript
// ✅ CORRECT: Use provider
const { settings } = useDxfSettings();
```

---

## 📚 CROSS-REFERENCES

### Related Documentation

- **[00-INDEX.md](./00-INDEX.md)** - Documentation hub
- **[01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)** - Overall architecture
- **[02-COLORPALETTEPANEL.md](./02-COLORPALETTEPANEL.md)** - UI that uses this provider
- **[04-HOOKS_REFERENCE.md](./04-HOOKS_REFERENCE.md)** - Hooks that consume this provider
- **[06-SETTINGS_FLOW.md](./06-SETTINGS_FLOW.md)** - Complete settings lifecycle
- **[07-MODE_SYSTEM.md](./07-MODE_SYSTEM.md)** - Mode-based settings details
- **[10-MIGRATION_GUIDE.md](./10-MIGRATION_GUIDE.md)** - Migration from legacy systems

### Related Code Files

**Main Provider**:
- [`providers/DxfSettingsProvider.tsx`](../../providers/DxfSettingsProvider.tsx) (1,659 lines)
  - [State Interface](../../providers/DxfSettingsProvider.tsx#L30-L60) (lines 30-60)
  - [Reducer Logic](../../providers/DxfSettingsProvider.tsx#L100-L300) (lines 100-300)
  - [Auto-Save Effect](../../providers/DxfSettingsProvider.tsx#L450-L480) (lines 450-480)
  - [Context Provider](../../providers/DxfSettingsProvider.tsx#L500-L550) (lines 500-550)
  - [Migration System](../../providers/DxfSettingsProvider.tsx#L600-L700) (lines 600-700)

**Consumer Hooks**:
- [`hooks/useEntityStyles.ts`](../../hooks/useEntityStyles.ts) - Legacy wrapper (deprecated, use unified hooks)
- [`hooks/useUnifiedSpecificSettings.ts`](../../hooks/useUnifiedSpecificSettings.ts) - Unified settings hooks

**UI Consumers**:
- [`ui/components/ColorPalettePanel.tsx`](../../ui/components/ColorPalettePanel.tsx) - Main UI consumer (2,200+ lines)
- [`ui/components/dxf-settings/settings/core/LineSettings.tsx`](../../ui/components/dxf-settings/settings/core/LineSettings.tsx) - Line settings UI

**Drawing Integration**:
- [`hooks/drawing/useUnifiedDrawing.ts`](../../hooks/drawing/useUnifiedDrawing.ts) - Drawing logic consumer
- [`hooks/drawing/useDrawingHandlers.ts`](../../hooks/drawing/useDrawingHandlers.ts) - Drawing handlers

---

## 🎯 KEY TAKEAWAYS

1. **Single Source of Truth**: DxfSettingsProvider διαχειρίζεται ΟΛΑ τα settings
2. **Auto-Save**: 500ms debounce για efficient localStorage writes
3. **Hierarchical**: General → Specific → Overrides (3 layers)
4. **Mode-Based**: Διαφορετικές ρυθμίσεις για preview/completion/normal
5. **Migration System**: Automatic migration από legacy storage keys
6. **Type-Safe**: Full TypeScript validation
7. **Optimized**: useMemo/useCallback για performance

---

**END OF CHAPTER 03**

---

**Next Chapter**: [04 - Hooks Reference →](./04-HOOKS_REFERENCE.md)
**Previous Chapter**: [← 02 - ColorPalettePanel](./02-COLORPALETTEPANEL.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
