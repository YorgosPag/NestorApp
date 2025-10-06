# BUGFIX LOG - Settings System

**DXF Viewer Settings System - Bug Tracking**
**Created**: 2025-10-06
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Active Bugs](#active-bugs)
2. [Fixed Bugs](#fixed-bugs)
3. [Investigation Notes](#investigation-notes)

---

## 🐛 ACTIVE BUGS

### BUG #1: Preview Not Updating When Override Enabled

**Status**: ❌ **UNRESOLVED**
**Severity**: 🔴 **HIGH** (Affects core functionality)
**Discovered**: 2025-10-06
**Location**: `EntitiesSettings.tsx` → Προσχεδίαση (Preview) tab

**Description**:
When user enables "Παράκαμψη Γενικών Ρυθμίσεων" (Override General Settings) checkbox in:
- Ρυθμίσεις DXF → Ειδικές Ρυθμίσεις → Σχεδίαση → **Προσχεδίαση** (Preview)

The preview panel continues to display General Settings instead of the specific preview settings.

**Affected Components**:
- ✅ Line preview (Γραμμή) - Shows general line color/type instead of preview-specific
- ✅ Text preview (Κείμενο) - Shows general text settings instead of preview-specific
- ✅ Grips preview (Grips) - Shows general grip settings instead of preview-specific

**Steps to Reproduce**:
1. Navigate to: Ρυθμίσεις DXF → Ειδικές Ρυθμίσεις → Σχεδίαση
2. Click "Προσχεδίαση" (Preview) tab
3. Click "Γραμμή" (Line) sub-tab
4. Enable "Παράκαμψη Γενικών Ρυθμίσεων" checkbox
5. Change line color from #FFFFFF to #FF0000 (red)
6. **BUG**: Preview still shows white line (general setting)

**Expected Behavior**:
Preview should immediately update to show red line (preview-specific setting).

**Actual Behavior**:
Preview continues showing white line (ignores override and specific settings).

---

### Fix Attempts (FAILED)

#### Attempt #1: Add useMemo to Effective Settings
**Date**: 2025-10-06
**Result**: ❌ FAILED

**Code Changes**:
```typescript
// File: EntitiesSettings.tsx
// Lines: 112-121

// BEFORE (calling functions directly - no memoization)
const effectiveTextSettings = getEffectiveTextSettings();
const effectiveGripSettings = getEffectiveGripSettings();

// AFTER (added useMemo)
const effectiveLineDraftSettings = useMemo(() => getEffectiveLineDraftSettings(), [getEffectiveLineDraftSettings]);
const effectiveLineHoverSettings = useMemo(() => getEffectiveLineHoverSettings(), [getEffectiveLineHoverSettings]);
const effectiveLineSelectionSettings = useMemo(() => getEffectiveLineSelectionSettings(), [getEffectiveLineSelectionSettings]);
const effectiveLineCompletionSettings = useMemo(() => getEffectiveLineCompletionSettings(), [getEffectiveLineCompletionSettings]);
const effectiveTextSettings = useMemo(() => getEffectiveTextSettings(), [getEffectiveTextSettings]);
const effectiveGripSettings = useMemo(() => getEffectiveGripSettings(), [getEffectiveGripSettings]);
```

**Hypothesis**: Functions were called only once (on mount), so changes to override flag or settings didn't trigger re-calculation.

**Why It Failed**: Preview still shows general settings when override is ON. The `useMemo` dependencies correctly trigger re-calculation, but the underlying data source appears incorrect.

---

#### Attempt #2: Update SubTabRenderer Props
**Date**: 2025-10-06
**Result**: ❌ FAILED

**Code Changes**:
```typescript
// File: EntitiesSettings.tsx
// Lines: 363-365, 403, 436, 469, 475

// BEFORE (function calls)
<SubTabRenderer
  lineSettings={getEffectiveLineDraftSettings()}
  textSettings={getEffectiveTextSettings()}
  gripSettings={getEffectiveGripSettings()}
/>

// AFTER (memoized values)
<SubTabRenderer
  lineSettings={effectiveLineDraftSettings}
  textSettings={effectiveTextSettings}
  gripSettings={effectiveGripSettings}
/>
```

**Hypothesis**: Direct function calls in JSX were not re-executing on state changes.

**Why It Failed**: Preview still shows general settings. The memoized values are correctly passed as props, but the data inside them is still pointing to general settings.

---

### Current Hypotheses

**Hypothesis A**: Override flag not synced with unified hooks
```typescript
// Possible issue in useUnifiedLineDraft() or useConsolidatedSettings()
// Override checkbox changes state, but getEffectiveSettings() doesn't see it
```

**Hypothesis B**: Settings data flow broken
```typescript
// Flow: EntitiesSettings → useUnifiedLineDraft → useConsolidatedSettings → getEffectiveSettings
// Somewhere in this chain, override flag is not being respected
```

**Hypothesis C**: React batching issue
```typescript
// Override flag updates, but React batches the update
// getEffectiveSettings() runs before state update completes
```

**Hypothesis D**: Stale closure in useCallback
```typescript
// useConsolidatedSettings.ts line 85-93
// getEffectiveSettings = useCallback(..., [overrideSettings, globalSettings])
// Dependencies might not be updating correctly
```

---

### Next Investigation Steps

1. **Add Debug Logging**:
   ```typescript
   // useConsolidatedSettings.ts - line 85
   const getEffectiveSettings = useCallback((): T => {
     console.log('🔍 [getEffectiveSettings] Running...');
     console.log('   Override flag:', overrideSettings.overrideGlobalSettings);
     console.log('   Specific settings:', overrideSettings.specificSettings);
     console.log('   Global settings:', globalSettings.settings);

     if (overrideSettings.overrideGlobalSettings) {
       console.log('   → Using SPECIFIC settings ✅');
       return overrideSettings.specificSettings;
     } else {
       console.log('   → Using GLOBAL settings ❌');
       return globalSettings.settings;
     }
   }, [overrideSettings, globalSettings.settings]);
   ```

2. **Verify Override Flag Changes**:
   ```typescript
   // EntitiesSettings.tsx - After checkbox onChange
   console.log('[OVERRIDE] Checkbox toggled to:', checked);
   console.log('[OVERRIDE] Draft settings:', draftSettings);
   console.log('[OVERRIDE] Override flag in settings:', draftSettings.overrideGlobalSettings);
   ```

3. **Check SubTabRenderer Props**:
   ```typescript
   // SubTabRenderer.tsx - line 90
   useEffect(() => {
     console.log('🔍 [SubTabRenderer] Props changed');
     console.log('   lineSettings:', lineSettings);
     console.log('   Override config:', overrideSettings?.line);
   }, [lineSettings, overrideSettings]);
   ```

4. **Inspect LinePreview Re-renders**:
   ```typescript
   // LinePreview.tsx
   useEffect(() => {
     console.log('🔍 [LinePreview] Re-rendered');
     console.log('   Line color:', lineSettings.color);
     console.log('   Line type:', lineSettings.lineType);
   }, [lineSettings]);
   ```

---

### Temporary Workarounds

**None available** - User must use General Settings until bug is fixed.

**Impact**:
- Cannot test preview-specific line styles during drawing
- Cannot test preview-specific text rendering
- Cannot test preview-specific grip visualization
- Specific Settings → Σχεδίαση → Προσχεδίαση feature is non-functional

---

## ✅ FIXED BUGS

*(No fixed bugs yet)*

---

## 📝 INVESTIGATION NOTES

### Session 2025-10-06 (Evening) - Part 1: Initial Investigation

**Participants**: Claude Code, Γιώργος Παγώνης

**Findings**:
1. ✅ Identified that `getEffective*Settings()` functions were being called without memoization
2. ✅ Added `useMemo` wrappers to ensure re-calculation on dependency changes
3. ✅ Updated all SubTabRenderer instances to use memoized values instead of function calls
4. ❌ Preview still shows general settings when override is ON
5. ❓ Root cause still unknown - requires deeper investigation into `useConsolidatedSettings` hook

**Files Modified**:
- `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/EntitiesSettings.tsx`

**Commits**:
- (Pending - waiting for successful fix before committing)

**Time Spent**: ~1 hour

---

### Session 2025-10-06 (Evening) - Part 2: Enterprise Refactoring (SOLUTION IN PROGRESS)

**Participants**: Claude Code, Γιώργος Παγώνης

**Decision**: Instead of patching the bug, implement **ENTERPRISE REFACTORING** to centralize all settings in DxfSettingsProvider.

**Strategy**: 10-Phase plan to migrate Ειδικά Settings (Draft/Hover/Selection/Completion) from `useConsolidatedSettings` to centralized Provider.

**Progress** (Phases 1-5 COMPLETE):

1. ✅ **Phase 2: Backup** (Commit: `352b51b`)
   - Full backup created in `F:\Pagonis_Nestor\backups\enterprise-refactoring-20251006`
   - Git commit: "Pre-refactoring: Save working state before Enterprise Settings migration"

2. ✅ **Phase 3: Extended State Structure** (Commit: `dc460fe`)
   - Extended `SpecificSettings` interface with draft/hover/selection/completion modes
   - Updated `OverrideEnabledFlags` to per-mode objects (not booleans)
   - Added AutoCAD-standard default colors (Yellow, Orange, Light Blue, Green)
   - File: `providers/DxfSettingsProvider.tsx` (lines 148-197, 386-469)

3. ✅ **Phase 4: Updated Reducer & Actions** (Commit: `dc460fe`)
   - Added 12 new action types for line/text/grip × draft/hover/selection/completion
   - Updated reducer cases to handle per-mode structure
   - Updated context methods (toggleLineOverride, updateSpecificLineSettings, etc.)
   - File: `providers/DxfSettingsProvider.tsx` (lines 659-696, 1400-1435)

4. ✅ **Phase 5: localStorage Persistence** (Commit: `91bc405`)
   - Extended STORAGE_KEYS with 7 new keys:
     - `dxf-line-specific-settings`, `dxf-text-specific-settings`, `dxf-grip-specific-settings`
     - `dxf-line-overrides`, `dxf-text-overrides`, `dxf-grip-overrides`
     - `dxf-override-enabled-flags`
   - Updated `saveAllSettings()` to persist all new settings types
   - Updated `loadAllSettings()` to restore with version checking
   - Integrated with auto-save mechanism (500ms debounce)
   - File: `providers/DxfSettingsProvider.tsx` (lines 757-782, 1035-1241, 1419-1431)

**Files Modified** (Total):
- `providers/DxfSettingsProvider.tsx`: +404 lines, -42 lines (1600 → 1962 lines)

**Commits**:
- `352b51b`: Pre-refactoring backup
- `dc460fe`: Phases 3+4 - Extended state structure + reducer actions
- `91bc405`: Phase 5 - localStorage persistence

**Time Spent**: ~3 hours (Phases 2-5)

**Next Steps** (Phases 6-10):
1. Phase 6: Create Provider Hooks (useLineDraftSettings, useLineHoverSettings, etc.)
2. Phase 7: Migrate useUnifiedSpecificSettings to use Provider hooks
3. Phase 8: Remove useConsolidatedSettings (cleanup)
4. Phase 9: Update Auto-Save Status Component
5. Phase 10: Final Testing & Documentation

**Expected Result**: Bug will be fixed as side effect of centralization - settings will persist and update correctly when override is ON.

---

**Last Updated**: 2025-10-06 (Evening)
**Status**: 1 Active Bug (being fixed via enterprise refactoring), 0 Fixed Bugs
**Documentation**: See `docs/ENTERPRISE_REFACTORING_PLAN.md` for complete 10-phase plan
