# HANDOFF — CAD σταυρόνημα = OS hardware cursor (1:1). Τελείωμα 2D + ενοποίηση/καθαρισμός

**Ημ/νία:** 2026-06-29 · **ADR:** 549 (Phase 8) + 545 (canvas crosshair retired) + 556 (DPR-sync) · **Model:** Opus 4.8
**Working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** — όχι ο agent.
Ποτέ `--no-verify`, ποτέ `git add -A` (μόνο specific files). Όλα τα παρακάτω είναι **UNCOMMITTED**.

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (doctrine)

Υλοποίηση **big-player level: Revit / Maxon Cinema 4D / Figma**. **FULL ENTERPRISE + FULL SSOT**. Αν οι
μεγάλοι παίχτες δεν προτείνουν κάτι → ακολουθούμε τη δική τους πρακτική. **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ: ΠΡΑΓΜΑΤΙΚΟ
SSoT AUDIT με grep** — βρες αν υπάρχει ήδη αντίστοιχος μηχανισμός για να τον REUSE, μηδέν διπλότυπα.

---

## 1. TL;DR — πού φτάσαμε (μετρημένο/browser-verified)

Το 3D σταυρόνημα/κέρσορας «κολυμπούσε» (lag). Μετά από **bisection** (kill render/overlays/2D ένα-ένα)
αποδείχθηκε: **ΚΑΘΕ web-canvas/DOM σταυρόνημα κολυμπάει** — residual = **compositor present latency**
του page layer, αναπόφευκτο. Phase 5 (desynchronized canvas) + Phase 6 (DOM→canvas) βελτίωσαν αλλά **δεν**
έφτασαν το 1:1.

**ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (Giorgio):** ο native OS κέρσορας (το «χεράκι» πάνω στο ViewCube) είναι **τέλεια 1:1**
γιατί ζωγραφίζεται σε **hardware cursor plane** της GPU, αποσυνδεδεμένος από το page render. **Κανένα**
web canvas δεν το φτάνει. **Λύση (big-player, Figma/Google pattern):** το σταυρόνημα να ΓΙΝΕΙ
**CSS hardware cursor** (`cursor: url(<png>) hotX hotY, crosshair`) → η GPU το ζωγραφίζει σαν OS κέρσορα
→ **εγγυημένα 1:1**. ✅ **Browser-verified στον Chrome: ΤΕΛΕΙΟ 1:1.**

**Τίμημα (web platform limit, αποδεκτό από Giorgio):**
- Bounded εικόνα (≤128px, **πρακτικά ≤32px σε Windows/Chrome**) → **ΟΧΙ** full-screen βραχίονες.
- **ΟΧΙ** center snap-glue (ο hardware cursor είναι πάντα στην πραγματική θέση). **ΟΜΩΣ** το snap marker
  ανάβει κανονικά + το κλικ πιάνει ακριβώς το snap (το dynamic-input/σιελ μετρήσεις/φάντασμα = άθικτα).

**Big-player τεκμηρίωση:** Figma/Google web tools βασίζονται στον OS/CSS cursor (ποτέ canvas) για τον
δείκτη. Revit/C4D = native low-latency present. Το CSS hardware cursor = το web ισοδύναμο.

---

## 2. 🔴 ΤΙ ΜΕΝΕΙ — ΕΠΟΜΕΝΟ ΒΗΜΑ (η δουλειά σου)

### Α) ΚΥΡΙΟ: το 2D σταυρόνημα ΔΕΝ εμφανίζεται (το 3D ✅ δουλεύει)
Το `useCrosshairCursor` εφαρμόζεται στο 2D στο `CanvasLayerStack.tsx` (containerRef = canvas-stack div,
γρ.~269) με gate `enabled: crosshairSettings.enabled && !!dxfScene`. Πιθανές αιτίες (κάνε **grep/debug**):
1. **`!!dxfScene` gate** — χωρίς φορτωμένο σχέδιο → disabled → cursor-none. (Ο Giorgio ίσως το θέλει να
   φαίνεται **πάντα**, όπως το 3D — ρώτησέ τον ή αφαίρεσε το gate.)
2. **Child element override:** κάποιο 2D canvas/overlay (DxfCanvas/LayerCanvas/PreviewCanvas/SnapIndicator)
   πάνω από το container ορίζει δικό του `cursor` → υπερισχύει του inherited hardware cursor. Grep
   `style.cursor` / `cursor-` σε `canvas-v2/**` + `components/dxf-layout/**`.
3. **containerRef timing** — ο retry του hook (poll 120ms μέχρι το element) πρέπει να το πιάνει· επιβεβαίωσε.

### Β) ΚΑΘΑΡΙΣΜΟΣ (full unification) — μετά το ΟΚ του 2D
- **Διέγραψε τα νεκρά canvas-crosshair αρχεία** (πλέον unmounted/orphan· dead-code ratchet CHECK 3.22 θα
  μπλοκάρει commit μέχρι να φύγουν):
  `canvas-v2/overlays/CrosshairOverlay.tsx`, `bim-3d/viewport/BimCrosshairOverlay3D.tsx`,
  `canvas-v2/overlays/CrosshairCompositor.tsx`, `canvas-v2/overlays/crosshair-compositor-paint.ts`
  (+`__tests__/crosshair-compositor-paint.test.ts`), `canvas-v2/overlays/crosshair-compositor-layout.ts`
  (+ test). ⚠️ Grep ΠΡΩΤΑ για τυχόν εναπομείναντες importers (π.χ. `debug/layout-debug/CoordinateDebugOverlay`).
- **Revert Phase 0 diagnostics:** `bim3d-perf-diag.ts` hooks, flags `dxf-no-render`/`dxf-no-overlays`/
  `dxf-crosshair-no-desync`, `mouse-handler-perf` hold-window/probe. (Κάποια ίσως ήδη committed — grep.)
- **Decision 2D gate** `!!dxfScene` (βλ. Α.1).

### Γ) ADRs (stage μαζί με τον κώδικα — CHECK 6B/6D)
- **ADR-549** Phase 8: canvas crosshair → OS hardware cursor (PNG). Big-player + τίμημα.
- **ADR-545**: το shared canvas `CrosshairCompositor` **αποσύρθηκε** (retired).
- **ADR-556** (ήδη γραμμένο): DPR-change sync. Επαλήθευσε ότι ισχύει ακόμα μετά τυχόν refactor.

---

## 3. ΚΑΤΑΣΤΑΣΗ ΑΡΧΕΙΩΝ (UNCOMMITTED)

### Phase 8 — Ο ΤΕΛΙΚΟΣ ΜΗΧΑΝΙΣΜΟΣ (κράτα τον)
- **NEW** `systems/cursor/crosshair-cursor-image.ts` — pure PNG-raster builder (offscreen canvas →
  `toDataURL('image/png')`). **ΚΡΙΣΙΜΟ:** Chrome ΑΠΟΡΡΙΠΤΕΙ SVG cursors (δουλεύει σε Firefox, ΟΧΙ Chrome)
  → PNG υποχρεωτικό. Windows/Chrome cap **≤32px** (μεγαλύτερο → drop → cursor-none). 4 jest ✓.
- **NEW** `systems/cursor/useCrosshairCursor.ts` — hook: settings-driven (χρώμα/πάχος/opacity/pickbox/gap
  από `getCursorSettings().crosshair` SSoT)· `isCrosshairSuppressed` (NavWheel)→'default'· **retry 120ms
  μέχρι να υπάρχει το element** (host returns null μέχρι visible). Default size **32**.
- `bim-3d/viewport/BimViewport3D.tsx` — `useCrosshairCursor(containerRef)` (γρ.~100, settings-driven). ✅ δουλεύει.
- `bim-3d/viewport/BimViewport3DCanvasOverlays.tsx` — **αφαιρέθηκε** το mount `<BimCrosshairOverlay3D>`.
- `components/dxf-layout/CanvasLayerStack.tsx` — `useCrosshairCursor(containerRef, {enabled:...&&!!dxfScene})`
  (γρ.~269) + **αφαιρέθηκε** mount `<CrosshairOverlay>` + unused import `isStoreSelected`. ⚠️ CHECK 6C/6D file.

### Phase 5 — low-latency present (desynchronized) — κράτα
- `scene-setup.ts` (`createBimRenderer`: manual webgl2 desynchronized context + `powerPreference` + NEW
  `bimPixelRatio()` SSoT clamp). `rendering/canvas/withCanvasState.ts` (`sizeCanvasToContainerDpr` optional
  `desynchronized`). `bim-overlay-pass.ts` (passes true). `BimOverlayDispatchCanvas.tsx` (onStop).

### Phase 7 — DPR-change sync (ADR-556) — κράτα
- **NEW** `systems/cursor/device-pixel-ratio.ts` (`subscribeDevicePixelRatio`, re-arming matchMedia) + 4 jest.
- Wiring: `useCanvasResize.ts`, `useCanvasSizeObserver.ts`, `useViewportManager.ts`, `BimViewport3D.tsx`,
  `ThreeJsSceneManager.ts` (`syncDevicePixelRatio` + `bimPixelRatio`). ⚠️ **ΕΠΑΛΗΘΕΥΣΕ:** άλλος agent
  refactored το resize σε `bim-3d/scene/scene-manager-resize.ts` (`applyDevicePixelRatioSync`) — grep ότι
  το DPR-sync wiring είναι ακόμα συνδεδεμένο σωστά.

### ΝΕΚΡΑ (προς διαγραφή, βλ. §2.Β) — Phase 6, superseded
`CrosshairOverlay.tsx`, `BimCrosshairOverlay3D.tsx`, `CrosshairCompositor.tsx`,
`crosshair-compositor-paint.ts`, `crosshair-compositor-layout.ts` (+tests).
(Το `BimCrosshairOverlay3D` έχει ακόμα ένα 🔴 κόκκινο A/B reference canvas — φεύγει με τη διαγραφή.)

---

## 4. ΜΑΘΗΜΑΤΑ (μην τα επαναλάβεις)
- **Chrome custom cursors: ΜΟΝΟ PNG, ≤32px σε Windows.** SVG cursor = ΟΚ Firefox / ΟΧΙ Chrome.
- **Hidden mount:** ο host (`BimViewport3D`) κάνει `if(!effectiveVisible) return null` → το `containerRef`
  είναι null όταν τρέχει το effect· refs ΔΕΝ ξαναπυροδοτούν effect → **χρειάζεται retry/poll**.
- **`??` μαζί με `||` χωρίς παρενθέσεις = parse error στον SWC/Turbopack** (σπάει σιωπηλά το module).
- **Shared tree:** μην γράφεις τα ίδια αρχεία ταυτόχρονα με άλλον agent (HMR instability «δουλεύει→χάνεται»).

## 5. ΜΕΤΡΗΣΗ / VERIFY
- Σύγκριση 1:1: ο hardware cursor πρέπει να ακολουθεί όπως το «χεράκι» στο ViewCube (κυκλικές/γρήγορες).
- `npx tsc --noEmit` (N.17: ΕΝΑΣ tsc τη φορά — έλεγξε για running πρώτα). Όλα τα Phase 5-8 jest πράσινα.
- ΜΕΤΑ από κάθε αλλαγή: hard reload (Ctrl+Shift+R).
