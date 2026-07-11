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

**Batch 2 — Part A (ATTRIB/ATTDEF) DONE, Part B (LEADER) PENDING:**
- ✅ **ATTRIB / ATTDEF** → `type:'text'` (DONE 2026-07-11): shared `convertAttributeEntity` στο
  `dxf-text-converters.ts` (reuse `parseTextTransform`/`buildTextNodeFromFlat`/`buildTextSceneEntity`).
  Code 1 = ορατό value· code 2 = tag (`TextEntity.attributeTag?`)· code 70 bit 1 = invisible→`visible:false`.
  ✅ **Guard** επιβεβαιωμένος: `instantiateInsert` block-member loop → `if (child.type === 'ATTDEF') continue;`
  (ο `child` είναι raw `EntityData`· η design-agent υπόθεση για `convertEntityToScene(child)` ήταν λάθος).
  Χωρίς guard κάθε INSERT θα stamp-άριζε το stale default value. 9 νέα tests (guard integration incl.).
- **LEADER** → `LeaderEntity` (ήδη υπάρχει) + **νέος `LeaderRenderer`** (reuse DIMENSION arrowhead SSoT
  `renderArrowhead`/`getArrowheadBlock`). Vertices από ordered pairs (10/20)· arrowhead code 71.
  ⚠️ Ο renderer έχει πολλές helper-API deps (`renderWithPhases`/`drawVerticesPath`/`hitTestLineSegments`)
  που χρειάζονται signature verification πριν το commit.

## Out of scope (roadmap)
- Full BYBLOCK color/linetype inheritance; text-angle rotation fidelity under INSERT.
- **Follow-up:** `convertSpline` has the same data-map vertex bug (`dxf-entity-converters.ts`);
  migrate to `parseVerticesFromPairs`. Bulge→arc tessellation (Φ1b) — bulge is captured but
  currently rendered as straight segments (21 curved vertices in the sample).

## Changelog
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
