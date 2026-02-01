# ADR-101: Deep Clone Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Data & State |
| **Canonical Location** | `deepClone<T>()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `deepClone<T>()` from `utils/clone-utils.ts`
- **Decision**: Centralize all `JSON.parse(JSON.stringify(...))` patterns to single utility function
- **Problem**: 11 inline `JSON.parse(JSON.stringify(...))` patterns across 6 files:
  - **Command Pattern - State Snapshots** (7 uses):
    - `MoveOverlayCommand.ts` line 98: Overlay polygon vertices for undo
    - `DeleteOverlayCommand.ts` line 59: Full overlay snapshot for soft delete
    - `DeleteOverlayCommand.ts` line 193: Batch delete snapshots
    - `MoveEntityCommand.ts` line 230: Entity movement snapshot
    - `MoveEntityCommand.ts` line 400: Batch move snapshots
    - `DeleteEntityCommand.ts` line 39: Single entity deletion
    - `DeleteEntityCommand.ts` line 143: Batch deletion snapshots
  - **UI State Management** (1 use):
    - `CanvasSection.tsx` line 1530: Drag start polygon copy
  - **Factory Settings** (2 uses):
    - `FACTORY_DEFAULTS.ts` line 336: Get all factory defaults
    - `FACTORY_DEFAULTS.ts` line 348: Get entity-specific defaults
  - **Data Migration** (1 use):
    - `migrationRegistry.ts` line 413: Data backup before migration
- **Solution**: Single generic `deepClone<T>()` function
- **API**:
  ```typescript
  import { deepClone } from '../utils/clone-utils';

  // Clone any serializable value
  const copy = deepClone(entity);
  const polygonCopy = deepClone(overlay.polygon);
  ```
- **Files Changed** (7 files, 11 replacements):
  - `utils/clone-utils.ts` - NEW centralized utility
  - `core/commands/overlay-commands/MoveOverlayCommand.ts` - 1 replacement
  - `core/commands/overlay-commands/DeleteOverlayCommand.ts` - 2 replacements
  - `core/commands/entity-commands/MoveEntityCommand.ts` - 2 replacements
  - `core/commands/entity-commands/DeleteEntityCommand.ts` - 2 replacements
  - `components/dxf-layout/CanvasSection.tsx` - 1 replacement
  - `settings/FACTORY_DEFAULTS.ts` - 2 replacements
  - `settings/io/migrationRegistry.ts` - 1 replacement
- **Limitations** (by design - matches existing behavior):
  - Does not clone: undefined, functions, Symbols, circular references
  - Date objects become strings
  - Map/Set become empty objects
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate `JSON.parse(JSON.stringify())` patterns
  - Type-safe generic function `deepClone<T>(value: T): T`
  - Cleaner, more readable code
  - Single point of documentation for cloning behavior
  - Future-proof: Easy to swap implementation (e.g., structuredClone)
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -rE "JSON\.parse\(JSON\.stringify" src/subapps/dxf-viewer --include="*.ts" --include="*.tsx"` (should return only clone-utils.ts)
- **Companion**: ADR-031 (Command Pattern), ADR-065 (Geometry Utils)
