# ADR-459 — Structural Organism / Analytical Connectivity Model

**Status:** ACTIVE (Phase 0 + 1 + 2 + 4a + 4b + 4c + 4d + 4e + 4f implemented 2026-06-15· Phase 6 proactive + cross-level 2026-06-17· **Phase 7 Αυτόματος Σχεδιασμός Θεμελίωσης 2026-06-17**)
**Discipline:** BIM / Structural (DXF Viewer subapp)
**Σχετικά:** ADR-401 (auto-attach), ADR-436 (foundation discipline), ADR-456 (structural quantities), ADR-458 (beam-column cutback)

---

## 1. Context — τι ζητήθηκε

Ο μηχανικός σχεδιάζει δομικές οντότητες (πέδιλο → κολόνα → δοκάρι) στον καμβά. Σήμερα
αντιμετωπίζονται **μεμονωμένα**: κάθε entity έχει per-entity validator (`column-validator`,
`beam-validator`, `foundation-validator`) που ελέγχει ΜΟΝΟ τα δικά του params. **Δεν υπάρχει
καμία έννοια στατικής σύνδεσης** μεταξύ μελών — άρα ούτε «λείπει το πέδιλο», ούτε «το δοκάρι
δεν στηρίζεται», ούτε υπολογισμός οπλισμού σε επίπεδο οργανισμού.

Ζητούμενο (Revit-grade, πρότυπο Analytical Model + Structural Connectivity):
1. Οι συνδεδεμένες οντότητες = **ΕΝΑΣ στατικός οργανισμός**.
2. Σκέτη κολόνα → προειδοποίηση «**λείπει το πέδιλο**».
3. Πέδιλο+κολόνα+δοκάρι «κουμπώνουν» → σωστά στατικά/διατομές/οπλισμός.
4. Warnings «μικρή διατομή», προτάσεις διατομών, αυτόματος οπλισμός.

## 2. Decision — phased subsystem, DERIVED graph SSoT

Το «Structural Organism» = **DERIVED connectivity graph** (nodes = μέλη, edges = στατικές
συνδέσεις) που **ξανα-χτίζεται** από τα ΥΠΑΡΧΟΝΤΑ FKs/geometry σε κάθε structural αλλαγή
σκηνής — **ΠΟΤΕ persisted** (ίδια φιλοσοφία με `displayOutline`/`displayAxisPolyline`,
ADR-458). SSoT = τα params των entities· ο graph + τα διαγνωστικά είναι παράγωγο cache.

**Phased plan** (Phase 0+1 = αυτό το ADR· 2-5 follow-on):

| Phase | Περιεχόμενο | Status |
|-------|-------------|--------|
| **0** | Structural Connectivity Graph SSoT (nodes/edges, DERIVED) | ✅ DONE |
| **1** | Cross-entity διαγνωστικά («λείπει πέδιλο» / «δοκάρι ασύνδετο» / «μεμονωμένο πέδιλο») + per-entity surfacing | ✅ DONE |
| **2** | Explicit FK κολόνα↔πέδιλο (auto-attach style) → «column needs footing» hard | ✅ DONE |
| 3 | Section adequacy advisories («μικρή διατομή», πρόταση διατομής) | ⏳ |
| **4a** | Beam reinforcement (data model + providers + suggester + compute) | ✅ DONE |
| **4b** | Footing reinforcement (pad σχάρα / strip ανεστραμμένη δοκός / tie-beam reuse beam) | ✅ DONE |
| **4c** | Organism continuity (ματίσεις/αναμονές/αγκυρώσεις στις συνδέσεις, αμφίδρομα) | ✅ DONE |
| 4d | Reinforcement warnings + auto-apply command | ⏳ |
| 5 | Loads + analysis + M-N checks (βαρύ, ξεχωριστά) | ⏳ |
| **6** | Proactive on-create toasts + cross-level organism (κολόνα→πέδιλο→ενιαίος οπλισμός, §6i) | ✅ DONE |

## 3. Model — graph (Phase 0)

**Nodes** (`StructuralNode`) ανά δομικό μέλος, με geometry summary (footprint/axis + Z extents)
ώστε οι έλεγχοι να τρέχουν αμιγώς πάνω στον graph:
- `memberKind`: `footing` | `column` | `beam`.
- `footing` καλύπτει ΚΑΙ `FoundationEntity` (pad/strip/tie-beam) ΚΑΙ τις πλάκες-θεμελίωσης
  (`SlabEntity` kind `foundation`/`ground`) — όλα παρέχουν έδραση από κάτω.

**Edges** (`StructuralEdge`, κατεύθυνση = load-path· `supportId` κάτω, `supportedId` πάνω):
- `footing-bearing` — πέδιλο/εδαφόπλακα στηρίζει βάση κολόνας (plan coverage του κέντρου βάσης
  + άνω παρειά πεδίλου ≤ βάση κολόνας).
- `column-bearing` — κολόνα στηρίζει δοκάρι (REUSE `findColumnsFramedByBeam`, ADR-401).
- `top-attachment` — κορυφή μέλους attached σε host (persisted `attachTopToIds`).

**REUSE (N.0.2 — μηδέν duplicate):** `findColumnsFramedByBeam`, `resolveColumnBaseZmm`,
`beamHostInput`/`slabHostInput`, `isPointInPolygon`, `attachTopToIds`.

## 4. Checks — διαγνωστικά (Phase 1)

`runOrganismChecks(graph) → StructuralDiagnostic[]` (pure registry):
- **`columnMissingFooting`** (error) — κολόνα χωρίς `footing-bearing` ακμή. **Το «λείπει το πέδιλο».**
- **`beamUnsupportedEnd`** (warning) — δοκάρι χωρίς στήριξη σε άκρο (προβολή framing κολονών
  στον άξονα· `cantilever` ⇒ θεμιτό 1 ελεύθερο άκρο).
- **`memberIsolated`** (warning) — μεμονωμένο πέδιλο (χωρίς κολόνα από πάνω).

Cross-entity → **ΔΕΝ** γράφεται στο `entity.validation` (αυτό ανήκει στους per-entity validators).
Τα ευρήματα είναι DERIVED, surfaced μέσω store/panel. i18n keys μόνο (N.11).

## 5. Surfacing & data-flow

- `StructuralDiagnosticsStore` — low-freq external store (useSyncExternalStore-compatible),
  index ανά entityId. Zero React, **ADR-040 safe** (γράφεται μόνο σε structural μεταβολή).
- `useStructuralOrganism({ levelManager })` — shell hook (mirror `useStructuralAutoAttach`,
  mounted στο `DxfViewerContent`): ακούει structural lifecycle events, ξανα-χτίζει graph →
  checks → store, coalesced ανά microtask· emit `bim:structural-organism-updated`.
- `EntityWarningsSection` — ΕΝΑ generic per-entity component (κολόνα/δοκάρι/πέδιλο), mirror
  `WallWarningsSection`. Mounted στο `ColumnAdvancedPanel` (Phase 1 visible deliverable).

## 6. Files

**Pure core** — `bim/structural/organism/`:
- `structural-organism-types.ts` — nodes/edges/graph/diagnostic types.
- `structural-graph.ts` — `buildStructuralGraph` (DERIVED builder).
- `organism-checks.ts` — `runOrganismChecks` registry (+ re-export builder).
- `structural-diagnostics-store.ts` — diagnostics store SSoT.
- `useEntityStructuralDiagnostics.ts` — per-entity reactive selector.
- `__tests__/structural-graph.test.ts`, `__tests__/organism-checks.test.ts` (11 jest).

**Surfacing:**
- `hooks/useStructuralOrganism.ts` — shell recompute hook.
- `ui/structural-warnings/EntityWarningsSection.tsx` — generic warnings UI.
- `ui/column-advanced-panel/ColumnAdvancedPanel.tsx` — mount (MOD).
- `app/DxfViewerContent.tsx` — hook mount (MOD).
- `systems/events/drawing-event-map-bim.ts` — `bim:structural-organism-updated` (MOD).
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `structuralOrganism.diagnostics.*` (MOD).

## 6b. Phase 2 — Explicit FK κολόνα↔πέδιλο (Structural Connectivity)

**Στόχος (Revit-grade):** η σχέση στήριξης κολόνα↔πέδιλο γίνεται **ρητή & persisted** (όχι
μόνο spatial), ώστε ο οργανισμός να είναι authoritative και το «λείπει το πέδιλο» **hard**.

**Αποφάσεις (Revit-grade):**
1. **`footingId` = αμιγώς αναλυτικό FK** (`ColumnParams.footingId?: string`). ΔΕΝ μετακινεί τη
   βάση της κολόνας — το φυσικό base-attach είναι ξεχωριστό (`attachBaseToIds`/ADR-401).
   Καθαρός διαχωρισμός αναλυτικού ↔ φυσικού μοντέλου (Revit Analytical vs Physical).
2. **FK δείχνει σε πέδιλο (pad/strip/tie-beam) Ή σε εδαφόπλακα** (`SlabEntity` foundation/ground)
   — ό,τι αποτελεί «footing node» στον οργανισμό (κολόνα μπορεί να εδράζεται σε raft).
3. **Explicit-FK-wins + spatial fallback:** όταν `footingId` υπάρχει & δείχνει σε υπαρκτό footing
   node → ΜΟΝΟ αυτή η `footing-bearing` ακμή (authoritative)· stale FK → καμία ακμή →
   `columnMissingFooting` (hard). Χωρίς `footingId` (legacy) → spatial-coincidence fallback.
4. **Reverse (πέδιλο→κολόνες) DERIVED** στον graph — μηδέν αμφίδρομα persisted arrays (anti-drift).

**SSoT (N.0.2 — μηδέν duplicate):**
- `bim/foundations/footing-column-coverage.ts` — ΕΝΑ bearing κριτήριο (`footingSupportsColumnBase`
  + `polygonCentroid` + `FOOTING_Z_GATE_MM`)· εξήχθη από τον graph· τώρα μοιράζεται graph + coordinator.
- `bim/foundations/footing-element-summary.ts` — ΕΝΑ footing recognition + geometry summary
  (`isFootingElement` / `resolveFootingSummary`)· αντικατέστησε τα inline `foundationNode`/
  `foundationSlabNode` του graph.

**Flow:** `foundation-column-attach-coordinator` (pure detection, αμφίδρομα) → `useStructuralAutoAttach`
στο `drawing:entity-created` → `AttachColumnFootingCommand` (undoable, geometry-neutral, persist via
`signalEntitiesAttached`) → emit `bim:column-footing-attached` → `useStructuralOrganism` recompute.

**Files (Phase 2):**
- NEW `bim/foundations/footing-column-coverage.ts`, `footing-element-summary.ts`,
  `foundation-column-attach-coordinator.ts` (+ 2 `__tests__`).
- NEW `core/commands/entity-commands/AttachColumnFootingCommand.ts` (+ `__tests__`).
- MOD `bim/types/column-types.ts` + `column.schemas.ts` (`footingId`, strict schema).
- MOD `bim/structural/organism/structural-organism-types.ts` (`StructuralNode.footingId`),
  `structural-graph.ts` (SSoT helpers + explicit-FK-wins + `__tests__`).
- MOD `hooks/useStructuralAutoAttach.ts` (αμφίδρομο wiring), `hooks/useStructuralOrganism.ts`
  (event), `systems/events/drawing-event-map-bim.ts` (`bim:column-footing-attached`).

## 6c. Phase 4a — Beam reinforcement (auto-reinforcement, mirror κολόνας)

**Στόχος:** ο οπλισμός δοκαριού να παράγεται όπως της κολόνας (data model + code-suggested
intent + derived ποσότητες), ως υπόβαθρο για την οργανική συνέχεια (Phase 4c).

**Μοντέλο:** `BeamReinforcement` = κάτω στρώση (εφελκυσμός) + άνω στρώση (στηρίξεις/αναρτήρες)
+ συνδετήρες (δίτμητοι, πύκνωση άκρων) + cover. Persisted intent στο `BeamParams.reinforcement`
(optional, +Zod strict). Derived ποσότητες (μήκη/βάρος/ρ) on-demand — ΠΟΤΕ persisted.

**SSoT/REUSE (N.0.2):** ο `StructuralCodeProvider` επεκτάθηκε με `beamReinforcementLimits` +
`suggestBeamReinforcement` (υλοποιούν ΚΑΙ οι 2 κανονισμοί EC2/EC8 + ΕΚΩΣ/ΕΑΚ)· ο αλγόριθμος
επιλογής ράβδων εξήχθη σε ΕΝΑ κοινό `resolveBarSet` (κολόνα + δοκάρι). ρ επί ενεργού διατομής
b·d (d ≈ 0.9h)· κρίσιμες ζώνες συνδετήρων lcr ≈ h (EC8 §5.4.3.1.2)· cantilever = 1 κρίσιμη ζώνη.

**Files (Phase 4a):** NEW `reinforcement/beam-reinforcement-types.ts`, `beam-reinforcement-compute.ts`
(+ 2 `__tests__`)· MOD `codes/structural-code-types.ts` (BeamSectionContext+limits+μέθοδοι),
`codes/suggest-reinforcement.ts` (resolveBarSet SSoT + suggestBeamReinforcementFrom),
`codes/eurocode-provider.ts` + `greek-legacy-provider.ts`, `types/beam-types.ts` + `beam.schemas.ts`.

**Σημ.:** flat lap factor (50·Ø) — η πραγματική αγκύρωση στις στηρίξεις εκλεπτύνεται στο Phase 4c.

## 6d. Phase 4b — Footing reinforcement (mirror κολόνας/δοκαριού)

**Στόχος:** ο οπλισμός θεμελίωσης (πέδιλο/πεδιλοδοκός/συνδετήρια) να παράγεται όπως κολόνας/δοκαριού
(data model + code-suggested intent + derived ποσότητες), ως υπόβαθρο για τα dowels πεδίλου↔κολόνας (Phase 4c).

**Μοντέλο (discriminated ανά foundation kind, mirror `FoundationParams`):**
- **`pad`** → `PadReinforcement`: δι-διευθυντική κάτω σχάρα (`bottomMeshX`/`bottomMeshY` = Ø/βήμα) +
  προαιρετική άνω σχάρα + cover. EC2 §9.8.2 / §9.3.1.1 (slab-like).
- **`strip`** → `StripReinforcement`: ανεστραμμένη δοκός — εγκάρσιες (`transverse` mesh) + διαμήκεις
  διανομής (`longitudinal`, **reuse `BeamRebarLayer`**) + προαιρετικοί συνδετήρες (**reuse `BeamStirrups`**).
- **`tie-beam`** → `TieBeamReinforcement extends BeamReinforcement` + discriminator: **είναι δοκός →
  REUSE** (μηδέν duplicate, N.0.2). Suggester + compute **delegate** στο beam path.

Persisted intent στο `FoundationParams.reinforcement` (per-kind, optional, +Zod strict). Derived
ποσότητες (μήκη/βάρος/ρ) on-demand από `footing-reinforcement-compute` — ΠΟΤΕ persisted.

**SSoT/REUSE (N.0.2):** ο `StructuralCodeProvider` επεκτάθηκε με `footingReinforcementLimits` +
`suggestFootingReinforcement` (ΚΑΙ οι 2 κανονισμοί). NEW κοινό `resolveMatMesh` (spacing-based
επιλογή σχάρας — pad×2 + strip εγκάρσιες)· διαμήκεις strip & tie-beam → reuse `resolveBarSet`/beam
suggester. ρ σχάρας επί ενεργού πλακοειδούς διατομής (b=1000, d ≈ thickness−cover)· cover θεμελίωσης
~50mm (έδραση σε έδαφος, EC2 §4.4.1.3)· tie-beam = εναέρια δοκός → beam cover (30mm).

**Files (Phase 4b):** NEW `reinforcement/footing-reinforcement-types.ts`, `footing-reinforcement-compute.ts`
(+ 2 `__tests__`)· MOD `codes/structural-code-types.ts` (FootingSectionContext+limits+2 μέθοδοι),
`codes/suggest-reinforcement.ts` (resolveMatMesh SSoT + suggestFootingReinforcementFrom),
`codes/eurocode-provider.ts` + `greek-legacy-provider.ts`, `types/foundation-types.ts` +
`foundation.schemas.ts` (reinforcement per-kind, strict), `types/beam.schemas.ts` (export schemas για reuse).

**Σημ.:** flat lap factor strip + mat τελικοί γάντζοι (12·Ø) — η οργανική συνέχεια (dowels/αγκυρώσεις)
εκλεπτύνεται στο Phase 4c.

## 6e. Phase 4c — Organism reinforcement continuity (η ΚΑΡΔΙΑ)

**Στόχος:** ο αυτόματος οπλισμός υπολογίζεται σαν **ΕΝΑΣ ενιαίος οργανισμός** — για κάθε στατική
σύνδεση του graph παράγονται **αμφίδρομα** οι αναγκαίες προεκτάσεις (αναμονές/dowels, αγκυρώσεις
κόμβου, ματίσεις ορόφου). Πρότυπο Revit Structural / Analytical Rebar coupling (EC2 §8.4/§8.7, EC8 §5.6).

**Lap/anchorage SSoT (αντικαθιστά το flat 50·Ø):** ο `StructuralCodeProvider` επεκτάθηκε με
`lapLengthMm(Ø, ctx?)` (EC2 §8.7.3 μάτισμα l₀) + `anchorageLengthMm(Ø, ctx?)` (EC2 §8.4.4 αγκύρωση
lbd) — απλοποιημένο μοντέλο `factor·Ø` (eurocode lap 50/anchorage 40· legacy συντηρητικότερα 55/50·
το πλήρες `lb,rqd=(Ø/4)(σsd/fbd)` = DEFER). Οι τροποποιητές συνάφειας/εφελκυσμού (EC2 η₁) ζουν σε
ΕΝΑ SSoT `rebar-catalog.developmentLengthMm` (μηδέν διασκορπισμένα factors, N.0.2). `BarDevelopmentContext`
(concreteGrade DEFER + bond/tension) στο context.

**Continuity layer (pure, DERIVED, ΠΟΤΕ persisted):** NEW `organism/reinforcement-continuity.ts` →
`computeOrganismReinforcementContinuity(graph, entities, provider)`. Ανά edge (κατεύθυνση load-path):
- **`footing-bearing`** → `dowel` (αγκύρωση στο πέδιλο lbd + μάτισμα με κολόνα l₀)· κολόνα-base lap.
- **`column-bearing`** → `anchorage` κάτω/άνω ράβδων δοκαριού στον κόμβο (EC8 §5.6.2)· beam dev ανά στρώση.
- **`top-attachment`** (κολόνα↔κολόνα) → `lap` ορόφου· **αμφίδρομα** (κορυφή κάτω + βάση άνω κολόνας).
- Edge με μέλος χωρίς reinforcement intent → skip (→ flag Phase 4d). Το ΙΔΙΟ item εμφανίζεται στο
  `byMember` ΚΑΙ των δύο εμπλεκόμενων μελών (αμφίδρομο). Επιστρέφει + compute-ready development overrides.

**Compute integration (back-compat):** optional `continuity?` param στα 3 `compute*ReinforcementQuantities`
— όταν δοθεί, η διαμήκης ράβδος παίρνει το πραγματικό joint development αντί flat 50·Ø· αλλιώς flat
fallback (όλα τα προηγούμενα tests περνούν αμετάβλητα). Το compute μένει **provider-free/pure** (ο
continuity layer είναι ο provider-aware — μηδέν cycle). Footing pad own-bars δεν τροφοδοτούνται (οι
dowels που φιλοξενεί = ξεχωριστά items)· strip longitudinal & tie-beam δέχονται override.

**Files (Phase 4c):** NEW `organism/reinforcement-continuity.ts` (+ `__tests__`)· MOD `rebar-catalog.ts`
(`developmentLengthMm` + `BarDevelopmentModifiers` SSoT), `codes/structural-code-types.ts`
(`BarDevelopmentContext` + 2 μέθοδοι), `codes/eurocode-provider.ts` + `greek-legacy-provider.ts`
(lap/anchorage impl), `reinforcement/column|beam|footing-reinforcement-compute.ts` (continuity-aware param).

## 6f. Phase 4d — Reinforcement διαγνωστικά + auto-apply (Revit-grade)

**Στόχος:** δύο deliverables πάνω στον οργανισμό + την οργανική συνέχεια (4c): **(A)** Revit-grade
analytical warnings για τον οπλισμό, **(B)** undoable auto-apply «Αυτόματος Οπλισμός».

**(A) Διαγνωστικά (DERIVED, store/panel — ΠΟΤΕ `entity.validation`):**
- `StructuralDiagnosticSeverity += 'info'`· `StructuralDiagnosticCode += memberMissingReinforcement |
  ratioOutOfRange | barMismatchAtJoint`· `StructuralDiagnostic += messageParams?` (ICU placeholders =
  DERIVED τιμές, ΟΧΙ μεταφρασμένα strings — N.11-safe).
- NEW `organism/reinforcement-checks.ts` → `runReinforcementChecks(graph, entities, provider)`
  (**ξεχωριστή signature** — ΔΕΝ αγγίζει το geometry-only `runOrganismChecks(graph)`):
  - `memberMissingReinforcement` (info) — μέλος (κολόνα/δοκάρι/πέδιλο) χωρίς `params.reinforcement`.
  - `ratioOutOfRange` (warning) — ρ από `compute*Quantities` vs `provider.*Limits` (min/max· θεμελίωση
    slab-like = min μόνο). Δύο μηνύματα: `ratioBelowMin` / `ratioAboveMax` (το θεμέλιο πιάνει μόνο below).
  - `barMismatchAtJoint` (warning) — από το 4c `OrganismContinuityResult`: μήκος ανάπτυξης ≤ 0, ή
    μάτισμα κολόνας↔κολόνας με διαφορετικό πλήθος/διάμετρο διαμήκων (EC2 §8.7 συμβατότητα).
- Surfacing: `useStructuralOrganism` → ΕΝΑ `store.set([...runOrganismChecks, ...runReinforcementChecks])`
  με active code (`useStructuralSettingsStore.codeId` → `resolveStructuralCode`)· subscribe ΚΑΙ στο
  settings store (αλλαγή κανονισμού → re-derive)· `EntityWarningsSection` +info tone (ήπιο, όχι κόκκινο).

**(B) Auto-apply (persisted intent — μόνο μέσω command):**
- NEW `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` (mirror `AttachColumnFootingCommand`):
  batch/undoable· per-kind `provider.suggest*` μέσω SSoT dispatcher· idempotent (skip ήδη-οπλισμένα)·
  geometry-neutral (`updateEntity({kind, params})`)· `prev` αυτούσιο (χωρίς explicit `undefined` → Firestore-safe)·
  persist `signalEntitiesAttached`.
- NEW hook `useStructuralAutoReinforce` (mirror `useStructuralAutoAttach`): ακούει `bim:auto-reinforce-requested`,
  scope **selection→selected· κενή→όλος ο οργανισμός ορόφου**, εκτελεί το command, emit `bim:structural-auto-reinforced`
  (→ organism re-derive + toast ICU plural). Ribbon «Αυτόματος Οπλισμός» **global** στην «Ανάλυση»
  (`analyze-tab`· interception στο `useDxfViewerCallbacks` action→EventBus με `selectedEntityIds`) **+
  contextual** στο δοκάρι & πέδιλο ribbon (parity με την κολόνα· action→bridge `onAction`→emit με το
  επιλεγμένο id· `isBeam/FoundationActionKey` gate στο `useRibbonCommands-action`). Όλα καταλήγουν στο ΕΝΑ
  undoable command.

**Boy-scout SSoT (N.0.2):** NEW `bim/structural/section-context.ts` — ΕΝΑ entity→SectionContext builder
(κολόνα shape-aware/δοκάρι/πέδιλο discriminated) + `buildReinforcePatch` dispatcher. Ο column builder
**εξήχθη** από το inline `column-structural-bridge.ts` (που πλέον delegate-άρει)· τον μοιράζονται bridge +
checks + command — μηδέν duplicate.

**Files (Phase 4d):** NEW `bim/structural/section-context.ts`, `organism/reinforcement-checks.ts`,
`core/commands/entity-commands/AutoReinforceOrganismCommand.ts`, `hooks/useStructuralAutoReinforce.ts`
(+ `__tests__` reinforcement-checks & AutoReinforceOrganismCommand)· MOD `organism/structural-organism-types.ts`
(severity/codes/messageParams), `hooks/useStructuralOrganism.ts` (wire + settings subscribe),
`ui/structural-warnings/EntityWarningsSection.tsx` (info tone + messageParams), `column-structural-bridge.ts`
(delegate SSoT), `systems/events/drawing-event-map-bim.ts` (2 events), `ui/ribbon/data/analyze-tab.ts`
(panel/button), `app/useDxfViewerCallbacks.ts` (action), `hooks/notifications/structural-attach-notifications.ts`
(toast), i18n `dxf-viewer-shell.json` el+en· **contextual buttons:** MOD `beam-command-keys.ts` +
`foundation-command-keys.ts` (+`autoReinforce` action· foundation guard), `useRibbonBeamBridge.ts` +
`useRibbonFoundationBridge.ts` (`onAction` branch), `contextual-beam-tab.ts` + `contextual-foundation-tab.ts`
(structural panel· reuse i18n keys). Diagnostics=DERIVED· reinforcement intent=persisted (command).

## 6g. Phase 4e — Ολοκλήρωση οργανικής συνέχειας (E1 + E3)

Συμπλήρωση των κενών που είχε αφήσει το Phase 4c/4d:

- **E1 — αγκύρωση κορυφής κολόνας σε μη-κολόνα host.** Πριν, το `topAttachmentContinuity`
  επέστρεφε `null` όταν ο host (από πάνω) δεν ήταν κολόνα → καμία προέκταση + κανένα warning.
  Τώρα διασπάται: κολόνα↔κολόνα → `columnLapContinuity` (μάτισμα, ως πριν)· κολόνα→δοκάρι/πλάκα →
  NEW `columnTopAnchorageContinuity` (item `kind:'anchorage'`, οι διαμήκεις αγκυρώνονται με `lbd`
  μέσα στον host — reuse `anchorageLengthMm`, ανάπτυξη μόνο στην κολόνα). NEW diagnostic code
  **`columnTopAnchorageUnverified`** (warning) στο `reinforcement-checks.ts`: οπλισμένη κολόνα με
  top σε host **χωρίς** δικό του reinforcement intent → η αγκύρωση δεν επαληθεύεται (EC8 §5.6).
- **E3 — εδαφόπλακα/raft reinforcement model.** Η `SlabEntity` kind foundation/ground ήταν footing
  node στον graph αλλά χωρίς πραγματικό μοντέλο ποσοτήτων (`SlabParams.reinforcement` = μόνο hint
  enum). NEW `SlabFoundationReinforcement` (δι-διευθυντική σχάρα **top+bottom**, reuse `RebarMesh`) +
  `slab-foundation-reinforcement-compute` (reuse SSoT `meshDirectionTotals`/`footingEffectiveDepthMm`
  του πεδίλου) + provider `slabFoundationReinforcementLimits`/`suggestSlabFoundationReinforcement`
  (EC2 §9.3.1.1 + ΕΚΩΣ, reuse `resolveMatMesh`) + NEW persisted πεδίο `SlabParams.structuralReinforcement`
  (διακριτό από το hint → μηδέν BOQ regression) + ένταξη στο `buildReinforcePatch`
  (`isFoundationSlabEntity`) + κάλυψη στο `reinforcement-checks` (missing/ratio) + `useStructuralAutoReinforce`
  whole-floor scope (η εδαφόπλακα μπαίνει πλέον στο «οπλισμός όλου του ορόφου»).
- **E2 (footing pad own-bar continuity) = SKIP** (Giorgio scope): οριακής αξίας/πιθανό near-no-op —
  οι mat-ράβδοι πεδίλου είναι detailing, όχι connectivity-driven.

**Files (Phase 4e):** NEW `bim/structural/reinforcement/slab-foundation-reinforcement-types.ts` +
`-compute.ts` (+`__tests__`)· MOD `organism/reinforcement-continuity.ts` (E1 split),
`organism/reinforcement-checks.ts` (anchorage check + raft coverage), `organism/structural-organism-types.ts`
(+1 code), `bim/structural/section-context.ts` (+raft ctx/patch/predicate), `bim/structural/codes/*`
(+slab-foundation limits/suggester — MIXED με ADR-460), `bim/structural/reinforcement/footing-reinforcement-compute.ts`
(export mesh SSoT), `bim/types/slab-types.ts` (+`structuralReinforcement`), i18n el+en (+1 warning key).

## 6h. Phase 4f — Manual connectivity UX (ribbon)

Χειροκίνητο attach/detach του αναλυτικού FK `footingId` (Revit Structural «Attach/Detach»). NEW
`DetachColumnFootingCommand` (mirror `AttachColumnFootingCommand`· **αφαιρεί το κλειδί** `footingId`,
Firestore-safe — όχι explicit `undefined`· undoable). UX στην **καρτέλα «Ανάλυση»** (STRUCTURAL_REINFORCE_PANEL,
δίπλα στο «Αυτόματος Οπλισμός»): «Σύνδεση σε πέδιλο» + «Αποσύνδεση πεδίλου». **Selection-driven** (μέσω
`params.selectedEntityIds`) — η «Ανάλυση» είναι **πάντα διαθέσιμη**, σε αντίθεση με τις contextual
καρτέλες που το framework **κρύβει** στην πολλαπλή επιλογή («Πολλαπλή Επιλογή» tab)· γι' αυτό το
selection-pair (πέδιλο + κολόνες) ΔΕΝ μπορεί να ζήσει σε contextual καρτέλα. NEW hook
`useStructuralFootingConnect` (mirror `useStructuralAutoReinforce`): ακούει τα requests, αναλύει την
επιλογή (attach = 1 πέδιλο/εδαφόπλακα target + N κολόνες· detach = επιλεγμένες κολόνες με `footingId`
∪ κολόνες των επιλεγμένων πεδίλων), εκτελεί το undoable command, emit-άρει result events. Events:
requests `bim:column-footing-attach-requested`/`-detach-requested` → results `bim:column-footing-attached-manual`/
`-detached` → toasts + organism re-derive.

**Files (Phase 4f):** NEW `core/commands/entity-commands/DetachColumnFootingCommand.ts` (+`__tests__`),
`hooks/useStructuralFootingConnect.ts`· MOD `systems/events/drawing-event-map-bim.ts` (+4 events),
`app/useDxfViewerCallbacks.ts` (+2 action handlers), `ui/ribbon/data/analyze-tab.ts` (+2 buttons),
`app/DxfViewerContent.tsx` (mount hook), `hooks/useStructuralOrganism.ts` (+2 ORGANISM_EVENTS),
`hooks/notifications/structural-attach-notifications.ts` (+2 toasts), i18n el+en (+labels/tooltips/toasts).

## 6i. Phase 6 — Proactive on-create + cross-level organism (Revit-grade flow)

Το όραμα: ο μηχανικός σχεδιάζει κολόνα → proactive πρόταση «βάλε πέδιλο»· μόλις μπει
→ ενιαίος οπλισμός· 2η κολόνα δίπλα → «επέκτεινε το πέδιλο» (2 κολόνες + 1 πέδιλο =
ένας οργανισμός). Decision Giorgio (2026-06-17): πέδιλο στον **όροφο Θεμελίωσης**
(Revit-canonical) + **non-blocking ConfirmationToast** (mirror `useColumnAdjacencyNotification`).

**Phase 6.0 — Cross-level READ enabler.** Ο οργανισμός ήταν single-level· τα πέδιλα
ζουν στον όροφο Θεμελίωσης ενώ οι κολόνες σε υπέργειο όροφο. NEW SSoT
`systems/levels/building-foundation-level.ts` (`resolveBuildingFoundationLevel` →
foundation `levelId/floorId/sceneFileId` + datum-relative FFL· reuse `buildActiveStoreyContext`).
NEW `bim/structural/organism/cross-level-organism-scene.ts` (`buildOrganismScene` → merge
active+foundation entities + per-entity absolute-FFL map). `structural-graph.ts`
`buildStructuralGraph(entities, { floorElevationByEntityId })` — **absolute-Z offset** ανά
μέλος (footing top/base + column base· beam· default 0 → byte-for-byte single-level).
NEW low-freq `state/foundation-level-store.ts` + owner `hooks/useFoundationLevelSync.ts`
(resolve + async `loadFileV2` fallback για μη-loaded foundation scene, mirror `useFloors3DAggregator`).
`useStructuralOrganism` χτίζει cross-level + subscribe στο store.

**Phase 6.1 — Cross-level WRITE infra.** Ο single-level `useFoundationPersistence` γράφει
ΠΑΝΤΑ στο scope του ενεργού ορόφου → ΔΕΝ μπορεί `CreateFoundationsCommand` για cross-level
create (το `drawing:entity-created` του πιάνεται από το active persistence → λάθος όροφος).
NEW `bim/foundations/foundation-cross-level-writer.ts` — `FoundationFirestoreService` με το
foundation scope (`resolveBimPersistenceScope` με `target.floorId/sceneFileId`) + foundation
scene mutation όταν loaded (αλλιώς η Firestore subscription συγχρονίζει στην επίσκεψη).
fire-and-forget Firestore (μη-κρίσιμο).

**Phase 6.2 — Σενάριο #1 (κολόνα → «βάλε πέδιλο»).** NEW `hooks/useColumnFootingNotification.tsx`
(mirror adjacency): `drawing:entity-created` tool='column', **microtask batch** → prompt ΜΟΝΟ
όταν δημιουργήθηκε ακριβώς ΜΙΑ κολόνα (grid-batch suppressed — το ADR-441 grid foundation flow
το καλύπτει). NEW detection SSoT `bim/foundations/column-footing-suggestion.ts` (`suggestColumnFooting`
→ covered/extend/create, absolute-Z, reuse `footingSupportsColumnBase`). NEW sizing SSoT
`bim/structural/footing-design/suggest-pad-dimensions.ts` (γεωμετρικό min κολόνας+προεξοχή· έδραση
√(N/σ_allow) όταν υπάρχουν φορτίο+σ_allow). confirm → `CreateColumnFootingCommand` (συνθέτει
cross-level writer.create + `AttachColumnFootingCommand` FK — ΕΝΑ undo). `covered` → σιωπηλό FK.

**Phase 6.3 — Σενάριο #3 (επέκταση σε 2η κολόνα).** NEW `bim/foundations/pad-extend.ts`
(`buildExtendedPadParams` → axis-aligned bbox pad+νέα κολόνα+περιθώριο, center-anchored· combined
footing option α — μηδέν νέο type/schema). confirm → `ExtendFootingToColumnCommand` (writer.update
+ FK· prev/next undoable).

**Phase 6.4 — Σενάριο #2 (ενιαίος οπλισμός).** NEW `hooks/useStructuralOrganismNotification.tsx`:
on `bim:column-footing-attached`/`-attached-manual` → αν μέλος χρειάζεται οπλισμό (SSoT
`buildReinforcePatch`) → prompt. confirm: single-level → `bim:auto-reinforce-requested` (υπάρχον
hook)· cross-level → NEW `ReinforceColumnFootingCommand` (συνθέτει `AutoReinforceOrganismCommand`
για κολόνες + writer.update για πέδιλο). Οι συνδέσεις (αναμονές/αγκυρώσεις/ματίσεις) προκύπτουν
αυτόματα DERIVED από τον cross-level `reinforcement-continuity`.

**i18n:** `dxf-viewer-shell.json` `structuralOrganism.{addFooting*,extendFooting*,reinforceOrganism*,proactiveCancel}` (el+en).
**Tests:** building-foundation-level (12) · cross-level-organism (7) · suggest-pad-dimensions (5) ·
column-footing-suggestion (6) · pad-extend (2) · CrossLevelFootingCommands (3) = 35 νέα jest (πράσινα).

**Όρια Phase 6:** combined footing axis-aligned (grid-aligned κολόνες· μη-ευθυγραμμισμένες → συντηρητικό
bbox). Foundation scene write fire-and-forget (Firestore-first· scene sync στην επίσκεψη). Plan XY
κοινό frame μεταξύ ορόφων (ίδια υπόθεση με τον 3D multi-floor stacker). cross-level footing reinforce
δεν είναι ξεχωριστό undo entry από το column reinforce όταν δίνεται μέσω auto-reinforce request.

## 6j. Phase 7 — Αυτόματος Σχεδιασμός Θεμελίωσης (auto-decide isolated vs combined)

**Όραμα Giorgio:** η εφαρμογή **αποφασίζει αυτόματα** (διεθνής πρακτική στατικών — φορτία, τάσεις εδάφους
σ_allow, οπλισμένο σκυρόδεμα) αν τα πέδιλα μένουν **μεμονωμένα** ή ενώνονται σε **combined**, τα διαστασιολογεί
από φορτία/τάσεις, και **πάντα** οπλίζει στη σύνδεση — **χωρίς ερώτηση** (μετάβαση από «ερώτησης» toasts →
**αυτόματη απόφαση + info feedback**). Αντικαθιστά τη Phase 6 detection (σταθερό όριο 3 m) με **engineering
reconciler** πάνω στην ίδια cross-level υποδομή.

**Engine (pure, DERIVED, ΠΟΤΕ persisted):**
- NEW `bim/foundations/auto-foundation-layout.ts` — `planFoundationLayout(columns, σ_allow, sceneUnits)`:
  (1) απαιτούμενο μεμονωμένο pad κάθε κολώνας (SSoT `suggestPadDimensions`: A_req=N/σ + γεωμετρικό min)·
  (2) **κανόνας ένωσης** = τα απαιτούμενα pads επικαλύπτονται ή καθαρό κενό < `MIN_PAD_CLEARANCE_MM` (100 mm)·
  grouping **transitive** μέσω **union-find**· (3) ομάδα ≥2 → **combined** ορθογώνιο κεντραρισμένο στο
  **κέντρο βάρους φορτίων** (ομοιόμορφη πίεση → μηδέν καθαρή ροπή), εμβαδόν ≥ ΣN/σ_allow.
- NEW `bim/foundations/auto-foundation-reconcile.ts` — `reconcileFoundationLayout(plan, existingAutoFootings,
  columns, sceneUnits)` → `{ creates, removeFootingIds }`. Match = ίδιο σύνολο κολωνών (FK key) + γεωμετρία
  εντός ανοχής (50 mm pos/dim) → **idempotent** (καμία αλλαγή → κενό diff· μικρές μετακινήσεις → no-op).

**Apply (auto, ΟΧΙ ερώτηση):**
- NEW `core/commands/entity-commands/ApplyFoundationLayoutCommand.ts` — ΕΝΑ undoable batch: cross-level
  writer `remove`/`create` + FK attach (`AttachColumnFootingCommand`) + **πάντα** οπλισμός
  (`ReinforceColumnFootingCommand`). Συνθέτει αποκλειστικά υπάρχοντα commands (μηδέν νέα μηχανική).
- REWRITE `hooks/useColumnFootingNotification.tsx` → NEW `hooks/useAutoFoundationDesign.tsx`: level-wide,
  coalesced microtask σε `drawing:entity-created` / `bim:column-params-updated` / **`bim:entities-moved`**
  (drag-move) / `-delete-requested` / `bim:structural-loads-computed` → plan → reconcile → batch → **info
  toast** (`autoFoundation.applied`). (Το `useStructuralOrganism` ακούει πλέον κι αυτό το `bim:entities-moved`.)
  Gate: τρέχει μόνο όταν υπάρχει διακριτός όροφος Θεμελίωσης (`fl.target`).
- REWRITE `hooks/useStructuralOrganismNotification.tsx` → **αυτόματος** οπλισμός στη σύνδεση (χωρίς
  ConfirmationToast)· idempotent (belt-and-suspenders για άλλα attach paths, π.χ. cross-floor copy).
- NEW `core/commands/entity-commands/DeleteCrossLevelFootingsCommand.ts` + branch στο `hooks/canvas/useSmartDelete.ts`:
  **3Δ delete cross-level πεδίλου**. Επιλογή πεδίλου στο 3Δ (ζει στον όροφο Θεμελίωσης) + Delete ενώ ο ενεργός
  όροφος είναι άλλος → ο level-scoped adapter δεν το έβρισκε → **silent fail**. FIX: ο smart-delete εντοπίζει
  selected ids που λείπουν από τον ενεργό όροφο αλλά υπάρχουν ως foundation στο `foundation-level-store` →
  διαγραφή cross-level (writer remove: scene + Firestore + store) + `DetachColumnFootingCommand` (clear FK) +
  clear 2Δ/3Δ selection· undoable.

**Ownership (κρίσιμο):** NEW optional `FoundationCommonParams.autoDesigned` flag (Firestore-safe omit-when-absent).
Ο reconciler διαχειρίζεται **μόνο** auto πέδιλα· κολώνες πάνω σε **χειροκίνητο** πέδιλο (FK ή spatial coverage)
εξαιρούνται απόλυτα. Τα ADR-441 grid foundations (strip/tie-beam, μη-auto) μετρούν ως χειροκίνητα → οι κολώνες
τους δεν παίρνουν διπλό auto pad.

**Καθαρή αντικατάσταση (deleted, superseded):** `column-footing-suggestion.ts` (3 m detection), `pad-extend.ts`
(1→1 combine, γενικεύτηκε σε N στο layout engine), `CreateColumnFootingCommand`, `ExtendFootingToColumnCommand`,
`useColumnFootingNotification.tsx` + τα tests τους. 13 νέα jest (layout 8 + reconcile 5).

**Όρια Phase 7 (DEFER):** combined footing axis-aligned ορθογώνιο (rotated-axis / μη grid-aligned, trapezoidal
για πολύ άνισα φορτία = DEFER)· λεπτομερής combined punching/flexure (v1 bearing-governed)· eccentric/strap
footing (όριο οικοπέδου — δεν υπάρχουν property lines)· integration με ADR-441 grid-foundation flow (σήμερα
συνυπάρχουν: grid → χειροκίνητα, manual κολώνες → auto).

## 7. Known limitations (→ Phase 3+)

- `beamUnsupportedEnd` αγνοεί στήριξη από **τοίχο** (Phase 1 = κολόνες μόνο) → πιθανό false-warn
  σε δοκάρι που πατά σε τοίχο.
- Section adequacy advisory + auto-suggest μεγαλύτερης διατομής (Phase 3) = DEFER.
- Καμία strength/loads ανάλυση (Phase 5 — ξεχωριστό ADR).
- E2 (footing pad organism-aware end-anchorage) = DEFER (οριακής αξίας).

## 8. Changelog

- **2026-06-17 (v8, Opus):** **Phase 7 — Αυτόματος Σχεδιασμός Θεμελίωσης (§6j).** Decision Giorgio: η εφαρμογή
  αποφασίζει αυτόματα μεμονωμένο vs combined + διαστάσεις + οπλισμός (διεθνής πρακτική), χωρίς ερώτηση → info.
  **Engine:** NEW pure `auto-foundation-layout.ts` (union-find overlap/clearance 100 mm + combined load-centroid,
  εμβαδόν ≥ ΣN/σ· reuse `suggestPadDimensions`) + `auto-foundation-reconcile.ts` (diff vs existing-auto, key=FK
  set + geom tol 50 mm, idempotent). **Apply:** NEW `ApplyFoundationLayoutCommand` (undoable batch: writer
  remove/create + attach + πάντα reinforce, συνθέτει υπάρχοντα). **Hooks:** `useColumnFootingNotification` →
  REWRITE `useAutoFoundationDesign` (level-wide, coalesced, info toast)· `useStructuralOrganismNotification` →
  αυτόματος reinforce (no prompt). **Ownership:** NEW `FoundationCommonParams.autoDesigned` (reconciler αγγίζει
  μόνο auto πέδιλα· χειροκίνητα/grid → εξαίρεση κολωνών). **Deleted (superseded):** `column-footing-suggestion`,
  `pad-extend`, `CreateColumnFootingCommand`, `ExtendFootingToColumnCommand` + tests. 13 νέα jest πράσινα
  (layout 8 + reconcile 5· +498 entity-command/foundation/organism αμετάβλητα). i18n el+en `autoFoundation.applied`.
  UNCOMMITTED (browser-verify + commit + tsc από Giorgio· shared tree → git add ΜΟΝΟ δικά μου). ⚠️ 2 pre-existing
  failures (`AssignWallTypeCommand`/`UpdateColumnParamsCommand` — firebase `fetch`-in-node infra, άσχετα).
  DEFER: rotated/trapezoidal combined, combined punching/flexure, strap/eccentric, ADR-441 grid integration.
  **Bugfix (browser-verify «νέο πέδιλο δημιουργήθηκε αλλά τα 2 παλιά δεν σβήστηκαν»):** ο reconciler διάβαζε
  τα existing footings από το `foundation-level-store` που ενημερώνεται **async** (event-driven refresh) →
  stale/empty read → `existingAutoFootings=[]` → καμία αφαίρεση. FIX: (α) ο `foundation-cross-level-writer`
  ενημερώνει **optimistically** το store (NEW `upsertEntity`/`removeEntity`)· (β) ο `useAutoFoundationDesign`
  διαβάζει τη **live foundation scene** (`getLevelScene(target.levelId)`) όταν είναι φορτωμένη, αλλιώς το
  (πλέον σύγχρονο) store· (γ) NEW `autoDesigned` στο foundation Zod schema (CommonParamsShape) για πληρότητα.
  ΜΑΘΗΜΑ: cross-level reconcile χρειάζεται **σύγχρονη** εικόνα των υπαρχόντων — ο async sync hook δεν αρκεί.
  **Feature (3Δ delete cross-level πεδίλου):** NEW `DeleteCrossLevelFootingsCommand` + `useSmartDelete` branch —
  επιλογή πεδίλου στο 3Δ + Delete (ενώ ενεργός όροφος = άλλος) διαγράφει πλέον το cross-level πέδιλο (writer
  remove + DetachColumnFootingCommand FK + clear selection· undoable). Πριν: silent fail (level-scoped adapter).
- **2026-06-17 (v7, Opus):** **Phase 6 — Proactive on-create + cross-level organism.** Decision Giorgio:
  πέδιλο στον όροφο Θεμελίωσης (Revit-canonical) + non-blocking ConfirmationToast. **6.0 cross-level READ:**
  NEW `building-foundation-level.ts` + `cross-level-organism-scene.ts` + `foundation-level-store.ts` +
  `useFoundationLevelSync.ts`· `buildStructuralGraph` absolute-Z offset (back-compat default 0)·
  `useStructuralOrganism` cross-level. **6.1 cross-level WRITE:** NEW `foundation-cross-level-writer.ts`
  (foundation-scoped Firestore + scene mutation — ΟΧΙ μέσω single-level `useFoundationPersistence`).
  **6.2 «βάλε πέδιλο»:** NEW `useColumnFootingNotification.tsx` (microtask batch, grid suppressed) +
  `column-footing-suggestion.ts` + `suggest-pad-dimensions.ts` + `CreateColumnFootingCommand`.
  **6.3 «επέκταση»:** NEW `pad-extend.ts` + `ExtendFootingToColumnCommand`. **6.4 «ενιαίος οπλισμός»:**
  NEW `useStructuralOrganismNotification.tsx` + `ReinforceColumnFootingCommand`. 35 νέα jest (πράσινα·
  +550 υπάρχοντα structural/foundation αμετάβλητα). i18n el+en. UNCOMMITTED (browser-verify + commit +
  tsc από Giorgio· shared tree → git add ΜΟΝΟ δικά μου). ⚠️ 2 pre-existing failures στο
  `foundation-preview-helpers.test.ts` (άσχετα — δεν αγγίχτηκε). Όρια: combined footing axis-aligned·
  foundation write fire-and-forget· κοινό plan XY frame μεταξύ ορόφων.
  **Bugfix (browser-verify 2026-06-17, Giorgio «πέδιλο μέσα στην κολόνα»):** το `FoundationEntity.topElevationMm`
  είναι **ΑΠΟΛΥΤΟ** (datum-relative· `foundation-to-three` αγνοεί σκόπιμα το floorElevationMm, ADR-369),
  σε αντίθεση με column/beam/slab (floor-relative). Είχα (α) αφαιρέσει το foundation FFL στη δημιουργία
  → πέδιλο +|FFL| ψηλά μέσα στην κολόνα, και (β) προσθέσει floorElevationMm στο footingNode → double-count.
  FIX: NEW SSoT `footingAbsoluteZ(summary, floorElevationMm)` (foundation=+0· foundation-slab=+floorElev)
  στο `footing-element-summary.ts`· wired graph footingNode + column-footing-suggestion· creation
  `topElevationMm = columnBaseAbs` (όχι −foundationFFL). ΜΑΘΗΜΑ: foundation Z = absolute· slab/column/beam = floor-relative.
- **2026-06-15 (v6, Opus):** Phase 4e (E1+E3) + Phase 4f implemented. **E1:** `topAttachmentContinuity`
  split → κολόνα→μη-κολόνα host = anchorage (`lbd`) αντί `null` + NEW warning `columnTopAnchorageUnverified`.
  **E3:** NEW `SlabFoundationReinforcement` (raft top+bottom δι-διευθυντική σχάρα) + compute + provider
  (slab-foundation limits/suggester, EC2/ΕΚΩΣ, reuse `resolveMatMesh`/mesh SSoT) + `SlabParams.structuralReinforcement`
  (διακριτό από hint) + `buildReinforcePatch`/`reinforcement-checks` raft coverage. E2 = SKIP (scope Giorgio).
  **Phase 4f:** NEW `DetachColumnFootingCommand` (key-removal, undoable) + NEW `useStructuralFootingConnect`
  hook + «Ανάλυση» κουμπιά «Σύνδεση/Αποσύνδεση πεδίλου» (**selection-driven** — όχι contextual καρτέλα, που
  κρύβεται στην πολλαπλή επιλογή) + 4 events + 2 toasts + organism re-derive. 18 νέα jest
  (slab-foundation 8 + checks/continuity +6 + DetachCommand 4· 290 structural/bridge σύνολο πράσινα). tsc clean.
  UNCOMMITTED (browser-verify + commit από Giorgio). ⚠️ `codes/*` MIXED με ADR-460 → git add ΜΟΝΟ δικά μου.
  DEFER: Phase 3 (section adequacy advisory), Phase 5 (loads — ξεχωριστό ADR), E2.
- **2026-06-15 (v5, Opus):** Phase 4d (reinforcement διαγνωστικά + auto-apply) implemented. (A) NEW
  `organism/reinforcement-checks.ts` `runReinforcementChecks` (memberMissingReinforcement/ratioOutOfRange/
  barMismatchAtJoint· ξεχωριστή signature από το geometry-only `runOrganismChecks`) + types επέκταση
  (`info` severity, 3 codes, `messageParams`) + surfacing wiring (active code + settings subscribe) +
  `EntityWarningsSection` info tone. (B) NEW `AutoReinforceOrganismCommand` (undoable batch, idempotent,
  geometry-neutral) + `useStructuralAutoReinforce` hook (scope selection→selected/κενή→όλος ο όροφος) +
  ribbon «Αυτόματος Οπλισμός» (global «Ανάλυση» + contextual δοκάρι/πέδιλο — parity με κολόνα) + toast. Boy-scout: NEW SSoT `bim/structural/section-context.ts`
  (entity→SectionContext + `buildReinforcePatch`· column builder εξήχθη από bridge → delegate). 12 νέα jest
  (reinforcement-checks 11 + command 5· 272 structural/bridge σύνολο πράσινα). UNCOMMITTED (browser-verify +
  commit από Giorgio). DEFER: top-attachment host μη-κολόνα warning, AutoReinforce ως per-kind ribbon split,
  footing-slab reinforcement, ρ-warning στο 3Δ overlay.
- **2026-06-15 (v4, Opus):** Phase 4b (footing reinforcement) implemented. NEW `FootingReinforcement`
  discriminated model (pad σχάρα / strip ανεστραμμένη δοκός / tie-beam reuse `BeamReinforcement`) +
  `footing-reinforcement-compute` (tie-beam delegate σε beam compute) + provider επέκταση
  (footing limits/suggester σε EC2/EC8 + ΕΚΩΣ/ΕΑΚ) + NEW κοινό `resolveMatMesh` (spacing-based SSoT) +
  `FoundationParams.reinforcement` per-kind (+Zod strict· export beam schemas για reuse). 21 νέα jest
  (177 structural σύνολο). UNCOMMITTED (browser-verify + commit από Giorgio). DEFER 4c/4d.
- **2026-06-15 (v3, Opus):** Phase 4a (beam reinforcement) implemented. NEW `BeamReinforcement`
  model + `beam-reinforcement-compute` + provider επέκταση (beam limits/suggester σε EC2/EC8 +
  ΕΚΩΣ/ΕΑΚ) + κοινό `resolveBarSet` (κολόνα+δοκάρι SSoT) + `BeamParams.reinforcement` (+Zod strict).
  16 νέα jest (156 structural σύνολο). UNCOMMITTED. DEFER 4b/4c/4d.
- **2026-06-15 (v2, Opus):** Phase 2 (explicit FK κολόνα↔πέδιλο) implemented. NEW `footingId`
  αναλυτικό FK + 2 SSoT helpers (coverage + footing-summary, εξαγωγή από graph — μηδέν duplicate)
  + coordinator (αμφίδρομος) + `AttachColumnFootingCommand` (undoable, geometry-neutral) + αμφίδρομο
  auto-attach + graph «explicit-FK-wins». 18 νέα jest (47 σύνολο organism+foundation+command).
  UNCOMMITTED (browser-verify + commit από Giorgio).
- **2026-06-15 (v1, Opus):** Phase 0 (graph) + Phase 1 (3 checks + surfacing) implemented.
  11 jest. UNCOMMITTED (browser-verify + commit από Giorgio).
