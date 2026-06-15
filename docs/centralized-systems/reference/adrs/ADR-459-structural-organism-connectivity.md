# ADR-459 — Structural Organism / Analytical Connectivity Model

**Status:** ACTIVE (Phase 0 + Phase 1 + Phase 2 + Phase 4a implemented 2026-06-15)
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
| 4b | Footing reinforcement (pad/strip/tie-beam mat + dowels) | ⏳ |
| 4c | Organism continuity (ματίσεις/αναμονές/αγκυρώσεις στις συνδέσεις, αμφίδρομα) | ⏳ |
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

## 7. Known limitations (→ Phase 3+)

- `beamUnsupportedEnd` αγνοεί στήριξη από **τοίχο** (Phase 1 = κολόνες μόνο) → πιθανό false-warn
  σε δοκάρι που πατά σε τοίχο.
- `footingId` εδραιώνεται **αυτόματα** στη δημιουργία (πέδιλο/κολόνα). Χειροκίνητο
  attach/detach από ribbon + manual override = DEFER (Phase 3+).
- Καμία strength/loads ανάλυση (Phase 5).

## 8. Changelog

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
