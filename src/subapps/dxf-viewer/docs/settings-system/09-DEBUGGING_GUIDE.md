# CHAPTER 09 - DEBUGGING GUIDE

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete (Expanded)
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Debugging Tools](#debugging-tools)
4. [Step-by-Step Diagnostics](#step-by-step-diagnostics)
5. [Advanced Debugging Techniques](#advanced-debugging-techniques)
6. [Prevention Best Practices](#prevention-best-practices)
7. [Cross-References](#cross-references)

---

## 📖 OVERVIEW

Αυτό το κεφάλαιο παρέχει **πρακτικά εργαλεία και τεχνικές debugging** για το settings system.

**Common Problem Categories**:
1. ❌ **Settings Not Persisting** (localStorage issues)
2. ❌ **Preview Settings Not Applied** (mode/context mismatch)
3. ❌ **Overrides Not Working** (hierarchy issues)
4. ❌ **Auto-Save Failing** (validation/serialization errors)
5. ❌ **Preview Not Updating When Override Enabled** (UNRESOLVED - as of 2025-10-06)
6. ❌ **UI Not Updating** (React re-render issues)

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue 1: Settings Not Persisting After Page Reload

**Symptom**: User changes settings, refreshes page, settings reset to defaults.

**Diagnosis Checklist**:
```typescript
// 1. Check if localStorage is available
const hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
console.log('localStorage available?', hasLocalStorage);

// 2. Check if settings are saved
const saved = localStorage.getItem('dxf-settings-v1');
console.log('Saved settings:', saved);
// → null or undefined? Settings not saved!
// → valid JSON string? Settings saved ✅

// 3. Check save status
const { saveStatus } = useDxfSettings();
console.log('Save status:', saveStatus);
// → 'error'? Check console for errors
// → 'saved'? Settings should persist
```

---

**Root Causes & Solutions**:

#### Cause 1: Browser in Private/Incognito Mode
**Detection**:
```typescript
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
  console.log('localStorage works ✅');
} catch (e) {
  console.error('localStorage disabled ❌');
  console.error('Reason:', e.message);
  // → QuotaExceededError in private mode
}
```

**Solution**: Ask user to enable normal browsing mode or use session storage fallback.

---

#### Cause 2: Auto-Save Failed (Validation Error)
**Detection**:
```typescript
// Check console for validation errors
// Example error: "Invalid color format: #GGGGGG"

// Manual save test
const { settings } = useDxfSettings();
try {
  const serialized = JSON.stringify(settings);
  localStorage.setItem('dxf-settings-v1-test', serialized);
  console.log('Manual save succeeded ✅');
} catch (error) {
  console.error('Manual save failed ❌', error);
  // → Circular reference?
  // → Non-serializable value?
}
```

**Solution**: Fix invalid values before saving (validation layer should catch these).

---

#### Cause 3: Auto-Save Disabled
**Detection**:
```typescript
// Check if auto-save effect is running
// Add debug log to DxfSettingsProvider.tsx line 350:

useEffect(() => {
  console.log('[DEBUG] Auto-save effect triggered');  // Should appear on every state change

  if (!initialLoadComplete) {
    console.log('[DEBUG] Skipping save (initial load)');
    return;
  }

  const saveTimer = setTimeout(() => {
    console.log('[DEBUG] Saving settings...');
    saveSettings(settings);
  }, 500);

  return () => clearTimeout(saveTimer);
}, [settings, initialLoadComplete]);
```

**Solution**: Ensure `initialLoadComplete` is set to `true` after initial load.

---

### Issue 2: Preview Settings Not Applied

**Symptom**: User changes preview color to red, but drawn line still shows yellow.

**Diagnosis**:
```typescript
// 1. Check if using correct hook
const lineStyles = useLineStyles('preview');  // ✅ Correct
console.log('Preview color:', lineStyles.settings.color);
// → Should match UI setting

// ❌ WRONG: Using general settings instead of preview
const generalStyles = useLineSettingsFromProvider();
console.log('General color:', generalStyles.settings.color);
// → This will NOT reflect preview-specific changes!

// 2. Check context type in LineSettings component
// LineSettings.tsx line 62:
const activeContext = contextType || 'general';
console.log('Active context:', activeContext);
// → Should be 'preview' when used in EntitiesSettings → Preview accordion
// → If 'general', component is not receiving contextType prop!

// 3. Verify settings in provider
const { settings } = useDxfSettings();
console.log('Preview settings:', settings.specific.line.preview);
// → Should contain updated color
```

---

**Root Causes & Solutions**:

#### Cause 1: Wrong Hook Usage
**Problem**:
```typescript
// ❌ WRONG
const lineSettings = useLineSettingsFromProvider();  // General only!

// Preview changes won't be reflected
```

**Solution**:
```typescript
// ✅ CORRECT
const lineSettings = useLineStyles('preview');  // Mode-specific!

// OR (more explicit)
const { settings } = useUnifiedLinePreview();
const lineSettings = settings.lineSettings;
```

---

#### Cause 2: Missing contextType Prop
**Problem**:
```typescript
// EntitiesSettings.tsx
<AccordionSection title="Preview Settings">
  <LineSettings />  {/* ❌ Missing contextType! */}
</AccordionSection>
```

**Solution**:
```typescript
// ✅ CORRECT
<AccordionSection title="Preview Settings">
  <LineSettings contextType="preview" />  {/* ✅ Explicit context */}
</AccordionSection>
```

---

#### Cause 3: Override Disabled
**Problem**: User changed preview settings, but override is not enabled.

**Detection**:
```typescript
const { settings } = useDxfSettings();
console.log('Override enabled?', settings.overrideEnabled.line);
// → false? Preview settings won't be used!
```

**Solution**: Enable override first:
```typescript
const { toggleLineOverride } = useDxfSettings();
toggleLineOverride(true);  // Enable override for preview/completion
```

---

### Issue 3: Overrides Not Working

**Symptom**: User enabled override and changed settings, but general settings still apply.

**Diagnosis**:
```typescript
// 1. Check override flag
const { settings } = useDxfSettings();
console.log('Override enabled:', settings.overrideEnabled.line);
// → Should be true

// 2. Check override values
console.log('Override settings:', settings.overrides.line.preview);
// → Should contain user customizations

// 3. Check effective settings calculation
const lineStyles = useLineStyles('preview');
console.log('Effective settings:', lineStyles.settings);
// → Should include override values

// 4. Debug hierarchy
console.log('Hierarchy check:');
console.log('  General:', settings.line.color);
console.log('  Specific (preview):', settings.specific.line.preview.color);
console.log('  Override (preview):', settings.overrides.line.preview.color);
console.log('  Override enabled:', settings.overrideEnabled.line);
console.log('  Effective:', lineStyles.settings.color);
// → Trace which layer is being used
```

---

**Root Cause & Solution**:

**Problem**: Effective settings calculation not including overrides.

**Expected Hierarchy** (from lowest to highest priority):
```typescript
// 1. General settings (base layer)
const general = settings.line;

// 2. Specific settings (mode layer)
const specific = settings.specific.line.preview;

// 3. Override settings (user customizations)
const override = settings.overrides.line.preview;

// 4. Effective settings (calculated)
const effective = {
  ...general,                          // Base
  ...specific,                         // Override base
  ...(overrideEnabled ? override : {}) // User customizations (if enabled)
};
```

**Solution**: Verify `useLineStyles()` hook calculates hierarchy correctly.

---

### Issue 4: Auto-Save Failing Silently

**Symptom**: Settings change in UI, but never saved to localStorage.

**Diagnosis**:
```typescript
// 1. Monitor auto-save status
const { saveStatus } = useDxfSettings();

useEffect(() => {
  console.log('[AUTO-SAVE] Status changed:', saveStatus);

  if (saveStatus === 'error') {
    console.error('[AUTO-SAVE] Save failed! Check console for errors.');
  }
}, [saveStatus]);

// 2. Check for errors in save function
// Add try-catch logging to DxfSettingsProvider.tsx line 360:

try {
  const serialized = JSON.stringify(settings);
  console.log('[AUTO-SAVE] Serialized length:', serialized.length);

  localStorage.setItem('dxf-settings-v1', serialized);
  console.log('[AUTO-SAVE] Saved successfully ✅');
} catch (error) {
  console.error('[AUTO-SAVE] Error:', error);
  console.error('[AUTO-SAVE] Settings object:', settings);
  // → Check if settings contain non-serializable values
}

// 3. Test serialization manually
const testSerialize = (obj: any) => {
  try {
    JSON.stringify(obj);
    return true;
  } catch (e) {
    return false;
  }
};

console.log('Can serialize line settings?', testSerialize(settings.line));
console.log('Can serialize text settings?', testSerialize(settings.text));
console.log('Can serialize grip settings?', testSerialize(settings.grip));
// → false? Find the problematic setting
```

---

**Root Causes & Solutions**:

#### Cause 1: Circular References
**Problem**: Settings object contains circular references (A → B → A).

**Detection**:
```typescript
// Error: Converting circular structure to JSON
```

**Solution**: Ensure settings are plain objects (no class instances, no circular refs).

---

#### Cause 2: Non-Serializable Values
**Problem**: Settings contain functions, Symbols, or other non-JSON types.

**Detection**:
```typescript
const checkSerializable = (obj: any, path = 'root') => {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${path}.${key}`;

    if (typeof value === 'function') {
      console.error(`[SERIALIZATION] Function at ${currentPath}`);
    } else if (typeof value === 'symbol') {
      console.error(`[SERIALIZATION] Symbol at ${currentPath}`);
    } else if (value && typeof value === 'object') {
      checkSerializable(value, currentPath);
    }
  }
};

checkSerializable(settings);
```

**Solution**: Remove non-serializable values from settings.

---

### Issue 5: Preview Not Updating When Override Enabled (UNRESOLVED)

**Symptom**: User enables "Παράκαμψη Γενικών Ρυθμίσεων" (Override General Settings) checkbox in Ειδικές Ρυθμίσεις → Σχεδίαση → Προσχεδίαση, but preview continues showing General Settings instead of specific preview settings.

**Affected Components**:
- ✅ Line preview (Γραμμή)
- ✅ Text preview (Κείμενο)
- ✅ Grips preview (Grips)

**Current Status**: ❌ **UNRESOLVED** (as of 2025-10-06)

**What We Tried**:

#### Attempt 1: Add useMemo to Effective Settings (FAILED)
```typescript
// EntitiesSettings.tsx - Lines 112-121
// Added useMemo to ensure re-calculation when hooks change
const effectiveLineDraftSettings = useMemo(() => getEffectiveLineDraftSettings(), [getEffectiveLineDraftSettings]);
const effectiveTextSettings = useMemo(() => getEffectiveTextSettings(), [getEffectiveTextSettings]);
const effectiveGripSettings = useMemo(() => getEffectiveGripSettings(), [getEffectiveGripSettings]);

// Result: Preview still shows General Settings when override is ON
```

#### Attempt 2: Update All SubTabRenderer Props (FAILED)
```typescript
// EntitiesSettings.tsx - Lines 363-365
// Changed from function calls to memoized values
lineSettings={effectiveLineDraftSettings}  // Instead of getEffectiveLineDraftSettings()
textSettings={effectiveTextSettings}
gripSettings={effectiveGripSettings}

// Result: Preview still shows General Settings when override is ON
```

**Root Cause**: Unknown (requires further investigation)

**Hypothesis**:
1. ❓ Override checkbox state not triggering re-calculation of effective settings
2. ❓ `useConsolidatedSettings` hook not detecting override flag changes
3. ❓ SubTabRenderer not receiving updated props (React batching issue?)
4. ❓ LinePreview component has stale settings (memoization issue?)

**Next Steps for Investigation**:
1. Add console.log to `useConsolidatedSettings.getEffectiveSettings()` to track when it runs
2. Verify override flag changes trigger re-renders in EntitiesSettings
3. Check if SubTabRenderer receives new props when override toggles
4. Inspect LinePreview component for prop change detection

**Temporary Workaround**: None available - user must use General Settings until fixed.

---

### Issue 6: UI Not Updating After Settings Change

**Symptom**: Settings change in localStorage, but UI doesn't reflect new values.

**Diagnosis**:
```typescript
// 1. Check if component is consuming context
const { settings } = useDxfSettings();
console.log('Component is consuming context ✅');

// 2. Verify re-render trigger
useEffect(() => {
  console.log('[RE-RENDER] Settings changed:', settings.line.color);
}, [settings]);
// → Should log on every settings change

// 3. Check for stale closures
const handleClick = () => {
  // ❌ WRONG: Capturing stale settings
  console.log('Settings:', settings);  // May be stale if not in dependency array
};

// ✅ CORRECT: Use callback with updated settings
const handleClick = useCallback(() => {
  console.log('Settings:', settings);
}, [settings]);

// 4. Check React DevTools
// Components → DxfSettingsProvider → hooks → State
// → Verify state contains updated values
```

---

**Root Cause & Solution**:

**Problem**: Component not re-rendering when context changes.

**Solution 1**: Ensure component consumes context:
```typescript
// ❌ WRONG: Component doesn't consume context
function MyComponent() {
  const lineSettings = { color: '#FF0000' };  // Hardcoded!
  // ...
}

// ✅ CORRECT: Component consumes context
function MyComponent() {
  const { settings } = useDxfSettings();
  const lineSettings = settings.line;
  // → Component re-renders when settings change
}
```

**Solution 2**: Memoize expensive computations:
```typescript
// ❌ WRONG: Expensive calculation on every render
function MyComponent() {
  const { settings } = useDxfSettings();

  // Re-calculates on EVERY render (even if settings unchanged)
  const effectiveSettings = calculateEffectiveSettings(settings);
  // ...
}

// ✅ CORRECT: Memoized calculation
function MyComponent() {
  const { settings } = useDxfSettings();

  const effectiveSettings = useMemo(() => {
    return calculateEffectiveSettings(settings);
  }, [settings]);  // Only re-calculates when settings change
  // ...
}
```

---

## 🔍 DEBUGGING TOOLS

### 1. React DevTools

**Installation**: Chrome/Firefox extension "React Developer Tools"

**Usage**:
```
1. Open browser DevTools (F12)
2. Navigate to "Components" tab
3. Find <DxfSettingsProvider> in component tree
4. Inspect hooks:
   ├─ State: Current settings object
   ├─ Reducer: Dispatch function
   └─ Effects: Auto-save timer

5. Inspect state structure:
   settings:
     ├─ line: { color, lineWidth, ... }
     ├─ text: { fontFamily, fontSize, ... }
     ├─ grip: { gripSize, colors, ... }
     ├─ specific:
     │  ├─ line:
     │  │  ├─ preview: { ... }
     │  │  └─ completion: { ... }
     ├─ overrides: { ... }
     └─ overrideEnabled: { line: true, ... }

6. Click "Edit" to manually change values (useful for testing)
```

---

### 2. Console Logging Strategy

**Strategic Log Points**:
```typescript
// DxfSettingsProvider.tsx
console.group('[SETTINGS] Update triggered');
console.log('Action type:', action.type);
console.log('Payload:', action.payload);
console.log('Current state:', state);
console.log('New state:', newState);
console.groupEnd();

// useLineStyles.ts
console.log('[HOOK] useLineStyles called with mode:', mode);
console.log('[HOOK] Effective settings:', effectiveSettings);

// hooks/drawing/useDrawingHandlers.ts
console.log('[DRAWING] Applying preview settings:', lineStyles.settings);
console.log('[DRAWING] Preview entity:', previewEntity);

// DxfSettingsPanel.tsx
console.log('[UI] Color changed:', newColor);
console.log('[UI] Context type:', contextType);
```

---

### 3. localStorage Inspection

**Browser DevTools → Application Tab → localStorage**:
```javascript
// View saved settings
const saved = localStorage.getItem('dxf-settings-v1');
console.log('Saved settings (raw):', saved);

const parsed = JSON.parse(saved);
console.log('Saved settings (parsed):', parsed);

// Clear settings (reset to defaults)
localStorage.removeItem('dxf-settings-v1');
location.reload();

// Manually edit settings
const settings = JSON.parse(localStorage.getItem('dxf-settings-v1'));
settings.line.color = '#FF0000';  // Change color to red
localStorage.setItem('dxf-settings-v1', JSON.stringify(settings));
location.reload();

// Compare with defaults
const defaults = {
  line: { color: '#FFFFFF', lineWidth: 1, ... },
  // ... default structure
};
console.log('Differences from defaults:', diffObjects(defaults, parsed));
```

---

### 4. Network Tab (Auto-Save Monitoring)

**Note**: localStorage writes don't appear in Network tab, but you can use Performance Monitor:

```javascript
// Performance.mark API για tracking saves
// Add to DxfSettingsProvider.tsx:

useEffect(() => {
  const saveTimer = setTimeout(() => {
    performance.mark('settings-save-start');

    try {
      saveSettings(settings);
      performance.mark('settings-save-end');

      performance.measure('settings-save', 'settings-save-start', 'settings-save-end');

      const measure = performance.getEntriesByName('settings-save')[0];
      console.log(`[PERF] Save took ${measure.duration}ms`);
    } catch (error) {
      console.error('[AUTO-SAVE] Failed:', error);
    }
  }, 500);

  return () => clearTimeout(saveTimer);
}, [settings]);
```

---

## 🔬 STEP-BY-STEP DIAGNOSTICS

### Diagnostic Flow for "Settings Not Persisting"

```
STEP 1: Verify localStorage works
  ├─ Test: localStorage.setItem('test', 'test')
  ├─ Success? → Continue to STEP 2
  └─ Failure? → Browser issue (private mode, disabled storage)

STEP 2: Check auto-save is triggering
  ├─ Add console.log to auto-save effect
  ├─ Change a setting
  ├─ Wait 500ms
  ├─ Log appears? → Continue to STEP 3
  └─ No log? → Auto-save effect not running (check initialLoadComplete)

STEP 3: Verify serialization works
  ├─ Test: JSON.stringify(settings)
  ├─ Success? → Continue to STEP 4
  └─ Failure? → Non-serializable value in settings

STEP 4: Check localStorage contains settings
  ├─ Inspect: localStorage.getItem('dxf-settings-v1')
  ├─ Contains settings? → Continue to STEP 5
  └─ null/undefined? → Save not completing (check errors in console)

STEP 5: Verify settings load on page reload
  ├─ Reload page
  ├─ Check: settings state in React DevTools
  ├─ Matches localStorage? → ✅ Working!
  └─ Doesn't match? → Load function has bug

SOLUTION FOUND!
  └─ Apply fix based on failing step
```

---

## 🛠️ ADVANCED DEBUGGING TECHNIQUES

### 1. Redux DevTools Integration (Advanced)

**Optional**: Integrate Redux DevTools for time-travel debugging:

```typescript
// Install: npm install --save-dev @redux-devtools/extension

// DxfSettingsProvider.tsx
import { devToolsEnhancer } from '@redux-devtools/extension';

const [settings, dispatch] = useReducer(
  settingsReducer,
  initialState,
  devToolsEnhancer({ name: 'DxfSettings' })  // Enable DevTools
);
```

**Features**:
- ✅ Time-travel debugging (undo/redo state changes)
- ✅ Action history (see all dispatched actions)
- ✅ State diff (compare before/after state)
- ✅ Export/import state (save/restore states)

---

### 2. Performance Profiling

**Identify expensive re-renders**:
```typescript
// React DevTools → Profiler tab
// 1. Start recording
// 2. Change settings
// 3. Stop recording
// 4. Analyze:
//    - Which components re-rendered?
//    - How long did renders take?
//    - Unnecessary renders? (props didn't change)
```

---

### 3. Custom Debug Hook

```typescript
// hooks/useDebugSettings.ts
export function useDebugSettings() {
  const { settings } = useDxfSettings();

  useEffect(() => {
    console.group('[DEBUG] Settings State');
    console.log('Line:', settings.line);
    console.log('Text:', settings.text);
    console.log('Grip:', settings.grip);
    console.log('Specific:', settings.specific);
    console.log('Overrides:', settings.overrides);
    console.log('Override Enabled:', settings.overrideEnabled);
    console.groupEnd();
  }, [settings]);

  return {
    dumpSettings: () => console.log('[DUMP]', JSON.stringify(settings, null, 2)),
    resetSettings: () => localStorage.removeItem('dxf-settings-v1'),
    testSerialization: () => {
      try {
        JSON.stringify(settings);
        return true;
      } catch (e) {
        console.error('[SERIALIZATION ERROR]', e);
        return false;
      }
    }
  };
}

// Usage:
const { dumpSettings, resetSettings, testSerialization } = useDebugSettings();
```

---

## ✅ PREVENTION BEST PRACTICES

### 1. Always Use Correct Hooks

```typescript
// ✅ DO: Use mode-specific hooks
const previewSettings = useLineStyles('preview');
const completionSettings = useLineStyles('completion');

// ❌ DON'T: Use general hook for mode-specific settings
const settings = useLineSettingsFromProvider();  // No mode awareness!
```

---

### 2. Validate Before Updating

```typescript
// ✅ DO: Use settingsUpdater with validation
const settingsUpdater = useSettingsUpdater({
  updateSettings,
  validator: (value, key) => {
    if (key === 'color') return commonValidators.hexColor(value);
    return true;
  }
});

<input onChange={settingsUpdater.createColorHandler('color')} />

// ❌ DON'T: Direct updates without validation
<input onChange={(e) => updateSettings({ color: e.target.value })} />
```

---

### 3. Test Serialization in Development

```typescript
// Add to DxfSettingsProvider.tsx (development only)
if (process.env.NODE_ENV === 'development') {
  useEffect(() => {
    try {
      JSON.stringify(settings);
    } catch (e) {
      console.error('[DEV] Settings not serializable:', e);
    }
  }, [settings]);
}
```

---

### 4. Monitor Auto-Save Status

```typescript
// Show save status in UI (development mode)
const { saveStatus } = useDxfSettings();

{process.env.NODE_ENV === 'development' && (
  <div className="fixed top-0 right-0 p-2 bg-gray-800 text-white text-xs">
    Save Status: {saveStatus}
    {saveStatus === 'error' && ' ❌'}
    {saveStatus === 'saved' && ' ✅'}
  </div>
)}
```

---

## 📚 CROSS-REFERENCES

### Related Documentation
- **[03-DXFSETTINGSPROVIDER.md](./03-DXFSETTINGSPROVIDER.md)** - Provider internals
- **[04-HOOKS_REFERENCE.md](./04-HOOKS_REFERENCE.md)** - Hooks API & usage patterns
- **[06-SETTINGS_FLOW.md](./06-SETTINGS_FLOW.md)** - Complete data flow
- **[08-LINE_DRAWING_INTEGRATION.md](./08-LINE_DRAWING_INTEGRATION.md)** - Common drawing issues

### External Resources
- [React DevTools Documentation](https://react.dev/learn/react-developer-tools)
- [Chrome DevTools Application Panel](https://developer.chrome.com/docs/devtools/storage/localstorage/)
- [localStorage Debugging Guide](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

**END OF CHAPTER 09**

---

**Next Chapter**: [10 - Migration Guide →](./10-MIGRATION_GUIDE.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
