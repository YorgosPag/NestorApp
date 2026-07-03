# HANDOFF — Λαβές Μετακίνησης Σειρών Διαστάσεων (Dimension Row Move Handles)

**Ημερομηνία:** 2026-07-03
**Μοντέλο για συνέχεια:** Opus 4.8 (feature, performance-critical, 2 domains)
**ADR:** ADR-362 (enterprise dimension system)

---

## 🎯 ΤΙ ΖΗΤΑΕΙ Ο GIORGIO (η ιδέα)

Ένα **mode που ανοίγει με πλήκτρο (toggle)**. Όταν είναι ON:
- Εμφανίζεται **ΜΙΑ λαβή ανά σειρά διαστάσεων** σε όλη τη σκηνή.
- Παράδειγμα: 4 πλευρές × 4 σειρές/πλευρά = **16 λαβές** στην οθόνη.
- Σέρνεις μια λαβή → μετακινείται **ΟΛΗ η σειρά μόνη της**, κάθετα στον άξονά της
  (οριζόντια σειρά → κάθετη μετακίνηση· κάθετη σειρά → οριζόντια). Οι άλλες σειρές μένουν.

Σκοπός: ξεμπέρδεμα «συνονθυλεύματος» στοιβαγμένων σειρών με επικαλυπτόμενα κείμενα
(screenshot: `Αδείας Κάτοψη ισογείου-EXPLODE_ΧΩΡΙΣ_ΧΑΤΣ.dxf`, γεωαναφερμένο, ~320 διαστάσεις,
πραγματικές οντότητες Διάστασης — ΟΧΙ exploded).

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ ΣΕ ΑΥΤΟ ΤΟ SESSION (ADR-362 Round 34 — committed; ΟΧΙ ακόμα σε git, ΠΕΡΙΜΕΝΕΙ εντολή Giorgio)

Θεμέλια που ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ από το νέο feature:
1. **`systems/dimensions/dim-line-info.ts`** (NEW SSoT) — `extractDimLineInfo(dim)` → `{originA, originB, dimLineRef, dimDir, normal}` + `dimLineOffset(info)`. Το dim-line frame για linear/aligned.
2. **`systems/dimensions/dim-row-detect.ts`** (NEW SSoT) — `collectDimensionRow(target, allDims, tol?)` + `isSameDimRow(targetInfo, candidate, tol?)`. Σειρά = παράλληλος άξονας + collinear dim line. Default tol: `parallelDot=0.99985` (cos1°), `collinearMm=1`. **5/5 tests πράσινα.**
3. **DIMSPACE fix** (`dim-space-engine.ts`) — incremental slots (nearest→slot1, next→slot2…) αντί για το παλιό bug (όλα στο ίδιο offset). Χρησιμοποιεί `shiftDimLineRef(target, normal, delta)`.
4. **«Επιλογή Σειράς»** (ήδη λειτουργικό, ενδιάμεση λύση): κουμπί καρτέλα Διάσταση→Τροποποίηση → event `dim:select-row-requested` → `useDimensionModify` host → `collectDimensionRow` → `SelectedEntitiesStore.selectEntities(row)`. Μετά ο χρήστης body-drag ή Μετακίνηση.

**Files που άλλαξαν (Round 34):** NEW dim-line-info, dim-row-detect + 2 tests· MOD dim-space-engine, useDimensionModify, dxf-special-actions, contextual-dimension-tab, dim-command-keys, drawing-event-map, i18n el+en, +2 test updates. **43/43 tests πράσινα.**

---

## 📐 ΣΧΕΔΙΟ ΤΟΥ ΝΕΟΥ FEATURE (row move handles)

### Κομμάτια (~7-8 αρχεία, Plan/Orchestrator level)
1. **NEW `systems/dimensions/dim-row-partition.ts`** — `partitionDimensionRows(allDims): DimRow[]` όπου `DimRow = { dims, axis, normal, handleWorldPos }`. Partition ΟΛΩΝ των linear/aligned dims σε σειρές (union-find / greedy πάνω στο `isSameDimRow`). handlePos = midpoint της συνολικής έκτασης της σειράς πάνω στη dim line (ή έξω-άκρο). + test.
2. **NEW store `DimRowHandleModeStore.ts`** — vanilla singleton (ADR-040 pattern, μηδέν React state): `isActive`, toggle, + active-drag snapshot (armed row + anchor). Mirror `GripDragStore`/`EntityBodyDragStore`.
3. **Rendering** — overlay leaf που ζωγραφίζει τις λαβές όταν mode ON (micro-leaf, ADR-040· ΜΙΑ λαβή/σειρά· reuse grip visual style/HoverStore). Πιθανώς στο `canvas-layer-stack-leaves.tsx` ή νέο leaf.
4. **Drag interaction** — hit-test λαβής στο mousedown (πριν το grip/body-drag gate) → arm row-drag → mousemove: preview ghost (project cursor-delta στο `normal` της σειράς → `shiftDimLineRef` σε όλες τις dims) → mouseup: commit **CompositeCommand** (per-dim, reuse `applyDimensionGripDrag('dim-line-ref', d, projectedDelta)` + `UpdateDimGripCommand`).
5. **Toggle** — keyboard shortcut (διάλεξε πλήκτρο· δες `config/keyboard-shortcuts.ts` + `useKeyboardShortcuts.ts`) + προαιρετικά ribbon button (καρτέλα Διάσταση ή View).
6. **ADR-362 update** (Round 35) + tests.

### Κρίσιμες SSoT επαναχρήσεις (ΜΗΝ φτιάξεις νέα)
- Row grouping → `dim-row-detect.ts` (`isSameDimRow`).
- Re-offset math → `shiftDimLineRef` (dim-space-engine) ή `applyDimensionGripDrag('dim-line-ref')` (useDimensionGrips.ts). Το `'dim-line-ref'` grip kind κάνει `patchDefPoint(dim, 2, delta)` — ΑΚΡΙΒΩΣ το offset της dim line.
- Undoable commit → `UpdateDimGripCommand` (drag-coalescing) + `CompositeCommand` (atomic multi-dim undo).
- Handle hit-test / drag pattern → mirror `GripDragStore` + `commitDimensionGripDrag` (grip-linear-commits.ts).
- Bounds/culling των dims → `getDimensionWorldBounds` (dimension-cull-bounds.ts, Round 33).

### ⚠️ ΠΡΟΣΟΧΗ (μην κάνεις)
- **ADR-040**: το overlay leaf ΔΕΝ πρέπει να προκαλεί 60fps re-render· orchestrators (CanvasSection/CanvasLayerStack) ΔΕΝ subscribe· διάβασε ADR-040 ΠΡΙΝ αγγίξεις rendering leaves.
- **ΜΗΝ** μετακινείς τα ext-origins (defPoints[0],[1]) — αλλάζει τη μετρούμενη τιμή. ΜΟΝΟ το defPoints[2] (dimLineRef) offset κάθετα.
- **ΜΗΝ** τρέξεις tsc (N.17). jest OK.
- **ΜΗΝ** commit/push χωρίς εντολή Giorgio (N.(-1)).
- Collinear tolerance (1mm): αν δύο ΔΙΑΦΟΡΕΤΙΚΕΣ σειρές είναι σχεδόν collinear θα ενωθούν — αν εμφανιστεί, tune το `collinearMm`.

### Ερωτήσεις για τον Giorgio (πριν υλοποίηση)
- Ποιο πλήκτρο για το toggle;
- Θέση λαβής: midpoint της σειράς πάνω στη γραμμή, ή έξω-άκρο (πιο εύκολο grab);
- Ελεύθερο offset ή step-snap (π.χ. DIMDLI βήμα);

---

## ΚΑΤΑΣΤΑΣΗ GIT
Όλες οι αλλαγές Round 34 στο working tree, ΟΧΙ committed. Ο Giorgio αποφασίζει commit.
