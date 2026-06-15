# HANDOFF — Cursor lag DXF viewer: Slice 2b crosshair Paint→0 + orchestrator re-renders (FULL ENTERPRISE + FULL SSOT)

**Ημερομηνία:** 2026-06-15 · **Μοντέλο:** Opus (perf hot path, ADR-040 critical, υψηλό regression risk) · **Domain:** DXF Viewer 2D canvas cursor/crosshair render pipeline

---

## 🚨 ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασε ΠΡΩΤΑ)
1. **Γλώσσα:** Απαντάς ΠΑΝΤΑ **Ελληνικά** στον Giorgio.
2. **COMMIT/PUSH τα κάνει Ο GIORGIO**, ΟΧΙ εσύ (CLAUDE.md N.(-1)). Ποτέ `--no-verify`.
3. **Shared working tree:** δουλεύει ΚΑΙ άλλος agent + υπάρχουν UNCOMMITTED → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `-A`.
4. **Στόχος Giorgio (ρητός, επαναλαμβανόμενος):** «όπως οι μεγάλοι παίχτες, όπως η Revit» → **FULL ENTERPRISE + FULL SSOT**. Καμία πρόχειρη λύση, κανένα hardcode, καμία διπλή υλοποίηση — επέκτεινε/επαναχρησιμοποίησε υπάρχοντα SSoT.
5. N.2/N.3/N.11: ΟΧΙ `any`/`as any`/`@ts-ignore`· ΟΧΙ JSX inline styles (⚠️ ΕΞΑΙΡΕΣΗ: imperative `style.transform`/`textContent` σε refs = αποδεκτό compositor perf pattern)· ΟΧΙ hardcoded strings. N.7.1: code files ≤500 γρ, functions ≤40 γρ.
6. **ADR-040 (micro-leaf) CRITICAL:** το Slice 2b αγγίζει τα perf-critical αρχεία (CrosshairOverlay κ.ά.). ΔΙΑΒΑΣΕ `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ αγγίξεις οτιδήποτε + STAGE το (pre-commit CHECK 6B/6C/6D BLOCK). Δες CLAUDE.md «DXF VIEWER ARCHITECTURE».
7. **N.0.1 ADR-driven:** Phase 1 Recognition (κώδικας=source of truth) → plan σε slices → **έγκριση Giorgio** → υλοποίηση → ADR-040 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY. **Profiler-verify (screenshot) μετά**.
8. **N.17 single-tsc:** ΠΟΤΕ 2 ταυτόχρονα tsc· έλεγξε πριν τρέξεις (`Get-CimInstance Win32_Process … '*tsc*'`).
9. **N.8 execution mode:** ο Giorgio έχει ήδη διαλέξει **Plan Mode** για αυτή τη δουλειά. Δήλωσε μοντέλο, φτιάξε plan, ζήτα έγκριση.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ
Στο `https://nestorconstruct.gr/dxf/viewer` (2Δ) ο κέρσορας/σταυρόνημα «καθυστερεί να ακούσει» — ορατό lag πίσω από το ποντίκι, με απλή κίνηση πάνω στον καμβά. **Στόχος:** Revit/AutoCAD-grade — κέρσορας 1:1, **Paint σε plain cursor-move ≈ 0**.

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ5 + Φ6 + Φ7 — ΟΛΑ UNCOMMITTED, δικά μου αρχεία)

### Φ5 (προηγούμενη συνεδρία) — pointer rect cache
`getPointerSnapshotFromElement` έκανε `getBoundingClientRect` (forced reflow) σε ΚΑΘΕ mousemove. FIX: NEW `rendering/core/pointer-rect-cache.ts` (`getCachedClientRect` — cache + invalidate σε ResizeObserver/scroll/resize/mousedown). Reflow έπεσε αλλά **ο Giorgio δεν είδε διαφορά** → ο πραγματικός ένοχος ήταν αλλού.

### Φ6 (αυτή η συνεδρία) — kill body-wide MutationObserver feedback loop ✅ ΕΠΙΒΕΒΑΙΩΜΕΝΟ
**Η ΑΙΤΙΑ #1:** `ui/components/CentralizedAutoSaveStatus.tsx` (×2 variants, mounted στο `SidebarSection`) είχε `MutationObserver` στο `document.body` με `{attributes:true, subtree:true, attributeFilter:['class','style']}`. Ο compositor crosshair γράφει `style.transform` σε **6-8 divs ΑΝΑ move** (attribute mutations) → ο observer πυροδοτούνταν **σε κάθε κίνηση** → `querySelectorAll('[class*="fixed"][class*="inset-0"]')` (profiler 3.8%) + `getComputedStyle()×N` (reflow ~4.3%) + `setIsModalOpen()` (React commit/move).
**FIX (FULL SSOT):** NEW `systems/modal/` — `modal-presence-detect.ts` (pure `detectOpenModal`), `ModalPresenceStore.ts` (zero-React singleton, ref-counted observer **`{childList:true, subtree:false}`** στο body → πυροδοτείται ΜΟΝΟ σε modal open/close· όλα τα modals κάνουν portal ως direct body children: Radix `Dialog.Portal` + `PromptDialog` `createPortal(_, document.body)`), `useModalPresence.ts` (hook). `CentralizedAutoSaveStatus` → `const isModalOpen = useModalPresence()`. **14 jest GREEN, tsc clean.**
**ΕΠΑΛΗΘΕΥΣΗ (React DevTools profile 14:49):** `CentralizedAutoSaveStatus` self-schedules = **0**. **ΕΠΑΛΗΘΕΥΣΗ (Firefox profile 15:21):** `querySelectorAll '.fixed.inset-0'` **εξαφανίστηκε** (ήταν 3.8%)· **Paint 29%→15%**· reflow 4.3%→2.3%.

### Φ7 (αυτή η συνεδρία) — debug overlay εκτός hot path ✅
**Η ΑΙΤΙΑ #2:** `debug/layout-debug/CoordinateDebugOverlay` (React DevTools profile: μοναδικός updater σε **20/108** commits, 22ms self) έκανε `window mousemove`→`setDisplayData` (10fps) → React commit/100ms → main-thread stalls → ο compositor crosshair κολλούσε περιοδικά. **Δύο root:** (α) **mis-wired gate** — όλο το layout-debug (CornerMarkers+LayoutMapper+CoordinateDebugOverlay) γινόταν mount μέσω `ENTERPRISE_SETTINGS_SHADOW_MODE` (=true) αντί του purpose-built **`LAYOUT_DEBUG_SYSTEM`** (=false) → έτρεχε σε ΟΛΟΥΣ, και σε prod· (β) debug tool με React commit per-move.
**FIX (FULL ENTERPRISE + FULL SSOT):** (i) `layout/FloatingPanelsSection.tsx:261` → `isFeatureEnabled('LAYOUT_DEBUG_SYSTEM')` (off-by-default). (ii) `CoordinateDebugOverlay` **zero-React rewrite** — ίδια compositor πατέντα με `CrosshairOverlay`: `subscribeToImmediatePosition`+`getImmediateWorldPosition`+`getImmediateTransform`/`subscribeTransform`, γράφει `textContent`/`transform` σε refs, μηδέν `useState`. crosshair με `translate3d`. rect μέσω Φ5 `getCachedClientRect`. (iii) NEW `coordinate-readout-format.ts` (pure SSoT formatting για display **και** clipboard) + `coordinate-clipboard-copy.ts` (F1-F4 διαβάζει SSoT). **11 jest GREEN, tsc clean.**

---

## 3. ΤΙ ΜΕΝΕΙ — Η ΔΟΥΛΕΙΑ ΣΟΥ (πρότεινε plan, ζήτα έγκριση)

Μετά Φ5/Φ6/Φ7, τα μολυσμένα σήματα (JSON.stringify 4.8%, performance.mark 3.1%, Radix Select cascade) είναι **React DevTools profiler overhead + DEV build** — ΟΧΙ app code (επιβεβαιωμένο: μηδέν `JSON.stringify` σε cursor/snap/hover paths). Τα **πραγματικά** εναπομείναντα:

### 🥇 Slice 2b-A: Crosshair Paint → ~0 (ΠΡΟΤΕΡΑΙΟΤΗΤΑ — ο αρχικός στόχος)
**Πραγματικό σήμα:** Paint **15%** σε ΟΛΑ τα profiles (browser-level, όχι artifact). DisplayList building κυριαρχεί.
**Αιτία:** ο Firefox ΔΕΝ κάνει off-main-thread τα **JS-driven** `style.transform` (μόνο CSS animations παίρνουν OMTA) → κάθε move ξαναχτίζει display-list για **6-8 promoted divs** (`CrosshairOverlay`: segLeft/Right/Top/Bottom + pickbox + aperture + badge).
**Κατεύθυνση των μεγάλων (επιβεβαίωσε με profiler subtree ΠΡΙΝ):**
- Συγχώνευση των 6-8 divs σε **ΕΝΑ promoted container** που κινείται με **ΕΝΑ** `transform` (1 display-list item αντί 8)· τα segments ως children με στατικό σχετικό layout μέσα του.
- `contain: strict` (ή `layout paint size`) + `isolation: isolate` στο container → η invalidation region να μην αγγίζει τη σκηνή.
- (Εξεταστέο) CSS custom-property + registered `@property` transform για πραγματικό OMTA — αλλά μέτρα πρώτα αν αρκεί η συγχώνευση layer.
- ΑΡΧΗ: ΕΝΑ SSoT θέσης (`ImmediatePositionStore`, υπάρχει), ΕΝΑ render path — ΜΗΝ προσθέσεις 2ο. ΜΗΝ επιστρέψεις τυφλά σε `<canvas>` (το Φ2 έφυγε ΑΠΟ canvas σε DOM επίτηδες).
- **Files:** `canvas-v2/overlays/CrosshairOverlay.tsx` (+ `crosshair-compositor-layout.ts`). **ADR-040-critical → STAGE ADR-040, CHECK 6B/6C/6D.**

### 🥈 Slice 2b-B: Εξάλειψη orchestrator re-renders σε cursor move
**Πραγματικό σήμα (React DevTools 14:49):** `CanvasSection` (11ms) + `CanvasLayerStack` (18ms) **re-render-άρουν σε κίνηση κέρσορα** — παραβίαση της ίδιας της αρχής ADR-040 (orchestrators ΠΟΤΕ per-move). Self-schedule μόλις 2/0 → τους τραβάει **context/parent** που αλλάζει per-move.
**Δουλειά:** βρες ΠΟΙΟΣ context provider/parent αλλάζει τιμή ανά move (grep `useContext`, context providers γύρω από CanvasSection· ύποπτο: hovered overlay/entity, transform, ή settings shadow). Push στο micro-leaf (καθαρή ADR-040 doctrine, όπως Phase E). **ADR-040-critical.**

### 🥉 Slice 2b-C (μικρό): Enterprise-settings shadow provider σε prod
`ENTERPRISE_SETTINGS_SHADOW_MODE: true` (hardcoded, `config/experimental-features.ts`) → ο «validate-in-parallel» settings provider τρέχει και σε prod. Επιβεβαίωσε αν προσθέτει per-render κόστος· αν ναι, gate σε dev. Χαμηλότερη βεβαιότητα.

---

## 4. PHASE 1 RECOGNITION (profiler-first, ΜΗΝ μαντέψεις)
1. Διάβασε ADR-040 (όλο το cursor-lag changelog Φ1-Φ7) + `CrosshairOverlay.tsx` + `crosshair-compositor-layout.ts`.
2. **ΖΗΤΑ από τον Giorgio ΚΑΘΑΡΟ profile:** **production build** (`npm run build && npm start`, ΟΧΙ dev), **ΜΟΝΟ Firefox profiler** (σταμάτα React DevTools recording — μολύνει με JSON/perf.mark), απλή κίνηση **πάνω στον καμβά** (όχι ribbon/panels). Δεξί-κλικ `Paint` → «Focus on subtree» + καρτέλα «Δείκτες». Στόχος: επιβεβαίωσε ότι το crosshair container είναι ο ένοχος του DisplayList building.
3. Πριν αγγίξεις: δήλωσε μοντέλο (N.14) + ξεκίνα από Slice 2b-A.

---

## 5. VERIFY
Firefox profiler (prod build, μόνο canvas cursor-move): **Paint/DisplayList → ≈0** (από 15%)· **υποκειμενικά** κέρσορας 1:1 χωρίς lag. Picking/snap ακριβή. 60fps. ADR-040 micro-leaf άθικτο (CHECK 6B/6C/6D). Functional: modal open→autosave badge z-index χαμηλώνει (Φ6)· `LAYOUT_DEBUG_SYSTEM:true`→debug overlay zero-React + F1-F4 copy (Φ7).

---

## 6. ΚΑΤΑΣΤΑΣΗ TREE / UNCOMMITTED (γιατί commit κάνει ο Giorgio)
Shared tree, UNCOMMITTED άλλων agents (ΜΗΝ τα αγγίξεις). **Δικά μου UNCOMMITTED (Φ5+Φ6+Φ7) — git add ΜΟΝΟ αυτά:**

**Φ5:** `rendering/core/pointer-rect-cache.ts` (NEW) + `__tests__/pointer-rect-cache.test.ts` (NEW)· `rendering/core/CoordinateTransforms.ts` (MOD).
**Φ6:** `systems/modal/modal-presence-detect.ts` (NEW)· `systems/modal/ModalPresenceStore.ts` (NEW)· `systems/modal/useModalPresence.ts` (NEW)· `systems/modal/__tests__/{modal-presence-detect,ModalPresenceStore}.test.ts` (NEW)· `ui/components/CentralizedAutoSaveStatus.tsx` (MOD).
**Φ7:** `debug/layout-debug/CoordinateDebugOverlay.tsx` (MOD)· `debug/layout-debug/coordinate-readout-format.ts` (NEW)· `debug/layout-debug/coordinate-clipboard-copy.ts` (NEW)· `debug/layout-debug/__tests__/coordinate-readout-format.test.ts` (NEW)· `layout/FloatingPanelsSection.tsx` (MOD).
**Docs (κοινά — git add ΜΟΝΟ αν δικά σου τα edits):** `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` (changelog Φ5/Φ6/Φ7)· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

**Tests:** Φ6 14 jest + Φ7 11 jest GREEN, tsc clean (όλα τα touched).

**ADR/refs:** ADR-040 (micro-leaf + cursor-lag changelog Φ1-Φ7).
**Key files Slice 2b:** `canvas-v2/overlays/{CrosshairOverlay.tsx, crosshair-compositor-layout.ts}`· `components/dxf-layout/{CanvasSection.tsx, CanvasLayerStack.tsx}`· `systems/cursor/{ImmediatePositionStore.ts, ImmediateTransformStore.ts}`· `rendering/core/UnifiedFrameScheduler.ts`.
**Reference profiles:** `Στιγμιότυπο οθόνης 2026-06-15 141413.jpg` (αρχικό: Paint 29%)· `...152108.jpg` (μετά Φ6/Φ7: Paint 15%, querySelectorAll gone)· `profiling-data.15-06-2026.14-49-42.json` (React DevTools: 108 commits, CoordinateDebugOverlay/Select updaters).
