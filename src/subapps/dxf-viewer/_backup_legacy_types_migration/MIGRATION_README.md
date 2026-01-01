# Legacy Types Migration Backup

## Backup Date: 2026-01-01

## Purpose
This folder contains backup copies of all files that import from the **LEGACY** `settings/core/types.ts` before migration to the **CANONICAL** `settings-core/types.ts`.

---

## The Problem: Duplicate Type Definitions

### Two Type Files Existed:

| File | Status | Properties |
|------|--------|------------|
| `settings/core/types.ts` | **LEGACY** | Simple (lineColor, lineStyle, textColor) |
| `settings-core/types.ts` | **CANONICAL** | Enterprise Full (ISO 128, ISO 3098) |

### Key Differences:

| Property | Legacy | Canonical |
|----------|--------|-----------|
| Line color | `lineColor` | `color` |
| Line style | `lineStyle` (3 values) | `lineType` (5 values) |
| Text color | `textColor` | `color` |
| Font weight | `'normal' \| 'bold'` | `number (100-900)` |
| Line features | 4 properties | 20+ properties |
| Validation | None | Full ISO-based |

---

## Files Backed Up (20 files)

### settings/core/
- `types.ts` - The legacy type definitions

### settings/sync/
- `storeSync.ts`

### settings/state/
- `selectors.ts`
- `actions.ts`
- `reducer.ts`

### settings/io/
- `safeLoad.ts`
- `safeSave.ts`
- `LocalStorageDriver.ts`
- `IndexedDbDriver.ts`
- `SyncService.ts`
- `legacyMigration.ts`

### settings-provider/
- `EnterpriseDxfSettingsProvider.tsx`
- `reducerHelpers.ts`

### settings-provider/hooks/
- `useEnterpriseActions.ts`
- `useEnterpriseSettingsState.ts`
- `useBackwardCompatHooks.ts`
- `useEffectiveSettings.ts`

### settings-provider/storage/
- `useStorageSave.ts`
- `useStorageLoad.ts`

### providers/
- `DxfSettingsProvider.OLD.tsx`

---

## Migration Strategy: Facade + Deprecation

### Phase 1: Convert Legacy to Facade
The legacy `settings/core/types.ts` will be converted to re-export from canonical:
```typescript
/**
 * @deprecated Use settings-core/types.ts instead
 * This file is a facade for backward compatibility
 */
export * from '../../settings-core/types';

// Legacy aliases for backward compatibility
export type { LineSettings } from '../../settings-core/types';
// ... with property adapters if needed
```

### Phase 2: Add Deprecation Warnings
All imports from legacy path will show JSDoc `@deprecated` warnings.

### Phase 3: Gradual Migration
When touching any file, update imports to canonical path.

### Phase 4: Removal
After all files migrated, delete legacy types file.

---

## Canonical Types Location

**Single Source of Truth:**
```
src/subapps/dxf-viewer/settings-core/types.ts
```

**Features:**
- ISO 128 line standards
- ISO 3098 text standards
- Full validation functions
- 417 lines of enterprise code
- Cursor, Grid, Ruler settings

---

## Restore Instructions

If migration fails, restore files from this backup:
```powershell
Copy-Item -Recurse ".\*" "..\..\" -Force
```

---

## Created By
- **User:** Giorgos
- **Assistant:** Claude Opus 4.5
- **Session Date:** 2026-01-01
