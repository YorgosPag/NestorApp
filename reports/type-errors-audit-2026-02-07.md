# Type Errors Audit

Date: 2026-02-07
Scope: All TypeScript sources excluding src/subapps/geo-canvas, src/subapps/dxf-viewer, and any paths containing dxf-panel.

## Totals
- Total errors: 460
- Files with errors: 143

## Categories
- TypeMismatch: 233
- MissingExportOrMember: 102
- Other: 68
- ObjectLiteral: 20
- MissingModule: 12
- SpreadOrConversion: 12
- ArgCount: 8
- ReadonlyOrMutation: 3
- ImplicitAny: 2

## Errors By Code
- TS2322: 113
- TS2345: 105
- TS2339: 84
- TS2353: 19
- TS2769: 16
- TS2304: 13
- TS2307: 12
- TS2352: 10
- TS2739: 10
- TS2724: 9
- TS2554: 8
- TS2741: 6
- TS2571: 5
- TS2740: 5
- TS2783: 4
- TS18046: 4
- TS2820: 4
- TS2551: 4
- TS2614: 3
- TS2698: 2
- TS2774: 2
- TS2532: 2
- TS2503: 2
- TS2459: 2
- TS2305: 2
- TS4104: 2
- TS7006: 2
- TS1117: 1
- TS2545: 1
- TS2559: 1
- TS2540: 1
- TS2367: 1
- TS2349: 1
- TS2344: 1
- TS17001: 1
- TS2561: 1
- TS7053: 1

## Errors By Area (Top 15)
- src/services: 140
- src/utils: 70
- src/features: 54
- src/lib: 40
- src/components: 38
- src/core: 35
- src/types: 18
- src/hooks: 17
- src/database: 15
- src/config: 13
- src/server: 7
- tests/firestore-rules: 7
- src/contexts: 5
- src/app: 1

## Most Affected Files (Top 20)
- src/utils/contactForm/fieldMappers/individualMapper.ts: 29
- src/utils/__tests__/unit-normalizer.test.ts: 25
- src/services/projects/services/ProjectsService-broken.ts: 23
- src/features/property-grid/components/PropertyCard.tsx: 11
- src/utils/contactForm/fieldMappers/companyMapper.ts: 11
- src/services/contacts.service.ts: 10
- src/services/teams/EnterpriseTeamsService.ts: 9
- src/types/project/__tests__/address-helpers.test.ts: 9
- src/lib/pagination.ts: 8
- src/services/property/EnterprisePropertyTypesService.ts: 8
- src/features/floorplan-viewer/FloorPlanViewer.tsx: 8
- src/services/obligations/InMemoryObligationsRepository.ts: 7
- src/config/unified-tabs-factory.ts: 7
- src/features/floorplan-canvas/FloorPlanCanvas.tsx: 7
- src/services/user/EnterpriseUserPreferencesService.ts: 7
- src/services/property-search.service.ts: 6
- src/lib/communications/providers/telegram.ts: 6
- src/hooks/useFormValidation.ts: 6
- src/server/comms/orchestrator.ts: 6
- src/lib/communications/index.ts: 6

## Notes
- Raw log: reports/typecheck-raw-2026-02-07.log
- Counts exclude geocanvas and dxf-viewer per request.

## Progress
- 2026-02-07 (post-fix pass 1): 448 errors across 138 files (excluding geocanvas, dxf-viewer, dxf-panel).
- Raw log: reports/typecheck-raw-2026-02-07-2.log
- 2026-02-07 (post-fix pass 2): 394 errors across 131 files (excluding geocanvas, dxf-viewer, dxf-panel).
- Raw log: reports/typecheck-raw-2026-02-07-5.log
