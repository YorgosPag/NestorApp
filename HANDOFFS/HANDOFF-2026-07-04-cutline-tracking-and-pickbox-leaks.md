# HANDOFF — Γραμμή τομής (tracking/Polar/arc/live) + διόρθωση pickbox leaks (fillet/chamfer/offset)

**Ημ/νία:** 2026-07-04
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer/`)
**ADRs:** ADR-563 (cut-line dim tool) · ADR-510 (fillet/chamfer/offset modify tools) · ADR-040 (preview canvas) · ADR-055 (tool-state SSoT) · ADR-357/562 Φ9 (alignment tracking)
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** — `git add <specific>` ΜΟΝΟ, verify `git diff --cached`, ΠΟΤΕ `git restore .`/`reset --hard`/checkout άλλων αρχείων. **Commit τον κάνει ΜΟΝΟ ο Giorgio.**
**Κατάσταση εργασίας:** ✅ ΟΛΑ ΛΕΙΤΟΥΡΓΙΚΑ & browser-verified από τον Giorgio. Uncommitted.

---

## ✅ Τι ολοκληρώθηκε (όλα verified)

### A) Εργαλείο «Γραμμή τομής» (ADR-563 Φ4-Α) — 3 αιτήματα Giorgio
1. **Δυναμική γραμμή (rubber-band)** μετά το 1ο κλικ — υπήρχε ήδη, αλλά ΔΕΝ φαινόταν (root cause πιο κάτω).
2. **Ίχνη ευθυγράμμισης** (πράσινες dashed + intersections + tooltip) — ίδια με σχεδίαση τοίχου.
3. **Polar** (πορτοκαλί γραμμή/γωνία) όταν F10 ON.
4. **+ Έγχρωμο τόξο ΦΟΡΑΣ** (🟢/🔴 `drawDirectionArc`) στη χάραξη — προστέθηκε κατ' εντολή.
5. **Commit parity (WYSIWYG)**: το `cutEnd` αποθηκεύεται snapped → αποθηκευμένη γραμμή == preview.

**Root causes που λύθηκαν στην πορεία:**
- **Preview δεν φαινόταν ΚΑΘΟΛΟΥ** → το `useDrawingHandlers` γίνεται **mount ΔΥΟ φορές** (`useCanvasEffects`/CanvasSection **με** `previewCanvasRef` · `useDxfViewerState` **χωρίς**, γρ. 117-130). Και τα δύο mount-άρουν το `useAutoDimCutlineTool`, που δήλωνε RAF callback με **ίδιο id** `'auto-dim-cutline-preview'` → ο `UnifiedFrameScheduler.register` αντικαθιστά στο διπλότυπο id → κέρδιζε το ref-less → `previewRef.current === undefined` → `hasCanvas:false`. **Fix:** `isActive` του cut-line gate-άρεται σε `&& !!previewCanvasRef`.
- **Preview ενημερωνόταν μόνο όταν σταματούσε ο κέρσορας** → το cut-line παρακάμπτει το `processDrawingHover` (το σύγχρονο per-move repaint κάθε άλλου εργαλείου). **Fix:** `subscribeRealtimeWorldCursor` (ADR-040 Φ12) για live repaint· RAF μένει ως persist.

### B) Pickbox leak σε 3 modify tools (ADR-510)
Το πορτοκαλί `#FFD24A` 12×12 pickbox (+ «R …»/«d1×d2»/απόσταση label) εμφανιζόταν σε **ΚΑΘΕ εργαλείο**, από την εκκίνηση. **Root:** `FilletToolStore`/`ChamferToolStore`/`OffsetToolStore` έχουν `INITIAL.phase` = ready-state (`'picking-first'`/`'picking-source'`), **χωρίς `'idle'`**, και το draw ζωγραφίζει το pickbox **χωρίς phase-guard** → `isActive` (gate μόνο σε phase) πάντα true. **Fix:** `isActive` gate-άρεται πλέον ΚΑΙ σε `useActiveTool() === 'fillet'/'chamfer'/'offset'` (ADR-055 SSoT· precedent `FinishPaint2DPanel`). Το `useCanvasGhostPreview` καθαρίζει canvas στο gate-exit. **Trim/Extend ΔΕΝ επηρεάζονται** (έχουν πραγματικό `'idle'`: `isActive: phase !== 'idle'`).

### Γ) Aperture (λευκό κουτί σταυρονήματος) — ΟΧΙ bug
Το λευκό κουτί = κανονικό crosshair aperture (`useCrosshairCursor`, `showAperture`, hardware cursor, «αίτημα Giorgio»). Toggle: **Ρυθμίσεις DXF → Γενικές → Χερούλια → «Εμφάνιση Aperture»**. Ο Giorgio το ξετσέκαρε· θέλει να το ΞΑΝΑΒΑΛΕΙ (δικό του κλικ, χωρίς κώδικα).

---

## 📄 Αρχεία που άλλαξαν (uncommitted — commit από Giorgio)
**Cutline:**
- `hooks/dimensions/dim-alignment-tracking.ts` — νέα SSoT: `resolveDimActionEndpoint` + `paintDimActionTracking` (σύνθεση `resolveOrthoPolarStep` ⊕ `resolveActionAlignmentTracking`· paint via handle methods).
- `hooks/dimensions/useAutoDimCutlineTool.ts` — wiring tracking+Polar+arc στο `paintCutlinePreview`· live `subscribeRealtimeWorldCursor`· `isActive` gate σε `!!previewCanvasRef`. **(Διαγνωστικά logs αφαιρέθηκαν — καθαρό.)**
- `systems/dimensions/auto/run-cutline-dimension.ts` — commit parity (snapped `cutEnd`).
- `docs/centralized-systems/reference/adrs/ADR-563-auto-dimension-engine.md` — changelog.

**Pickbox leaks:**
- `hooks/tools/useFilletPreview.ts` — gate `activeTool==='fillet'`. ⚠️ Το αρχείο το άλλαξε ΚΑΙ ο άλλος agent (arc/curve fillet)· το gate μου (γρ. ~119/178) **επιβίωσε**.
- `hooks/tools/useChamferPreview.ts` — gate `activeTool==='chamfer'`.
- `hooks/tools/useOffsetPreview.ts` — gate `activeTool==='offset'`.
- `docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md` — 2 changelog entries.

---

## ⚠️ Pending / γνωστά (ΜΗΝ τα «διορθώσεις» χωρίς εντολή)
- **Διπλό-mount `useDrawingHandlers`** (`useDxfViewerState` + `useCanvasEffects`) = η ρίζα του preview-canvas-null. Το παρακάμψαμε (gate σε `previewCanvasRef`). Πιθανώς αφορά ΚΑΙ `useDimToolRouting` (`'dim-preview-persist'`) + `useCenterMarkCreate` (same-id RAF). Βαθύτερη εκκαθάριση (γιατί δύο mounts) = **χωριστό, μεγαλύτερο task** — ρώτα τον Giorgio πριν.
- **Επόμενα modify tools**: αν προστεθούν νέα ghost previews που ζωγραφίζουν pickbox unconditionally + store χωρίς `'idle'` → ίδιο leak. Pattern fix = gate σε `useActiveTool()`.

## 🚫 Μην κάνεις
- ΜΗΝ κάνεις commit/push (μόνο Giorgio).
- ΜΗΝ αγγίξεις το architecture-critical `CanvasLayerStack`/CanvasSection (CHECK 6B/6C/6D) χωρίς ADR-040 staged.
- ΜΗΝ κάνεις bulk git reset/restore (κοινό tree).
- ΟΧΙ tsc (N.17) — μόνο jest όπου έχει νόημα.

## ℹ️ Info (όχι tasks)
- «Επί άξονα τοίχου» (κίτρινο) = κανονική ένδειξη OSNAP wall-axis (`SnapIndicatorGlyph`, `snap.bim.wallAxis`). ΟΧΙ bug.
