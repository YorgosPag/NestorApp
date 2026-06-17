# HANDOFF — ADR-471 Unified Member Reinforcement (κολόνα+δοκάρι) → Slices 4-6

**Ημερομηνία:** 2026-06-17 · **Μοντέλο:** Opus 4.8 · **Κατάσταση tree:** UNCOMMITTED, **shared με άλλον agent** (git add ΜΟΝΟ τα δικά σου αρχεία). **COMMIT/PUSH τα κάνει ο Giorgio — ΟΧΙ εσύ.**

---

## 🎯 Στόχος ADR-471

Ενοποίηση οπλισμού/auto-reinforce/προβολών σε **member-agnostic SSoT facade** + **πλήρης Revit-grade οπλισμός δοκού** στο επίπεδο της κολόνας. Κοινό facade/δρομολόγηση, **ΟΧΙ** refactor των column engines (η κολόνα μένει intact σε production).

📄 **Πλήρες spec:** `docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md` (§2 facade, §3 beam spec, §5 slices). **ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΟ.**

---

## ✅ Τι έγινε (Slices 0-3, DONE, UNCOMMITTED)

- **Slice 0:** ADR-471 + adr-index + γραμμή ΕΚΚΡΕΜΟΤΗΤΕΣ.
- **Slice 1 (reinforcement engine + auto):** `bim/structural/reinforcement/beam-rebar-layout.ts` (`resolveBeamRebarLayout` → `BeamRebarLayout` σε beam-local mm) + `BeamReinforcement += auto?` + `resolveActiveBeamReinforcement(ForEntity)` + `buildReinforcePatch` beam parity.
- **Slice 2 (2Δ):** NEW geometry SSoT `bim/geometry/shared/polyline-frame.ts` (`samplePolylineFrame` → point+tangent+normal σε arc-length· `world(u,v)=point+v·normal`) + NEW `bim/renderers/beam-rebar-2d.ts` (`drawBeamRebar2D`). `drawColumnReinforcement2D`→**`drawMemberReinforcement2D`** (dispatch ανά `entity.type`, `dxf-renderer-structural-overlays.ts`) + caller στο `DxfRenderer.ts`. Ghost beam case (`draw-ghost-entity.ts`) → live rebar.
- **Slice 3 (3Δ):** NEW `bim-3d/converters/beam-rebar-3d.ts` (`buildBeamRebarCage`) + NEW `attachBeamRebar` στο `beamToMesh` (`bim-three-structural-converters.ts`).
- **SSoT widening (μη-breaking):** `buildBeamSectionContext`/`resolveActiveBeamReinforcement[ForEntity]` δέχονται `Pick<BeamEntity,'params'|'geometry'>` (περνά το DXF beam wrapper χωρίς cast).
- **Verification:** 19 jest (7 νέα `polyline-frame`) GREEN · 382 structural GREEN · **tsc-clean στα δικά μου** (τα 2 tsc errors στο tree — `dxf-scene-beam-cutback.ts`, `beam-preview-helpers.ts` — είναι **του άλλου agent**, ADR-458 WIP, ΟΧΙ δικά μου).

**Αρχεία μου Slices 0-3 (git add ΜΟΝΟ αυτά):** `beam-rebar-layout.ts`(+test), `beam-reinforcement-types.ts`, `section-context.ts`, `active-reinforcement.ts`, `polyline-frame.ts`(+test), `beam-rebar-2d.ts`, `beam-rebar-3d.ts`, `dxf-renderer-structural-overlays.ts`, `DxfRenderer.ts`, `draw-ghost-entity.ts`, `bim-three-structural-converters.ts`, `ADR-471-*.md`, `ADR-040-*.md`, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

🔴 Τα Slices 0-3 περιμένουν **browser-verify** (δοκάρι → ribbon «Αυτόματος Οπλισμός» → toggle «Οπλισμός» ON → 2Δ διαμήκεις+συνδετήρες & 3Δ κλωβός) + **commit** (Giorgio). Μπορούν να γίνουν commit μαζί με τα 4-6 ή ξεχωριστά — απόφαση Giorgio.

---

## 🔜 ΕΠΟΜΕΝΟ: Slices 4-6 (PDF / UI-panel-ribbon / facade consolidation)

> ⚠️ **N.8 EXECUTION MODE:** Το Slice 4 μόνο = 7+ αρχεία σε domain PDF/detail-sheet· Slice 5 = UI/ribbon domain. **ΜΠΕΣ ΣΕ PLAN MODE** ανά slice (ή ζήτα orchestrator από Giorgio αν κρίνεις 5+ files / 2+ domains μαζί). **ΠΡΑΓΜΑΤΙΚΟ grep SSoT audit ΠΡΙΝ από κάθε νέο αρχείο.**

### Slice 4 — Beam detail-sheet PDF (domain: detail-sheet/PDF)
**Mirror του column + footing detail-sheet (ADR-457 + ADR-463 Slice 6).** Geometry-is-SSoT: ΕΝΑ `DetailSheetModel` (sheet-mm primitives) → Canvas preview ΚΑΙ jsPDF (preview===PDF).

**SSoT προς reuse (μηδέν διπλότυπο — grep πρώτα):**
- `bim/structural/detail-sheet/detail-sheet-types.ts` → `DetailSheetModel` (γρ.151) + `DetailPrimitive`.
- `bim/structural/detail-sheet/detail-sheet-{layout,dim,fit}.ts` — layout grid / διαστάσεις / contain-fit.
- `bim/structural/detail-sheet/render/{detail-canvas-renderer,detail-pdf-renderer,detail-3d-capture-core,detail-raster-decode,detail-raster-fit}.ts` — **κοινά backends, ΜΗΝ τα αγγίξεις**.
- **Κοντινότερος mirror = footing** (πιο πρόσφατο, ADR-463 S6): `footing-detail-{sheet,plan,elevation,schedule,titleblock,design-summary}.ts` + `render/footing-detail-3d-capture.ts`.

**NEW (mirror):** `beam-detail-sheet.ts` (`buildBeamDetailSheet(input): DetailSheetModel`, mirror `buildColumnDetailSheet` column-detail-sheet.ts:57 / `buildFootingDetailSheet` footing-detail-sheet.ts:74) + `beam-detail-{plan,elevation,section,schedule,titleblock}.ts` + `render/beam-detail-3d-capture.ts`.
- Δοκάρι = **longitudinal** → όψη (elevation) κατά μήκος + τομές (section) στα κρίσιμα σημεία (στήριξη/μέσον) + κάτοψη + πίνακας οπλισμού (schedule) + 3Δ capture. Καταναλώνει `resolveBeamRebarLayout` (ίδιο SSoT με 2Δ/3Δ).

**Wiring (mirror):**
- Event: `systems/events/drawing-event-map-bim.ts` → `bim:column-detail-requested`/`bim:foundation-detail-requested` → **NEW `bim:beam-detail-requested`**.
- Host: `ui/components/column-detail/ColumnDetailHost.tsx` + `ui/components/foundation-detail/FoundationDetailHost.tsx` → **NEW BeamDetailHost** (Dialog SSoT = `ui/components/detail-sheet/DetailSheetDialog.tsx` — reuse).
- Lazy register: `app/dxf-viewer-lazy-components.tsx` + `app/DxfViewerDialogs.tsx`.
- Ribbon trigger: `ui/ribbon/data/contextual-column-tab.ts:476` «Λεπτομέρεια Οπλισμού» (icon `column-reinforcement-detail`) → mirror στο `contextual-beam-tab.ts`.
- Bridge emit: `ui/ribbon/hooks/useRibbonColumnBridge.ts` (emits `bim:column-detail-requested`) → **NEW/extend `useRibbonBeamBridge`** (`app/useDxfBimBridges.ts` + `ui/ribbon/hooks/`).

### Slice 5 — Beam properties panel + ribbon structural (domain: UI/ribbon)
**Mirror του column-advanced-panel.**
- `ui/column-advanced-panel/ColumnAdvancedPanel.tsx` + `column-property-fields.ts` (descriptor + `resolveColumnPanelVisibility`) + `useColumnParamsDispatcher` → **NEW `ui/beam-advanced-panel/*`** (descriptor `beam-property-fields.ts` + `useBeamParamsDispatcher` — grep αν υπάρχει ήδη beam dispatcher!).
- Register beam branch στο `ui/bim-properties/BimPropertiesShell.tsx` (`BimPropertiesRouter`). Σήμερα το δοκάρι **ΔΕΝ** είναι registered.
- `ui/ribbon/data/contextual-beam-tab.ts` (υπάρχει ήδη `beam-structural` panel + «Αυτόματος Οπλισμός») → πρόσθεσε structural fields (combos Ø/πλήθος/cover/συνδετήρες + live readouts ρ/βάρος/όγκος μέσω `computeBeamReinforcementQuantities`).
- `BEAM_STRUCTURAL_KEYS` (mirror column keys) + **NEW `beam-structural-bridge.ts`** (mirror `column-structural-bridge.ts` — δεν υπάρχει ακόμα). Wire στο `app/useDxfBimBridges.ts`.

### Slice 6 — Facade consolidation + cleanup
- `resolveActiveMemberReinforcement` (dispatcher κολόνα/δοκάρι) · `attachMemberRebar` (γενίκευση — **ΧΩΡΙΣ** να αγγίξεις το working `attachColumnRebar`/`columnToMesh`· πρόσθεσε thin dispatcher) · `buildMemberDetailSheet` (event/dialog dispatch).
- **REBAR_COLOR SSoT:** σήμερα inline `'#c0392b'` σε `column-rebar-2d.ts` + `beam-rebar-2d.ts` + `0xc0392b` private στο `rebar-3d-shared.ts` → ένα κοινό export.
- **Railing migration (ratchet):** `bim/railings/railing-geometry.ts` private `pointAtDistance`/`angleAtDistance` → delegate στο `polyline-frame.ts` SSoT.
- `.ssot-registry.json` (αν χρειαστεί module).
- Docs/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY.

---

## ⚠️ ΚΑΝΟΝΕΣ (κρίσιμα)
- **SSOT AUDIT (grep) ΠΡΙΝ από κάθε νέο αρχείο** — reuse `DetailSheetModel`/canvas+pdf renderers/3d-capture-core/layout/dim/fit. Μηδέν διπλότυπο.
- **Geometry-is-SSoT:** ΕΝΑ `BeamRebarLayout` (Slice 1) τρέφει 2Δ+3Δ+PDF → καμία απόκλιση. ΜΗΝ ξανα-υπολογίσεις θέσεις στο detail-sheet.
- **ADR-040:** αν αγγίξεις render files (DxfRenderer/structural-overlays/converters) → stage ADR-040 (CHECK 6B/6D). Το Slice 4-5 πιθανότατα ΔΕΝ αγγίζει render files (μόνο PDF/UI).
- **Shared tree:** `git add` ΜΟΝΟ τα δικά σου. **ΟΧΙ commit/push** — ο Giorgio (N.(-1)). Υπάρχουν 2 προϋπάρχοντα tsc errors άλλου agent (`dxf-scene-beam-cutback.ts`, `beam-preview-helpers.ts`) — **ΜΗΝ τα αγγίξεις/«διορθώσεις»**.
- **tsc:** N.17 — ΕΝΑΣ tsc τη φορά, έλεγξε process πρώτα (`Get-CimInstance ... tsc`), τρέξε background.
- **Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.
- Μετά από ΚΑΘΕ slice: update ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-471 changelog + adr-index + MEMORY (N.15), στο ίδιο batch.

---

## 🔍 Verification (Slices 4-6)
- **Jest:** detail-sheet jest (mirror του `__tests__/` column/footing detail) + 382 structural GREEN (μηδέν regression).
- **tsc:** background (N.17).
- **Browser (Firestore-first):** δοκάρι → «Αυτόματος Οπλισμός» → «Λεπτομέρεια Οπλισμού» → PDF (κάτοψη/όψη/τομή/πίνακας/3Δ· preview===PDF) · Properties panel structural readouts (ρ/βάρος/όγκος) · resize με `auto=true` → re-derive. Parity με κολόνα.
