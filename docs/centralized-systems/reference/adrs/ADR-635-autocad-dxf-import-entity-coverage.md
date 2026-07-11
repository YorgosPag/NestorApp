# ADR-635 — AutoCAD DXF Import Entity Coverage (empty-line alignment + old-style POLYLINE)

**Status:** Accepted (Φ1 implemented)
**Date:** 2026-07-11
**Domain:** dxf-viewer / import parser
**Related:** ADR-507 (ordered-pairs HATCH), ADR-462 (canonical-mm), ADR-368 (units override)

## Context

Importing DXF files exported by AutoCAD "showed almost nothing" in the Nestor DXF viewer.
Diagnosed against a real sample (`KADOS…Άνοψη στέγης.dxf`, **AutoCAD R12 / AC1009**, 116k lines,
contents: 199 `POLYLINE`, 3607 `LINE`, 522 `TEXT`, 78 `ARC`, 61 `CIRCLE`, 15 `INSERT`).

The dxf-viewer uses its own hand-written parser (`utils/dxf-entity-parser.ts` +
`dxf-entity-converters.ts` + `dxf-scene-builder.ts`), **not** the `dxf-parser` npm package
(that lib is used only by the separate `geo-canvas` subapp). Two root causes hid the geometry:

### Bug 1 — empty-line filter corrupted the (code,value) stride (DOMINANT)
`DxfSceneBuilder.buildScene` did `content.split('\n').map(trim).filter(l => l.length > 0)`.
DXF is a strict `code\nvalue` stream where AutoCAD writes **empty string values** (empty
TEXT/handle/name codes). The sample had **450 empty value lines**. Filtering them shifted the
fixed 2-line stride used by `parseEntities` / `parseHeader` / table parsers → the code/value
alignment desynced and **~90% of entities were silently dropped: 4483 → 467**.

### Bug 2 — polylines were never parsed correctly
- **Old-style `POLYLINE`** (R12 & any "Save As R12": `POLYLINE` + N×`VERTEX` + `SEQEND`, each
  `0`-delimited) was not in `SUPPORTED_ENTITY_TYPES` → skipped silently. 199 polylines lost.
- **`LWPOLYLINE`** read vertices via `parseVerticesFromData(data)`, but the flat
  `Record<string,string>` overwrites repeated `10/20` → only the **last** vertex survived →
  `<2 vertices` → `null`. Any multi-vertex LWPOLYLINE (i.e. every real one) was dropped too.

## Decision (Φ1)

1. **Stop filtering empty lines** in `buildScene`: `content.split('\n').map(line => line.trim())`.
   Empty values survive as `''`; every (code,value) pair stays aligned. Codes/values are still
   trimmed at read time. Result on the sample: **4467 scene entities** (was 467).
2. **Ordered-pairs vertex SSoT** — new `parseVerticesFromPairs(pairs)` in
   `dxf-converter-helpers.ts`, reusing the `EntityData.pairs` mechanism established for HATCH
   (ADR-507). Reads `10/20` in order (+ `42` bulge per vertex). Both polyline converters use it.
3. **Old-style POLYLINE** — `DxfEntityParser.parsePolylineGroup()` aggregates the compound
   `POLYLINE`+`VERTEX…`+`SEQEND` group into one `EntityData` (vertex `10/20/42` into `pairs`;
   header flags `70` / color `62` into `data`; the header's dummy elevation `10/20/30` is
   **excluded** so it is not a spurious vertex). New `convertPolyline()` emits the same
   `type:'polyline'` scene entity as LWPOLYLINE (shared downstream: bounds, unit scaling, render).
4. **LWPOLYLINE fix** — `convertLwPolyline` now reads `parseVerticesFromPairs(entityData.pairs)`
   (fallback to the legacy data-map path when no pairs).
5. **Closed-flag bitmask** — `(parseInt(flags) & 1) === 1` (was `data['70'] === '1'`), required
   because AutoCAD emits e.g. `70=129` (128|1 = closed).

`'POLYLINE'` added to `SUPPORTED_ENTITY_TYPES`; router `convertEntityToScene` gains a
`POLYLINE` case and passes `entityData.pairs` to both polyline converters.

## Files
- `utils/dxf-scene-builder.ts` — remove empty-line filter
- `utils/dxf-converter-helpers.ts` — `parseVerticesFromPairs` + `DxfPolyVertex`
- `utils/dxf-parser-types.ts` — `'POLYLINE'` in `SUPPORTED_ENTITY_TYPES`
- `utils/dxf-entity-parser.ts` — `parsePolylineGroup` + intercept in `parseEntities`
- `utils/dxf-entity-converters.ts` — `convertPolyline`, `convertLwPolyline` fix, router
- `utils/__tests__/dxf-polyline-parsing.test.ts` — 7 tests (unit + end-to-end)

## Verification
- Jest: `dxf-polyline-parsing.test.ts` (7) + full `utils/__tests__` suite **260/260 pass**.
- Real sample end-to-end via `buildScene`: **467 → 4467** entities; polyline 16 → 199.

## Decision (Φ2 — INSERT / BLOCK expansion)

**Symptom:** after Φ1, imported entities appeared **~360m** from the drawing. Proven on the real
file + DB (4467 entities): block-definition geometry was emitted at its authored coordinates and
`INSERT` was dropped (no converter). E.g. `NEW00O_BLOCK` base=(0,0), geometry authored @ (363619,
89583), INSERT @ (-346494, -85488) → correct place = insert+(geom−base) = **(17125, 4094)**; the
+363619 and −346494 cancel, but without the INSERT transform the geometry stayed 360m away and
inflated the bbox to 363m.

**Implementation:**
1. **Section-aware parsing** — `DxfEntityParser.findSectionRange(lines, name)`; `parseEntities`
   takes an optional range and scans **only ENTITIES**, so block-definition geometry is no longer
   emitted standalone. Shared dispatch `parseEntityAt` (used by both entity + block parsing).
2. **`parseBlockDefinitions(lines)`** (`dxf-block-parser.ts`) → `Map<name,{base,entities}>` over the
   BLOCKS section (header via reused `parseEntity`).
3. **`instantiateInsert(insert, blockDefs, ctx)`** (`dxf-block-expander.ts`) — applies
   `p = insertPoint + Rot(angle)·Scale(sx,sy)·(p_block − base)` reusing SSoTs `scaleEntity` /
   `rotateEntity` / `translateEntityByAnchor`. Nested INSERT recursion (guard `MAX_DEPTH=16`),
   MINSERT column/row arrays (70/71/44/45), BYBLOCK layer inheritance (child layer `'0'` → INSERT layer).
4. **`dxf-scene-builder.ts`** — parses block defs, scopes to ENTITIES, expands INSERTs, funnels
   direct + expanded entities through the SAME `processSceneEntity` (layer + BYLAYER color).
   Extracted `resolveLayerColor` SSoT (LAYER table → COLOR_x) shared by layer-register + entity-color.

**Result on real file:** strays gone, bbox 363m → **68.7m**, far-entity count 0. Scene 4467 → 556
(511 model-space + 45 from 15× `NEW00O_BLOCK` @ 3 entities each). The 417 **un-inserted** block
definitions correctly no longer render (AutoCAD semantics — only INSERTed blocks appear).

## Out of scope (roadmap)
- **Φ3 — skipped-entities warning.** No user-facing report of dropped types (`SOLID`, `POINT`,
  `3DFACE`). Add a per-type counter → toast/report (Google-level: no silent drop).
- Full BYBLOCK color/linetype inheritance; text-angle rotation fidelity under INSERT.
- **Follow-up:** `convertSpline` has the same data-map vertex bug (`dxf-entity-converters.ts`);
  migrate to `parseVerticesFromPairs`. Bulge→arc tessellation (Φ1b) — bulge is captured but
  currently rendered as straight segments (21 curved vertices in the sample).

## Changelog
- **2026-07-11 — Φ1:** empty-line filter fix + old-style POLYLINE support + LWPOLYLINE vertex
  fix + closed bitmask. Real AutoCAD R12 import goes from ~467 to ~4467 rendered entities.
- **2026-07-11 — Φ2:** INSERT/BLOCK expansion (section-aware parse + block-def map + placement
  transform, nested + MINSERT arrays). Fixes ~360m-away block geometry: bbox 363m→68.7m, 0 strays.
  New: `dxf-block-parser.ts`, `dxf-block-expander.ts`, `parseEntityAt`/`findSectionRange`,
  `resolveLayerColor` SSoT. 266 jest, jscpd clean.
