# HANDOFF — Cursor lag DXF viewer: Paint/DisplayList bottleneck → Revit-grade λύση (FULL ENTERPRISE + FULL SSOT)

**Ημερομηνία:** 2026-06-15 · **Μοντέλο:** Opus (perf hot path, ADR-040 critical, υψηλό regression risk) · **Domain:** DXF Viewer 2D canvas input + cursor/crosshair rendering pipeline

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH τα κάνει Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent + υπάρχουν UNCOMMITTED → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **Στόχος Giorgio (ρητός):** «όπως οι μεγάλοι παίχτες, όπως η Revit» → **FULL ENTERPRISE + FULL SSOT**. Καμία πρόχειρη λύση, κανένα hardcode, καμία διπλή υλοποίηση — επέκτεινε/επαναχρησιμοποίησε υπάρχοντα.
5. N.2/N.3/N.11: ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ inline styles (⚠️ ΠΡΟΣΟΧΗ: το crosshair χρησιμοποιεί `style.transform` imperatively — αυτό είναι αποδεκτό perf pattern, ΟΧΙ JSX inline style)· ΟΧΙ hardcoded strings. N.7.1: code files ≤500 γρ, functions ≤40 γρ.
6. **ADR-040 (micro-leaf) CRITICAL:** ΟΛΑ τα αρχεία cursor/render είναι ADR-040. ΔΙΑΒΑΣΕ `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ αγγίξεις οτιδήποτε + STAGE το (pre-commit CHECK 6B/6C/6D BLOCK). Δες CLAUDE.md «DXF VIEWER ARCHITECTURE».
7. **N.0.1 ADR-driven:** Phase 1 Recognition (κώδικας=source of truth) → plan σε slices → **έγκριση Giorgio** → υλοποίηση → ADR-040 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY. **Profiler-verify (screenshot) μετά**.
8. **N.17 single-tsc:** ΠΟΤΕ 2 ταυτόχρονα tsc· έλεγξε πριν τρέξεις.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio)
Στο **`https://nestorconstruct.gr/dxf/viewer`** (2Δ προβολή) υπάρχει **ορατό lag**: ο κέρσορας/σταυρόνημα «**καθυστερεί να ακούσει**» — τρέχει πίσω από το ποντίκι. Με απλή κίνηση πάνω-κάτω-δεξιά-αριστερά πάνω στον 2Δ καμβά. **«Η κατάσταση δεν είναι ευχάριστη για τον χρήστη.»**

**Στόχος:** Revit/AutoCAD-grade ομαλότητα — ο κέρσορας 1:1 με το ποντίκι, μηδέν αισθητό lag, ακόμα και με φορτωμένη σκηνή.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ — Φ5 (από αυτή τη συνεδρία, Opus, UNCOMMITTED) + ΓΙΑΤΙ ΔΕΝ ΕΦΤΑΣΕ
**Διάγνωση Φ5:** το `getPointerSnapshotFromElement` (`rendering/core/CoordinateTransforms.ts`) καλούσε `element.getBoundingClientRect()` σε **ΚΑΘΕ mousemove** = forced synchronous reflow.

**Fix Φ5 (UNCOMMITTED, δικά μου αρχεία):**
- NEW `src/subapps/dxf-viewer/rendering/core/pointer-rect-cache.ts` (`getCachedClientRect` — cache του DOMRect, invalidate σε ResizeObserver(element)+window scroll/resize/mousedown).
- NEW `rendering/core/__tests__/pointer-rect-cache.test.ts` (4 jest GREEN).
- MOD `rendering/core/CoordinateTransforms.ts` (import + 1 γραμμή: `getCachedClientRect` αντί `getBoundingClientRect`).
- MOD `ADR-040` changelog (entry «Cursor-lag Φ5») + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

**ΑΠΟΤΕΛΕΣΜΑ (Firefox Profiler 4.6s, μόνο κίνηση κέρσορα — screenshot `Στιγμιότυπο οθόνης 2026-06-15 141413.jpg`):**
- ✅ **Reflow ΕΦΥΓΕ:** «Update the rendering Layout, content-visibility and resize observers» = **0.7% (3 samples)**. Αποδεικνύει ότι το Φ5 δούλεψε.
- ✅ JS mousemove handler (EventListener.handleEvent) = **19%** — υγιές, όχι καταιγίδα.
- 🔴 **ΑΛΛΑ ο Giorgio «δεν είδε διαφορά».** Ο **πραγματικός bottleneck** είναι αλλού:
  - **Paint = 29% (125 samples, 255ms)** σε ΑΠΛΗ κίνηση κέρσορα, με κατανομή:
    - **DisplayList building 58% (73)**
    - **WebRender display list 37% (46)**
    - Other ~1.6%
  - RefreshDriver tick 76% (περιέχει τα παραπάνω).

**ΣΥΜΠΕΡΑΣΜΑ:** Σε ένα σωστό **compositor** σταυρόνημα (καθαρό `translate3d` σε απομονωμένο GPU layer), η απλή κίνηση πρέπει να δίνει **σχεδόν μηδέν Paint**. Εδώ το browser **rebuild-άρει display list / ξαναζωγραφίζει σε κάθε κίνηση** → ΑΥΤΟ είναι η αιτία του lag, και είναι **διαφορετικό** από το reflow που λύθηκε στο Φ5.

---

## 3. ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΠΙΠΕΛΙΝΕ ΚΕΡΣΟΡΑ (SSOT — επέκτεινε, ΜΗΝ διπλασιάσεις)
Ροή mousemove → σταυρόνημα:
1. **Event handler:** `systems/cursor/mouse-handler-move.ts` (`useMouseMoveHandler`) — attached μέσω `useCentralizedMouseHandlers`. Καλεί `getPointerSnapshotFromElement` (πλέον cached, Φ5) → `setImmediatePosition(screenPos)` synchronously. Μέσα του τρέχουν ΚΑΙ: snap detection (throttle 32ms), hover hit-test (throttle 50ms), drawing-hover, pan (rAF), lasso/region.
2. **Cursor SSoT:** `systems/cursor/ImmediatePositionStore.ts` — zero React state. `setPosition` → `directRenderCallback(pos)` IMMEDIATELY (no RAF) + notify listeners. **Δεν** mark-άρει canvas dirty σε plain move (Φ4: αφαιρέθηκε `layer-canvas`).
3. **Crosshair render:** `canvas-v2/overlays/CrosshairOverlay.tsx` — **4 promoted DOM divs** (segLeft/Right/Top/Bottom) με `willChange:'transform'`, κινούνται μόνο με `style.transform = translate3d(...)` (από Φ2, commit `47454acf`). Helper: `canvas-v2/overlays/crosshair-compositor-layout.ts`. Καταχωρείται μέσω `registerDirectRender` (`CrosshairOverlay.tsx:~273`).
4. **Scheduler:** `rendering/core/UnifiedFrameScheduler.ts` (RAF orchestrator). Στο plain move ΔΕΝ πρέπει να τρέχει scene redraw.

**Παράλληλα overlays που ίσως ξαναζωγραφίζουν per-move (ΥΠΟΨΗΦΙΟΙ ΕΝΟΧΟΙ για Paint):**
- `canvas-v2/overlays/CrosshairOverlay.tsx` — οι 4 γραμμές καλύπτουν **όλο το πλάτος/ύψος** του καμβά· μετακίνηση τεράστιων layers → πιθανό DisplayList rebuild μεγάλης περιοχής.
- Snap indicator (SnapIndicatorSubscriber / `rendering/ui/snap/SnapRenderer.ts`).
- Coordinate readout `ToolbarCoordinatesDisplay` (textContent write — throttled).
- `DynamicInputSubscriber.tsx`.
- `debug/layout-debug/CoordinateDebugOverlay.tsx` (window mousemove + getBoundingClientRect + setState **ΑΝ** flag `ENTERPRISE_SETTINGS_SHADOW_MODE` ON).

**Προηγούμενες φάσεις (committed, στο ADR-040 changelog):** Φ1 (cursor.position out of React, `fcf2c5b4`), Phase V (CrosshairOverlay χωρίς `useSyncExternalStore`, 2026-05-10), Φ2 (compositor crosshair `47454acf`), Φ4 (stop per-move layer-canvas repaint `8c08cbc2`), Φ5 (rect cache — UNCOMMITTED, εδώ).

---

## 4. PHASE 1 RECOGNITION — ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ (profiler-first, ΜΗΝ μαντέψεις)
**Ο Giorgio χρησιμοποιεί Firefox Profiler (profiler.firefox.com).** Η αιτία ΔΕΝ προκύπτει από screenshots μόνο — χρειάζεται το **subtree/markers του Paint**.

1. **ΖΗΤΑ από τον Giorgio:** στο profiler, δεξί-κλικ στο `Paint` (ή `Update the rendering Paint`) → **«Focus on subtree»** + άνοιξε την καρτέλα **«Δείκτες» (Markers)** → screenshot. Στόχος: να φανεί **ΠΟΙΟ DOM στοιχείο/layer** προκαλεί το DisplayList building (crosshair; snap; coordinate; full canvas;).
2. Επιβεβαίωσε ότι το **production τρέχει το νέο build** — αν το `nestorconstruct.gr` είναι πίσω, ίσως λείπουν ΚΑΙ οι Φ1-Φ4 (τότε re-deploy = μεγάλο μέρος της λύσης). Ρώτα/τσέκαρε deploy.
3. Διάβασε `CrosshairOverlay.tsx` + `crosshair-compositor-layout.ts`: είναι οι 4 divs σε **δικό τους compositor layer**; Υπάρχει `contain`/`isolation`/promoted layer; Καλύπτουν όλο τον καμβά (μεγάλη invalidation region);
4. Έλεγξε αν στο plain move γίνεται **markSystemsDirty / scene redraw** από κάπου (grep `markSystemsDirty`, `markSceneDirty`, `markAllCanvasDirty` σε cursor/hover/snap paths).
5. Έλεγξε αν `CoordinateDebugOverlay` είναι mounted (flag `ENTERPRISE_SETTINGS_SHADOW_MODE` — `FloatingPanelsSection.tsx:~261`).
6. **N.8:** δήλωσε execution mode + ρώτα Orchestrator vs Plan Mode.

---

## 5. ΚΑΤΕΥΘΥΝΣΗ ΛΥΣΗΣ (Revit-grade, FULL SSOT — πρότεινε, ζήτα έγκριση)
Στόχος: **Paint σε plain cursor move ≈ 0** (μόνο GPU compositing).
Πιθανές προσεγγίσεις (επιβεβαίωσε με profiler ΠΟΙΑ ισχύει ΠΡΙΝ υλοποιήσεις):
- **(A) Compositor isolation του σταυρονήματος:** εξασφάλισε ότι το crosshair container είναι **δικό του GPU layer** (`will-change:transform` στο σωστό element, `contain:layout paint size`, ίσως μικρά segment boxes αντί full-canvas-spanning divs ώστε η invalidation region να είναι μικροσκοπική). Revit/AutoCAD: ο κέρσορας ζει σε αποκλειστικό, ελάχιστο layer.
- **(B) Dedicated minimal-redraw overlay:** αν το DOM-4-divs αναγκάζει WebRender να rebuild-άρει μεγάλο display list, εναλλακτικά ένα **αποκλειστικό overlay canvas** για τον κέρσορα με imperative draw + clear ΜΟΝΟ της προηγούμενης μικρής περιοχής (dirty-rect), εκτός του scene scheduler. (⚠️ Φ2 έφυγε ΑΠΟ canvas σε DOM — μην επιστρέψεις τυφλά· απόφαση βάσει profiler.)
- **(C) Εξάλειψη per-move repaint από overlays:** αν ένοχος είναι snap/coordinate/dynamic-input/debug overlay → throttle/leaf-isolate/textContent-only/gate πίσω από flag.
- **(D) Pointer event handling:** εξέτασε `pointermove` + `getCoalescedEvents`, single-rAF coalescing όλης της per-move δουλειάς, `pointerrawupdate` μόνο για τον κέρσορα.

**ΑΡΧΗ:** ΕΝΑ SSoT για τη θέση κέρσορα (`ImmediatePositionStore`, υπάρχει) + ΕΝΑ render path (μην προσθέσεις 2ο). Μέτρησε ΠΡΙΝ/ΜΕΤΑ με profiler — Paint% πρέπει να πέσει δραστικά.

---

## 6. VERIFY
Firefox Profiler, μόνο κίνηση κέρσορα στον 2Δ καμβά: **Paint/DisplayList building να πέσει ≈0** (από 29%/255ms)· Layout να μείνει ~0 (Φ5)· **υποκειμενικά** ο Giorgio να δει τον κέρσορα 1:1 χωρίς lag. Picking/snap ακριβή μετά panel toggle/scroll. 60fps. ADR-040 micro-leaf άθικτο (CHECK 6B/6C/6D).

## 7. ΚΑΤΑΣΤΑΣΗ TREE / UNCOMMITTED (Φ5 — βάση για συνέχεια)
Shared tree, πολλά UNCOMMITTED άλλων agents (ΜΗΝ τα αγγίξεις). **Δικά μου UNCOMMITTED (Φ5):** `rendering/core/pointer-rect-cache.ts` (NEW), `rendering/core/__tests__/pointer-rect-cache.test.ts` (NEW), `rendering/core/CoordinateTransforms.ts` (MOD), `ADR-040-preview-canvas-performance.md` (MOD), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (MOD). **Commit τα κάνει ο Giorgio.**

**ADR/refs:** ADR-040 (micro-leaf + όλο το cursor-lag changelog Φ1-Φ5), `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md`.
**Screenshots αναφοράς:** `Στιγμιότυπο οθόνης 2026-06-15 141413.jpg` (profiler: Paint 29%, Layout 0.7%).
**Key files:** `systems/cursor/{mouse-handler-move.ts, ImmediatePositionStore.ts}`, `canvas-v2/overlays/{CrosshairOverlay.tsx, crosshair-compositor-layout.ts}`, `rendering/core/{CoordinateTransforms.ts, pointer-rect-cache.ts, UnifiedFrameScheduler.ts}`.
