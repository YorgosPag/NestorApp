# HANDOFF — Χρώμα διαστάσεων τοίχου-φαντάσματος: ΛΕΥΚΟ vs ΣΙΕΛ (wall ghost dimension colours)

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Author** | Opus 4.8 (session: ADR-558 grid z-order + ADR-549 perf-diag fix) |
| **Status** | 🟡 ΝΕΟ ΘΕΜΑ — design question, ΚΑΜΙΑ υλοποίηση ακόμη |
| **Domain** | DXF Viewer 2D / wall placement / preview overlay dimensions |
| **Working tree** | ⚠️ SHARED με άλλον agent — touch ΜΟΝΟ ό,τι χρειάζεται, μηδέν `git add -A` |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit/push (N.-1) |
| **Screenshot** | `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-30 150750.jpg` |

---

## 🎯 ΤΟ ΕΡΩΤΗΜΑ (Giorgio)

Κατά τη **σχεδίαση τοίχου** (μετά το 1ο κλικ, ζωντανό φάντασμα), εμφανίζονται διαστάσεις/ενδείξεις:

- Όταν ο τοίχος είναι **ΜΑΚΡΙΑ** από άλλες οντότητες → οι ενδείξεις είναι **ΛΕΥΚΕΣ**
  (στο screenshot: μήκος `2.695 m`, ετικέτα `πάχος 0,210 m · ύψος 3,000 m`, γωνία `∠ 353,6°`).
- Όταν ο τοίχος είναι **ΚΟΝΤΑ** σε άλλη οντότητα → εμφανίζονται **ΣΙΕΛ** ενδείξεις
  (στο screenshot: `0,181 m` / `0,354 m` / `0,717 m` — αποστάσεις/offsets προς το γειτονικό γκρι ορθογώνιο).

**Ερώτημα Giorgio: είναι σωστός αυτός ο διαχωρισμός χρώματος; Γιατί να μην είναι ΟΛΕΣ σιελ;**

➡️ Είναι **design question** — πρώτα ερευνούμε πώς το κάνουν οι μεγάλοι παίκτες, μετά αποφασίζουμε/υλοποιούμε.

---

## 🔍 SSoT AUDIT (ΗΔΗ ΕΓΙΝΕ — preliminary grep, μην το ξανακάνεις από μηδέν)

Υπάρχουν **ΔΥΟ ξεχωριστοί μηχανισμοί** preview-διαστάσεων, με **2 διαφορετικά χρώματα** από ΕΝΑ SSoT:

### SSoT χρωμάτων: `canvas-v2/preview-canvas/overlay-line-style.ts`
```ts
export const OVERLAY_LINE_COLORS = {
  alignment:   <ΛΕΥΚΟ>,        // (γρ. ~30) — wall HUD «δικές του» διαστάσεις
  listeningDim: '#29B6F6',     // (γρ. 31) ΣΙΕΛ — wall-ghost «listening» (σχεσιακές) διαστάσεις
  ...
}
```
*(verify το ακριβές hex του `alignment` — είναι το λευκό/ανοιχτό του HUD).*

### Μηχανισμός 1 — Wall HUD (ΛΕΥΚΟ): `canvas-v2/preview-canvas/wall-hud-paint.ts`
- `const HUD_COLOR = OVERLAY_LINE_COLORS.alignment;` (γρ. 50)
- Ζωγραφίζει τις **δικές του** ιδιότητες του τοίχου: aligned μήκος, spec (`πάχος · ύψος`), γωνία `∠`.
- ADR: **ADR-508 §wall-hud** (Live wall identity HUD κατά τη σχεδίαση).
- Καλείται μέσω: `bim-3d/viewport/overlay-dispatch/use-wall-hud-pass.ts` (dispatch) →
  ΑΛΛΑ προσοχή: το screenshot είναι **2D** (DXF viewer 1:15)· το 2D HUD paint ζει στο `canvas-v2/preview-canvas/`.

### Μηχανισμός 2 — Listening dims (ΣΙΕΛ): `canvas-v2/preview-canvas/ghost-face-dim-paint.ts`
- `const textColor = OVERLAY_LINE_COLORS.listeningDim; // CYAN — distinct mechanism colour` (γρ. 74)
- Ζωγραφίζει **σχεσιακές** αποστάσεις προς τις παρειές γειτονικών οντοτήτων («listening»/ghost-face dims).
- Refs μηχανής: `bim/framing/ghost-face-dim-references.ts` (ποιες παρειές «ακούει»),
  `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` (paint).

### Κοινός renderer (και για τα δύο):
- `canvas-v2/preview-canvas/preview-dimension-renderer.ts` — text/arrows pipeline· δέχεται `color` (injected).
- `paintAlignedOverlayDimension` (overlay SSoT, 0.5px dashed) — κοινό seam· το χρώμα περνά ως όρισμα.

**Συμπέρασμα audit:** η διπλή χρωματική σήμανση είναι **εσκεμμένη** («distinct mechanism colour»):
λευκό = «η γεωμετρία που φτιάχνω» · σιελ = «σχέση/αναφορά προς υπάρχουσα γεωμετρία». ΕΝΑ SSoT χρωμάτων
(`OVERLAY_LINE_COLORS`), μηδέν διπλότυπο hex. Άρα ΟΧΙ τυχαίο bug — είναι σχεδιαστική επιλογή υπό αμφισβήτηση.

---

## 🧭 ΚΑΤΕΥΘΥΝΣΗ ΕΡΕΥΝΑΣ (big-player — ΠΡΙΝ αποφασίσεις)

Πώς χρωματίζουν οι μεγάλοι τις «δικές μου» vs «σχεσιακές/inference» διαστάσεις στο live drawing;
- **AutoCAD**: Dynamic Input (μήκος/γωνία που πληκτρολογείς) vs Object-Snap-Tracking / polar alignment
  (διαφορετικό χρώμα/στυλ ίχνους). Συνήθως **διαφορετικά** — δικές μου ≠ inference.
- **Revit**: temporary dimensions (μπλε, editable, «δικές μου») vs listening/alignment dims προς γειτονικά.
- **Figma**: κόκκινες measurement dims προς γειτονικά στοιχεία (μετρώ απόσταση) vs μέγεθος του ίδιου του object.
- **Cinema 4D / Maxon**: measurement/snap guides ξεχωριστό χρώμα από τις ιδιότητες του ενεργού object.

➡️ Η πρακτική των μεγάλων είναι ΣΥΝΗΘΩΣ **διπλό χρώμα** (own ≠ relational). Αν επιβεβαιωθεί, η σωστή
απάντηση στον Giorgio είναι «ναι, σωστό — λευκό=δικό σου, σιελ=σχέση», ΙΣΩΣ με μικρό refinement
(π.χ. ενιαία ορολογία/ένταση/legend). **Επιβεβαίωσε με έρευνα ΠΡΙΝ προτείνεις «όλα σιελ».**

---

## ✅ ΑΠΑΙΤΗΣΕΙΣ (εντολή Giorgio)

1. **Big-player level** (Revit / Maxon-Cinema4D / Figma). **FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι
   δεν προτείνουν enterprise pattern → ακολούθα την πρακτική των μεγάλων παικτών.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις κώδικα** — reuse `OVERLAY_LINE_COLORS` + τους 2 paint
   μηχανισμούς· **ΜΗΝ** φτιάξεις 3ο μηχανισμό/3ο χρώμα/inline hex. (Το βασικό audit έγινε ΗΔΗ — πάνω.)
3. **Lead with concrete example** στο design choice (ASCII/νούμερα/χρώματα) ΠΡΙΝ υλοποιήσεις — ο Giorgio
   σκέφτεται σε γεωμετρία, θέλει συγκεκριμένο παράδειγμα όχι αφηρημένη ορολογία.
4. **Απαντάς ΠΑΝΤΑ στα Ελληνικά.**
5. **N.17:** ❌ ΠΟΤΕ `tsc`/typecheck. ✅ jest στοχευμένα:
   `npx jest src/subapps/dxf-viewer/canvas-v2/preview-canvas/`
6. **N.-1:** ❌ ΠΟΤΕ commit/push — ο **Giorgio** τα κάνει. ❌ ΠΟΤΕ `--no-verify`.
7. **Shared working tree** με άλλον agent — touch ΜΟΝΟ τα απαραίτητα, μηδέν `git add -A`.
8. **ADR-driven (N.0.1):** code = source of truth· διάβασε τρέχοντα κώδικα, ενημέρωσε **ADR-508**
   (§wall-hud) + όποιο ADR αγγίξεις, στο τέλος.

---

## 📂 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (ξεκίνα από εδώ)
- `canvas-v2/preview-canvas/overlay-line-style.ts` — **SSoT χρωμάτων** (`OVERLAY_LINE_COLORS`).
- `canvas-v2/preview-canvas/wall-hud-paint.ts` — ΛΕΥΚΟ wall HUD (ADR-508 §wall-hud).
- `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` — ΣΙΕΛ listening dims.
- `bim/framing/ghost-face-dim-references.ts` — ποιες παρειές «ακούει» ο τοίχος.
- `canvas-v2/preview-canvas/preview-dimension-renderer.ts` — κοινός renderer (color injected).
- ADR: `docs/centralized-systems/reference/adrs/ADR-508-*.md` (§wall-hud).

## ✅ DEFINITION OF DONE
1. Τεκμηριωμένη απόφαση (big-player έρευνα): κρατάμε διπλό χρώμα (own=λευκό / relational=σιελ) ή ενοποίηση;
   — με concrete παράδειγμα στον Giorgio ΠΡΙΝ τον κώδικα.
2. Αν χρειαστεί αλλαγή → μέσω του **υπάρχοντος** `OVERLAY_LINE_COLORS` SSoT, μηδέν νέο hex/μηχανισμός.
3. jest GREEN· ADR-508 ενημερωμένο + changelog.
4. ❌ commit/push από Giorgio.
