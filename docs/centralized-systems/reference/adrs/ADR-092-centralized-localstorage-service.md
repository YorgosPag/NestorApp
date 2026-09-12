# ADR-092: Centralized localStorage Service

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Infrastructure |
| **Canonical Location** | `storageGet()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `storageGet()`, `storageSet()`, `storageRemove()`, `STORAGE_KEYS` from `utils/storage-utils.ts`
- **Decision**: Centralize all localStorage operations with SSR-safe, type-safe utilities
- **Problem**: 37+ scattered localStorage calls across 16 files with:
  - Inconsistent error handling
  - Missing SSR-safe checks
  - Duplicate JSON parse/stringify patterns
  - Different key naming conventions
- **Solution**: Extended existing `storage-utils.ts` with sync localStorage utilities
- **API**:
  - `STORAGE_KEYS` - Registry of all localStorage keys
  - `storageGet<T>(key, defaultValue): T` - SSR-safe getter with type safety
  - `storageSet<T>(key, value): boolean` - SSR-safe setter with quota handling
  - `storageRemove(key): boolean` - SSR-safe removal
  - `storageHas(key): boolean` - SSR-safe existence check
- **Key Registry**:
  - `STORAGE_KEYS.DEBUG_RULER` - `'debug.rulerDebug.enabled'`
  - `STORAGE_KEYS.DEBUG_ORIGIN_MARKERS` - `'debug.originMarkers.enabled'`
  - `STORAGE_KEYS.PERFORMANCE_MONITOR` - `'dxf-viewer-performance-monitor-enabled'`
  - `STORAGE_KEYS.OVERLAY_STATE` - `'dxf-viewer:overlay-state:v1'`
  - `STORAGE_KEYS.OVERLAY_STATE_PREFIX` - `'dxf-overlay-'` (per-level dynamic key)
  - `STORAGE_KEYS.RECENT_COLORS` - `'dxf-viewer:recent-colors'`
  - `STORAGE_KEYS.DXF_SETTINGS` - `'dxf-settings-v2'`
  - `STORAGE_KEYS.CURSOR_SETTINGS` - `'autocad_cursor_settings'`
  - ~~`STORAGE_KEYS.AI_SNAPPING` - `'ai-snapping-data'`~~ — Removed 2026-05-27 (ADR-378 Phase 1: AISnappingEngine deleted)
  - `STORAGE_KEYS.RULERS_GRID_PREFIX` - `'rulers-grid-persistence'`
  - `STORAGE_KEYS.CONSTRAINTS_PREFIX` - `'dxf-viewer-constraints'`
  - `STORAGE_KEYS.COMMAND_HISTORY_PREFIX` - `'dxf-command-history'`
- **Files Migrated (Phase 1)**:
  - `debug/RulerDebugOverlay.ts` - Debug toggle persistence
  - `debug/OriginMarkersDebugOverlay.ts` - Debug toggle persistence
  - `hooks/usePerformanceMonitorToggle.ts` - Performance monitor state
  - `hooks/state/useOverlayState.ts` - Overlay editor state
  - `ui/color/RecentColorsStore.ts` - Recent colors LRU cache (SSR fix!)
- **Files Migrated (Phase 2 - Full Centralization)**:
  - `state/overlay-manager.ts` - Per-level overlay state persistence
  - `systems/cursor/config.ts` - Cursor settings persistence
  - `stores/DxfSettingsStore.ts` - DXF settings (general + overrides)
  - `systems/rulers-grid/usePersistence.ts` - Rulers/Grid persistence hook
  - `systems/rulers-grid/RulersGridSystem.tsx` - Main rulers/grid system
  - `systems/constraints/useConstraintsSystemState.ts` - Constraints system state
  - ~~`systems/ai-snapping/AISnappingEngine.ts`~~ - Removed 2026-05-27 (ADR-378 Phase 1: file deleted as dead code)
  - `core/commands/CommandPersistence.ts` - Command history fallback storage
  - `ui/CursorSettingsPanel.tsx` - Cursor settings clear & reload
- **Relationship to LocalStorageDriver**:
  - `LocalStorageDriver` (ADR async) - Full enterprise async driver for settings
  - `storageGet/Set` (ADR-092 sync) - Lightweight sync utilities for simple state
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero SSR errors (automatic `typeof window` check)
  - Zero duplicate try/catch blocks
  - Consistent error logging with `[StorageService]` prefix
  - Quota exceeded handling built-in
  - Type-safe JSON serialization
- **Companion**: LocalStorageDriver (async enterprise), StorageManager (quota/cleanup)

---

## 🔴 2026-09-12 — Δύο κανόνες που γεννήθηκαν από σφάλμα παραγωγής (ADR-858)

### 1. Το `storage-utils` είναι **primitive** — δεν εισάγει barrel

```diff
- import { dwarn, derr } from '../debug';
+ import { dwarn, derr } from '../debug/core/UnifiedDebugManager';
```

Αυτό το αρχείο είναι το **χαμηλότερο** επίπεδο του viewer. Το barrel `../debug` ήταν η
**κορυφή** του γράφου: επανεξήγαγε `SnapDebugLogger`, που τραβούσε ολόκληρο τον γεωμετρικό
γράφο, που κατέληγε στο `table-ink` → `table-surface-mode` → **πίσω εδώ**.

Ο κύκλος έκλεινε πάνω στο **`STORAGE_KEYS`**, και επειδή ο τελευταίος κρίκος το διάβαζε σε
χρόνο αξιολόγησης module, η παραγωγή έσκαγε με `Cannot access 'o' before initialization`
(TDZ) στο `/o/<χώρος>/sales/available-properties` — **σελίδα που δεν ανοίγει καν τον viewer**.

⚠️ **ΜΗΝ το «τακτοποιήσεις» πίσω σε `from '../debug'`.** Το σχόλιο στο αρχείο το εξηγεί·
το `UnifiedDebugManager.ts` έχει **μόνο** `import type` ⇒ μηδέν ακμές στον γράφο.

### 2. Ποιος καταναλώνει το `STORAGE_KEYS` — και **πότε**

Το `storageGet`/`storageSet` είναι SSR-safe, αλλά αυτό **δεν αρκεί**: το πρόβλημα δεν ήταν
«τρέχει στον server;» αλλά **«τρέχει σε χρόνο αξιολόγησης module;»**. Κάθε
`const store = …storageGet(STORAGE_KEYS.X, …)` σε module scope είναι πυροκροτητής για κάθε
κύκλο που περνά από εδώ.

✅ **Ο σωστός τρόπος ζει στο `stores/createPersistedValue.ts`** (τεμπέλικη ενυδάτωση,
`hydrateOnce()` στην πρώτη `get`/`set`/`subscribe`). Χρησιμοποίησέ το — μην ξαναγράψεις
χειροκίνητο `createExternalStore` + `storageGet`.

📘 Πλήρες περιστατικό, απόδειξη από το bundle, και οι τέσσερις πύλες: **ADR-858**.

---
