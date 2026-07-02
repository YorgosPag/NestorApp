# HANDOFF — ADR-449 σοβάς: ΕΝΙΑΙΑ περιμετρική κουβέρτα χωρίς οριζόντια ραφή (vertical band merge)

**Ημερομηνία:** 2026-07-02 · **ADR:** ADR-449 (structural-finish-skin)
**Κατάσταση:** working tree ΚΑΘΑΡΟ (Giorgio έκανε commit) · ⚠️ **shared working tree με άλλον agent** — re-read κάθε αρχείο ΠΡΙΝ edit.
**COMMIT: ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push. **ΟΧΙ tsc** (N.17· jest OK). **Απαντάς ΕΛΛΗΝΙΚΑ.**

---

## 0. ΤΙ ΘΑ ΚΑΝΕΙΣ (μία γραμμή)

Ο περιμετρικός **σοβάς** μιας κολόνας (και ολόκληρου του συνενωμένου οργανισμού κολόνα+δοκάρι+τοίχος+…)
πρέπει να είναι **ΜΙΑ ενιαία κουβέρτα** ανά ορατή παρειά, **χωρίς οριζόντια ραφή** στο ύψος του κάτω
μέρους του δοκαριού. Σήμερα σπάει σε 2 ζώνες ύψους (band κάτω 0→beam-soffit + band πάνω
beam-soffit→κορυφή) → κάθε ζώνη γίνεται ξεχωριστό prism → **ορατή οριζόντια ραφή** (βλ. στιγμιότυπο
`Στιγμιότυπο οθόνης 2026-07-02 130735.jpg`, κόκκινος κύκλος + πράσινη γραμμή). Αφορά **ΜΟΝΟ τους
σοβάδες**, ΟΧΙ τα σώματα (μπετά).

---

## 1. 🔴 Ο ΑΚΡΙΒΗΣ ΚΑΝΟΝΑΣ (Giorgio, επικυρωμένος — big-player)

**Ενιαία περιμετρική κουβέρτα ανά ορατή παρειά. Ραφές ΜΟΝΟ σε:**
- **αλλαγή διεύθυνσης** (γωνία — κατακόρυφη ραφή· την αποδέχεται), και
- **αλλαγή υλικού/χρώματος** (η per-face βαφή του Slice A/B/C· εσκεμμένη).

**Η ΜΟΝΗ νόμιμη οριζόντια ακμή** = εκεί που άλλο σώμα (δοκάρι/τοίχος) **όντως κόβει** τη συγκεκριμένη
παρειά → ο σοβάς **τελειώνει καθαρά** στο σόφιτο (κάτω παρειά δοκαριού). Αυτό είναι **τέλος/καπάκι**,
ΟΧΙ ραφή στη μέση της κουβέρτας.

**Ρητά ζητούμενα:**
1. **Ελεύθερη παρειά** (χωρίς δοκάρι/τοίχο επάνω της) → **ΜΙΑ κουβέρτα δάπεδο→κορυφή, ΜΗΔΕΝ οριζόντια ραφή.** ← το κύριο bug.
2. **Πάνω καπάκι σοβά** → **ένα και μοναδικό** σε όλο τον οργανισμό, είτε 1 είτε Ν οντότητες, μετά την ένωση.
3. **Κάτω καπάκι δοκαριού (σόφιτο) όταν ΔΕΝ υπάρχει τοίχος από κάτω** → ορατό → **ενιαίο καπάκι** όπου απαιτείται.
4. Όσο αυξάνονται οι οντότητες (κολόνα→+δοκάρι→+τοίχος→+κολόνα άλλης πλευράς) → **πάντα μία περιμετρική κουβέρτα**.

**Big-player (Giorgio απαίτηση — Revit / Maxon Cinema 4D / Figma-level):** οι επιφάνειες φινιρίσματος
είναι **συνεχείς πάνω σε κάθε ορατή ομοεπίπεδη περιοχή**· joints μόνο σε γωνία / αλλαγή υλικού /
πραγματικό γεωμετρικό όριο. ΠΟΤΕ αυθαίρετη οριζόντια ζώνη ανά μέλος. **Αν οι μεγάλοι δεν το προτείνουν
έτσι → ακολούθησε τη δική τους πρακτική.** FULL enterprise + FULL SSoT.

---

## 2. 🔴 ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ (Giorgio απαράβατο)

Τρέξε ΠΡΑΓΜΑΤΙΚΟ grep audit — ΜΗΝ φτιάξεις διπλότυπο· επέκτεινε τον υπάρχοντα μηχανισμό:

```bash
# Η ΠΗΓΗ του κάθετου split (2 bands όταν εδράζεται δοκάρι):
grep -rn "computeColumnFinishFaces\|ColumnFinishBand\|junctionBandHeightMm\|bandBottomMm\|zBottomMm\|zTopMm" src/subapps/dxf-viewer/bim/finishes/structural-finish-scene.ts
# Ο silhouette builder ανά z-band + ο ΟΡΙΖΟΝΤΙΟΣ merge (το πρότυπο για κάθετο merge):
grep -rn "computeStructuralSilhouetteBands\|SilhouetteBand\|SilhouetteInput\|resolveBandFaces" src/subapps/dxf-viewer/bim/finishes/structural-finish-silhouette.ts
grep -rn "mergeCollinearFinishSegments" src/subapps/dxf-viewer/bim/finishes/structural-finish-merge.ts
# Ο 3D renderer που κάνει ΕΝΑ prism ανά band (εδώ φαίνεται η ραφή):
grep -rn "addFinishPrism\|SilhouetteBand\|zBottom\|zTop" src/subapps/dxf-viewer/bim-3d/converters/structural-finish-3d.ts
# Καπάκια (πάνω/κάτω οριζόντιες όψεις):
grep -rn "computeStructuralSilhouetteBands\|cap\|top\|bottom\|soffit" src/subapps/dxf-viewer/bim/finishes/structural-finish-horizontal.ts src/subapps/dxf-viewer/bim/finishes/structural-finish-scene-horizontal.ts
# 2D renderer (η ραφή φαίνεται & στην κάτοψη;):
grep -rn "band\|colorHex\|seg" src/subapps/dxf-viewer/bim/finishes/structural-finish-plan-geometry.ts
# safeUnion / snap grid SSoT (μη ξαναγράψεις — ADR-049 snapToGrid + wall-footprint-union):
grep -rn "safeUnion\|unionFootprints\|snapToGrid" src/subapps/dxf-viewer/bim/
```

**Στόχος:** βρες πού μπορείς να **ενώσεις κατακόρυφα** τις γειτονικές z-bands που έχουν **ίδιο outline
+ ίδια attributes** (materialId/colorOverride/thickness/coverage) σε **μία** συνεχή όψη/prism — αντί να
φτιάξεις νέο σύστημα. Το `mergeCollinearFinishSegments` είναι ο ΟΡΙΖΟΝΤΙΟΣ αδελφός· ψάξε αν ο κάθετος
merge ανήκει (α) στο επίπεδο των `ColumnFinishBand[]` (πριν τον silhouette), (β) στο
`computeStructuralSilhouetteBands` (μετά το per-band build, merge γειτονικών bands), ή (γ) στον 3D/2D
renderer (merge prisms). Διάλεξε το ΕΝΑ σωστό SSoT σημείο — **ίχνευσε ΟΛΟ το pipeline** (member→bands→
silhouette→attribution→renderer), μην κρίνεις απομονωμένα.

---

## 3. ΤΙ ΞΕΡΟΥΜΕ ΗΔΗ (μηχανισμός — recon 2026-07-02)

| Αρχείο | Ρόλος στη ραφή |
|---|---|
| `bim/finishes/structural-finish-scene.ts` | **Η ΠΗΓΗ.** `computeColumnFinishFaces` → `ColumnFinishBand[]`. Όταν εδράζεται δοκάρι: 2 bands — `{faces: full, zBottomMm:0, zTopMm: bandBottomMm}` (κάτω, ελεύθερο) + `{faces: junction, zBottomMm: bandBottomMm, zTopMm: heightMm}` (πάνω, junction). `junctionBandHeightMm` = ύψος ζώνης δοκαριού. Χωρίς δοκάρι → 1 band full-height. `computeBeamFinishFaces` = αντίστοιχο για δοκάρι. |
| `bim/finishes/structural-finish-silhouette.ts` | `computeStructuralSilhouetteBands(input) → SilhouetteBand[]` (ανά z-band). `resolveBandFaces` = safeUnion cores → offset σοβά → `applyFinishOverrideEdges` → `mergeCollinearFinishSegments` (**μόνο ΟΡΙΖΟΝΤΙΑ, εντός band**). ΔΕΝ ενώνει bands κατακόρυφα. |
| `bim/finishes/structural-finish-merge.ts` | `mergeCollinearFinishSegments` — ενώνει collinear segments ίδιου υλικού/χρώματος **οριζόντια**. **Το πρότυπο** για τον κάθετο merge (mirror). |
| `bim/finishes/structural-finish-attribution.ts` | `applyFinishOverrideEdges` — per-face υλικό/χρώμα stamp/split (Slice B). |
| `bim/finishes/structural-finish-scene-silhouette.ts` | Καλεί `computeStructuralSilhouetteBands` + `pushFinishOverrideEdges`· το διαβάζει ο 3D builder. |
| `bim/finishes/structural-finish-horizontal.ts` + `-scene-horizontal.ts` | Οριζόντια καπάκια (πάνω/κάτω/σόφιτο). Εδώ ζει το «ένα καπάκι». |
| `bim-3d/converters/structural-finish-3d.ts` | `addFinishPrism` — **ΕΝΑ prism ανά SilhouetteBand** (zBottom→zTop). Στοιβαγμένα prisms = η ορατή ραφή 3D. |
| `bim/finishes/structural-finish-plan-geometry.ts` | 2D κάτοψη χρώμα (έλεγξε αν φαίνεται ραφή & εδώ). |

**Κρίσιμη διάκριση coverage:** στην κάτω band ΟΛΕΣ οι παρειές είναι `full` (ορατές)· στην πάνω
(`junction`) band ΜΟΝΟ οι παρειές **χωρίς** δοκάρι είναι ορατές, οι υπόλοιπες κόβονται. Άρα:
- Παρειά **ίδια** σε κάτω+πάνω band (χωρίς δοκάρι) → **ένωσέ τις** → μία όψη full-height, μηδέν ραφή.
- Παρειά που **αλλάζει** (δοκάρι την κόβει στην πάνω band) → κράτα την οριζόντια ακμή = **σόφιτο τέλος** (καθαρό, όχι διπλό).

---

## 4. ΒΗΜΑΤΑ (αφού κάνεις το audit — μη δεσμεύεσαι πριν)

1. **Plan Mode πρώτα** (ADR-driven, N.0.1): σύγκρινε ADR-449 vs τρέχοντα κώδικα, ενημέρωσε αν αποκλίνει.
2. Σχεδίασε **κάθετο band-merge SSoT** (mirror `mergeCollinearFinishSegments`): γειτονικές bands με **ταυτόσημο per-edge outline + ταυτόσημα attributes** → μία συνεχής όψη/prism που καλύπτει και τα δύο z-ranges. Οριζόντια ακμή επιβιώνει ΜΟΝΟ όπου το outline της παρειάς αλλάζει (coverage/υλικό).
3. Εφάρμοσε 3D (`addFinishPrism` → ένα prism ανά ενοποιημένη όψη) **ΚΑΙ** 2D (plan-geometry) — ίδιο SSoT, μηδέν διπλός κανόνας.
4. **Καπάκια:** πάνω = ένα ενιαίο· σόφιτο δοκαριού χωρίς τοίχο από κάτω = ενιαίο όπου απαιτείται (δες `structural-finish-horizontal.ts`).
5. **Tests (jest ΜΟΝΟ):** ελεύθερη παρειά → 1 συνεχής όψη (0 ραφή)· παρειά με δοκάρι → καθαρό σόφιτο τέλος· multi-entity (κολόνα+δοκάρι+τοίχος) → μία περιμετρική· BOQ ταυτότητα (τα m² να ΜΗΝ αλλάξουν από τον merge — μόνο η οπτική ραφή φεύγει).
6. **ADR-449 changelog** νέο entry. **ADR-040:** μόνο αν αγγίξεις canvas micro-leaves — τα finish geometry/3D-converter αρχεία είναι **εκτός** CHECK 6B/6C/6D (όπως το Slice B)· αν μείνεις σε geometry/converters ΔΕΝ χρειάζεται ADR-040. Επιβεβαίωσέ το.

---

## 5. ΚΡΙΣΙΜΟ CONTEXT / DO-NOT

- ❌ **ΜΗΝ commit/push** (μόνο Giorgio, N.(-1)). ❌ ΜΗΝ `--no-verify`. ❌ ΜΗΝ `tsc`/typecheck (N.17· **jest OK**).
- ❌ ΜΗΝ `any`/`as any`/`@ts-ignore`. ❌ ΜΗΝ hardcoded strings (i18n, N.11). ❌ ΜΗΝ inline styles.
- ⚠️ **Shared working tree** — re-read κάθε αρχείο ΠΡΙΝ edit.
- ✅ **SSoT audit (grep) ΠΡΙΝ κώδικα** (§2). Reuse: `mergeCollinearFinishSegments` (πρότυπο), `safeUnion`/`unionFootprints`, ADR-049 `snapToGrid`, `applyFinishOverrideEdges`, `computeStructuralSilhouetteBands`. **ΜΗΝ ξαναγράψεις band/union/snap.**
- ✅ **ΜΟΝΟ σοβάδες** — ΟΧΙ τα σώματα (μπετά).
- ⚠️ **BOQ ταυτότητα:** ο merge είναι **οπτικός** (ένωση όψεων ίδιας ιδιότητας)· τα εμβαδά/υλικά ανά όψη ΔΕΝ αλλάζουν. Επιβεβαίωσέ το με test.
- 🔴 **Browser-verify (Giorgio)** μετά: σκέτη κολόνα → μία κουβέρτα, ραφή μόνο στις γωνίες· +δοκάρι → καμία οριζόντια ραφή στις ελεύθερες παρειές, καθαρό σόφιτο τέλος· ένα πάνω καπάκι.

---

## 6. ΓΙΑΤΙ ΤΩΡΑ (context)

Μόλις ολοκληρώθηκε το Slice C (per-face βαφή σοβά 2D+3D — «Βαφή σοβά» paintbrush εργαλείο). Ο Giorgio
εντόπισε στο 3D ότι ο περιμετρικός σοβάς κολόνας σπάει με οριζόντια ραφή στο ύψος του δοκαριού — τεχνούργημα
του band-based υπολογισμού, ΟΧΙ πραγματικό χαρακτηριστικό σοβά. Στόχος: ενιαία κουβέρτα, ραφές μόνο σε
αλλαγή διεύθυνσης/υλικού, καθαρό τέλος μόνο στο σόφιτο. Big-player parity.
