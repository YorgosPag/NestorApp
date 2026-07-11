# ADR-635 — AutoCAD DXF Import Entity Coverage (empty-line alignment + old-style POLYLINE)

**Status:** Accepted (Φ1–Φ3 implemented)
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

## Φ3 — fault-tolerant import + diagnostics (Revit/Figma-level robustness)

**Problem.** The `/api/floorplans/process` route returned a generic `500 "Floorplan processing failed"`
after ~11 s and the real cause never reached the client. Root causes were structural, not one bad file:
1. **Unbounded INSERT/MINSERT expansion** (Φ2) — `cols×rows` and nested-block recursion had no entity
   ceiling → a malformed/huge array or exponential block reference could exhaust memory / stall.
2. **Unguarded `lines[i+1].trim()`** in `parseEntity` / `parseEntityAt` / the BLOCKS parser →
   `TypeError` on a truncated or odd-line-count file.
3. **All-or-nothing parse** — a single throwing entity aborted the whole import.
4. **Silent drops** — recognized-but-unconvertible types (`SOLID`, …) vanished with no trace.
5. **Swallowed detail** — the API client discarded the response `details`, so 500s were undiagnosable.

**Design (how the big players do it).** A professional importer imports what it can and *reports* the
rest. Four layers, all funnelling through existing SSoTs (no new transform/parse math):

- **L1 Fault-tolerant core** — the per-entity loop in `buildSceneWithDiagnostics` wraps each entity
  (and each block member) in try/catch: a failure is recorded and skipped, the import continues. A safe
  `lineAt(lines,i)` accessor (SSoT in `dxf-entity-parser.ts`, reused by the BLOCKS parser) returns `''`
  instead of throwing at the stream boundary.
- **L2 Bounded expansion** — `dxf-block-expander.ts` caps MINSERT cells at `MAX_ARRAY_CELLS = 10 000`
  and enforces a scene-wide `DEFAULT_SCENE_ENTITY_BUDGET = 500 000` shared via `ExpandContext.budget`;
  the depth guard (16) now records a clamp instead of failing silently. **No silent caps** — every clamp
  is logged in the diagnostics.
- **L3 Diagnostics SSoT** — `dxf-import-diagnostics.ts`: `ImportDiagnostics` (`parsedByType`,
  `skippedByType`, `errors[]`, `clamps[]`, `truncated`) + `summarizeDiagnostics()`. `buildScene()` stays
  backward-compatible (returns the scene only); the new `buildSceneWithDiagnostics()` returns
  `{ scene, diagnostics }`.
- **L4 Surface** — a single `runDxfParse()` SSoT (`run-dxf-parse.ts`, no DOM deps) does
  build→normalize→validate→wrap and is now the ONE implementation used by both the Web Worker and the
  client direct path (removed the twin boilerplate). The server route returns `warnings[]`; the API
  client (`ApiClientError.details` + `handleResponse`/`logError`) now preserves and logs the server
  `details`.

**SSoT note.** `buildScene` is *not* triplicated — it is one implementation called from three sites
(server route, `dxf-import.ts`, worker); the robustness lives in that one core. The genuine duplication
that *did* exist — the build/validate/wrap boilerplate in the worker and `dxf-import.ts` — is now the
shared `runDxfParse()`.

**Tests:** `dxf-import-robustness.test.ts` (5 cases: clean import, skipped-type counting, MINSERT clamp,
truncated-file no-throw, `buildScene` back-compat). Existing Φ1/Φ2 suites unchanged & green. jscpd clean.

## Φ4 — Rich MTEXT import (parseMtext AST — closes the ADR-636 Φ2.3 double-escape limitation)

**Symptom.** Imported MTEXT showed its **inline codes verbatim** (`Γραμμή1\PΓραμμή2` on one line,
no paragraph break, no formatting), and a re-export **double-escaped** the paragraph break
(`\P` → `\\P`) — the known limitation flagged in ADR-636 Φ2.3.

**Root cause.** `convertMText` dropped the entire raw group-1/3 content string into **ONE run** via
`buildTextNodeFromFlat`, so `textNode` was a single flat run holding the raw codes:
1. **View** — the render/hit-test/snap SSoTs read the flat `.text` FIRST
   (`e.text ?? extractFlatText(textNode)`, e.g. `project-scene-text.ts:50`, `TextRenderer.ts:86`),
   and `.text` was the raw string → codes rendered literally, `splitTextLines` never saw the `\P`.
2. **Re-export** — `emitMText` → `serializeDxfTextNode` `escapeText`'d the run's `\` → the run text
   `"…\P…"` became `"…\\P…"`.

**Fix (SSoT reuse, one converter, zero new parser).** `convertMText` now feeds the **existing**
ADR-344 parser SSoT: `parseMtext(tokenizeMtext(decodeGreekText(raw)), { height })` → a real
multi-paragraph/run `DxfTextNode`. The node's `attachment` (code 71) and `rotation` (code 50) are
set from the entity (the parser hard-codes `TL`/`0`, seeing only inline codes). The flat `.text` is
now the PLAIN reduction `extractFlatText(textNode)` (paragraph breaks → `\n`, no codes) — the string
every flat-first consumer needs.

**Result (fidelity in one):**
- **View** — `\P`→`\n` line breaks render correctly; first-run align/bold/italic/color/height apply
  (via the existing `extractFirstRunStyle`/`resolveTextHeight` from the AST). Inline codes handled:
  `\H \W \T \Q \C \c \f \S`-stacks, `%%c`/`%%d`/`%%p`, `\U+XXXX`.
- **Re-export** — `serializeDxfTextNode` round-trips `\P` cleanly (runs hold no raw codes → no
  double-escape). Closes the ADR-636 Φ2.3 limitation.

**Files:** `utils/dxf-text-converters.ts` (`convertMText` only — `convertText` unchanged),
`utils/__tests__/dxf-text-converters.test.ts` (new, 7 cases).

**Verification:** `dxf-text-converters.test.ts` 7/7 + parser/tokenizer/export-writer suites 146/146
green (round-trip `Line1\PLine2` ⇒ content `Line1\PLine2`, NOT `Line1\\PLine2`). jscpd clean.

**Known limitation (parser, not the converter — future phase).** The upstream parser flattens DXF
into `Record<string,string>`, so a long MTEXT split across multiple group-3 chunks (250-char
segments) keeps only the **last** chunk. Correct AutoCAD content = `concat(group-3…) + group-1`.
This needs an ordered-pairs content accumulator in `DxfEntityParser` (mirror `parseVerticesFromPairs`,
Φ1) — out of scope here. Simple `TEXT` `%%c`/`%%d`/`%%p`/`%%u`/`%%o` codes are likewise still verbatim
(`convertText` uses `buildTextNodeFromFlat`) — Roadmap Φ B/C.

## Φ B — Import entity coverage (types που το AutoCAD έχει & εμείς DROP-άραμε)

**Symptom.** Ο master router (`convertEntityToScene`) είχε `default: return null` → πολλά AutoCAD
entity types **σιωπηλά χάνονταν**. Δύο διαφορετικά σημεία αποκοπής: (α) `SOLID` ήταν στο
`SUPPORTED_ENTITY_TYPES` αλλά χωρίς converter → μετριόταν `skippedByType`· (β) POINT/3DFACE/TRACE/
MLINE/LEADER/ATTRIB **ούτε καν** στο `SUPPORTED_ENTITY_TYPES` → φιλτράρονταν στον `parseEntityAt`
πριν το EntityData → πλήρως αόρατα (χειρότερο από skipped).

**Batch 1 (DONE) — converters-only, renderers ήδη υπάρχουν:**
- **POINT** → `PointEntity` (`dxf-point-converter.ts`). ⚠️ ο `PointRenderer` είναι **no-op σήμερα**
  («NUCLEAR: POINT CIRCLE ELIMINATED») — import coverage + diagnostics OK, αλλά **δεν ζωγραφίζεται
  ορατά** μέχρι να ενεργοποιηθεί $PDMODE/$PDSIZE glyph rendering (Φάση C).
- **SOLID / 3DFACE / TRACE** → `HatchEntity(fillType:'solid')` (`dxf-quad-fill-converter.ts`,
  `HatchRenderer` ζωγραφίζει). Κοινός SSoT `parseQuadVertices` + 3 thin wrappers (jscpd-safe).
  ⚠️ **BOWTIE fix:** η σειρά ζωγραφίσματος quad είναι **1→2→4→3** (ΟΧΙ 1-2-3-4)· χωρίς swap → παπιγιόν.
  Triangle collapse όταν vertex4==vertex3. Z (3DFACE) → 2D projection μέσω `projectPointTo2D` SSoT.
- **MLINE** → reference `polyline` (`dxf-mline-converter.ts`, MVP). Vertices από **11/21** (ΟΧΙ 10/20 =
  duplicate start point)· `closed` = code **71 bit 2** (ΟΧΙ 70 bit 1 όπως LWPOLYLINE)· ordered `pairs`
  (το flat `data` θα κρατούσε μόνο το τελευταίο vertex). MLINESTYLE offsets (N παράλληλες) = follow-up
  (ζουν στο OBJECTS section μέσω handle 340). Ο router υποστηρίζει ήδη array-return.

Edits: `SUPPORTED_ENTITY_TYPES` (+3DFACE/TRACE/POINT/MLINE), `convertEntityToScene` switch (5 cases),
3 νέα SRP modules. Diagnostics **αυτόματα** → `parsedByType` (μηδέν αλλαγή στο diagnostics module).
Tests: `dxf-quad-fill-converter.test.ts` (8) + `dxf-point-converter.test.ts` (4) +
`dxf-mline-converter.test.ts` (5). Full `utils/__tests__` **295/295** green, jscpd clean.

**Batch 2 — Part A (ATTRIB/ATTDEF) DONE, Part B (LEADER) DONE:**
- ✅ **ATTRIB / ATTDEF** → `type:'text'` (DONE 2026-07-11): shared `convertAttributeEntity` στο
  `dxf-text-converters.ts` (reuse `parseTextTransform`/`buildTextNodeFromFlat`/`buildTextSceneEntity`).
  Code 1 = ορατό value· code 2 = tag (`TextEntity.attributeTag?`)· code 70 bit 1 = invisible→`visible:false`.
  ✅ **Guard** επιβεβαιωμένος: `instantiateInsert` block-member loop → `if (child.type === 'ATTDEF') continue;`
  (ο `child` είναι raw `EntityData`· η design-agent υπόθεση για `convertEntityToScene(child)` ήταν λάθος).
  Χωρίς guard κάθε INSERT θα stamp-άριζε το stale default value. 9 νέα tests (guard integration incl.).
- ✅ **LEADER** → `LeaderEntity` + **νέος `LeaderRenderer`** (DONE 2026-07-11): callout path (open
  polyline, tip=vertices[0]) + arrowhead στο tip **reuse DIMENSION arrowhead SSoT** (`renderArrowhead`/
  `getArrowheadBlock`, ADR-362 — ΟΧΙ χειροκίνητο τρίγωνο). `convertLeader(entityData)` vertices από ordered
  `pairs` (10/20), code 71=arrowhead flag (default on→closedFilled, 0→none), size=`DEFAULT_DIMSTYLE.dimasz`.
  Renderer mirrors `PolylineRenderer` line-for-line (`renderWithPhases`/`drawVerticesPath`/`shouldRenderLines`/
  `hitTestLineSegments` — όλα επιβεβαιωμένα με read). Registered `'leader'` στο `EntityRendererComposite`.
  ✅ **Κρίσιμη correctness:** προστέθηκε `case 'leader'` στο `scaleEntity` SSoT (`scaleLeader`) — έπεφτε στο
  `default: {}` → callout στα raw coords ενώ όλα τα άλλα scaled (misplacement σε μέτρα/cm). 8 νέα tests.

## Out of scope (roadmap)
- Full BYBLOCK color/linetype inheritance; text-angle rotation fidelity under INSERT.
- **Follow-up:** `convertSpline` has the same data-map vertex bug (`dxf-entity-converters.ts`);
  migrate to `parseVerticesFromPairs`. Bulge→arc tessellation (Φ1b) — bulge is captured but
  currently rendered as straight segments (21 curved vertices in the sample).

## Φ C.6 — R12 associative-hatch INSERT → single HATCH entity (ACAD/HATCH XDATA)

**Symptom (Giorgio, real file `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ.dxf`):** «οι γραμμοσκιάσεις εμφανίζονται σαν
μεμονωμένες γραμμές στον καμβά». Diagnosed against the sample: **AC1009 (R12)**, 26 MB, `$ACADVER=AC1009`.
R12 has **no HATCH entity** — a hatch is an anonymous block (`*X#`) of exploded pattern LINEs, INSERTed
into model space and tagged with XDATA `1001 ACAD / 1000 HATCH`. The file has **9 hatch INSERTs** whose
`*X#` blocks hold **156 860 LINEs** total. ADR-635 Φ2 `instantiateInsert` faithfully exploded them → the
canvas showed ~156k loose lines instead of 9 hatches.

**Big-player parity:** modern AutoCAD re-associates the boundary from the `R14_HATCH_DATA` XDATA cache and
shows a live HATCH — it does NOT leave the lines loose. So the enterprise+SSoT fix coincides with real-world
practice: reconstruct, don't explode.

**XDATA structure** (per hatch INSERT): `1001 ACAD / 1000 HATCH / 1002 { / 1070 <flags> / 1000 <patternName>
(e.g. GRASS) / 1040 <scale> / 1040 <angleDeg> / 1000 R14_HATCH_DATA / …matrix… / 1000 <patternName> /
…boundary paths… / 1071 0 / …pattern-line defs… / 1002 }`. The boundary uses **two** encodings, both handled:
- **edge list** — per edge `1070 1` + 4×`1040` (x1,y1,x2,y2); polygon = ordered edge start points (islands
  split on a geometric gap).
- **polyline** — `1071 <numVerts>` + `numVerts × (1040 x, 1040 y)`.
Collection is bounded by the `1071 0` boundary terminator, so the pattern-definition section (which reuses
`1070`/`1040`, incl. `1070 3` line-family counts) is never misread as edges. A curved edge (`1070` type
2/3/4 = arc/ellipse/spline) returns `null` → fall back to explosion (safe degradation, never wrong geometry).

**Implementation:**
1. **`dxf-hatch-xdata-converter.ts`** (new) — `tryConvertInsertHatch(insert, index)`: detects the ACAD/HATCH
   XDATA on the INSERT's ordered `pairs` (the parser already retains XDATA — all codes are `≠0` until the
   next entity, so no parser change was needed), reads pattern/scale/angle + boundary, returns one hatch entity.
2. **`dxf-hatch-converter.ts`** — extracted `buildHatchSceneEntity(params)` as the **shared assembly SSoT**
   (fillType resolution + catalog scale-idempotency + entity shape). `convertHatch` (native HATCH) now delegates
   to it — the two hatch importers can never drift (N.18: no sibling clone of the ~50-line assembly).
3. **`dxf-scene-builder.ts`** — INSERT gate: `tryConvertInsertHatch` FIRST; on a hit, emit the single hatch
   (`recordParsed('HATCH')`) and skip `instantiateInsert`; else fall through to normal block explosion.

**Result on the real file (via `buildScene`):** entity types `{hatch:9, polyline:2, line:3, circle:1}` = **15
total** (was **156 860+** loose lines). All 9 hatches reconstructed (both edge-list & polyline boundary
encodings), pattern names preserved (GRASS/HEX/SQUARE/NET/ANSI31), BYLAYER color, coordinates ride the
canonical-mm pass exactly like a native HATCH. Reuses the existing `hatch-pattern-catalog` (GRASS etc.) +
`HatchRenderer` — no new render path.

**Files:** `utils/dxf-hatch-xdata-converter.ts` (new), `utils/dxf-hatch-converter.ts` (extract shared builder),
`utils/dxf-scene-builder.ts` (INSERT gate), `utils/__tests__/dxf-hatch-xdata-converter.test.ts` (new, 6 unit +
1 buildScene integration).

**Verification:** `dxf-hatch-xdata-converter.test.ts` + hatch/gradient/block-expansion/renderer regression =
38/38 jest green; jscpd clean; real 26 MB R12 file end-to-end 156 860 lines → 9 hatches.

## Changelog
- **2026-07-11 — Φ C.6 (R12 associative-hatch INSERT → single HATCH via ACAD/HATCH XDATA):** R12/AC1009 has
  no HATCH entity — hatches are anonymous `*X#` blocks of exploded LINEs, INSERTed with `1001 ACAD / 1000 HATCH`
  XDATA (+ `R14_HATCH_DATA` boundary cache). New `dxf-hatch-xdata-converter.ts` (`tryConvertInsertHatch`)
  reconstructs ONE hatch entity/INSERT (both edge-list & polyline boundary encodings; curved edges → fall back);
  shared `buildHatchSceneEntity` SSoT extracted from `convertHatch` (no clone); scene-builder gates the INSERT.
  Real KADOS file: **156 860 lines → 9 hatches** (15 entities total). 7 new tests, 38 sibling jest green, jscpd clean.
- **2026-07-11 — Φ C.5 (FONT / TEXTSTYLE render parity: entity group 7 → STYLE table → fontFamily):**
  τα imported TEXT/MTEXT ζωγραφίζονταν με hardcoded `fontFamily: ''` (`buildTextNodeFromFlat`) — η
  drawing-specific γραμματοσειρά (π.χ. `romans.shx`) χανόταν και όλα render-άρονταν με το render-default
  (Liberation Sans). Το κενό ήταν **WIRING**, ΟΧΙ έλλειψη parser: το STYLE table parser
  (`parseStyleTable` + `styleEntryDefaults`) + η SHX→web substitution (`resolveEntityFont`/`lookupSubstitute`)
  **ΥΠΗΡΧΑΝ ΗΔΗ** (ADR-344/ADR-530) αλλά **κανείς δεν τα κατανάλωνε** στο import build flow.
  - **Νέος thin SSoT composer** (`text-engine/parser/style-table-reader.ts`): `buildStyleFontMap(content)`
    → `Record<styleName, fontFamily>` πάνω από τα υπάρχοντα `parseStyleTable` + `styleEntryDefaults`
    (**ΟΧΙ** δεύτερος parser). Αποθηκεύει το **stripped** font-file name (`romans`), **ΟΧΙ**
    pre-substituted web font: το render `resolveEntityFont` κάνει το substitution downstream — pre-substitute
    θα (α) double-substitute και (β) θα override-άρε λάθος ένα company-uploaded exact-match font (direct cache hit).
  - **STYLE pre-pass wired:** το `DxfSceneBuilder.buildSceneWithDiagnostics` χτίζει `styleFonts = buildStyleFontMap(content)`
    (δίπλα στο C.4 LTYPE pre-pass + DIMSTYLE/LAYER) και το threading **per-drawing** (mirror `dimStyles`, ΟΧΙ
    global store — δεν μολύνεται shared registry).
  - **Threading (5ος optional param):** `convertToSceneEntity` → `convertEntityToScene` → `routeEntityToConverter`
    → `convertText`/`convertMText`, + `ExpandContext.styleFonts` για block-nested text. Νέος τύπος `StyleFontMap`
    (`dxf-parser-types.ts`, mirror `DimStyleMap`).
  - **Converters:** νέος gated helper `resolveStyleFont(data, styleFonts)` — group 7 → map → fontFamily,
    αλλιώς `''`. `buildTextNodeFromFlat` πήρε `fontFamily=''` param (τελευταίο) → `run.style.fontFamily`.
    `convertMText` seed-άρει το `parseMtext(..., { height, fontFamily })` (inline `\f`/`\F` overrides ΑΚΟΜΑ
    κερδίζουν, AutoCAD parity). **Gate:** χωρίς group 7 / unknown style → `''` (TEXT) ή το parser default
    `'Standard'` (MTEXT) → native/Tekton/bare text αμετάβλητο, zero regression.
  - **Big-player (AutoCAD):** group 7 = text style name → STYLE entry → fontFile· «Standard» = default·
    missing SHX → substitute (mirror του δικού μας `lookupSubstitute`).
  - **Backlog:** ATTRIB/ATTDEF font (ίδιο `buildTextNodeFromFlat` path· default `''` σήμερα = αμετάβλητο)·
    substitution precision για stripped names (`txt`→Mono / `gothicg`→Unifraktur χάνονται στο catch-all —
    property του `styleEntryDefaults`/`lookupSubstitute` keying, ΟΧΙ του C.5). **C.6 HATCH / C.7 MLINESTYLE** = backlog.
  - **Files:** `style-table-reader.ts`+`parser/index.ts` (`buildStyleFontMap`), `dxf-parser-types.ts`
    (`StyleFontMap`), `dxf-entity-parser.ts` (re-export + 5ος param), `dxf-entity-converters.ts` (threading),
    `dxf-text-converters.ts` (`resolveStyleFont` + fontFamily param + convertText/MText), `dxf-scene-builder.ts`
    (STYLE pre-pass), `dxf-block-expander.ts` (`ExpandContext.styleFonts`). **11 νέα tests**
    (`dxf-entity-font.test.ts`: buildStyleFontMap strip/empty/no-table + convertText known/absent/unknown/no-map
    + convertMText seed/default/unknown + builder end-to-end), **378/378** utils+scale green + **396/396**
    text-engine green, jscpd clean. ΔΕΝ browser-verified (χρειάζεται canvas)· η import→map→resolve→run-style
    λογική = tested (+ τα υπάρχοντα `resolveEntityFont`/glyph render tests).
- **2026-07-11 — Φ C.4 (LINETYPE render parity: entity group 6 + CELTSCALE 48 + $LTSCALE + LTYPE pre-pass):**
  οι entity converters διάβαζαν χρώμα/πάχος αλλά **ΟΧΙ** το `data['6']` (linetype) / `data['48']` (CELTSCALE)
  → το per-entity linetype override χανόταν (dashed/dotted γραμμές render-άρονταν solid). Επιπλέον το
  `parseLinetypeTable` (LTYPE table parser) **δεν καλούνταν πουθενά στο import build flow** (μόνο σε
  tests/writer) → τα custom `.lin` linetypes δεν register-άρονταν → fallback σε solid.
  - **Νέοι SSoT helpers** (`utils/dxf-converter-helpers.ts`, δίπλα στο `extractEntityLineweight`,
    mirror του C.3/C.2): `extractEntityLinetype(data)` — group 6, bake **concrete name** (incl. `Continuous`,
    που είναι ΠΡΑΓΜΑΤΙΚΟ linetype, όχι sentinel → overrides dashed layer)· τα `BYLAYER`/`BYBLOCK` (case-
    insensitive) + absent → `undefined` ώστε το render cascade να λύσει από το layer (implicit ByLayer).
    `extractEntityLtscale(data)` — group 48, finite **positive** μόνο· absent/invalid/trivial-1 → `undefined`.
    **Κανένας νέος resolver** — το name→pattern resolution μένει στο render SSoT `resolveLinetypePatternMm`
    (`resolveAnyLinetype` catalog ∪ `resolveLinetype` registry, case-insensitive DXF names).
  - **Κεντρική εφαρμογή στο router:** το `applyImportedLineweight` **γενικεύτηκε σε `applyImportedStyleFields`**
    (`convertEntityToScene`) που βάζει lineweight (370) + linetypeName (6) + ltscale (48) σε **ΕΝΑ** gated
    post-pass → καλύπτει top-level **ΚΑΙ** block-expanded, χωρίς copy-paste (N.0.2). Gate: χωρίς 6/48/370 →
    entity αμετάβλητο.
  - **Render forward:** το `linetypeName` ρέει ήδη `buildBase` (`dxf-scene-entity-converter.ts` γρ ~89).
    Προστέθηκε **forward του `ltscale`** (γρ ~90, mirror lineweightMm, gated `!== 1`) → `DxfEntityUnion` →
    `dxf-renderer-entity-model.ts` (ήδη διάβαζε `entity.ltscale`) → `dashMmToScreenPx(…, celtscale)` /
    DxfRenderer batch key. Το mm→px + LTSCALE×CELTSCALE×zoom stacking **ΗΤΑΝ ΗΔΗ DONE** (ADR-510 Φ2).
  - **LTYPE pre-pass wired:** το `DxfSceneBuilder.buildSceneWithDiagnostics` καλεί πλέον `parseLinetypeTable`
    → `registerLinetypes` **ΠΡΙΝ** τη μετατροπή entities, ώστε custom entity linetype names (group 6) να
    resolve-άρουν αντί για solid. Idempotent (registry dedupes by name)· **server-safe** (origin `dxf-import`
    ⇒ κανένα localStorage write).
  - **Απόφαση big-player — `$LTSCALE` (header group 40): parse-only, ΔΕΝ εφαρμόζεται.** Προστέθηκε
    `DxfHeaderData.ltscale?` + parse στο `parseHeader` (finite positive μόνο) για fidelity/round-trip
    (ADR-636). ΔΕΝ γράφεται ούτε στο global `LinetypeScaleStore` (θα μόλυνε το persisted user preference όλων
    των σχεδίων — ίδια απόφαση με το C.3 `$LWDISPLAY`) ούτε baked per-entity. **Λόγος:** το render
    **αντικαθιστά** το dash pattern από το σταθερό-mm ISO catalog (`resolveLinetypePatternMm` by name), ΟΧΙ
    από τα source `.lin` μήκη· το source `$LTSCALE` είναι multiplier βαθμονομημένος στα source units + source
    `.lin`, **ασύμβατος** με το canonical-mm normalized space → εφαρμογή του θα αλλοίωνε το dash sizing (π.χ.
    metre-drawing LTSCALE=1000 → 12700mm dashes). Το `LinetypeScaleStore` μένει το **manual knob του χρήστη**.
    Το **CELTSCALE (48)** αντίθετα είναι pure unitless per-object ratio → εφαρμόζεται καθαρά.
  - **BYBLOCK linetype σε INSERT** = follow-up (mirror του C.2 color BYBLOCK). **C.5 FONT / C.6 HATCH /
    C.7 MLINESTYLE** = backlog.
  - **Files:** `dxf-converter-helpers.ts` (2 helpers), `dxf-entity-converters.ts` (post-pass rename+extend),
    `dxf-parser-types.ts` (`ltscale?`), `dxf-entity-parser.ts` (`$LTSCALE` parse), `dxf-scene-builder.ts`
    (LTYPE pre-pass), `dxf-scene-entity-converter.ts` (ltscale forward). 17 νέα tests
    (`dxf-entity-linetype.test.ts`: helpers name/sentinel/Continuous/absent + ltscale + router LINE/CIRCLE/
    coexist-με-370/gate + `$LTSCALE` parse + builder LTYPE-pre-pass integration), **364/364** utils+scale+
    entity-model-line green, jscpd clean. ΔΕΝ browser-verified (χρειάζεται canvas)· η import/parse/register/
    forward λογική = tested (+ τα υπάρχοντα ADR-510 render tests).
- **2026-07-11 — Φ C.3 (LINEWEIGHT import: per-entity group 370):** οι entity converters
  διάβαζαν `extractEntityColor` αλλά **ΟΧΙ** το `data['370']` → το per-entity πάχος χανόταν στο import.
  Νέο SSoT helper `extractEntityLineweight(data)` (`utils/dxf-converter-helpers.ts`, mirror του
  `extractEntityColor`): reuse του υπάρχοντος `parseDxfCode370` (`config/lineweight-iso-catalog.ts` —
  **ΟΧΙ** νέος decoder), bake **μόνο concrete mm**· τα sentinels -1/-2/-3 (ByBlock/ByLayer/Default) +
  out-of-catalog + absent → `undefined` ώστε το render cascade (`resolveEntityStyle`) να τα λύσει από το
  layer (implicit ByLayer, όπως το AutoCAD). Η εφαρμογή γίνεται **κεντρικά** στο router
  `convertEntityToScene` (νέο `applyImportedLineweight` post-pass + rename του switch σε
  `routeEntityToConverter`) → καλύπτει top-level **ΚΑΙ** block-expanded entities (τα children περνούν κι
  αυτά από το router) με **ΕΝΑ** σημείο, χωρίς copy-paste στους ~10 converters (N.0.2). Το `lineweightMm`
  ρέει `buildBase` (`dxf-scene-entity-converter.ts` γρ ~90) → `DxfEntityUnion` → resolver.
  **Render/gate/mm→px ΗΤΑΝ ΗΔΗ DONE (ADR-510 Φ2G):** `LineweightDisplayStore` (global LWDISPLAY toggle,
  default TRUE κατ' απόφαση Giorgio), `dxf-renderer-style-resolve.ts` `lineweightToPx`+`gatePx` (1px hairline
  όταν off, print πάντα on). **Απόφαση:** το imported header `$LWDISPLAY` **ΔΕΝ** wire-άρεται στο global
  store — είναι σκόπιμα user/session preference· ένα file-import που αλλάζει το global display setting όλων
  των σχεδίων δεν είναι σωστό για αυτή τη single-toggle αρχιτεκτονική. Gate: χωρίς 370 → **τίποτα δεν αλλάζει**
  (native/Tekton/bare paths αμετάβλητα). BYBLOCK lineweight σε INSERT = follow-up (mirror του C.2 pattern).
  9 νέα tests (`dxf-entity-lineweight.test.ts`: helper concrete/sentinel/absent/out-of-catalog + router
  integration LINE/CIRCLE/null-gate), **343/343** utils+scale green, jscpd clean. ΔΕΝ browser-verified
  (χρειάζεται canvas)· η import/parse/gate λογική = tested (+ το υπάρχον Φ2G render test).
- **2026-07-11 — Φ C.2 (COLOR cascade: true-color 420 + BYBLOCK inheritance):** ο `extractEntityColor`
  (`utils/dxf-converter-helpers.ts`) διάβαζε **μόνο** ACI code 62 → κάθε RGB-exported DXF (AutoCAD/Revit)
  έχανε το χρώμα. Τώρα: **group code 420** (24-bit `0x00RRGGBB`) διαβάζεται με **προτεραιότητα πάνω από
  62** (AutoCAD κανόνας), reuse του υπάρχοντος SSoT `trueColorToHex` (`utils/dxf-true-color.ts`, ADR-507 Φ5
  — ΟΧΙ νέος helper· method-byte prefix masked με `& 0xffffff`). Νέο companion `isByBlockColor(data)` (62===0,
  420 overrides) ώστε το BYBLOCK να διακρίνεται από ByLayer/no-color (και τα τρία collapse σε `undefined`
  στον resolver). **BYBLOCK inheritance** στο `dxf-block-expander.ts` `instantiateInsert`: child με color
  BYBLOCK κληρονομεί το explicit χρώμα του INSERT (mirror του υπάρχοντος BYBLOCK layer '0' rule, γρ ~104-106)·
  όταν ο INSERT είναι BYLAYER/undefined το child πέφτει σωστά στο layer resolution μέσω του inherited
  `layerId`. Gate: μη-BYBLOCK/native/Tekton paths αμετάβλητα (explicit color πάντα κερδίζει). 13 νέα tests
  (`dxf-entity-color.test.ts` 10 + block-expansion BYBLOCK integration 3), **334/334** utils+scale green,
  jscpd clean. ΔΕΝ browser-verified (χρειάζεται canvas)· η resolve/precedence/inherit λογική = tested.
- **2026-07-11 — Φ C (POINT glyph render + scale):** το POINT σταματά να είναι no-op — νέο SSoT
  `rendering/entities/shared/point-glyph.ts` (pure `$PDMODE`/`$PDSIZE` decode: figure dot/plus/cross/tick
  + circle/square enclosures + size math· fully unit-tested), stamping στο `PointRenderer` (mirror του
  arrowhead decode/stamp split). `scaleEntity` `case 'point'` + converter/parser coverage. Σχετίζεται
  με τα stair rest-landing edits (ADR-637) που ταξιδεύουν στο ίδιο batch.
- **2026-07-11 — LEADER renderer file landed:** το `rendering/entities/LeaderRenderer.ts` +
  `EntityRendererComposite` registration + `scaleEntity` `case 'leader'` committed (η υλοποίηση που
  περιγράφεται στην από κάτω εγγραφή Part B· render/scale coverage πλέον στο repo, CHECK 6D gate).
- **2026-07-11 — Φ B Batch 2 Part B (LEADER import + render):** LEADER → `LeaderEntity` (νέος
  `dxf-leader-converter.ts`: ordered `pairs` vertices, tip=vertices[0], code 71 arrowhead flag,
  size=DIMASZ) + **νέος `LeaderRenderer`** (mirror `PolylineRenderer`· arrowhead **reuse ADR-362 SSoT**
  `renderArrowhead`/`getArrowheadBlock`, unitPx=screen-length του size world-units — ΟΧΙ bespoke τρίγωνο)
  registered `'leader'` στο `EntityRendererComposite`. `SUPPORTED_ENTITY_TYPES` +LEADER· router +1 case.
  **Correctness fix:** `scaleEntity` απέκτησε `case 'leader'` (`scaleLeader`: vertices ως polyline +
  arrowHead.size/hookLineLength ως scalar |sx|) — πριν έπεφτε στο `default:{}` → misplaced callout σε
  non-mm σχέδια. 8 νέα tests (converter 5 + scale 3), **316/316** utils+scale green,
  jscpd clean. Export (emitLeader) = Φάση D.
- **2026-07-11 — Φ B Batch 2 Part A (ATTRIB/ATTDEF import):** ATTRIB (block attribute value) + ATTDEF
  (definition template default) → `type:'text'` μέσω shared `convertAttributeEntity` (extend, όχι νέο
  sibling — reuse των υπαρχόντων `parseTextTransform`/`buildTextNodeFromFlat`/`buildTextSceneEntity`).
  Code 1=value(ορατό), 2=tag→`TextEntity.attributeTag?`, 70 bit 1→`visible:false`, 72=H-just, 40/50=height/rot.
  `SUPPORTED_ENTITY_TYPES` +ATTRIB/ATTDEF· router +2 switch cases. **Κρίσιμος guard** στο `instantiateInsert`
  (`child.type==='ATTDEF' → continue`): ATTDEF μέσα σε BLOCK είναι template, αντικαθίσταται από το ATTRIB
  του INSERT — χωρίς guard κάθε INSERT stamp-άρει το stale default. 9 νέα tests (converter + guard
  integration via `DxfSceneBuilder.buildScene`), **304/304** utils green, jscpd clean. Part B (LEADER +
  νέος `LeaderRenderer`) PENDING με έτοιμα specs.
- **2026-07-11 — Φ B Batch 1 (import entity coverage, converters-only):** POINT→PointEntity,
  SOLID/3DFACE/TRACE→HatchEntity(solid, bowtie-corrected 1→2→4→3 + triangle collapse + 2D projection),
  MLINE→reference polyline (11/21 vertices, closed=71 bit 2). 3 νέα SRP modules
  (`dxf-quad-fill-converter`/`dxf-point-converter`/`dxf-mline-converter`) + `SUPPORTED_ENTITY_TYPES`
  entries + 5 switch cases. Diagnostics auto→parsedByType. 17 νέα tests, 295/295 utils green, jscpd clean.
  ⚠️ PointRenderer no-op (Φάση C). Batch 2 (ATTRIB/ATTDEF + LEADER+renderer) PENDING με έτοιμα specs.
- **2026-07-11 — Φ4 (rich MTEXT import):** `convertMText` feeds the ADR-344 parser SSoT
  (`tokenizeMtext` → `parseMtext`) so raw inline codes become a real multi-paragraph/run AST
  instead of one flat run. Flat `.text` = `extractFlatText` (plain, `\P`→`\n`). Fixes verbatim-code
  display + line-break-less view AND the ADR-636 Φ2.3 double-escape (`\P`→`\\P`) on re-export.
  `convertText` unchanged. New `dxf-text-converters.test.ts` (7). 146 sibling jest green, jscpd clean.
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
- **2026-07-11 — Φ3 (fault-tolerant import + diagnostics):** fixes the generic `/api/floorplans/process`
  500. Per-entity try/catch (import never aborts on one bad entity); `lineAt()` boundary guard SSoT
  (no more `lines[i+1].trim()` TypeError on truncated files); bounded INSERT/MINSERT expansion
  (`MAX_ARRAY_CELLS=10 000`, scene budget `500 000`) with recorded clamps (no silent caps);
  `ImportDiagnostics` SSoT (`dxf-import-diagnostics.ts`) surfaced as Revit-style `warnings[]` on both the
  server response and `DxfImportResult`; single `runDxfParse()` SSoT replaces the worker/client wrap twin;
  API client now preserves+logs the server `details`. New `dxf-import-robustness.test.ts` (5 cases). jscpd clean.
- **2026-07-11 — Φ3 (UI toast):** the import `warnings[]` now surface as a Revit-style toast. New
  `useDxfImportNotifications` domain hook (SSoT) + `NOTIFICATION_KEYS.dxfImport.importedWithWarnings`
  (`dxf-viewer:import.warnings.summary`, ICU plural, el+en). Wired into BOTH import paths:
  server auto-process (`useFloorplanAutoProcess`) and client import (`useDxfImport`). Localized title +
  verbatim technical detail lines (same raw-detail pattern as `useFilesNotifications`). jscpd clean.
