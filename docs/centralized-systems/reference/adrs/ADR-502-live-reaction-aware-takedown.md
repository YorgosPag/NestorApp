# ADR-502 — Live reaction-aware takedown: πρόβολος-πλάκα → δοκάρι → αμφότερες κολώνες → αμφότερα πέδιλα

**Status:** 🟡 Slice 1 (reaction-aware axial) + Slice 2 (static column support-moment) — UNCOMMITTED 2026-06-19
**Date:** 2026-06-19
**Υλοποιεί:** ADR-487 §4 («ο κανόνας του σε κάθε κίνηση» — τοπική αυτο-διόρθωση live) + §3 (ΕΝΑΣ οργανισμός)
**Σχετικά:** ADR-467 (load-path engine), ADR-464 (footing takedown), ADR-486 (topology-aware support), ADR-495 (slab→beam), ADR-498 (cantilever slab), ADR-491/497 (FEM-driven M/N), ADR-499 (auto-correcting organism), ADR-500 («Αυτόματη Μελέτη»)

---

## 1. Πρόβλημα (verbatim Giorgio)

> «Τώρα που αλλάζω κάθε φορά το μήκος του προβόλου της πλάκας που είναι συνδεμένη στο δοκάρι, υπολογίζονται αυτόματα κάθε φορά η διατομή και ο οπλισμός της κολώνας και του πεδίλου; Εννοώ και των 2 κολωνών και των 2 πεδίλων;»

**Σημερινή κατάσταση (πριν το ADR-502):** **ΟΧΙ live.** Αλλάζοντας τον πρόβολο ενημερωνόταν **μόνο το δοκάρι**:
- Η αξονική κολώνας στο takedown ήταν **grid-tributary-area** (`buildColumnTributary` → `computeGridTributaryAreas`), **slab/beam-agnostic**.
- Η grid-tributary **ρητά μηδενίζει** το overhang (`load-takedown.ts`: slab edge → 0, «no mirror», ADR-474) → το φορτίο του προβόλου **ΔΕΝ έφτανε ποτέ** στις κολώνες/πέδιλα.
- Οι αντιδράσεις δοκαριού→κολώνας ήταν **DEFER (FEM)** — έφταναν μόνο μέσω engaged FEM ή ρητής «Αυτόματης Μελέτης» (ADR-500).

## 2. Στόχος

**LIVE σε κάθε αλλαγή** (ΟΡΑΜΑ §4), χωρίς κουμπί, ντετερμινιστικά & χωρίς infinite-loop: **πρόβολος-πλάκα → δοκάρι → αμφότερες στηρίζουσες κολώνες (διατομή+οπλισμός) → αμφότερα πέδιλα (μέγεθος+οπλισμός)**.

## 3. Αρχιτεκτονική (Revit/Robot-grade — reaction-aware takedown, ΟΧΙ live FEM)

Οι μεγάλοι (Revit/Robot) ΔΕΝ τρέχουν full FEM σε κάθε πλήκτρο: τρέχουν **load takedown με αντιδράσεις** (στατική) για το live, και full FEM **on-demand**. Το ADR-502 ακολουθεί αυτό, σε 2 slices, **μέσα στο υπάρχον terminating takedown/organism pass** (μηδέν νέος reactive trigger — μάθημα ADR-491).

### Slice 1 — Reaction-aware axial (πρόβολος-overhang → κολώνες + πέδιλα)

**Αρχείο:** `bim/structural/loads/load-path-takedown.ts` (EXTEND, pure).

- NEW `buildColumnCantileverReaction(entities, graph, settings)` → `Map<columnId, AreaLoadResultant>`: για κάθε **πρόβολο-πλάκα** (ADR-498 `computeSlabSupportConditions`, `supportType==='cantilever'`), υπολόγισε το αξονικό της (`areaLoadResultant`, 1 όροφος) και **διένειμέ το στις στηρίζουσες κολώνες** της φέρουσας δοκού (`beamSupportColumnIds`): πρόβολος-δοκάρι (1 στήριξη)→100%, αλλιώς ισόποσα (UDL static split v1· position-weighted = DEFER).
- Στο `computeLoadPathPatches` column branch: `addAxialReaction(columnLoad(...), cantileverByColumn.get(id))`. Το augmented `appliedLoad` αποθηκεύεται στο `columnLoadById` → **ρέει αυτόματα στο πέδιλο** (footing = αντίδραση βάσης κολώνας).

**Γιατί scoped στον πρόβολο (ΟΧΙ όλες οι beam reactions):**
- **Μηδέν double-count:** το overhang **δεν ανήκει σε καμία grid tributary** (slab edge → 0). Άρα η αντίδραση είναι καθαρά προσθετική. Αν πρόσθετα ΟΛΕΣ τις beam reactions πάνω στο grid, θα διπλομετρούσα το in-grid φορτίο ορόφου (που το grid ήδη μετρά ×ορόφους).
- **Μηδέν regression:** γυμνές/εσωτερικές κολώνες & μη-πρόβολες πλάκες → κενό → ίδιο grid.

**Καταναλωτές (μηδέν νέο wiring — confirmed grep):** column sizing (`suggestColumnSection`→`section-context` N), reinforce (`asStrengthColumnMm2`), footing (`serviceAxialKn(appliedLoad)`) διαβάζουν όλοι το persisted `appliedLoad` → μεγαλύτερο appliedLoad προπαγκάρει αυτόματα μέσω των ΥΠΑΡΧΟΝΤΩΝ proactive hooks (ADR-459 Φ7).

**Live trigger (υπάρχων):** `bim:slab-params-updated` → `useProactiveStructuralLoads` → `runStructuralLoadTakedown` → `computeLoadPathPatches` → `bim:structural-loads-computed` → sizing/reinforce/foundation.

### Slice 2 — Ντετερμινιστική column support-moment (δοκάρι-πρόβολος)

**Αρχεία:** NEW `loads/column-support-moment.ts` + NEW `organism/column-support-moment-store.ts`.

- NEW pure `buildColumnSupportMomentMap(entities, graph)` → `Map<columnId, M (kNm)>`: για κάθε **δοκάρι-πρόβολο** (ADR-486 `resolveBeamSupportCondition`, ακριβώς 1 στήριξη), η μοναδική στηρίζουσα κολώνα παίρνει `M = beamDesignMomentNmm(ctx,'cantilever')` (= `w·L²/2`). **ΕΝΑ SSoT** — μοιραζόμαστε το `beamDesignMomentNmm` του ίδιου του οπλισμού δοκαριού (μηδέν διπλή αλήθεια). Mirror του `beam-torsion.ts`.
- NEW `ColumnSupportMomentStore` (transient, `createDerivedMapStore`, mirror `BeamTorsionStore`)· γράφεται στο organism pass (`structural-organism-core.ts`).
- NEW `resolveActiveColumnDesignMoment(columnId)` = **`resolveActiveColumnFemMoment ?? ColumnSupportMomentStore.get`** — ιεραρχία ΕΝΟΣ οργανισμού: engaged FEM (ακριβές πλαισιακό) **υπερισχύει**, αλλιώς static always-on.
- Καταναλωτές αλλάζουν από `resolveActiveColumnFemMoment` → `resolveActiveColumnDesignMoment` (ΕΝΑ SSoT ροπής σχεδιασμού): sizing (`AutoSizeMembersCommand`), reinforce (`resolveActiveColumnReinforcementForEntity`), feasibility (`buildActiveColumnDesignMomentMap`), utilization overlay.

## 4. Boy-scout fix

`slab-beam-support.ts` `slabOutlineM`: defensive σε πλάκα χωρίς `outline` (επιστρέφει `[]` αντί crash). Ξεσκεπάστηκε από το νέο `computeSlabSupportConditions` call (το `computeSlabBeamTributary` έκανε early-return σε σκηνές χωρίς δοκούς, οπότε το κάλυπτε).

## 5. Anti-loop / convergence

- **Μηδέν νέος reactive trigger / event listener** — Slice 1 ζει στο terminating takedown pass· Slice 2 στο organism pass.
- **Idempotent:** reaction & moment = ντετερμινιστικές συναρτήσεις γεωμετρίας+φορτίου → ίδια τοπολογία ⇒ ίδιο appliedLoad/M ⇒ μηδέν patch (`isTakedownWritable`, `columnSectionMateriallyDiffers`) ⇒ ο chain τερματίζει.
- **SSoT ιεραρχία N & M:** engaged FEM (ADR-491/497) **υπερισχύει** του static estimate· static = always-on seed/fallback. Μηδέν παράλληλη διπλή αλήθεια.

## 6. Tests (από repo ROOT)

- `loads/__tests__/load-path-takedown.test.ts` (+5 ADR-502): πρόβολος 50/50 σε 2 κολώνες+πέδιλα· μεγαλύτερος πρόβολος→μεγαλύτερη αντίδραση· δοκάρι-πρόβολος 1 στήριξη→100%· idempotent· αμφιέρειστη πλάκα→μηδέν double-count.
- `loads/__tests__/column-support-moment.test.ts` (6): cantilever→M=w·L²/2 (oracle)· simple→κενό· no-load skip· ~L² monotonic· additive· empty.
- Πλήρες structural suite: 816 pass / 6 pre-existing raft fails (ADR-476 `maxFreeSpanM`, ΟΧΙ δικά μου — confirmed με stash baseline).

## 7. Scope guard / DEFER

- **Πλήρες chained reaction tree** (in-grid δοκάρια → κολώνα, storey-consistent με grid) = DEFER (μεγαλύτερος redesign· σήμερα το FEM/«Αυτόματη Μελέτη» το καλύπτει).
- Position-weighted reaction split (αντί ισόποσου) = DEFER.
- Δευτερογενής frame-moment σε αμφιέρειστο δοκάρι με πλάκα-πρόβολο off the beam = γνήσιο FEM (μένει στην «Ανάλυση»).

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-19 | **Δημιουργία.** Slice 1 (reaction-aware axial overhang→κολώνες+πέδιλα, `load-path-takedown.ts`) + Slice 2 (static column support-moment SSoT + store + `resolveActiveColumnDesignMoment` ιεραρχία FEM??static, 4 consumers) + boy-scout `slabOutlineM`. ADR-501 ήταν πιασμένο (grip multi-arm, άλλος agent) → renumber σε ADR-502. UNCOMMITTED. |
