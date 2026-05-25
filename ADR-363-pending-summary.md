# ADR-363 BIM Drawing Mode — Πόρισμα Εκκρεμών Φάσεων
_Ημερομηνία ανάλυσης: 2026-05-19_
_Ενημέρωση 2026-05-20: Μεγάλη διόρθωση — πολλά "pending" items ήταν ήδη DONE στον κώδικα. Verified από ADR-363 checklist._
_Ενημέρωση 2026-05-20 (2η): Phase 3.7b+ multi-storey stack DONE (commit a14cef17). pending-summary stale entry διορθώθηκε._
_Ενημέρωση 2026-05-21 (3η): Phase 6.5 (A/B/C), Phase 7 (7.1 + 7.2), Phase 8 marked DONE. Πραγματικά εκκρεμή ADR-363: **μηδέν**. Όλα verified από κώδικα + ADR-363 §6.5/§7.1/§7.2/§8 checklists._

_Ενημέρωση 2026-05-25 (4η): Νέα sub-track **Phase 8 Column Shapes** (επέκταση `ColumnKind` 4→7 με polygon/shear-wall/I-shape). Phases A+B+C+D ✅ ΥΛΟΠΟΙΗΜΕΝΑ 2026-05-25 (pending commit chain). Phase E = closure verification (manual E2E σε /dxf/viewer + commit chain)._

---

## Ολοκληρωμένες Φάσεις ✅

| Φάση | Περιγραφή |
|------|-----------|
| 0, 0.5 | Doc sync + stair SSoT verification (2026-05-20) |
| 1, 1A, 1B, 1C | Wall core + types + tool + Firestore + ribbon |
| 1D-A, 1D-B, 1D-C, 1D-D, 1E | WallDna Editor + AutoTrim + EntityAudit + BOQ feed + Delete |
| 2, 2.5 | Opening core + Advanced Editing |
| 2 deferred | Wall split mid-opening + cascade delete UX + shortcuts D/Wn (2026-05-19) |
| 3, 3.5, 3.6, 3.7, 3.7a | Slab core + grips + polish + slab-opening + grips |
| 4, 4.5, 4.5b, 4.5c.1–6, 4.5d | Column core + grips + variants + hatch + ghost snap + section-profile L/T symbol + ribbon |
| 5, 5.5a–5.5i+ | Beam core + grips + width + depth + hatch + auto-snap + all projections + section-profile I/H symbol + column-center snap + beam-slab BOQ deduction |
| 6 | BOQ Auto-Feed core (5 entities) + multi-layer DNA walls + material→ΑΤΟΕ mapping |
| 7A, 7B | Multi-Char BIM Hotkeys (ST/SL/OP/CL/BM) + Single-char D/Wn shortcuts |
| 3.7b, 3.7b+, 3.7b++ | Fire-rating ribbon + multi-storey slab-opening stack + edge-midpoint ghost (commit a14cef17) |
| 6.5.A, 6.5.B, 6.5.C | BIM Material Library — `MaterialLibraryService` (3-scope) + seed script + "Υλικά" 5η panel tab + WallDna picker integration (2026-05-20, ADR-363 §6.5 lines 2652-2659) |
| 7.1, 7.2 | Multi-Selection Ribbon (bulk edit 6 props × 7 kinds via CompoundCommand) + Transform BIM (Mirror/Rotate/Copy SSoTs + L/T flipY handedness) (2026-05-19, ADR-363 lines 2238/2308) |
| 8 | Schedule Export — `BimScheduleExporter` + CSV/xlsx/PDF + filterable UI + Region pick FSM + Ribbon Ανάλυση tab + 81 tests (2026-05-19, ADR-363 §Phase 8 line 2398) |
| 8 Column Shapes A | Phase 8 sub-track — types + geometry + section profile + completion για polygon/shear-wall/I-shape (2026-05-25, ADR-363 §12 changelog) |
| 8 Column Shapes B | Validator + ColumnRenderer +3 kind colors + drawPolygonSideLabel + drawIShapeLabels + column-hatch-patterns diagonal-line zero-line bugfix (2026-05-25) |
| 8 Column Shapes C | column-anchors polygon branch + polygonBboxMm SSoT + column-grips dispatcher (polygon 3 / I-shape 6 / shear-wall 4 grips) + column-variant-grips materializeIshape + useGripDimAnnotation +2 cases. 635/635 column subtree PASS (2026-05-25) |
| 8 Column Shapes D | Ribbon kind selector 4→7 + conditional polygon/I-shape numeric input panels (visibilityKey pattern) + columnToolBridgeStore single-writer + drawing-mode synthetic resolver + useRibbonColumnBridge NESTED_NUMBER_KEY_TO_PATH + getPanelVisibility. 18 bridge + 6 ghost tests added (2026-05-25) |
| 8 Column Shapes E | Section Catalog Presets (Revit-style): section-catalog.ts SSoT (5 Eurocode 2 RC + 10 EN 10025-2 IPE/HEA) + column-bridge-catalog-helpers.ts + ColumnParams.catalogProfile persist + 2 visibility-gated catalog ribbon panels + useRibbonColumnBridge catalog batch-write + Custom sentinel on manual edit. TSC PASS. 23/23 tests (2026-05-25) |
| 8 Column Shapes F | Permanent dimension pill labels (Revit-style): canvas-pill.ts SSOT (pillPath + 5 constants, N.0.2 fix) + column-dim-labels.ts (formatColumnDimLabels 7 kinds + catalogProfile prefix + drawColumnDimPill centred multi-line) + ColumnRenderer.drawCenterDimLabel() (highlighted\|\|selected) + useGripDimAnnotation imports canvas-pill SSOT. 18/18 tests (2026-05-25) |

---

## Εκκρεμείς Φάσεις ❌
_Πραγματικά εκκρεμή: μηδέν. Όλες οι παρακάτω εμφανίζονται strikethrough — διατηρούνται για audit trail._

### Phase 3.7b/3.7b+/3.7b++ — ✅ DONE (commit a14cef17, 2026-05-20)
- [x] ~~Fire-rating ribbon~~ — fireRating combobox (60/90/120/none)
- [x] ~~Multi-storey stack group UI~~ — `SlabOpeningStackHost` + `SlabOpeningStackDialog` + `slab-opening-stack.ts` + ribbon `copyToFloors`
- [x] ~~Snap-to-edge-midpoint preview ghost~~ — `useSlabOpeningGhostPreview` + `SlabOpeningGhostRenderer`, ADR-040 compliant
- Material ribbon field → deferred to Phase 6.5 (not pending)

---

### Phase 4.5e+ — Material Pickers activation — ✅ DONE (2026-05-20/21)
_(Deferred from Phase 4.5d — ribbon buttons exist, pickers disabled/comingSoon)_
- [x] Wall material picker — ENABLED (wall-hatch-patterns.ts SSoT + drawMaterialHatch + bridge wiring)
- [x] Slab material picker — ENABLED (slab-command-keys + useRibbonSlabBridge + contextual-slab-tab)
- [x] Beam material picker — WAS ALREADY ENABLED (Phase 5.5c, not comingSoon)
- [x] Tab/Shift+Tab cycling — `useBimMaterialCycler.ts` (2026-05-21): wall/slab/beam/column, toolStateStore guard, undoable UpdateXParamsCommand

---

### Phase 5.5j — ✅ DONE (2026-05-20/21)
- [x] H-beam variant (`sectionType='H'`, `SECTION_H_FLANGE_T_PX=9`, `computeHProfileOutline()`)
- [x] `profileDesignation` canvas label (screen-space, horizontal, 14 ribbon presets)
- [x] Scale-adaptive symbol size — `symW = clamp(beamWidthPx * 0.35, [12,50]px)`, all sub-dims proportional (2026-05-21)
- [x] Anchor highlight pulse animation — `drawAnchorPulse()`, sin-modulated α @ 1.2Hz, `performance.now()` (2026-05-21)

---

### Phase 2 leftover (~1-2h)
- [x] ~~Polyline/curved host wall positioning~~ **✅ DONE (2026-05-20)** — `getWallAxisVertices` + `walkPolylineToDistance` + `projectPointToPolylineOffset` + arc-length in coordinator. 11 tests. Pre-existing test bug fixed.

---

### Phase 6.5 — Custom Material Library Editor — ✅ DONE (2026-05-20)
_Ref: ADR-363 §6.5 (lines 2652-2659)._
- [x] ~~25 seeded materials~~ — `bim/data/system-materials-seed.ts` + `scripts/seed-bim-materials.ts` (Phase 6.5.A)
- [x] ~~Material library editor UI~~ — `MaterialsLibraryPanel.tsx` + `MaterialEditorDialog.tsx` + `useMaterialLibrary.ts` 5η panel tab (Phase 6.5.B)
- [x] ~~Gates: wall/slab/beam material pickers~~ — WallDna integration via `useDnaMaterialOptions.ts` + `MaterialPicker` <optgroup> "Βιβλιοθήκη Υλικών"/"Προεπιλεγμένα" (Phase 6.5.C)

---

### Phase 7 — Multi-Element Selection & Bulk Edit — ✅ DONE (2026-05-19)
_Ref: ADR-363 §Phase 7.1 (line 2238) + §Phase 7.2 (line 2308). Split into 7.1 (Selection Core) + 7.2 (Transform BIM)._
- [x] ~~Selection rubber-band extension για BIM entities~~ — `bim/utils/bim-bounds.ts` `calculateBimEntity2DBounds()` (Phase 7.1, 13 tests)
- [x] ~~Multi-select panel (common-denominator bulk edit)~~ — `bim-common-properties.ts` (6 props × 7 kinds) + `bim-bulk-update-builder.ts` (CompoundCommand) + `useMultiSelectionRibbonBridge.ts` + 2 panels (Common + Filter), 62 tests
- [x] ~~Mirror/rotate/copy semantics για BIM entities~~ — `bim/transforms/bim-{mirror,rotate,copy}-{geometry,builder}.ts` SSoTs + L/T arm `flipY` handedness fix
- [x] ~~Group operations (move walls + hosted openings as unit)~~ — `bim/cascade/bim-cascade-resolver.ts` + `useMoveTool`/`useSmartDelete` slab→slab-opening cascade

---

### Phase 8 — Schedule Export — ✅ DONE (2026-05-19)
_Ref: ADR-363 §Phase 8 (line 2398), 81 tests passing, SSoT module `bim-schedule` (Tier 3)._
- [x] ~~`BimScheduleExporter` (table per entity type + combined)~~ — `bim/schedule/schedule-builder.ts` + 8 presets (door/window/wall/slab/column/beam/stair/slab-opening + combined)
- [x] ~~CSV export~~ — `bim/schedule/exporters/csv-exporter.ts` (UTF-8 BOM, RFC 4180)
- [x] ~~Excel (xlsx) export~~ — `bim/schedule/exporters/xlsx-exporter.ts` (ExcelJS, styled headers, numFmt)
- [x] ~~PDF export~~ — `bim/schedule/exporters/pdf-exporter.ts` (jsPDF + autotable + Greek fonts)
- [x] ~~Filterable schedule UI (per floor, per category, region, selection)~~ — `BimScheduleDialog.tsx` + `ScheduleFilterBar.tsx` + `SchedulePreviewTable.tsx` + `ScheduleFormatPicker.tsx` + Ribbon "Ανάλυση" tab
- [x] ~~Sample "Πίνακας Κουφωμάτων" door schedule~~ — covered by door preset + i18n namespace `dxf-schedule` (37 keys, el + en, ICU `{count}`)

---

### Phase 9+ — OUT OF SCOPE (δεν υλοποιούνται στο ADR-363)
- 3D viewer (Three.js port from genarc) → ADR-366
- IFC export
- MEP entities
- Real-time clash detection

---

## Σύνοψη

| Κατηγορία | Items | Εκτίμηση |
|-----------|-------|----------|
| ~~Phase 4.5e+ (Tab cycling material pickers)~~ | ~~1~~ | ~~✅ DONE~~ |
| ~~Phase 5.5j extras (beam polish)~~ | ~~2~~ | ~~✅ DONE~~ |
| ~~Phase 6.5 (material library editor)~~ | ~~~5~~ | ~~✅ DONE~~ |
| ~~Phase 7 (multi-select)~~ | ~~4~~ | ~~✅ DONE~~ |
| ~~Phase 8 (schedule export)~~ | ~~6~~ | ~~✅ DONE~~ |
| **ΣΥΝΟΛΟ ΕΚΚΡΕΜΩΝ** | **0 items** | **0h** |

🎉 **Όλες οι Phases του ADR-363 (Phase 0 → Phase 8) ολοκληρώθηκαν.** Επόμενα βήματα είναι Phase 9+ (Out of Scope του παρόντος ADR — βλ. ADR-366 για 3D viewer port).

---

## Κρίσιμα αρχεία

- `src/subapps/dxf-viewer/bim/` — κεντρικό BIM directory
- `src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts` — BOQ bridge SSoT
- `src/subapps/dxf-viewer/bim/types/` — BIM types
- `src/subapps/dxf-viewer/canvas-v2/rendering/bim/` — renderers
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` — master ADR
