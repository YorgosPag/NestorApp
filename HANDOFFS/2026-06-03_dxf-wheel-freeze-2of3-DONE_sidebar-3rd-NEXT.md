# HANDOFF — DXF wheel-zoom freeze: 2 από 3 root causes DONE · ΕΠΟΜΕΝΟ = #3 SidebarSection (+ LevelsSystem commits)

**Ημερομηνία:** 2026-06-03
**Συντάκτης:** Opus 4.8
**Γλώσσα:** Ελληνικά πάντα.
**Commit/push:** ΜΟΝΟ ο Giorgio (N.-1). ΠΟΤΕ ο agent.
**⚠️ SHARED working tree** με MEP/fixture-grips + railing agents → `git add` **μόνο specific αρχεία**, ΠΟΤΕ `-A`. ΜΗΝ αγγίξεις δικά τους αρχεία.
**⚠️ Pre-existing tsc error άλλου agent:** `hooks/grips/grip-parametric-commits.ts` (`mepFixtureGripKind`) — **ΜΗΝ το αγγίξεις**. Στα tsc checks: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v grip-parametric-commits`.

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ
«Η εφαρμογή κολλάει στο wheel-zoom (1-2 FPS)». Διάγνωση με React DevTools profiling (όχι εικασίες): export JSON → script ανάλυση re-render roots / subtree-size / shallowest-updater ανά commit. Κάθε wheel notch προκαλούσε re-render **2502 fibers** (ribbon + 34 Radix tooltips + sidebar) = forced reflow (`getElement.clientWidth` σε Popper) → freeze.

**Μέθοδος ανάλυσης (να την ξαναχρησιμοποιήσεις):** ο Giorgio εξάγει React DevTools Profiler JSON στο `C:\Users\user\Downloads\profiling-data.*.json`. Δομή: `dataForRoots[0].snapshots` = array of `[id,{displayName,children}]`· `commitData[i]` = `{fiberActualDurations:[[id,ms]], updaters:[{id}]}`. Χτίζεις name/parent maps, βρίσκεις re-render roots (rendered fibers με parent εκτός rendered), μετράς subtree size ανά root, ταξινομείς updaters κατά depth (shallowest = trigger). Τα scripts είναι inline στο transcript της προηγούμενης συνεδρίας.

---

## ✅ ΟΛΟΚΛΗΡΩΘΗΚΑΝ (pending commit από Giorgio, 🔴 browser verify)

### Root cause #1 — `CanvasProvider` dead `useState<transform>` (ADR-040 Phase XXII.B μέρος 1)
- **Αρχείο:** `src/subapps/dxf-viewer/contexts/CanvasContext.tsx`
- Ο `CanvasProvider` κρατούσε `transform` σε React `useState` που ενημερωνόταν σε ΚΑΘΕ wheel μέσω `setTransformInternal` — ΕΝΩ κανένας runtime consumer δεν διαβάζει τα volatile contexts (`useCanvasContext()`/`useCanvasTransformContext()` = όλα σχόλια/docs· readers χρησιμοποιούν `useTransformValue()`/`useTransformScale()`). Re-render root ΨΗΛΑ (πάνω από LevelsSystem/ToolbarsSystem/SelectionSystem) → 2502-fiber cascade.
- **Fix:** `setTransform` γράφει ΜΟΝΟ στο `updateImmediateTransform()` (SSoT). Αφαιρέθηκε το `useState`. Τα volatile contexts κρατήθηκαν με one-shot `getImmediateTransform()` snapshot (zero API breakage). Ήταν ήδη planned «dead weight pending Phase XXII.B» στο ADR-040.
- **Επιβεβαίωση:** profile #2 → ο CanvasProvider ΕΦΥΓΕ από updaters/roots.

### Root cause #2 — `useOverlayDrawing` subscribe-άρει σε scale ΣΤΟΝ ORCHESTRATOR
- **Αρχείο:** `src/subapps/dxf-viewer/hooks/useOverlayDrawing.ts`
- `DxfViewerContent.tsx:201` → `useOverlayDrawing(...)` → `useOverlayDrawing.ts:76` καλούσε `useTransformScale()` (`useSyncExternalStore`) **μέσα στο render scope του orchestrator** → `DxfViewerContent` (React.memo, εμφανίζεται ως "Anonymous") re-render-άρε **2486 fibers**/wheel. Καθαρή παραβίαση ADR-040 Cardinal Rule #1, καλυμμένη από τον #1.
- **Fix:** αφαιρέθηκε το `useTransformScale()`. Scale διαβάζεται **event-time** `getImmediateTransform().scale` (polygon-close check + `useSnapManager({scale})` prop). Το `useSnapManager` ήδη διαβάζει `scaleRef.current` event-time στο `findSnapPoint` → μηδέν λειτουργική απώλεια (μικρό non-reactive window μόνο σε pure-zoom-while-drawing-overlay = niche).
- **Επιβεβαίωση:** profile #3 → καθαρά wheel commits έπεσαν **2498 → 503 fibers**.

### Console-noise cleanup (από προηγούμενη φάση ίδιας συνεδρίας)
- `src/components/ui/navigation/base-tabs.tsx` — false-positive `[BaseTabs] children & tab.content both provided` (τυπωνόταν ~198×). Root: `content:null` + `children ?? null` (TabsOnlyTriggers) + έλεγχος `!== undefined`. Fix: `!= null` (loose). Διορθώνει 33 consumers. **SSoT αρχείο εκτός dxf-viewer** — αν συγκρουστεί με άλλον, είναι ασφαλές/απομονωμένο.
- `src/subapps/dxf-viewer/ui/FloatingPanelContainer.tsx` — αφαίρεση dead `_glog` block (`Date.now()` σε κάθε render, dead code).

### ADR ενημέρωση
- `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` — changelog entry «2026-06-02 Phase XXII.B (part 1)» με #1 + #2 (πλήρης διάγνωση). **CHECK 6B/6D: πρέπει να γίνει staged ΜΑΖΙ με τα CanvasContext/useOverlayDrawing στο ίδιο commit.**

**tsc:** 0 errors στα δικά μου αρχεία (εξαιρώντας το pre-existing grip-parametric-commits άλλου agent).

---

## 🎯 ΕΠΟΜΕΝΟ TASK (ΠΡΟΤΕΡΑΙΟΤΗΤΑ) — Root cause #3 + LevelsSystem

Profile #3 (`profiling-data.03-06-2026.02-03-41.json`) → «καλύτερα αλλά όχι καλά». Απομένουν 2 πηγές:

### #3 (ΣΙΓΟΥΡΟ, εντοπισμένο) — `SidebarSection` subscribe-άρει σε scale ψηλά
- **Αρχείο:** `src/subapps/dxf-viewer/layout/SidebarSection.tsx:103` → `const currentZoom = useCurrentZoom();`
- `useCurrentZoom` (`systems/zoom/ZoomStore.ts:28`) = `useTransformScale()` = `useSyncExternalStore`. Το `SidebarSection` είναι ΨΗΛΑ (τυλίγει `StandaloneStatusBar` + `ZoomDisplayLeaf` + ~426 fibers) → re-render-άρει **426 fibers/wheel** (root στα c18-c40, 20-66ms).
- **ΥΠΑΡΧΕΙ ΗΔΗ `ZoomDisplayLeaf`** (σωστός leaf subscriber, 1-fiber). Άρα το zoom% πρέπει να εμφανίζεται ΜΟΝΟ μέσω του leaf — το `SidebarSection` ΔΕΝ πρέπει να καλεί `useCurrentZoom()`.
- **Fix (πρότεινε):** αφαίρεσε το `useCurrentZoom()` από το `SidebarSection`. Δες πού χρησιμοποιείται το `currentZoom` (γρ 103) — αν είναι μόνο για display, μετακίνησέ το σε leaf (ή χρησιμοποίησε το υπάρχον `ZoomDisplayLeaf`). Αν περνιέται σε child, σπάσε το child σε δικό του leaf subscriber. **Ίδιο ADR-040 pattern με #1/#2.**

### LevelsSystem / CurrentLayerPicker / BimViewport3D — 2490-fiber commits (ΝΑ ΕΠΙΒΕΒΑΙΩΘΕΙ αν είναι wheel-related)
- Στο profile #3 εναλλάσσονται 503-fiber wheel commits με **2490-fiber commits** που έχουν updaters `LevelsSystem` και `Tooltip,CurrentLayerPicker,BimViewport3D`.
- **Πιθανώς ΟΧΙ wheel** (selection/level/3D changes — ο Giorgio ίσως άλλαζε επιλογή/όροφο κατά το recording). **ΠΡΩΤΑ επιβεβαίωσε** με νέο profile **ΜΟΝΟ wheel-zoom** (χωρίς άλλη αλληλεπίδραση): αν τα 2490-fiber commits εξαφανιστούν → ήταν irrelevant. Αν παραμένουν σε καθαρό wheel → υπάρχει #4 (ψάξε `LevelsSystem` / `useUniversalSelection` για transform subscription ή για re-render σε zoom).

**Στόχος:** καθαρό wheel commit = μόνο leaf subscribers (`ZoomDisplayLeaf`, `StandaloneStatusBar`, `CoordinateDebugOverlay`, `CanvasLayerStackTransformBridge`, `OriginMarkerIcon`) ≈ <30 fibers. Τότε 60 FPS.

---

## 📂 ΑΡΧΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ (staging από Giorgio — `git add` ΜΟΝΟ αυτά)
1. `src/subapps/dxf-viewer/contexts/CanvasContext.tsx` — #1
2. `src/subapps/dxf-viewer/hooks/useOverlayDrawing.ts` — #2
3. `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` — changelog (ίδιο commit, CHECK 6B/6D)
4. `src/components/ui/navigation/base-tabs.tsx` — θόρυβος ×198
5. `src/subapps/dxf-viewer/ui/FloatingPanelContainer.tsx` — dead code

## 🔴 BROWSER VERIFY
Μετά **Ctrl+Shift+R** (hard reload — το Turbopack HMR κρατά παλιά modules· το προηγούμενο profile #2 ήταν αρχικά μερικώς stale): wheel-zoom + νέο React DevTools profile. Με τον #1+#2: wheel commits ~503 fibers (από 2502). Με τον #3: στόχος <30 fibers.

---

## ✅ UPDATE 2026-06-03 (Opus 4.8) — Root cause #3 DONE (pending commit, 🔴 browser verify)

### #3 SidebarSection — ΔΙΟΡΘΩΘΗΚΕ
- **Επιβεβαίωση από profile #3 (`profiling-data.03-06-2026.02-03-41.json`, 60 commits):** τα **503-fiber wheel commits** (12×) είχαν shallowest updaters `SidebarSection, StandaloneStatusBar, CanvasLayerStackTransformBridge, CoordinateDebugOverlay, ZoomDisplayLeaf` → ο `SidebarSection` ΗΤΑΝ όντως wheel re-render root (όπως προβλέφθηκε).
- **Fix:** αφαιρέθηκε το `useCurrentZoom()` από το σώμα του orchestrator. Το zoom% του footer μετακινήθηκε σε νέο 1-fiber micro-leaf **`SidebarZoomLeaf`** (μόνος subscriber). 
- **Boy-Scout (N.0.2):** το `currentZoom` περνούσε ΚΑΙ ως `zoomLevel` prop → `FloatingPanelContainer` → `usePanelDescription` → `{description, zoomText}` **που ΔΕΝ εμφανίζονται πουθενά** (dead, το status bar είχε μετακινηθεί). Αφαιρέθηκε όλη η dead αλυσίδα: `zoomLevel` prop (interface+destructure+memo comparator), η κλήση `usePanelDescription` + τα orphaned `useOverlayManager()`/`selectedRegions`/`visibleRegions`, και **διαγράφηκε** το `ui/hooks/usePanelDescription.ts`.
- **tsc:** 0 errors (εξαιρώντας grip-parametric-commits άλλου agent). 

### LevelsSystem 2490-fiber commits = ΟΧΙ wheel (επιβεβαιωμένο από ανάλυση profile #3)
- 16/60 commits ~2490 fibers με shallowest updater **`LevelsSystem`** (μόνο του, ή με `CurrentLayerPicker`/`BimViewport3D`/`PropertiesPalette`/`Select`/`ThermalEnvelopeHost`). **Κανένα δεν περιέχει transform leaf** → είναι level/layer/selection-driven (ο Giorgio άλλαζε επιλογή/layer κατά το recording), ΟΧΙ wheel. Δεν υπάρχει ένδειξη για #4 από wheel.
- **🔴 ΑΠΑΙΤΕΙΤΑΙ wheel-only profile** μετά τον #3 για 100% επιβεβαίωση: hard reload (Ctrl+Shift+R) → ΜΟΝΟ wheel-zoom (καμία άλλη αλληλεπίδραση) → record. Αναμενόμενο καθαρό wheel commit = μόνο leaves (`SidebarZoomLeaf`, `StandaloneStatusBar`, `CanvasLayerStackTransformBridge`, `CoordinateDebugOverlay`, `ZoomDisplayLeaf`) ≈ <30 fibers. Αν εμφανιστεί `LevelsSystem` σε καθαρό wheel → υπάρχει #4.

### Αρχεία αυτού του update (staging από Giorgio — `git add` ΜΟΝΟ αυτά)
6. `src/subapps/dxf-viewer/layout/SidebarSection.tsx` — #3 + leaf
7. `src/subapps/dxf-viewer/ui/FloatingPanelContainer.tsx` — αφαίρεση dead `zoomLevel` chain
8. `src/subapps/dxf-viewer/ui/hooks/usePanelDescription.ts` — **ΔΙΑΓΡΑΦΗ** (dead)
9. `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` — changelog #3 (ίδιο commit)

---

## 📝 ΣΗΜΕΙΩΣΕΙΣ
- Phase XXII.B **μέρος 2** (μη-ξεκινημένο, ξεχωριστό): `dxf-bitmap-cache.ts` CSS-transform live-zoom + idle re-raster (Figma pattern) — δες ADR-040 §Phase XXII.A/B.
- ΜΗΝ αγγίξεις: railing (ADR-407), MEP/fixture-grips/electrical-panel (ADR-406/408).
