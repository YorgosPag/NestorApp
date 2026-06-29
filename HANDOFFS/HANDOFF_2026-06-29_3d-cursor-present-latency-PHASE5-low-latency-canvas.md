# HANDOFF — 3D cursor lag Phase 5: low-latency presentation (~28ms present-latency floor)

**Ημ/νία:** 2026-06-29 · **ADR:** 549 (`ADR-549-3d-cursor-swim-render-loop.md`) · **Model:** Opus 4.8
**Working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** COMMIT τα κάνει **ΜΟΝΟ ο Giorgio** — όχι ο agent.
Ποτέ `--no-verify`, ποτέ `git add -A` (μόνο specific files).

---

## 0. TL;DR — τι αποδείχθηκε & τι μένει

Το 3D σταυρόνημα/κέρσορας «κολυμπάει» (~lag) στο BIM 3D viewport, σε αδύναμη integrated GPU.
Phases 1-4 **έκλεισαν** τα CPU/render αίτια. Το **residual** αποδείχθηκε με **μετρημένα δεδομένα** (641-sample
window, καθαρό BIM sweep 26.6s):

| Μετρική | Τιμή |
|---|---|
| `cursor.totalLag` | avg **31.6ms** · **min 1.3ms** · p95 62 · max 100 (641 samples) |
| `cursor.inputLatency` | avg **1.9ms** (το input φτάνει γρήγορα) |
| renders | 14/26.6s · overlays όλα <1ms |

**Συμπέρασμα (100% μετρημένο, ΟΧΙ εικασία):** input ~2ms αλλά paint ~28ms → **σταθερό πάτωμα
~28ms present/compositor latency** (≈1.7 frames). ΔΕΝ είναι σπασμοί, ΔΕΝ είναι CPU/render, ΔΕΝ είναι τα
overlays. Το σταυρόνημα (DOM layer, translate3d) συνθέτεται μαζί με το **vsync-locked WebGL present** →
ο compositor καθυστερεί. **Επιβεβαιώνει την αρχική υπόθεση «GPU present» του παλιού handoff — τώρα με νούμερα.**

➡️ **PHASE 5 = low-latency presentation.** Στόχος: ρίξε το ~28ms πάτωμα → <1 frame (CAD-grade).

---

## 1. ΤΙ ΝΑ ΚΑΝΕΙΣ (Phase 5) — big-player doctrine

**Κανόνας Giorgio:** υλοποίηση όπως **Revit / Maxon Cinema 4D**. Οι native players χρησιμοποιούν
low-latency present / direct swap-chain. Το **web-platform ισοδύναμο** (που χρησιμοποιούν Figma / Onshape /
Google drawing apps για cursor/stylus latency) είναι:

1. **`desynchronized: true` + `powerPreference: 'high-performance'`** στο **WebGL context** του ΖΩΝΤΑΝΟΥ
   3D viewport → αποσυνδέει το present από τον vsync-locked compositor (low-latency mode).
2. **`desynchronized: true`** στα **Canvas2D overlay** contexts του 3D (snap/grips/hover-glow/crop/dispatch)
   → το cursor-layer compositing δεν περιμένει το WebGL frame.
3. (αν χρειαστεί) Chrome DevTools → Performance → **GPU/compositor track** για επιβεβαίωση πριν/μετά
   (το `performance.now()` diag ΔΕΝ πιάνει GPU — γι' αυτό «όλα φαίνονταν φθηνά» στα Phase 1-3).

⚠️ **Caveats** να ελεγχθούν στο browser-verify: `desynchronized` μπορεί να δώσει tearing ή να αλληλεπιδρά
με `alpha:true` compositing. Για CAD viewer η ανταλλαγή (latency vs tearing) είναι **σωστή** — αλλά
επιβεβαίωσε οπτικά. Αν big-player πρακτική το διαψεύδει → ακολούθησε αυτήν.

---

## 2. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

**Ο μηχανισμός ΥΠΑΡΧΕΙ ΗΔΗ στον κώδικα — REUSE, μηδέν διπλότυπα.** Αρχικά ευρήματα (ΕΠΑΛΗΘΕΥΣΕ + grep
βαθύτερα):

- **Live WebGL renderer (ο στόχος #1):** `bim-3d/scene/scene-setup.ts:101`
  `new THREE.WebGLRenderer({ antialias:true, alpha:true, stencil:true, preserveDrawingBuffer:false })`
  → **ΔΕΝ** έχει `desynchronized`/`powerPreference`. (Η γρ.134 `preserveDrawingBuffer:true` = capture/export
  renderer, ΟΧΙ ο interactive — μην το αγγίξεις. Όμοια τα `preview/*`, `2d-section/*`, `detail-sheet/*`.)
- **`desynchronized` ΗΔΗ σε χρήση (precedent + SSoT):**
  - `canvas-v2/preview-canvas/PreviewRenderer.ts:112` → `getContext('2d', { alpha:true, desynchronized:true })`
    (το 2D DXF preview **ήδη** το κάνει — αντίγραψε το pattern).
  - `rendering/canvas/utils/CanvasUtils.ts:407-412` → **κεντρικό util** με option `desynchronized?` →
    αν τα overlays φτιάχνουν context μέσω αυτού, απλά πέρνα `desynchronized:true`. **Αυτό είναι το SSoT.**
- **3D overlay Canvas2D contexts (στόχος #2 — grep ποια είναι «cursor-critical»):**
  `bim-3d/viewport/overlay-dispatch/BimOverlayDispatchCanvas.tsx:82`, `bim-3d/render/crop-region/CropRegionOverlay.tsx:105`,
  + τα snap/grips/hover-glow overlays (grep `getContext('2d'` σε `bim-3d/viewport/**` + `bim-3d/render/**`).
  ⚠️ Το `overlay-dispatch/` είναι **καινούργιο, uncommitted, ΑΛΛΟΥ agent** — δες τι κάνει πριν το αγγίξεις.

**Grep εντολές για το audit:**
```
grep -rn "new THREE.WebGLRenderer" src/subapps/dxf-viewer/bim-3d/scene/
grep -rn "desynchronized" src/subapps/dxf-viewer/
grep -rn "getContext('2d'" src/subapps/dxf-viewer/bim-3d/viewport/ src/subapps/dxf-viewer/bim-3d/render/
grep -rn "createContext2D\|get2DContext\|CanvasUtils" src/subapps/dxf-viewer/rendering/canvas/utils/
```
**Αν υπάρχει κεντρικό context-factory (CanvasUtils) → πέρνα option, ΜΗ γράψεις νέο getContext.**

---

## 3. ΜΕΤΡΗΣΗ (το tooling είναι έτοιμο — uncommitted, revertible diag)

`window.__bim3dPerf.download()` → καθαρό flat `.txt` στις Λήψεις (ΟΧΙ console expand-arrows).
Πρωτόκολλο μέτρησης (Giorgio τρέχει στην κονσόλα):
```
localStorage.setItem('dxf-perf-trace','1'); localStorage.setItem('dxf-trace-dirty','1'); location.reload();
__bim3dPerf.reset()      // μηδενίζει renders + cursor, κρατά ΟΛΟ το window (hold-window fix)
// …σάρωση ~10s συνεχόμενα πάνω σε οντότητες…
__bim3dPerf.download()   // → bim3d-perf-<ώρα>.txt στις Λήψεις
```
**Baseline (πριν Phase 5):** `cursor.totalLag` avg **~31ms**, min ~1.3ms. Στόχος μετά: avg «πέφτει
αισθητά» (ιδανικά <16ms / 1 frame). Σύγκρινε πριν/μετά αρχεία.

A/B flag `dxf-no-overlays=1` (στο `overlay-raf.ts`) διαθέσιμο για απομόνωση overlays αν χρειαστεί.

---

## 4. ΚΑΤΑΣΤΑΣΗ ΑΡΧΕΙΩΝ (όλα UNCOMMITTED — Giorgio θα κάνει commit)

**Δικά μου (Phase 4 + §2.2 + tooling):**
- `bim-3d/viewport/BimCrosshairOverlay3D.tsx` — §2.2 sync snap-glue (`snapProjectedRef`, αφαίρεση `gluedRef`). ΣΩΣΤΟ & ασφαλές, **κράτα το** (δρα προ-compositing → δεν λύνει το πάτωμα, αλλά βελτιώνει steady-state).
- `bim-3d/viewport/overlay-raf.ts` — A/B `dxf-no-overlays` gate (revertible diag).
- `bim-3d/scene/bim3d-perf-diag.ts` — `__bim3dPerf.download()` (reuse `triggerExportDownload`+`nowISO`, κεντρικά).
- `systems/cursor/mouse-handler-perf.ts` — `resetPerf()` + hold-window (full measurement window).
- `docs/.../adrs/ADR-549-3d-cursor-swim-render-loop.md` — Phase 4 findings + Phase 5 plan (changelog ενημερωμένο).

**ΑΛΛΟΥ agent (μην τα αγγίξεις χωρίς λόγο):** `analytical-painter.ts`, `overlay-dispatch/`, `proposal-overlays/`.

---

## 5. ΚΑΝΟΝΕΣ
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio.** Ο agent προετοιμάζει, δεν committαρει. Ποτέ `--no-verify`/`git add -A`.
- **Shared working tree** — άλλος agent δουλεύει παράλληλα. Stage ΜΟΝΟ τα δικά σου specific αρχεία.
- **ADR-040 CHECK 6B/6D:** `scene-setup.ts` + overlays = canvas/cursor-critical → όταν committαρει ο Giorgio,
  stage **ADR-549** (+ ADR-040/366 αν αγγίξεις micro-leaf). Διάβασε ADR-040 πριν αγγίξεις scheduler.
- **N.17:** ΕΝΑ `tsc` τη φορά (έλεγξε για άλλον running πρώτα). Μικρές αλλαγές 1-3 αρχεία → SKIP tsc.
- **PROFILE → DATA → FIX.** Μέτρα baseline πριν, μέτρα μετά. Καμία αλλαγή «στα τυφλά».
- **FULL ENTERPRISE + FULL SSoT:** reuse `CanvasUtils`/`PreviewRenderer` pattern· no `any`/`as any`· big-player.
- Όταν κλείσει το θέμα → **revert το Phase 0 diag** (`bim3d-perf-diag.ts`, `overlay-raf` flag, perf hooks).
