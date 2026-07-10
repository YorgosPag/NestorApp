# ADR-622: Structural detail-sheet SSoT — schedule table + field block + sheet assembly + 3D capture

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of the tabular + 3D-capture families in `src/subapps/dxf-viewer/bim/structural/detail-sheet/` (the beam/column/footing/slab reinforcement detail sheets, ADR-457/463/471/476). The four steel-schedule builders, the four title-block builders, the four model orchestrators, and the four offscreen 3D captures each hand-rolled the same skeleton. Collapsed onto a **schedule-table SSoT**, a **field-block SSoT**, a **sheet-assembly envelope**, and one generic **`captureDetail3d`** flow — every `build*`/`capture*` keeps its **identical public API**.

**Related:**
- **ADR-457/463/471/476** — the column / footing / beam / slab reinforcement detail sheets whose builders this consolidates (all version-specific geometry/quantity logic preserved verbatim in the thin callers).
- **ADR-462** — the prism footprint scaling (canvas units → world metres) preserved in the migrated column capture.
- **ADR-537** — `finiteBox3FromObject` (NaN-safe bounds) now called inside the shared capture core.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to **zero** across all touched src files (four residual twins folded into wrappers).
- **ADR-605…621** — the same multi-day jscpd sweep; ADR-622 extends it into `bim/structural/detail-sheet` (cluster #13). Scope agreed with Giorgio = tabular + 3D (the per-type plan/section/elevation geometry is deferred).

---

## Context

A real SSoT audit (full reads of all four schedule / title-block / sheet builders + the five 3D-capture files + the existing `detail-3d-capture-core`, plus a fresh jscpd pass listing **58 intra-dir clone pairs / 778 cloned lines / 21 files**) grouped the clones into four coherent families:

1. **Schedules** (~130 cloned lines, 4 files) — `beam` / `footing` / `slab` share a byte-identical 4-column table skeleton (pad/row/text/rule constants, `cell` / `rule` / `pushRow`, `fmt1`, and the header → data rows → total → ratio-footer layout); `column` is the same skeleton with a 5th column (Ø / n) and a second footer (confinement α). Only the reinforcement source + which rows are emitted vary.
2. **Title blocks** (~70 cloned lines, 4 files) — identical «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» field-list skeleton (constants, `FieldRow`, `fieldText`, the `round` mm formatter, and the label-left / value-right row loop); only the emitted `FieldRow[]` varies.
3. **Sheet orchestrators** (~55 cloned lines, 4 files) — identical layout-resolve preamble + the 5-region assembly (`elevation`, `plan`, `schedule`, `perspective`, `title-block`) + the paper/size return envelope; only the per-region builders vary.
4. **3D captures** (~150 cloned lines, 5 files) — `column` still carried inline copies of the camera / prism / dispose helpers that already lived in `detail-3d-capture-core` (a documented pending-ratchet «migrate on-touch»); `beam` / `footing` / `slab` shared a bbox-dimension helper + the whole assemble-scene → frame → render → project → dispose flow.

---

## Decision

Big-player layering (Revit / Tekla expose a table primitive + a sheet assembler + a capture pipeline; per-member code only supplies data), applied per family. All `build*ScheduleRegion` / `build*TitleBlockRegion` / `build*DetailSheet` / `capture*Detail3d` names, signatures, and Result/Capture types are preserved; the only internal change is the sheet orchestrators taking a `buildRegions` callback (the renderer of the model is the sole caller).

### 1. `detail-sheet-schedule-table.ts` — steel-schedule SSoT (family 1)
- **`buildScheduleTable({ region, columns, header, rows, total, footers })`** owns the whole table layout; `ScheduleColumn { frac, align }` expresses both the 4-column (`REINFORCEMENT_SCHEDULE_COLUMNS`) and the column-specific 5-column layouts. **`buildReinforcementSchedule(region, labels, rows, totalWeight, ratio)`** wraps the shared 4-column header/total/ratio for beam/footing/slab. Shared `fmt1`.

### 2. `detail-sheet-field-block.ts` — title-block SSoT (family 2)
- **`buildFieldBlock(region, rows)`** lays out the label-left / value-right field list; `FieldRow` + `roundMm` shared. Each title block now formats its `FieldRow[]` and calls it.

### 3. `detail-sheet-assemble.ts` — sheet-assembly SSoT (family 3)
- **`assembleDetailSheet(layoutInput, buildRegions)`** resolves the layout (default A3 landscape) and wraps the paper/size envelope. **`standardSheetRegions(regions, content)`** builds the fixed 5-region array — captioned elevation/plan as `RegionContent`, the caption-less schedule/perspective/title-block titled from the shared `labels` and drawn straight from their builder result.

### 4. `detail-3d-capture-core.ts` — 3D-capture SSoT (family 4)
- **`captureDetail3d({ cage, prism }, w, h, project)`** owns the assemble-scene → `finiteBox3FromObject` → `frameCamera` → `renderSceneToDataUrl` → project-annotations → dispose flow (prism fully, cage geometry only). **`bboxDimSpecs`** + **`projectDims`** / **`projectMarks`** are the shared annotation helpers. The capture result types (`Detail3dCapture`, `ProjectedDim`, `ProjectedMark`, `NormPoint`) live here; `column-detail-3d-capture` re-exports them (as `ColumnDetail3dCapture` etc.) so external consumers are untouched. `column` now imports the core scaffolding (its inline copies deleted); `beam` / `footing` / `slab` are thin (build cage + prism + bbox dims → `captureDetail3d`).

---

## Consequences

**Positive**
- **Detail-sheet dir: 58 clone pairs / 778 lines → 18 pairs / 195 lines** (the four targeted families eliminated; the remainder is the out-of-scope plan/section/elevation geometry + cross-dir incidentals + a pre-existing design-summary↔table pair). Full-scan **−80 clones** across the cluster #12+#13 window (3494 → 3414); **zero** new sibling clones (`jscpd:diff` clean on all 20 touched src files, iterated down through the sheet-assembly + reinforcement-schedule wrappers).
- One table primitive, one field block, one sheet assembler, and one capture pipeline now back every structural detail sheet; `column-detail-3d-capture` shrank 254 → ~90 lines (the documented pending-ratchet inline-copy migration is done).
- All 16 pre-existing detail-sheet suites green — **88/88** (schedule / title-block / sheet / dims / marks / perspective / pdf-renderer parity).

**Negative / risk**
- The offscreen 3D-capture functions have no direct WebGL unit test; parity for those four rests on the mechanical extraction (identical scaffolding moved to core + the byte-preserved dim/mark projection), verified by reading + `jscpd:diff`, not jest. The dims/marks spec helpers they feed (`computeColumnDimSpecs3d` / `-BarMarkSpecs3d`) remain unit-tested.
- The sheet orchestrators now build regions inside an `assembleDetailSheet` callback rather than inline — an internal control-flow change; the model output is asserted unchanged by the beam/footing/slab/column sheet tests.

**Baseline note (shared tree):** `.jscpd-baseline.json` was **NOT** relocked — the working tree carries other agents' uncommitted work, so the absolute count conflates. CHECK 3.28 passes as-is (3414 ≤ baseline 3494); Giorgio re-runs `npm run jscpd:baseline` after committing to lock the true post-commit floor.

---

## Changelog
- **2026-07-10** — Initial. De-duplicated the tabular + 3D-capture families of `bim/structural/detail-sheet/` (jscpd cluster #13) into four SSoT modules: `detail-sheet-schedule-table` (`buildScheduleTable` + `buildReinforcementSchedule`), `detail-sheet-field-block` (`buildFieldBlock`), `detail-sheet-assemble` (`assembleDetailSheet` + `standardSheetRegions`), and the extended `render/detail-3d-capture-core` (`captureDetail3d` + `bboxDimSpecs` + `projectDims`/`projectMarks`). Column 3D capture migrated onto the core (254→~90 L). Detail-sheet clones 58→18 pairs; full-scan 3447→3414. 88/88 detail-sheet suites green.
