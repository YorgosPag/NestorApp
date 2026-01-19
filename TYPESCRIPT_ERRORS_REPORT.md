# TypeScript Errors Report - Nestor Pagonis Application

**Generated:** 2026-01-19
**Total Errors:** ~2,500+ errors
**Analysis Method:** 5 Parallel Agents

---

## Executive Summary

| Φάκελος | Errors | Κατάσταση |
|---------|--------|-----------|
| `src/components` | 1,062 | 🔴 Κρίσιμο |
| `src/services` + `src/hooks` | 447 | 🟠 Σοβαρό |
| `src/subapps` (Geo-Canvas) | 230 | 🟠 Σοβαρό |
| `src/subapps` (DXF-Viewer) | 0 | ✅ Καθαρό |
| `src/app` + `src/lib` | 132 | 🟡 Μέτριο |
| `src/adapters` + `src/core` + `packages` | 216 | 🟠 Σοβαρό |
| **ΣΥΝΟΛΟ** | **~2,087** | - |

---

## Κατηγοριοποίηση Errors (Όλο το Project)

| Error Code | Περιγραφή | Πλήθος | Προτεραιότητα |
|------------|-----------|--------|---------------|
| **TS2339** | Property does not exist | ~944 | 🔴 Υψηλή |
| **TS2345/TS2322** | Type mismatches | ~460 | 🔴 Υψηλή |
| **TS2304** | Cannot find name | ~108 | 🔴 Υψηλή |
| **TS2307** | Cannot find module | ~44 | 🔴 Υψηλή |
| **TS2305/TS2724** | Missing exports/typos | ~47 | 🟠 Μεσαία |
| **TS7006/TS7031** | Implicit any | ~51 | 🟠 Μεσαία |
| **TS2484** | Export conflicts | ~37 | 🟡 Χαμηλή |
| **TS2564** | Uninitialized properties | ~3 | 🟡 Χαμηλή |
| **Άλλα** | Διάφορα | ~393 | 🟡 Χαμηλή |

---

# ΛΕΠΤΟΜΕΡΗΣ ΑΝΑΛΥΣΗ ΑΝΑ ΦΑΚΕΛΟ

---

## 1. src/components (1,062 errors)

### Top Error Categories:

| Κατηγορία | Πλήθος |
|-----------|--------|
| TS2339 - Property missing | 407 |
| TS2322 - Type mismatch | 260 |
| TS2345 - Argument mismatch | 97 |
| TS2304/TS2307 - Missing | 54 |
| TS7006 - Implicit any | 22 |

### Κρίσιμα Αρχεία:

| Αρχείο | Errors | Root Cause |
|--------|--------|------------|
| `core/CompactToolbar/configs.ts` | 24 | Missing design tokens |
| `crm/SendMessageModal.tsx` | 22 | Implicit any + property missing |
| `core/AdvancedFilters/configs.ts` | 20 | Missing design tokens |
| `compositions/StorageCard/StorageCard.tsx` | 17 | Type mismatches |
| `core/FormFields/FormField.tsx` | 33 | Type mismatches |

### Προτεινόμενες Λύσεις:

1. **Design Tokens Update** (~150 errors)
   - Πρόσθεσε missing properties: `md`, `OPACITY`, `SLOW_ALL`, `paddingY4`
   - Αρχείο: `src/styles/design-tokens.ts`

2. **Type Definitions** (~100 errors)
   - Ενοποίησε `StorageType`, `BuildingStatus` interfaces
   - Δημιούργησε shared `Building extends SelectedItemBase`

3. **Διαγραφή `_old` files** (~30 errors)
   - `BuildingListItem_old.tsx` αναφέρεται σε deleted modules

---

## 2. src/services + src/hooks (447 errors)

### Top Error Categories:

| Κατηγορία | Πλήθος |
|-----------|--------|
| TS2339 - Property missing | 215 |
| TS2345/TS2322 - Type mismatch | 55 |
| TS2304 - Cannot find name | 40 |
| TS2484 - Export conflicts | 23 |
| TS2769 - No overload | 23 |

### Κρίσιμα Αρχεία:

| Αρχείο | Errors | Root Cause |
|--------|--------|------------|
| `contacts/ContactNameResolver.ts` | 59 | Property missing on Contact |
| `relationships/enterprise-relationship-engine.ts` | 49 | Property missing + implicit any |
| `hooks/useProjectsPageState.ts` | 29 | Property missing on Project |
| `hooks/useBuildingsPageState.ts` | 20 | Property missing on Building |
| `property-status/index.ts` | 20+ | Cannot find name |

### Προτεινόμενες Λύσεις:

1. **Interface Extension** (~200 errors)
   - Πρόσθεσε στο `Building`: `location`, `type`, `totalUnits`
   - Πρόσθεσε στο `ContactFormData`: `afm`, `capital`
   - Πρόσθεσε στο `Project`: missing properties

2. **Export Conflicts Fix** (~23 errors)
   - `EnterpriseFileSystemService.ts`: Remove duplicate exports
   - `EnterpriseLayerStyleService.ts`: Remove duplicate exports

3. **Missing Imports** (~40 errors)
   - `property-status/index.ts`: Add missing imports for `propertyStatusEngine`

---

## 3. src/subapps (230 errors - Geo-Canvas only)

### DXF-Viewer: ✅ 0 ERRORS (Καθαρό!)

### Geo-Canvas: 230 errors

| Κατηγορία | Πλήθος |
|-----------|--------|
| TS2345/TS2322 - Type mismatch | 56 |
| TS2339 - Property missing | 50 |
| TS2307 - Missing module | 12 |
| TS2352 - Type conversion | 9 |
| TS7006 - Implicit any | 2 |

### Κρίσιμα Αρχεία:

| Αρχείο | Errors | Root Cause |
|--------|--------|------------|
| `ui/design-system/index.tsx` | 10+ | Missing `./tokens/design-tokens` |
| `services/administrative-boundaries/AdministrativeBoundaryService.ts` | 18 | Type mismatch + implicit any |
| `hooks/useAdministrativeBoundaries.ts` | 14 | Type mismatch |
| `ui/design-system/layout/ResponsiveDashboard.tsx` | 17 | Property missing |

### Προτεινόμενες Λύσεις:

1. **Create Missing Module** (12 errors)
   - Δημιούργησε `geo-canvas/ui/design-system/tokens/design-tokens.ts`

2. **Administrative Boundaries Types** (~32 errors)
   - Ενημέρωσε type definitions για Overpass API responses

---

## 4. src/app + src/lib (132 errors)

### Top Error Categories:

| Κατηγορία | Πλήθος |
|-----------|--------|
| TS2345/TS2322 - Type mismatch | 48 |
| TS2339 - Property missing | 22 |
| TS7006 - Implicit any | 10 |
| TS2578 - Unused @ts-expect-error | 8 |

### Κρίσιμα Αρχεία:

| Αρχείο | Errors | Root Cause |
|--------|--------|------------|
| `api/conversations/[conversationId]/messages/route.ts` | 5 | Response type mismatch |
| `crm/communications/page.tsx` | 12 | FilterState type issues |
| `units/page.tsx` | 14 | Property missing + filter types |
| `lib/communications/CommunicationsService.ts` | 6 | Query constraint types |

### Προτεινόμενες Λύσεις:

1. **API Response Types** (~15 errors)
   - Δημιούργησε union types: `AuthenticatedHandler<SuccessResponse | ErrorResponse>`

2. **Filter State Types** (~20 errors)
   - Ενοποίησε `CommunicationsFilterState`, `UnitFilterState`, `GenericFilterState`

3. **Remove Unused Directives** (8 errors)
   - `debug/token-info/page.tsx`: Remove 8 unused `@ts-expect-error`

---

## 5. src/adapters + src/core + packages (216 errors)

### Top Error Categories:

| Κατηγορία | Πλήθος |
|-----------|--------|
| TS2304 - Cannot find name | 32 |
| TS2345/TS2322 - Type mismatch | 38 |
| TS2339 - Property missing | 35 |
| TS2307 - Missing module | 17 |
| TS2484 - Export conflicts | 12 |

### Κρίσιμα Αρχεία:

| Αρχείο | Errors | Root Cause |
|--------|--------|------------|
| `core/canvas/index.ts` | 32 | Lazy loading broken - all names missing |
| `core/performance/index.ts` | 14 | Missing implementation files |
| `core/modals/PhotoPreviewModal.tsx` | 8 | Contact interface incomplete |
| `config/unified-tabs-factory.ts` | 12 | Tab config type mismatches |
| `types/ContactFormTypes.ts` | 7 | Duplicate declarations |

### Προτεινόμενες Λύσεις:

1. **Fix core/canvas/index.ts** (32 errors) - CRITICAL
   - Το lazy loading system είναι σπασμένο
   - Πρέπει να γίνει proper type export για conditional imports

2. **Create core/performance/ files** (14 errors)
   - Missing: `monitoring/PerformanceMonitoringService.ts`
   - Missing: Several monitoring modules

3. **Remove Duplicate Type Declarations** (7 errors)
   - `types/ContactFormTypes.ts`: Consolidate duplicate interfaces

---

# ΠΡΟΤΕΡΑΙΟΤΗΤΕΣ ΔΙΟΡΘΩΣΗΣ

## 🔴 CRITICAL (Blocking - Διόρθωση Άμεσα)

| # | Αρχείο/Θέμα | Errors | Λόγος |
|---|-------------|--------|-------|
| 1 | `src/core/canvas/index.ts` | 32 | Broken module - blocks entire canvas system |
| 2 | `src/core/performance/index.ts` | 14 | Missing files - module non-functional |
| 3 | `src/styles/design-tokens.ts` | ~150 | Missing properties affect 10+ files |

## 🟠 HIGH (Διόρθωση Σύντομα)

| # | Αρχείο/Θέμα | Errors | Λόγος |
|---|-------------|--------|-------|
| 4 | Building/Project/Contact interfaces | ~300 | Missing properties across codebase |
| 5 | `geo-canvas/ui/design-system/` | ~50 | Missing design tokens module |
| 6 | Export conflicts (various) | ~37 | Duplicate exports blocking imports |

## 🟡 MEDIUM (Προγραμματισμένη Διόρθωση)

| # | Αρχείο/Θέμα | Errors | Λόγος |
|---|-------------|--------|-------|
| 7 | Implicit any (TS7006) | ~51 | **ΑΠΑΓΟΡΕΥΕΤΑΙ από CLAUDE.md** |
| 8 | Filter state type unification | ~30 | Inconsistent filter types |
| 9 | API response types | ~20 | Union types needed |

## 🟢 LOW (Όταν υπάρχει χρόνος)

| # | Αρχείο/Θέμα | Errors | Λόγος |
|---|-------------|--------|-------|
| 10 | Delete `_old` files | ~30 | Cleanup legacy code |
| 11 | Remove unused `@ts-expect-error` | 8 | Cleanup |
| 12 | Type conversion refinements | ~10 | Edge cases |

---

# ΣΤΡΑΤΗΓΙΚΗ ΔΙΟΡΘΩΣΗΣ

## Phase 1: Foundation (Εκτιμώμενα ~200 errors)
1. Fix `src/core/canvas/index.ts` - 32 errors
2. Fix `src/core/performance/index.ts` - 14 errors
3. Update `src/styles/design-tokens.ts` - ~150 errors

## Phase 2: Interfaces (Εκτιμώμενα ~400 errors)
1. Extend `Building` interface
2. Extend `Project` interface
3. Extend `Contact`/`ContactFormData` interfaces
4. Create `SelectedItemBase` base interface

## Phase 3: Modules (Εκτιμώμενα ~100 errors)
1. Create `geo-canvas/ui/design-system/tokens/`
2. Fix export conflicts
3. Add missing imports

## Phase 4: Cleanup (Εκτιμώμενα ~100 errors)
1. Add explicit types (implicit any)
2. Unify filter state types
3. Delete `_old` files
4. Remove unused directives

---

# APPENDIX: Error Codes Reference

| Code | Meaning | Common Fix |
|------|---------|------------|
| TS2305 | Module has no exported member | Add export to source |
| TS2304 | Cannot find name | Add import |
| TS2307 | Cannot find module | Create file or fix path |
| TS2322 | Type not assignable | Widen type or fix value |
| TS2339 | Property does not exist | Extend interface |
| TS2345 | Argument type mismatch | Fix function signature |
| TS2484 | Export conflict | Remove duplicate export |
| TS2564 | Property not initialized | Add initializer or `!` |
| TS2724 | Did you mean X? | Fix typo |
| TS7006 | Implicit any | Add type annotation |

---

**Report Generated by Claude Opus 4.5**
**5 Parallel Agents Analysis**
