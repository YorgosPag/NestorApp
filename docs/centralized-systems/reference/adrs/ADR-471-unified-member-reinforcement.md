# ADR-471 — Unified Member Reinforcement (Κολόνα + Δοκάρι) — SSoT facade & πλήρης οπλισμός δοκού

**Status:** 🟡 IN PROGRESS 2026-06-17 (Opus) — Slice 0 (τεκμηρίωση) + Slice 1 (layout engine + `auto`) + **Slice 2 (2Δ render + member dispatch)** + **Slice 3 (3Δ κλωβός)** + **Slice 4 (detail-sheet PDF)** DONE· Slices 5-6 (UI-ribbon panel / facade-consolidation) ΕΚΚΡΕΜΟΥΝ. UNCOMMITTED.
**Discipline:** Δομοστατικά / Structural Engineering
**Scope:** (1) **Ενοποίηση** του συστήματος οπλισμού/auto-reinforce/προβολών σε **member-agnostic SSoT facade** (κοινά σημεία δρομολόγησης για κολόνα + δοκάρι, χωρίς refactor των εσωτερικών μηχανών της κολόνας). (2) **Πλήρης Revit-grade οπλισμός δοκού** στο επίπεδο της κολόνας: geometry layout engine, 2Δ κάτοψη, 3Δ κλωβός, detail-sheet PDF, properties panel, structural bridge, `auto` flag. Επεκτείνει ADR-456 (ποσότητες/κανονισμοί), ADR-457 (detail sheet), ADR-459 (organism/auto-reinforce), ADR-460 (multi-shape column), ADR-470 (component visibility).

---

## 1. Context & Problem

Ο οπλισμός της **κολόνας** είναι πλήρης end-to-end (Revit-grade): υπολογισμός κατά Ευρωκώδικα/ΕΚΩΣ-ΕΑΚ → shape-aware geometry layout (perimeter/circular/wall + Γ/Τ/Π/Ι multi-hoop) → 2Δ overlay κάτοψης → 3Δ κλωβός → detail-sheet PDF 5 περιοχών → properties panel → ribbon → auto-reinforce (proactive + organism continuity).

Το **δοκάρι** έχει ΜΟΝΟ το **backend**:
- `BeamReinforcement` type (`beam-reinforcement-types.ts`) — κάτω/άνω στρώσεις + συνδετήρες + cover.
- `computeBeamReinforcementQuantities` (`beam-reinforcement-compute.ts`) — μήκη/βάρος/ρ + `BeamLongitudinalContinuity`.
- `suggestBeamReinforcement` (Eurocode + ΕΚΩΣ-ΕΑΚ providers) + `buildBeamSectionContext` (`section-context.ts`).
- Organism integration (`reinforcement-continuity`/`reinforcement-checks`/`AutoReinforceOrganismCommand`/`useProactiveOrganismReinforce` ακούει ήδη `bim:beam-params-updated`).
- Ribbon κουμπί «Αυτόματος Οπλισμός» (`beam-structural` panel, ADR-459 Φ4d).

**ΛΕΙΠΟΥΝ τελείως οι προβολές + το UI** (το «σώμα» χωρίς «εικόνα»):
| Κενό | Κολόνα έχει | Δοκάρι |
|---|---|---|
| Geometry layout engine (θέσεις ράβδων) | `column-rebar-layout-resolve.ts` (+sub-engines) | — |
| 2Δ render κάτοψης | `column-rebar-2d.ts` + overlay pass | — |
| 3Δ κλωβός | `column-rebar-3d.ts` + `attachColumnRebar` | — |
| Detail-sheet PDF | `detail-sheet/column-detail-*.ts` | — |
| Properties panel | `ui/column-advanced-panel/*` + bridge + keys | — (ούτε register στο `BimPropertiesRouter`) |
| `auto` flag (live re-derive σε resize) | `resolveActiveColumnReinforcement` | — |

**Στόχος (εντολή Giorgio):** το πληρέστερο δυνατό (όπως Revit), full enterprise + full SSoT, **μηδέν διπλότυπα** (πραγματικό grep audit). Απόφαση: κοινό facade (όχι deep refactor κολόνας) + πλήρες Revit-grade δοκάρι.

---

## 2. Architecture — member-agnostic facade (4 σημεία δρομολόγησης)

Η γεωμετρία οπλισμού **κολόνας** είναι cross-section/plan (η κάτοψη ΕΙΝΑΙ η διατομή), ενώ του **δοκαριού** είναι longitudinal/elevation (η κάτοψη δείχνει την άνω παρειά κατά μήκος). Άρα η ενοποίηση γίνεται στα **σημεία δρομολόγησης + στο κοινό μοντέλο/backends**, ΟΧΙ με ξαναγράψιμο των column engines.

| Facade (νέο, dispatch ανά `entity.type`) | column → | beam → (νέο) | Γενικεύει |
|---|---|---|---|
| `resolveActiveMemberReinforcement(entity\|params)` | `resolveActiveColumnReinforcement` | `resolveActiveBeamReinforcement` | column-only σήμερα |
| `drawMemberReinforcement2D(ctx, entities, …)` | `drawColumnRebar2D` | `drawBeamRebar2D` | `drawColumnReinforcement2D` (loop μόνο columns) |
| `attachMemberRebar(composed, entity, baseY, …)` | `buildColumnRebarCage` | `buildBeamRebarCage` | inline `attachColumnRebar` |
| `buildMemberDetailSheet(entity, labels)` | `buildColumnDetailSheet` | `buildBeamDetailSheet` | event/dialog dispatch |

### SSoT που ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ (audit — μηδέν αλλαγή, μηδέν διπλότυπο)
- **Domain data:** `rebar-catalog.ts` (B500C, `barAreaMm2`/`barMassPerMeterKg`/`developmentLengthMm`), `concrete-grades.ts`, `structural-settings.ts`.
- **Κανονισμοί:** `codes/*` — `StructuralCodeProvider` (Eurocode + ΕΚΩΣ-ΕΑΚ), `suggestBeamReinforcementFrom`, `resolveBarSet`, `lapLengthMm`/`anchorageLengthMm`.
- **Section/intent:** `section-context.ts` (`buildBeamSectionContext`, `buildReinforcePatch`), `beam-reinforcement-types.ts`, `beam-reinforcement-compute.ts`.
- **3Δ primitives:** `rebar-3d-shared.ts` (`REBAR_MATERIAL` singleton, `buildRods` InstancedMesh, `toThree`, `MM_TO_M`).
- **Detail-sheet:** `detail-sheet-types.ts` (`DetailSheetModel`/`DetailPrimitive`), `render/detail-canvas-renderer.ts`, `render/detail-pdf-renderer.ts`, `detail-sheet-layout.ts`, `detail-sheet-dim.ts`, `render/detail-3d-capture-core.ts`.
- **Visibility:** `isStructuralComponentVisible('reinforcement', entity)` + `showReinforcement` store flag (ADR-470) — ήδη generic, ίδια πύλη σε κολόνα/δοκάρι.
- **Organism/auto:** `organism/*` + `structural-auto-reinforce-core.ts` + `useProactiveOrganismReinforce` + `AutoReinforceOrganismCommand` — ήδη χειρίζονται beam.
- **Color:** `REBAR_COLOR='#c0392b'` (2Δ) / `0xc0392b` (3Δ) — κοινό.

### Geometry-is-SSoT (η αρχή που τρέφει 2Δ/3Δ/PDF)
Όπως στην κολόνα (`ColumnRebarLayout`), εισάγεται ΕΝΑ `BeamRebarLayout` (LOCAL mm, beam-axis-relative) που **ΠΟΤΕ δεν αποθηκεύεται** — re-derived on-demand από 2Δ + 3Δ + detail-sheet → κάτοψη/όψη/τομή/3Δ δείχνουν την ΙΔΙΑ διάταξη.

---

## 3. Beam reinforcement spec (Revit-grade, EC8 / ΕΚΩΣ-ΕΑΚ)

**`BeamRebarLayout`** (`reinforcement/beam-rebar-layout.ts`, LOCAL mm — άξονας X κατά μήκος δοκού span, Y καθ' ύψος διατομής h, Z κατά πλάτος b):
- **Διαμήκεις κάτω (εφελκυσμός μέσου ανοίγματος):** συνεχείς ράβδοι σε όλο το span, κατανεμημένες κατά το πλάτος b στο cover.
- **Διαμήκεις άνω (στηρίξεις / αναρτήρες):** συνεχείς αναρτήρες + **πρόσθετες ράβδοι στηρίξεων** (curtailment x-range κοντά στα άκρα, EC2 §9.2.1.3 / EC8 §5.6.2).
- **Συνδετήρες (διάτμηση):** κλειστή ορθογ. διαδρομή στο cover (centerline inset = cover + dbw/2), στρογγυλεμένες γωνίες (reuse `buildRoundedStirrupPath` + `STIRRUP_BEND_CL_FACTOR`/`STIRRUP_BEND_ARC_SEGMENTS`) + γάντζοι 135° (reuse `buildStirrupHookEndsMm`).
- **Στάθμες συνδετήρων κατά το span:** **πύκνωση κρίσιμης ζώνης** `spacingCriticalMm` στις ζώνες άκρων `lcr ≈ h` (EC8 §5.4.3.1.2(6)) + αραιό `spacingMm` στη μέση — ίδια ζωνοποίηση με το `beamStirrupCount` (consistency με ποσότητες). Πρόβολος → 1 κρίσιμη ζώνη.
- **Curtailment ranges:** x-διαστήματα όπου ισχύουν οι πρόσθετες ράβδοι (top@supports, bottom extra@span) → τρέφουν 2Δ/3Δ/elevation.

Reuse σταθερών από `column-rebar-layout.ts`: `STIRRUP_BEND_CL_FACTOR`, `STIRRUP_BEND_ARC_SEGMENTS`, `STIRRUP_HOOK_EXTENSION_FACTOR`, `buildRoundedStirrupPath`, `buildStirrupHookEndsMm`, `closedPolylineLengthMm` (κοινό geometry SSoT, μηδέν διπλότυπο).

**`auto` flag:** `BeamReinforcement += auto?: boolean`. `resolveActiveBeamReinforcement(params, provider)` → όταν `auto=true` ξανα-υπολογίζει από τρέχουσα γεωμετρία (mirror `resolveActiveColumnReinforcement`)· `buildReinforcePatch` beam case → `{ ...r, auto: true }` (parity).

---

## 4. Data flow

**Beam (μετά ADR-471):**
```
BeamParams.reinforcement (intent, Firestore)
  └─ resolveActiveBeamReinforcement(params, provider)   [section-context.ts] (auto=true → re-suggest)
       ↓ BeamReinforcement (active)
  └─ resolveBeamRebarLayout(params, r, continuity?)     [beam-rebar-layout.ts]
       ↓ BeamRebarLayout (LOCAL mm: bottom/top bars, stirrup path, levels, curtailment)
  ├─ drawBeamRebar2D            [beam-rebar-2d.ts]      → κάτοψη (διαμήκεις + συνδετήρες, cutback ADR-458)
  ├─ buildBeamRebarCage         [beam-rebar-3d.ts]      → 3Δ (buildRods/REBAR_MATERIAL)
  └─ buildBeamDetailSheet       [detail-sheet/beam-*]   → DetailSheetModel → canvas preview / jsPDF
computeBeamReinforcementQuantities → schedule region + panel readouts + reinforcement-checks (ρ)
```
**Member dispatch:** `drawMemberReinforcement2D` / `attachMemberRebar` / `buildMemberDetailSheet` / `resolveActiveMemberReinforcement` δρομολογούν column↔beam — ΕΝΑ entry ανά concern.

---

## 5. Slices (υλοποίηση)

- **Slice 0 (τεκμηρίωση):** αυτό το ADR + adr-index. ✅
- **Slice 1 (reinforcement):** `beam-rebar-layout.ts` (`BeamRebarLayout`+`resolveBeamRebarLayout`), `+auto` στο `BeamReinforcement`, `resolveActiveBeamReinforcement`, `buildReinforcePatch` parity, jest.
- **Slice 2 (2Δ):** `beam-rebar-2d.ts` (`drawBeamRebar2D`), `drawColumnReinforcement2D`→`drawMemberReinforcement2D` (dispatch), ghost pass + NEW `polyline-frame.ts` SSoT. ✅
- **Slice 3 (3Δ):** `beam-rebar-3d.ts` (`buildBeamRebarCage`), `attachBeamRebar` στο `bim-three-structural-converters` (unified `attachMemberRebar` → Slice 6). ✅
- **Slice 4 (PDF):** ✅ `detail-sheet/beam-detail-{sheet,elevation,section,schedule,titleblock}.ts` + `render/beam-detail-3d-capture.ts` + NEW SSoT `detail-sheet-spacing.ts` (shared spacing-zone grouping κολόνα/δοκός) + host `BeamDetailHost` (DI: builders pure) + event `bim:beam-detail-requested` + ribbon button. (top-plan παραλείφθηκε — Revit-grade: όψη+διατομή· event ονομάστηκε `-detail-requested` για consistency με κολόνα/πέδιλο αντί `-detail-open`.)
- **Slice 5 (UI/ribbon):** `ui/beam-advanced-panel/*` + `beam-structural-bridge.ts` + `BEAM_STRUCTURAL_KEYS` + `BimPropertiesRouter` beam branch + `contextual-beam-tab` structural fields + wire `useRibbonBeamBridge`.
- **Slice 6:** facade consolidation + `.ssot-registry.json` (αν χρειαστεί) + docs/ΕΚΚΡΕΜΟΤΗΤΕΣ/MEMORY.

---

## 6. ΜΑΘΗΜΑΤΑ / Αρχές
- **Ενοποίηση = δρομολόγηση + κοινό μοντέλο**, ΟΧΙ ξαναγράψιμο working column engines (η κολόνα μένει intact σε production).
- Geometry-is-SSoT: ΕΝΑ `BeamRebarLayout` τρέφει 2Δ/3Δ/PDF → καμία απόκλιση κάτοψης/όψης/τομής/3Δ.
- Reuse stirrup geometry helpers κολόνας (rounded path + γάντζοι 135°) → μηδέν διπλό κώδικα κάμψης.
- `auto` flag = parity με κολόνα → live re-derive σε resize, ίδια εμπειρία.
- Visibility ήδη generic (ADR-470): ο `showReinforcement` toggle θα έχει επιτέλους **τι να δείξει** στο δοκάρι.

## 7. DEFER
- Λυγισμένες ράβδοι (bent-up bars) — σπάνιες σε σύγχρονη πρακτική.
- Refactor εσωτερικών column layout engines (κρατάμε working production κώδικα).
- I-shape/χαλύβδινο δοκάρι ως steel section (τώρα RC perimeter· steel = γεωμετρία χωρίς rebar).
- FEM/adequacy design από φορτία (ζει σε ADR-459/464/467 — εδώ μόνο detailing/suggester).
- Multi-layer διαμήκεις (>1 σειρά κάτω/άνω) — πρώτη υλοποίηση = μία σειρά ανά παρειά.

## 8. Verification
- **Jest:** νέο `beam-rebar-layout.test.ts` (γεωμετρία, critical zone, cover, curtailment) + υπάρχοντα beam compute/suggest/continuity suites GREEN. Structural suite μηδέν regression (κολόνα ταυτόσημη).
- **tsc:** `npx tsc --noEmit` σε background (N.17 — ΕΝΑΣ tsc τη φορά).
- **Browser** (Firestore-records-first): δοκάρι → ribbon «Αυτόματος Οπλισμός» → toggle «Οπλισμός» ON → 2Δ διαμήκεις+συνδετήρες· 3Δ κλωβός· «Λεπτομέρεια Οπλισμού» → PDF· Properties panel structural readouts (ρ/βάρος/όγκος + φορτία)· resize με `auto=true` → re-derive· reload → persist. Parity με κολόνα.
- **Pre-commit:** ADR-040 CHECK 6B/6D (αγγίζουμε render files → ADR staged) — ADR-471 + ADR-458 staged.

---

## 9. Changelog
- **2026-06-17 — Slice 4 (detail-sheet PDF· Opus, UNCOMMITTED):** Πλήρες Revit-grade φύλλο σχεδίου οπλισμού δοκού, **geometry-is-SSoT** (ΕΝΑ `BeamRebarLayout` + `computeBeamReinforcementQuantities` → preview === PDF). NEW pure builders (mirror footing/column): `detail-sheet/beam-detail-elevation.ts` (longitudinal ΟΨΗ — διαμήκεις κάτω/άνω/στηρίξεων + κατακόρυφοι συνδετήρες με 135° γάντζο + grouped spacing-dim ζώνες) · `beam-detail-section.ts` (ΔΙΑΤΟΜΗ b×h — κουκκίδες ράβδων + κλειστός συνδετήρας) · `beam-detail-schedule.ts` (κάτω/άνω διαμήκεις + συνδετήρες + σύνολο + ρ) · `beam-detail-titleblock.ts` · `beam-detail-sheet.ts` (orchestrator) · `render/beam-detail-3d-capture.ts` (canonical straight beam → offscreen WebGL, reuse `detail-3d-capture-core`/`buildBeamRebarCage`/`buildConcretePrism`). NEW SSoT `detail-sheet/detail-sheet-spacing.ts` (`groupSpacingZones`/`formatSpacingZoneLabel`) — **boy-scout (N.0.2)**: εξήχθη το inline spacing-zone grouping του `column-detail-elevation` → reuse σε κολόνα ΚΑΙ δοκό (μηδέν διπλό· ADR-457 column-detail-elevation migrated). NEW host `ui/components/beam-detail/BeamDetailHost.tsx` (mirror FoundationDetailHost· **dependency-injection**: ο host resolve-άρει `resolveActiveBeamReinforcementForEntity` store-aware → builders **pure** [μηδέν store import, unit-testable· ίδιο pattern με column/footing builders] → PDF === live 2Δ/3Δ). Wiring: event `bim:beam-detail-requested` (drawing-event-map-bim) · lazy (`dxf-viewer-lazy-components`) + mount (`DxfViewerDialogs`) · ribbon button «Λεπτομέρεια Οπλισμού» στο `beam-structural` panel (icon `column-reinforcement-detail`) · `BEAM_RIBBON_KEYS_ACTIONS.reinforcementDetail` + emit στο `useRibbonBeamBridge`. i18n `beamDetail.*` + `ribbon.commands.beamEditor.reinforcementDetail[Tooltip]` (el+en, keys-first N.11). NEW `BeamScheduleLabels`/`BeamTitleBlockLabels`/`BeamDetailSheetLabels` (detail-sheet-types). 8 νέα jest (`beam-detail-sheet.test`)· 196 detail-sheet+reinforcement GREEN (μηδέν regression, column-elevation refactor verified). ΑΠΟΦΑΣΗ Revit-grade: 2 σχεδιαστικά slots → όψη(κύρια)+διατομή (top-plan δοκού = μηδενική πληροφορία)· πολλαπλές διατομές στήριξη/μέσον = DEFER. tsc background (N.17 — άλλος agent έτρεχε tsc, εκκρεμεί). ΜΑΘΗΜΑ: detail-sheet builders = **pure (store μέσω host DI)**· cross-element spacing grouping = shared SSoT, ΟΧΙ inline copy.
- **2026-06-17 — Slices 2+3 (Opus, UNCOMMITTED):** **2Δ** — NEW `bim/renderers/beam-rebar-2d.ts` (`drawBeamRebar2D`: διαμήκεις = γραμμές κατά τον άξονα στα v· συνδετήρες = εγκάρσιες γραμμές στο cover ανά στάθμη· γάντζοι 135° στα άκρα). NEW geometry SSoT `bim/geometry/shared/polyline-frame.ts` (`samplePolylineFrame` → point+tangent+normal σε arc-length· `world(u,v)=point+v·normal`· units-agnostic, pure· railing έχει private διπλό → ratchet migration). `drawColumnReinforcement2D` → **`drawMemberReinforcement2D`** (dispatch κολώνα/δοκάρι ανά `entity.type`, ίδιο per-element gate + cut-plane parity)· caller στο `DxfRenderer.ts` ενημερώθηκε. Ghost pass (`draw-ghost-entity.ts` beam case) → live rebar στο grip-drag/resize (parity κολώνας). **3Δ** — NEW `bim-3d/converters/beam-rebar-3d.ts` (`buildBeamRebarCage`: διαμήκεις κύλινδροι κατά τον άξονα ομαδοποιημένοι ανά Ø· συνδετήρες = κλειστά loops στο επίπεδο διατομής v-w ανά στάθμη· reuse `buildRods`/`REBAR_MATERIAL`/`MIN_RADIUS` από `rebar-3d-shared`). NEW `attachBeamRebar` στο `beamToMesh` (gate `showReinforcement`, ΑΝΕΞΑΡΤΗΤΟ του `suppressFinishSkin`, datum `bottomFaceY=mesh.position.y`). SSoT widening (μη-breaking): `buildBeamSectionContext`/`resolveActiveBeamReinforcement`/`resolveActiveBeamReinforcementForEntity` δέχονται `Pick<BeamEntity,'params'|'geometry'>` ώστε να καλούνται με το DXF beam wrapper χωρίς cast. 7 νέα jest (`polyline-frame`)· 382 structural GREEN· tsc background (N.17). ΜΑΘΗΜΑ: η ενοποίηση 2Δ/3Δ γίνεται στο **σημείο δρομολόγησης** (member dispatch) + **κοινό geometry frame** (path-relative local→world)· οι column engines μένουν intact (geometry-is-SSoT: ΕΝΑ `BeamRebarLayout` τρέφει 2Δ ΚΑΙ 3Δ). DEFER: tilted-beam slope στον κλωβό· unified `attachMemberRebar`/`drawMemberReinforcement2D` consolidation στο Slice 6.
- **2026-06-17 — Slice 1 (Opus, UNCOMMITTED):** NEW `reinforcement/beam-rebar-layout.ts` — `BeamRebarLayout` + `resolveBeamRebarLayout(ctx, r)` + `computeBeamStirrupLevelsMm` (beam-local mm: κάτω συνεχείς + άνω 2 αναρτήρες/curtailed στηρίξεων + συνδετήρες με πύκνωση κρίσιμης ζώνης lcr≈h· reuse `buildRoundedStirrupPath`/`buildStirrupHookEndsMm`/`closedPolylineLengthMm`/`STIRRUP_BEND_*` από `column-rebar-layout` → μηδέν διπλό). `BeamReinforcement += auto?`. `resolveActiveBeamReinforcement(beam, provider)` + store-coupled `resolveActiveBeamReinforcementForEntity` (active-reinforcement.ts). `buildReinforcePatch` beam → `{...r, auto:true}` (parity). 10 νέα jest (σύνολο 202 structural GREEN). ΜΑΘΗΜΑ: η stirrup-bend γεωμετρία κολόνας είναι member-agnostic → reuse, ΟΧΙ διπλότυπο.
- **2026-06-17** — ADR δημιουργήθηκε (Opus). Slice 0 (τεκμηρίωση). SSoT audit ολοκληρώθηκε: επιβεβαιώθηκε ότι όλο το beam **backend** (types/compute/suggest/section-context/organism/ribbon-button) υπάρχει ήδη· λείπουν μόνο layout-engine + προβολές (2Δ/3Δ/PDF) + properties UI + `auto` flag. Σχέδιο: member-agnostic facade (4 dispatchers) + 6 slices. UNCOMMITTED.
