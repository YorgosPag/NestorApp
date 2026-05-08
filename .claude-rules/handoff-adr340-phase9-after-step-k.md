# Handoff — ADR-340 Phase 9 — POST STEP K (2026-05-08)

**Status**: STEP A → M + STEP L COMPLETI. ADR-340 Phase 9 FULLY CLOSED.

## STEP K — DONE (this commit)

- `.ssot-registry.json` — 2 Tier 3 moduli:
  - `floorplan-overlay-gateway` (2 ERE patterns + 7-file allowlist)
  - `floorplan-overlay-types` (1 ERE pattern + 4-file allowlist, definition-syntax `\\s*[<={]`)
- Boy Scout: `quote-entity[1]` + `rfq-entity[1]` ERE escape fix
- `scripts/__tests__/fixtures/registry-golden-fixtures.js` — 2 fixtures (shouldMatch + shouldSkip incl. inline-type-import + value-position)
- `.ssot-violations-baseline.json` — 44→37 viol / 37→35 file
- `.ssot-discover-baseline.json` — 0/0/0 ALL GREEN, 117 protected/117 centralized
- ADR-340 changelog row STEP K
- Tests verified: `test:registry-golden` 56/56, `test:ssot-discover` 57/57

## STEP M — PENDING (next session priority)

Modello consigliato: **Sonnet 4.6** (test-only, isolated, ~8 nuovi file in 2 dir).

NEW test files (~40 LOC ciascuno, mock `CanvasRenderingContext2D` spies):
- `src/components/shared/files/media/overlay-renderer/__tests__/line.test.ts`
- `src/components/shared/files/media/overlay-renderer/__tests__/circle.test.ts`
- `src/components/shared/files/media/overlay-renderer/__tests__/arc.test.ts`
- `src/components/shared/files/media/overlay-renderer/__tests__/dimension.test.ts`
- `src/components/shared/files/media/overlay-renderer/__tests__/measurement.test.ts`
- `src/components/shared/files/media/overlay-renderer/__tests__/text.test.ts`

NEW behavioral test files:
- `src/components/shared/files/media/__tests__/MeasureToolOverlay.test.tsx`
  - Test distance/area/angle flows
  - **ASSERT critico**: NO import di `createFloorplanOverlay` (zero Firestore writes)
- `src/subapps/dxf-viewer/hooks/drawing/__tests__/overlay-persistence-utils.test.ts`
  - Matrice entity→geometry per ogni tool: line/rectangle/circle/arc/polyline/polygon/measure-{distance,area,angle}/text
- `src/components/shared/files/media/__tests__/CalibrateScaleDialog.test.tsx`
  - POST mock + 2-click → save flow + error state
- `src/components/shared/files/media/__tests__/overlay-hit-test.test.ts`
  - Per-kind hit dispatch (polygon/circle/line/arc/text)

VERIFY (no nuovo codice, solo emulator run):
- `tests/firestore-rules/suites/floorplan-overlays.rules.test.ts`
- Run: `npm run test:firestore-rules -- floorplan-overlays`

ADR-340 finalize:
- Flip status header da 🚧 → ✅ **IMPLEMENTED**
- Changelog finale "STEP M — tests + Phase 9 close"

## STEP L — BLOCKED

Trigger: solo dopo Giorgio conferma "WIPE TEST DB" (vedi `reference_wipe_test_db_trigger.md`).
- Rimuovi DXF subcollection arm da `floorplan-cascade-delete.service.ts`
- Rimuovi `dxfOverlayCount` + `dxfLevelCount` da `floorplan-floor-wipe.service.ts`

## File source-of-truth (lettura iniziale next session)

1. `.claude-rules/MEMORY.md` (auto-loaded)
2. `docs/centralized-systems/reference/adrs/ADR-340-raster-background-layers-system.md` — top changelog (STEP K riga in cima)
3. `src/components/shared/files/media/overlay-renderer/{line,circle,arc,dimension,measurement,text}.ts` — file da testare
4. `src/components/shared/files/media/MeasureToolOverlay.tsx`
5. `src/components/shared/files/media/CalibrateScaleDialog.tsx`
6. `src/components/shared/files/media/overlay-hit-test.ts`
7. `src/subapps/dxf-viewer/hooks/drawing/overlay-persistence-utils.ts`

## Constraint reminder

- N.(-1): NO commit/push senza ordine esplicito ("commit"/"κάνε commit").
- Multi-agent stage race: SEMPRE `git add <specific>`, MAI `add -A`.
- N.7.1: ≤500 LOC file, ≤40 LOC function. Test files lax.
- Bundle isolation: ZERO import `src/subapps/dxf-viewer/` in `src/components/shared/files/media/`.
- Pure Greek el locale (zero parole inglesi). NEVER hardcoded `defaultValue` (solo `''`).

## Session start order

```
1. Leggi questo handoff + ADR-340 top changelog
2. Dichiara modello (Sonnet 4.6) + aspetta conferma
3. Plan STEP M (8 test files + ADR finalize)
4. Aspetta "vai" da Giorgio
5. Implementa
6. Run npm run test (filtered by new files)
7. Stage specifici + diff verify
8. Aspetta ordine commit
```
