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
  - `STORAGE_KEYS.AI_SNAPPING` - `'ai-snapping-data'`
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
  - `systems/ai-snapping/AISnappingEngine.ts` - AI snapping learned data
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
