# ADR-459 — Structural Organism / Analytical Connectivity Model

**Status:** ACTIVE (Phase 0 + 1 + 2 + 4a + 4b + 4c + 4d + 4e + 4f implemented 2026-06-15· Phase 6 proactive + cross-level 2026-06-17· **Phase 7 Αυτόματος Σχεδιασμός Θεμελίωσης 2026-06-17· Phase 7 cross-level footing rendering all-floors + drift resilience 2026-06-17 (v8.1)· cross-level autosave-origin fix 2026-06-17 (v8.2)· Revit-grade footing in-place update + atomic undo 2026-06-17 (v8.3)· **3Δ rotate/resize→footing follow via kind→event emit SSoT 2026-06-17 (v8.4)· **Phase 8 PROACTIVE auto-reinforce οργανισμού 2026-06-17 (v9)· **Phase 9 Slice 1 PROACTIVE real-time φορτία 2026-06-17 (v10)**)
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

## 6k. Phase 8 — PROACTIVE αυτόματος οπλισμός οργανισμού (organism grows → οπλίζεται μόνο του)

**Όραμα Giorgio:** ο αυτόματος οπλισμός του οργανισμού (Φ4d) έτρεχε **ΜΟΝΟ με κουμπί** («Αυτόματος Οπλισμός»,
καρτέλα Ανάλυση → `bim:auto-reinforce-requested`). Να γίνεται **proactive** — να υπολογίζεται **αυτόματα** μόλις
ο οργανισμός **δημιουργείται/μεγαλώνει** (π.χ. ενώνεις 2 κολόνες με δοκάρι → ο ενιαίος οργανισμός οπλίζεται
μόνος του), **όπως το Φ7 auto-foundation design**. Ο πυρήνας (`AutoReinforceOrganismCommand` idempotent +
`buildReinforcePatch` SSoT) **υπήρχε ολόκληρος** — έλειπε **μόνο** ο proactive trigger.

**SSoT extraction (μηδέν διπλότυπο):**
- NEW `hooks/structural-auto-reinforce-core.ts` — light module (σκόπιμα **χωρίς** firebase/store imports →
  jest-clean): `isReinforceable(e)` + `runOrganismAutoReinforce(levelManager, entityIds, provider, exec)` =
  resolve scope (επιλεγμένα ids → επιλεγμένα μέλη· κενό → όλος ο reinforceable οργανισμός ορόφου) → build ΕΝΑ
  `AutoReinforceOrganismCommand` → `exec(cmd)` (`execute` ή `executeGrouped`, αποφασίζει ο caller) → emit
  `bim:structural-auto-reinforced`. Ο `provider` περνιέται **injected** (ο caller διαβάζει `structural-settings-store`).
- `useStructuralAutoReinforce` (ribbon) → καλεί τον πυρήνα με `entityIds` (selection) + `execute`. Μηδέν αλλαγή
  συμπεριφοράς. Ο **ίδιος** πυρήνας τροφοδοτεί και τον proactive trigger.

**Proactive trigger (mirror `useAutoFoundationDesign`):**
- NEW `hooks/useProactiveOrganismReinforce.ts` — ακούει geometry-growth events
  (`drawing:entity-created`, `bim:{column,beam,foundation}-params-updated`, `bim:entities-moved`,
  `bim:{columns,beams,foundations}-from-grid`) → coalesced microtask → πυρήνας με scope **«όλος ο οργανισμός
  ορόφου»** (`[]`). **Atomic undo:** geometry-edit triggers → `executeGrouped` (ΕΝΑ Ctrl+Z αναιρεί δοκάρι+οπλισμό
  μαζί)· batch/from-grid → standalone `execute`. **Σιωπηλός (Revit-grade):** καμία ειδοποίηση (το ribbon path
  ούτε αυτό κάνει toast). Mounted στο `DxfViewerContent` δίπλα στα structural hooks.
- **Loop guard (κρίσιμο):** ΔΕΝ ακούει `bim:structural-auto-reinforced` (αλλιώς κύκλος)· ΔΕΝ ακούει
  `bim:column-footing-attached` (ανήκει στο cross-level path του `useStructuralOrganismNotification` Φ7 →
  αποφυγή διπλού trigger). Idempotent → re-run = no-op.

**Race με Φ7 auto-foundation (ίδιο event batch):** το πέδιλο δημιουργείται **ΚΑΙ** οπλίζεται μέσα στο
`ApplyFoundationLayoutCommand`. Αν ο proactive reinforce τρέξει μετά → ήδη οπλισμένο → skip (idempotent). Αβλαβές
και από τις δύο σειρές microtask (cross-level πέδιλο = εκτός active scene → ο proactive δεν το αγγίζει καθόλου).

**Όρια Phase 8 (DEFER):** οπλίζει **νέα/μη-οπλισμένα** μέλη· **ΔΕΝ** ξανα-διαστασιολογεί τον οπλισμό μιας **ήδη
οπλισμένης** κολόνας όταν αλλάξει η διατομή της (resize) — το «re-design on stale reinforcement intent» = ξεχωριστό
θέμα. Η **συνέχεια οπλισμού στους κόμβους** (dowels/anchorage/lap) είναι ήδη DERIVED diagnostic (Φ4c) proactive.

**Files Phase 8:** NEW `hooks/structural-auto-reinforce-core.ts` · NEW `hooks/useProactiveOrganismReinforce.ts` ·
NEW `hooks/__tests__/structural-auto-reinforce-core.test.ts` (7 jest) · MOD `hooks/useStructuralAutoReinforce.ts`
(→ core) · MOD `app/DxfViewerContent.tsx` (mount).

## 6l. Phase 9 — PROACTIVE real-time φορτία (το ΠΡΩΤΟ σκαλί της αλυσίδας)

**Όραμα (Slice 1 του Φ9):** ο μηχανικός σχεδιάζει σταδιακά και η εφαρμογή είναι ο στατικός του βοηθός σε
πραγματικό χρόνο. Ο load-path engine (ADR-467) υπολόγιζε τα φορτία **μόνο με κουμπί** («Υπολογισμός Φορτίων»)·
έτσι η αλυσίδα `φορτία → sizing πεδίλων → διαγνωστικά` δεν έτρεχε ποτέ αυτόματα. Το Φ9 Slice 1 κάνει τα **φορτία
proactive** — mirror του Φ7 (auto-foundation) / Φ8 (auto-reinforce).

**SSoT extraction:** NEW `hooks/structural-load-takedown-core.ts` (light, jest-clean — `settings` + `getOffset`
injected, καμία firebase/store chain) με `runStructuralLoadTakedown(levelManager, settings, getOffset, exec)` →
χτίζει graph, `computeLoadPathPatches`, εκτελεί `ComputeLoadPathCommand`, emit `bim:structural-loads-computed`.
Ο ribbon `useStructuralLoadTakedown` τον καλεί → **μηδέν διπλότυπο**.

**Proactive trigger:** NEW `hooks/useProactiveStructuralLoads.ts` (mirror `useProactiveOrganismReinforce`) —
load-topology events (κολόνα/δοκάρι create/move/delete/from-grid) → coalesced microtask → core. `executeGrouped`
(atomic undo: μέλος+φορτία+πέδιλο+οπλισμός σε ΕΝΑ Ctrl+Z) για geometry-edit triggers, `execute` standalone για
from-grid· **σιωπηλός**.

**Ντετερμινιστική σειρά (κρίσιμο):** mounted **ΠΡΙΝ** από `useStructuralOrganism`/`useAutoFoundationDesign` στο
shell ⇒ ο load handler καλείται πρώτος στο microtask flush, εκτελεί+emit-άρει **σύγχρονα**, και το
ήδη-προγραμματισμένο foundation microtask διαβάζει το φρέσκο `appliedLoad` → **ΕΝΑ pass** (όχι 2-pass flicker).
Το `bim:structural-loads-computed` ανήκει ήδη στα `AUTO_DESIGN_EVENTS` (Φ7) + `ORGANISM_EVENTS` (Φ1) → τα
downstream στάδια αλυσιδώνονται μόνα τους.

**Loop guard:** ο proactive loads hook **δεν** ακούει το δικό του `loads-computed`, ούτε τα παράγωγα
`column-footing-attached` / `structural-auto-reinforced` / `foundation-params-updated` (αλλιώς κύκλος). Ο
command είναι ούτως ή άλλως idempotent (manual-override guard `isTakedownWritable`).

**Όρια Phase 9 Slice 1 (DEFER → Slice 2/3, ξεχωριστό spec):** ο suggester οπλισμού είναι **geometry-based**
(ρ_min·Ac, καμία αξονική) → ο οπλισμός κολόνας/δοκαριού **ΔΕΝ** αλλάζει με τα φορτία. Μόνο τα **πέδιλα** (ήδη
load-aware: A_req=N/σ) ξανα-διαστασιολογούνται proactively. Το **load-aware strength design** (As από N/M, EC2 §6.1
— πραγματικό «re-design ήδη-οπλισμένων») = Slice 2/3, βλ. ADR-472.

**Files Phase 9 Slice 1:** NEW `hooks/structural-load-takedown-core.ts` · NEW `hooks/useProactiveStructuralLoads.ts` ·
NEW `hooks/__tests__/structural-load-takedown-core.test.ts` (6 jest) · MOD `hooks/useStructuralLoadTakedown.ts`
(→ core) · MOD `app/DxfViewerContent.tsx` (mount, σειρά πριν organism/foundation).

## 7. Known limitations (→ Phase 3+)

- `beamUnsupportedEnd` αγνοεί στήριξη από **τοίχο** (Phase 1 = κολόνες μόνο) → πιθανό false-warn
  σε δοκάρι που πατά σε τοίχο.
- Section adequacy advisory + auto-suggest μεγαλύτερης διατομής (Phase 3) = DEFER.
- Καμία strength/loads ανάλυση (Phase 5 — ξεχωριστό ADR).
- E2 (footing pad organism-aware end-anchorage) = DEFER (οριακής αξίας).

## 8. Changelog

- **2026-06-17 (v10, Opus):** **Phase 9 Slice 1 — PROACTIVE real-time φορτία (§6l).** Ο load-path engine
  (ADR-467) έτρεχε ΜΟΝΟ με ribbon κουμπί· τώρα τα φορτία γίνονται **proactive** σε κάθε load-topology μεταβολή
  (mirror Φ7/Φ8) → η αλυσίδα `φορτία → sizing πεδίλων → διαγνωστικά` τρέχει αυτόματα. **SSoT extraction:** NEW
  `hooks/structural-load-takedown-core.ts` (light, jest-clean — `settings`+`getOffset` injected) με
  `runStructuralLoadTakedown`· ο ribbon `useStructuralLoadTakedown` τον καλεί → μηδέν διπλότυπο. **Proactive
  trigger:** NEW `hooks/useProactiveStructuralLoads.ts` (mirror `useProactiveOrganismReinforce`) με loop-guard +
  atomic-undo grouping. **Ντετερμινιστική σειρά:** mounted πριν organism/auto-foundation → ΕΝΑ pass (το foundation
  microtask διαβάζει φρέσκο `appliedLoad`). 6 νέα jest. **DEFER (ADR-472):** load-aware strength suggester (As από
  N/M — πραγματικό re-design ήδη-οπλισμένων κολόνων/δοκών).
- **2026-06-17 (v9, Opus):** **Phase 8 — PROACTIVE αυτόματος οπλισμός οργανισμού (§6k).** Ο auto-reinforce έτρεχε
  ΜΟΝΟ με ribbon κουμπί· τώρα γίνεται **αυτόματα** μόλις ο οργανισμός μεγαλώνει (κολόνα/δοκάρι/from-grid), όπως το
  Φ7 auto-foundation. **SSoT extraction:** NEW `hooks/structural-auto-reinforce-core.ts` (light, jest-clean —
  `provider` injected, καμία firebase chain) με `runOrganismAutoReinforce(levelManager, entityIds, provider, exec)`
  + `isReinforceable`· ο ribbon `useStructuralAutoReinforce` τον καλεί (selection-scope) → **μηδέν διπλότυπο**.
  **Proactive trigger:** NEW `hooks/useProactiveOrganismReinforce.ts` (mirror `useAutoFoundationDesign`) — geometry-
  growth events → coalesced microtask → core με level-wide scope· `executeGrouped` (atomic undo δοκάρι+οπλισμός σε
  ΕΝΑ Ctrl+Z) για geometry-edit triggers, `execute` standalone για from-grid· **σιωπηλός** (Revit-grade). **Loop
  guard:** δεν ακούει `bim:structural-auto-reinforced` (κύκλος) ούτε `bim:column-footing-attached` (το έχει το
  cross-level path Φ7 → no double trigger)· idempotent → re-run no-op. Race με Φ7: πέδιλο ήδη οπλισμένο μέσα στο
  `ApplyFoundationLayoutCommand` → skip. Mount στο `DxfViewerContent`. 7 jest (scope/idempotency/empty-emit/no-level).
  ΜΑΘΗΜΑ: ο οπλισμός είναι **παράγωγο τοπολογίας** → ανανεώνεται proactively, μία φορά, από ΕΝΑ SSoT, ανεξαρτήτως αν
  πατήθηκε κουμπί. 🔴 tsc(Giorgio) + browser-verify (2 κολόνες + δοκάρι ένωσης → οπλίζεται αυτόματα· ΕΝΑ Ctrl+Z
  αναιρεί δοκάρι+οπλισμό· πέδιλο δεν διπλο-οπλίζεται) + commit (git add ΜΟΝΟ δικά μου· ADR-459 shared tree).
- **2026-06-17 (v8.4, Opus):** **3Δ rotate/resize κολώνας → η θεμελίωση ΔΕΝ ακολουθούσε (το 2Δ δούλευε).**
  **Root cause:** ο `useAutoFoundationDesign` ξανα-υπολογίζει σε structural events (`AUTO_DESIGN_EVENTS`).
  Το 3Δ gizmo commit (`bim3d-edit-interaction-handlers.dispatchOutcome` → `getGlobalCommandHistory().execute(cmd)`)
  **δεν εξέπεμπε κανένα** structural event. Το 3Δ **move** δούλευε ΜΟΝΟ επειδή το `MoveEntityCommand`
  **αυτο-εκπέμπει** `bim:entities-moved`· το `RotateEntityCommand` / `Update*ParamsCommand` (rotate/resize/tilt/
  vertical) **δεν αυτο-εκπέμπουν τίποτα** → ο auto-designer δεν πυροδοτούνταν → πέδιλο ακίνητο. (Το 2Δ rotate
  δουλεύει γιατί το hot-grip commit εκπέμπει `bim:column-params-updated`.) **Fix (Επιλογή A — full SSoT):**
  **(1)** NEW SSoT `systems/events/emit-bim-entity-params-updated.ts` — ΕΝΑ kind→event mapper
  (`emitBimEntityParamsUpdated(type,id)`, 21 BIM types → σωστό `*-params-updated` event + payload key,
  type-checked closures, μηδέν `any`· `stair`=no-op). **(2)** NEW `bim-3d/animation/bim3d-edit-structural-emit.ts`
  (`emitStructuralChangeAfterEdit`) — μετά το `execute(cmd)` εκπέμπει ανά edited entity· **skip** όταν ο command
  αυτο-εκπέμπει `bim:entities-moved` (οριζόντιο `MoveEntityCommand`/`MoveMultiple`/Compound-with-move-base) ώστε
  να μην διπλο-ανακοινώνεται. Wired στο `dispatchOutcome` μετά το execute → συνεργάζεται αυτόματα με v8.3 atomic
  undo (microtask `executeGrouped` τυλίγει rotate+footing σε ΕΝΑ Ctrl+Z). **Καλύπτει ΟΛΑ τα 3Δ edits** (rotate +
  resize + tilt + vertical-move follow, όχι μόνο rotate). **(3) Boy-scout SSoT (N.0.2):** τα 2Δ inline emits ανά
  kind (8 grip-commit σημεία: parametric/footprint/centred-box/polygon/heating-host) δε-διπλασιάστηκαν → όλα μέσω
  του ΙΔΙΟΥ helper. 28 jest (kind→event ×21 + skip-logic). ΜΑΘΗΜΑ: μια γεωμετρική αλλαγή δομικού μέλους
  ανακοινώνεται **μία φορά, ΕΝΑ SSoT**, ανεξαρτήτως surface (2Δ grip / 3Δ gizmo / ribbon). 🔴 tsc(Giorgio) +
  browser-verify (3Δ rotate κολώνας → πέδιλο περιστρέφεται in-place· 3Δ move regression) + commit (git add ΜΟΝΟ
  δικά μου· ADR-459 shared tree).
- **2026-06-17 (v8.3, Opus):** **Revit-grade footing follow — in-place update + atomic undo.** Δύο μη-Revit
  συμπεριφορές στο rotation/move κολώνας: (1) ο reconciler **έσβηνε** το παλιό πέδιλο και **δημιουργούσε νέο**
  (delete+create, id churn) αντί να το περιστρέφει επί τόπου· (2) **split undo** — μία ενέργεια χρήστη =
  δύο undo entries (column edit + footing re-derive) → 1η αναίρεση άφηνε **λοξή κολώνα σε ίσιο πέδιλο**
  (ασυνεπής ενδιάμεση κατάσταση). **Τι κάνουν οι μεγάλοι (Revit/AutoCAD):** hosted/associative elements
  έχουν **σταθερή ταυτότητα** (regen γεωμετρίας in-place, ΟΧΙ recreate)· η ενέργεια χρήστη + οι παράγωγες
  ενημερώσεις = **ΕΝΑ transaction** (ένα Ctrl+Z τα αναιρεί μαζί). **Fix (full SSoT):**
  **(Part 1)** `auto-foundation-reconcile` += `updates: FoundationUpdate[]` — ίδιο σύνολο κολωνών + αλλαγμένη
  γεωμετρία → **in-place update** (σταθερό id)· delete+create μένει ΜΟΝΟ για διαλυμένη ομάδα (combined↔isolated,
  νέα ταυτότητα). **(Part 2)** `ApplyFoundationLayoutCommand` += update branch (reuse `writer.update` +
  `ReinforceColumnFootingCommand` — mirror create, create→update· `prev` captured για ακριβές undo).
  **(Part 3)** NEW `core/commands/CompositeCommand.ts` (υλοποιεί το υπάρχον `ICompoundCommand`· execute/redo
  forward, undo reverse) + NEW **additive** `CommandHistory.appendToLast(cmd)` (τυλίγει last+derived σε ΕΝΑ
  atomic undo entry, time-window guard `mergeTimeWindow`) + `useCommandHistory.executeGrouped`. ΔΕΝ αλλάζει
  execute/undo/redo (χαμηλό ρίσκο undo πυρήνα). **(Part 4)** `useAutoFoundationDesign` χτίζει `updateSteps`
  (next = ίδιο existingId, νέα params) + `executeGrouped` για geometry-edit triggers
  (created/params-updated/entities-moved), standalone για loads-computed· i18n el+en += `updated`. 17 jest
  (reconcile updates 2 ανανεωμένα + CompositeCommand 2 + CommandHistory.appendToLast 4 + regression).
  ΜΑΘΗΜΑ: derived/associative entity = stable identity (Revit hosted regen, ΟΧΙ delete+create)· derived
  command = ίδιο transaction με τον trigger (atomic undo). 🔴 tsc(Giorgio) + browser-verify (rotate→πέδιλο
  in-place ίδιο id· ΕΝΑ Ctrl+Z αναιρεί κολώνα+πέδιλο μαζί) + commit (git add ΜΟΝΟ δικά μου).
- **2026-06-17 (v8.2, Opus):** **Fix — cross-level foundation write θόρυβος autosave (ADR-293).** Σύμπτωμα (Giorgio): σε ΚΑΘΕ τοποθέτηση κολώνας → console ERROR `canonicalScenePath is required for DXF scene saves (ADR-293)`. **Root cause:** ο `foundation-cross-level-writer.mutateFoundationScene` καλούσε `io.setLevelScene(foundationLevelId, …)` **χωρίς origin** → default `'local-edit'` → προγραμμάτιζε DXF-scene autosave για τον όροφο Θεμελίωσης· αυτός είναι special level (ADR-461) χωρίς ανεβασμένο DXF → `getFileStoragePath` null → κανένα `canonicalScenePath` → ADR-293 throw (caught, μη-fatal, αλλά θορυβώδες). Τα δεδομένα πεδίλου ΔΕΝ χάνονταν — persist μέσω `svc.saveFoundation()`. **Fix (1 αρχείο, SSoT):** η cross-level εγγραφή είναι DERIVED reconcile write → περνά `origin: 'system-reconcile'` (το `LevelSceneIO.setLevelScene` πήρε optional `origin?: SceneWriteOrigin`· ο `LevelsSystem` forwarder + `useAutoSaveSceneManager` ήδη το τιμούν μέσω `originSchedulesAutoSave`=false). Καλύπτει και τους 3 consumers (`useAutoFoundationDesign`/`useSmartDelete`/`useStructuralOrganismNotification`, όλοι derived). Η σκηνή Θεμελίωσης ενημερώνεται live για εμφάνιση· το κανονικό `'local-edit'` autosave παίζει μόνο όταν ο χρήστης επεξεργαστεί ο ίδιος τον όροφο. 🔴 browser-verify (τοποθέτησε κολώνα → μηδέν ADR-293 error) + commit.
- **2026-06-17 (v8.1, Opus):** **Phase 7 — Cross-level footing rendering (all-floors) + scope-drift resilience.**
  Πρόβλημα (μετά τη v8 ghost stabilization): τα cross-level auto πέδιλα persist σωστά στο
  `floorplan_foundations` (keyed-by-`floorId`, ADR-420) ΑΛΛΑ (α) **δεν φαίνονται** στο 3Δ «Όλοι οι όροφοι»
  και (β) **flicker** στον όροφο Θεμελίωσης. **Root cause A (αρχιτεκτονικό):** οι all-floors aggregators
  (`useFloors3DAggregator` 3Δ + `useBuildingFloorScenes` 2Δ) αντλούσαν το BIM κάθε ορόφου **μόνο** από το
  scene snapshot — όπου τα cross-level auto πέδιλα δεν υπάρχουν ποτέ (το `stripForeignFloorBim` της v8
  αφαίρεσε σωστά το λανθασμένο baking → αποκάλυψε ότι το model-sourcing path δεν υπήρξε ποτέ). **Root cause B
  (data drift):** το πέδιλο doc είχε `floorplanId`=αρχείο **άλλου** ορόφου (corrupted level↔file του test
  project). **Fix (Full SSoT, Revit-grade):** τα cross-level πέδιλα αντλούνται παντού από το **model SSoT
  keyed-by-`floorId`** (το drift γίνεται inert — `floorplanId` = απλό provenance). NEW shared
  `foundationDocToEntity` (SSoT hydrate· reuse στο `useFoundationPersistence`, dedup local `docToEntity`).
  `useFoundationLevelSync` → realtime subscription στο `floorplan_foundations` (scoped `target.floorId`) +
  snapshot base (footings αφαιρεμένα) → NEW store action `publishFoundationLevel` (base + model footings +
  pending optimistic, anti-race με τον writer). NEW pure `replaceFootingsFromModel` (`scene-bim-load-policy`,
  δίπλα στο `stripForeignFloorBim`) — οι aggregators κάνουν override την κατηγορία `foundations` του ορόφου
  Θεμελίωσης με τα model footings (3Δ override `Bim3DEntities.foundations` + synthetic entry· 2Δ
  `replaceFootingsFromModel` + synthetic minimal scene με `EMPTY_BOUNDS`). `FoundationLevelRef` += `projectId`
  (subscription scope). **Fix B guard:** το floorId-keyed sourcing **είναι** το guard (το drift αδρανές)·
  ο πραγματικός καθαρισμός των corrupted level docs = καθαρό test project (browser-verify). 11 νέα jest
  (policy `replaceFootingsFromModel` 6 + `foundationDocToEntity` 5· υπάρχοντα policy/level/auto πράσινα).
  UNCOMMITTED (browser-verify σε καθαρό project + commit + tsc από Giorgio· shared tree → git add ΜΟΝΟ δικά μου).
  ΜΑΘΗΜΑ: cross-level rendering πρέπει να αντλεί από το model SSoT keyed-by-durable-id, ΠΟΤΕ από scene
  snapshot ή volatile provenance — αλλιώς ένα σωστά persisted entity μένει αόρατο.
  **Bugfix (browser-verify «rotation κολώνας → νέο πέδιλο follow αλλά το παλιό δεν διαγράφεται»):** ο
  reconciler (`reconcileFoundationLayout`) είναι σωστός (rotation diff → create new + remove old — locked
  στο reconcile test), αλλά το `useAutoFoundationDesign.recompute` διάβαζε τα existing footings προτιμώντας
  τη **live foundation scene** (`getLevelScene`)· όταν αυτή είναι φορτωμένη αλλά **stale** (τα auto πέδιλα
  ΔΕΝ μπαίνουν ποτέ σε scene snapshot) σκίαζε το model-backed store → το παλιό auto πέδιλο έλειπε από το
  `existingAutoFootings` → 0 removes. FIX: NEW pure `bim/foundations/foundation-footing-candidates.ts`
  `collectFoundationFootings(storeEntities, foundationScene)` — **model SSoT (store) πρωταρχικό** ∪ live scene
  (dedup-by-id, store wins)· ο reconciler βλέπει πλέον πάντα το υπάρχον auto πέδιλο → το διαγράφει στο rotate/
  move. +5 jest. ΜΑΘΗΜΑ: μετά τη μετάβαση σε model-SSoT sourcing, η προτίμηση «live scene first» έγινε
  επικίνδυνη (stale snapshot σκιάζει το SSoT) — το store είναι πλέον το authoritative read.
  **Bugfix #2 (η ΠΡΑΓΜΑΤΙΚΗ αιτία — Firestore MCP audit: `floorplan_foundations` είχε ΜΟΝΟ 1 doc, το νέο
  περιστραμμένο):** το παλιό πέδιλο **διαγραφόταν σωστά από το Firestore** — ήταν **ghost στο
  `foundation-level-store`**. Το `pending` logic του `publishFoundationLevel` (v8.1) διατηρούσε ΟΠΟΙΟΔΗΠΟΤΕ
  store footing απόν από το model ως «optimistic create»· ένα **stale realtime echo** (πριν διαδοθεί το
  Firestore delete) ξανα-πρόσθετε το OLD από το model, και μετά το pending το κρατούσε **αθάνατο** → render
  ghost. FIX: **tombstone tracking** (mirror του `deletedIdsRef` του `useFoundationPersistence`): NEW
  `pendingRemovedIds` set στο store· `removeEntity` → tombstone· `publishFoundationLevel` εξαιρεί tombstoned
  ids από model+pending ώστε stale echo να ΜΗΝ τα ανασταίνει· tombstone καθαρίζεται μόλις ο id λείψει από το
  model (delete διαδόθηκε)· `upsertEntity` (re-create) αίρει το tombstone. +6 jest. ΜΑΘΗΜΑ: optimistic delete
  σε realtime-synced store ΧΡΕΙΑΖΕΤΑΙ tombstone — αλλιώς stale echo + naive «keep-if-not-in-model» pending =
  αθάνατο ghost. Το «δεν σβήνεται» ήταν render-state, ΟΧΙ persistence (το Firestore ήταν σωστό).
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
  **Stabilization (ghost footing — DB audit MCP):** Firestore audit έδειξε `floorplan_foundations` **άδειο**·
  το πέδιλο ήταν baked μέσα στο **scene.json του ΕΝΕΡΓΟΥ ορόφου** με `floorId`=Θεμελίωση/`floorplanId`=ενεργός
  (scope drift από προηγ. iteration)· εμφανιζόταν ΜΟΝΟ στο all-floors view γιατί οι aggregators διαβάζουν raw
  snapshots. **Root principle (Revit-grade SSoT):** ένα floor snapshot περιέχει ΜΟΝΟ τα δικά του entities. NEW
  SSoT `stripForeignFloorBim(scene, ownFloorId)` (write-side companion του `reconcileLoadedSceneBim`, reuse
  `isBimOrStairEntity`) εφαρμοσμένο σε: (α) **autosave** (`useAutoSaveSceneManager` — δεν ψήνεται ποτέ ξανά
  cross-level BIM σε λάθος snapshot), (β) **read-side** all-floors aggregators (`useBuildingFloorScenes` 2Δ +
  `useFloors3DAggregator` 3Δ — legacy ghosts εξαφανίζονται αμέσως στο reload). ΜΑΘΗΜΑ: dual-persistence
  (per-entity collection = SSoT· scene snapshot = cache ΑΛΛΑ κρατά own-floor BIM για το multi-floor 3Δ) → ο
  guard πρέπει να είναι **per-floor** (own vs foreign floorId), ΟΧΙ blanket BIM strip.
  **Feature (rotation follow):** το **μεμονωμένο** πέδιλο κληρονομεί την περιστροφή της κολώνας (Revit hosted).
  `LayoutColumnInput`/`PlannedFooting` += `rotationDeg` (isolated = `column.rotation`, combined = 0· rotation κατά
  τη γραμμή κολωνών = DEFER)· `reconcileFoundationLayout` συγκρίνει πλέον και rotation (tol 0.5°) → περιστροφή
  κολώνας → re-derive πεδίλου με τη νέα γωνία. Πριν: το reconcile αγνοούσε rotation → τετράγωνη κολώνα = ίδιο
  centroid/dims → no-op → το πέδιλο δεν ακολουθούσε. Manual πέδιλα = εκτός auto-follow (DEFER).
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
