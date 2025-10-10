# 📊 DEPENDENCY MAP - DxfSettingsProvider Usage

**Generated:** 2025-10-09
**Purpose:** Track all files using DxfSettingsProvider for migration to Enterprise Provider
**Status:** PHASE 1 Analysis Complete

---

## 📈 STATISTICS

| Metric | Count |
|--------|-------|
| **Total useDxfSettings() calls** | 105 |
| **Files importing DxfSettingsProvider** | 23 |
| **Estimated migration effort** | 2-3 days |

---

## 📁 FILES BY CATEGORY

### **1. PROVIDERS (High Priority - Core System)**
```
✅ providers/StyleManagerProvider.tsx
✅ providers/UnifiedProviders.tsx
✅ providers/GripProvider.tsx
```

**Risk:** HIGH - Core system providers
**Migration Order:** After hooks, before components

---

### **2. HOOKS (Medium Priority - Utility Functions)**
```
✅ hooks/useEntityStyles.ts
✅ hooks/usePreviewMode.ts
✅ hooks/useOverrideSystem.ts
✅ hooks/grips/useGripSettings.ts
✅ hooks/interfaces/useCanvasOperations.ts
✅ ui/hooks/useSettingsUpdater.ts
✅ ui/hooks/useUnifiedSpecificSettings.ts
```

**Risk:** MEDIUM - Used by many components
**Migration Order:** First (low dependencies)

---

### **3. STORES (Medium Priority - State Management)**
```
✅ stores/ToolStyleStore.ts
✅ stores/TextStyleStore.ts
✅ stores/GripStyleStore.ts
✅ stores/DxfSettingsStore.ts
```

**Risk:** MEDIUM - Integrate with StyleManagerProvider
**Migration Order:** After hooks, with providers

---

### **4. UI COMPONENTS (Low-Medium Priority)**
```
✅ ui/components/SettingsPanel.tsx
✅ ui/components/CentralizedAutoSaveStatus.tsx
✅ ui/components/LevelPanel.tsx
✅ ui/components/dxf-settings/DxfSettingsPanel.tsx
✅ ui/components/dxf-settings/hooks/useSettingsPreview.ts
```

**Risk:** LOW-MEDIUM - User-facing but isolated
**Migration Order:** Middle phase

---

### **5. CONTEXTS (Low Priority - Legacy Wrappers)**
```
✅ contexts/LineSettingsContext.tsx
✅ contexts/TextSettingsContext.tsx
✅ contexts/CanvasContext.tsx
```

**Risk:** LOW - May be deprecated
**Migration Order:** Last (check if still used)

---

### **6. ADAPTERS (Low Priority - Utility)**
```
✅ adapters/ZustandToConsolidatedAdapter.ts
```

**Risk:** LOW - Adapter layer
**Migration Order:** Last

---

### **7. TESTS (Lowest Priority)**
```
⚠️ __tests__/*.test.ts
⚠️ settings-core/__tests__/*.test.ts
```

**Risk:** NONE - Can be updated at end
**Migration Order:** Last (after all prod code)

---

## 🎯 MIGRATION PRIORITY ORDER

### **PHASE 3.1: Low-Risk Utility Hooks (Day 1)**
Order by dependency count (least to most):

1. `hooks/useOverrideSystem.ts` - Isolated utility
2. `hooks/useEntityStyles.ts` - Simple style fetcher
3. `hooks/usePreviewMode.ts` - Mode switcher
4. `hooks/grips/useGripSettings.ts` - Grip-specific
5. `ui/hooks/useSettingsUpdater.ts` - Update utility
6. `ui/hooks/useUnifiedSpecificSettings.ts` - Specific settings

**Testing After Each:** TypeScript compilation + manual test if UI-facing

---

### **PHASE 3.2: Store Integrations (Day 1)**

1. `stores/ToolStyleStore.ts`
2. `stores/TextStyleStore.ts`
3. `stores/GripStyleStore.ts`
4. `stores/DxfSettingsStore.ts`

**Testing:** Verify store sync with StyleManagerProvider

---

### **PHASE 3.3: Core Providers (Day 2)**

1. `providers/StyleManagerProvider.tsx` - CRITICAL (already migrated to adapter)
2. `providers/GripProvider.tsx`
3. `providers/UnifiedProviders.tsx` - FINAL STEP (switch provider order)

**Testing:** Full app testing after each

---

### **PHASE 3.4: UI Components (Day 2)**

1. `ui/components/CentralizedAutoSaveStatus.tsx` - Simple display
2. `ui/components/LevelPanel.tsx` - Settings reader
3. `ui/hooks/dxf-settings/useSettingsPreview.ts` - Preview hook
4. `ui/components/SettingsPanel.tsx` - Main settings UI
5. `ui/components/dxf-settings/DxfSettingsPanel.tsx` - Settings form

**Testing:** Open settings panel, verify all fields work

---

### **PHASE 3.5: Legacy Contexts (Day 3)**

1. `contexts/LineSettingsContext.tsx` - Check if used
2. `contexts/TextSettingsContext.tsx` - Check if used
3. `contexts/CanvasContext.tsx` - May need update

**Testing:** Search for usages, update or remove

---

### **PHASE 3.6: Adapters & Misc (Day 3)**

1. `adapters/ZustandToConsolidatedAdapter.ts`
2. `hooks/interfaces/useCanvasOperations.ts`

**Testing:** Integration test

---

### **PHASE 3.7: Tests (Day 3-4)**

1. Update all `__tests__` files
2. Run test suite
3. Fix any broken tests

**Testing:** `npm test` (if tests exist)

---

## 📋 DETAILED FILE LIST

<details>
<summary>Click to expand full file list with imports</summary>

```
providers/StyleManagerProvider.tsx:14:import { useDxfSettings } from './DxfSettingsProvider';
providers/GripProvider.tsx:8:import { useDxfSettings } from './DxfSettingsProvider';
hooks/useEntityStyles.ts:5:import { useDxfSettings } from '../providers/DxfSettingsProvider';
hooks/usePreviewMode.ts:7:import { useDxfSettings } from '../providers/DxfSettingsProvider';
hooks/useOverrideSystem.ts:7:import { useDxfSettings } from '../providers/DxfSettingsProvider';
hooks/grips/useGripSettings.ts:10:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
hooks/interfaces/useCanvasOperations.ts:15:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
ui/hooks/useSettingsUpdater.ts:5:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
ui/hooks/useUnifiedSpecificSettings.ts:8:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
ui/components/CentralizedAutoSaveStatus.tsx:4:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
ui/components/LevelPanel.tsx:12:import { useDxfSettings } from '../../providers/DxfSettingsProvider';
ui/components/dxf-settings/hooks/useSettingsPreview.ts:5:import { useDxfSettings } from '../../../providers/DxfSettingsProvider';
stores/ToolStyleStore.ts:8:import type { DxfSettingsContextType } from '../providers/DxfSettingsProvider';
stores/TextStyleStore.ts:8:import type { DxfSettingsContextType } from '../providers/DxfSettingsProvider';
stores/GripStyleStore.ts:8:import type { DxfSettingsContextType } from '../providers/DxfSettingsProvider';
stores/DxfSettingsStore.ts:15:import { useDxfSettings } from '../providers/DxfSettingsProvider';
contexts/LineSettingsContext.tsx:7:import { useDxfSettings } from '../providers/DxfSettingsProvider';
contexts/TextSettingsContext.tsx:5:import { useDxfSettings } from '../providers/DxfSettingsProvider';
contexts/CanvasContext.tsx:18:import { useDxfSettings } from '../providers/DxfSettingsProvider';
adapters/ZustandToConsolidatedAdapter.ts:12:import type { DxfSettingsContextType } from '../providers/DxfSettingsProvider';
```

</details>

---

## ⚠️ RISK ASSESSMENT

### **Critical Files (MUST NOT BREAK)**
1. `providers/StyleManagerProvider.tsx` - Controls all rendering styles
2. `providers/UnifiedProviders.tsx` - App root provider tree
3. `ui/components/SettingsPanel.tsx` - User settings interface

**Mitigation:** Test thoroughly, use adapter layer, rollback ready

### **High-Risk Files (Test Carefully)**
1. `stores/*Store.ts` - State management
2. `hooks/grips/useGripSettings.ts` - Grip system
3. `contexts/CanvasContext.tsx` - Canvas integration

**Mitigation:** Incremental migration, test each file

### **Low-Risk Files (Safe to Migrate)**
1. Utility hooks
2. Display components
3. Test files

**Mitigation:** Standard testing

---

## ✅ MIGRATION CHECKLIST

Use this checklist during migration:

### Phase 3.1: Utility Hooks
- [ ] hooks/useOverrideSystem.ts
- [ ] hooks/useEntityStyles.ts
- [ ] hooks/usePreviewMode.ts
- [ ] hooks/grips/useGripSettings.ts
- [ ] ui/hooks/useSettingsUpdater.ts
- [ ] ui/hooks/useUnifiedSpecificSettings.ts

### Phase 3.2: Stores
- [ ] stores/ToolStyleStore.ts
- [ ] stores/TextStyleStore.ts
- [ ] stores/GripStyleStore.ts
- [ ] stores/DxfSettingsStore.ts

### Phase 3.3: Providers
- [ ] providers/StyleManagerProvider.tsx
- [ ] providers/GripProvider.tsx
- [ ] providers/UnifiedProviders.tsx

### Phase 3.4: UI Components
- [ ] ui/components/CentralizedAutoSaveStatus.tsx
- [ ] ui/components/LevelPanel.tsx
- [ ] ui/components/dxf-settings/hooks/useSettingsPreview.ts
- [ ] ui/components/SettingsPanel.tsx
- [ ] ui/components/dxf-settings/DxfSettingsPanel.tsx

### Phase 3.5: Contexts
- [ ] contexts/LineSettingsContext.tsx
- [ ] contexts/TextSettingsContext.tsx
- [ ] contexts/CanvasContext.tsx

### Phase 3.6: Adapters
- [ ] adapters/ZustandToConsolidatedAdapter.ts
- [ ] hooks/interfaces/useCanvasOperations.ts

### Phase 3.7: Tests
- [ ] __tests__/*.test.ts
- [ ] settings-core/__tests__/*.test.ts

---

## 📊 PROGRESS TRACKER

**Phase 1 Analysis:** ✅ COMPLETE
**Phase 2 Adapter:** ⏸️ PENDING
**Phase 3 Migration:** ⏸️ PENDING (0/23 files)
**Phase 4 Remove Old:** ⏸️ PENDING
**Phase 5-10:** ⏸️ PENDING

---

## 🔄 UPDATE LOG

| Date | Phase | Files Migrated | Status |
|------|-------|----------------|--------|
| 2025-10-09 | Phase 1 | 0/23 | Analysis complete |

---

**END OF DEPENDENCY MAP**

_Auto-generated by dependency analysis script_
_Last updated: 2025-10-09_
