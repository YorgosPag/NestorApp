# ADR-467 — Load Path Engine (διαδρομή φορτίων, FEM-free)

**Status:** 🟢 Slices 1-7 DONE 2026-06-17 (Opus, UNCOMMITTED — browser-verify + commit).
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

### 2.3.1 Grid-anchored tributary (Revit-grade — analytical node = τομή αξόνων)
Το tributary node μιας κολώνας είναι ο **αναλυτικός κόμβος** = η **τομή των αξόνων κανάβου** στους
οποίους είναι hosted (`guideBindings` center-x/center-y), ΟΧΙ το γεωμετρικό κεντροειδές. Έτσι μια
**γωνιακά-αγκυρωμένη** κολώνα 5×5 δίνει tributary **25 m²** (όχι 4.6×4.6=21.16). Reuse ADR-441 SSoT:
`derivePointSlots` + `GuideOffsetLookup` (νέο `bim/hosting/guide-store-offset-lookup.ts`, εξήχθη από
`useHostingReconciler`). Pure: ο `getOffset` εγχέεται από τον hook (guide store)· χωρίς guides →
fallback κεντροειδές (μηδέν regression· οι μη-hosted κολώνες αμετάβλητες).

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
- **NEW `bim/hosting/guide-store-offset-lookup.ts`** (`makeGuideOffsetLookup` SSoT, grid-anchored tributary)·
  `useHostingReconciler` refactor να το χρησιμοποιεί (boy-scout)· `member-load-geometry.columnCenterM`
  +optional `getOffset` (grid node μέσω `derivePointSlots`)· `load-path-takedown`/hook threading `getOffset`.

---

## 3. Slices

| Slice | Περιεχόμενο | Status |
|---|---|---|
| **1** | `appliedLoad?` σε Column/Beam/Slab params (additive) | 🟢 DONE |
| **2** | `load-path-walk` (topological order + resolvers) + member-load-geometry SSoT + 9 jest | 🟢 DONE |
| **3** | `load-path-takedown` orchestrator + `ComputeLoadPathCommand` + 9 jest (incl. command) | 🟢 DONE |
| **4** | wire `useStructuralLoadTakedown` + i18n «N μέλη» + delete superseded command | 🟢 DONE |
| **5** | regression jest: no-beam footing loads == `computeFootingTakedownLoads` (ADR-464) | 🟢 DONE |
| **7** | column load readout UI — group «Φορτίο Σχεδιασμού» (G/Q/N_Ed) στην καρτέλα Ιδιότητες | 🟢 DONE |

---

## 4. Honesty / DEFER
- bearing/flexure/punching (ADR-464) = πραγματικοί EC2/EC7· φορτία = tributary takedown (FEM-free).
- **DEFER:** πραγματικό **chained reaction tree** (column = Σ beam reactions με ακριβές strip-tiling
  slab→beam, Robot/FEM-grade — ακριβέστερο σε ακανόνιστο κάναβο)· slab nodes στον οργανισμό· ροπές/
  εκκεντρότητα διαδρομής· σεισμικά EC8· strip/tie-beam footing takedown.

---

## 5. Changelog
- **2026-06-17 (Opus) — Slice 7 (column load readout UI):** Το αξονικό φορτίο σχεδιασμού
  (`params.appliedLoad`) εμφανίζεται πλέον **read-only** στην καρτέλα Ιδιότητες της κολώνας — νέο group
  «Φορτίο Σχεδιασμού» με 3 readouts: **G** (μόνιμο), **Q** (μεταβλητό), **N_Ed** (= γ_G·G + γ_Q·Q, EN1990
  6.10). Parity με το foundation «Φορτία & Έδραση» (ADR-464 Slice 1b)· λύνει το gap «το πέδιλο δείχνει
  φορτίο, η κολώνα όχι». SSoT reuse: `resolveAppliedMemberLoad` + `combineUls` (γ από
  `footingDesignFactors().combination`, κοινός EN1990 fundamental combination)· μηδέν inline math. «—» όταν
  δεν έχει υπολογιστεί φορτίο (Revit-grade). Αρχεία: `column-command-keys.ts` (+3 readout keys στο
  `COLUMN_STRUCTURAL_READOUT_KEYS` → αυτόματα στο `isColumnStructuralReadoutKey` set)·
  `column-structural-bridge.ts` (νέα `resolveColumnLoadReadout` πριν το reinforcement readout)·
  `column-property-fields.ts` (NEW `COLUMN_LOADS_GROUP`, ungated — φορτίο βαρύτητας ανεξάρτητο υλικού)·
  i18n el/en. **DEFER:** ίδιο group σε δοκάρι + πλάκα. UNCOMMITTED.
- **2026-06-17 (Opus) — Slice 6 (Grid-anchored tributary, Revit-grade):** Το tributary node κολώνας =
  **τομή αξόνων κανάβου** (αναλυτικός κόμβος) αντί γεωμετρικού κεντροειδούς όταν η κολώνα είναι hosted
  (`guideBindings`). **Αιτία (browser-verify):** οι «κολώνες από κάναβο» αγκυρώνονται **γωνιακά** στις
  τομές → κεντροειδή 4.6m → tributary 21.16 m² αντί 25 → φορτίο ~15% χαμηλό. FIX: `columnCenterM(c,
  getOffset?)` resolve grid node μέσω `derivePointSlots` (ADR-441 SSoT)· NEW `bim/hosting/
  guide-store-offset-lookup.ts` (`makeGuideOffsetLookup`, εξήχθη από `useHostingReconciler` — N.0.2)·
  threading `getOffset` σε `computeLoadPathPatches`/hook. Fallback κεντροειδές χωρίς guides (μηδέν
  regression). 2 νέα jest (grid 25 m² vs centroid 21.16). **Verified:** 5×5 κάναβος → 25 m²/κολώνα →
  dead≈596.4/live=150 (G=7.5/Q=2/storeys=3). UNCOMMITTED.
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
