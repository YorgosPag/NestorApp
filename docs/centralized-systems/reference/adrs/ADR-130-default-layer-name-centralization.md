# ADR-130: Default Layer Name Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Entity Systems |
| **Canonical Location** | `config/layer-config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Canonical**: `config/layer-config.ts`
- **Decision**: Centralize all `|| 'default'` layer name patterns to single source of truth
- **Problem**: 10+ hardcoded `'default'` layer fallbacks with inconsistent values:
  - `'default'` - 10 files (hardcoded)
  - `'general'` - `ENTERPRISE_CONSTANTS.DEFAULT_LAYER` (unused)
  - `'0'` - `CreateEntityCommand.ts` (DXF standard)
- **Files with Hardcoded `'default'`**:
  | File | Line | Context |
  |------|------|---------|
  | `utils/dxf-scene-builder.ts` | 71 | Entity layer assignment |
  | `rendering/passes/EntityPass.ts` | 135 | Batch key generation |
  | `rendering/hitTesting/HitTester.ts` | 379 | Hit test result |
  | `rendering/hitTesting/HitTester.ts` | 500 | Hit test result |
  | `systems/selection/utils.ts` | 78 | Layer lookup |
  | `state/overlay-manager.ts` | 100 | Current layer ID |
  | `services/HitTestingService.ts` | 155 | Hit test result |
  | `services/LayerOperationsService.ts` | 412 | Statistics |
- **Solution**: Centralized constants + utility functions in `config/layer-config.ts`
- **API**:
  ```typescript
  // === CONSTANTS ===
  DXF_DEFAULT_LAYER = '0'        // AutoCAD standard layer
  DEFAULT_LAYER_NAME = 'default' // Application default layer

  // === UTILITY FUNCTIONS ===
  getLayerNameOrDefault(layer: string | undefined | null): string
  getDxfLayerName(layer: string | undefined | null): string
  isDefaultLayer(layer: string | undefined | null): boolean
  ```
- **Files Migrated**:
  - `utils/dxf-scene-builder.ts` - 1 replacement
  - `rendering/passes/EntityPass.ts` - 1 replacement
  - `rendering/hitTesting/HitTester.ts` - 2 replacements
  - `systems/selection/utils.ts` - 1 replacement
  - `state/overlay-manager.ts` - 3 replacements (constant + initial state + createRegion)
  - `services/HitTestingService.ts` - 1 replacement
  - `services/LayerOperationsService.ts` - 1 replacement
  - `settings-provider/constants.ts` - Updated `ENTERPRISE_CONSTANTS.DEFAULT_LAYER`
  - `components/dxf-layout/CanvasSection.tsx` - 1 replacement
- **Files Skipped (Different Context)**:
  - `systems/cursor/useCentralizedMouseHandlers.ts:348` - `snap.activeMode || 'default'`
  - `systems/toolbars/utils.ts:168` - `action.group || 'default'`
- **Pattern**:
  ```typescript
  // Before (inline - PROHIBITED)
  const layerName = entity.layer || 'default';

  // After (centralized - REQUIRED)
  import { getLayerNameOrDefault } from '../config/layer-config';
  const layerName = getLayerNameOrDefault(entity.layer);
  ```
- **Benefits**:
  - Zero hardcoded layer fallbacks (8 eliminated)
  - Consistent layer naming across codebase
  - Single Source of Truth for default layer configuration
  - DXF compatibility via `getDxfLayerName()` for export
  - Type-safe with proper null handling
- **Companion**: ADR-129 (Layer Entity Filtering), ADR-104 (Entity Type Guards)

---
