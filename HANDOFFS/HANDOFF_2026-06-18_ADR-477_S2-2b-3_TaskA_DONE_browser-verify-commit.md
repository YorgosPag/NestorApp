# HANDOFF — ADR-477: Slices 2/2b/3 + Task A DONE & UNCOMMITTED → απομένει browser-verify + commit

**Ημερομηνία:** 2026-06-18 | **Μοντέλο:** Opus | **Κατάσταση:** Slice 1 COMMITTED (9fef2a8b)· **Slices 2 + 2b + 3 + Task A DONE & UNCOMMITTED**, tsc-clean (τα δικά μου), όλα τα νέα jest GREEN. Απομένει: **browser-verify + commit (ο Giorgio)**.

> ⚠️ **Working tree μοιράζεται με ΑΛΛΟΝ agent** (slab, ADR-476). `git add` **ΜΟΝΟ τα δικά σου αρχεία** (λίστα §3). **ΠΟΤΕ commit/push** — ο Giorgio κάνει commit (N.(-1)).
> 🎯 **FULL ENTERPRISE + FULL SSOT, Revit-grade.** Πριν από ΟΠΟΙΟΝΔΗΠΟΤΕ νέο κώδικα → **πραγματικό grep SSoT audit** ώστε να επαναχρησιμοποιήσεις υπάρχον, ΟΧΙ διπλότυπα (ρητός κανόνας Giorgio· εφαρμόστηκε στο Slice 3 connectivity).
> ⚠️ **tsc serialization (N.17):** πριν τρέξεις tsc → έλεγξε ότι δεν τρέχει άλλος.
> 🌐 Απάντα στον Giorgio **Ελληνικά**.

---

## 0. Τι ΕΓΙΝΕ ήδη (DONE & UNCOMMITTED) — context, ΜΗΝ το ξαναγράψεις

### Task A — Store layering root-cause fix (enterprise)
`state/structural-settings-store.ts`: το `saveStructuralSettings` φορτώνεται **lazy** (`void import('../services/structural-settings.service').then(...)`) μέσα στο `debounceWrite` (ήταν eager top-level import → έσερνε όλο το Firestore/Firebase stack στο import-graph· κάθε pure consumer renderers/converters/validators που διαβάζει `getState().codeId` γινόταν μη-testable). Το save ήταν ήδη deferred + fire-and-forget → **μηδέν behavior change**. `state/__tests__/structural-settings-store.test.ts`: +`flushMicrotasks` helper (η lazy persistence καλεί το save σε microtask μετά το `advanceTimersByTime`). Το `bim-3d/converters/__tests__/footing-rebar-3d.test.ts` (πρώην «fetch is not defined») πλέον **GREEN 4/4**.

### Slice 2b — Πλήρης longitudinal-elevation στο PDF συνδετήριας
SSoT core-extraction (mirror Slice 2, ΟΧΙ fake-BeamEntity):
- `beam-detail-elevation.ts` → NEW `buildLinearMemberElevationRegion(layout, r, region)` (το πρώην σώμα ΜΕΤΑ το resolve)· `buildBeamElevationRegion` = thin wrapper.
- `beam-detail-section.ts` → NEW `buildLinearMemberSectionRegion(layout, region)`· `buildBeamSectionRegion` = thin wrapper.
- `footing-detail-sheet.ts`: `resolvePlanAndElevation` → tie-beam branch χρησιμοποιεί τα linear-member cores (slot **'elevation'**=longitudinal όψη, slot **'plan'**=εγκάρσια διατομή). pad/strip → footing όψεις (αμετάβλητα). schedule/perspective/title-block → μένουν footing.
- `detail-sheet-types.ts`: `FootingDetailSheetLabels += tieBeamRegions?: {elevation, section}` (optional → footing fallback back-compat).
- `FoundationDetailHost.tsx`: περνά `tieBeamRegions` μέσω νέων i18n keys `foundationDetail.tieBeamRegions.{elevation,section}` (el «ΟΨΗ»/«ΔΙΑΤΟΜΗ», en «ELEVATION»/«SECTION»).
- `footing-detail-sheet.test.ts`: +3 tests (parity με linear-member cores· EC8 densification· back-compat fallback). **18/18 GREEN**.

### Slice 3 — EC8 §5.4.1.2 σεισμική αξονική δύναμη σύνδεσης (full SSoT)
- **NEW** `bim/structural/loads/seismic-params.ts` — EC8 πίνακες (S: EN1998-1 Πίν.3.2· ε: EN1998-5 §5.4.1.2(7) A=0/B=0.3/C=0.4/D=E=0.6) + `seismicTieForceFactor(groundType, a_gR/g)` + guards. Defaults: a_gR=0.16g (Ζ1), ground B.
- **NEW** `bim/structural/loads/tie-beam-tie-force.ts` — scene-level `computeTieBeamTieForces(entities, groundType, accelRatio)` → patches `{tieBeamId, seismicTieForceKn}`. **Συνδεσιμότητα = ΕΠΑΝΑΧΡΗΣΗ organism SSoT** (μετά από SSoT audit): άκρο συνδετήριας → πέδιλο που το **περιέχει** (`resolveFootingSummary` footprint + `isPointInPolygon` coverage) → στηρίζουσα κολώνα (`footingId` FK, ίδιο pattern με `footing-load-takedown`) → χαρακτηριστικό SLS αξονικό (`combineSls(resolveAppliedMemberLoad)`). `N_tie = factor·N_Ed,mean`. **ΟΧΙ** ad-hoc spatial heuristic.
- `structural-settings.ts` + `state/structural-settings-store.ts`: `StructuralSettings += seismicGroundType?/seismicGroundAccelRatio?` + resolver + store round-trip (raw/loadForBuilding). **Χωρίς setter** (default zero-input δουλεύει· UI selector = DEFER).
- `foundation-types.ts`: `TieBeamParams += seismicTieForceKn?` (DERIVED).
- `structural-code-types.ts`: `TieBeamSectionContext += designAxialTieKn?` + `section-context.ts` wiring (tie-beam case: `seismicTieForceKn>0 → designAxialTieKn`).
- `codes/suggest-reinforcement.ts`: NEW `suggestTieBeamReinforcementFrom` + `upgradeFaceForTie` — `As,tie = N_tie/f_yd` συμμετρικά κάτω+άνω, `max(καμπτικό/min, tie share)`, **reuse `resolveBarSet`** (μηδέν duplicate). absent N_tie → καθαρά δοκός (μηδέν regression).
- **NEW** `core/commands/entity-commands/ComputeTieBeamTieForcesCommand.ts` (batch, undoable, idempotent skip-when-unchanged· mirror `ComputeLoadPathCommand`).
- **NEW** `hooks/useProactiveTieBeamTieForce.ts` (ακούει `bim:structural-loads-computed` → recompute → command)· mount στο `app/DxfViewerContent.tsx` **μετά** το `useProactiveStructuralLoads`.
- Readout «Σεισμός» (tie-beam μόνο): `foundation-property-fields.ts` (NEW `TIE_BEAM_SEISMIC_GROUP`)· `foundation-command-keys.ts` (`tieSeismicForce` readout key· auto-routed μέσω `Object.values` set)· `foundation-structural-bridge.ts` (resolver: `params.seismicTieForceKn` → kN ή «—»)· i18n `foundationStructural.tieSeismicForce` + `foundationAdvancedPanel.sections.seismic.title` (el+en).
- Tests: `tie-beam-tie-force.test.ts` (10/10: factor + connected-mean via FK/coverage + ground-A skip + no-footing/no-FK → 0) + `footing-reinforcement-suggest.test.ts` (+2: As,tie bump· μηδέν regression χωρίς N_tie).

**Re-study chain (πλήρης):** geometry edit → `useProactiveStructuralLoads` (φορτία κολονών) → `bim:structural-loads-computed` → `useProactiveTieBeamTieForce` (N_tie) → tie-beam params update → active reinforcement (auto) re-derive με As,tie.

**Gotchas (κράτησέ τα):**
- Σεισμική αξονική ≠ gravity tributary → **ΟΧΙ** μέλος του `isLoadPathMember`· χωριστή scene pass.
- N_Ed,mean = SLS χαρακτηριστικό (preliminary)· πλήρες σεισμικό G+ψ₂Q = DEFER.
- Settings χωρίς setter αλλά full round-trip → default εφαρμόζεται στο **read** (Revit zero-input).
- Suggester tie-force = **post-process** του beam result με `resolveBarSet` bump (μηδέν duplicate του bar-selection).
- Connectivity: **πάντα** reuse `footingId` FK + `isPointInPolygon` coverage (organism SSoT) — ΠΟΤΕ ad-hoc distance.

---

## 1. tsc & tests — κατάσταση

- **tsc: τα δικά μου ~25 αρχεία CLEAN.** Το full tsc δείχνει **μόνο 4 errors, ΟΛΑ προϋπάρχοντα** σε beam-structural ribbon (committed `4567a1af`, ADR-471/472 beam panel **άλλου agent**): `beam-command-keys.ts(9)` λάθος import path· `beam-structural-bridge.ts(78,150)` `BeamParams.concreteGrade` λείπει· `beam-structural-param.ts(17)` `codes.BeamSectionContext` δεν εξάγεται. **ΜΗΝ τα αγγίξεις** (domain άλλου agent· το fix ζει στην uncommitted δουλειά τους).
- **Jest:** όλα τα δικά μου GREEN (64 σε προηγούμενο consolidated run + 10 το refactored tie-force). **Προϋπάρχοντα 6 raft/slab failures** (`reinforcement-checks.test.ts`/`raft-bearing.test.ts`, `slab.geometry.maxFreeSpanM` undefined) = **shared-tree ADR-476 slab agent**, ΟΧΙ δικά μου.

---

## 2. ΑΠΟΜΕΝΕΙ (ο Giorgio)

### A. Browser-verify (σχεδίασε κάτοψη με 2 πέδιλα + κολώνες + συνδετήρια δοκό μεταξύ τους):
1. **Slice 2/2b:** «Οπλισμός» ON στη συνδετήρια → 2Δ/3Δ **EC8 πύκνωση συνδετήρων στα άκρα** (όπως δοκάρι). PDF «Λεπτομέρεια Οπλισμού» → **longitudinal όψη + εγκάρσια διατομή** (σαν δοκός, ΟΧΙ footing κάτοψη/διατομή). Resize → live re-study.
2. **Slice 3:** Πάτα «Υπολογισμός Φορτίων» (ribbon) → στην καρτέλα Ιδιότητες της συνδετήριας, ομάδα **«Σεισμός»** → `N_tie` (kN) > 0 (αν οι κολώνες έχουν φορτίο). Άλλαξε διάσταση/φορτίο → re-study. (Default a_gR=0.16g/ground B — δεν χρειάζεται επιλογή.)
3. **Μηδέν regression:** pad/strip πέδιλα (2Δ/3Δ/PDF/readouts) + super-structure beams αμετάβλητα.

### B. Commit (ο Giorgio· git add ΜΟΝΟ τα δικά μου — §3):
Αν το pre-commit hook μπλοκάρει για τα **4 beam tsc errors** ή τα **6 raft jest** → είναι **προϋπάρχοντα/άλλου agent** (βλ. §1)· δες αν χρειάζεται coordination με τον slab/beam agent ή skip με env var (απόφαση Giorgio· N.16).

---

## 3. git add — ΜΟΝΟ τα δικά μου (shared tree)

**NEW:**
- `src/subapps/dxf-viewer/bim/structural/loads/seismic-params.ts`
- `src/subapps/dxf-viewer/bim/structural/loads/tie-beam-tie-force.ts`
- `src/subapps/dxf-viewer/bim/structural/loads/__tests__/tie-beam-tie-force.test.ts`
- `src/subapps/dxf-viewer/core/commands/entity-commands/ComputeTieBeamTieForcesCommand.ts`
- `src/subapps/dxf-viewer/hooks/useProactiveTieBeamTieForce.ts`

**MOD:**
- `src/subapps/dxf-viewer/state/structural-settings-store.ts` (+test)
- `src/subapps/dxf-viewer/bim/structural/structural-settings.ts`
- `src/subapps/dxf-viewer/bim/types/foundation-types.ts`
- `src/subapps/dxf-viewer/bim/structural/codes/structural-code-types.ts`
- `src/subapps/dxf-viewer/bim/structural/section-context.ts`
- `src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts`
- `src/subapps/dxf-viewer/bim/structural/codes/__tests__/footing-reinforcement-suggest.test.ts`
- `src/subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-elevation.ts`
- `src/subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-section.ts`
- `src/subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-sheet.ts`
- `src/subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-types.ts`
- `src/subapps/dxf-viewer/bim/structural/detail-sheet/__tests__/footing-detail-sheet.test.ts`
- `src/subapps/dxf-viewer/ui/components/foundation-detail/FoundationDetailHost.tsx`
- `src/subapps/dxf-viewer/ui/foundation-advanced-panel/foundation-property-fields.ts`
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/foundation-command-keys.ts`
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/foundation-structural-bridge.ts`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx`
- `src/i18n/locales/el/dxf-viewer-shell.json`
- `src/i18n/locales/en/dxf-viewer-shell.json`
- `docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md`
- `docs/centralized-systems/reference/adr-index.md`
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

⚠️ **ΜΗΝ** κάνεις `git add` σε: `beam-command-keys.ts`, `beam-structural-bridge.ts`, `beam-structural-param.ts`, `reinforcement-checks*`, `raft-bearing*`, ή οτιδήποτε slab/ADR-476 (άλλος agent).

---

## 4. DEFER (μελλοντικά, ΟΧΙ τώρα)
- UI selector σεισμικών παραμέτρων (a_gR / ground type) στην καρτέλα/ribbon — default zero-input δουλεύει.
- Πλήρες σεισμικό N_Ed,mean = G+ψ₂Q (τώρα SLS χαρακτηριστικό preliminary).
- Longitudinal beam-style schedule rows στο PDF συνδετήριας (τώρα footing schedule).
