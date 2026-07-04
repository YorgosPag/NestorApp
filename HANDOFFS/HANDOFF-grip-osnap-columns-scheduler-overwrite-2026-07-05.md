# HANDOFF — Grip Alt-move OSNAP: κολώνες δεν δείχνουν/δεν έλκουν — 2026-07-05

## 🎯 ΚΑΤΑΣΤΑΣΗ: root cause ΒΡΕΘΗΚΕ & διορθώθηκε (εκκρεμεί browser verify από Giorgio)

Όταν μετακινείς **κολώνα** από λαβή με **Alt+drag** πάνω σε άλλες οντότητες:
τα σημάδια έλξης (□/△/○) ΔΕΝ φαίνονταν και ΔΕΝ έλκυαν. **Τοίχοι = δουλεύουν κανονικά.**

## 🔬 ΤΙ ΑΠΟΔΕΙΧΘΗΚΕ ΜΕ RUNTIME DIAGNOSTICS (όχι εικασία)
Throttled logs σε handler + marker-leaf έδειξαν κατά το column Alt-move:
- Detection ✅ `columnCornerFound:true`, `snapEnabled:true`, `isColumnEntity:true`, `foundInScene:true`.
- Έλξη εφαρμόζεται στον handler ✅ `attractionDeltaWorld` 6–18, `immediateSnapFound:true`.
- **ΑΛΛΑ** ο marker leaf (`SnapIndicatorSubscriber`) έβλεπε `mode:'grid'` (silent→`markerVisible:false`)
  + σποραδικά `perpendicular`/`extension` — **ΠΟΤΕ** το `bim_corner` του column-corner projection.

## 🧠 ΡΙΖΑ (2 επίπεδα)
Ο handler γράφει σωστά το column-corner **τελευταίος**, αλλά ένας **άλλος writer γράφει generic
raw-cursor snap ΜΕΤΑ** και το σκεπάζει:
1. **Decoupled `snap-scheduler` (`publishSnapMarker`)** τρέχει `findSnapPoint(cursor)` σε RAF και
   ξαναγράφει `fullSnapResult` με generic (συχνά **silent grid**). Ο guard `!isGripDragging` υπάρχει
   ΜΟΝΟ στο **arming** (`mouse-handler-move`), όχι στο ίδιο το frame· το React `isGripDragging`
   **τρεμοπαίζει**, οπότε stale-armed frames γλιστρούν και ο scheduler τρέχει μέσα στο grip drag.
2. **Γιατί κολώνες ΝΑΙ, τοίχοι ΟΧΙ:** στον τοίχο πιάνεις **endpoint** → ο κέρσορας ΕΙΝΑΙ το σημείο
   έλξης → generic(cursor) **συμφωνεί** με το wall-face → overwrite αβλαβές. Στην κολώνα πιάνεις
   γωνία-βάση αλλά ευθυγραμμίζεις **άλλη** γωνία (projection) → generic(cursor) βρίσκει grid/perp
   (λάθος/silent) → **σκεπάζει** το σωστό column-corner → κανένα marker/έλξη.
Επιπλέον, ο ίδιος ο handler δεχόταν και το silent grid στο generic block (δευτερεύον).

## ✅ FIXES ΠΟΥ ΕΓΙΝΑΝ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (SSoT, χειρουργικά)
1. **`snap-scheduler.ts` `onSnapFrame`** — φρουρά: `if (getActiveDragGrip()) { dirty=false; return; }`.
   Ο scheduler ΔΕΝ τρέχει όσο υπάρχει ενεργό grip drag (imperative store = σταθερό όλο το drag, χωρίς
   το flicker του React prop). Bail ΧΩΡΙΣ clear → το αποτέλεσμα του grip handler μένει. **← Ο decisive fix.**
2. **`mouse-handler-move.ts` grip generic snap** — δέχεται **μόνο ΟΡΑΤΕΣ** έλξεις
   (`isVisibleSnapMode(gripSnapResult.activeMode)`), ώστε το silent grid να μη «κλειδώνει» osnapFound /
   να μη θέτει moveWorldPos σε αόρατο grid. (Complementary defense.)
3. **(προηγούμενο βήμα ίδιας συνεδρίας, ήδη committed στο `37fff3b5` του άλλου agent)** — SSoT resolver
   `isActiveGripAltMove()` στο `GripDragStore.ts` (baked-∥-live, blur-proof) + 7 consumers ενοποιήθηκαν.
   Νέο test `GripDragStore.isActiveGripAltMove.test.ts`.

## 📌 WORKING TREE (multi-agent — ΔΙΑΒΑΣΕ)
- **Uncommitted δικά μου (τώρα):** `systems/cursor/snap-scheduler.ts`, `systems/cursor/mouse-handler-move.ts`,
  `docs/.../ADR-560-entity-body-drag-move-copy.md`.
- **Άλλα M στο status = ΑΛΛΟΥ agent** (`ADR-537*`, `bim-3d/scene/ThreeJsSceneManager.ts`,
  `bim-3d/viewport/viewport-camera.ts`) — **ΜΗΝ τα αγγίξεις**.
- Ο άλλος agent έχει κάνει ήδη 2 commits (`37fff3b5`, κ.ά.) που παρέσυραν προηγούμενα δικά μου αρχεία
  (GripDragStore helper, mouse-handler-up, grip-drag-alignment-tracking, grip-commit-adapters,
  grip-mouseup-handler, grip-dxf-drag-preview-resolver, το test). Αυτά είναι ΗΔΗ στο repo.
- **ΠΟΤΕ** `git add -A`/bulk reset/checkout. Μόνο `git add <specific>`. **Commit/push τα κάνει ο Giorgio.**

## ✅ VERIFICATION (Giorgio, browser — hard refresh πρώτα)
- Κολώνα → Alt+drag από λαβή → πάνω σε άκρα/μέσα/γωνίες άλλων: **τώρα πρέπει να δείχνει marker □/△/○ στη
  γωνία ΚΑΙ να κουμπώνει εκεί** (όχι πια αόρατο grid). Σύγκρινε με τοίχο (που ήδη δούλευε).
- jest: `GripDragStore.isActiveGripAltMove`, `grip-commit-alt-bypass`, `grip-projections-alt-move`,
  `dim-alignment-tracking` → GREEN (τελευταίο run 10/10 + 16/16). **ΟΧΙ tsc** (N.17).

## 📋 ΑΝ ΔΕΝ ΛΥΘΗΚΕ ΑΚΟΜΑ (επόμενα βήματα)
- Ξαναβάλε το throttled log στον marker leaf (`canvas-layer-stack-leaves.tsx SnapIndicatorSubscriber`):
  αν πλέον δείχνει `mode:'bim_corner'/'endpoint'` `markerVisible:true` → detection→render ΟΚ, ψάξε
  z-index/θέση glyph. Αν ΑΚΟΜΑ `grid/perp/extension` → υπάρχει ΚΙ ΑΛΛΟΣ writer (tag κάθε `setFullSnapResult`
  με source-string για να βρεις ποιος).
- Έλεγξε μήπως ο `snap-scheduler` δεν ήταν ο μόνος: grep `setFullSnapResult` writers (μόνο
  `mouse-handler-move`, `snap-scheduler`, `mouse-handler-up`).

## 🎯 ΕΠΟΜΕΝΟ ENTERPRISE SSoT (πρόταση, μελλοντικά — ΟΧΙ τώρα)
Το grip path να επαναχρησιμοποιήσει τον ΙΔΙΟ resolver προτεραιότητας με το draw path
(`snap-scheduler`→`resolveColumnDrawSnap`: visible corner > visible cursor > silent grid), ώστε να μη
μένουν δύο παράλληλες υλοποιήσεις priority (η βαθύτερη διπλοτυπία που ανέδειξε ο Giorgio).

## 📚 ΚΛΕΙΔΙΑ-ΑΡΧΕΙΑ
- `systems/cursor/snap-scheduler.ts` — `onSnapFrame` guard (ο decisive fix).
- `systems/cursor/mouse-handler-move.ts` — grip OSNAP block (γρ.~189 generic visible-only, ~254 column-corner).
- `systems/cursor/GripDragStore.ts` — `getActiveDragGrip()` + `isActiveGripAltMove()`.
- `components/dxf-layout/canvas-layer-stack-leaves.tsx` — `SnapIndicatorSubscriber` (marker leaf).
- `bim/columns/column-corner-snap.ts` + `systems/cursor/corner-projection-snap.ts` — column projection.
- `docs/centralized-systems/reference/adrs/ADR-560-*.md` — changelog (η) + (θ) + guard.
