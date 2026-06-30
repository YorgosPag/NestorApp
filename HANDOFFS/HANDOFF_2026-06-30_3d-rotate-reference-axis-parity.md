# HANDOFF — Φάση 2: 3D parity για τη reference ευθεία περιστροφής (ADR-363 Slice G.8)

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Status** | 🟡 ΝΕΟ ΘΕΜΑ — η 2D Φάση ✅ ΟΛΟΚΛΗΡΩΘΗΚΕ & browser-verified· το 3D ΕΚΚΡΕΜΕΙ |
| **Domain** | DXF Viewer **3D** (bim-3d) / rotate gizmo / reference axis |
| **Working tree** | ⚠️ SHARED + ΠΟΛΛΗ uncommitted δουλειά (κάτω) — touch ΜΟΝΟ ό,τι χρειάζεται, μηδέν `git add -A` |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit/push (N.-1). ❌ ΠΟΤΕ `--no-verify`. |
| **tsc** | ❌ ΠΟΤΕ (N.17) — μόνο jest στοχευμένα |
| **Μοντέλο** | Opus (cross-cutting 3D pipeline) |
| **Γλώσσα** | Απαντάς ΠΑΝΤΑ Ελληνικά |

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (Giorgio)

Στη **2D** προβολή, όταν επιλέγω οντότητα → πατάω το σημάδι περιστροφής (κοκκινίζει) → ορίζω κέντρο
περιστροφής (pivot σε οποιοδήποτε grip/σημείο), εμφανίζεται μια **νοητή reference ευθεία** που:
- ξεκινά από το pivot, **παράλληλη στον ΜΕΓΑΛΟ άξονα** της οντότητας, με φορά **προς το σώμα**·
- η περιστρεφόμενη οντότητα (ghost) **ΤΑΥΤΙΖΕΤΑΙ** πάντα με αυτή τη γραμμή (η μακρινή άκρη ακολουθεί τον κέρσορα).

> **Giorgio: «Αυτό θέλω να ισχύει για κάθε δισδιάστατη ΚΑΙ τρισδιάστατη οντότητα — DXF & BIM.»**

Η **2D Φάση ολοκληρώθηκε & δουλεύει σωστά** (επιβεβαίωσε ο Giorgio). **Αυτό το handoff = η 3D parity.**

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (2D — ADR-363 Slices G.4→G.7, UNCOMMITTED) — ΜΗΝ ΤΟ ΧΑΛΑΣΕΙΣ

Η 2D reference-axis λογική ζει σε **ΕΝΑ pure SSoT** που πρέπει να γίνει **reuse** στο 3D:

### 🟢 Η ΠΗΓΗ ΑΛΗΘΕΙΑΣ (reuse ως έχει στο 3D)
- **`bim/grips/rotate-reference-axis.ts`** → `resolveRotateReferenceAnchor(entity, pivot): Point2D | null`
  = `pivot + majorAxisUnit` (προς το σώμα). Pure, entity-agnostic, μηδέν React/DOM/canvas.
  - Major axis: `axisX` για linear / `max(width,depth)` για box — μέσω του υπάρχοντος
    `resolveMoveGlyphFrame` (`bim/grips/move-glyph-frame.ts`).
  - Φορά: `dir = proj > ε ? major : −major` (proj = προβολή `centre−pivot` στον major) →
    αναπαράγει ΑΚΡΙΒΩΣ τον πίνακα αλήθειας του τοίχου (ανατ. grips→δυτικά, δυτ.→ανατολικά,
    κεντρικά-X→δυτικά). **Επιστρέφει `Point2D` (επίπεδο XY)** — για 3D χρειάζεται projection σε
    world-plane (δες «3D AUDIT» κάτω).
  - Tests: `bim/grips/__tests__/rotate-reference-axis.test.ts` (πίνακας τοίχου 9 grips + box + null).

### Πώς καταναλώνεται στο 2D (Slice G.7 — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ, μία πηγή)
- `hooks/grips/useUnifiedGripInteraction.ts` (preview useMemo ~γρ.388) — υπολογίζει
  `freeBaseline = resolveRotateReferenceAnchor(entity, pivot) ?? hotGripRotateBaseRef.current`
  **κάθε frame** (axis-first· first-move μόνο fallback).
- `hooks/grips/grip-hotgrip-actions.ts` `commitFreeRotate` — ίδιο baseline μέσω
  `ctx.resolveRotateBaselineAnchor?.(pivot)` → **commit ≡ preview**.
- Η διακεκομμένη reference ζωγραφίζεται **`pivot → cursor`** (`hooks/tools/useGripGhostPreview.ts:352-354`).
  Άρα «ταυτίζονται» ⇔ **το ghost δείχνει ΠΑΝΤΑ προς τον cursor** ⇔ `refDir` = ο άξονας-από-pivot.
- Το sweep math (`grip-projections.ts buildRotateReferencePreview` ~γρ.256-279) ΔΕΝ άλλαξε —
  διαβάζει το `refDir = freeBaseline − pivot`.

### Uncommitted αρχεία 2D (Slices G.4+G.5+G.6+G.7) — όλα σχετικά με grips γραμμής + rotate reference
`bim/grips/rotate-reference-axis.ts` (NEW) · `bim/grips/move-glyph-frame.ts` · `bim/grips/axis-box-grips.ts` ·
`bim/grips/grip-glyph-registry.ts` · `systems/line/line-grips.ts` · `hooks/grip-kinds.ts` ·
`hooks/grips/wall-hot-grip-fsm.ts` · `hooks/grips/grip-commit-adapters.ts` ·
`hooks/grips/grip-hotgrip-actions.ts` · `hooks/grips/grip-mouse-handlers.types.ts` ·
`hooks/grips/useUnifiedGripInteraction.ts` · `systems/grip/grip-to-vertex-refs.ts` ·
`rendering/ghost/apply-entity-preview.ts` · + 5 test files · `docs/.../ADR-363-bim-drawing-mode.md`.
**Μένουν για commit από τον Giorgio.** Μην τα πειράξεις πέρα από ό,τι χρειάζεται το 3D.

---

## 🔍 3D AUDIT — ΠΟΥ ΝΑ ΨΑΞΕΙΣ ΠΡΩΤΑ (κανόνας: trace ΟΛΟ το pipeline)

Το 3D rotate είναι **ΑΛΛΟ pipeline** (gizmo), ΟΧΙ το 2D hot-grip FSM. Εκκινητικά σημεία:
- `bim-3d/gizmo/` — `gizmo-types.ts` (το 2D `move-glyph-zones.ts` λέει «mirrors the 3D gizmo's
  hoveredAxis model»). Ψάξε για rotate gizmo + reference/baseline.
- Grep: `rotate`, `gizmo`, `reference`, `sweptAngle`, `pivot`, `rotateAxis` μέσα στο `bim-3d/`.
- 3D grips/selection: δες memory `reference_3d_viewport_entity_grips` (ADR-535 — οι 3D λαβές έγιναν
  **Canvas2D overlay** `viewport/grips/BimGripOverlay2D.tsx` με τον ΙΔΙΟ 2D renderer· πιθανώς το rotate
  ακολουθεί παρόμοιο seam).
- Βρες ΠΟΥ ορίζεται το 3D rotation reference/baseline (το αντίστοιχο του 2D `freeBaseline`/`refDir`)
  και ΠΩΣ ζωγραφίζεται η 3D reference γραμμή/ghost.

### Κρίσιμο διαφορά 2D↔3D
- 2D: όλα σε επίπεδο XY (`Point2D`). Το `resolveRotateReferenceAnchor` επιστρέφει `Point2D`.
- 3D: η περιστροφή γίνεται γύρω από άξονα (συνήθως κατακόρυφο Z για κάτοψη/plan rotate) σε world-plane.
  Πιθανώς το reference πρέπει να εκφραστεί στο **ίδιο plane** όπου ζει το pivot. Αν το 3D rotate δουλεύει
  στο XY-plane (plan view), το `resolveRotateReferenceAnchor` μπορεί να γίνει **reuse ΑΥΤΟΥΣΙΟ**
  (οι οντότητες έχουν planar footprint). Αν δουλεύει σε αυθαίρετο plane → χρειάζεται projection helper.
  **ΕΠΙΒΕΒΑΙΩΣΕ το με audit ΠΡΙΝ γράψεις κώδικα.**

---

## ✅ ΑΠΑΙΤΗΣΕΙΣ
1. **Big-player level** (Revit/Maxon-C4D/Figma). FULL ENTERPRISE + FULL SSoT.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ τον κώδικα** — **reuse `resolveRotateReferenceAnchor`**, ΜΗΝ
   φτιάξεις 2ο μηχανισμό major-axis/reference. Το 2D & 3D = ΜΙΑ πηγή αλήθειας για τον άξονα.
3. **Lead with concrete example** (ASCII/νούμερα + 2-3 ναι/όχι) ΠΡΙΝ υλοποιήσεις.
4. **Ίδια ΑΚΡΙΒΩΣ συμπεριφορά με το 2D**: reference παράλληλη στον μεγάλο άξονα προς το σώμα, ghost
   ταυτίζεται με pivot→cursor, καμία αναπήδηση.
5. **N.17:** ❌ ΠΟΤΕ tsc. ✅ jest στοχευμένα. **N.-1:** commit/push μόνο Giorgio. ❌ `--no-verify`.
6. **Shared tree** → touch ΜΟΝΟ τα απαραίτητα, μηδέν `git add -A`.
7. **ADR-driven:** ενημέρωσε **ADR-363 (Slice G.8 — 3D rotate reference axis)**. **Stage ADR-040** αν
   αγγίξεις 3D canvas/render leaf (CHECK 6B/6D).

## ✅ DEFINITION OF DONE
1. Concrete example + 2-3 ναι/όχι στον Giorgio ΠΡΙΝ τον κώδικα.
2. 3D: επίλεξε οντότητα → rotate → ορισμός pivot → η reference ξεκινά κατά τον μεγάλο άξονα προς το
   σώμα· το 3D ghost ταυτίζεται με τη reference, μακρινή άκρη ακολουθεί τον κέρσορα (parity 2D).
3. Reuse `resolveRotateReferenceAnchor` (μηδέν διπλότυπο major-axis logic).
4. jest GREEN· ADR-363 Slice G.8 ενημερωμένο.
5. ❌ commit/push από Giorgio.

## 📌 ΣΗΜΕΙΩΣΗ
- Το 2D δουλεύει — **μην το ξανα-αγγίξεις** εκτός αν το 3D απαιτεί αλλαγή στο κοινό pure helper (τότε
  τρέξε ΞΑΝΑ τα 2D tests `rotate-reference-axis` + `grip-projections-free-rotate` για μηδέν regression).
- Το `resolveRotateReferenceAnchor` είναι `Point2D`-based· αν χρειαστεί 3D γενίκευση, κράτα το 2D
  signature ανέπαφο (π.χ. πρόσθεσε wrapper/overload) ώστε να μη σπάσει το 2D.
