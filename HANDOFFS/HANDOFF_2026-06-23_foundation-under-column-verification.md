# HANDOFF — Έλεγχος: «Στέκει σωστά η θεμελίωση κάτω από την κολόνα;» (Auto-Foundation Design)

**Ημερομηνία:** 2026-06-23
**ADR:** ADR-459 (Structural Organism Connectivity) §6j Phase 7 + §8 changelog v12 + v13
**Κατάσταση:** UNCOMMITTED — commit τον κάνει ο **Giorgio** (ΟΧΙ ο agent). **Shared working tree με άλλον agent** → ΜΗΝ κάνεις git ops, ΜΗΝ αγγίζεις αρχεία εκτός της λίστας §6.

---

## 1. ΤΙ ΕΛΕΓΧΟΥΜΕ (verification campaign)

Ελέγχουμε τον **Αυτόματο Σχεδιασμό Θεμελίωσης** (ADR-459 Φ7, `runAutoFoundationDesign`): όταν σχεδιάζονται κολόνες σε διακριτό όροφο **Θεμελίωσης**, το σύστημα αποφασίζει αυτόματα μεμονωμένο vs combined πέδιλο, το διαστασιολογεί και το τοποθετεί. **Ερώτημα ελέγχου:** «στέκει σωστά η θεμελίωση κάτω από κάθε κολόνα — σωστό κέντρο, επαρκής εξοχή, πλήρης κάλυψη;»

**Μέθοδος ελέγχου (Firestore MCP, live):** ο Giorgio σχεδιάζει κολόνες στο browser → εμείς κάνουμε `firestore_query` στα `floorplan_columns` + `floorplan_foundations` (+ `floorplan_walls`) και επαληθεύουμε γεωμετρικά (footprint extents, κέντρο, εξοχή ανά παρειά).
- Project: `proj_533d7d91-...`, Όροφος κολόνων: `flr_926d2b1f-...`, Όροφος θεμελίωσης: `flr_d39d1f9e-...`.
- Σύνδεση κολόνα↔πέδιλο μέσω `column.params.footingId`.

---

## 2. ΣΕΝΑΡΙΑ ΠΟΥ ΕΛΕΓΧΘΗΚΑΝ ΗΔΗ

| # | Σενάριο | Αποτέλεσμα |
|---|---------|-----------|
| A | **1 ορθογώνια** κολόνα (1000×250, rot 90°) → isolated πέδιλο | ✅ Σωστό (175mm εξοχή παντού, ίδιο κέντρο) |
| B | **2 ορθογώνιες σε L** (1 στραμμένη 90°) → combined | ❌→✅ **Βρέθηκε bug v12, διορθώθηκε, browser-verified** |
| C | **1 composite L** κολόνα → isolated | ❌→✅ **Βρέθηκε bug v13, διορθώθηκε, 🔴 browser-verify ΕΚΚΡΕΜΕΙ** |

---

## 3. BUGS ΠΟΥ ΒΡΕΘΗΚΑΝ & ΔΙΟΡΘΩΘΗΚΑΝ

### v12 — Combined footing: rotation-aware enclosure ✅ (browser-verified)
- **Σύμπτωμα (Firestore-verified):** combined πέδιλο 2 κολόνων άφηνε **στραμμένη 90°** κολόνα (1000×250, world Y∈[250,1250]) ακάλυπτη — έφτανε μόνο Y=1102 αντί 1425 (~323mm ακάλυπτα).
- **Ρίζα:** `requiredPad` (auto-foundation-layout.ts) χαρτογραφούσε `suggestPadDimensions.widthMm→world-X`, `lengthMm→world-Y` **αγνοώντας `rotationDeg`** → σε στροφή 90° τα width↔depth αντιστρέφονται στους world άξονες.
- **Fix (FULL SSoT):** το `PadRect` κρατά πλέον **world-AABB** half-extents (`aabbHalfW/aabbHalfL`) μέσω NEW `rotatedHalfExtents` (**reuse `rotatePoint` ADR-188** σε 4 local corners). `padsShareFooting` + `combinedFooting` enclosure τα χρησιμοποιούν. Isolated path κρατά local dims+rotation (αμετάβλητο).
- **Verify:** μετά το fix, Y=1425 → Col1 καλύπτεται πλήρως + 175mm εξοχή. ✅

### v13 — Composite (L/T/U): area-centroid + footprint-aware sizing 🔴 (browser-verify εκκρεμεί)
- **Σύμπτωμα (Firestore-verified):** isolated πέδιλο L κολόνας (bbox 1000×1000) κεντραρισμένο στο **vertex-mean** (1068, 667) με εξοχή που έπεφτε στα **66.67mm < 150mm** στις άκρες του L· πραγματικό κέντρο βάρους = (990.7, 589.3).
- **Δύο ρίζες:** (1) `polygonCentroid` = μέσος όρος κορυφών ≠ area-centroid για μη-συμμετρικά ίχνη → εκκεντρότητα φορτίου → μη-ομοιόμορφη πίεση· (2) `requiredPad` διαστασιολογούσε από `params.width/depth` (= bbox) σαν κεντραρισμένη κολόνα.
- **Fix (FULL SSoT, unified ορθογώνια+composite):**
  - NEW `polygonAreaCentroid` σε `polygon-utils.ts` (**reuse `shoelaceArea`**· degenerate→fallback vertex-mean).
  - `toLayoutColumn` → `polygonAreaCentroid(verts)` (placement = load resultant) + περνά πραγματικό `footprint` στο `LayoutColumnInput` (NEW required field).
  - NEW `effectiveFaces` (auto-foundation-layout.ts) → effective όψεις στο LOCAL frame **συμμετρικά γύρω από area-centroid** (reuse `rotatePoint` un-rotate) → τροφοδοτεί το **υπάρχον `suggestPadDimensions`** (μηδέν duplicate sizing logic). Εγγυάται ≥overhang ΟΛΕΣ οι παρειές.
  - **Μηδέν regression:** ορθογώνια κεντραρισμένη → area-centroid=bbox-center, faces=width×depth → byte-ταυτόσημο· τα v12 tests GREEN.

---

## 4. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (νέα συνεδρία)

1. **🔴 Browser-verify v13 (ΠΡΟΤΕΡΑΙΟΤΗΤΑ):** σχεδίασε **composite L** κολόνα στον όροφο κολόνων → auto-design → query `floorplan_foundations`. Επιβεβαίωσε:
   - `position` ≈ area-centroid (για το γνωστό L: **990.7, 589.3**) — ΟΧΙ vertex-mean (1068, 667).
   - Εξοχή **≥150mm σε ΚΑΘΕ παρειά** του πραγματικού ίχνους (δεξιά άκρη κάτω βραχίονα x=1651.4, πάνω άκρη αριστ. βραχίονα y=1250).
2. **Επιπλέον σενάρια ελέγχου (αν περάσει το v13):**
   - **T-shape / U-shape** composite κολόνα (ίδια λογική area-centroid).
   - **Στραμμένη composite** κολόνα (rotationDeg≠0 + composite — το `effectiveFaces` un-rotate πρέπει να δουλεύει· δεν έχει ελεγχθεί live).
   - **3+ κολόνες** σε combined (transitive grouping).
   - **Combined με στραμμένες + composite μαζί**.
3. **Αν βρεθεί νέο bug:** ίδια ροή — Firestore baseline → root cause → SSoT audit (grep) → fix → jest → tsc → ADR changelog → ζήτα από Giorgio browser-verify.

---

## 5. DEFER (γνωστά, εκτός scope τώρα)

- **Pre-existing διπλότυπο vertex-mean `polygonCentroid`**: υπάρχει σε `footing-column-coverage.ts:38` **ΚΑΙ** `polygon-utils.ts:256` (ίδια λογική, διαφορετικά type sigs `CoveragePoint` vs `Point3D`, πολλοί consumers). **ΔΕΝ** το άγγιξα — risky cross-domain dedup. Ξεχωριστό task.
- **Coverage representative-point για βαθιά κοίλα:** το area-centroid L πέφτει στην εγκοπή (όπως & το παλιό vertex-mean → μηδέν regression). Proper fix = `interiorAnchorPoint` SSoT (polygon-interior-point.ts). Ξεχωριστό task.
- **BOQ per-element column↔column area over-count** (ADR-449 X5) — quantity bug, όχι visual.

---

## 6. UNCOMMITTED ΑΡΧΕΙΑ (μόνο αυτά — shared tree, μην αγγίξεις άλλα)

```
 M docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md  (§8 v12+v13)
 M src/subapps/dxf-viewer/bim/foundations/auto-foundation-layout.ts                      (PadRect world-AABB, rotatedHalfExtents, effectiveFaces, LayoutColumnInput.footprint)
 M src/subapps/dxf-viewer/bim/foundations/__tests__/auto-foundation-layout.test.ts       (col() helper +footprint, 3 rotated/composite tests)
 M src/subapps/dxf-viewer/bim/geometry/shared/polygon-utils.ts                           (NEW polygonAreaCentroid)
 M src/subapps/dxf-viewer/hooks/auto-foundation-design-core.ts                           (polygonAreaCentroid + footprint pass)
?? src/subapps/dxf-viewer/bim/geometry/shared/__tests__/polygon-utils-centroid.test.ts   (NEW, 6 tests)
```

**Tests:** auto-foundation-layout (13) + polygon-utils-centroid (6) + reconcile/suggest-pad/coverage/auto-study (31) = **όλα GREEN**. **tsc: clean** (exit 0, μηδέν σφάλματα στα αρχεία μου).

---

## 7. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (CLAUDE.md)

- **Απαντήσεις ΠΑΝΤΑ στα Ελληνικά.**
- **FULL ENTERPRISE + FULL SSOT** — «όπως η Revit».
- **ΠΡΙΝ κάθε νέο κώδικα: πραγματικό SSoT audit (grep)** για υπάρχον αντίστοιχο → reuse, ΜΗΝ δημιουργείς διπλότυπα.
- **Ο Giorgio κάνει SSoT audit (ναι/όχι ερωτήσεις)** μετά από κάθε υλοποίηση — απάντα ευθέως & 100% ειλικρινά (παραδέξου διπλότυπα).
- **COMMIT/PUSH μόνο ο Giorgio** — ΠΟΤΕ ο agent (N.(-1)). **Shared working tree** → μην git, μην αγγίζεις ξένα αρχεία.
- **ADR = πάντα ενημερώνεται** (N.0.1 PHASE 3, git-tracked).
- **memory.md = ΜΟΝΟ feedback/κανόνες** (νέα policy Giorgio 2026-06-23) — ΟΧΙ task/bug summaries (ζουν σε ADR+git).
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε `node.exe *tsc*` πριν ξεκινήσεις, ΠΟΤΕ 2 παράλληλα.
