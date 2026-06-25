# ADR-529 — Δοκάρι προάγει γωνιακή κολόνα μίας κατεύθυνσης (Ι → Γ boundary element)

**Status:** ✅ APPROVED (core implemented, UNCOMMITTED) · **Date:** 2026-06-25
**Type:** Feature + bugfix (DXF/BIM Viewer — beam placement, structural junction). Revit/ETABS-grade.
**Builds on:** ADR-528 (beam auto-span) · **Inverse of:** ADR-525 (L-κολόνα γεμίζει γωνία δύο δοκαριών)
**Related:** ADR-496 (smart column type-change align-to-beam) · ADR-449 (junction weld) · ADR-492 (associative beam reframe) · ADR-040 (preview canvas perf, CHECK 6B/6D)

---

## 1. Πρόβλημα (Giorgio 2026-06-25, στιγμιότυπο)

**Τοίχος 1** (κεφαλαίο Γ, αμβλεία γωνία) αριστερά, **Κολόνα 2** (μίας κατεύθυνσης, Β-Ν > Α-Δ — σαν Ι) δεξιά.
Εργαλείο **Δοκάρι** → cursor στην ανατολική παρειά του οριζόντιου σκέλους του Τοίχου 1:

- **(A) Bug:** το φάντασμα δεν γεφύρωνε μέχρι την αντικριστή κολόνα.
- **(B) Feature (στατικό):** η Κολόνα 2 δεχόταν δοκάρι στη **δυτική (μη-αναπτυσσόμενη)** παρειά της.

## 2. Στατική απόφαση (EC2/EC8)

Δοκάρι σε **μη-αναπτυσσόμενη στενή παρειά** γωνιακής κολόνας = **ανεπαρκής κόμβος** (joint shear, αγκύρωση
ράβδων, εκκεντρότητα `e ≤ b_c/4`, EC8 §5.4.1.2.1). Σωστό: η γωνιακή κολόνα να **αναπτύσσεται και στις δύο
διευθύνσεις** (**boundary element**, EC8 §5.4.2.4) → **προαγωγή Ι → Γ/L** με σκέλος προς το δοκάρι.

## 3. Λύση

### Φ1 — Bug span (A): `bim/framing/beam-span-snap.ts`
Η αρχική υλοποίηση (ADR-528) όριζε τον άξονα ζεύγους **centroid→centroid**. Για **κοίλο/Γ** μέλος το
centroid πέφτει στην εσοχή → ο άξονας γέρνει → ο cursor στην ανατολική παρειά του οριζόντιου σκέλους βγαίνει
κάθετα μακριά. Επιπλέον, ο cursor **ΠΑΝΩ/μέσα** σε παρειά (όχι στο γεωμετρικό κενό) απορριπτόταν. Δύο
διορθώσεις, **orientation-agnostic & μηδέν regression** για κυρτά/ευθυγραμμισμένα μέλη (ισοδύναμο by
construction — επιβεβαιωμένο vs τα 11 υπάρχοντα ADR-528 tests):

1. **Facing-point άξονας** — ο άξονας ορίζεται από τα **πλησιέστερα σημεία των δύο outlines** (το σκέλος/παρειά
   που «κοιτάζει» το άλλο μέλος), με ένα refinement pass (`fA→fB→fA`). Κυρτό ευθυγραμμισμένο ζεύγος → ίδιο
   u/start/end με πριν.
2. **Along-margin** — ο cursor μετράει «σε αυτό το φάτνωμα» και όταν είναι **πάνω/λίγο μέσα** σε παρειά
   (`along ∈ [sA−capture, sB+capture]`), όχι μόνο αυστηρά στο κενό.
3. **Face-perpendicular προτεραιότητα** (refine 2026-06-25, 2ο στιγμιότυπο) — ζεύγη με άξονα **κάθετο σε
   παρειά** (το facing-point σε **εσωτερικό ακμής**, `|u·edge| ≤ sin20°`) προηγούνται των **λοξών γωνία-σε-
   γωνία** (facing-point = κορυφή)· εντός ίδιας κλάσης, nearest-wins. Το λοξό μένει **fallback** (μηδέν
   regression στο diagonal-2-columns test). Λύνει: (α) στη ΝΑ γωνία τοίχου το ghost γεφύρωνε **λοξά** σε
   διαγώνια κολόνα αντί **οριζόντια** στην αντικριστή· (β) cursor στη μέση τοίχου↔κολόνας τραβούσε το δοκάρι
   προς τη διαγώνια αντί να ευθυγραμμίζεται face-to-face.

### Φ2 — Προαγωγή Ι → Γ (B), FULL SSoT reuse
1. **Γεωμετρία** — `promoteColumnToBoundaryL` (στο `bim/columns/column-beam-align.ts`, ADR-496 home):
   closed-form L (reuse `rotationDegToAlignLocalY`/`rotateVector`/`unitVector` + `beamEndsByProximity`).
   **Διατηρεί** την αρχική διατομή ως **κατακόρυφο σκέλος** (`armWidth` = στενή διάσταση, `depth` = μεγάλη
   διάσταση) και **μεγαλώνει** οριζόντιο **foot** προς το δοκάρι (`armLength` = πλάτος δοκαριού = δομική
   συνέχεια, mirror ADR-496/525· `width` = στενή διάσταση + `bearing`). Το κέντρο της αρχικής κολόνας
   απεικονίζεται στο L-local `(−bearing/2, 0)` → η αρχική διατομή μένει **ακριβώς στη θέση της**.
   > **Σημ.:** αντίστροφο του ADR-496 `alignColumnToFramingBeam` (που **συρρικνώνει** μέσα στο υπάρχον bbox).
2. **Detector** — `bim/columns/column-beam-promote-junction.ts` (pure): framing (`findColumnsFramedByBeamForGraph`,
   ADR-494) + gates: (1) kind ∈ {rectangular, shear-wall}, (2) ασύμμετρη (`longDim/shortDim ≥ 1.2`),
   (3) δοκάρι ∥ στενός άξονας (μη-αναπτυσσόμενη παρειά), (4) γωνία (`|sLong| ≥ longDim·0.15`).
3. **bearing length (EC8, decision Giorgio)** — `clamp(beam.depth, [shortDim, 2·shortDim])`.
4. **Confirmation dialog** — `column-promote-confirm-store` (reuse `createConfirmStore` SSoT) +
   `ColumnPromoteConfirmDialog` (Revit δεν αλλάζει σιωπηλά γεωμετρία — decision Giorgio).
5. **Wiring** — `hooks/useColumnBeamPromote.ts` (αδελφός `useStructuralAutoAttach`): `drawing:entity-created`
   (beam) → detect → confirm → `UpdateColumnParamsCommand` + emit `bim:column-params-updated` (→ ADR-492
   reframe cascade ξανα-πλαισιώνει· ADR-449 weld αυτόματο). **Re-detect στο execute-time** ώστε το σύγχρονο
   weld/attach να μην πατηθεί.

## 4. Decisions (Giorgio 2026-06-25)
| # | Ερώτημα | Απόφαση |
|---|---------|---------|
| 1 | Προαγωγή αυτόματη ή confirm; | **Confirmation dialog** (reuse `createConfirmStore`) |
| 2 | `armLength`/μήκος νέου σκέλους | **bearing length (EC8)** = `clamp(beam.depth, [shortDim, 2·shortDim])` |
| 3 | Εύρος κολόνων | **Μόνο γωνιακές** (`|sLong| ≥ longDim·0.15`) |
| 4 | Shear-walls | **Συμπεριλαμβάνονται** (kind ∈ {rectangular, shear-wall}) |

## 5. Αρχεία
- **Φ1:** `bim/framing/beam-span-snap.ts` (+test).
- **Φ2 geometry/detect:** `bim/columns/column-beam-align.ts` (`promoteColumnToBoundaryL`)·
  `bim/columns/column-beam-promote-junction.ts` (+test).
- **Φ2 confirm/UI:** `bim/columns/column-promote-confirm-store.ts`· `ui/dialogs/ColumnPromoteConfirmDialog.tsx`·
  `app/dxf-viewer-lazy-components.tsx`· `app/DxfViewerDialogs.tsx`· i18n `el/en/dxf-viewer-shell.json` (`columnPromoteL`).
- **Φ2 wiring:** `hooks/useColumnBeamPromote.ts`· `app/DxfViewerContent.tsx`.

## 6. Επαλήθευση
- **jest:** `column-beam-promote-junction.test.ts` (12: geometry 4 διατάξεις + detector gates)·
  `beam-span-snap.test.ts` (+2 Φ1: cursor-στην-παρειά + κοίλο Γ)· `column-beam-align.test.ts` (25 — μηδέν regression).
- **Browser (Giorgio):** Δοκάρι → cursor ανατ. παρειά Γ-τοίχου → ghost γεφυρώνει μέχρι δυτ. παρειά Κολόνας 2 →
  confirm → η Κολόνα 2 γίνεται Γ (σκέλος προς το δοκάρι) → weld.
- ⚠️ CHECK 6B/6D → stage **ADR-040 + ADR-529** (+ ADR-525/528) μαζί.

## 7. Changelog
- **2026-06-25** — Core implementation (Φ1 + Φ2), 37 jest GREEN. UNCOMMITTED (commit: Giorgio).
- **2026-06-25** — Φ1 refine (2ο στιγμιότυπο): **face-perpendicular προτεραιότητα** στο span ranking (face-to-face
  νικά λοξό γωνία-σε-γωνία). +1 jest (face-preference vs diagonal). 38 jest GREEN.
