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
- **Φ2.3 (roadmap)** — `$MEASUREMENT`/`$EXTMIN`/`$EXTMAX`/`$LTSCALE` HEADER+, MTEXT round-trip
  (currently MTEXT → single-line TEXT), TEXT alignment (72/73/11/21) preservation.
- **Φ2.4 (roadmap)** — `TEXTSTYLE` table, import Φ3 skipped-warning.

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
- **Deferred to Φ2.3:** `\U+XXXX` as a general MTEXT escape belongs with real MTEXT emission (currently
  MTEXT → single-line TEXT). For Φ2.2 all Greek fits cp1253, so no escaping is needed for Greek content.

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
