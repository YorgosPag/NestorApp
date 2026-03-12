# ADR-202: Floorplan Save Orchestrator

| Field | Value |
|-------|-------|
| **Status** | ✅ APPROVED |
| **Date** | 2026-03-12 |
| **Category** | Backend Systems / File Storage |
| **Author** | Claude Agent |

## Context

Η 4-step FileRecord save λογική επαναλαμβανόταν **σχεδόν ταυτόσημη** σε 3 floorplan services:

1. `FloorFloorplanService.saveFloorplan()` — ~40 γραμμές
2. `UnitFloorplanService.saveFloorplan()` — ~100 γραμμές (με thumbnail)
3. `BuildingFloorplanService.createFileRecord()` — ~100 γραμμές (με thumbnail)

Τα 4 steps:
1. `FileRecordService.createPendingFileRecord()` → fileId, storagePath
2. Upload binary to Firebase Storage (JSON / gzip / raw file)
3. `getDownloadURL()` → downloadUrl
4. `FileRecordService.finalizeFileRecord()` → status: ready

## Decision

Δημιουργήθηκε `FloorplanSaveOrchestrator` στο `src/services/floorplans/floorplan-save-orchestrator.ts`.

### Payload Types (Discriminated Union)

| Kind | Usage | Compression |
|------|-------|-------------|
| `json` | FloorFloorplanService (scene JSON) | None |
| `gzip-json` | Unit/Building (scene data) | pako gzip |
| `raw-file` | DXF/PDF original files | Optional gzip for DXF |

### What Moved to Orchestrator

- Steps 1-4 (create → upload → URL → finalize)
- Thumbnail generation (optional, non-blocking)
- Upload compression logic (gzip for DXF/JSON, raw for PDF)

### What Stays in Services

- Input validation (scene data present, file type checks)
- `RealtimeService.dispatch()` calls (service-specific events)
- Legacy fallback reads (Unit: `unit_floorplans`, Building: `building_floorplans`)
- `DxfFirestoreService` integration (Building: `saveToStorage()`)

## Files Created

- `src/services/floorplans/floorplan-save-orchestrator.ts` — Centralized save logic

## Files Modified

| File | Lines Removed | Change |
|------|---------------|--------|
| `FloorFloorplanService.ts` | ~30 | Steps 1-4 → `FloorplanSaveOrchestrator.save()` |
| `UnitFloorplanService.ts` | ~80 | Steps 1-5 → `FloorplanSaveOrchestrator.save()` |
| `BuildingFloorplanService.ts` | ~90 | `createFileRecord()` → `FloorplanSaveOrchestrator.save()` |

## Consequences

- **Positive**: ~200 lines of duplicated code → single implementation
- **Positive**: Bug fixes in save logic apply to all 3 services automatically
- **Positive**: New entity types can reuse the orchestrator
- **Neutral**: Services still handle their own validation and event dispatch
- **Risk**: Low — external APIs unchanged, only internal implementation refactored

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — centralized 4-step pattern |
