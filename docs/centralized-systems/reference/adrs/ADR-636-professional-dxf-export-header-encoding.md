# ADR-636 — Professional DXF Export (HEADER, version-driven encoding)

**Status:** Accepted (Στάδιο 1 implemented)
**Date:** 2026-07-11
**Domain:** dxf-viewer / export
**Related:** ADR-505 (client-side DXF writer), ADR-462 (canonical-mm), ADR-635 (import coverage),
ADR-362 (DIMSTYLE/BLOCKS emission)

## Context

The client-side DXF exporter (`export/core/dxf-ascii-writer.ts`, ADR-505 §A) emitted a **bare
envelope** — a single `ENTITIES` section, **no HEADER, no TABLES/LAYER**. Text (incl. Greek) was
written as raw **UTF-8**. Diagnosed against a real round-trip (`1ος_Όροφος…dxf` exported from the
app after importing an AutoCAD drawing):

- Greek `ΚΛΙΜΑΚΑ` is written as UTF-8 bytes (`ce9a ce9b …`), but with **no `$ACADVER` / `$DWGCODEPAGE`**
  a DXF reader assumes the file predates Unicode (R2007) and decodes the bytes as ANSI/Windows-1252 →
  **garbled Greek in AutoCAD** («ÊËÉÌÁÊÁ»). (Re-importing into the app itself is fine — the import
  auto-detect handles UTF-8.) The code already **acknowledged** this in comments (`dxf-category-layers.ts`,
  `overlay-dxf-collector.ts`) and worked around it only for **layer names** (kept ASCII), not text content.
- **No `$INSUNITS`** → a re-import must guess units (the app uses a bounds heuristic; AutoCAD assumes
  unitless).

The `DxfExportSettings` type already carried `version` / `units` / `encoding` fields — the writer
simply **ignored** them (they were dormant).

Giorgio: «Γιατί να μην έχουμε ΟΛΕΣ τις κωδικοποιήσεις; Γιατί να μην γίνουμε σούπερ επαγγελματική
εφαρμογή;» → decision: build the full **AutoCAD-style, version-driven** export, **staged**.

### How the big players actually do it (industry alignment)
DXF text encoding is **not** a free-floating toggle — it is **driven by the target release**:

| `$ACADVER` | Text encoding | Declared by |
|---|---|---|
| R12–2004 (AC1009–AC1018) | codepage bytes (Greek = Windows-1253) | `$DWGCODEPAGE=ANSI_1253` |
| 2007+ (AC1021+) | **UTF-8** | the `$ACADVER` itself |
| any (MTEXT only) | `\U+XXXX` unicode escapes | version-independent |

## Decision — staged

### Στάδιο 1 (DONE) — declare a correct HEADER, keep UTF-8

The writer already emits valid UTF-8; it just never **declared** it. Στάδιο 1 adds a minimal `HEADER`
so that UTF-8 is honored, **without** yet changing byte encoding.

- **`dxf-ascii-writer.ts`** — new `DxfWriteOptions.{acadVer, insunits, codepage}`. When supplied, the
  writer prepends `SECTION/HEADER` (correct DXF order — before TABLES/BLOCKS/ENTITIES) with
  `$ACADVER` (code 1), `$INSUNITS` (code 70) and `$DWGCODEPAGE` (code 3). **Gated**: a bare
  `writeDxfAscii(entities)` (Tekton/legacy) keeps the header-less envelope → zero regression.
- **`dxf-export-adapter.ts`** — `renderDxfBlob` now passes:
  - `acadVer = resolveUnicodeSafeAcadVer(version, encoding)` — since the writer emits UTF-8 (valid
    only from AC1021/R2007), a **pre-Unicode** requested version (`AC1009/AC1015/AC1018`) with utf-8
    is **bumped to AC1021** so Greek is not garbled. (Στάδιο 2 will instead encode text in the
    matching codepage for those lower versions, honoring the exact request.)
  - `insunits = DXF_UNIT_VALUES[settings.units]` — reuses the existing INSUNITS SSoT (no new map).
  - `codepage = encodingToCodepage(settings.encoding)` — Greek→`ANSI_1253`, else `ANSI_1252`.

**Result:** the exported DXF opens with correct Greek in **any AutoCAD 2007+** and carries real units.
Coordinates are still written in the caller's output unit via `scale` (ADR-505); the scene is mm
(ADR-462), the default export writes metres (`scale ×0.001`).

### Στάδιο 2 — full version-driven encoding + tables

- **Φ2.1 (DONE) — `TABLES → LAYER` section** (real layer definitions with ACI/true-colour/on-off/
  freeze/lock/linetype/lineweight instead of inline-only 62). See below.
- **Φ2.2 (DONE) — auto version-driven encoding.** The version dropdown already existed in the export
  dialog (`ui/components/export/ExportDialog.tsx`, all 7 releases); Φ2.2 wired the **encoding** behind
  it. See below.
- **Φ2.3 (DONE)** — real MTEXT emission (`\P` line breaks + 71 attachment), TEXT justification
  (72/73/11/21), and richer HEADER (`$EXTMIN`/`$EXTMAX`/`$MEASUREMENT`/`$LTSCALE`/`$LUNITS`). See below.
- **Φ2.4 (roadmap)** — `TEXTSTYLE` table, import Φ3 skipped-warning, **rich MTEXT import** (feed the
  `mtext-tokenizer` into the entity `textNode` so re-export never double-escapes raw inline codes —
  see Φ2.3 "known limitation").

### Στάδιο 2 Φ2.1 (DONE) — professional `TABLES → LAYER` section

The exporter previously emitted layers **only** as inline `62` (ACI per entity) → AutoCAD auto-created
layers with defaults, losing colour/on-off/freeze/lock/linetype/lineweight. Big-player DXF always
carries a real LAYER table. A complete `TABLES` writer already existed
(`utils/dxf-layer-table-writer.ts` → `writeLayerTable`, mirror of the parsers, with round-trip tests)
but **no production caller** used it — Φ2.1 **wires it in** (no new writer).

- **`utils/dxf-layer-table-writer.ts`** — extract `emitLayerTableBody(out, input)` (LTYPE + LAYER
  `TABLE` blocks **without** the `SECTION/TABLES/ENDSEC` wrapper). `writeLayerTable` becomes a thin
  wrapper around it → its output stays **byte-identical** (round-trip parsers/tests unaffected).
- **`export/core/dxf-ascii-tables-writer.ts`** (new, file-size SRP mirror of the HATCH split) —
  `emitTablesSection(out, pair, { tableLayers, customLinetypes, dimStyles, s })` emits **ONE**
  `SECTION/TABLES` holding LTYPE + LAYER (via `emitLayerTableBody`) **then** DIMSTYLE, in correct DXF
  table order. Fixes the latent **two-TABLES-sections** issue (Round 25 DIMSTYLE was a separate
  section). Emits nothing when both empty → bare envelope preserved.
- **`export/core/dxf-ascii-writer.ts`** — new `DxfWriteOptions.{tableLayers, customLinetypes}`; the
  inline DIMSTYLE block is replaced by a call to `emitTablesSection`. **Gated**: a bare
  `writeDxfAscii(entities)` (no tableLayers/dimStyles) stays table-less (Tekton/legacy). Inline `62`
  per entity is kept (belt-and-suspenders). File back under 500 lines (484) via the split.
- **`export/formats/dxf-export-adapter.ts`** — `renderDxfBlob` passes `tableLayers =
  Object.values(scene.layersById)` and `customLinetypes = collectCustomLinetypesForExport(scene)`
  **only** on the AutoCAD (POLYLINE) path (`lineMode !== 'lines'`); the Tekton (`lines`) path stays
  minimal. `collectCustomLinetypesForExport` resolves the layers' non-ISO linetypes from the
  `LinetypeRegistry` SSoT (`resolveLinetype`), skipping ISO baseline (`isIsoBaselineLinetype`) — no
  new table (mirrors `collectDimStylesForExport`).

### Στάδιο 2 Φ2.2 (DONE) — auto version-driven text encoding (max automation, zero data-loss)

Goal (Giorgio): the most professional, "just works" behaviour — the user never gets a broken export,
with maximum automation and minimum intervention. The DXF **version dropdown already existed** in the
export dialog (built ahead of the roadmap note), so Φ2.2 is purely the **encoding** behind it — no new
UI, no encoding toggle.

- **Default = R2018 (AC1032)** — `DEFAULT_DXF_VERSION` bumped from AC1015, mirroring AutoCAD «Save As»
  (defaults to latest). A modern UTF-8 file opens correctly everywhere with Greek intact and zero
  codepage ambiguity → the safe "everything correct" default for the 99% case.
- **Encoding is 100% auto-derived from the version** (`versionToEncoding` in `dxf-export-adapter.ts`):
  pre-Unicode releases (AC1009/AC1015/AC1018 = R12–2004) → `cp1253`, 2007+ → `utf-8`. Set on
  `settings.encoding` in `buildDxfExportRequest`. The user only ever picks a version.
- **Real Windows-1253 byte encoding** (`EncodingService.encodeWindows1253`, `io/encoding-service.ts`) —
  the exact **inverse** of `decodeWindows1253`, built ONCE from the SAME `WINDOWS_1253_TO_UNICODE`
  table (no second table). `renderDxfBlob` re-encodes the whole DXF string to Windows-1253 bytes when
  `encoding === 'cp1253'` (ASCII structure 1:1, Greek → single codepage bytes) → the file matches its
  own `$DWGCODEPAGE=ANSI_1253` and opens in legacy AutoCAD/Tekton. `resolveUnicodeSafeAcadVer` now
  **honors** the pre-Unicode version as-is (no bump, since bytes are real cp1253).
- **Zero data-loss escaping:** characters outside Windows-1253 (exotic symbols/CJK — never Greek/Latin)
  are emitted as a lossless `\U+XXXX` DXF unicode escape (which Nestor's own MTEXT importer,
  `text-engine/parser/mtext-tokenizer`, round-trips) instead of a lossy `?`. Astral-plane (> 0xFFFF)
  falls back to `?` (no 4-hex escape).
- **Resolved in Φ2.3:** `\U+XXXX` as a general MTEXT escape needs **no extra code** — the Φ2.2 whole-file
  byte-encode already applies it to MTEXT content (cp1253 path: Greek→bytes, out-of-codepage→`\U+`), and
  the UTF-8 path (2007+) writes non-ASCII verbatim. See Φ2.3 below.

### Στάδιο 2 Φ2.3 (DONE) — real MTEXT + TEXT justification + richer HEADER

The writer previously routed **both** `text` and `mtext` through the same single-line `emitText` →
MTEXT lost its line breaks + attachment, and TEXT lost its alignment (72/73 were emitted **only** for
centred dimension-block text). Φ2.3 makes the AutoCAD path emit real MTEXT and honour justification,
reusing the app's existing text SSoTs — **zero new serializer/escaper/alignment table**.

- **`export/core/dxf-ascii-text-writer.ts`** (new, file-size SRP split — mirror of the HATCH/TABLES
  writers; the writer would otherwise exceed 500 lines). Holds:
  - `emitText(..., align?)` — single-line `TEXT` with optional H/V justification (72/73 + the 11/21
    alignment point the DXF spec requires). No `align` (or left+baseline) → **byte-identical** legacy
    output. The centred dimension-block text passes `align:{h:1,v:2}` → identical to the old `centered`
    flag.
  - `emitMText(e, …, version)` — real `MTEXT` (`0/MTEXT`, `10/20/30`, `40` char height, `41` reference
    width, `71` attachment, `50` rotation, `1` content). The content string — inline `\P` line breaks +
    `\`/`{`/`}` escaping — comes from the **SSoT serializer `serializeDxfTextNode`** (`text-engine/
    serializer/mtext-serializer.ts`), version-gated (R12 → plain-TEXT downgrade). Node source =
    `ensureTextNode(e)` (`text-engine/edit/ensure-text-node.ts`). This is the serializer's intended
    reuse — it had **no** production caller before.
- **Inverse alignment maps (co-located with the forward import maps, no new table):**
  `alignmentToHJust` in `utils/dxf-converter-helpers.ts` (beside `mapHorizontalAlignment`);
  `attachmentToMTextCode` + `attachmentToVJust` in `utils/dxf-text-converters.ts` (beside
  `MTEXT_ATTACHMENT_MAP`). `alignFromTextEntity` reads H from `entity.alignment` and V **only** from an
  explicit `textNode.attachment` (never the `ensureTextNode` fallback — that would fabricate a
  middle-left attachment and shift every legacy TEXT).
- **`export/core/dxf-ascii-writer.ts`** — `case 'text'`/`'mtext'` split. `explode` (Tekton) keeps the
  historic single-line, alignment-less TEXT for **both** (its minimal parser reads only LINE/TEXT/
  CIRCLE); the AutoCAD path gets justified TEXT / real MTEXT. Version derived once via
  `parseDocumentVersion(acadVer)` (default R2018). New gated `DxfWriteOptions.{extMin, extMax,
  measurement, ltscale, lunits}` emit `$EXTMIN`/`$EXTMAX` (10/20/30) + `$MEASUREMENT`/`$LTSCALE`/
  `$LUNITS` inside the same HEADER switch (bare/Tekton unaffected). Writer 498 lines (< 500 via split).
- **`export/formats/dxf-export-adapter.ts`** — `renderDxfBlob` computes drawing extents via the
  canonical `calculateTightBounds` SSoT (no local bounds math) × the coordinate scale
  (`computeScaledExtents`), passing `extMin/extMax` + `measurement:1`(metric)/`ltscale:1`/`lunits:2`
  (decimal) **only** on the AutoCAD path. Degenerate/empty (and the `DEFAULT_BOUNDS` 0,0→100,100
  sentinel `calculateTightBounds` returns for uncomputable scenes) → `undefined` → the writer omits the
  extents (no bogus 100×100 zoom-extents box).

**Known limitation (pre-existing import defect, deferred to Φ2.4):** the basic import
`convertMText → buildTextNodeFromFlat` stores the raw group-1 string (including raw `\P`) in a **single
run**. Re-serialising such a node double-escapes existing inline codes (`\P` → `\\P`). This is an
**import**-side defect (the rich `mtext-tokenizer` must feed the entity `textNode`), out of scope for an
export phase; net result is neutral-to-better vs the old single-line TEXT (which also emitted the raw
string). Well-formed nodes (rich toolbar / AI-created / commands) export correctly.

## Tests
- `export/core/__tests__/dxf-ascii-writer.test.ts` — HEADER emitted (order + exact group codes) when
  options given; still bare when not.
- `export/formats/__tests__/dxf-export-adapter.test.ts` — `resolveUnicodeSafeAcadVer` (pre-Unicode +
  utf-8 → AC1021; Unicode/ non-utf-8 kept), `encodingToCodepage`, non-empty Blob.
- End-to-end (throwaway, verified & removed): full adapter path emits
  `HEADER $ACADVER=AC1021 / $INSUNITS=6 / $DWGCODEPAGE=ANSI_1252` before `ENTITIES`, Greek intact.

## Changelog
- **2026-07-11 — Στάδιο 1:** professional HEADER ($ACADVER Unicode-safe bump + $INSUNITS + $DWGCODEPAGE)
  in `dxf-ascii-writer` (gated) + `dxf-export-adapter` resolvers, reusing `DXF_UNIT_VALUES`. Fixes Greek
  garbling in AutoCAD 2007+ and unit ambiguity on re-import. jscpd clean.
- **2026-07-11 — Στάδιο 2 Φ2.1:** wired the existing `writeLayerTable` SSoT into the production export
  as a real `TABLES → LAYER` section. Extracted `emitLayerTableBody` (byte-identical `writeLayerTable`);
  new split `dxf-ascii-tables-writer.ts` (`emitTablesSection`) unifies LTYPE+LAYER+DIMSTYLE into ONE
  correctly-ordered TABLES section (fixes latent double-TABLES); adapter feeds
  `tableLayers`/`customLinetypes` (AutoCAD path only, Tekton stays minimal) via `LinetypeRegistry` SSoT.
  Gated (bare/Tekton unchanged), inline `62` kept. 87 jest green (incl. byte-identical round-trip proof);
  E2E verified (HEADER + single TABLES[LTYPE/LAYER] + ENTITIES, Greek layer name intact). jscpd clean.
  Writer 484 lines (< 500 via split).
- **2026-07-11 — Στάδιο 2 Φ2.2:** auto version-driven text encoding. `DEFAULT_DXF_VERSION` → AC1032
  (R2018, AutoCAD-style latest default, UTF-8). New `EncodingService.encodeWindows1253` (inverts the
  existing 1253 table — no second table) + `versionToEncoding` (pre-Unicode → cp1253, 2007+ → utf-8),
  set on `settings.encoding` in `buildDxfExportRequest`; `renderDxfBlob` re-encodes to Windows-1253
  bytes for cp1253 (else UTF-8 Blob). Out-of-codepage chars → lossless `\U+XXXX` escape (not `?`).
  Encoding fully automatic — no encoding UI (version dropdown already existed). 97 jest green (6 new
  encoding-service + adapter); E2E: cp1253 blob round-trips lossless, keeps AC1015 (no bump), ANSI_1253,
  Greek intact. jscpd clean.
- **2026-07-11 — Στάδιο 2 Φ2.3:** real MTEXT (`\P`/71/40/41/50) + TEXT justification (72/73/11/21) +
  richer HEADER (`$EXTMIN`/`$EXTMAX`/`$MEASUREMENT`/`$LTSCALE`/`$LUNITS`). New file-size split
  `dxf-ascii-text-writer.ts` (`emitText` + new `emitMText`) reusing the SSoT `serializeDxfTextNode`
  (its first production caller) + `ensureTextNode`; inverse alignment helpers co-located with the
  forward import maps (`alignmentToHJust`, `attachmentToMTextCode`, `attachmentToVJust`) — no new table.
  Adapter derives extents from the canonical `calculateTightBounds` SSoT (DEFAULT_BOUNDS-sentinel
  guarded). Gated: bare/Tekton (`lines`) + left-baseline TEXT stay byte-identical; MTEXT only on the
  AutoCAD path. `\U+` MTEXT escape needed no new code (covered by the Φ2.2 byte-encode). 86 writer+
  adapter jest green (18 new). Writer 498 lines (< 500). Known limitation: basic-import MTEXT nodes hold
  raw inline codes in one run → re-export double-escapes (import-side defect, deferred to Φ2.4).
  **Note:** the `computeScaledExtents` DEFAULT_BOUNDS-sentinel guard is an uncommitted follow-up on top
  of commits `edefe56a`/`d5de7136` (which landed the rest of Φ2.3).
- **2026-07-11 — Στάδιο 2 Φ2.4 (D.1) — POINT export round-trip (ADR-635 C.1 parity):** ο `writeEntity`
  switch skip-άριζε το POINT (`default: break`) → τα imported points χάνονταν στο export. Νέο `emitPoint`
  helper (mirror `emitCircle`: `0 POINT / 10·s / 20·s / 30 0 / 8 / 62`) + `case 'point'`. Το glyph είναι
  **drawing-wide HEADER sysvar** (όχι per-POINT): νέα `DxfWriteOptions.pdmode/pdsize` → `$PDMODE`(70)/
  `$PDSIZE`(40) στο HEADER block (ίδιο gate). Ο adapter `resolvePointDisplayForExport(entities, scale)`
  διαβάζει τα baked `pdMode/pdSize` από το πρώτο point (drawing-wide → κοινά)· `$PDSIZE>0` pre-scaled σε
  output units (**mirror του extMin/extMax** — adapter pre-scales, writer emits raw), viewport-% ≤0 raw·
  gated στο AutoCAD path (empty object → bare Tekton envelope αμετάβλητο). Round-trips την C.1 import.
  9 νέα tests (`dxf-roundtrip-point.test.ts`: writer emit + scale + convertPoint round-trip + HEADER +
  adapter derivation), **151 export/core + 19 adapter jest green**, jscpd clean. ΟΧΙ browser-verified.
- **2026-07-11 — Στάδιο 2 Φ2.4 (D.6) — linetype/lineweight/CELTSCALE export round-trip (ADR-635 C.3/C.4 parity):**
  οι entity emitters έγραφαν ΜΟΝΟ `62`(color)+`8`(layer) → η per-entity STYLE (group **6** linetype name /
  **48** CELTSCALE / **370** lineweight) που διαβάζει το import χανόταν στο export. Νέος **κεντρικός** helper
  `emitEntityStyle(pair, style)` (στο `dxf-ascii-primitive-emitters.ts`) = ΑΚΡΙΒΕΣ inverse των import extractors
  (`extractEntityLinetype`/`extractEntityLtscale`/`extractEntityLineweight`), gated concrete-only και reuse του
  ISO-catalog `encodeDxfCode370` SSoT (ΟΧΙ νέος πίνακας 370). Placement: single-header entities
  (line/circle/arc/text/mtext/point) → append μετά το switch μέσω `STYLE_APPEND_TYPES` Set (valid: τα pairs
  δένουν στο entity μέχρι το επόμενο `0`)· POLYLINE/rectangle → STYLE στο header μέσω νέου optional `emitPath`
  param (ΠΡΙΝ τα VERTEX/SEQEND). Gated στο AutoCAD path (Tekton `explode` μένει **byte-identical** — ο minimal
  parser του αγνοεί έτσι κι αλλιώς τα codes). HATCH/DIMENSION εκτός scope (DIMSTYLE path). Καμία αλλαγή σε
  υπάρχον emitter signature πλην του additive `emitPath` param → μηδέν sibling-clone (N.0.2). 10 νέα tests
  (`dxf-roundtrip-linetype-lineweight.test.ts`: LINE/CIRCLE/POLYLINE emit + reverse-symmetry με τους ίδιους
  import extractors + gating absent/ByLayer-sentinel/ltscale-1/explode), **150 export/core + 55 adapter/import
  jest green**, jscpd clean. ΟΧΙ browser-verified.
