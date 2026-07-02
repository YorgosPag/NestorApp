# HANDOFF — 2D Canvas Layer Size Desync (αόρατη «νεκρή ζώνη» δεξιά που κόβει οντότητες/φάντασμα)

**Ημ/νία:** 2026-07-02
**Κατάσταση:** DIAGNOSED (root cause επιβεβαιωμένο με DOM evidence) — ΕΚΚΡΕΜΕΙ υλοποίηση fix.
**Subapp:** `src/subapps/dxf-viewer` (2D canvas)
**Commit:** Θα τον κάνει **ο Giorgio**, ΟΧΙ ο agent (N.(-1)).
**⚠️ Shared working tree:** το working tree το μοιράζεται **άλλος agent**. ΜΗΝ κάνεις `git add -A`, ΜΗΝ αγγίξεις άσχετα αρχεία, stage ΜΟΝΟ τα canvas-sizing αρχεία που θα πειράξεις.
**⚠️ Uncommitted αλλαγή στο ίδιο session (ΜΗΝ την πειράξεις/κάνεις revert):** `src/subapps/dxf-viewer/hooks/drawing/column-preview-helpers.ts` + το test του + ADR-503 changelog (ghost auto-size, ADR-503). Άσχετο με αυτό το bug.

---

## 1. ΤΟ ΣΥΜΠΤΩΜΑ (Giorgio)

Στον **2D καμβά**, διαλείποντα (intermittent — ο Giorgio ΔΕΝ μπορεί να το αναπαράξει με εντολή, «συμβαίνει συχνά αλλά δεν ξέρω πότε»): υπάρχει μια **αόρατη κατακόρυφη «νεκρή ζώνη» στα δεξιά** του καμβά. Πέρα από ένα αόρατο σύνορο, **κόβονται ΟΛΑ**: DXF οντότητες, το **φάντασμα κολόνας** (σβήνει σταδιακά καθώς το πας δεξιά), σημάδια έλξης, crosshair, κάθε ένδειξη. 2 στιγμιότυπα (2026-06-01 & 2026-07-02) — **μόνιμο/επαναλαμβανόμενο**, όχι στιγμιαίο.

## 2. ROOT CAUSE (επιβεβαιωμένο με DOM — ΟΧΙ υπόθεση)

**Τα canvas layers έχουν ασυγχρόνιστα (stale/race) μεγέθη buffer & CSS — κανένα δεν συμφωνεί με τον container.** Κάθε canvas κάνει **δικό του** `getBoundingClientRect()` σε **διαφορετική lifecycle στιγμή** αντί να παίρνει το **ΕΝΑ κοινό `viewport`** (SSoT από `useViewportManager`). Επειδή το drawing coordinate space κάθε canvas = το buffer του, ό,τι ζωγραφίζεται πέρα από την «εσωτερική» άκρη του buffer **κόβεται**. Το φάντασμα ζει σε ΑΛΛΟ canvas (preview) απ' ό,τι οι οντότητες (dxf) → διαφορετικό όριο κοπής → το «αόρατο σύνορο». Διαλείπον = εξαρτάται από το ΠΟΤΕ μέτρησε κάθε canvas (αρχικό mount / άνοιγμα-κλείσιμο sidebar / layout settle / HMR).

### DOM evidence (από live session, DPR≈0.8):

| Canvas | buffer (width×height attribute) | CSS πλάτος | Σχόλιο |
|---|---|---|---|
| container `canvas-stack` | — | **1502** | το σωστό/authoritative |
| `dxf-canvas` (z-10, οντότητες) | **536 × 809** | 100% (=1502) | buffer για ~670px container (536=670×0.8) → **stale, πολύ μικρό** |
| `layer-canvas` (z-0) | **536 × 809** | 100% | ίδιο stale |
| `preview-canvas` (z-15, **ΤΟ ΦΑΝΤΑΣΜΑ**) | **1555 × 748** | inline **`width:1944.06px`** | μετρήθηκε σε container ~1944px → **πολύ μεγάλο**, ρητό px override |
| grid/overlay canvases | 670×1011, 536×809, 1201×753, 1501×941 κ.λπ. | — | **όλα διαφορετικά** |

Δηλαδή διαφορετικά layers μετρήθηκαν σε container widths **670 / 1502 / 1944** και **ΔΕΝ ξανα-συγχρονίστηκαν** στο τελικό 1502.

### Snippet επαλήθευσης (τρέξε στο DevTools Console — δείχνει το desync):
```js
[...document.querySelectorAll('.canvas-stack canvas')].forEach(c => {
  const r = c.getBoundingClientRect();
  console.log(c.getAttribute('data-canvas-type') || c.getAttribute('data-dxf-overlay') || c.dataset.testid || 'canvas',
    '| buffer', c.width + 'x' + c.height,
    '| css', Math.round(r.width) + 'x' + Math.round(r.height),
    '| styleW', c.style.width || '(none)');
});
console.log('DPR', window.devicePixelRatio, 'container', Math.round(document.querySelector('.canvas-stack').getBoundingClientRect().width));
```
**Επιτυχία fix = ΟΛΑ τα layers ίδιο css πλάτος = container, και buffer = css × DPR (ίδιο για όλα).**

## 3. ΠΟΥ ΕΙΝΑΙ ΣΤΟΝ ΚΩΔΙΚΑ (leads — επαλήθευσε πριν πειράξεις)

- **SSoT viewport (σωστό):** `src/subapps/dxf-viewer/hooks/canvas/useViewportManager.ts` — trackάρει τον container με ResizeObserver (debounced 100ms) + DPR re-emit (ADR-549 Phase 7). Δίνει `viewport {width,height}` prop σε όλους.
- **DXF canvas (ο ένοχος #1):** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas.tsx` — `setupCanvas` (~γρ.246-258) διαβάζει **`canvas.getBoundingClientRect()`** (ΟΧΙ το `viewport` prop) και το resize effect (~γρ.312-322) ξανατρέχει μόνο σε αλλαγή του viewport prop αλλά ΠΑΛΙ μετράει δικό του rect → race. Καλεί `CanvasUtils.setupCanvasContext(canvas, canvasConfig)`.
- **Preview canvas (ο ένοχος #2 — εκεί το φάντασμα, βάζει inline width px):** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/` (PreviewCanvas.tsx + PreviewRenderer). Βρες πού μπαίνει το `style="width:...px"` (1944px). Πρέπει να διαστασιολογείται από το ΙΔΙΟ viewport SSoT.
- **Layer canvas:** ο LayerCanvas component (grep `data-canvas-type="layer"` / `layer-canvas`).
- **Grid/floorplan/overlays:** `GridUnderlayCanvas.tsx`, `FloorplanBackgroundCanvas`, snap/overlay canvases (`components/dxf-layout/`).
- **Κοινός buffer/DPR setup:** `CanvasUtils.setupCanvasContext` (grep) + `getDevicePixelRatio` / `subscribeDevicePixelRatio` (`systems/cursor/device-pixel-ratio`).
- **Shell/orchestrator:** `CanvasLayerStack.tsx` δίνει `viewport` prop σε ΟΛΑ (γρ. ~303-456). `CanvasSection.tsx` = orchestrator.

## 4. ΤΟ ΖΗΤΟΥΜΕΝΟ FIX (race-proof SSoT sizing)

**ΕΝΑ authoritative μέγεθος → εφαρμόζεται ΤΑΥΤΟΣΗΜΑ σε ΟΛΑ τα layers, σε ΚΑΘΕ αλλαγή:**
- Κάθε layer buffer: `canvas.width = round(viewport.width * dpr)`, `canvas.height = round(viewport.height * dpr)`.
- Κάθε layer CSS: πλάτος/ύψος = `viewport.width/height` (px ή σταθερά w-full/h-full — ΑΛΛΑ συνεπές παντού· **κατάργησε το ad-hoc inline `width:1944px` του preview**).
- ctx: reset transform + `scale(dpr,dpr)`.
- **Πηγή μεγέθους = ΜΟΝΟ το κοινό `viewport` prop** (SSoT), ΟΧΙ per-canvas `getBoundingClientRect()`.
- Re-apply σε **κάθε** αλλαγή viewport **ΚΑΙ** DPR (χρησιμοποίησε το υπάρχον `subscribeDevicePixelRatio`).
- Αποτέλεσμα: μηδέν race — άσχετο πότε γίνεται mount/resize, όλα καταλήγουν ίδιο μέγεθος = container.

### Big-player practice (Figma / Revit web / Google Maps / CAD web viewers)
Ένας **single ResizeObserver σε ΕΝΑΝ container** → υπολογισμός μεγέθους **μία φορά** → **ίδιο μέγεθος σε ΟΛΑ τα canvas layers**, DPR-aware, μέσα στο resize callback (ΟΧΙ ανεξάρτητη μέτρηση ανά canvas). Δηλαδή enterprise SSoT = ό,τι κάνουν οι μεγάλοι εδώ. **Ακολούθησε το.**

## 5. ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (ΥΠΟΧΡΕΩΤΙΚΟΙ)

1. **SSoT AUDIT ΠΡΩΤΑ (grep, ΠΡΙΝ γράψεις κώδικα):** ψάξε αν υπάρχει ΗΔΗ κεντρικός sizing helper (π.χ. `setupCanvasContext`, DPR utils, τυχόν `useCanvasSize`/resize hook). Αν υπάρχει → **επέκτεινέ το / χρησιμοποίησέ το**. ΜΗΝ φτιάξεις παράλληλο. Μηδέν διπλότυπα (N.0.2, N.12).
2. **ADR-040 (canvas perf) — ΔΙΑΒΑΣΕ ΠΡΩΤΑ** `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`. CHECK 6B/6C/6D: ΟΧΙ `useSyncExternalStore` σε CanvasSection/CanvasLayerStack (orchestrator/shell)· stage το ADR-040 στο commit (αλλιώς μπλοκάρει το hook). Το sizing πρέπει να μείνει στα leaves/components, ΟΧΙ να μπει subscription στον orchestrator.
3. **ΜΗΝ τρέξεις `tsc`/typecheck (N.17).** jest ΕΠΙΤΡΕΠΕΤΑΙ — γράψε/τρέξε στοχευμένα tests όπου έχει νόημα (το sizing είναι DOM/RAF-heavy· κάλυψε ό,τι είναι pure).
4. **ΜΗΝ κάνεις commit/push (N.(-1)).** Ετοίμασε, δείξε diff, ο Giorgio committάρει.
5. **Shared working tree:** stage ΜΟΝΟ τα αρχεία που πειράζεις για ΑΥΤΟ το fix. ΜΗΝ αγγίξεις το uncommitted `column-preview-helpers.ts` (ADR-503).
6. **Enterprise TypeScript:** όχι `any`/`as any`/`@ts-ignore`. Semantic. Αρχεία ≤500 γρ., functions ≤40 γρ.
7. **Model:** αυτό είναι architecture/canvas-critical/cross-file → Opus. Δήλωσε μοντέλο + περίμενε «ok» (N.14) ΠΡΙΝ γράψεις κώδικα.
8. Στο τέλος: δήλωσε ✅/⚠️/❌ Google-level + ενημέρωσε ADR-040 changelog.

## 6. VERIFICATION

- Τρέξε το snippet της §2 μετά το fix → όλα τα layers ίδιο css=container, buffer=css×DPR.
- Browser: το φάντασμα κολόνας δεν σβήνει/κόβεται πουθενά· οντότητες ορατές σε όλο το πλάτος· resize παραθύρου + άνοιγμα/κλείσιμο sidebar + αλλαγή DPR (browser zoom) → όλα παραμένουν συγχρονισμένα.
- 🔴 browser-verify από Giorgio + commit από Giorgio.

## 7. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ

- ΜΗΝ κυνηγήσεις το «FloatingPanelsSection w-80» / δεξί panel — **αποκλείστηκε** (το DOM έδειξε τον καμβά full-width 1502· δεν είναι docked panel).
- ΜΗΝ κυνηγήσεις το «Φόρτωση…» / τα «4 σφάλματα» κονσόλας — ήταν **άσχετο σφάλμα επέκτασης Chrome** (`A listener indicated an asynchronous response...`), όχι chunk-load.
- Το `FPS: 0` alert = ξεχωριστό perf θέμα, εκτός scope εδώ.
