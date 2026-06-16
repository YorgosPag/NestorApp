# ADR-467 — Load Path Engine (διαδρομή φορτίων, FEM-free)

**Status:** 🟢 Slices 1-5 DONE 2026-06-17 (Opus, UNCOMMITTED — browser-verify + commit).
**Discipline:** Δομοστατικά / Structural Engineering — ανάλυση φορτίων (όλος ο φορέας).
**Builds on:** ADR-459 (στατικός οργανισμός / graph), ADR-464 (footing tributary takedown + design engines).
**Scope:** Γενίκευση του footing tributary takedown του ADR-464 σε **ΟΛΗ τη διαδρομή φορτίων**
(slab→beam→column→footing→soil): **κάθε** δομικό μέλος αποκτά `appliedLoad` (source='takedown'), όχι μόνο
το πέδιλο. «Revit χωρίς Robot» (FEM-free). FULL ENTERPRISE + FULL SSoT.

---

## 1. Context & Problem

Το ADR-464 σταματούσε τη διαδρομή φορτίων στο **κολώνα→πέδιλο**: το `appliedLoad` ζούσε ΜΟΝΟ στο
`PadFootingParams`, υπολογισμένο ως `column tributary area × storeyCount × area-loads + ίδιο βάρος`
(browser-verified, N=596 kN). Τα δοκάρια/πλάκες/κολώνες δεν είχαν φορτίο σχεδιασμού — άρα δεν υπήρχε
auditable διαδρομή φορτίων ούτε gravity demand ανά μέλος.

**Πηγή φορτίων (όπως Revit χωρίς Robot):** δεν υπάρχει FEM (ADR-459 Phase 5 DEFERRED). Τα φορτία είναι
καθαρά γεωμετρικά + building-level area loads (G/Q), **όχι** από ανάλυση πλαισίου.

---

## 2. Architecture — απόφαση (Revit-without-Robot)

### 2.1 Πού ζει το `appliedLoad` — persisted ανά μέλος (mirror ADR-464)
`appliedLoad?: AppliedMemberLoad` προστέθηκε στα `ColumnParams`, `BeamParams`, `SlabParams`
(το `PadFootingParams.appliedLoad?` υπήρχε ήδη). Guard `isTakedownWritable` ανά μέλος → ο takedown ΠΟΤΕ
δεν αντικαθιστά χειροκίνητο (`source='manual'`). Τα **design results μένουν DERIVED** (ποτέ persisted).

### 2.2 Μοντέλο φορτίων — tributary mode (διατηρητικό, μηδέν regression)
Η κατακόρυφη διαδρομή (κολώνα/πέδιλο/έδαφος) μένει **tributary-area** (ακριβώς ADR-464)· κάθε μέλος
αποκτά το δικό του φορτίο βαρύτητας:

| Μέλος | `appliedLoad` (axial, concentric v1) | Όροφοι |
|---|---|---|
| **Slab** | εμβαδόν panel (`geometry.netArea`) × area-loads | 1 |
| **Beam** | μ.ό. tributary ακρο-κολονών × area-loads + ίδιο βάρος δοκαριού | 1 |
| **Column** | tributary area × όροφοι × area-loads + ίδιο βάρος (= ADR-464) | storeyCount |
| **Footing** (pad) | = φορτίο εδραζόμενης κολώνας (μέσω `footing-bearing` edge) | — |

**Αναλλοίωτοι (διατήρηση φορτίου, no double-count):**
1. `computeGridTributaryAreas` καλείται ΜΙΑ φορά· όλα διαβάζουν τον ίδιο `tributaryMap`.
2. Η κολώνα **ΔΕΝ** αθροίζει αντιδράσεις δοκαριών — κρατά tributary (Revit-mode). Το beam-load είναι
   επανα-απόδοση του ίδιου slab φορτίου για beam design, **όχι** επιπλέον αξονικό στην κολώνα.
3. Footing(pad) = κολώνα → footing values **πανομοιότυπα** με ADR-464 (regression jest).
4. `top-attachment` edges **εξαιρούνται** από τη διάσχιση (γεωμετρικές, όχι load).
5. Moments = 0 v1 (`toAppliedTakedownLoad` τα αφαιρεί, Firestore-safe).

### 2.3 Σειρά διάσχισης — reverse-topological (Kahn)
`topologicalLoadOrder(graph)`: φιλτράρει `top-attachment`, in-degree = πόσα στηριζόμενα μέλη προηγούνται.
Σειρά **beams → columns → footings** (κάθε μέλος υπολογίζεται πριν «παραδώσει»). Graceful σε κύκλο.
Οι **πλάκες δεν είναι nodes** στον οργανισμό (ADR-459 limitation) → υπολογίζονται ως ανεξάρτητες πηγές
εκτός graph.

### 2.4 Νέα/τροποποιημένα modules
- **NEW `loads/member-load-geometry.ts`** — SSoT: `columnCenterM`, `columnSelfWeightPerStoreyKn`,
  `beamSelfWeightKn`, `GRAVITY_MS2` (εξήχθησαν από `footing-load-takedown` — N.0.2).
- **NEW `loads/load-path-walk.ts`** — pure graph: `topologicalLoadOrder` + edge resolvers
  (`beamSupportColumnIds`, `footingColumnId`).
- **NEW `loads/load-path-takedown.ts`** — orchestrator: `computeLoadPathPatches(entities, graph, settings)`
  → `MemberLoadPatch[]` + type guards `isLoadPathMember`/`memberAppliedLoad`.
- **NEW `core/commands/entity-commands/ComputeLoadPathCommand.ts`** — undoable multi-member command
  (mirror `AutoReinforceOrganismCommand`· `signalEntitiesAttached`→persist).
- **MOD** `column-types`/`beam-types`/`slab-types` (+`appliedLoad?`)· `load-takedown` (+`TakedownSettings`
  SSoT)· `footing-load-takedown` (import helpers από member-load-geometry· πλέον footing oracle/jest)·
  `useStructuralLoadTakedown` (buildStructuralGraph→computeLoadPathPatches→ComputeLoadPathCommand)· i18n
  «N μέλη».
- **DELETED** `ComputeTakedownLoadsCommand.ts` (superseded από ComputeLoadPathCommand· καμία αναφορά/registry).

---

## 3. Slices

| Slice | Περιεχόμενο | Status |
|---|---|---|
| **1** | `appliedLoad?` σε Column/Beam/Slab params (additive) | 🟢 DONE |
| **2** | `load-path-walk` (topological order + resolvers) + member-load-geometry SSoT + 9 jest | 🟢 DONE |
| **3** | `load-path-takedown` orchestrator + `ComputeLoadPathCommand` + 9 jest (incl. command) | 🟢 DONE |
| **4** | wire `useStructuralLoadTakedown` + i18n «N μέλη» + delete superseded command | 🟢 DONE |
| **5** | regression jest: no-beam footing loads == `computeFootingTakedownLoads` (ADR-464) | 🟢 DONE |

---

## 4. Honesty / DEFER
- bearing/flexure/punching (ADR-464) = πραγματικοί EC2/EC7· φορτία = tributary takedown (FEM-free).
- **DEFER:** πραγματικό **chained reaction tree** (column = Σ beam reactions με ακριβές strip-tiling
  slab→beam, Robot/FEM-grade — ακριβέστερο σε ακανόνιστο κάναβο)· slab nodes στον οργανισμό· ροπές/
  εκκεντρότητα διαδρομής· σεισμικά EC8· strip/tie-beam footing takedown.

---

## 5. Changelog
- **2026-06-17 (Opus) — Slices 1-5:** `appliedLoad?` σε Column/Beam/Slab params. NEW pure SSoT
  `loads/member-load-geometry.ts` (κέντρο/ίδιο βάρος, εξαγωγή από footing-load-takedown, N.0.2),
  `loads/load-path-walk.ts` (`topologicalLoadOrder` Kahn εξαιρώντας `top-attachment` + edge resolvers),
  `loads/load-path-takedown.ts` (`computeLoadPathPatches` Revit-mode: κολώνα/πέδιλο=tributary [= ADR-464],
  δοκάρι=μ.ό. tributary ακρο-κολονών 1 όροφος + ίδιο βάρος, πλάκα=panel area· footing(pad)=κολώνα·
  rafts=area-load στο slab loop, ΟΧΙ διπλό patch). NEW `ComputeLoadPathCommand` (undoable multi-member,
  mirror AutoReinforce). `TakedownSettings` μετακινήθηκε στο `load-takedown` (loads SSoT). `useStructural
  LoadTakedown` → buildStructuralGraph + computeLoadPathPatches + ComputeLoadPathCommand, emit όλα τα ids.
  i18n el/en «N μέλη». DELETED superseded `ComputeTakedownLoadsCommand`. 18 νέα jest (walk 9 + orchestrator/
  command/regression 9), 121 structural jest GREEN. **Διατήρηση φορτίου:** regression jest επιβεβαιώνει
  footing(pad) == ADR-464 σε no-beam κάναβο. UNCOMMITTED.
