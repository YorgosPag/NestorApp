# ADR-222: console.error/warn → createModuleLogger Migration

## Status
✅ Implemented (Phase 1) — 2026-03-13

## Context

Audit εντόπισε **573 εμφανίσεις** raw `console.error`/`console.warn` σε ~144 αρχεία, ενώ **645 αρχεία** ήδη χρησιμοποιούν `createModuleLogger`. Adoption ήταν στο **82%** — αυτή η εργασία κλείνει το gap.

Ο enterprise Logger (`src/lib/telemetry/Logger.ts`) παρέχει: structured logging, log levels, correlation IDs, module prefixes. Τα raw `console.error/warn` χάνουν αυτά τα πλεονεκτήματα.

### Τα 4 inconsistent patterns που εντοπίστηκαν:
1. `console.error('[Module]', error)` — structured αλλά raw
2. `console.warn('[Module]', ...)` — structured warnings
3. `console.error('Failed to...', error)` — unstructured
4. `console.error(error)` — bare error dumps

## Decision

Μηχανική μετάβαση όλων των `console.error`/`console.warn` σε `createModuleLogger` pattern:

```typescript
// ΠΡΙΝ:
console.error('[Module] Something failed:', error);
console.warn('[Module] Deprecated feature');

// ΜΕΤΑ:
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('Module');

logger.error('Something failed', { error });
logger.warn('Deprecated feature');
```

### Module Naming Convention
PascalCase, derived from filename:
- `AdministrativeBoundaryService.ts` → `'AdministrativeBoundaryService'`
- `SalesActionDialogs.tsx` → `'SalesActionDialogs'`

## Scope

### Phase 1 (αυτό το ADR): 30 αρχεία με 3+ raw calls
~180 κλήσεις migrated σε 30 αρχεία.

### Εξαιρέσεις (ΔΕΝ αλλάζουν):
- `src/lib/telemetry/Logger.ts` — Ο ίδιος ο Logger χρησιμοποιεί console εσωτερικά
- `.md` documentation files — Παραδείγματα κώδικα
- `debug/` files — Debugging tools
- `__tests__/` files — Test utilities
- `consoleLoggerAdapter.ts` — Σκόπιμη χρήση console

## Files Changed (Phase 1)

| # | File | Calls Migrated |
|---|------|---------------|
| 1 | `src/subapps/geo-canvas/services/administrative-boundaries/AdministrativeBoundaryService.ts` | 14 |
| 2 | `src/subapps/geo-canvas/services/administrative-boundaries/OverpassApiService.ts` | 12 |
| 3 | `src/subapps/dxf-viewer/rendering/canvas/utils/CanvasUtils.ts` | 9 |
| 4 | `src/subapps/geo-canvas/cloud/enterprise/core/infrastructure-manager.ts` | 9 |
| 5 | `src/subapps/geo-canvas/cloud/enterprise/services/alert-service.ts` | 8 |
| 6 | `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx` | 8 |
| 7 | `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/EntitiesSettings.tsx` | 8 |
| 8 | `src/components/sales/dialogs/SalesActionDialogs.tsx` | 6 |
| 9 | `src/subapps/geo-canvas/services/spatial/SpatialQueryService.ts` | 6 |
| 10 | `src/subapps/geo-canvas/services/cache/AdminBoundariesCacheManager.ts` | 5 |
| 11 | `src/subapps/geo-canvas/components/AddressSearchPanel.tsx` | 6 |
| 12 | `src/subapps/dxf-viewer/core/commands/CommandPersistence.ts` | 6 |
| 13 | `src/subapps/dxf-viewer/settings/io/LocalStorageDriver.ts` | 6 |
| 14 | `src/subapps/dxf-viewer/settings/io/IndexedDbDriver.ts` | 6 |
| 15 | `src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts` | 5 |
| 16 | `src/subapps/dxf-viewer/services/FitToViewService.ts` | 5 |
| 17 | `src/subapps/dxf-viewer/settings/io/SyncService.ts` | 5 |
| 18 | `src/subapps/dxf-viewer/settings/io/safeSave.ts` | 5 |
| 19 | `src/subapps/geo-canvas/services/map/ElevationService.ts` | 4 |
| 20 | `src/subapps/geo-canvas/hooks/map/useMapInteractions.ts` | 5 |
| 21 | `src/subapps/geo-canvas/floor-plan-system/utils/transformation-calculator.ts` | 5 |
| 22 | `src/subapps/geo-canvas/automation/TestingPipeline.ts` | 5 |
| 23 | `src/services/esco.service.ts` | 5 |
| 24 | `src/subapps/dxf-viewer/ui/components/layers/hooks/useLayersCallbacks.ts` | 5 |
| 25 | `src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts` | 3 |
| 26 | `src/subapps/dxf-viewer/core/commands/CommandRegistry.ts` | 4 |
| 27 | `src/subapps/dxf-viewer/core/commands/overlay-commands/MoveOverlayVertexCommand.ts` | 4 |
| 28 | `src/subapps/dxf-viewer/pdf-background/services/PdfRenderer.ts` | 4 |
| 29 | `src/subapps/geo-canvas/floor-plan-system/rendering/FloorPlanCanvasLayer.tsx` | 4 |
| 30 | `src/subapps/geo-canvas/floor-plan-system/utils/dxf-thumbnail-generator.ts` | 4 |

## SSoT Reference
- **Logger**: `src/lib/telemetry/Logger.ts` (327 lines)
- **Import**: `import { createModuleLogger } from '@/lib/telemetry'`

## Changelog
- **2026-03-13**: Phase 1 — 30 αρχεία, ~180 κλήσεις migrated
