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

### Στάδιο 2 (roadmap) — full version-driven encoding + tables

- **Version selector UI** (AutoCAD «Save As»: R12 / 2000 / 2007 / 2018) in the export dialog.
- **Per-version text encoding**: for R12–2004, encode TEXT bytes as **Windows-1253** and set
  `$DWGCODEPAGE=ANSI_1253` (mixed-encoding Blob); `\U+XXXX` escapes as a version-independent fallback
  (MTEXT-safe). Reuse the `cp1253` byte table already in `io/encoding-service.ts` (no second table).
- **`TABLES → LAYER`** section (real layer definitions with ACI/true-colour) instead of inline-only 62.
- **`$ACADVER`/`$HANDSEED`/`$MEASUREMENT`** and a fuller HEADER for stricter readers.
- MTEXT round-trip (currently MTEXT → single-line TEXT), TEXT alignment (72/73/11/21) preservation.

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
