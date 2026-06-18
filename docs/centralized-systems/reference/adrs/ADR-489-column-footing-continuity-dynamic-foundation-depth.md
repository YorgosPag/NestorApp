# ADR-489 — Στατική συνέχεια κολώνα→πέδιλο + δυναμικό βάθος θεμελίωσης

**Status:** ✅ Implemented (UNCOMMITTED 2026-06-18) — §6.1 πλήρες, §6.2 engine + dialog UX (live viewer-reconciler = DEFER)
**Date:** 2026-06-18
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
| `bim/structural/organism/column-base-continuity-store.ts` **(NEW)** | Transient transport (mirror `BeamSupportConditionStore`, ADR-486)· writer=`useStructuralOrganism`, reader=`syncColumns`· low-freq → ADR-040 safe. |
| `hooks/useStructuralOrganism.ts` | `ColumnBaseContinuityStore.set(buildColumnBaseContinuityMap(graph))` δίπλα στο beam-support set — live σε κάθε structural event (μηδέν νέο event). |
| `bim-3d/converters/bim-three-structural-converters.ts` `columnToMesh` | Νέα param `effectiveBaseZmm?`· flat path: `baseDropMm = max(0, nominalBaseAbs − effectiveBase)`, ύψος `+=baseDropMm`, `position.y −=baseDropMm` → βάση στο πέδιλο, κορυφή σταθερή. Σοβάς/οπλισμός παίρνουν το επιμηκυμένο ύψος. Attached-prism path = DEFER. |
| `bim-3d/scene/bim-scene-attach-syncs.ts` `syncColumns` | Διαβάζει `ColumnBaseContinuityStore.get(column.id)` (ΟΧΙ για ρητά base-attached) → περνά `effectiveBaseZmm`. Κοινός path single + multi-floor. |

### §6.2
| Αρχείο | Ρόλος |
|---|---|
| `src/types/building/derived-foundation-depth.ts` **(NEW, shared)** | `resolveDerivedFoundationDepthMm(input)` — pure. `depth = max(maxFootingThk + (tie?rise:0) + cover, slab + cover, frostMin)`, module 50mm. Input ΧΩΡΙΣ elevation → μη-κυκλικό. SHARED (viewer + building-management, μηδέν dependency-direction violation). `seedDerivedFoundationDepthMm()` = 1200mm bootstrap (πέδιλο 500 + συνδετήριες 500 + κάλυψη 200). |
| `src/types/building/elevation.schemas.ts` + `contracts.ts` + `building-services.ts` | Νέο `foundationDepthAuto?: boolean` (default true) στο building doc. |
| `components/building-management/tabs/BuildingVerticalSetupForm.tsx` | `foundationDepthIsAuto` toggle· Auto → read-only derived display + badge + «Χειροκίνητη υπέρβαση»· override → editable + «Επαναφορά σε αυτόματο». persist `foundationDepthAuto` + effective depth. |
| i18n `el/en building-tabs.json` | `foundationDepthAutoBadge/DerivedFrom/Override/AutoReset`. |

---

## 4. Ροή continuity (§6.1, end-to-end)
```
add/connect/remove → structural event → useStructuralOrganism recompute
  → buildStructuralGraph (footing-bearing ακμές, cross-level absolute Z)
  → buildColumnBaseContinuityMap(graph)  [column→footing.topZmm, min, μόνο κάτω]
  → ColumnBaseContinuityStore.set(map)
3Δ re-sync → syncColumns → ColumnBaseContinuityStore.get(id) → columnToMesh(effectiveBaseZmm)
  → baseDropMm → κολώνα εδράζεται στο πέδιλο (κορυφή σταθερή)
αλλαγή βάθους (§6.2) → foundation-level-store → νέο footing topElevation → §6.1 re-derive → κολώνα ακολουθεί
```

## 5. Tests (jest GREEN)
- `derive-column-base-continuity.test.ts` (7): cross-level −1000, no-footing absence, ίδιο-επίπεδο no-op, ποτέ-πάνω, βαθύτερο νικά, per-column, αγνοεί μη-footing ακμές.
- `column-base-continuity-3d.test.ts` (3): βάση πέφτει 1m + ύψος +1m + κορυφή σταθερή· undefined no-op· effective-πάνω no-op.
- `derived-foundation-depth.test.ts` (8): seed 1200, thickness-driven, max-of-many, tie-term, slab-term, frost floor, empty→seed, module rounding.

## 6. DEFER (επόμενα βήματα)
- **Live viewer-reconciler §6.2:** η engine να τρέχει viewer-side σε `bim:foundation-params-updated` και να ενημερώνει το `building.foundationDepth` + foundation level elevation από ΠΡΑΓΜΑΤΙΚΑ πέδιλα (αντί seed). Αλληλεπιδρά με ADR-484 (uncommitted) → χωριστό slice. Σήμερα: dialog seed + override.
- **Analytical model continuity:** ο `columnNode.baseZmm` στον graph μένει nominal (η ακμή footing-bearing υπάρχει ήδη)· για FEM (ADR-481) ο κόμβος να πέφτει στο πέδιλο = επόμενο.
- **Attached-prism path** base drop (σπάνιο cross-cutting).

## 7. Changelog
| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία + υλοποίηση.** §6.1 derived organism continuity (render + transient store + organism wiring)· §6.2 shared pure engine + dialog Auto/override. 18 jest GREEN. UNCOMMITTED. |
