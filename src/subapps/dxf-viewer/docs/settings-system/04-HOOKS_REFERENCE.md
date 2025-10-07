# CHAPTER 04 - HOOKS REFERENCE

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Primary Hooks](#primary-hooks)
3. [Unified Settings Hooks](#unified-settings-hooks)
4. [Legacy Compatibility Hooks](#legacy-compatibility-hooks)
5. [Specialized Hooks](#specialized-hooks)
6. [Hook Usage Patterns](#hook-usage-patterns)
7. [Common Pitfalls](#common-pitfalls)
8. [Performance Optimization](#performance-optimization)

---

## 1. OVERVIEW

### Available Hooks Categories

| Category | Hooks | Purpose |
|----------|-------|---------|
| **Primary** | `useDxfSettings()` | Access DxfSettingsProvider context |
| **Unified** | `useLineStyles()`, `useTextStyles()`, `useGripStyles()` | Get effective settings for specific mode |
| **Legacy** | `useEntityStyles()`, `usePreviewMode()` | Backward compatibility |
| **Specialized** | `useLineSettingsFromProvider()`, `useUnifiedLinePreview()`, etc. | Specific use cases |

---

## 2. PRIMARY HOOKS

### useDxfSettings()

**Purpose**: Access the complete DxfSettingsProvider context

**Signature**:
```typescript
function useDxfSettings(): DxfSettingsContextType
```

**Returns**:
```typescript
{
  // State
  settings: DxfSettingsState;

  // General actions
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  updateRulerSettings: (updates: Partial<RulerSettings>) => void;
  updateCursorSettings: (updates: Partial<CursorSettings>) => void;
  resetToDefaults: () => void;

  // Mode-based actions
  setMode: (mode: ViewerMode) => void;
  updateSpecificLineSettings: (mode, settings) => void;
  updateSpecificTextSettings: (mode, settings) => void;
  updateSpecificGripSettings: (mode, settings) => void;
  updateLineOverrides: (mode, settings) => void;
  updateTextOverrides: (mode, settings) => void;
  updateGripOverrides: (mode, settings) => void;
  toggleLineOverride: (enabled: boolean) => void;
  toggleTextOverride: (enabled: boolean) => void;
  toggleGripOverride: (enabled: boolean) => void;

  // Effective settings
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;

  // Computed
  isAutoSaving: boolean;
  hasUnsavedChanges: boolean;

  // Migration utilities
  migrationUtils: { /* ... */ };
}
```

**Usage**:
```typescript
function MyComponent() {
  const {
    settings,
    updateLineSettings,
    getEffectiveLineSettings
  } = useDxfSettings();

  const handleColorChange = (color: string) => {
    updateLineSettings({ color });
  };

  const effectivePreview = getEffectiveLineSettings('preview');

  return (
    <div>
      <p>Current color: {settings.line.color}</p>
      <p>Preview color: {effectivePreview.color}</p>
      <button onClick={() => handleColorChange('#FF0000')}>
        Set Red
      </button>
    </div>
  );
}
```

**When to Use**:
- ✅ When you need full access to settings context
- ✅ When you need to update multiple settings
- ✅ When you need access to meta information (isAutoSaving, hasUnsavedChanges)
- ❌ For simple read-only access (use specialized hooks instead)

---

## 3. UNIFIED SETTINGS HOOKS

### useLineStyles(mode?)

**Purpose**: Get effective line settings for a specific mode

**Signature**:
```typescript
function useLineStyles(mode?: ViewerMode): {
  settings: LineSettings;
  updateSettings: (updates: Partial<LineSettings>) => void;
  resetToDefaults: () => void;
}
```

**Parameters**:
- `mode` (optional): `'normal'` | `'preview'` | `'completion'`
  - If omitted, uses current mode from context

**Returns**:
```typescript
{
  settings: LineSettings;        // Effective settings (General → Specific → Overrides)
  updateSettings: (updates) => void;  // Update general settings
  resetToDefaults: () => void;        // Reset to defaults
}
```

**Usage Examples**:

**1. Preview Phase (Line Drawing)**:
```typescript
function useUnifiedDrawing() {
  const linePreviewStyles = useLineStyles('preview');

  const applyPreviewSettings = (entity: any) => {
    entity.color = linePreviewStyles.settings.color;        // '#FFFF00' (yellow)
    entity.lineType = linePreviewStyles.settings.lineType;  // 'dashed'
    entity.opacity = linePreviewStyles.settings.opacity;    // 0.7
  };

  // Apply to preview entity
  applyPreviewSettings(previewLine);
}
```

**2. Completion Phase (Line Drawing)**:
```typescript
function useUnifiedDrawing() {
  const lineCompletionStyles = useLineStyles('completion');

  const completeEntity = (entity: LineEntity) => {
    entity.color = lineCompletionStyles.settings.color;      // '#00FF00' (green)
    entity.lineType = lineCompletionStyles.settings.lineType; // 'solid'
    entity.opacity = lineCompletionStyles.settings.opacity;   // 1.0
  };
}
```

**3. Dynamic Mode (Follows Current Mode)**:
```typescript
function MyComponent() {
  const lineStyles = useLineStyles(); // No mode parameter

  // Automatically uses current mode from context
  // If mode = 'preview' → preview settings
  // If mode = 'completion' → completion settings
  // If mode = 'normal' → general settings

  return <div style={{ color: lineStyles.settings.color }}>...</div>;
}
```

**When to Use**:
- ✅ In drawing hooks (useUnifiedDrawing, useDrawingHandlers)
- ✅ In rendering components (entity renderers)
- ✅ When you need mode-aware line settings

---

### useTextStyles(mode?)

**Purpose**: Get effective text settings for a specific mode

**Signature**:
```typescript
function useTextStyles(mode?: ViewerMode): {
  settings: TextSettings;
  updateSettings: (updates: Partial<TextSettings>) => void;
  resetToDefaults: () => void;
}
```

**Usage**:
```typescript
function TextRenderer() {
  const textPreviewStyles = useTextStyles('preview');

  const renderText = (ctx: CanvasRenderingContext2D, text: string) => {
    ctx.fillStyle = textPreviewStyles.settings.color;           // Yellow for preview
    ctx.font = `${textPreviewStyles.settings.fontSize}px ${textPreviewStyles.settings.fontFamily}`;
    ctx.globalAlpha = textPreviewStyles.settings.opacity;
    ctx.fillText(text, x, y);
  };
}
```

**When to Use**:
- ✅ In text rendering logic
- ✅ In distance label rendering
- ✅ In dimension annotation rendering

---

### useGripStyles(mode?)

**Purpose**: Get effective grip settings for a specific mode

**Signature**:
```typescript
function useGripStyles(mode?: ViewerMode): {
  settings: GripSettings;
  updateSettings: (updates: Partial<GripSettings>) => void;
  resetToDefaults: () => void;
}
```

**Usage**:
```typescript
function GripRenderer() {
  const gripPreviewStyles = useGripStyles('preview');

  const drawGrip = (ctx: CanvasRenderingContext2D, point: Point2D, state: 'cold' | 'warm' | 'hot') => {
    const size = gripPreviewStyles.settings.gripSize;
    const color = gripPreviewStyles.settings.colors[state];
    const opacity = gripPreviewStyles.settings.opacity;

    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.fillRect(point.x - size/2, point.y - size/2, size, size);
  };
}
```

**When to Use**:
- ✅ In grip rendering logic
- ✅ In entity selection UI
- ✅ In edit mode (drag/resize operations)

---

## 4. LEGACY COMPATIBILITY HOOKS

### useEntityStyles()

**Purpose**: Legacy hook for backward compatibility (DEPRECATED)

**Signature**:
```typescript
function useEntityStyles<T extends EntityType>(
  entityType: T,
  currentMode?: EntityMode,
  overrides?: Partial<EntitySettingsMap[T]>
): EntityStylesHookResult<T>
```

**Status**: ⚠️ **DEPRECATED** - Use `useLineStyles()`, `useTextStyles()`, or `useGripStyles()` instead

**Why Deprecated**:
- Redundant with new unified hooks
- Less type-safe
- Harder to understand (generic entity type)

**Migration Path**:
```typescript
// ❌ OLD: useEntityStyles
const lineStyles = useEntityStyles('line', 'preview');

// ✅ NEW: useLineStyles
const lineStyles = useLineStyles('preview');
```

**When to Use**:
- ⚠️ Only in legacy code that hasn't been migrated yet
- ❌ Don't use in new code

---

### usePreviewMode()

**Purpose**: Get/set current viewer mode

**Signature**:
```typescript
function usePreviewMode(): {
  mode: ViewerMode;
  setMode: (mode: ViewerMode) => void;
}
```

**Usage**:
```typescript
function DrawingToolbar() {
  const { mode, setMode } = usePreviewMode();

  const handleLineToolClick = () => {
    setMode('preview'); // Enter preview mode
  };

  const handleComplete = () => {
    setMode('normal'); // Exit preview mode
  };

  return (
    <div>
      <p>Current mode: {mode}</p>
      <button onClick={handleLineToolClick}>Line Tool</button>
    </div>
  );
}
```

**When to Use**:
- ✅ In toolbar components (tool activation)
- ✅ In drawing lifecycle hooks (mode transitions)
- ✅ In phase manager logic

---

## 5. PROVIDER HOOKS (NEW - Phase 6)

**Added**: 2025-10-07 (Enterprise Refactoring Phase 6)
**Purpose**: Direct access to Provider state με mode-specific settings

### 5.1 useLineDraftSettings()

**Purpose**: Get/update Draft/Προσχεδίαση line settings (specific + overrides)

**Signature**:
```typescript
function useLineDraftSettings(): {
  settings: LineSettings;
  updateSettings: (updates: Partial<LineSettings>) => void;
  getEffectiveSettings: () => LineSettings;
  isOverrideEnabled: boolean;
  toggleOverride: (enabled: boolean) => void;
}
```

**Usage**:
```typescript
function DraftSettingsPanel() {
  const {
    settings,
    updateSettings,
    isOverrideEnabled,
    toggleOverride
  } = useLineDraftSettings();

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isOverrideEnabled}
          onChange={(e) => toggleOverride(e.target.checked)}
        />
        Override General Settings
      </label>
      {isOverrideEnabled && (
        <ColorPicker
          value={settings.color}
          onChange={(color) => updateSettings({ color })}
        />
      )}
    </div>
  );
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Draft" tab (ColorPalettePanel)
- ✅ When editing draft-specific overrides
- ✅ Real-time preview updates with override toggle

---

### 5.2 useLineHoverSettings()

**Purpose**: Get/update Hover line settings (specific + overrides)

**Signature**: Same as `useLineDraftSettings()`

**Usage**:
```typescript
function HoverSettingsPanel() {
  const { settings, updateSettings, isOverrideEnabled } = useLineHoverSettings();

  return (
    <ColorPicker
      value={settings.color}
      onChange={(color) => updateSettings({ color })}
      disabled={!isOverrideEnabled}
    />
  );
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Hover" tab
- ✅ When editing hover-specific overrides

---

### 5.3 useLineSelectionSettings()

**Purpose**: Get/update Selection line settings (specific + overrides)

**Signature**: Same as `useLineDraftSettings()`

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Selection" tab
- ✅ When editing selection-specific overrides

---

### 5.4 useLineCompletionSettings()

**Purpose**: Get/update Completion line settings (specific + overrides)

**Signature**: Same as `useLineDraftSettings()`

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Completion" tab
- ✅ When editing completion-specific overrides

---

### 5.5 useTextDraftSettings()

**Purpose**: Get/update Draft text settings (specific + overrides)

**Signature**:
```typescript
function useTextDraftSettings(): {
  settings: TextSettings;
  updateSettings: (updates: Partial<TextSettings>) => void;
  getEffectiveSettings: () => TextSettings;
  isOverrideEnabled: boolean;
  toggleOverride: (enabled: boolean) => void;
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Text Draft" tab
- ✅ When editing text draft-specific overrides

---

### 5.6 useGripDraftSettings()

**Purpose**: Get/update Draft grip settings (specific + overrides)

**Signature**:
```typescript
function useGripDraftSettings(): {
  settings: GripSettings;
  updateSettings: (updates: Partial<GripSettings>) => void;
  getEffectiveSettings: () => GripSettings;
  isOverrideEnabled: boolean;
  toggleOverride: (enabled: boolean) => void;
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Grip Draft" tab
- ✅ When editing grip draft-specific overrides

---

### 5.7 Provider Hooks Pattern

**Architecture**:
```
useLineDraftSettings()
  ↓
useDxfSettings() (Provider Hook)
  ↓
DxfSettingsProvider (Centralized State)
  ↓
Effective Settings = General → Specific → Overrides
```

**Key Features**:
- ✅ **Direct Provider Access**: No intermediate local state
- ✅ **Real-time Updates**: Override toggle → instant preview update
- ✅ **Auto-Save**: Changes persist to localStorage (500ms debounce)
- ✅ **Type-Safe**: Full TypeScript support with discriminated unions

**Performance**:
- Uses `useMemo` for stable settings objects
- Minimal re-renders (only when relevant settings change)
- No stale closure issues

---

## 6. SPECIALIZED HOOKS

### useLineSettingsFromProvider()

**Purpose**: Get general line settings (no mode awareness)

**Signature**:
```typescript
function useLineSettingsFromProvider(): {
  settings: LineSettings;
  updateSettings: (updates: Partial<LineSettings>) => void;
}
```

**Usage**:
```typescript
function GeneralLineSettings() {
  const { settings, updateSettings } = useLineSettingsFromProvider();

  return (
    <div>
      <p>General line color: {settings.color}</p>
      <button onClick={() => updateSettings({ color: '#FF0000' })}>
        Set Red
      </button>
    </div>
  );
}
```

**When to Use**:
- ✅ In "Γενικές Ρυθμίσεις" tab (ColorPalettePanel)
- ✅ When you explicitly want general settings (no mode logic)
- ❌ For mode-aware settings (use `useLineStyles(mode)` instead)

---

### useUnifiedLinePreview()

**Purpose**: Get/update preview-specific line settings

**Signature**:
```typescript
function useUnifiedLinePreview(): {
  settings: {
    lineSettings: Partial<LineSettings>;
    // ... other preview settings
  };
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  resetToDefaults: () => void;
}
```

**Usage**:
```typescript
function PreviewSettingsPanel() {
  const { settings, updateLineSettings } = useUnifiedLinePreview();

  return (
    <div>
      <h3>Preview Settings</h3>
      <ColorPicker
        value={settings.lineSettings.color}
        onChange={(color) => updateLineSettings({ color })}
      />
    </div>
  );
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Preview" accordion (ColorPalettePanel)
- ✅ When you want to edit preview-specific overrides

---

### useUnifiedLineCompletion()

**Purpose**: Get/update completion-specific line settings

**Signature**:
```typescript
function useUnifiedLineCompletion(): {
  settings: {
    lineSettings: Partial<LineSettings>;
  };
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  resetToDefaults: () => void;
}
```

**Usage**:
```typescript
function CompletionSettingsPanel() {
  const { settings, updateLineSettings } = useUnifiedLineCompletion();

  return (
    <div>
      <h3>Completion Settings</h3>
      <ColorPicker
        value={settings.lineSettings.color}
        onChange={(color) => updateLineSettings({ color })}
      />
    </div>
  );
}
```

**When to Use**:
- ✅ In "Ειδικές Ρυθμίσεις → Completion" accordion (ColorPalettePanel)
- ✅ When you want to edit completion-specific overrides

---

### useConsolidatedSettings() ⚠️ DEPRECATED

**Status**: ❌ **DEPRECATED** - Removed in Phase 8 (Enterprise Refactoring 2025-10-07)

**Why Deprecated**:
- ❌ Used local `useState` instead of centralized Provider
- ❌ Caused preview freeze bugs (4+ hours debugging)
- ❌ No localStorage persistence for specific settings
- ❌ Complex merge logic prone to stale state

**Replacement**:
```typescript
// ❌ OLD: useConsolidatedSettings
const { settings, updateSettings } = useConsolidatedSettings({
  entityType: 'line',
  mode: 'draft',
  generalSettings: lineSettings
});

// ✅ NEW: useLineDraftSettings (Provider Hook)
const {
  settings,
  updateSettings,
  isOverrideEnabled,
  toggleOverride
} = useLineDraftSettings();
```

**Migration Status**:
- ✅ All hooks migrated to Provider Hooks (Phase 7)
- ✅ File renamed to `.deprecated.ts` (Phase 8)
- ✅ Zero usages remaining in codebase
- ✅ ColorPalettePanel now uses compatibility wrappers

**File Location**: `ui/hooks/useConsolidatedSettings.deprecated.ts`

---

## 6. HOOK USAGE PATTERNS

### Pattern 1: Drawing Hook (Preview + Completion)

```typescript
function useUnifiedDrawing() {
  // Get both preview and completion settings
  const linePreviewStyles = useLineStyles('preview');
  const lineCompletionStyles = useLineStyles('completion');

  // Preview phase: Apply preview settings
  const applyPreviewSettings = useCallback((entity: any) => {
    entity.color = linePreviewStyles.settings.color;
    entity.lineType = linePreviewStyles.settings.lineType;
    entity.opacity = linePreviewStyles.settings.opacity;
    // ... more properties
  }, [linePreviewStyles]);

  // Completion phase: Apply completion settings
  const completeEntity = useCallback((entity: LineEntity) => {
    entity.color = lineCompletionStyles.settings.color;
    entity.lineType = lineCompletionStyles.settings.lineType;
    entity.opacity = lineCompletionStyles.settings.opacity;
    // ... more properties
  }, [lineCompletionStyles]);

  // Use in drawing logic
  applyPreviewSettings(previewEntity);
  completeEntity(finalEntity);
}
```

---

### Pattern 2: Settings UI (Edit Specific Settings)

```typescript
function LineSettingsPanel({ contextType }: { contextType: 'preview' | 'completion' | 'general' }) {
  // Dynamic hook selection based on context
  const lineSettings = (() => {
    if (contextType === 'preview') {
      return useUnifiedLinePreview();
    } else if (contextType === 'completion') {
      return useUnifiedLineCompletion();
    } else {
      return useLineSettingsFromProvider();
    }
  })();

  return (
    <div>
      <ColorPicker
        value={lineSettings.settings.color}
        onChange={(color) => lineSettings.updateSettings({ color })}
      />
      <LineWidthSlider
        value={lineSettings.settings.lineWidth}
        onChange={(width) => lineSettings.updateSettings({ lineWidth: width })}
      />
    </div>
  );
}
```

---

### Pattern 3: Rendering with Mode Awareness

```typescript
function EntityRenderer({ entity, currentMode }: { entity: Entity, currentMode: ViewerMode }) {
  // Get settings for current mode
  const lineStyles = useLineStyles(currentMode);

  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    // Apply mode-aware settings
    ctx.strokeStyle = lineStyles.settings.color;
    ctx.lineWidth = lineStyles.settings.lineWidth;
    ctx.globalAlpha = lineStyles.settings.opacity;

    // Draw entity
    ctx.beginPath();
    ctx.moveTo(entity.start.x, entity.start.y);
    ctx.lineTo(entity.end.x, entity.end.y);
    ctx.stroke();
  }, [entity, lineStyles]);

  return <canvas ref={canvasRef} />;
}
```

---

### Pattern 4: Mode Transition

```typescript
function DrawingManager() {
  const { mode, setMode } = usePreviewMode();

  const handleToolActivate = (tool: string) => {
    if (tool === 'line' || tool === 'polyline') {
      setMode('preview'); // Enter preview mode
    }
  };

  const handleDrawingComplete = () => {
    setMode('normal'); // Exit to normal mode
  };

  useEffect(() => {
    console.log('Mode changed to:', mode);
    // React to mode change
  }, [mode]);

  return (
    <div>
      <Toolbar onToolActivate={handleToolActivate} />
      <Canvas onDrawingComplete={handleDrawingComplete} />
    </div>
  );
}
```

---

## 7. COMMON PITFALLS

### Pitfall 1: Using Wrong Hook for Context

```typescript
// ❌ WRONG: Using general hook in preview context
function PreviewRenderer() {
  const lineSettings = useLineSettingsFromProvider(); // Returns general settings!
  entity.color = lineSettings.settings.color; // Won't use preview color
}

// ✅ CORRECT: Using mode-specific hook
function PreviewRenderer() {
  const lineStyles = useLineStyles('preview'); // Returns preview settings ✅
  entity.color = lineStyles.settings.color; // Uses preview color ✅
}
```

---

### Pitfall 2: Missing Mode Parameter

```typescript
// ❌ WRONG: No mode parameter, uses current mode (may be wrong)
function MyComponent() {
  const lineStyles = useLineStyles(); // What mode is this?

  // If current mode is 'normal', but you expect 'preview' → BUG!
  entity.color = lineStyles.settings.color;
}

// ✅ CORRECT: Explicit mode parameter
function MyComponent() {
  const lineStyles = useLineStyles('preview'); // Explicit! ✅
  entity.color = lineStyles.settings.color;
}
```

---

### Pitfall 3: Updating Wrong Settings Layer

```typescript
// ❌ WRONG: Updating general settings from preview panel
function PreviewPanel() {
  const { updateLineSettings } = useDxfSettings();

  const handleColorChange = (color: string) => {
    updateLineSettings({ color }); // Updates GENERAL, not preview! ❌
  };
}

// ✅ CORRECT: Updating preview-specific settings
function PreviewPanel() {
  const { updateLineSettings } = useUnifiedLinePreview();

  const handleColorChange = (color: string) => {
    updateLineSettings({ color }); // Updates PREVIEW ✅
  };
}
```

---

### Pitfall 4: Not Using Effective Settings

```typescript
// ❌ WRONG: Accessing state.line directly (ignores specific/overrides)
function MyComponent() {
  const { settings } = useDxfSettings();
  entity.color = settings.line.color; // Only general settings!
}

// ✅ CORRECT: Using effective settings
function MyComponent() {
  const lineStyles = useLineStyles('preview');
  entity.color = lineStyles.settings.color; // General + Specific + Overrides ✅
}
```

---

### Pitfall 5: Stale Closure in useCallback

```typescript
// ❌ WRONG: Missing dependency, stale settings
function MyComponent() {
  const lineStyles = useLineStyles('preview');

  const render = useCallback(() => {
    entity.color = lineStyles.settings.color; // Stale value!
  }, []); // ❌ Missing dependency!

  useEffect(() => {
    render();
  }, [render]);
}

// ✅ CORRECT: Include settings in dependencies
function MyComponent() {
  const lineStyles = useLineStyles('preview');

  const render = useCallback(() => {
    entity.color = lineStyles.settings.color; // Fresh value ✅
  }, [lineStyles.settings]); // ✅ Correct dependency

  useEffect(() => {
    render();
  }, [render]);
}
```

---

## 8. PERFORMANCE OPTIMIZATION

### Optimization 1: useMemo for Derived Values

```typescript
// ✅ Memoize expensive calculations
function MyComponent() {
  const lineStyles = useLineStyles('preview');

  const dashArray = useMemo(() => {
    return getDashArray(
      lineStyles.settings.lineType,
      lineStyles.settings.dashScale
    );
  }, [lineStyles.settings.lineType, lineStyles.settings.dashScale]);

  return <Canvas dashArray={dashArray} />;
}
```

---

### Optimization 2: Selective Hook Usage

```typescript
// ❌ BAD: Using full context when only need one setting
function MyComponent() {
  const { settings, updateLineSettings, getEffectiveLineSettings, ... } = useDxfSettings();
  // Only using settings.line.color, but subscribed to entire context!
  return <div style={{ color: settings.line.color }}>...</div>;
}

// ✅ GOOD: Use specialized hook
function MyComponent() {
  const lineStyles = useLineStyles(); // Only subscribes to line settings
  return <div style={{ color: lineStyles.settings.color }}>...</div>;
}
```

---

### Optimization 3: Avoid Hook Calls in Loops

```typescript
// ❌ BAD: Hook in loop (violates React rules)
function MyComponent({ entities }) {
  return entities.map(entity => {
    const lineStyles = useLineStyles(); // ❌ Hook in loop!
    return <Entity style={lineStyles.settings} />;
  });
}

// ✅ GOOD: Hook outside loop
function MyComponent({ entities }) {
  const lineStyles = useLineStyles(); // ✅ Hook at top level

  return entities.map(entity => (
    <Entity style={lineStyles.settings} />
  ));
}
```

---

### Optimization 4: Debounce Updates

```typescript
function ColorPicker() {
  const { updateLineSettings } = useDxfSettings();
  const [localColor, setLocalColor] = useState('#FFFFFF');

  // Debounce updates to settings
  const debouncedUpdate = useMemo(
    () => debounce((color: string) => {
      updateLineSettings({ color });
    }, 300),
    [updateLineSettings]
  );

  const handleChange = (color: string) => {
    setLocalColor(color); // Update UI immediately
    debouncedUpdate(color); // Update settings after 300ms
  };

  return <input type="color" value={localColor} onChange={e => handleChange(e.target.value)} />;
}
```

---

## 📚 CROSS-REFERENCES

### Related Documentation

- **[00-INDEX.md](./00-INDEX.md)** - Documentation hub
- **[01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)** - System architecture
- **[03-DXFSETTINGSPROVIDER.md](./03-DXFSETTINGSPROVIDER.md)** - Provider that these hooks use
- **[06-SETTINGS_FLOW.md](./06-SETTINGS_FLOW.md)** - Settings lifecycle
- **[08-LINE_DRAWING_INTEGRATION.md](./08-LINE_DRAWING_INTEGRATION.md)** - Hooks in action

### Related Code Files

**Main Provider (Hook Implementations)**:
- [`providers/DxfSettingsProvider.tsx`](../../providers/DxfSettingsProvider.tsx) (1,659 lines)
  - [useDxfSettings Hook](../../providers/DxfSettingsProvider.tsx#L970-L980) (lines 970-980)
  - [Context Value Construction](../../providers/DxfSettingsProvider.tsx#L1000-L1050) (lines 1000-1050)
  - [Effective Settings Helpers](../../providers/DxfSettingsProvider.tsx#L800-L850) (lines 800-850)

**Unified Hooks**:
- [`hooks/useUnifiedSpecificSettings.ts`](../../hooks/useUnifiedSpecificSettings.ts) - Primary unified hooks
  - `useLineStyles(mode)` - Line settings for specific mode
  - `useTextStyles(mode)` - Text settings for specific mode
  - `useGripStyles(mode)` - Grip settings for specific mode

**Legacy Hooks (Deprecated)**:
- [`hooks/useEntityStyles.ts`](../../hooks/useEntityStyles.ts) - Legacy compatibility wrapper (use unified hooks instead)
- [`hooks/usePreviewMode.ts`](../../hooks/usePreviewMode.ts) - Mode management hook

**Usage Examples**:
- [`hooks/drawing/useUnifiedDrawing.ts`](../../hooks/drawing/useUnifiedDrawing.ts) - Real-world hook usage
- [`hooks/drawing/useDrawingHandlers.ts`](../../hooks/drawing/useDrawingHandlers.ts) - Drawing integration

---

## 🎯 QUICK REFERENCE

| Need | Hook | Example |
|------|------|---------|
| Preview line settings | `useLineStyles('preview')` | `lineStyles.settings.color` |
| Completion line settings | `useLineStyles('completion')` | `lineStyles.settings.color` |
| General line settings | `useLineSettingsFromProvider()` | `settings.color` |
| Preview text settings | `useTextStyles('preview')` | `textStyles.settings.fontSize` |
| Preview grip settings | `useGripStyles('preview')` | `gripStyles.settings.gripSize` |
| Edit preview settings | `useUnifiedLinePreview()` | `updateLineSettings({ color })` |
| Edit completion settings | `useUnifiedLineCompletion()` | `updateLineSettings({ color })` |
| Get/set mode | `usePreviewMode()` | `setMode('preview')` |
| Full context access | `useDxfSettings()` | `updateLineSettings({ ... })` |

---

**END OF CHAPTER 04**

---

**Next Chapter**: [05 - UI Components →](./05-UI_COMPONENTS.md)
**Previous Chapter**: [← 03 - DxfSettingsProvider](./03-DXFSETTINGSPROVIDER.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
