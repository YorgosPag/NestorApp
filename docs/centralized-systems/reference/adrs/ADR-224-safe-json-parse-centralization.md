# ADR-224: Safe JSON Parse Centralization

## Status
✅ **Implemented** — Phase 1

## Date
2026-03-13

## Context

Audit εντόπισε **35+ αρχεία** με identical `try { JSON.parse(...) } catch { fallback }` pattern σε **65+ κλήσεις** `JSON.parse`. Κάθε αρχείο reimplements το ίδιο try-catch block.

3 scattered patterns:
- `try { return JSON.parse(envVar) } catch { return defaults }` — config files
- `try { parsed = JSON.parse(str) } catch { parsed = {} }` — services/AI pipeline
- `try { JSON.parse(stored) } catch { return fallback }` — storage/UI components

## Decision

Δημιουργία centralized `safeJsonParse` utility στο `src/lib/json-utils.ts`:

```typescript
export function safeJsonParse<T>(input: string, fallback: T): T;
export function safeJsonParseWith<T>(input: string, fallback: T, validator: (parsed: unknown) => parsed is T): T;
```

## SSoT Location
- **File**: `src/lib/json-utils.ts`
- **Import**: `import { safeJsonParse } from '@/lib/json-utils'`

## Migration Pattern

```typescript
// BEFORE:
try { data = JSON.parse(str); } catch { data = fallback; }

// AFTER:
const data = safeJsonParse<Type>(str, fallback);

// With logging:
const parsed = safeJsonParse(raw, null);
if (parsed === null) { logger.error('...'); return fallback; }
```

## Files Migrated (Phase 1)

### Config files (8)
1. `src/config/role-mappings-config.ts`
2. `src/config/contact-info-config.ts`
3. `src/config/geographic-config.ts`
4. `src/config/company-gemi/options/legal-forms.ts`
5. `src/config/company-gemi/options/currencies.ts`
6. `src/config/admin-tool-definitions.ts` (2 patterns)
7. `src/components/landing/LandingPage.tsx`
8. `src/components/crm/dashboard/TeamPerformance.tsx`

### Services (12)
9. `src/services/ai-pipeline/agentic-loop.ts` (3 patterns)
10. `src/services/ai-pipeline/tools/agentic-tool-executor.ts`
11. `src/services/ai-pipeline/feedback-service.ts`
12. `src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts`
13. `src/services/realtime/RealtimeService.ts` (2 patterns)
14. `src/services/websocket/WebSocketService.ts`
15. `src/services/AnalyticsBridge.ts` (2 patterns)
16. `src/services/ErrorTracker.ts`
17. `src/services/real-estate-monitor/WebScrapingEngine.ts`
18. `src/subapps/accounting/services/external/openai-document-analyzer.ts` (2 patterns)
19. `src/services/floorplans/UnitFloorplanService.ts`
20. `src/services/floorplans/FloorFloorplanService.ts`

### Components + geo-canvas + dxf-viewer (10)
21. `src/components/shared/audit/ActivityTab.tsx`
22. `src/components/shared/files/FolderManager.tsx` (2 patterns, previously unprotected!)
23. `src/components/ui/ShareModal.tsx`
24. `src/app/share/photo/[id]/page.tsx`
25. `src/subapps/geo-canvas/components/AddressSearchPanel.tsx`
26. `src/subapps/geo-canvas/services/administrative-boundaries/SearchHistoryService.ts` (2 patterns)
27. `src/subapps/geo-canvas/services/administrative-boundaries/OverpassApiService.ts`
28. `src/subapps/geo-canvas/services/geo-transform/ControlPointManager.ts`
29. `src/subapps/dxf-viewer/rendering/canvas/core/CanvasSettings.ts`
30. `src/subapps/dxf-viewer/systems/rulers-grid/RulersGridSystem.tsx`

### Borderline files (6)
31. `src/subapps/geo-canvas/floor-plan-system/components/FloorPlanControlPointPicker.tsx`
32. `src/app/admin/database-update/page.tsx`
33. `src/app/api/dxf-ai/command/route.ts` (3 patterns)
34. `src/app/api/projects/create-for-companies/route.ts`
35. `src/subapps/dxf-viewer/settings/io/SyncService.ts`

## Exclusions

- `src/lib/storage/safe-storage.ts` — Ήδη SSoT για localStorage
- `src/subapps/dxf-viewer/utils/storage-utils.ts` — DXF-specific storage utilities
- `src/lib/clone-utils.ts` — `JSON.parse(JSON.stringify())` = deep clone
- `src/lib/firebaseAdmin.ts` — Throws custom `FirebaseAdminInitError`
- `src/services/floorplans/FloorplanService.ts` — Re-throws (intentional)
- `src/services/data-exchange/DataImportService.ts` — Throws (validation)
- `src/core/configuration/enterprise-messages-system.ts` — Internal cache clone
- `__tests__/` — Test utilities

## Changelog

| Date | Change |
|------|--------|
| 2026-03-13 | Phase 1: Created `json-utils.ts`, migrated ~35 files (~50 patterns) |
