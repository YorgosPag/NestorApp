# ADR-489 — Στατική συνέχεια κολώνα→πέδιλο + δυναμικό βάθος θεμελίωσης

**Status:** ✅ Implemented — §6.1 πλήρες (transport ξαναγράφτηκε **per-stack**, βλ. §7)· §6.2 engine + dialog UX (live viewer-reconciler = DEFER)
**Date:** 2026-06-18 (§7 transport rewrite: 2026-07-26)
**Υλοποιεί:** τα 2 ανοιχτά κενά του **ADR-487 §6** (Living Structural Organism vision)
**Σχετικά:** ADR-459 (organism graph), ADR-486 (topology-aware support — mirror pattern), ADR-484 (cross-level foundation), ADR-401 (attach-base), ADR-448 (vertical datum), ADR-451/461 (building vertical setup)

---

## 1. Πρόβλημα (ADR-487 §6)

### §6.1 — Κολώνα ↔ πέδιλο δεν «πατούν» (concrete bug)
Οι κολώνες ισογείου **αιωρούνται 1m** πάνω από τα πέδιλα. Δύο ανεξάρτητα datum που κανείς δεν συμφιλίωνε:
- **Κολώνα** `baseBinding:'storey-floor'` → `resolveColumnBaseZmm = floorElevationMm(0) + baseOffset(0) = 0` (FFL ισογείου)· 3Δ `bim-three-structural-converters.columnToMesh` εξωθεί ΠΑΝΩ από το 0.
- **Πέδιλο** `topElevationMm = resolveFoundationTopElevationMm(foundationFFL) = −1000` (απόλυτο, ADR-484 Slice 4)· 3Δ `foundation-to-three` το τοποθετεί absolute.
- Κενό = `0 − (−1000) = 1000mm` = ακριβώς το «Βάθος θεμελίωσης». Καμία στατική συνέχεια — ο οργανισμός υπολόγιζε χωριστά `baseZmm` & `topElevationMm`.

### §6.2 — «Βάθος θεμελίωσης» χειροκίνητη σταθερά
Στο dialog «Όροφοι Κτιρίου → Γρήγορη ρύθμιση» ο μηχανικός δηλώνει χειροκίνητα «Βάθος θεμελίωσης = 1,00». Η εφαρμογή ΔΕΝ ξέρει μέγεθος/φορτία εκ των προτέρων → δεν μπορεί να ξέρει το βάθος από την αρχή· είναι **δυναμικό** (αλλάζει με πέδιλα/συνδετήριες/εδαφόπλακα).

---

## 2. Απόφαση

### §6.1 — Derived organism continuity (η κολώνα κατεβαίνει στο πέδιλο)
Η βάση κάθε κολώνας με πέδιλο γίνεται **DERIVED = άνω παρειά πεδίλου** — **ΠΟΤΕ persisted, ΠΟΤΕ αλλάζει `baseBinding`**. Revit-canonical: η κολώνα εδράζεται στην άνω παρειά του πεδίλου με κόμβο συνέχειας· η ΚΟΡΥΦΗ μένει σταθερή, η κολώνα επιμηκύνεται προς τα κάτω.

**Reuse (μηδέν διπλή λογική):** το effective base προκύπτει αμιγώς από τις `footing-bearing` ακμές που ΗΔΗ παράγει ο `buildStructuralGraph` (explicit-FK + spatial `footingSupportsColumnBase`, cross-level absolute Z) — ΔΕΝ ξανα-ζευγαρώνουμε. Mirror του ADR-486 (transient store transport).

**Απορρίφθηκε** η επέκταση attach-base (ADR-401): είναι same-level/beam-slab only (`column-structural-attach-coordinator` με `ACTIVE_LEVEL_FLOOR_MM=0`, `hostInputOf` null για foundation) → cross-level datum-mismatch + persisted geometry change.

### §6.2 — Derived + override "Auto" (απόφαση Giorgio)
Pure engine παράγει το βάθος από τον οργανισμό· το dialog δείχνει read-only «Auto» με κουμπί χειροκίνητης υπέρβασης. **Μη-κυκλικό:** depth = f(πάχος στοιχείων), ΠΟΤΕ του topElevation (type-level guarantee).

---

## 3. Υλοποίηση

### §6.1
| Αρχείο | Ρόλος |
|---|---|
| `bim/structural/organism/derive-column-base-continuity.ts` **(NEW)** | `buildColumnBaseContinuityMap(graph)` → `Map<columnId, effectiveBaseZmm>` από footing-bearing ακμές· μόνο προς τα κάτω· βαθύτερο πέδιλο νικά (pad −1000 αντί tie-beam −500). Pure. |
| `bim/structural/organism/derived-map-store.ts` **(NEW — N.0.2 centralization)** | Generic `createDerivedMapStore<T>()` SSoT factory για το «transient DERIVED `Map<string,T>`» boilerplate· σήμερα μοναδικός consumer το `beam-support-condition-store` (ADR-486). Φέρει ρητό **όριο εφαρμογής** (§7): έγκυρο μόνο για active-level-scoped DERIVED τιμές. |
| `bim/structural/organism/beam-support-condition-store.ts` (MOD — N.0.2) | Migrated στο `createDerivedMapStore<BeamSupportType>()` (ίδιο API· consumers `active-reinforcement`/`useStructuralOrganism` αμετάβλητοι). |
| `bim-3d/scene/bim-scene-context.ts` `SyncContext` | Νέο `columnBaseContinuity: ReadonlyMap<string,number> \| null` — ο per-stack χάρτης ταξιδεύει με το context του sync, **όχι** μέσω global store (§7). |
| `bim-3d/scene/BimSceneLayer.ts` | `syncMultiFloor`: ΕΝΑ aggregation pass πριν τον floor loop → `buildStructuralGraph` **μία φορά** → τροφοδοτεί ΚΑΙ `buildColumnBaseContinuityMap` ΚΑΙ `syncJointRebar` (μηδέν διπλός υπολογισμός). `syncFloor` (single-floor): περνά `null`. |
| `hooks/structural-organism-core.ts` | **ΔΕΝ** δημοσιεύει πλέον continuity — ο organism pass είναι active-level-scoped (§7). |
| `bim-3d/converters/bim-three-structural-converters.ts` `columnToMesh` | Νέα param `effectiveBaseZmm?`· flat path: `baseDropMm = max(0, nominalBaseAbs − effectiveBase)`, ύψος `+=baseDropMm`, `position.y −=baseDropMm` → βάση στο πέδιλο, κορυφή σταθερή. Σοβάς/οπλισμός παίρνουν το επιμηκυμένο ύψος. Attached-prism path = DEFER. |
| `bim-3d/scene/bim-scene-attach-syncs.ts` `syncColumns` | Διαβάζει `ctx.columnBaseContinuity?.get(column.id)` (ΟΧΙ για ρητά base-attached) → περνά `effectiveBaseZmm`. Κοινός path single + multi-floor· σε single-floor ο χάρτης είναι `null` → nominal βάση. |
| `bim-3d/scene/bim-scene-joint-rebar-sync.ts` `syncJointRebar` | Νέα optional param `prebuiltGraph` — ο multi-floor path περνά τον ήδη χτισμένο graph αντί να τον ξαναχτίσει· χωρίς αυτήν (single-floor) χτίζεται εσωτερικά όπως πριν. |

### §6.2
| Αρχείο | Ρόλος |
|---|---|
| `src/types/building/derived-foundation-depth.ts` **(NEW, shared)** | `resolveDerivedFoundationDepthMm(input)` — pure. `depth = max(maxFootingThk + (tie?rise:0) + cover, slab + cover, frostMin)`, module 50mm. Input ΧΩΡΙΣ elevation → μη-κυκλικό. SHARED (viewer + building-management, μηδέν dependency-direction violation). **`tieBeamRiseMm` = injectable input** (ο viewer περνά το `TIE_BEAM_RISE_MM` SSoT· το engine ΔΕΝ κρατά ανταγωνιστικό αντίγραφο — μόνο EC8 fallback)· cover/frost/module = §6.2-policy SSoT (δεν υπάρχουν αλλού). `seedDerivedFoundationDepthMm()` = 1200mm bootstrap. |
| `src/types/building/elevation.schemas.ts` + `contracts.ts` + `building-services.ts` | Νέο `foundationDepthAuto?: boolean` (default true) στο building doc. |
| `components/building-management/tabs/BuildingVerticalSetupForm.tsx` | `foundationDepthIsAuto` toggle· Auto → read-only derived display + badge + «Χειροκίνητη υπέρβαση»· override → editable + «Επαναφορά σε αυτόματο». persist `foundationDepthAuto` + effective depth. |
| i18n `el/en building-tabs.json` | `foundationDepthAutoBadge/DerivedFrom/Override/AutoReset`. |

---

## 4. Ροή continuity (§6.1, end-to-end)
```
add/connect/remove → structural event → 3Δ re-sync → BimSceneLayer.syncMultiFloor
  → buildStructuralEntitySet(ΟΛΟΙ οι όροφοι του stack)  [absolute Z ανά entity]
  → buildStructuralGraph  ← ΜΙΑ φορά (footing-bearing ακμές, cross-level absolute Z)
      ├→ buildColumnBaseContinuityMap(graph)  [column→footing.topZmm, min, μόνο κάτω]
      │    → ctx.columnBaseContinuity (per-stack, ταξιδεύει στο SyncContext)
      │    → syncColumns → columnToMesh(effectiveBaseZmm)
      │    → baseDropMm → κολώνα εδράζεται στο πέδιλο (κορυφή σταθερή)
      └→ syncJointRebar(prebuiltGraph)  [ίδιος graph, μηδέν διπλός υπολογισμός]
αλλαγή βάθους (§6.2) → foundation-level-store → νέο footing topElevation → §6.1 re-derive → κολώνα ακολουθεί
```
**Single-floor scope** (`syncFloor`): `columnBaseContinuity = null` → κάθε κολώνα κρατά τη nominal βάση της. Βλ. §7.

## 5. Tests (jest GREEN)
- `derive-column-base-continuity.test.ts` (**12**): cross-level −1000, no-footing absence, ίδιο-επίπεδο no-op, ποτέ-πάνω, βαθύτερο νικά, per-column, αγνοεί μη-footing ακμές· **+§7.1**: υπερκείμενος όροφος δεν κατεβαίνει, τριώροφο stack → μόνο ο κατώτατος, δίδυμο πέδιλο (ισοϋψείς) → και οι δύο, πεδιλοδοκός με κολώνες σε άλλη στοίβα → όλες, υπερκείμενη με δικό της πέδιλο → κανονικά.
- `column-base-continuity-3d.test.ts` (3): βάση πέφτει 1m + ύψος +1m + κορυφή σταθερή· undefined no-op· effective-πάνω no-op.
- `BimSceneLayer-column-continuity.test.ts` **(NEW, 7 — §7)**: §7-A per-stack — cross-floor έδραση, **ανεξαρτησία από τον ενεργό όροφο**, ανεξαρτησία από τη σειρά του stack, κολώνα χωρίς πέδιλο (§7.1 στοίβα), stack χωρίς Θεμελίωση· §7-B single-floor → καμία προέκταση ακόμη και με πέδιλο στον ίδιο όροφο.
- `derived-foundation-depth.test.ts` (8): seed 1200, thickness-driven, max-of-many, tie-term, slab-term, frost floor, empty→seed, module rounding.

## 6. DEFER (επόμενα βήματα)
- **Live viewer-reconciler §6.2:** η engine να τρέχει viewer-side σε `bim:foundation-params-updated` και να ενημερώνει το `building.foundationDepth` + foundation level elevation από ΠΡΑΓΜΑΤΙΚΑ πέδιλα (αντί seed). Αλληλεπιδρά με ADR-484 (uncommitted) → χωριστό slice. Σήμερα: dialog seed + override.
- **Analytical model continuity:** ο `columnNode.baseZmm` στον graph μένει nominal (η ακμή footing-bearing υπάρχει ήδη)· για FEM (ADR-481) ο κόμβος να πέφτει στο πέδιλο = επόμενο.
- **Attached-prism path** base drop (σπάνιο cross-cutting).

## 7. Το transport: γιατί per-stack `SyncContext` και ΟΧΙ global store

**Το bug της αρχικής υλοποίησης (2026-06-18).** Ο χάρτης continuity παραγόταν στον organism pass
(`runOrganismDiagnostics`) και δημοσιευόταν σε global `ColumnBaseContinuityStore`. Δύο scopes σε
ασυμφωνία:

| | Παραγωγός (organism pass) | Καταναλωτής (3Δ render path) |
|---|---|---|
| Τι βλέπει | **ΜΟΝΟ τον ενεργό όροφο** | **ΟΛΟΥΣ** τους ορόφους του stack («Όλοι οι όροφοι») |
| Συνέπεια | graph χωρίς πέδιλα όταν ο ενεργός δεν είναι η Θεμελίωση | ζητά continuity για κολώνες που ο χάρτης δεν κάλυψε ποτέ |

Ένας χάρτης **scoped στον ενεργό όροφο**, καταναλωμένος **καθολικά**, δίνει σιωπηλά λάθος
αποτέλεσμα: οι προεκτάσεις εξαφανίζονταν μόλις ο μηχανικός άλλαζε ενεργό όροφο — χωρίς σφάλμα,
χωρίς log. Χειρότερα, ο graph χτιζόταν **δύο φορές** (organism + `syncJointRebar`) πάνω σε
**διαφορετικά** entity sets, άρα και οι δύο καταναλωτές έβλεπαν άλλη τοπολογία.

**Η απόφαση.** Ο χάρτης παράγεται εκεί που είναι γνωστό το πραγματικό scope σχεδίασης —
`BimSceneLayer.syncMultiFloor` — από **ΕΝΑΝ** graph πάνω σε ΟΛΟΥΣ τους ορόφους, και ταξιδεύει ως
πεδίο του `SyncContext` μαζί με τα υπόλοιπα per-sync δεδομένα. Ο ίδιος graph τροφοδοτεί και το
joint rebar (`prebuiltGraph`) → μία τοπολογία, δύο καταναλωτές, μηδέν διπλός υπολογισμός.

**View-scoped by design.** Σε προβολή **ενός** ορόφου το `columnBaseContinuity` είναι `null`, άρα
καμία προέκταση. Δεν είναι περιορισμός — είναι το σωστό: τα πέδιλα ζουν στον όροφο Θεμελίωσης και
**δεν σχεδιάζονται** εκεί· μια κολώνα προεκτεινόμενη 1m κάτω από την κάτοψη θα κρεμόταν στο κενό
και θα εμπόδιζε την επιλογή/επεξεργασία της. Η στατική συνέχεια είναι ορατή ακριβώς όταν βλέπεις
και τα δύο μέλη που τη συγκροτούν.

### §7.1 — Το πέδιλο εδράζει ΜΟΝΟ τη χαμηλότερη κολώνα κάθε στοίβας

Το per-stack transport **εξέθεσε** ένα bug που το παλιό active-level scope έκρυβε κατά λάθος.
Το `footingSupportsColumnBase` (SSoT κριτήριο του graph) ρωτά μόνο *«καλύπτει το πέδιλο το
plan-centroid της βάσης, και κάθεται χαμηλότερα;»* — **χωρίς όριο απόστασης**. Οι κολώνες όμως
στοιβάζονται κατακόρυφα με **ίδιο footprint**, οπότε ένα πέδιλο «στηρίζει» εξίσου την κολώνα του
Ισογείου ΚΑΙ του 1ου ΚΑΙ του 5ου ορόφου. Με ενεργό μόνο τον έναν όροφο αυτό δεν φαινόταν· μόλις ο
χάρτης έγινε per-stack, **κάθε κολώνα του κτιρίου** κατέβαινε στη θεμελίωση (η κολώνα του 1ου
ορόφου προεκτεινόταν 4m προς τα κάτω, διαπερνώντας το ισόγειο).

**Κριτήριο αποκλεισμού = η κατακόρυφη ΣΤΟΙΒΑ, όχι το πέδιλο.** Μια κολώνα κατεβαίνει μόνο αν
**δεν** υπάρχει άλλη κολώνα του ίδιου πεδίλου χαμηλότερα στην ίδια στοίβα (plan-centroid της μιας
μέσα στο footprint της άλλης — το ίδιο plan-coverage κριτήριο, εφαρμοσμένο κολώνα→κολώνα).

> ⚠️ Το πιο απλό «κρατάμε τη **χαμηλότερη κολώνα ανά πέδιλο**» είναι **λάθος**: μία πεδιλοδοκός /
> εδαφόπλακα στηρίζει πολλές κολώνες σε **διαφορετικά** plan σημεία — αν οι βάσεις τους δεν είναι
> ισοϋψείς (κεκλιμένη στάθμη έδρασης), θα κατέβαινε μόνο μία και οι υπόλοιπες θα αιωρούνταν.

**DEFER — το ίδιο ζήτημα ζει και στον graph.** Οι `footing-bearing` ακμές προς υπερκείμενες
κολώνες παράγονται ακόμη (απλώς τις αγνοεί η continuity). Άρα το **joint rebar** μπορεί να
τοποθετεί αναμονές από πέδιλο σε κολώνα 1ου ορόφου. Η διόρθωση ανήκει στο `buildFootingEdges`,
αλλά ακτινοβολεί σε `reinforcement-continuity` / `joint-reinforcement-quantities` / BOQ →
χωριστό slice, με δικά του tests.

**Κανόνας για το `createDerivedMapStore` (μην το επαναλάβεις).** Το transient global transport
είναι έγκυρο **μόνο** για DERIVED τιμές που καταναλώνονται στο **ίδιο scope** που τις παρήγαγε —
δηλαδή τον ενεργό όροφο (π.χ. `BeamSupportConditionStore`). Πριν προσθέσεις store εκεί:
**ποιος το διαβάζει, και για ποιον όροφο;** Αν η απάντηση είναι «ο 3Δ render path», τότε ανήκει
στο `SyncContext`, όχι σε store.

## 8. Changelog
| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία + υλοποίηση.** §6.1 derived organism continuity (render + transient store + organism wiring)· §6.2 shared pure engine + dialog Auto/override. 18 jest GREEN. |
| 2026-07-26 | **§7 — transport rewrite (active-level → per-stack).** `ColumnBaseContinuityStore` **διαγράφηκε**· ο χάρτης παράγεται στο `BimSceneLayer.syncMultiFloor` από ΕΝΑΝ graph πάνω σε όλους τους ορόφους και ταξιδεύει στο `SyncContext`· ο ίδιος graph περνά ως `prebuiltGraph` στο `syncJointRebar` (μηδέν διπλό build). Single-floor scope → `null` (καμία προέκταση, by design). **§7.1:** το πέδιλο εδράζει μόνο τη χαμηλότερη κολώνα κάθε κατακόρυφης στοίβας — πριν κατέβαινε ΚΑΘΕ υπερκείμενη κολώνα ως τη θεμελίωση (bug που έκρυβε το παλιό active-level scope). Διορθώθηκαν λάθος αναφορές «ADR-488 §6.1/§6.2» → ADR-489 σε 8 αρχεία (το ADR-488 είναι το proactive-FEM ADR). 34 jest GREEN (+172 scene regression). |
