# ADR-459 — Structural Organism / Analytical Connectivity Model

**Status:** ACTIVE (Phase 0 + 1 + 2 + 4a + 4b + 4c + 4d implemented 2026-06-15)
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
Firestore-safe — όχι explicit `undefined`· undoable). UX στο **foundation contextual ribbon** (όχι
στην κολόνα — αποφυγή του MIXED `column-command-keys.ts`): panel «Συνδεσιμότητα» με «Σύνδεση κολόνων»
(selection-pair: τα ΕΠΙΛΕΓΜΕΝΑ columns → attach στο ενεργό πέδιλο) + «Αποσύνδεση κολόνων» (ΟΛΕΣ οι
κολόνες που εδράζονται στο πέδιλο → detach). Events `bim:column-footing-attached-manual`/
`bim:column-footing-detached` → toasts + organism re-derive.

**Files (Phase 4f):** NEW `core/commands/entity-commands/DetachColumnFootingCommand.ts` (+`__tests__`)·
MOD `foundation-command-keys.ts` (+2 actions), `useRibbonFoundationBridge.ts` (+2 handlers),
`contextual-foundation-tab.ts` (+connectivity panel), `systems/events/drawing-event-map-bim.ts` (+2 events),
`hooks/useStructuralOrganism.ts` (+2 ORGANISM_EVENTS), `hooks/notifications/structural-attach-notifications.ts`
(+2 toasts), i18n el+en (+labels/tooltips/toasts).

## 7. Known limitations (→ Phase 3+)

- `beamUnsupportedEnd` αγνοεί στήριξη από **τοίχο** (Phase 1 = κολόνες μόνο) → πιθανό false-warn
  σε δοκάρι που πατά σε τοίχο.
- Section adequacy advisory + auto-suggest μεγαλύτερης διατομής (Phase 3) = DEFER.
- Καμία strength/loads ανάλυση (Phase 5 — ξεχωριστό ADR).
- E2 (footing pad organism-aware end-anchorage) = DEFER (οριακής αξίας).

## 8. Changelog

- **2026-06-15 (v6, Opus):** Phase 4e (E1+E3) + Phase 4f implemented. **E1:** `topAttachmentContinuity`
  split → κολόνα→μη-κολόνα host = anchorage (`lbd`) αντί `null` + NEW warning `columnTopAnchorageUnverified`.
  **E3:** NEW `SlabFoundationReinforcement` (raft top+bottom δι-διευθυντική σχάρα) + compute + provider
  (slab-foundation limits/suggester, EC2/ΕΚΩΣ, reuse `resolveMatMesh`/mesh SSoT) + `SlabParams.structuralReinforcement`
  (διακριτό από hint) + `buildReinforcePatch`/`reinforcement-checks` raft coverage. E2 = SKIP (scope Giorgio).
  **Phase 4f:** NEW `DetachColumnFootingCommand` (key-removal, undoable) + foundation-ribbon «Συνδεσιμότητα»
  panel (attach selected / detach all) + 2 events + 2 toasts + organism re-derive. 18 νέα jest
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
