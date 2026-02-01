# ADR-098: Timing Delays Centralization (setTimeout/setInterval)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Tools & Keyboard |
| **Canonical Location** | `config/timing-config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-01-31
- **Canonical**: `config/timing-config.ts`
- **Problem**: 18+ hardcoded timing values (50, 100, 150, 500, 1000, 2000 ms) scattered across 7 files
- **Solution**: Centralize all setTimeout/setInterval timing constants
- **Constants Categories**:
  - `INPUT_TIMING`: Focus delays (10ms, 50ms)
  - `FIELD_TIMING`: Field render delays (150ms)
  - `UI_TIMING`: Menu guards, tool transitions, anchor display (50ms, 100ms, 1000ms)
  - `STORAGE_TIMING`: Settings debounce, save status display, scene autosave (150ms, 500ms, 2000ms)
  - `COLLABORATION_TIMING`: Connection delays, cursor updates (100ms, 500ms)
- **Files Migrated**:
  - `useDynamicInputKeyboard.ts` (8 replacements)
  - `useDxfSettings.ts` (5 replacements)
  - `CollaborationEngine.ts` (2 replacements)
  - `ToolStateStore.ts` (1 replacement)
  - `useColorMenuState.ts` (1 replacement)
  - `useDynamicInputAnchoring.ts` (1 replacement)
  - `DxfSettingsStore.ts` (1 replacement)
  - `useAutoSaveSceneManager.ts` (1 replacement - SCENE_AUTOSAVE_DEBOUNCE)
- **Removed Dead Code**: `AUTOSAVE_DEBOUNCE_MS` from `overlays/types.ts` (exported but never used)
- **Benefits**: Single Source of Truth, easy performance tuning, no magic numbers

---
