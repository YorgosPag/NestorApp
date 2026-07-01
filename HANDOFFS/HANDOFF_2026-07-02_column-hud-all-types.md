# HANDOFF — Live grip-drag HUD ενδείξεις σε ΟΛΟΥΣ τους τύπους κολόνας (Γ/Τ/Π/Πολύγωνο/Τοιχίο/Ι)

**Ημερομηνία:** 2026-07-02
**ADR:** ADR-508 (§wall-hud / §column-hud) — `docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md`
**Status:** Προηγούμενη δουλειά **UNCOMMITTED** (ο Giorgio κάνει commit, ΟΧΙ ο agent). ⚠️ **Το working tree μοιράζεται με άλλον agent** — άγγιξε ΜΟΝΟ τα αρχεία του HUD.

---

## 🎯 ΣΤΟΧΟΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ

Επέκταση των **live «λευκών ενδείξεων»** (διαστάσεις/γωνία/ύψος που εμφανίζονται όταν σέρνεις μια λαβή)
σε **ΟΛΟΥΣ τους υπόλοιπους τύπους κολόνας** που σήμερα δείχνουν μόνο μικρά pills:
**Γ-σχήμα (L), Τ-σχήμα (T), Π-σχήμα (U), Πολύγωνο, Τοιχίο διάτμησης (shear-wall), Σχήμα Ι (I-shape)**.

Ήδη υλοποιημένα (parity με τον τοίχο): **ορθογώνια** (2 aligned διαστάσεις στις παρειές + ∠γωνία + ύψος)
και **κυκλική** (διάμετρος Ø + ύψος). Οι υπόλοιποι τύποι μένουν προς το παρόν στα pills.

### Ποιότητα / πρακτική
- **Big-player standard (Revit / Maxon Cinema 4D / Figma-level).** FULL ENTERPRISE + FULL SSoT.
- Αν οι μεγάλοι παίκτες **δεν** προτείνουν κάτι, ακολουθούμε τη δική τους πρακτική (μην εφευρίσκεις).
- **ΠΡΙΝ γράψεις κώδικα: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** — βρες υπάρχοντα κώδικα/SSoT και **reuse**,
  μηδέν διπλότυπα.
- **Plan Mode + βαθιά έρευνα** πριν την υλοποίηση.
- ❌ ΜΗΝ τρέξεις `tsc`/typecheck (κανόνας N.17). ✅ jest επιτρέπεται.
- Όριο **500 γρ./αρχείο**, **40 γρ./συνάρτηση** (N.7.1). Το `useGripGhostPreview.ts` είναι ήδη **469** — μη
  προσθέσεις κώδικα εκεί· η λογική HUD ζει στο helper (βλ. παρακάτω).

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (context — μην το ξανακάνεις, reuse το)

Live grip-drag HUD για **τοίχο** + **ορθογώνια/κυκλική κολόνα**, στο **ΙΔΙΟ RAF/frame με το ghost**
(σταθερό, χωρίς flicker — το race με ξεχωριστό RAF leaf ήταν η αιτία τρεμοπαίγματος).

### Αρχεία (UNCOMMITTED, δικά μας — μην τα σπάσεις):
- **NEW** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/column-hud-paint.ts`
  → `paintColumnHud(ctx, footprint, rotationDeg, kind, heightSpecLabel, sceneUnits, transform, viewport)`.
  Dispatch: `isRectFootprint` → `paintRectColumnHud` (2 aligned δ. στις παρειές + ∠ + ύψος)·
  `kind==='circular'` → `paintCircularColumnHud` (Ø + ύψος)· **αλλιώς no-op** ← ΕΔΩ μπαίνουν οι νέοι τύποι.
- **NEW** `src/subapps/dxf-viewer/hooks/drawing/column-hud-spec-label.ts` → `buildColumnHudSpecLabel(heightMm)`
  (i18n «ύψος X», αδελφό του wall). i18n key **`tools.column.hudSpec`** (el+en) ήδη προστέθηκε.
- **NEW** `src/subapps/dxf-viewer/bim/framing/__tests__/rect-frame.test.ts` (36 tests).
- `src/subapps/dxf-viewer/bim/framing/rect-frame.ts` — `RectFrame`, `rectFrameFromCorners`,
  `rectLocalToWorld`, `rectWorldToLocal`, `rectDirToWorld`, **`isRectFootprint`** (SSoT «είναι box;»).
- `src/subapps/dxf-viewer/hooks/tools/grip-ghost-preview-draw-helpers.ts` → **`drawMemberGripHud(...)`**
  = ΕΝΑ σημείο που ζωγραφίζει τοίχο **ΚΑΙ** κολόνα HUD (κοινό `MEMBER_HUD_SKIP`). **ΕΔΩ θα προστεθεί το
  routing για τους νέους τύπους** (καλεί ήδη `paintColumnHud` για κάθε non-skip column grip).
- `src/subapps/dxf-viewer/hooks/tools/useGripGhostPreview.ts` — καλεί `drawMemberGripHud` ΜΕΤΑ το ghost
  draw, στο ίδιο frame. (469 γρ. — ΜΗΝ φουσκώσει.)
- `src/subapps/dxf-viewer/hooks/tools/useGripDimAnnotation.ts` — τα **pills** (per-sub-dim: `al=`,`aw=`,
  `fl=`,`wt=`,`tf=`,`tw=`,`lt=`,`bt=`). Σήμερα καταστέλλονται ΜΟΝΟ για rect+circular
  (`isRectFootprint(...) || kind==='circular'`). **Καθώς προσθέτεις HUD σε κάθε νέο τύπο, κατάστειλε
  αντίστοιχα το pill του** (μηδέν διπλή ένδειξη) — ίδιο pattern.
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `tools.column.hudSpec`.
- ADR-508 changelog (§wall-hud, §column-hud).

---

## 🔑 SSoT BUILDING BLOCKS (grep-άρισέ τα & reuse — ΜΗΝ ξαναγράψεις)

- **Painters (κοινοί με τον τοίχο):**
  - `paintAlignedOverlayDimension(ctx, p1, p2, dimRef, label, transform, viewport, color)` →
    `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` (ISO-129 aligned διάσταση).
  - `drawOverlayLabel(ctx, text, sx, sy, {textColor, align})` → `canvas-v2/preview-canvas/overlay-text-style.ts`.
  - `OVERLAY_LINE_COLORS.alignment` (HUD grey) → `canvas-v2/preview-canvas/overlay-line-style.ts`.
  - formatters: `formatLengthForDisplay` (`config/display-length-format`), `formatAngleLocale` +
    `normalizeAngleDeg` (`rendering/entities/shared/…`).
- **Γεωμετρία:** `rectFrameFromCorners`/`rectLocalToWorld`/`isRectFootprint` (`bim/framing/rect-frame.ts`),
  `footprintBounds` (`bim/geometry/shared/footprint-face-frame.ts`).
- **Dim text SSoT ανά τύπο:** `formatColumnDimLabels(params)` → `bim/columns/column-dim-labels.ts`
  (rectangular `w/d`, circular `Ø`, shear-wall `L/t`, I-shape `b/h`, polygon `Ø/N`, L/T/U `w/d`).
- **Live params στο drag:** `applyColumnGripDrag(gripKind, {originalParams, delta, currentPos, pivot?})`
  → `bim/columns/column-grips.ts`. Στο `drawMemberGripHud` το live `transformed` είναι ήδη `ColumnEntity`
  με ανα-υπολογισμένα `params` + `geometry` (μέσω `applyEntityPreview` → `computeColumnGeometry`).
- **Grip θέσεις/είδη:** `ColumnGripKind` → `hooks/grip-kinds.ts`· grip anchor geometry στο
  `bim/columns/column-grips.ts` (χρήσιμο για να τοποθετήσεις aligned δ. πάνω στη σωστή ακμή/υπο-διάσταση).
- **ColumnParams sub-shapes** (`bim/types/column-types.ts`): `lshape{armLength,armWidth,flipY}`,
  `tshape{flangeLength,webThickness,flangeThickness,flipY}`, `ishape{flangeThickness,webThickness,flipY}`,
  `ushape{legThickness,baseThickness,flipY,polygon?}`, `polygon{sides}`, `composite{polygon}`. + `width`,
  `depth`, `height`, `rotation` (μοίρες CCW). `geometry.footprint.vertices` = world-baked (rotation ήδη μέσα).

---

## 🧭 ΣΧΕΔΙΑΣΤΙΚΑ ΘΕΜΑΤΑ (για την έρευνα/Plan)

Οι σύνθετοι τύποι έχουν **υπο-διαστάσεις** (arm length/width, flange length, web/flange thickness, leg/base
thickness, polygon sides). Ερωτήματα προς έρευνα (Revit/ETABS/Cinema4D/Figma πρακτική):
1. Δείχνουμε **όλες** τις χαρακτηριστικές διαστάσεις ταυτόχρονα ως aligned δ. πάνω στις αντίστοιχες ακμές
   του footprint, ή **μόνο τη διάσταση που σέρνεται** (highlighted) + overall bbox;
2. Πώς τοποθετούνται οι aligned δ. σε μη-κυρτό polygon (Γ/Τ/Π): ανά ακμή του footprint (reuse
   `geometry.footprint.vertices` + `paintAlignedOverlayDimension` ανά segment);
3. Polygon N-gon: Ø (circumscribed) + N, ή πλευρά; (Το `formatColumnDimLabels` δίνει `Ø/N`.)
4. Shear-wall: είναι ουσιαστικά επίμηκες ορθογώνιο → πιθανό reuse του rect path (`isRectFootprint` μάλλον
   ήδη true → **έλεγξέ το**· ίσως ΗΔΗ δουλεύει και θέλει μόνο pill-suppression).
5. Γωνία: δείχνεται (∠rotation) όπου έχει νόημα· polygon/σύνθετα → ναι· 
6. **Preview ≡ commit**: οι live τιμές ΠΑΝΤΑ από `applyColumnGripDrag`→`transformed.params`/`geometry`
   (ίδιος μετασχηματισμός με το ghost), ποτέ ξεχωριστός υπολογισμός.

**Κατεύθυνση (πιθανή, επιβεβαίωσέ την στο Plan):** γενίκευσε το `paintColumnHud` ώστε για κάθε τύπο να
ζωγραφίζει aligned δ. πάνω στις **ακμές του πραγματικού footprint** (reuse `geometry.footprint.vertices`),
με το label της κάθε χαρακτηριστικής διάστασης από το SSoT, + ∠γωνία + ύψος — αντί για pills. Επιβεβαίωσε
με τον Giorgio αν θέλει «όλες οι διαστάσεις» ή «μόνο η ενεργή» πριν υλοποιήσεις (lead με concrete παράδειγμα).

---

## ✔️ VERIFICATION
- jest στοχευμένα: `npx jest src/subapps/dxf-viewer/bim/framing/__tests__/rect-frame.test.ts src/subapps/dxf-viewer/bim/framing/__tests__/member-ghost-snap.test.ts src/subapps/dxf-viewer/canvas-v2/preview-canvas/__tests__/wall-hud-paint-projector.test.ts`
- Δεν υπάρχει test harness για canvas/i18n hooks → κράτα την pure λογική (geometry/classifier) σε
  testable helpers (όπως το `isRectFootprint`) και γράψε pure tests εκεί.
- 🔴 **Browser-verify** ανά τύπο: σχεδίασε κάθε τύπο κολόνας → σύρε λαβές → σταθερές ενδείξεις, σωστές τιμές.
- ADR-508: ενημέρωσε το §column-hud changelog με τους νέους τύπους (ίδιο commit).
- ❌ ΟΧΙ commit από agent — ο Giorgio committάρει. ⚠️ shared working tree — stage ΜΟΝΟ τα HUD αρχεία.
