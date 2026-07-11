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

## Φ3-text — imported text «has no height» (canonical-mm scale shadowed by textNode)

**Symptom (Giorgio, real KADOS file):** «τα κείμενα φαίνονται σαν μία γραμμή, δεν έχουν ύψος».
Grabbing a text's top-middle grip and dragging up made it show correctly. The Greek content was
**fine** (`ΚΛΙΜΑΚΑ` / `ΗΜΕΡΟΜΗΝΙΑ` decode correctly via `encodingService` Windows-1253 auto-detect —
the earlier «ÊËÉÌÁÊÁ» report was a throwaway-test `latin1` artifact, not a pipeline bug).

**Root cause:** ADR-462 canonical-mm import scales the file to mm (this drawing: `$INSUNITS=4` mm but
geometry diagonal ~73 → heuristic `'m'` → ×1000). `DxfSceneBuilder.buildScene` applies this via the
ADR-348 `scaleEntity` SSoT, whose `scaleText` scaled only the **flat** `height`/`fontSize` (0.1003 →
100.3). But the AUTHORITATIVE height lives in `textNode.paragraphs[].runs[].style.height`, and the
render/grip/ghost/3D SSoT `resolveTextHeight` reads that run height **FIRST** — so the flat scale was
**shadowed**: the renderer kept reading the unscaled `0.1003` → text ~1000× too short (invisible line
in a 68 m drawing). The grip-resize path already scaled the textNode (`scaleTextNodeRunHeights`);
the import/toolbar-Scale path did not.

**Fix (SSoT, one point):** `scaleText` (and `scaleMText`) in `systems/scale/scale-entity-transform.ts`
now also scale the `textNode` run heights via the **existing** `scaleTextNodeRunHeights(node, |sy|)`
helper (the same one the grip-resize commit uses — no duplicate scaler, N.18). This fixes the DXF
import AND the latent toolbar-Scale-tool case for imported/textNode text in one place. Verified
end-to-end: `convertText → scaleEntity(×1000) → resolveTextHeight` returns **100.3** (was 0.1003).

**Follow-up bug (unmasked by the height fix): `widthFactor` ×1000 → «τεράστιες οριζόντιες γραμμές».**
Once the text became visible, `scaleText` was stretching every glyph 1000× wide. Root cause: it did
`widthFactor *= |sx|`, but `widthFactor` is a **RATIO** (glyph width ÷ height), not an absolute width —
a uniform scale (sx===sy, the ×1000 import) must leave it **unchanged**. Corrected to
`widthFactor *= |sx/sy|` (uniform → 1×; identical to `|sx|` for the e/w grip where sy===1, so that
path is untouched; `sy===0` → 1×). Verified on the real file: widthFactor now **1** (was 1000), height
100–630. Tests: `scale-entity-text-height.test.ts` (5 cases: uniform height+widthFactor=1,
non-uniform height |sy| + widthFactor sx/sy, e/w grip sy=1, factor-1 no-op).

**Outlier `+95.00`:** a legit stray elevation label ~47.8 m below all geometry (layer visible,
`72/73=0`, position from `10/20` — AutoCAD shows it there too). Per Giorgio: leave as-is (AutoCAD
zoom-extents includes everything). No code change.

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
- **2026-07-11 — Φ3-text:** imported text «no height» fix. `scaleText`/`scaleMText`
  (`scale-entity-transform.ts`) now scale the `textNode` run heights via the existing
  `scaleTextNodeRunHeights` SSoT — the canonical-mm scale was shadowed because `resolveTextHeight`
  reads the run height first. Also repairs the toolbar Scale tool for imported text. Greek decode
  confirmed already correct; `+95.00` outlier left as-is (AutoCAD semantics). New test
  `scale-entity-text-height.test.ts`. jscpd clean.
  **+ widthFactor follow-up:** the height fix unmasked a `scaleText` bug — `widthFactor *= |sx|`
  stretched glyphs 1000× wide on the uniform mm-import («τεράστιες οριζόντιες γραμμές»). widthFactor
  is a ratio → corrected to `*= |sx/sy|` (uniform→1×, e/w grip sy=1 unchanged). Real file: widthFactor
  1 (was 1000). Test grown to 5 cases.
