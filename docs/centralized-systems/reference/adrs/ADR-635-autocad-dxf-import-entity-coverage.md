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

## Φ3.1 — parser-level skipped-warning (genuinely-unsupported entity TYPES)

**Gap.** Φ3 point #4 (silent drops) only covered *recognized-but-unconvertible* types — a type IN
`SUPPORTED_ENTITY_TYPES` that `convertToSceneEntity` returns `null` for (e.g. `SOLID`). Those are
recorded in the scene-builder converter loop (`recordSkipped`). But a **genuinely-unsupported TYPE**
(`REGION` / `3DSOLID` / `MESH` / `WIPEOUT` / `ACAD_TABLE` / …) is dropped one layer earlier — in
`DxfEntityParser.parseEntityAt`, which returns `{ entity: null }` and never adds it to `parsedEntities`.
It therefore never reached the converter loop → **still a silent data loss with no warning** after Φ3.

**Fix (reuse, no new system).** Thread the SAME `ImportDiagnostics` collector into the parser:
- `parseEntities(lines, range?, diagnostics?)` and `parseEntityAt(lines, i, diagnostics?)` gain an
  **optional** collector (no-op when absent → the raw parser API stays backward-compatible, mirroring
  the `dxf-block-expander` optional-collector pattern).
- `parseBlockDefinitions(lines, diagnostics?)` threads it too, so an unsupported member inside a BLOCK
  definition (lost from *every* INSERT of that block) is recorded as well.
- Before the silent `return`, `noteUnsupportedType()` calls `recordSkipped` **only** for a real entity
  type — `DXF_SECTION_MARKERS` (ENDSEC/BLOCK/…) and a new `DXF_STRUCTURAL_SUBMARKERS` (`VERTEX`/`SEQEND`,
  consumed by the compound parsers) are filtered out so a leaked terminator never fabricates a warning.
- `dxf-scene-builder` passes its existing `diagnostics` object to both parse calls → the counts flow
  through the SAME `summarizeDiagnostics()` → `runDxfParse().warnings` → `importedWithWarnings` toast.
  **Zero new UI/notification/collector** — pure wire.

**Tests:** `dxf-import-robustness.test.ts` +4 cases (REGION/3DSOLID counted, unsupported member inside a
BLOCK counted, SEQEND/ENDSEC NOT warned, no-collector back-compat). jscpd clean.

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
`utils/__tests__/dxf-text-converters.test.ts` (7 cases, serializer-level), and — **2026-07-12
end-to-end verify** — `export/core/__tests__/dxf-roundtrip-mtext.test.ts` (3 cases: write→`emitMText`→
re-import through the PRODUCTION `writeDxfAscii` writer, `\P` clean / inline `\H` no double-escape /
attachment+rotation preserved). The stale ADR-636 Φ2.3 "known limitation" note was replaced with a
RESOLVED pointer (same commit).

**Verification:** `dxf-text-converters.test.ts` 7/7 + `dxf-roundtrip-mtext.test.ts` 3/3 +
parser/tokenizer/export-writer suites green (round-trip `Line1\PLine2` ⇒ content `Line1\PLine2`, NOT
`Line1\\PLine2`, through the real writer). jscpd clean.

**Residual (pre-existing, NOT the double-escape — out of scope, verified 2026-07-12).** An *imported*
MTEXT is flattened to a `type:'text'` scene entity (`buildTextSceneEntity` sets `type:'text'` for every
text kind). On re-export it therefore takes the single-line `emitText` path, whose `sanitizeText`
collapses the flat `.text` `\n` breaks to spaces → paragraph structure is lost. This is unchanged by Φ4
(pre-Φ4 the raw-`\P` `.text` likewise failed to round-trip: `convertText` never parsed `\P`). The proper
MTEXT round-trip — the `emitMText`/`serializeDxfTextNode` path where the double-escape lived — is clean.
Preserving MTEXT identity on import (keeping `type:'mtext'`) is a cross-cutting entity-type change across
render/hit-test/snap consumers → deferred, needs its own ADR phase.

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

## Φ C.8 — Imported per-entity entities first-save on DXF import (hatch persistence drop)

**Symptom (Giorgio, real file `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ-AUTOCAD.dxf`):** μετά από φρέσκια εισαγωγή ο όροφος
δείχνει **μόνο 6 στοιχεία** (2 polyline + 3 line + 1 circle = τα dumb-DXF) και **οι 9 γραμμοσκιάσεις
εξαφανίζονται** (και ήδη στο load, και μετά από reload). Ο parser (Φ C.6) δίνει σωστά **9 hatches** — το
πρόβλημα ήταν **downstream, στο persistence**.

**Root cause (100% επιβεβαιωμένο):** ο `hatch` είναι **per-entity-persisted** (collection
`floorplan_hatches`, SSoT· `isPerEntityPersistedEntity` = `isBimEntity || isStairEntity || isHatchEntity`).
Στο load, το `systems/levels/scene-bim-load-policy.ts → reconcileLoadedSceneBim` πετά το scene-blob copy
κάθε per-entity entity ως **παράγωγο cache** και το ξαναγεμίζει ΜΟΝΟ από τα per-entity Firestore docs. Το
first-save σκανδαλίζεται event-driven από `drawing:entity-created {tool}`. Το **.tek import** το εξέπεμπε
ήδη (Φ5b.6, ADR-531)· το **DXF import** (`hooks/scene/useSceneState.ts`) **δεν εξέπεμπε τίποτα** μετά το
`setLevelScene` → κανένα `floorplan_hatches` doc → το `reconcileLoadedSceneBim` έριχνε τους snapshot hatches
χωρίς docs να τους ξαναγεμίσουν → **εξαφάνιση**. (Τα 6 dumb-DXF έμεναν γιατί ΔΕΝ είναι per-entity-persisted.)

**Fix (SSoT, mirror του proven .tek pattern — ΟΧΙ νέο persistence path):**
1. **`systems/levels/emit-imported-entity-create-events.ts`** (new) — `emitImportedEntityCreateEvents(entities)`:
   για κάθε `isPerEntityPersistedEntity(e)` εκπέμπει `drawing:entity-created { entity, tool: e.type }`. Το
   `tool: e.type` είναι καθολικά σωστό: ο default createTrigger του `createBimEntityPersistenceHook` (ADR-594)
   είναι `{ tool: entityType }` με `entityType === entity.type`, και ο hatch έχει explicit extraCreateTrigger
   `{ tool: 'hatch' }` (ADR-507). Iteration = scene order → host-first ordering (τοίχος ΠΡΙΝ κούφωμα).
2. **`hooks/scene/useSceneState.ts`** — ο inline if/else `for`-loop του .tek branch (stair/wall/opening/slab/
   column/hatch) **αντικαταστάθηκε** από κλήση του κοινού emitter (N.18 — μία υλοποίηση, όχι δύο δίδυμα), και
   ο **DXF branch** καλεί ΤΩΡΑ τον ίδιο emitter μετά το `setLevelScene`. Ένας δρόμος, δύο consumers.

**ΔΕΝ άλλαξε** το `reconcileLoadedSceneBim` — είναι σωστό (dual-persistence SSoT policy, ADR-390 Φ4). Ο emitter
είναι idempotent στο DB (setDoc + σταθερό entity id).

**Files:** `systems/levels/emit-imported-entity-create-events.ts` (new), `hooks/scene/useSceneState.ts` (both
import branches → shared emitter), `systems/levels/__tests__/emit-imported-entity-create-events.test.ts` (new,
5 unit). **Verification:** 5/5 jest green (hatch tool 'hatch'· BIM+stair tool===type· pure-DXF ignored· scene
order preserved· empty no-op); jscpd clean. Browser (Giorgio): φρέσκια εισαγωγή σε ΝΕΟ όροφο → 9 γραμμοσκιάσεις
που **παραμένουν μετά από reload**.

## Φ C.9 — Imported hatch INVISIBLE: viewport-culling missing `case 'hatch'` (geo-referenced drop)

**Symptom (Giorgio, real file `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ-AUTOCAD.dxf`):** μετά το Φ C.8 (persistence fix) το panel
δείχνει σωστά **«15 στοιχεία»** (2 polyline + 3 line + 1 circle + **9 hatches**), αλλά **οι 9 γραμμοσκιάσεις
παραμένουν ΑΟΡΑΤΕΣ** — φαίνονται μόνο τα 6 dumb-DXF. Επιβιώνουν (Φ C.8) αλλά δεν ζωγραφίζονται.

**Root cause (100% επιβεβαιωμένο, ΟΧΙ parser/persistence):** το SSoT viewport-culling module
`canvas-v2/dxf-canvas/dxf-viewport-culling.ts → getEntityBBox()` **δεν είχε `case 'hatch'`**. Ο hatch κρατά τη
γεωμετρία του στο `boundaryPaths` (array of rings of `{x,y}`), **ΟΧΙ** σε `geometry.bbox` → έπεφτε στο
`default → geometryBBoxOrFullPlane()` → conservative **`FULL_PLANE_BBOX = ±1e6`**. ΑΛΛΑ το αρχείο είναι
**geo-referenced**: hatch coords **~2.8e6 mm** (2847 m από την origin). `2.8e6 > 1e6` → το `±1e6` box **δεν
τέμνει** το world-viewport → `isEntityInViewport() === false` → **culled → ποτέ δεν ζωγραφίζεται.** Ίδιο class
bug με τα dimension/opening/wall geo-referenced culling fixes (2026-07-03). Οι **σχεδιασμένοι** hatches φαίνονται
μια χαρά γιατί είναι κοντά στην origin (coords < 1e6, εντός του ±1e6 fallback) — γι' αυτό ήταν κρυμμένο.

**Fix (SSoT, 1 case, mirror του `case 'polyline'` — ΟΧΙ νέος bbox helper):** νέο `case 'hatch'` πριν το
`default` που υπολογίζει AABB flatten-άροντας όλα τα `boundaryPaths` rings (mirror του polyline vertex-scan)·
degenerate hatch χωρίς κορυφές → conservative `FULL_PLANE_BBOX` (ασφαλές — δεν κρύβεται κατά λάθος).

**ΔΕΝ άλλαξε** parser / persistence (Φ C.8) — σωστά. Ορθογώνιο με το Φ C.8: το ένα = «επιβιώνουν», αυτό =
«ζωγραφίζονται» — χρειάζονται **και τα δύο**.

**Sibling gap (flagged, secondary):** το spatial-index picking bounds SSoT `types/entity-bounds.ts` **επίσης
δεν έχει hatch case** → σε geo-referenced DXF ο imported hatch μπορεί να μην επιλέγεται με κλικ. ΔΕΝ
επιβεβαιώθηκε με ground truth (ο render-blocker ήταν το culling)· επόμενο case αν αναφερθεί.

**Files:** `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` (νέο `case 'hatch'`),
`canvas-v2/dxf-canvas/__tests__/dxf-viewport-culling.test.ts` (+4 unit: real-bbox· multi-ring flatten·
geo-referenced NOT culled· degenerate fallback). **Verification:** 18/18 jest green (4 νέα hatch). Browser
(Giorgio): re-import `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ-AUTOCAD.dxf` → 9 γραμμοσκιάσεις ορατές στη θέση τους + μετά reload.

## Φ C.10 — Imported hatch PATTERN wrong: catalog GRASS approximate + SQUARE/HEX missing

**Symptom (Giorgio, real file `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ-AUTOCAD.dxf`):** μετά τα Φ C.8/C.9 οι γραμμοσκιάσεις
εμφανίζονται/επιλέγονται/fit-άρουν σωστά, ΑΛΛΑ το **σχέδιο** του μοτίβου διαφέρει από την AutoCAD — στην
AutoCAD τακτοποιημένα «βελάκια» (GRASS), στον Νέστορα **άναρχες γραμμές**.

**Root cause (100% επιβεβαιωμένο στον κώδικα):** ο imported hatch με predefined patternName ξαναφτιάχνεται
από τον **catalog** του Νέστορα (`hatch-pattern-geometry.ts:349` → `getHatchPattern(patternName)`), ΟΧΙ από
τη γεωμετρία του DXF — σωστά (AutoCAD-parity: η ίδια η AutoCAD είναι name-based μέσω `acad.pat`). **Αλλά τα
δεδομένα του catalog ήταν λάθος/ελλιπή** για τα patterns αυτού του αρχείου:
- **GRASS**: προσεγγιστικός ορισμός με **λάθος γωνίες 60/120** (αντί 45/135) + λάθος delta/dashes → οι τρεις
  οικογένειες δεν κουμπώνουν σε «βελάκι» → άναρχες γραμμές. (Ο catalog το παραδεχόταν: «refinable approximation».)
- **SQUARE / HEX**: **ΔΕΝ υπήρχαν καθόλου** στον catalog → `getHatchPattern` = undefined → catalog MISS →
  `buildHatchEntitySegments` = `[]` → **κανένα** pattern (μόνο outline).
- **NET / ANSI31**: ήδη ακριβή acad.pat conversions → σωστά (no change).

**Fix (SSoT δεδομένων, ΟΧΙ νέος μηχανισμός):** ο renderer (`buildPredefinedHatchLines`) κάνει ήδη πιστό PAT
tiling (angle/origin/delta/dashes) — διορθώθηκαν **μόνο τα δεδομένα** στον `hatch-pattern-catalog.ts` (SSoT):
1. **GRASS** → ακριβές acad.pat (`90: .707,1 / 45,135: 0,2`, dashes `.1875,-1.8125`, × INCH).
2. **SQUARE** (νέο) → `0/90, 0,.25, .25,-.25` × INCH.
3. **HEX** (νέο) → `0/120/60, 0,.2165, .125,-.125,.125,-.125` × INCH (⚠️ visual-verify — σύνθετο).
4. `SUGGESTED_SCALES` SQUARE=5/HEX=6 (density-normalization invariant ≥30 mm) + i18n keys `square`/`hex` (el+en).

Επειδή canvas **και** DXF-export τραβάνε από το ΙΔΙΟ `buildPredefinedHatchLines`, η διόρθωση φτιάχνει και τα δύο.

**⚠️ Απαιτεί ΦΡΕΣΚΙΑ επανεισαγωγή:** η import idempotency αποθηκεύει `patternScale = fileScale/suggested`, οπότε
`effective = fileScale` μόνο σε νέο import. Τα ήδη-αποθηκευμένα SQUARE/HEX docs (patternScale από παλιό catalog
MISS = raw file-effective) θα φαίνονταν αραιά σε σκέτο reload — re-import τα κανονικοποιεί.

**Files:** `data/hatch-pattern-catalog.ts` (GRASS fix + SQUARE/HEX add + suggested scales),
`data/__tests__/hatch-pattern-catalog.test.ts` (+4 acad.pat parity), `i18n/locales/{el,en}/dxf-viewer-shell.json`
(square/hex labels). **Verification:** 15/15 catalog jest + 27/27 pattern-geometry/thumbnail green· jscpd clean.
Browser (Giorgio): re-import → GRASS «βελάκια» + SQUARE τετράγωνα + HEX εξάγωνα όπως AutoCAD.

## Φ C.11 — Imported hatch στο ΛΑΘΟΣ σημείο: R12 hatch-INSERT boundary χωρίς block transform (2.8εκ. offset)

**Symptom (Giorgio, real file `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ.dxf`):** μετά τα Φ C.8/C.9/C.10 οι γραμμοσκιάσεις ΔΕΝ
εμφανίζονται καθόλου, και το **HOME/Shift+1** εξαφανίζει ΟΛΟ το σχέδιο (γίνεται κουκκίδα).

**Root cause (100% επιβεβαιωμένο από το persisted `.scene.json` + αριθμητική):** στο geo-referenced αρχείο τα
**κανονικά** entities είναι στα **0–70.537** (τοπικά, μετά το INSERT explosion), αλλά τα **9 hatches** στα
**~2.800.000** (raw). Το `tryConvertInsertHatch` (Φ C.6) διαβάζει το boundary από το **R14_HATCH_DATA XDATA
cache**, το οποίο είναι στο **LOCAL** χώρο του `*X#` block (relative στο block base), ΚΑΙ **δεν εφάρμοζε το
INSERT block transform** που εφαρμόζει το `instantiateInsert` → `transformBlockEntity` στα exploded members
(`p_world = insertPoint + Rot·Scale·(p_block − base)`). Έτσι το hatch έμενε στα raw block-local coords ενώ οι
siblings του πήγαιναν στο τοπικό origin. **Απόδειξη:** `hatch_insert_4` κορυφή `(2877631, 2136219)` − blockBase
`(2847223, 2135831)` = `(30408, 388)` = ακριβώς το τέλος του co-layer `line_2` → κουμπώνει τέλεια.

**Δύο συμπτώματα, μία ρίζα:** (α) **αόρατα** — τα hatches 2.8εκ. μονάδες μακριά → εκτός viewport· (β) **HOME
over-zoom** — το zoom-extents (`createBoundsFromDxfScene`, forceRecalculate) ενώνει local(0–70k) ∪ hatch(2.8εκ.)
→ bounds 0–2.9εκ. → over-zoom → κουκκίδα. (Η αρχική υπόθεση «colorLayers/furniture pollution» ήταν λάθος.)

**Fix (big-player, FULL SSoT — μηδέν νέα geometry math):** το hatch import path εφαρμόζει πλέον το **ΙΔΙΟ**
INSERT block transform με το block explosion. Εξήχθη το geometric core `applyBlockTransformGeometry`
(scale→rotate→translate γύρω από `base`, τα ήδη-υπάρχοντα per-entity SSoTs `scaleEntity`/`rotateEntity`/
`translateEntityByAnchor` — καθένα καλύπτει `hatch.boundaryPaths`) από το `transformBlockEntity`, και νέο export
`transformInsertHatch(hatch, insert, blockDefs)` το εφαρμόζει με το block base + INSERT insertion/scale/rotation.
Το placed hatch είναι **byte-identical** με το πού θα προσγειώνονταν οι exploded pattern lines (preview ≡ commit).
Fixes **ΚΑΙ ΤΑ ΔΥΟ** συμπτώματα ταυτόχρονα (σωστές coords → ορατό + σωστό zoom-extents).

**⚠️ Απαιτεί ΦΡΕΣΚΙΑ επανεισαγωγή:** τα ήδη-αποθηκευμένα hatch docs (`floorplan_hatches`) έχουν persisted τις
λάθος 2.8εκ. coords· re-import τα ξαναγράφει στις σωστές τοπικές.

**Files:** `utils/dxf-block-expander.ts` (extract `applyBlockTransformGeometry` + export `transformInsertHatch`),
`utils/dxf-scene-builder.ts` (call site εφαρμόζει το transform), `utils/__tests__/dxf-hatch-xdata-converter.test.ts`
(+1 regression: block-based INSERT → hatch στο τοπικό origin). **Verification:** 7/7 hatch-xdata + 33/33
block-expansion/attrib/mm/robustness jest green· jscpd clean.

## Φ C.13 — Imported hatch off-screen ΟΤΑΝ συνυπάρχει με block: robust-bounds απορρίπτει τη γραμμοσκίαση ως flyaway

**Symptom (Giorgio, controlled repro — 2 μικρά R12 αρχεία, ίδιος τύπος/διαστάσεις hatch):**
`ΓΡΑΜΜΟΣΚΙΑΣΗ_ΧΩΡΙΣ_ΜΠΛΟΚ.dxf` (1 hatch-INSERT `*X3`) → η γραμμοσκίαση **φαίνεται κανονικά**.
`ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ.dxf` (hatch-INSERT `*X5` + block-INSERT `*U2`) → **φαίνεται ΜΟΝΟ το μπλοκ**, η
γραμμοσκίαση εξαφανίζεται. Το ίδιο και στο 42MB permit («όλα φορτώνουν εκτός από γραμμοσκιάσεις»).

**Διαδρομή διάγνωσης (jest με τα ΠΡΑΓΜΑΤΙΚΑ αρχεία — απέκλεισε ΟΛΑ τα «προφανή»):** parser (hatch parsed OK, 1
HATCH στο build), persistence emit (fires για hatch), block transforms (scale/rotate/translate ΟΛΑ χειρίζονται
`boundaryPaths`), render suppression (type-gated, δεν αγγίζει hatch), reconcile. Το build επιστρέφει σωστά
`{hatch:1, line:20, arc:8}` **και** ο converted `DxfScene` **έχει** τη γραμμοσκίαση. Άρα ΟΧΙ parser/persistence/
block-system — το πρόβλημα είναι στο **viewport fit**.

**Root cause (100% επιβεβαιωμένο):** το fresh-import auto-fit ΔΕΝ χρησιμοποιεί το `scene.bounds` — ο
`useViewportAutoFit` κάνει `EventBus.emit('canvas-fit-to-view')` → ο `useFitToView` handler υπολογίζει
`createCombinedBounds(dxfScene…)` (`systems/zoom/utils/bounds.ts`) → **`computeRobustBounds`** (`robust-bounds.ts`,
ADR-399, outlier-tolerant zoom-extents για corrupted import flyaways). Το `*U2` flatten-άρει σε **28 πυκνά entities**
(20 lines+8 arcs) γύρω στο `(3201,1459)`· η **μοναχική** γραμμοσκίαση στο `(3212,1454)` (11 μονάδες μακριά) περνά:
(gate MAD — cluster MAD~0.5, `thr=12×0.5=6`, hatch@11 → outlier), (gate 1 minority — 1/29 ≤ 10%), **(gate 2 shrink —
dropping το drops τη διαγώνιο 8.6× ≥ `MIN_SHRINK_RATIO=4`)** → **η γραμμοσκίαση απορρίπτεται** από το fit bbox
(`createCombinedBounds` = `(3200.8,1459.3)–(3202.9,1460.1)` = ΜΟΝΟ το block). **ΧΩΡΙΣ block δούλευε** γιατί 1 entity
`< 8` → το robust-bounds κάνει skip (γραμμή 78). Το `MIN_SHRINK_RATIO=4` ήταν **λάθος βαθμονομημένο**: 4× shrink =
content 25 % της οθόνης (πλήρως ορατό) — η «σε-κουκκίδα» παθολογία που δικαιολογεί το feature χρειάζεται ~100× (το
KADOS 8.5 km import garbage = ~130×).

**Fix (1 constant, unit-independent):** `MIN_SHRINK_RATIO` **4 → 50** — απορρίπτει ΜΟΝΟ αληθινά dot-causing flyaways
(≥50× = content ≤2 % οθόνης). Μετά: `createCombinedBounds(ΜΕ_ΜΠΛΟΚ)` = `(3200.8,1451.9)–(3218.4,1460.1)` (block **+**
γραμμοσκίαση). **Το REAL-SCENARIO test (74m cluster + 7 flyaways @8.5km, ~130×) ΕΞΑΚΟΛΟΥΘΕΙ να απορρίπτει** → μηδέν
regression στον σκοπό του feature.

**Secondary fix (ίδιο θέμα, correctness):** `DxfSceneBuilder.calculateBounds` (τρέφει το paper-scale 1:N + `scene.
bounds` + `validateScene`) είχε επίσης switch χωρίς `case 'hatch'` → νέο `case 'hatch'` (dedup όλων των cases σε ένα
`expand(x,y)` helper για N.18). ΔΕΝ ήταν αυτό το fit-blocker (το fit πάει από `createCombinedBounds`), αλλά σωστό να
περιλαμβάνει τη γραμμοσκίαση στο drawing extent.

**Sibling gap (flagged, boy-scout/N.18):** **3** bbox impls — `calculateBounds` (paper-scale/scene.bounds),
`dxf-viewport-culling.getEntityBBox` (per-frame culling, hatch απ' το Φ C.9), `entity-bounds-ssot.resolveEntityBounds`
(πλήρες SSoT· το `createCombinedBounds` ΤΟ χρησιμοποιεί ήδη). SSoT-convergence του `calculateBounds`→`resolveEntityBounds`
deferred (αλλάζει fit για text/dim/BIM → regression risk).

**Files:** `systems/zoom/utils/robust-bounds.ts` (`MIN_SHRINK_RATIO` 4→50 — THE fit fix),
`systems/zoom/utils/__tests__/robust-bounds.test.ts` (+1: nearby larger content ~9× KEPT),
`utils/dxf-scene-builder.ts` (`case 'hatch'` + `expand()` dedup), `utils/__tests__/dxf-scene-bounds-hatch.test.ts`
(+3). **Verification:** robust-bounds 7/7 (REAL km flyaway ΑΚΟΜΑ dropped) + scene-bounds 3/3· `createCombinedBounds`
στα πραγματικά αρχεία επιβεβαίωσε το union. jscpd clean. 🔴 browser-verify (Giorgio): re-import `ΜΕ_ΜΠΛΟΚ` →
γραμμοσκίαση + μπλοκ μαζί· **+ επιβεβαίωσε ότι το 42MB permit ακόμα framing-άρει σωστά** (το km-flyaway protection).

## Φ C.14 — Imported hatch σε ΛΑΘΟΣ ΣΧΕΤΙΚΗ θέση από το block: import recenter δεν μετέφερε τη γραμμοσκίαση

**Symptom (Giorgio, ΙΔΙΟ repro `ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ` — μετά το Φ C.13 fix):** ΚΑΙ η γραμμοσκίαση ΚΑΙ το
μπλοκ εμφανίζονται πλέον, αλλά **σε τεράστια σχετική απόσταση** (screenshots: μπλοκ ~origin, γραμμοσκίαση @3212).
Στο AutoCAD ακουμπάνε (το έπιπλο `*U2` δίπλα στη γραμμοσκίαση).

**Διαδρομή διάγνωσης (jest ground-truth στο ΠΡΑΓΜΑΤΙΚΟ αρχείο):** `DxfSceneBuilder.buildScene` (χωρίς recenter)
δίνει hatch `(3206..3218,1451..1456)` + block members `(3200..3203,1459..1460)` = **12 μονάδες μακριά, ΣΩΣΤΑ** →
άρα το transform pipeline (`transformInsertHatch`/`instantiateInsert`/`applyBlockTransformGeometry`) είναι σωστό, ΟΧΙ
bug. Εφαρμόζοντας το ΠΡΑΓΜΑΤΙΚΟ import βήμα (`calculateTightBounds(entities, true)` — «bottom-left → (0,0)») στο ίδιο
scene: hatch **μένει** @`(3212,1454)` ενώ όλα τα άλλα πάνε στο origin → **dist=3525** (= τα «μεγάλες αποστάσεις»).

**Root cause (100%):** το `io/dxf-import.ts` normalize-άρει κάθε import (`calculateTightBounds(…, true)` /
`runDxfParse({normalizeBounds:true})`) μετακινώντας τη γεωμετρία στο θετικό τεταρτημόριο. Οι δύο συναρτήσεις που το
κάνουν — `getEntityBounds` (υπολογισμός offset) **και** `normalizeEntityPositions` (εφαρμογή offset) στο
`systems/zoom/utils/bounds-entity.ts` — είχαν `switch(entity.type)` **ΧΩΡΙΣ `case 'hatch'`**. Η γεωμετρία του hatch
ζει στο `boundaryPaths` (rings of {x,y}), όχι σε primitive `start/center`. Άρα η γραμμοσκίαση **αποκλειόταν από το
offset ΚΑΙ έμενε αμετάφραστη** — stranded στις absolute coords ενώ οι siblings πήγαιναν στο origin. **Τρίτο** σημείο
της ίδιας οικογένειας hatch-`boundaryPaths` gap (μετά scene-builder Φ C.13 + culling Φ C.9).

**Fix (SSoT, mirror των υπαρχόντων hatch cases):** `case 'hatch'` σε **αμφότερα** — `getEntityBounds` (bbox από
`boundaryPaths` rings, reuse `createInfinityBounds`/`expandInfinityBounds`) ΚΑΙ `normalizeEntityPositions` (offset σε
κάθε vertex). Τύποι `BoundsEntity`/`MutableBoundsEntity` απέκτησαν `boundaryPaths?`. Μετά: το ίδιο scene normalize-άρει
σε hatch `(6..18,0..5)` + block `(0..2,7..8)` = **dist=12 ΞΑΝΑ** (σωστή σχετική θέση AutoCAD), όλα στο positive quadrant.

**Files:** `systems/zoom/utils/bounds-entity.ts` (4 edits: 2 type fields + `case 'hatch'` σε `getEntityBounds` &
`normalizeEntityPositions`), `systems/zoom/utils/__tests__/bounds-entity-hatch-normalize.test.ts` (νέο, 5 tests).
**Verification:** 17/17 (νέα 5 + robust-bounds 7/7 Φ C.13 ΑΚΟΜΑ + bounds-bim 5/5)· jscpd clean. 🔴 browser-verify
(Giorgio): re-import `ΜΕ_ΜΠΛΟΚ` → γραμμοσκίαση **πάνω/δίπλα** στο μπλοκ (όχι μακριά).

## Φ C.15 — Imported hatch «εμφανίζεται & εξαφανίζεται»: create-event πριν ετοιμαστεί το persistence service (import race)

**Symptom (Giorgio, ΙΔΙΟ repro `ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ` — μετά τα Φ C.13/C.14):** στη φόρτωση, hatch + block
στη σωστή θέση, ένδειξη **«2 στοιχεία»** — αλλά **αμέσως** η γραμμοσκίαση εξαφανίζεται → **«1 στοιχείο»** (μένει
το block). Το block (ADR-640 preserved, ΟΧΙ per-entity-persisted) επιβιώνει· ο hatch (per-entity-persisted) φεύγει.

**Root cause (SSoT audit):** Ο hatch έχει dual persistence — SSoT = `floorplan_hatches` doc, το scene blob =
derived cache. Στο load, `reconcileLoadedSceneBim` πετά blob-hatch χωρίς DB doc· γι' αυτό ο importer εκπέμπει
`drawing:entity-created {tool:'hatch'}` (`emitImportedEntityCreateEvents`, Φ C.8) → first-save. **ΑΛΛΑ** ο κοινός
`createBimEntityPersistenceHook` έκανε στον first-save listener:
```
if (!serviceRef.current) return;   // ← silent drop
pendingFirstSaveIdsRef.current.add(id); void persist(entity);
```
Ο emit είναι **σύγχρονος** στο import (`useSceneState`, αμέσως μετά `setLevelScene`)· το service instantiate-άρεται
**async** σε `useEffect` (keyed σε floorId/floorplanId — αλλάζουν σε fresh import σε νέο/αλλαγμένο level). Άρα στο
emit-time `serviceRef.current === null` → **early-return**: ούτε `pending` (δεν προστατεύεται από το merge), ούτε save
(κανένα doc). Έπειτα η subscription fire-άρει με docs=[] → στο `mergeDocsIntoScene` το `dropOrphan = id ⇒
!dirty.has(id) && !pending.has(id)` επιστρέφει true → **ο hatch αφαιρείται** από το scene (2→1). Γενικό race
(κάθε per-entity type σε fresh-import-into-new-level), ΟΧΙ hatch-specific.

**Fix (belt-and-suspenders, additive — το ready-path αμετάβλητο):** στον first-save listener, **ΠΑΝΤΑ** `pending`+`dirty`
add (drop-protection ανεξάρτητα readiness)· αν `!serviceRef.current`, **defer** το entity σε νέο `deferredFirstSaveRef`
map αντί για early-return. Η service-instantiation `useEffect`, μόλις set-άρει το `serviceRef.current`, **flush**-άρει τα
deferred (persist κάθε ένα). Έτσι ο hatch (α) μένει ορατός (pending → δεν πέφτει στο merge) και (β) first-save-άρεται
μόλις ετοιμαστεί το scope → doc γράφεται → επιβιώνει σε reload.

**Files:** `hooks/data/create-bim-entity-persistence-hook.ts` (3 edits: `deferredFirstSaveRef` + flush στο service effect
+ always-protect/defer στον listener), `hooks/data/__tests__/create-bim-entity-persistence-hook.test.tsx` (+1 race test:
create-event με null scope → rerender valid scope → deferred flush → save×1). **Verification:** 10/10 (νέο race test +
9 existing) + merge-docs 53/53 suite· jscpd clean. 🔴 browser-verify (Giorgio): re-import `ΜΕ_ΜΠΛΟΚ` → γραμμοσκίαση
**παραμένει** (2 στοιχεία σταθερά, όχι 2→1) + reload → ακόμη εκεί.

## Changelog
- **2026-07-16 — Φ B (🐛 leader orphan — renderer registered αλλά χωρίς DxfEntityUnion variant → αόρατος/μη-επιλέξιμος, Opus 4.8):** Ο `LeaderRenderer` ήταν καταχωρημένος (ADR-635 Φ B) αλλά ο `leader` **δεν** είχε `DxfEntityUnion` variant + TO_DXF handler → ένα imported DXF `LEADER` (`convertLeader` → scene) έπεφτε στο `convertEntity` `null` default → **αόρατο στο 2D canvas** και εκτός spatial index (μηδέν hover/κλικ) — ο ίδιος drop-trap με ADR-583/612/651, τον οποίο ανέδειξε το render-coverage orphan (7ο κόκκινο test στο ADR-662 Φ2β Stage A). **Fix (SSoT wiring, mirror του `topo-surface`/`image`):** νέο `DxfLeader` variant + union entry (`dxf-types.ts`), `TO_DXF_HANDLERS['leader']` (`dxf-scene-entity-handlers.ts`), `buildEntityModelFromDxf` case + `TO_ENTITY_MODEL_SUPPORTED_TYPES` (`dxf-renderer-entity-model.ts`), render contract + `DXF_RENDERABLE_TYPES` (`entity-render-contract.ts`/`renderable-entity-type.ts`), και `HIT_TEST_MODEL_DXF_HANDLERS['leader']` flat-fields (`vertices` → AABB + point-to-segment narrow test, open path όπως το polyline). Τα flat fields (vertices path + arrowHead + optional annotation text/hook) περνούν top-level· ο `LeaderRenderer` στρώνει path + tip arrowhead. `jscpd:diff` καθαρό.
- **2026-07-12 — Φ C.15 (🐛 imported hatch «εμφανίζεται & εξαφανίζεται» — create-event πριν ετοιμαστεί το persistence service, Opus 4.8):** UNCOMMITTED. Follow-up των Φ C.13/C.14 (ίδιο `ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ`): με σωστή θέση πλέον, ένδειξη «2 στοιχεία» → **αμέσως** «1 στοιχείο» (hatch φεύγει, block μένει). **SSoT audit:** ο importer ΕΚΠΕΜΠΕΙ ήδη `drawing:entity-created {tool:'hatch'}` (`emitImportedEntityCreateEvents`, Φ C.8) για first-save, ΑΛΛΑ ο κοινός `createBimEntityPersistenceHook` first-save listener έκανε `if (!serviceRef.current) return` **πριν** το `pending` add + save. Ο emit είναι σύγχρονος στο import· το service instantiate-άρεται async (useEffect keyed σε floorId/floorplanId, αλλάζουν σε νέο level) → στο emit-time `serviceRef` null → **silent drop** (ούτε protection ούτε save). Μετά subscription με docs=[] → `mergeDocsIntoScene.dropOrphan` (`!dirty && !pending`) πετά τον unprotected hatch (2→1). Γενικό race κάθε per-entity type σε fresh-import. **Fix (additive):** ΠΑΝΤΑ `pending`+`dirty` add (protection) + **defer** (`deferredFirstSaveRef`) όταν service null· η service-instantiation effect **flush**-άρει τα deferred μόλις ετοιμαστεί το scope. Ready-path αμετάβλητο. 1 MOD (`create-bim-entity-persistence-hook.ts`, 3 edits) + 1 race test· 10/10 hook + 53/53 persistence suite· jscpd clean. 🔴 browser: re-import ΜΕ_ΜΠΛΟΚ → γραμμοσκίαση σταθερή (2 στοιχεία) + reload OK.
- **2026-07-12 — Φ C.14 (🐛 imported hatch σε λάθος ΣΧΕΤΙΚΗ θέση — import recenter δεν μετέφερε τη γραμμοσκίαση, Opus 4.8):** UNCOMMITTED. Sibling/follow-up του Φ C.13 (ίδιο αρχείο `ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ`): μετά που η γραμμοσκίαση ξαναφάνηκε, εμφανιζόταν σε **τεράστια απόσταση** από το μπλοκ (screenshots: μπλοκ ~origin, hatch @3212). **Διάγνωση (jest ground-truth):** `buildScene` (χωρίς recenter) → hatch & block members **12u μακριά, ΣΩΣΤΑ** (transform pipeline OK, ΟΧΙ bug). Εφαρμογή του ΠΡΑΓΜΑΤΙΚΟΥ import βήματος `calculateTightBounds(entities, true)` («bottom-left→(0,0)») → hatch **μένει** @3212 ενώ όλα τα άλλα → origin → **dist=3525**. **Root cause:** `io/dxf-import.ts` normalize-άρει κάθε import· `getEntityBounds` **και** `normalizeEntityPositions` (`bounds-entity.ts`) είχαν `switch` **χωρίς `case 'hatch'`** → η γραμμοσκίαση (geometry στο `boundaryPaths`, όχι primitive field) **αποκλειόταν από το offset ΚΑΙ έμενε αμετάφραστη**. Τρίτο hatch-`boundaryPaths` gap (μετά scene-builder Φ C.13 + culling Φ C.9). **Fix (SSoT):** `case 'hatch'` σε αμφότερες (mirror culling/scene-builder) + `boundaryPaths?` στους τύπους `BoundsEntity`/`MutableBoundsEntity`. Μετά: ίδιο scene → **dist=12 ΞΑΝΑ**, όλα positive-quadrant. 1 MOD (`bounds-entity.ts`, 4 edits) + 1 νέο test (5)· 17/17 (robust-bounds Φ C.13 ΑΚΟΜΑ 7/7)· jscpd clean. 🔴 browser: re-import ΜΕ_ΜΠΛΟΚ → γραμμοσκίαση δίπλα στο μπλοκ.
- **2026-07-12 — Φ C.13 (🐛 imported hatch off-screen όταν συνυπάρχει με block — robust-bounds απορρίπτει τη γραμμοσκίαση ως flyaway, Opus 4.8):** UNCOMMITTED. Controlled repro από τον Giorgio (2 μικρά R12 αρχεία): hatch ΜΟΝΟΣ → ορατός· hatch + block (`*U2`) → φαίνεται ΜΟΝΟ το μπλοκ. **Διάγνωση (jest με τα ΠΡΑΓΜΑΤΙΚΑ αρχεία) — απέκλεισε** parser (hatch parsed OK), persistence emit (fires), block transforms (scale/rotate/translate χειρίζονται hatch), render suppression (type-gated): το build ΚΑΙ ο converted DxfScene **έχουν** τη γραμμοσκίαση → το πρόβλημα = **viewport fit**. **Root cause:** το fresh-import fit πάει `useViewportAutoFit`→`EventBus('canvas-fit-to-view')`→`useFitToView`→`createCombinedBounds`→**`computeRobustBounds`** (robust-bounds.ts, ADR-399). Το `*U2` flatten-άρει σε 28 πυκνά entities· η μοναχική γραμμοσκίαση (11 μονάδες μακριά) περνά MAD+minority+shrink gates → **απορρίπτεται** ως outlier (`createCombinedBounds`=ΜΟΝΟ block `3200.8..3202.9`). ΧΩΡΙΣ block: 1 entity `<8` → robust skip → δούλευε. Το `MIN_SHRINK_RATIO=4` λάθος βαθμονομημένο (4× = content 25% οθόνης, ορατό· dot-παθολογία χρειάζεται ~100×· KADOS km garbage=~130×). **Fix:** `MIN_SHRINK_RATIO` **4→50** (1 constant, unit-independent) → `createCombinedBounds(ΜΕ)` = union `(3200.8,1451.9)–(3218.4,1460.1)`. **REAL-SCENARIO test (74m+7 flyaways@8.5km, ~130×) ΑΚΟΜΑ απορρίπτει → μηδέν regression.** **Secondary (correctness):** `calculateBounds` (paper-scale/scene.bounds) είχε επίσης `case 'hatch'` gap → προστέθηκε (+`expand()` dedup, N.18). **Flagged:** 3 bbox impls· `calculateBounds`→`resolveEntityBounds` convergence deferred. 2 MOD + 4 regression tests (robust-bounds 7/7 incl. km-flyaway ΑΚΟΜΑ dropped· scene-bounds 3/3)· jscpd clean. 🔴 browser: re-import ΜΕ_ΜΠΛΟΚ + **επιβεβαίωση 42MB permit ακόμα σωστό**.
- **2026-07-12 — Named single INSERT → first-class BlockEntity (ADR-640 M1, Opus 4.8):** UNCOMMITTED. Το Φ2 explode-on-import (`instantiateInsert` → loose lines/arcs) **χάνει** την ταυτότητα «μπλοκ» — reported από ΠΡΑΓΜΑΤΙΚΟ DXF (`KADOS/ΕΠΙΠΛΟ.dxf`, single `NEC32_BLOCK` INSERT): «το έπιπλο σπάει σε γραμμές». **Fix (ADR-640):** ένα **named, single (non-MINSERT)** INSERT διατηρείται πλέον ως `type:'block'` container (selectable/movable/explodable, round-trips σε INSERT), αντί να flatten-άρεται. Ο `dxf-scene-builder` INSERT branch απέκτησε Phase-0 gate (`name && !name.startsWith('*') && cols===1 && rows===1`) → `createBlockInstance` (νέο `systems/block/`, mirror του GROUP· reuse του extracted `buildLocalBlockMembers` SSoT). **Anonymous `*`-hatch/`*D#`-dimension blocks + MINSERT arrays ΑΜΕΤΑΒΛΗΤΑ** (legacy flatten). Το placement math είναι byte-identical (shared `applyBlockTransformGeometry`). E2E στο πραγματικό αρχείο: 1 INSERT → 1 block, 28 members, 800×2100mm bounds, 0 loose lines. Λεπτομέρειες + 6-consumer verdict + storage decision: **ADR-640**. `dxf-block-expansion.test.ts` ενημερώθηκε (expand block πριν τα geometry asserts). 9/9 + 13 νέα block tests PASS.
- **2026-07-12 — Φ4 verify + doc-cleanup (rich MTEXT round-trip end-to-end, Opus 4.8):** UNCOMMITTED. **Audit revelation:** το Φ4 core (rich MTEXT μέσω `parseMtext(tokenizeMtext(...))`) είχε ΗΔΗ μπει (commit `d362a0ab`) — το ADR-636 Φ2.3 «known limitation» note ήταν **STALE**. Δουλειά = **verify + test + doc**, ΟΧΙ re-implement. Νέο **end-to-end** round-trip test `export/core/__tests__/dxf-roundtrip-mtext.test.ts` (3 cases) μέσω του **production `writeDxfAscii`→`emitMText`→`serializeDxfTextNode`** (όχι μόνο serializer isolated): `\P` καθαρό (ΟΧΙ `\\P`)· inline `\H` χωρίς double-escape (αποδεικνύει καθαρό AST χωρίς literal-code runs)· attachment(71)+rotation(50) round-trip. 3/3 PASS. **Stale ADR-636 note → RESOLVED pointer** (ίδιο commit). **🔴 Residual (honest, pre-existing, out-of-scope):** το *imported* MTEXT flatten-άρεται σε `type:'text'` (`buildTextSceneEntity` πάντα `type:'text'`) → re-export μέσω `emitText` single-line → `sanitizeText` collapse-άρει `\n`→space → χάνονται τα paragraph breaks. **ΟΧΙ Φ4 regression** (και πριν χανόταν: `convertText` δεν parse-άρει `\P`). Το proper `emitMText` path (όπου ζούσε το double-escape) είναι καθαρό. Preserve MTEXT identity (`type:'mtext'` στο import) = cross-cutting entity-type αλλαγή σε render/hit-test/snap → deferred, δικό του ADR phase. 1 νέο test file, 0 src αλλαγές (core ήδη εκεί). jscpd clean.
- **2026-07-12 — Φ3.1 (parser-level skipped-warning — genuinely-unsupported entity TYPES, Opus 4.8):** UNCOMMITTED. Το Φ3 diagnostics κάλυπτε ΜΟΝΟ *recognized-but-unconvertible* types (μέσα στο `SUPPORTED_ENTITY_TYPES`, converter→null· π.χ. `SOLID`). Αλλά ένα **αληθινά μη-υποστηριζόμενο TYPE** (`REGION`/`3DSOLID`/`MESH`/`WIPEOUT`/`ACAD_TABLE`…) απορρίπτεται ένα layer νωρίτερα στο `parseEntityAt` (`{entity:null}`, ποτέ δεν μπαίνει στο `parsedEntities`) → **silent data loss ΧΩΡΙΣ warning** ακόμη και μετά το Φ3. **Fix = pure wire (reuse, ΟΧΙ νέο σύστημα):** thread του ΙΔΙΟΥ `ImportDiagnostics` collector (optional, no-op όταν απών — mirror του `dxf-block-expander` pattern) σε `parseEntities`/`parseEntityAt`/`parseBlockDefinitions`· `noteUnsupportedType()` κάνει `recordSkipped` ΜΟΝΟ για πραγματικό entity type — φιλτράρει `DXF_SECTION_MARKERS` (ENDSEC/BLOCK…) + νέο `DXF_STRUCTURAL_SUBMARKERS` (`VERTEX`/`SEQEND`, τα καταναλώνουν οι compound parsers) ώστε ένα leaked terminator να μη φτιάχνει ψεύτικο warning. Ο `dxf-scene-builder` περνά το υπάρχον `diagnostics` και στα δύο parse calls → τα counts ρέουν στο ίδιο `summarizeDiagnostics()` → `runDxfParse().warnings` → `importedWithWarnings` toast. **Μηδέν νέο UI/notification/collector.** 4 MOD (`dxf-parser-types.ts` +`DXF_STRUCTURAL_SUBMARKERS`, `dxf-entity-parser.ts`, `dxf-block-parser.ts`, `dxf-scene-builder.ts`) + 4 regression tests (`dxf-import-robustness.test.ts`: REGION/3DSOLID counted· unsupported member σε BLOCK counted· SEQEND/ENDSEC ΟΧΙ warned· no-collector back-compat), 9/9 PASS. jscpd clean (4 files).
- **2026-07-12 — Φ C.12 (🐛 3-coord hatch boundary vertices διαβάζονταν ως 2-coord → km-scale garbage, Opus 4.8):** UNCOMMITTED. **Διάγνωση από ΠΡΑΓΜΑΤΙΚΟ DXF** (KADOS «1ος Όροφος», κατέβασμα του original 42MB .dxf + scene.json blob + Firestore): 7/117 imported hatches κατέληγαν με boundary vertices σε coords `x≈y≈8.56M` (πάνω στη διαγώνιο — center = ο μέσος όρος ενός `[0..17M]×[0..17M]` bbox), 9,6km μακριά από τον όγκο → το fit-to-view αγκάλιαζε 17km → σχέδιο = κουκκίδα. **Root cause:** στο `extractR14BoundaryPaths` (`dxf-hatch-xdata-converter.ts`), το polyline-vertex path (`1071 n` + scalars) υπέθετε **σταθερά 2 coords/vertex** (`i += 2`). ΑΛΛΑ η AutoCAD γράφει το boundary polyline **είτε** 2 (x,y) **είτε 3 (x,y,bulge)** scalars/vertex — **18/117** hatches του δείγματος ήταν 3-coord. Με stride 2, κάθε vertex ολίσθαινε κατά ένα scalar → η στήλη bulge διαβαζόταν ως το επόμενο X → spurious `(0,x)`/`(x,0)` vertices → bbox explosion. **Fix:** infer stride από το πλήθος consecutive 1040 (`count === n*3 ? 3 : 2`), διάβασε (x,y) αγνοώντας το 3ο scalar. Backward-compatible (2-coord: `count===n*2≠n*3` → stride 2, αμετάβλητο). **Επαληθευμένο στο πραγματικό DXF:** μετά το fix, 0 corrupt vertices, ΟΛΑ τα 117 hatches στο σωστό range (X 17107..17172m). 1 MOD (`dxf-hatch-xdata-converter.ts`) + 2 regression tests (3-coord stride 3 + 2-coord backward-compat), 9/9 PASS. **Υπάρχοντα δεδομένα:** τα 7 corrupted ζουν ΜΟΝΟ στο scene.json blob (ΟΧΙ σε `floorplan_hatches`) → εξαφανίζονται αυτόματα στο reload (`reconcileLoadedSceneBim` πετά snapshot hatches)· καθαρή λύση = re-import με τον διορθωμένο parser. Συμπληρωματικό: outlier-robust fit (ADR-399, 2026-07-12) κάνει το framing ανθεκτικό ακόμη και σε κακά δεδομένα. 🔴 browser-verify: re-import → 117 hatches σωστά τοποθετημένα.
- **2026-07-12 — Φ C.11 (imported hatch στο ΛΑΘΟΣ σημείο — R12 hatch-INSERT boundary χωρίς block transform):**
  το `tryConvertInsertHatch` (Φ C.6) διάβαζε το R14_HATCH_DATA boundary (block-LOCAL space) αλλά **δεν εφάρμοζε
  το INSERT block transform** που εφαρμόζει το `instantiateInsert` στα exploded members → τα hatches έμεναν στα
  raw ~2.8εκ. coords ενώ το υπόλοιπο σχέδιο ήταν στα 0–70k. Δύο συμπτώματα, μία ρίζα: (α) hatches εκτός οθόνης
  (αόρατα), (β) HOME zoom-extents ένωνε 0–70k ∪ 2.8εκ. → over-zoom σε κουκκίδα. Fix: extract
  `applyBlockTransformGeometry` (SSoT scale→rotate→translate, ήδη καλύπτει hatch boundaryPaths) + νέο export
  `transformInsertHatch` που το εφαρμόζει με block base + INSERT transform → placed hatch byte-identical με το
  block explosion. Μηδέν νέα geometry math. Απαιτεί φρέσκια επανεισαγωγή (persisted docs έχουν λάθος coords).
  Ορθογώνιο με Φ C.9 (culling) / C.10 (pattern) — αυτό = «σωστή ΘΕΣΗ».
- **2026-07-11 — Φ C.10 (imported hatch PATTERN wrong — catalog GRASS approximate + SQUARE/HEX missing):** ο
  predefined hatch ξαναφτιάχνεται από τον catalog (name-based, AutoCAD-parity) αλλά τα δεδομένα ήταν λάθος:
  GRASS με γωνίες 60/120 (→ άναρχες γραμμές) + SQUARE/HEX ανύπαρκτα (catalog MISS → κανένα pattern). Διόρθωση
  **μόνο δεδομένων** στον `hatch-pattern-catalog.ts` SSoT (ακριβή acad.pat conversions × INCH) → canvas + DXF-export
  1:1 με AutoCAD (ο `buildPredefinedHatchLines` tiling ήταν ήδη σωστός). +4 parity tests, +i18n square/hex. Απαιτεί
  φρέσκια επανεισαγωγή (idempotency normalization). Ορθογώνιο με Φ C.9 (visibility) — αυτό = «σωστό σχέδιο».
- **2026-07-11 — Φ C.9 (imported hatch INVISIBLE — viewport-culling missing `case 'hatch'`):** ο
  `getEntityBBox()` (`dxf-viewport-culling.ts`) δεν είχε hatch case → ο hatch (γεωμετρία στο `boundaryPaths`,
  όχι `geometry.bbox`) έπεφτε στο ±1e6 `FULL_PLANE_BBOX` και σε geo-referenced DXF (coords ~2.8e6) γινόταν
  culled → αόρατος («15 στοιχεία αλλά 9 hatches αόρατοι»). Νέο `case 'hatch'` (AABB από boundaryPaths, mirror
  του `case 'polyline'`, ΟΧΙ νέος helper) + 4 unit. Sibling των dimension/opening/wall geo-referenced culling
  fixes. Flag: `entity-bounds.ts` picking bounds έχει το ίδιο gap (secondary). Ορθογώνιο με Φ C.8 (persistence).
- **2026-07-11 — Export parity (ADR-636 Φ2.4 D.5): C.5 round-trip.** Το font που εισάγει το import (group 7
  text-style name → STYLE table → `buildStyleFontMap`/`styleEntryDefaults`, `style-table-reader.ts`) γράφεται
  πλέον ΠΙΣΩ στο export: STYLE table (inverse `groupCodesToEntry`, **reuse του type `DxfStyleTableEntry`**) +
  real group 7 (style name = font family, `textStyleName`). Round-trip απόδειξη με τον ίδιο import reader
  (`parseStyleTable`/`buildStyleFontMap`) στο `dxf-roundtrip-textstyle.test.ts`. Λεπτομέρειες: ADR-636 changelog (D.5).
- **2026-07-11 — Export parity (ADR-636 Φ2.4 D.6): C.3/C.4 round-trip.** Οι per-entity STYLE codes που
  διαβάζει το import (**6** linetype name `extractEntityLinetype` / **48** CELTSCALE `extractEntityLtscale` /
  **370** lineweight `extractEntityLineweight`, στο `dxf-entity-style-extract.ts`) γράφονται πλέον ΠΙΣΩ στο
  export μέσω του κεντρικού inverse helper `emitEntityStyle` (concrete-only gating = ΑΚΡΙΒΩΣ οι ίδιοι κανόνες
  με τους extractors· 370 μέσω του `encodeDxfCode370` SSoT). Round-trip απόδειξη με τους ίδιους extractors στο
  `dxf-roundtrip-linetype-lineweight.test.ts`. Λεπτομέρειες: ADR-636 changelog (D.6).
- **2026-07-11 — Export parity (ADR-636 Φ2.4 D.2): Batch 2-B LEADER round-trip.** Το LEADER που εισάγει το
  import (`convertLeader`, `utils/dxf-leader-converter.ts`: **10/20** ordered vertices tip=vertices[0] +
  **71** arrowhead flag + **62** χρώμα) γράφεται πλέον ΠΙΣΩ στο export μέσω του νέου `emitLeader`
  (`dxf-ascii-primitive-emitters.ts`) = ΑΚΡΙΒΕΣ inverse· ο `writeEntity` switch το skip-άρε πριν → imported
  leaders χάνονταν. Arrow size (DIMASZ σταθερά) + annotation (340) δεν round-trip-άρονται από file → δεν emitted.
  Round-trip απόδειξη με τον ίδιο `convertLeader` στο `dxf-roundtrip-leader.test.ts`. Λεπτομέρειες: ADR-636 changelog (D.2).
- **2026-07-12 — Export parity (ADR-636 Φ2.4 D.3): Φάση B SOLID/TRACE/3DFACE round-trip.** Τα quad-fill entities
  που εισάγει το import (`convertSolid`/`convertTrace`/`convert3dFace` → `HatchEntity` fillType 'solid', boundary
  σε draw-order 1-2-4-3) εξάγονται πλέον ΠΙΣΩ στο **native** entity (όχι downgraded HATCH) μέσω νέου marker
  `HatchEntity.dxfSourceType` + `emitQuadFill` (`dxf-ascii-primitive-emitters.ts`) = ΑΚΡΙΒΕΣ inverse του
  `parseQuadVertices` (un-bowtie draw-order → DXF slots 10/11/12/13). 3DFACE: το Z χάθηκε στο 2D import → flat
  (z=0). Round-trip απόδειξη με τους ίδιους converters στο `dxf-roundtrip-solid.test.ts`. Λεπτομέρειες: ADR-636 changelog (D.3).
- **2026-07-11 — Φ C.8 (imported per-entity entities first-save on DXF import — hatch persistence drop):** το
  DXF import δεν εξέπεμπε `drawing:entity-created` → οι εισαγόμενες AutoCAD γραμμοσκιάσεις (per-entity SSoT,
  `floorplan_hatches`) δεν first-save-άρανε → το `reconcileLoadedSceneBim` τις πετούσε στο load («6 στοιχεία,
  9 hatches χάνονται»). Νέος SSoT emitter `emitImportedEntityCreateEvents` (mirror .tek Φ5b.6), κοινός σε .tek +
  DXF branches του `useSceneState` (ο inline .tek loop → κλήση helper, N.18). `reconcileLoadedSceneBim` άθικτο.
- **2026-07-11 — Φ C.7 (MLINESTYLE import: MLINE → N parallel element polylines):** ο `convertMline` έβγαζε
  ΜΙΑ reference polyline (11/21) — τα MLINESTYLE elements (offsets/colors) στο **OBJECTS** section (handle 340)
  αγνοούνταν. Νέο **self-contained** `dxf-mline-style-parser.ts` (`buildMlineStyleMap`, ordered scan του OBJECTS
  ώστε τα repeated 49/62/6 να επιβιώνουν· key by name **και** handle· fill-colour 62 πριν το πρώτο 49 αγνοείται)
  + `STANDARD_MLINE_STYLE` (±0.5). Ο `convertMline(pairs, layer, index, mlineStyles?)` διαβάζει scale (40),
  justification (70: Top/Zero/Bottom → offset adjust), style name (2)/handle (340), closed (71 bit2) και επιστρέφει
  **N polylines** — καθεμία = reference path offset κατά `(offset+adjust)×scale` μέσω του SSoT
  `offsetPolyline` (rendering/entities/shared, **zero νέο offset math**) — με κοινό `groupId` (ADR-608 provenance)
  ώστε το MLINE να μένει ΕΝΑ selectable unit (AutoCAD parity). Απών OBJECTS/MLINESTYLE → STANDARD default.
  Per-drawing map threaded σαν το C.5 (`convertToSceneEntity`/`ExpandContext` 6ο param, pre-pass `buildMlineStyleMap(lines)`).
  14 νέα tests (parser + converter + end-to-end), 386 sibling jest green (utils + systems/scale), jscpd clean.
  **Export parity (2026-07-12, ADR-636 D.4):** ο `convertMline` κολλά τώρα τα αυθεντικά MLINE params σε `dxfMlineSource`
  (marker ΜΟΝΟ στο πρώτο element `_e0`)· ο export writer τα αντιστρέφει σε **native MLINE + MLINESTYLE (OBJECTS section)**.
  Round-trip απόδειξη με τους ίδιους `buildMlineStyleMap`+`convertMline` στο `dxf-roundtrip-mline.test.ts`. Λεπτομέρειες: ADR-636 changelog (D.4).
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
- **2026-07-16 — Φ B follow-up (leader RENDER wiring — latent invisibility fix):** ο imported DXF
  `LEADER` (`convertLeader` → `LeaderEntity` στη σκηνή, Φ B Batch 2) ήταν **αόρατος στον 2D καμβά**:
  ο `LeaderRenderer` ήταν registered στο composite, αλλά ο `leader` **έλειπε από το
  `RENDERABLE_ENTITY_TYPES`** και **δεν είχε `DxfEntityUnion` variant / `TO_DXF_HANDLERS` case** → η
  scene→Dxf projection τον έριχνε στο `null` default (το ADR-583/612/651 drop trap). Το ADR-587 Φ10
  `entity-render-coverage` το αποκάλυψε ως **orphan** (registered-not-canonical). **Fix (full-SSoT,
  reuse — μηδέν νέος μηχανισμός):** `leader` → `DXF_RENDERABLE_TYPES` + `ENTITY_RENDER_CONTRACTS`
  (`dxf(...)`), NEW `DxfLeader` variant + `TO_DXF_HANDLERS['leader']` + `buildEntityModelFromDxf` case +
  manifest, και τα ΤΡΙΑ hit-test seams reusing polyline SSoT (`calculatePolylineBounds`/`verticesBounds`
  broad-phase, `hitTestPolyline` open-path narrow — SSoT με `LeaderRenderer.hitTest`), flat-fields
  `HIT_TEST_MODEL_DXF_HANDLERS`. Ο imported leader είναι πλέον **ορατός + επιλέξιμος** (hover/click/marquee).
  Και τα 7 ADR-587 coverage tests πράσινα (+leader fixtures/PRECISE/A-B-HANDLED/NO_SELECTION_TAB). Τα
  υπάρχοντα leader roundtrip/scale/converter tests άθικτα. jscpd clean.
