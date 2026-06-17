# HANDOFF — ADR-471 Unified Member Reinforcement (κολόνα+δοκάρι) → Slices 5-6

**Ημερομηνία:** 2026-06-17 · **Μοντέλο:** Opus 4.8 · **Κατάσταση tree:** UNCOMMITTED, **shared με άλλον agent** (git add ΜΟΝΟ τα δικά σου αρχεία). **COMMIT/PUSH τα κάνει ο Giorgio — ΟΧΙ εσύ.** Απάντα ΠΑΝΤΑ στα Ελληνικά.

📄 **Πλήρες spec:** `docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md` (§2 facade, §3 beam spec, §5 slices). **ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΟ** + αυτό το handoff.

---

## ✅ Τι έγινε (Slices 0-4, DONE, UNCOMMITTED)

- **Slices 0-3:** layout engine (`beam-rebar-layout.ts`) + `auto` flag + 2Δ render (`beam-rebar-2d`, `drawMemberReinforcement2D` dispatch) + 3Δ κλωβός (`beam-rebar-3d`, `attachBeamRebar`) + `polyline-frame.ts` SSoT. (βλ. προηγούμενο handoff slice4-6.)
- **Slice 4 (detail-sheet PDF):** πλήρες Revit-grade φύλλο σχεδίου οπλισμού δοκού. **geometry-is-SSoT** (ΕΝΑ `BeamRebarLayout` + `computeBeamReinforcementQuantities` → preview === PDF).
  - **NEW pure builders:** `bim/structural/detail-sheet/beam-detail-elevation.ts` (longitudinal ΟΨΗ — κύρια), `beam-detail-section.ts` (ΔΙΑΤΟΜΗ b×h), `beam-detail-schedule.ts`, `beam-detail-titleblock.ts`, `beam-detail-sheet.ts` (orchestrator), `render/beam-detail-3d-capture.ts`.
  - **NEW SSoT:** `detail-sheet/detail-sheet-spacing.ts` (`groupSpacingZones`/`formatSpacingZoneLabel` — boy-scout extraction· `column-detail-elevation` migrated).
  - **NEW host:** `ui/components/beam-detail/BeamDetailHost.tsx`.
  - **NEW labels:** `detail-sheet-types.ts` += `BeamScheduleLabels`/`BeamTitleBlockLabels`/`BeamDetailSheetLabels`.
  - **Wiring:** event `bim:beam-detail-requested` (`drawing-event-map-bim.ts`) · lazy (`dxf-viewer-lazy-components.tsx`) + mount (`DxfViewerDialogs.tsx`) · ribbon button «Λεπτομέρεια Οπλισμού» στο `beam-structural` panel (`contextual-beam-tab.ts`) · `BEAM_RIBBON_KEYS_ACTIONS.reinforcementDetail` (`beam-command-keys.ts`) + emit (`useRibbonBeamBridge.ts`).
  - **i18n:** `beamDetail.*` + `ribbon.commands.beamEditor.reinforcementDetail[Tooltip]` (el+en).
  - **🚨 ΚΡΙΣΙΜΟ pattern — Dependency Injection:** οι detail-sheet builders είναι **PURE** (μηδέν store import). Ο host (`BeamDetailHost`) resolve-άρει `resolveActiveBeamReinforcementForEntity(beam)` (store-aware) και το περνά ως `reinforcement` στο `buildBeamDetailSheet` → builders δέχονται `r: BeamReinforcement | undefined`. **ΓΙΑΤΙ:** ο store-coupled resolver (`active-reinforcement.ts`) σέρνει firestore→firebase auth→`fetch is not defined` στο jest· επιπλέον PDF === live. **Στο Slice 5/6 ΜΗΝ εισάγεις τον store-coupled resolver σε pure module.**
- **Verification:** ✅ **196 jest GREEN** (8 νέα `beam-detail-sheet.test` + 188 detail-sheet/reinforcement, μηδέν regression). ⚠️ **tsc ΕΚΚΡΕΜΕΙ** — έτρεχε tsc άλλου agent (N.17, δεν ξεκίνησα δεύτερο). **Τρέξε tsc background ΑΦΟΥ ελέγξεις ότι δεν τρέχει άλλος** (`Get-CimInstance Win32_Process ... tsc`).

**Αρχεία μου Slice 4 (git add ΜΟΝΟ αυτά + τα Slice 0-3):** beam-detail-{elevation,section,schedule,titleblock,sheet}.ts, detail-sheet-spacing.ts, render/beam-detail-3d-capture.ts, BeamDetailHost.tsx, beam-detail-sheet.test.ts (NEW) · detail-sheet-types.ts, column-detail-elevation.ts, drawing-event-map-bim.ts, dxf-viewer-lazy-components.tsx, DxfViewerDialogs.tsx, contextual-beam-tab.ts, beam-command-keys.ts, useRibbonBeamBridge.ts, el/en dxf-viewer-shell.json (MOD) · ADR-471, ADR-457, adr-index, local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt (docs).

🔴 **browser-verify Slice 4:** δοκάρι → ribbon «Αυτόματος Οπλισμός» → «Λεπτομέρεια Οπλισμού» → PDF dialog (όψη κατά μήκος + διατομή + 3Δ προοπτικό + πίνακας οπλισμού + στοιχεία σχεδίου· preview===PDF· export/print). Parity με κολόνα/πέδιλο.

---

## 🔜 ΕΠΟΜΕΝΟ: Slices 5-6

> ⚠️ **N.8:** Slice 5 = **πλήρες UI/ribbon domain (~10-12 αρχεία)** → **Plan Mode**. **ΠΡΑΓΜΑΤΙΚΟ grep audit ΠΡΙΝ από κάθε νέο αρχείο** (ήδη επιβεβαιώθηκε: ΟΛΑ τα παρακάτω beam UI είναι NEW — μηδέν διπλότυπο).

### Slice 5 — Beam properties panel + ribbon structural (domain: UI/ribbon)
**Mirror του column-advanced-panel + column-structural-bridge.** SSoT audit έγινε (2026-06-17):
- ΔΕΝ υπάρχουν: `beam-advanced-panel/*`, `beam-property-fields.ts`, `useBeamParamsDispatcher`, `beam-structural-bridge.ts`, `BEAM_STRUCTURAL_KEYS`. **Όλα NEW.**
- Το δοκάρι **ΔΕΝ** είναι registered στο `BimPropertiesRouter` (κανένα beam branch) → πρόσθεσέ το.

**Mirror sources (διάβασέ τα):**
- `ui/column-advanced-panel/` → `ColumnAdvancedPanel.tsx` + `ColumnPropertiesTab.tsx` + `ColumnPropertyRow.tsx` + `column-property-fields.ts` (descriptor + `resolveColumnPanelVisibility`) + `__tests__/column-property-fields.test.ts`.
- `ui/ribbon/hooks/bridge/column-structural-bridge.ts` (κοινός writer `useColumnParamsDispatcher` + pure resolvers· **NB:** το `buildColumnSectionContext` ΕΧΕΙ ΗΔΗ εξαχθεί στο `section-context.ts`· το ισοδύναμο beam `buildBeamSectionContext` υπάρχει ήδη).
- `ui/ribbon/hooks/bridge/column-command-keys.ts` (`COLUMN_STRUCTURAL_KEYS`).
- `ui/bim-properties/BimPropertiesShell.tsx` + `BimPropertiesRouter.tsx` (πού/πώς registers κάθε type· auto-activate→isBimEntity).

**NEW (mirror):**
- `ui/beam-advanced-panel/*`: descriptor `beam-property-fields.ts` (Στατικά/Οπλισμός/Cover πεδία) + `resolveBeamPanelVisibility` + `BeamAdvancedPanel.tsx` (+ reuse `…PropertiesTab`/`…PropertyRow` ή mirror).
- `ui/ribbon/hooks/bridge/beam-structural-bridge.ts` (κοινός writer `useBeamParamsDispatcher` — **grep πρώτα** μήπως υπάρχει ήδη beam param dispatcher στο `useRibbonBeamBridge`· εκεί υπάρχει `dispatchParams` — αξιολόγησε reuse vs νέο).
- `BEAM_STRUCTURAL_KEYS` (mirror column keys) στο `beam-command-keys.ts`.
- Register beam branch στο `BimPropertiesRouter` (case για `isBeamEntity` → `BeamAdvancedPanel`).
- `contextual-beam-tab.ts`: πρόσθεσε structural fields στο `beam-structural` panel (combos Ø/πλήθος κάτω/άνω, cover, συνδετήρες Ø/βήμα/βήμα-κρίσιμο + live readouts ρ/βάρος/όγκος μέσω `computeBeamReinforcementQuantities`). **Το «Αυτόματος Οπλισμός» + «Λεπτομέρεια Οπλισμού» υπάρχουν ήδη** στο panel.
- i18n keys για τα νέα fields (el+en, keys-first N.11).

**Geometry-is-SSoT:** τα live readouts τρέφονται από `computeBeamReinforcementQuantities(buildBeamSectionContext(beam), r)` — ΟΧΙ νέος υπολογισμός. Ο dispatcher γράφει `BeamParams.reinforcement` (intent· `auto` flag parity κολόνα).

### Slice 6 — Facade consolidation + cleanup
- `resolveActiveMemberReinforcement` (dispatcher κολόνα/δοκάρι· thin) · `attachMemberRebar` (γενίκευση — **ΧΩΡΙΣ** να αγγίξεις working `attachColumnRebar`/`columnToMesh`· thin dispatcher) · `buildMemberDetailSheet` (event/dialog dispatch κολόνα/δοκάρι/πέδιλο).
- **REBAR_COLOR SSoT:** inline `'#c0392b'` σε `column-rebar-2d.ts` + `beam-rebar-2d.ts` (+ beam-detail-* sheet builders) + `0xc0392b` private στο `rebar-3d-shared.ts` → ΕΝΑ κοινό export.
- **Railing migration (ratchet):** `bim/railings/railing-geometry.ts` private `pointAtDistance`/`angleAtDistance` → delegate στο `polyline-frame.ts` SSoT.
- `.ssot-registry.json` (αν χρειαστεί module).
- Docs/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY (N.15).

---

## ⚠️ ΚΑΝΟΝΕΣ (κρίσιμα)
- **SSOT AUDIT (grep) ΠΡΙΝ από κάθε νέο αρχείο.** Μηδέν διπλότυπο.
- **Detail-sheet/render builders = PURE** (store μέσω host DI· βλ. Slice 4 pattern). ΜΗΝ εισάγεις store σε pure module → σπάει το jest.
- **Shared tree:** `git add` ΜΟΝΟ τα δικά σου. **ΟΧΙ commit/push** (Giorgio, N.(-1)). Υπάρχουν 2 προϋπάρχοντα tsc errors άλλου agent (`dxf-scene-beam-cutback.ts`, `beam-preview-helpers.ts`, ADR-458 WIP) — **ΜΗΝ τα αγγίξεις**.
- **tsc:** N.17 — ΕΝΑΣ tsc τη φορά, έλεγξε process πρώτα, background.
- **ADR-040:** το Slice 5 (UI/ribbon) πιθανότατα ΔΕΝ αγγίζει canvas render files → δεν χρειάζεται staging ADR-040. Αν αγγίξεις → stage ADR-040 (CHECK 6B/6D).
- Μετά από ΚΑΘΕ slice: update ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-471 changelog + adr-index + MEMORY (N.15), ίδιο batch.

## 🔍 Verification (Slices 5-6)
- **Jest:** `beam-property-fields.test` (mirror column) + structural suite μηδέν regression.
- **tsc:** background (N.17).
- **Browser:** δοκάρι → BIM Properties palette «Παράμετροι» δείχνει structural πεδία + live readouts (ρ/βάρος/όγκος)· ribbon structural combos γράφουν· resize με `auto=true` → re-derive (2Δ/3Δ/PDF/panel ακολουθούν). Parity με κολόνα.
