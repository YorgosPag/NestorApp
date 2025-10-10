# 🎯 REFACTORING PLAN: EnterpriseDxfSettingsProvider.tsx

**Ημερομηνία**: 2025-10-09
**Στόχος**: Μείωση από **1407 → ~520 γραμμές** χρησιμοποιώντας **ΗΔΗ ΥΠΑΡΧΟΝΤΑ** αρχεία!

---

## 📋 ΒΗΜΑ ΠΡΟ ΒΗΜΑΤΟΣ PLAN

### ✅ ΤΙ ΘΑ ΧΡΗΣΙΜΟΠΟΙΗΣΟΥΜΕ (ΗΔΗ ΥΠΑΡΧΟΥΝ!)

Ο Γιώργος έχει **ΗΔΗ φτιάξει** αυτά τα αρχεία στο `settings/` folder:

#### 1. **State Management** (ΗΔΗ ΥΠΑΡΧΕΙ!)
```
✅ settings/state/reducer.ts       (116 γραμμές)
✅ settings/state/actions.ts       (62 γραμμές)
✅ settings/state/selectors.ts     (72 γραμμές)
```

**Status**: ✅ ΕΤΟΙΜΑ - Απλά δεν χρησιμοποιούνται!

**Τι κάνουν**:
- `reducer.ts`: settingsReducer με 8 action types
- `actions.ts`: settingsActions με typed action creators
- `selectors.ts`: selectLineSettings, selectTextSettings, selectGripSettings

---

#### 2. **Core Functionality** (ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ!)
```
✅ settings/core/types.ts                 (158 γραμμές)
✅ settings/core/computeEffective.ts      (207 γραμμές)
✅ settings/FACTORY_DEFAULTS.ts           (294 γραμμές)
```

**Status**: ✅ ΕΝΕΡΓΑ - Ήδη imported από provider!

---

#### 3. **Persistence Layer** (ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ!)
```
✅ settings/io/IndexedDbDriver.ts         (605 γραμμές)
✅ settings/io/LocalStorageDriver.ts      (496 γραμμές)
✅ settings/io/safeLoad.ts                (237 γραμμές)
✅ settings/io/safeSave.ts                (369 γραμμές)
✅ settings/io/legacyMigration.ts         (498 γραμμές)
```

**Status**: ✅ ΕΝΕΡΓΑ - Ήδη imported από provider!

---

### ❌ ΤΙ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ (Dead Code)

```
❌ settings/io/SyncService.ts             (262 γραμμές) - Future feature
❌ settings/telemetry/Metrics.ts          (307 γραμμές) - Testing only
❌ settings/telemetry/Logger.ts           (255 γραμμές) - Testing only
❌ settings/io/MemoryDriver.ts            (74 γραμμές)  - Testing only
```

**Status**: ⚠️ Θα τα αγνοήσουμε προς το παρόν

---

### 🆕 ΤΙ ΘΑ ΦΤΙΑΞΟΥΜΕ (Νέα αρχεία)

#### 1. **Hooks** (ΝΕΑ ΑΡΧΕΙΑ - 7 files)
```
🆕 hooks/useLineDraftSettings.ts          (~40 γραμμές)
🆕 hooks/useLineHoverSettings.ts          (~40 γραμμές)
🆕 hooks/useLineSelectionSettings.ts      (~40 γραμμές)
🆕 hooks/useLineCompletionSettings.ts     (~40 γραμμές)
🆕 hooks/useTextDraftSettings.ts          (~40 γραμμές)
🆕 hooks/useGripDraftSettings.ts          (~40 γραμμές)
🆕 hooks/index.ts                         (~20 γραμμές)
```

**Σκοπός**: Extract τα 20+ hooks από τον provider

---

#### 2. **Store Sync** (ΝΕΟ ΑΡΧΕΙΟ - 1 file)
```
🆕 settings/sync/storeSync.ts             (~130 γραμμές)
```

**Σκοπός**: Extract store sync logic (toolStyleStore, textStyleStore, gripStyleStore)

---

## 🔄 MIGRATION STEPS

### PHASE 1: Χρήση Existing Reducer/Actions (30 λεπτά)

#### Step 1.1: Import το reducer (5 λεπτά)
```typescript
// EnterpriseDxfSettingsProvider.tsx - LINE ~290

// ❌ ΠΡΙΝ (INLINE REDUCER - 150 γραμμές):
function enterpriseReducer(state: EnterpriseState, action: EnterpriseAction): EnterpriseState {
  switch (action.type) {
    case 'UPDATE_LINE': { ... }  // 20 γραμμές
    case 'UPDATE_TEXT': { ... }  // 20 γραμμές
    case 'UPDATE_GRIP': { ... }  // 20 γραμμές
    // ... +10 more cases
  }
}

// ✅ ΜΕΤΑ (IMPORT από settings/state/reducer.ts):
import { settingsReducer } from '../settings/state/reducer';

// ADAPTER: Convert EnterpriseAction → SettingsAction
function enterpriseReducer(state: EnterpriseState, action: EnterpriseAction): EnterpriseState {
  // Map enterprise actions to settings actions
  // (Αυτό χρειάζεται μόνο αν τα action types διαφέρουν)
  return settingsReducer(state, action);
}
```

**Αποτέλεσμα**: -150 γραμμές από provider!

---

#### Step 1.2: Import τα actions (5 λεπτά)
```typescript
// EnterpriseDxfSettingsProvider.tsx - LINE ~650

// ❌ ΠΡΙΝ (INLINE DISPATCHES):
const updateLineSettings = useCallback((mode, updates, layer) => {
  dispatch({ type: 'UPDATE_LINE', payload: { mode, updates, layer } });
}, []);

// ✅ ΜΕΤΑ (ΧΡΗΣΗ settingsActions):
import { settingsActions } from '../settings/state/actions';

const updateLineSettings = useCallback((mode, updates, layer) => {
  if (layer === 'general') {
    dispatch(settingsActions.setGeneral('line', updates));
  } else if (layer === 'specific') {
    dispatch(settingsActions.setSpecific('line', mode, updates));
  } else {
    dispatch(settingsActions.setOverride('line', mode, updates));
  }
}, []);
```

**Σημείωση**: Αυτό είναι προαιρετικό - μπορούμε να κρατήσουμε τα inline dispatches αν θέλουμε!

---

#### Step 1.3: Import τα selectors (ΠΡΟΑΙΡΕΤΙΚΟ - 10 λεπτά)
```typescript
// EnterpriseDxfSettingsProvider.tsx - LINE ~730

// ❌ ΠΡΙΝ (INLINE COMPUTATION):
const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
  const effectiveMode = mode || 'normal';
  return computeEffective(
    state.settings.line.general,
    state.settings.line.specific,
    state.settings.line.overrides,
    state.settings.overrideEnabled.line,
    effectiveMode
  );
}, [state.settings]);

// ✅ ΜΕΤΑ (ΧΡΗΣΗ selectLineSettings):
import { selectLineSettings } from '../settings/state/selectors';

const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
  const effectiveMode = mode || 'normal';
  return selectLineSettings(state.settings, effectiveMode);
}, [state.settings]);
```

**Σημείωση**: Αυτό δεν μειώνει γραμμές πολύ, αλλά κάνει τον κώδικα πιο clean!

---

### PHASE 2: Extract Hooks (1 ώρα)

#### Step 2.1: Δημιουργία hooks/ folder (1 λεπτό)
```bash
mkdir -p F:\Pagonis_Nestor\src\subapps\dxf-viewer\hooks
```

---

#### Step 2.2: Extract useLineDraftSettings (10 λεπτά)
```typescript
// 🆕 hooks/useLineDraftSettings.ts
import React from 'react';
import { useEnterpriseDxfSettings } from '../providers/EnterpriseDxfSettingsProvider';
import type { LineSettings } from '../settings-core/types';

export function useLineDraftSettings() {
  const { getEffectiveLineSettings, updateSpecificLineSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.line?.draft?.enabled ?? false;

  // 🐛 FIX: Use useMemo to re-compute when settings change
  const effectiveSettings = React.useMemo(
    () => getEffectiveLineSettings('preview'),
    [getEffectiveLineSettings]
  );

  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<LineSettings>) => {
      updateSpecificLineSettings?.('draft', updates);
    },
    getEffectiveSettings: () => getEffectiveLineSettings('preview'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      updateSpecificLineSettings?.('draft', { enabled } as Partial<LineSettings>);
    }
  };
}
```

**Repeat για**: useLineHoverSettings, useLineSelectionSettings, useLineCompletionSettings, useTextDraftSettings, useGripDraftSettings

---

#### Step 2.3: Create hooks/index.ts (5 λεπτά)
```typescript
// 🆕 hooks/index.ts
export { useLineDraftSettings } from './useLineDraftSettings';
export { useLineHoverSettings } from './useLineHoverSettings';
export { useLineSelectionSettings } from './useLineSelectionSettings';
export { useLineCompletionSettings } from './useLineCompletionSettings';
export { useTextDraftSettings } from './useTextDraftSettings';
export { useGripDraftSettings } from './useGripDraftSettings';
```

---

#### Step 2.4: Update EnterpriseDxfSettingsProvider imports (2 λεπτά)
```typescript
// EnterpriseDxfSettingsProvider.tsx - TOP OF FILE

// ❌ ΔΙΑΓΡΑΦΗ (Lines 1199-1407 - όλα τα exported hooks)

// ✅ ΠΡΟΣΘΗΚΗ:
export {
  useLineDraftSettings,
  useLineHoverSettings,
  useLineSelectionSettings,
  useLineCompletionSettings,
  useTextDraftSettings,
  useGripDraftSettings
} from '../../hooks';
```

**Αποτέλεσμα**: -310 γραμμές από provider!

---

### PHASE 3: Extract Store Sync (30 λεπτά)

#### Step 3.1: Δημιουργία sync/ folder (1 λεπτό)
```bash
mkdir -p F:\Pagonis_Nestor\src\subapps\dxf-viewer\settings\sync
```

---

#### Step 3.2: Extract storeSync.ts (20 λεπτά)
```typescript
// 🆕 settings/sync/storeSync.ts
import { useEffect } from 'react';
import { toolStyleStore } from '../../stores/toolStyleStore';
import { textStyleStore } from '../../stores/textStyleStore';
import { gripStyleStore } from '../../stores/gripStyleStore';
import type { LineSettings, TextSettings, GripSettings } from '../core/types';

export function useStoreSync(
  getEffectiveLineSettings: (mode?: string) => LineSettings,
  getEffectiveTextSettings: (mode?: string) => TextSettings,
  getEffectiveGripSettings: (mode?: string) => GripSettings,
  isLoaded: boolean
) {
  // ===== SYNC TOOLSTYLESTORE =====
  useEffect(() => {
    if (!isLoaded) return;

    const effectiveLineSettings = getEffectiveLineSettings('preview');

    toolStyleStore.set({
      enabled: effectiveLineSettings.enabled ?? true,
      strokeColor: effectiveLineSettings.color ?? '#FFFFFF',
      lineWidth: effectiveLineSettings.lineWidth ?? 0.25,
      opacity: effectiveLineSettings.opacity ?? 1.0,
      lineType: effectiveLineSettings.lineType ?? 'solid',
      fillColor: '#00000000'
    });
  }, [getEffectiveLineSettings, isLoaded]);

  // ===== SYNC TEXTSTYLESTORE =====
  useEffect(() => {
    if (!isLoaded) return;

    const effectiveTextSettings = getEffectiveTextSettings('preview');

    textStyleStore.set({
      enabled: effectiveTextSettings.enabled ?? true,
      fontFamily: effectiveTextSettings.fontFamily ?? 'Arial',
      fontSize: effectiveTextSettings.fontSize ?? 12,
      color: effectiveTextSettings.color ?? '#FFFFFF',
      opacity: effectiveTextSettings.opacity ?? 1.0,
      fontWeight: effectiveTextSettings.fontWeight ?? 'normal',
      fontStyle: effectiveTextSettings.fontStyle ?? 'normal'
    });
  }, [getEffectiveTextSettings, isLoaded]);

  // ===== SYNC GRIPSTYLESTORE =====
  useEffect(() => {
    if (!isLoaded) return;

    const effectiveGripSettings = getEffectiveGripSettings('preview');

    gripStyleStore.set({
      enabled: effectiveGripSettings.enabled ?? true,
      gripSize: effectiveGripSettings.gripSize ?? 5,
      pickBoxSize: effectiveGripSettings.pickBoxSize ?? 3,
      apertureSize: effectiveGripSettings.apertureSize ?? 10,
      opacity: effectiveGripSettings.opacity ?? 1.0,
      colors: {
        cold: effectiveGripSettings.colors?.cold ?? '#0000FF',
        warm: effectiveGripSettings.colors?.warm ?? '#FF69B4',
        hot: effectiveGripSettings.colors?.hot ?? '#FF0000',
        contour: effectiveGripSettings.colors?.contour ?? '#000000'
      },
      showAperture: effectiveGripSettings.showAperture ?? true,
      multiGripEdit: effectiveGripSettings.multiGripEdit ?? true,
      snapToGrips: effectiveGripSettings.snapToGrips ?? true,
      showMidpoints: effectiveGripSettings.showMidpoints ?? true,
      showCenters: effectiveGripSettings.showCenters ?? true,
      showQuadrants: effectiveGripSettings.showQuadrants ?? true,
      maxGripsPerEntity: effectiveGripSettings.maxGripsPerEntity ?? 50
    });
  }, [getEffectiveGripSettings, isLoaded]);
}
```

---

#### Step 3.3: Update EnterpriseDxfSettingsProvider (5 λεπτά)
```typescript
// EnterpriseDxfSettingsProvider.tsx

// ❌ ΔΙΑΓΡΑΦΗ (Lines 772-900 - όλα τα store sync useEffects)

// ✅ ΠΡΟΣΘΗΚΗ:
import { useStoreSync } from '../settings/sync/storeSync';

function EnterpriseDxfSettingsProvider({ children }) {
  // ... (existing code)

  // Store sync
  useStoreSync(
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings,
    state.isLoaded
  );

  // ...
}
```

**Αποτέλεσμα**: -130 γραμμές από provider!

---

## 📊 ΤΕΛΙΚΟ ΑΠΟΤΕΛΕΣΜΑ

### Breakdown:
```
EnterpriseDxfSettingsProvider.tsx

ΠΡΙΝ REFACTORING:                       1407 γραμμές

Phase 1: Extract Reducer                -150 γραμμές
Phase 2: Extract Hooks (20+)            -310 γραμμές
Phase 3: Extract Store Sync             -130 γραμμές
---------------------------------------------------------
ΜΕΤΑ REFACTORING:                        ~817 γραμμές

ΣΤΟΧΟΣ (με cleanup):                     ~520 γραμμές
```

---

### Νέα Αρχεία:
```
🆕 hooks/useLineDraftSettings.ts          40 γραμμές
🆕 hooks/useLineHoverSettings.ts          40 γραμμές
🆕 hooks/useLineSelectionSettings.ts      40 γραμμές
🆕 hooks/useLineCompletionSettings.ts     40 γραμμές
🆕 hooks/useTextDraftSettings.ts          40 γραμμές
🆕 hooks/useGripDraftSettings.ts          40 γραμμές
🆕 hooks/index.ts                         20 γραμμές
🆕 settings/sync/storeSync.ts            130 γραμμές
---------------------------------------------------------
ΣΥΝΟΛΟ ΝΕΩΝ ΑΡΧΕΙΩΝ:                     390 γραμμές
```

---

### Χρήση Existing Αρχείων:
```
✅ settings/state/reducer.ts             116 γραμμές (ΗΔΙΗ ΥΠΑΡΧΕΙ!)
✅ settings/state/actions.ts              62 γραμμές (ΗΔΙΗ ΥΠΑΡΧΕΙ!)
✅ settings/state/selectors.ts            72 γραμμές (ΗΔΙΗ ΥΠΑΡΧΕΙ!)
---------------------------------------------------------
ΣΥΝΟΛΟ EXISTING:                         250 γραμμές (ΔΕΝ χρειάζεται να γραφτούν!)
```

---

## ✅ ΑΠΑΝΤΗΣΗ ΣΤΗΝ ΕΡΩΤΗΣΗ ΤΟΥ ΓΙΩΡΓΟΥ

### "Θα χρησιμοποιήσεις τα αρχεία στον φάκελο settings/;"

### **ΝΑΙ!** ✅

Θα χρησιμοποιήσω:

#### 1. **State Management** (ΗΔΗ ΥΠΑΡΧΕΙ!)
```
✅ settings/state/reducer.ts       (116 γραμμές)
✅ settings/state/actions.ts       (62 γραμμές)
✅ settings/state/selectors.ts     (72 γραμμές)
```
**Status**: ΕΤΟΙΜΑ - Απλά θα τα κάνω import!

---

#### 2. **Core** (ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ!)
```
✅ settings/core/types.ts
✅ settings/core/computeEffective.ts
✅ settings/FACTORY_DEFAULTS.ts
```
**Status**: ΗΔΗ imported - Κανένα extra import!

---

#### 3. **Persistence** (ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ!)
```
✅ settings/io/IndexedDbDriver.ts
✅ settings/io/LocalStorageDriver.ts
✅ settings/io/safeLoad.ts
✅ settings/io/safeSave.ts
✅ settings/io/legacyMigration.ts
```
**Status**: ΗΔΗ imported - Κανένα extra import!

---

#### 4. **Sync** (ΘΑ ΦΤΙΑΞΩ ΝΕΟ!)
```
🆕 settings/sync/storeSync.ts      (130 γραμμές - ΝΕΟ)
```
**Status**: Θα το φτιάξω από το μηδέν

---

#### 5. **Hooks** (ΘΑ ΦΤΙΑΞΩ ΝΕΕΣ!)
```
🆕 hooks/useLineDraftSettings.ts    (40 γραμμές - ΝΕΟ)
🆕 hooks/useLineHoverSettings.ts    (40 γραμμές - ΝΕΟ)
🆕 hooks/useLineSelectionSettings.ts (40 γραμμές - ΝΕΟ)
🆕 hooks/useLineCompletionSettings.ts (40 γραμμές - ΝΕΟ)
🆕 hooks/useTextDraftSettings.ts    (40 γραμμές - ΝΕΟ)
🆕 hooks/useGripDraftSettings.ts    (40 γραμμές - ΝΕΟ)
🆕 hooks/index.ts                   (20 γραμμές - ΝΕΟ)
```
**Status**: Θα τα φτιάξω από το μηδέν (extract από provider)

---

## 🎯 ΣΥΜΠΕΡΑΣΜΑ

### Θα χρησιμοποιήσω τα **ΗΔΗ ΥΠΑΡΧΟΝΤΑ** αρχεία:

#### ✅ **ΝΑΙΙΙΙ!**
- **250 γραμμές** code (reducer/actions/selectors) που **ΗΔΗ ΥΠΑΡΧΟΥΝ** στον `settings/` folder!
- Δεν χρειάζεται να γράψω **ΤΙΠΟΤΑ** για αυτά - απλά θα τα κάνω **import**!

#### 🆕 **Νέα αρχεία** (390 γραμμές):
- Hooks (7 files): **260 γραμμές**
- Store sync (1 file): **130 γραμμές**

---

## ⏱️ ΧΡΟΝΟΣ

- **Phase 1** (Reducer/Actions): 30 λεπτά
- **Phase 2** (Hooks): 1 ώρα
- **Phase 3** (Store Sync): 30 λεπτά

**ΣΥΝΟΛΟ**: **2 ώρες** για **πλήρη refactoring**!

---

**Έτοιμος να ξεκινήσουμε, Γιώργο;** 🚀
