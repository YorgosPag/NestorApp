# ENTERPRISE REFACTORING PLAN - Centralized Settings System

**Objective**: Μετεγκατάσταση των Ειδικών Settings (Draft/Hover/Selection/Completion/Preview) στον κεντρικό DxfSettingsProvider

**Status**: 🔴 **PENDING** (Not Started)
**Risk Level**: 🟡 **MEDIUM** (Requires careful execution)
**Estimated Time**: 1-2 days
**Author**: Claude Code + Γιώργος Παγώνης
**Date**: 2025-10-06

---

## 🎯 OBJECTIVES

### Current Problems (❌ Non-Enterprise)
1. **2 ξεχωριστά συστήματα**:
   - DxfSettingsProvider → Γενικά Settings (Line, Text, Grip, Cursor, Grid, Ruler)
   - useConsolidatedSettings → Ειδικά Settings (Draft, Hover, Selection, Completion, Preview)

2. **Διάσπαρτη λογική**:
   - Γενικά: localStorage + auto-save + reducer
   - Ειδικά: μόνο React useState (χωρίς persistence)

3. **Όχι κεντρικοποίηση** = Όχι Enterprise!

### Target Solution (✅ Enterprise)
1. **Ένα κεντρικό σύστημα**: DxfSettingsProvider για ΟΛΑ
2. **Ενιαίο state structure**: Γενικά + Ειδικά στον ίδιο reducer
3. **Ενιαίο persistence**: localStorage για όλα
4. **Καθαρό API**: Hooks που τραβάνε από την ίδια πηγή

---

## 📋 EXECUTION PLAN (10 PHASES)

### ✅ PHASE 1: Analysis & Documentation (SAFE - No Code Changes)
**Duration**: 30 minutes
**Risk**: 🟢 ZERO

**Steps**:
1. ✅ Document current architecture (this file)
2. ✅ Map all existing hooks and their usage
3. ✅ Identify all components using Ειδικά Settings
4. ✅ Create migration checklist

**Output**:
- This document
- `HOOKS_MIGRATION_MAP.md` (which hooks use what)
- `COMPONENTS_IMPACT_LIST.md` (which components will change)

**Validation**: ✅ No code touched, only documentation

---

### 🔄 PHASE 2: Backup Current State (SAFE - Preparation)
**Duration**: 15 minutes
**Risk**: 🟢 ZERO

**Steps**:
1. Create backup of current working code:
   ```bash
   BACKUP_DIR="F:\Pagonis_Nestor\backups\enterprise-refactoring-20251006"
   mkdir "$BACKUP_DIR"
   cp -r src/subapps/dxf-viewer "$BACKUP_DIR/"
   ```

2. Git commit current state:
   ```bash
   git add .
   git commit -m "Pre-refactoring: Save working state before Enterprise Settings migration"
   ```

3. Document current localStorage structure:
   - Screenshot localStorage keys
   - Export sample settings JSON

**Output**:
- Backup folder with working code
- Git commit hash for rollback
- localStorage documentation

**Validation**: ✅ Can rollback instantly if needed

---

### 🏗️ PHASE 3: Extend DxfSettingsProvider State Structure (BREAKING - Careful!)
**Duration**: 1 hour
**Risk**: 🟡 MEDIUM

**Steps**:
1. **Update State Interface** (DxfSettingsProvider.tsx):
   ```typescript
   interface DxfSettings {
     // ===== EXISTING (Γενικά) =====
     line: LineSettings;
     text: TextSettings;
     grip: GripSettings;
     cursor: CursorSettings;
     grid: GridSettings;
     ruler: RulerSettings;

     // ===== NEW (Ειδικά) =====
     specific: {
       line: {
         draft: OverrideSettings<LineSettings>;
         hover: OverrideSettings<LineSettings>;
         selection: OverrideSettings<LineSettings>;
         completion: OverrideSettings<LineSettings>;
         preview: OverrideSettings<LineSettings>;
       };
       text: {
         draft: OverrideSettings<TextSettings>;
         hover: OverrideSettings<TextSettings>;
         // ... etc
       };
       grips: {
         draft: OverrideSettings<GripSettings>;
         // ... etc
       };
     };

     // ===== META (unchanged) =====
     saveStatus: 'idle' | 'saving' | 'saved' | 'error';
     lastSaved: Date | null;
   }

   interface OverrideSettings<T> {
     overrideGlobalSettings: boolean;
     specificSettings: T;
   }
   ```

2. **Add Default Values**:
   - Copy from useUnifiedSpecificSettings.ts (lines 61-90)
   - Add to initialState

3. **DO NOT CHANGE REDUCER YET** - Only state structure

**Validation**:
- ✅ TypeScript compiles (may have errors in reducer - EXPECTED)
- ✅ No runtime errors (state structure only)

**Rollback Plan**: `git reset --hard <commit-hash>`

---

### 🔧 PHASE 4: Add Reducer Actions for Ειδικά Settings (NON-BREAKING)
**Duration**: 1 hour
**Risk**: 🟢 LOW

**Steps**:
1. **Add Action Types**:
   ```typescript
   // Ειδικά Settings Actions
   | { type: 'UPDATE_LINE_DRAFT_SETTINGS'; payload: Partial<OverrideSettings<LineSettings>> }
   | { type: 'UPDATE_LINE_HOVER_SETTINGS'; payload: Partial<OverrideSettings<LineSettings>> }
   | { type: 'UPDATE_LINE_SELECTION_SETTINGS'; payload: Partial<OverrideSettings<LineSettings>> }
   | { type: 'UPDATE_LINE_COMPLETION_SETTINGS'; payload: Partial<OverrideSettings<LineSettings>> }
   | { type: 'UPDATE_LINE_PREVIEW_SETTINGS'; payload: Partial<OverrideSettings<LineSettings>> }
   // ... same for text, grips
   ```

2. **Add Reducer Cases**:
   ```typescript
   case 'UPDATE_LINE_DRAFT_SETTINGS':
     return {
       ...state,
       specific: {
         ...state.specific,
         line: {
           ...state.specific.line,
           draft: { ...state.specific.line.draft, ...action.payload }
         }
       }
     };
   ```

3. **Test Each Action** (in browser console):
   ```javascript
   // Dispatch test action
   dispatch({ type: 'UPDATE_LINE_DRAFT_SETTINGS', payload: { overrideGlobalSettings: true } });
   // Check state updated
   console.log(state.specific.line.draft.overrideGlobalSettings); // Should be true
   ```

**Validation**:
- ✅ All actions dispatch successfully
- ✅ State updates correctly
- ✅ No side effects on existing functionality

---

### 💾 PHASE 5: Add localStorage Persistence for Ειδικά Settings (NON-BREAKING)
**Duration**: 1 hour
**Risk**: 🟢 LOW

**Steps**:
1. **Add Storage Keys**:
   ```typescript
   const STORAGE_KEYS = {
     // Existing
     line: 'dxf-line-general-settings',
     text: 'dxf-text-general-settings',
     // ...

     // NEW - Ειδικά
     lineDraft: 'dxf-line-draft-specific-settings',
     lineHover: 'dxf-line-hover-specific-settings',
     lineSelection: 'dxf-line-selection-specific-settings',
     lineCompletion: 'dxf-line-completion-specific-settings',
     linePreview: 'dxf-line-preview-specific-settings',
     // ... same pattern for text, grips
   };
   ```

2. **Add Load Functions** (in loadAllSettings):
   ```typescript
   // Load Line Draft Settings
   const lineDraft = localStorage.getItem(STORAGE_KEYS.lineDraft);
   if (lineDraft) {
     const parsed = JSON.parse(lineDraft);
     loadedSettings.specific.line.draft = parsed;
   }
   // ... repeat for all specific settings
   ```

3. **Add Save Functions** (in auto-save effect):
   ```typescript
   // Save specific settings
   localStorage.setItem(
     STORAGE_KEYS.lineDraft,
     JSON.stringify(settings.specific.line.draft)
   );
   // ... repeat for all
   ```

**Validation**:
- ✅ Settings save to localStorage
- ✅ Settings load on page refresh
- ✅ No conflicts with existing keys

---

### 🔌 PHASE 6: Create New Provider Hooks (PARALLEL - Safe)
**Duration**: 1.5 hours
**Risk**: 🟢 LOW (New code, doesn't break existing)

**Steps**:
1. **Create Hook Wrappers** (in DxfSettingsProvider.tsx):
   ```typescript
   // Export from provider
   export function useLineDraftSettings() {
     const { settings, dispatch } = useDxfSettings();

     return {
       settings: settings.specific.line.draft,
       updateSettings: (updates) => dispatch({
         type: 'UPDATE_LINE_DRAFT_SETTINGS',
         payload: updates
       }),
       getEffectiveSettings: () => {
         if (settings.specific.line.draft.overrideGlobalSettings) {
           return settings.specific.line.draft.specificSettings;
         }
         return settings.line; // Fallback to general
       }
     };
   }

   // Repeat for: useLineHoverSettings, useLineSelectionSettings, etc.
   ```

2. **Test Hooks** (create test component):
   ```tsx
   function TestSpecificSettings() {
     const draft = useLineDraftSettings();

     return (
       <div>
         <button onClick={() => draft.updateSettings({ overrideGlobalSettings: true })}>
           Enable Override
         </button>
         <pre>{JSON.stringify(draft.getEffectiveSettings(), null, 2)}</pre>
       </div>
     );
   }
   ```

**Validation**:
- ✅ Hooks return correct data
- ✅ Updates work
- ✅ getEffectiveSettings respects override flag

---

### 🔄 PHASE 7: Migrate useUnifiedSpecificSettings to Provider Hooks (GRADUAL)
**Duration**: 2 hours
**Risk**: 🟡 MEDIUM (Changes hook usage)

**Strategy**: **One hook at a time, test, then next**

**Steps**:
1. **Update useUnifiedLineDraft** (useUnifiedSpecificSettings.ts):
   ```typescript
   // BEFORE (local useState)
   export function useUnifiedLineDraft() {
     const consolidated = useConsolidatedSettings({ ... });
     return { ... };
   }

   // AFTER (uses provider)
   export function useUnifiedLineDraft() {
     return useLineDraftSettings(); // Delegate to provider
   }
   ```

2. **Test in EntitiesSettings.tsx**:
   - Open Ειδικές Ρυθμίσεις → Σχεδίαση → Προσχεδίαση
   - Toggle override checkbox
   - Change settings
   - Verify preview updates
   - Refresh page → Settings should persist ✅

3. **Repeat for Each Hook**:
   - useUnifiedLineHover → test
   - useUnifiedLineSelection → test
   - useUnifiedLineCompletion → test
   - useUnifiedLinePreview → test
   - useUnifiedTextPreview → test
   - useUnifiedGripPreview → test

**Validation** (CRITICAL - Test After EACH Hook):
- ✅ Override checkbox works
- ✅ Settings update in UI
- ✅ Preview updates correctly
- ✅ Settings persist after refresh
- ✅ No console errors
- ✅ Existing functionality unchanged

**Rollback Plan**: Revert one hook at a time if issues

---

### 🧹 PHASE 8: Remove useConsolidatedSettings (CLEANUP)
**Duration**: 30 minutes
**Risk**: 🟢 LOW

**Steps**:
1. **Verify No Usage**:
   ```bash
   grep -r "useConsolidatedSettings" src/subapps/dxf-viewer/
   # Should only find: useUnifiedSpecificSettings.ts (imports it)
   ```

2. **Remove File**:
   ```bash
   git rm src/subapps/dxf-viewer/ui/hooks/useConsolidatedSettings.ts
   ```

3. **Remove Import** from useUnifiedSpecificSettings.ts

4. **Update Documentation**:
   - Remove from 04-HOOKS_REFERENCE.md
   - Mark as DEPRECATED in centralized_systems.md

**Validation**:
- ✅ TypeScript compiles
- ✅ No runtime errors
- ✅ App works normally

---

### 📊 PHASE 9: Update Auto-Save Status Component (ENHANCEMENT)
**Duration**: 30 minutes
**Risk**: 🟢 LOW

**Steps**:
1. **Update CentralizedAutoSaveStatus.tsx**:
   ```typescript
   const debugInfo = `
     L:${!!settings.line}
     T:${!!settings.text}
     G:${!!settings.grip}
     LD:${!!settings.specific?.line?.draft}
     LH:${!!settings.specific?.line?.hover}
     LS:${!!settings.specific?.line?.selection}
     LC:${!!settings.specific?.line?.completion}
     TP:${!!settings.specific?.text?.preview}
   `.replace(/\s+/g, ' ');
   ```

2. **Add Visual Indicators**:
   - Blue dots for Γενικά (L, T, G)
   - Green dots for Ειδικά (LD, LH, LS, LC, TP, etc.)

**Validation**:
- ✅ Status shows all settings (Γενικά + Ειδικά)
- ✅ Auto-save triggers for both

---

### ✅ PHASE 10: Final Testing & Documentation (CRITICAL)
**Duration**: 2 hours
**Risk**: 🟢 LOW (Testing only)

**Testing Checklist**:
- [ ] **Γενικές Ρυθμίσεις**:
  - [ ] Line settings update → persist → load
  - [ ] Text settings update → persist → load
  - [ ] Grip settings update → persist → load

- [ ] **Ειδικές Ρυθμίσεις - Προσχεδίαση**:
  - [ ] Line: Override ON → change color → preview updates → persist
  - [ ] Text: Override ON → change font → preview updates → persist
  - [ ] Grips: Override ON → change size → preview updates → persist

- [ ] **Ειδικές Ρυθμίσεις - Hover, Selection, Completion**:
  - [ ] Same tests as Προσχεδίαση

- [ ] **Cross-Testing**:
  - [ ] Change General → Specific (override OFF) shows General ✅
  - [ ] Change General → Specific (override ON) shows Specific ✅
  - [ ] localStorage contains all settings
  - [ ] Page refresh → All settings restored

**Documentation Updates**:
1. Update `docs/settings-system/03-DXFSETTINGSPROVIDER.md`
   - Add Ειδικά Settings section
   - Document new state structure
   - Document new hooks

2. Update `docs/settings-system/04-HOOKS_REFERENCE.md`
   - Add useLineDraftSettings, etc.
   - Mark useConsolidatedSettings as DEPRECATED

3. Update `centralized_systems.md`
   - Document unified settings architecture

4. Create `docs/ENTERPRISE_REFACTORING_COMPLETE.md`
   - Summary of changes
   - Before/After comparison
   - Performance notes

**Final Validation**:
- ✅ All tests pass
- ✅ No console errors
- ✅ No TypeScript errors
- ✅ Performance is same or better
- ✅ Documentation complete

---

## 🚨 RISK MITIGATION

### If Something Breaks:
1. **STOP IMMEDIATELY** - Don't continue to next phase
2. **Identify Issue** - Console errors? UI broken? Data loss?
3. **Rollback Options**:
   - **Quick**: `git reset --hard <phase-X-commit>`
   - **Full**: Copy from backup folder
4. **Document Issue** in BUGFIX_LOG.md
5. **Fix Before Proceeding**

### Checkpoints (Git Commits):
- After Phase 2: "Pre-refactoring backup"
- After Phase 3: "State structure extended"
- After Phase 4: "Reducer actions added"
- After Phase 5: "localStorage persistence added"
- After Phase 6: "Provider hooks created"
- After Phase 7: "Hooks migrated (1/6)" ... "(6/6)"
- After Phase 8: "useConsolidatedSettings removed"
- After Phase 9: "Auto-save status updated"
- After Phase 10: "Enterprise refactoring COMPLETE ✅"

---

## 📈 SUCCESS CRITERIA

### Must Have (Critical):
- ✅ **Zero Breaking Changes**: Existing functionality works 100%
- ✅ **Centralized**: One system για όλα (Γενικά + Ειδικά)
- ✅ **Persistence**: All settings save/load from localStorage
- ✅ **Preview Updates**: Real-time updates when override ON

### Nice to Have (Bonus):
- ✅ **Performance**: No slower than before
- ✅ **Code Quality**: Less code, more maintainable
- ✅ **Documentation**: Complete and accurate

---

## 📝 EXECUTION LOG

| Phase | Status | Started | Completed | Issues | Commit | Notes |
|-------|--------|---------|-----------|--------|--------|-------|
| 1 - Analysis | ✅ DONE | 2025-10-06 | 2025-10-06 | None | - | This document created |
| 2 - Backup | ✅ DONE | 2025-10-06 | 2025-10-06 | None | 352b51b | Full backup created + git commit |
| 3 - State Structure | ✅ DONE | 2025-10-06 | 2025-10-06 | None | dc460fe | Extended SpecificSettings + OverrideEnabledFlags |
| 4 - Reducer Actions | ✅ DONE | 2025-10-06 | 2025-10-06 | None | dc460fe | Updated reducer + context methods |
| 5 - localStorage | ✅ DONE | 2025-10-06 | 2025-10-06 | None | 91bc405 | Complete persistence layer (7 new keys) |
| 6 - Provider Hooks | ⏸️ PENDING | - | - | - | - | Next: Create useLineDraft, useLineHover, etc. |
| 7 - Hook Migration | ⏸️ PENDING | - | - | - | - | - |
| 8 - Cleanup | ⏸️ PENDING | - | - | - | - | - |
| 9 - Auto-Save UI | ⏸️ PENDING | - | - | - | - | - |
| 10 - Testing | ⏸️ PENDING | - | - | - | - | - |

---

**Status Legend**:
- ✅ DONE - Completed successfully
- 🔵 READY - Ready to start
- 🔄 IN PROGRESS - Currently working
- ⏸️ PENDING - Not started yet
- ❌ BLOCKED - Issue preventing progress
- 🔧 FIXING - Fixing issues

---

### 🎯 PROGRESS SUMMARY

**Completed**: Phases 1-5 (50% complete!)

**What's Done**:
1. ✅ **Phase 2**: Backup created in `F:\Pagonis_Nestor\backups\enterprise-refactoring-20251006`
2. ✅ **Phase 3**: Extended state structure with draft/hover/selection/completion modes
3. ✅ **Phase 4**: Updated reducer with 12 new action types + context methods
4. ✅ **Phase 5**: Added complete localStorage persistence (7 new keys)

**Key Commits**:
- `352b51b`: Pre-refactoring backup
- `dc460fe`: Phases 3+4 - Extended state structure + reducer actions
- `91bc405`: Phase 5 - localStorage persistence

**New localStorage Keys**:
- `dxf-line-specific-settings` (draft/hover/selection/completion)
- `dxf-text-specific-settings` (draft)
- `dxf-grip-specific-settings` (draft)
- `dxf-line-overrides`, `dxf-text-overrides`, `dxf-grip-overrides`
- `dxf-override-enabled-flags`

**Files Modified**:
- `providers/DxfSettingsProvider.tsx`: +404 lines, -42 lines (expanded from 1600 → 1962 lines)

**Next**: Phase 6 - Create Provider Hooks (useLineDraftSettings, etc.)

---

**Last Updated**: 2025-10-06 (Evening)
**Next Action**: Documentation update, then proceed with Phase 6
