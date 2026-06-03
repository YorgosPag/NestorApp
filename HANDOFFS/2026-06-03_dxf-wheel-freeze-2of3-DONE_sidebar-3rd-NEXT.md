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

## ✅✅ UPDATE 2026-06-03 #2 — wheel-only profile ΕΠΙΒΕΒΑΙΩΣΕ #3 + αποκάλυψε ΞΕΧΩΡΙΣΤΟ loop

**Profile `profiling-data.03-06-2026.02-28-17.json` (49 commits, wheel-only recording, μετά Ctrl+Shift+R).** Χρονική ανάλυση (script `seq-profile.mjs`):

### ✅ WHEEL-ZOOM ΚΑΘΑΡΟ — #1+#2+#3 ΔΟΥΛΕΥΟΥΝ
- Commits **15-30** (η συνεχόμενη ριπή wheel) = **78 fibers / 15-65ms**, signature `SidebarZoomLeaf, StandaloneStatusBar, CanvasLayerStackTransformBridge, CoordinateDebugOverlay, ZoomDisplayLeaf`. **Μηδέν `LevelsSystem`, μηδέν `SidebarSection`.** Πορεία: 2502 → 2486 → 503 → **78 fibers**/notch. **Δεν υπάρχει wheel-triggered #4.**

### ⚠️ ΝΕΟ ΕΥΡΗΜΑ — `LevelsSystem` 2490-fiber cascade (ΟΧΙ wheel)
- 14 commits ~**2490 fibers, 2-4 ΔΕΥΤΕΡΟΛΕΠΤΑ** το καθένα, updater `LevelsSystem`. Εμφανίζονται **ΠΡΙΝ** (0-14) και **ΜΕΤΑ** (31-48) τη ριπή wheel — **ΠΟΤΕ κατά** το wheel (1501-1677ms). Άρα ΟΧΙ wheel-triggered.
- **Quartet pattern** επαναλαμβανόμενο ~7×: A=`LevelsSystem` μόνο (2490) → B=`LevelsSystem`+ThermalEnvelopeHost+...+CurrentLayerPicker+PropertiesPalette+BimViewport3D+Select (2490) → C=ThermalEnvelopeHost+selection (123) → D=`EnvelopeOverlay`,Tooltip (10). Μυρίζει **render→effect→setState loop** ψηλά (LevelsSystem context Provider + BIM envelope + selection/properties).
- **Πηγή προς διερεύνηση:** ένα hook μέσα στο `useLevelsSystemState` (`systems/levels/LevelsSystem.tsx`) κάνει setState επαναλαμβανόμενα → σπάει το memoized context `value` → cascade σε όλους τους consumers. `useSceneManager`/`useAutoSaveSceneManager` ΑΠΟΚΛΕΙΣΤΗΚΑΝ (σταθερά σε ηρεμία). Ύποπτα: `useLevelsFirestoreSync`, `useLevelSceneLoader`, `useLevelFloorplanSync`, ή envelope/selection feedback (`ThermalEnvelopeHost`/`EnvelopeOverlay`).
- **❓ ΑΝΟΙΧΤΟ:** χρειάζεται επιβεβαίωση αν στο recording ο Giorgio ήταν idle (→ catastrophic idle loop) ή έκανε selection/layer changes (→ ακριβό selection re-render). Οι B/C commits περιέχουν `Select`/`CurrentLayerPicker`/`PropertiesPalette` → πιθανώς selection-related.

---

## 🔬 UPDATE 2026-06-03 #3 — LevelsSystem idle loop: διερεύνηση (driver ΑΝΑΠΟΔΕΙΚΤΟΣ στατικά, amplifiers ΕΝΤΟΠΙΣΜΕΝΟΙ)

**Giorgio επιβεβαίωσε: ΗΤΑΝ εντελώς idle στο recording.** Άρα τα 2490-fiber/~250ms commits = **catastrophic idle render loop** (το πραγματικό freeze). 3 παράλληλοι Explore agents + manual reads.

### ✅ ΑΠΟΚΛΕΙΣΤΗΚΑΝ (συγκλίνουν, ΔΕΝ είναι ο driver)
- **Και τα 10 BIM persistence hooks** (wall/column/beam/slab/opening/slab-opening/railing/mep-fixture/electrical-panel/stair): όλα έχουν `if (mutated)` + `dequal` guard → setLevelScene μόνο σε πραγματικό diff.
- **`useMepConnectorReconciliation`**: `reconcileEntityConnectors` ΟΝΤΩΣ idempotent (ίδιο ref όταν δεν αλλάζει) → συγκλίνει.
- **`useSceneManager`/`useAutoSaveSceneManager`**: σταθερά σε ηρεμία. **`useLevelSceneLoader`**: όλα τα paths με guards. **`useLevelFloorplanSync`/`useLevelOperations`/`useImportWizard`**: event/action-driven, μηδέν idle setState.
- **`resyncBimScene`/`use-bim3d-vg-resync`**: μόνο Three.js writes, ΔΕΝ γράφουν React state.

### ⚠️ AMPLIFIERS (πραγματικά bugs — πολλαπλασιάζουν το κόστος ΑΝΑ render, ΟΧΙ ο driver)
Missing equality guards που κάνουν ΚΑΘΕ render να προκαλεί store-churn + **πλήρες 3D rebuild**:
1. `app/SlabPersistenceHost.tsx:60-63` — `setSlabs(currentScene.entities.filter(...))` = νέο array πάντα· `Bim3DEntitiesStore.setSlabs` χωρίς guard → Zustand notify. (Ίδιο pattern σε Wall/Column/Beam hosts.)
2. `hooks/data/useEnvelopeFloorSlabs.ts:180-192` — `snapshot` useMemo πάντα νέο object → `useEffect([snapshot]) → setEnvelopeFloorSlabs`.
3. `bim/stores/envelope-floor-slabs-store.ts:~46` — `setEnvelopeFloorSlabs` μόνο `===` guard (όχι deep-equal) → notify πάντα → `use-bim3d-vg-resync` subscribeEnvelopeFloorSlabs → `resyncBimScene` (ΠΛΗΡΗΣ 3D rebuild) σε κάθε χτύπημα → εξηγεί `BimViewport3D` στο cascade.
4. `components/dxf-layout/EnvelopeOverlay.tsx:~125` — inline `getSnapshot` arrow στο `useSyncExternalStore`.

### ❓ ΑΝΑΠΟΔΕΙΚΤΟΣ DRIVER
Ο profiler λέει updater = `LevelsSystem` fiber (id 1713), συχνά ΜΟΝΟ αυτός → ένα setState που ανήκει στο `useLevelsSystemState` χτυπά κάθε ~250ms. **Δεν εντοπίστηκε στατικά.** Agent #2 υπέθεσε `useLevelsFirestoreSync` setLevels μέσω Firestore re-delivery, αλλά ο service-layer `dequal` guard θα έπρεπε να μπλοκάρει idle metadata snapshots — αναπόδεικτο.

**ΟΡΙΣΤΙΚΟ ΕΠΟΜΕΝΟ ΒΗΜΑ:** re-record profile ΜΕ React DevTools Profiler setting **«Record why each component rendered»** ON (gear icon στο Profiler tab). Τότε το `changeDescriptions` ανά commit θα δείξει ΑΚΡΙΒΩΣ ποιο hook/state/context άλλαξε στο `LevelsSystem` → μηδέν μαντεψιά πριν αγγίξω levels/envelope (shared tree). Εναλλακτικά: temporary console instrumentation στο `useLevelsSystemState`.

---

## 🔴 UPDATE 2026-06-03 #4 — idle console flood = `HomeRunWiresOverlay` (ADR-408 Φ7) on 0×0 viewport

**Console instrumentation (Giorgio idle):** το console πλημμύρισε από `[WARN] [CoordinateTransforms] worldToScreen: Invalid viewport dimensions {"viewport":{"width":0,"height":0}}` — stack: `HomeRunWiresOverlay.tsx:130` → `drawCircuitWires` → `MepWireRenderer.ts:36` → `worldToScreen`, πολλές φορές/δευτ. σε ηρεμία. FPS έπεσε σε 30, μνήμη 406MB. Τα `[LevelsLoop]` info-logs πνίγηκαν (83 στο 1ο load = το LevelsSystem context value ΟΝΤΩΣ αλλάζει, αλλά δεν φάνηκε το key λόγω flood).

**Μηχανισμός:** `CanvasLayerStack.tsx:469` περνά `viewport={width:0,height:0}` σε ηρεμία· το effect του overlay (deps `[scene, transform, viewport, systems, visible, gripDragPreview]`) ξανατρέχει σε ΚΑΘΕ render της CanvasLayerStack, ΧΩΡΙΣ guard για άκυρο viewport → ακριβό `computeCircuitWirePaths`+`drawCircuitWires` σε 0×0 canvas (μηδέν pixels) + flood. **Θύμα** (effect-only, κανένα setState — δεν είναι ο driver), αλλά μεγάλος amplifier + θόρυβος.

**FIX (εφαρμόστηκε, pending commit):** `components/dxf-layout/HomeRunWiresOverlay.tsx` — guard `if (viewport.width <= 0 || viewport.height <= 0) return;` πριν το compute/draw. Σταματά flood+σπατάλη, ΞΕΜΠΛΟΚΑΡΕΙ το diagnosis. ⚠️ ADR-040-critical + ADR-408 file → **stage ADR-040** (CHECK 6B/6D) + ADR-408 changelog στο ίδιο commit. ⚠️ shared tree με MEP agent.

**🔴 ΕΠΟΜΕΝΟ:** Ctrl+Shift+R → idle ξανά → τώρα το console ΔΕΝ πλημμυρίζει → φίλτρο `LevelsLoop` → δες ποιο key (levels / sceneManager.levelScenes / κλπ) επαναλαμβάνεται = ο root driver του 2490-fiber loop. (Το instrumentation στο `LevelsSystem.tsx` παραμένει — αφαίρεσέ το μετά.)

---

## ✅✅✅ UPDATE 2026-06-03 #5 — ROOT CAUSE idle 2490-fiber loop ΒΡΕΘΗΚΕ (MEP ping-pong via setLevelScene)

**Console instrumentation (idle, Giorgio):**
- `[LevelsLoop]` steady-state (#5+): αλλάζει ΜΟΝΟ `sceneManager, sceneManager.levelScenes` → καθαρός **`setLevelScene` loop** (όχι levels/systems).
- `setLevelScene` stack trace: **εναλλάσσεται** μεταξύ ΔΥΟ writers:
  - **odd:** `useMepFixturePersistence` Firestore `onSnapshot` → `setLevelScene` (1189 entities).
  - **even:** `useMepSystemPersistence` `onSnapshot` → `setSystems` → `useMepSystemStore` notify → **`useMepConnectorReconciliation.reconcile`** → `setLevelScene`.

**ΜΗΧΑΝΙΣΜΟΣ (κλειστός κύκλος, ~4×/δευτ, 2490 fibers/κύκλο):**
```
setLevelScene → levelScenes νέο identity → LevelsSystem context value νέο identity
  → levelManager prop (στα *PersistenceHost) νέο identity
  → MEP Firestore subscription effects ΞΑΝΑ-subscribe (unstable deps: levelManager/callback)
  → Firestore re-delivers cached snapshot (νέο docs array)
  → fixture-persistence γράφει scene (connector.systemId = persisted/stale)
     ↕ ping-pong
  → reconciliation ξανα-derive-άρει connector.systemId → setLevelScene
  → ∞
```
Τα δύο writers **ακυρώνουν το ένα το άλλο**: το fixture-persistence γράφει το persisted `connector.systemId`, το reconciliation το ξανα-υπολογίζει (System-wins) → κάθε ένα invalidate-άρει τον άλλο, και κάθε scene write προκαλεί re-subscribe→re-deliver→νέο write. **ΟΛΑ ADR-408 (Φ5 reconciliation + Φ6 system-persistence + fixture-persistence) — νέος κώδικας αυτής της σειράς συνεδριών.**

### 🎯 FIX PLAN (ADR-408 territory — shared tree με MEP agent· ΔΕΝ το άγγιξα, context 🔴)
Χρειάζεται ≥1 από τα (ιδανικά όλα, defense-in-depth):
1. **Σταμάτα το re-subscribe-κάθε-render:** τα `useMepFixturePersistence` + `useMepSystemPersistence` (+ τα *PersistenceHost) πρέπει να subscribe-άρουν στο Firestore **ΜΙΑ φορά** — `levelManager` via `useRef` (stable), όχι στα effect deps. (Δες πώς το κάνουν τα wall/column persistence — αυτά ΔΕΝ loop-άρουν.) Αυτός είναι ο **κινητήρας**.
2. **Idempotent `setSystems`** στο `mep-system-store`: bail αν deep-equal (ή skip delivery αν unchanged) → κόβει το systems→reconcile→scene path σε identical re-delivery.
3. **Σπάσε το ping-pong:** fixture-persistence merge να **διατηρεί** το reconciled `connector.systemId` (ή να ΜΗΝ persist-άρει το derived cache καθόλου — είναι derived, System-wins), ώστε reconciliation & persistence να μην αναιρούν το ένα το άλλο.

**Αρχεία:** `hooks/data/useMepFixturePersistence.ts`, `hooks/data/useMepConnectorReconciliation.ts`, `bim/mep-systems/mep-system-store.ts` (+ το system-persistence hook/host), και τα `app/*PersistenceHost` που περνούν `levelManager`. tsc + 124 MEP tests μετά. STAGE κατάλληλα ADRs.

### 🧹 Καθαρισμός instrumentation (ΕΓΙΝΕ)
Αφαιρέθηκαν: temp diagnostic στο `LevelsSystem.tsx` + temp `new Error().stack` trace στο `useSceneManager.ts`. ✅ Καθαρά.

---

## ✅✅✅ UPDATE 2026-06-03 #6 — FIX ΥΛΟΠΟΙΗΘΗΚΕ (Opus 4.8, Plan Mode) — pending commit, 🔴 browser verify

Επιβεβαίωσα στον κώδικα (όχι μόνο handoff) την **ακριβή ακμή**: `useMepFixturePersistence` γρ.178 `dequal(existing.params, doc.params)` — το reconciled scene fixture έχει `connector.systemId`, το Firestore doc ΟΧΙ (type contract `mep-connector-types.ts:81-85`: derived, never truth) → ≠ → `docToEntity` σβήνει το systemId → `setLevelScene`· reconciliation το ξανα-σφραγίζει → ∞. **Κρίσιμο εύρημα Explore agent:** ΟΛΑ τα persistence hooks έχουν ίδιο `[levelManager,...]` dep array — ο τοίχος ΔΕΝ loop-άρει επειδή ΔΕΝ έχει derived-field divergence (ο `mutated`/`dequal` guard δουλεύει σωστά). Άρα το πρόβλημα είναι **data divergence, ΟΧΙ subscription pattern**.

**Απόκλιση από το #5 FIX PLAN (τεκμηριωμένη):**
- **#3 (root cause) = ΥΛΟΠΟΙΗΘΗΚΕ** ως ο χειρουργικός fix. NEW pure SSoT `projectConnectorSystemIds(fresh, live)` στον `mep-system-coordinator` (συμμετρικός του `reconcileEntityConnectors`, οδηγείται από LIVE scene cache, αγνοεί τελείως το doc's systemId, referential-stable) — καλείται στο diff-merge fixture + **panel** persistence ΠΡΙΝ το `dequal` → echo no-op → loop σπάει. Καλύπτει ΚΑΙ τη δεύτερη ακμή (stale persisted systemId).
- **#2 (defense) = ΥΛΟΠΟΙΗΘΗΚΕ.** Idempotent `setSystems` (`dequal` bail — `docToSystemEntity` φτιάχνει fresh refs άρα ref-equality δεν αρκεί).
- **#1 (re-subscribe via useRef) = ΔΕΝ έγινε σκόπιμα.** Είναι κοινό σε ΟΛΑ τα hooks (ο τοίχος αποδεικνύει ότι είναι αβλαβές όταν ο guard δουλεύει)· αλλαγή του canonical pattern μόνο στο MEP = SSoT divergence + ρίσκο. Out-of-scope pre-existing ADR-040 χαρακτηριστικό.

**Αρχεία (5):** `mep-system-coordinator.ts` (+helper+7 tests) · `useMepFixturePersistence.ts` · `useElectricalPanelPersistence.ts` · `mep-system-store.ts` · coordinator test. **66 MEP PASS, tsc 0.** ΟΧΙ ADR-040 staging (κανένα micro-leaf). STAGE: ADR-408 doc. ⚠️ shared tree — `git add` ΜΟΝΟ αυτά, ΠΟΤΕ -A. ⚠️ ΜΗΝ πειράξεις `useMepConnectorReconciliation.ts` (αμετάβλητο — ο reconciler ήταν σωστός, το πρόβλημα ήταν στην persistence side).

**🔴 VERIFY (Giorgio):** re-record idle με «why did this render» → αναμενόμενο: **μηδέν** `[setLevelScene]`/`[LevelsLoop]` σε ηρεμία, idle commit ≈ leaf-only (~2490 → δεκάδες). Φόρτωσε σχέδιο με fixtures ανατεθειμένα σε circuit, μείνε idle → ο loop σταμάτησε· μετά move/assign fixture → systemId σωστό, ένα καθαρό write.

---

## 📝 ΣΗΜΕΙΩΣΕΙΣ
- Phase XXII.B **μέρος 2** (μη-ξεκινημένο, ξεχωριστό): `dxf-bitmap-cache.ts` CSS-transform live-zoom + idle re-raster (Figma pattern) — δες ADR-040 §Phase XXII.A/B.
- ΜΗΝ αγγίξεις: railing (ADR-407), MEP/fixture-grips/electrical-panel (ADR-406/408).
