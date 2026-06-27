# HANDOFF — ADR-532 Stage B5 (DxfViewerContent severance) + B4 (CanvasSection grips)

**Ημερομηνία:** 2026-06-25 · **ADR:** ADR-532 (επεκτείνει ADR-040 dual-access).
**Κατάσταση:** B0–B3 DONE+VERIFIED (65/65 jest, UNCOMMITTED). **B5 DONE (κώδικας, UNCOMMITTED 2026-06-25
— 🔴 browser-verify εκκρεμεί).** B4 (CanvasSection grips) ΑΚΟΜΑ PENDING — δες §3.
**Μοντέλο:** Opus. **Browser-incremental** (αλλαγή → React-DevTools profile → επόμενο βήμα). N.17: όχι full tsc.

---

## 0. ΓΙΑΤΙ ΧΩΡΙΣΤΟ HANDOFF (κρίσιμο)
Το B5 (να πάψει το `DxfViewerContent` να re-render-άρει στην επιλογή) είναι **all-or-nothing σε ~9 αρχεία**:
για να αφαιρεθεί η ΜΙΑ subscription (`useUniversalSelection()` γρ.~140) πρέπει **ταυτόχρονα** να
μετακινηθούν ΟΛΟΙ οι reactive consumers σε leaves/own-subs ΚΑΙ να μετατραπούν οι event-time σε store
reads. Μερική μετακίνηση = η subscription μένει = μηδέν perf win. **Κανένα βήμα δεν γίνεται jest-verify**
(render `DxfViewerContent`/`CanvasSection` σε jsdom τραβά Firestore/Firebase-auth → σκάει). Άρα **μόνο
browser** επαληθεύει — γι' αυτό browser-incremental, όχι blind one-shot.

---

## 1. SSoT ΕΡΓΑΛΕΙΑ (έτοιμα από Stage A/B0)
- `SelectedEntitiesStore` (module-stable, zero React): getters `getSelectedEntityIds()/getPrimaryId()/
  getMap()/getIdsByType()/...`· mutators `clearAll()/selectEntity()/clearByType()/replaceEntitySelection()`.
  **B0:** ο store εφαρμόζει μόνος του το legacy mirror (registered sink) → orchestrators mutate imperatively.
- Leaf hooks (`systems/selection/useSelectedEntities.ts`, exported από index): `useSelectedEntityIds()`,
  `usePrimarySelectedId()`, `useSelectionByType(type)`, `useIsSelected(id)`, `useSelectionCount()`.
- `useUniversalSelection()` = compat hook (subscribes version)· χρησιμοποίησέ το ΜΟΝΟ στα leaf hosts.

---

## 2. STAGE B5 — ΣΧΕΔΙΟ (consumer-by-consumer, ταξινομημένο)

### Reactive consumers → μετακίνηση subscription σε leaf/own-sub:
1. **Ribbon (μεγαλύτερο):** `DxfViewerTopBar.tsx` ΔΕΝ είναι 6B/6C/6D-protected → κάν' το να
   **self-subscribe**. Μετέφερε την κλήση `useDxfViewerRibbon({...})` ΜΕΣΑ στο TopBar (τώρα τρέχει στο
   `DxfViewerContent`, γρ.~311). Το TopBar καλεί `useUniversalSelection()` (ή `usePrimarySelectedId()`+
   `useSelectedEntityIds()`) → reactive `primarySelectedId`/`selectedEntityIds` για: (α) `useDxfViewerRibbon`
   (contextual trigger + 30+ bridges), (β) τα **28 PersistenceHosts** (όλα παίρνουν `primarySelectedId`).
   `DxfViewerContent` περνά στο TopBar μόνο τα non-selection inputs: `levelManager, activeTool,
   handleToolChange(wrapped), handleRibbonComingSoon, wrappedHandleAction, canUndo, canRedo, currentScene`.
   TopBar ΔΕΝ δέχεται πια `ribbonCommands/contextualTabs/activeContextualTrigger/primarySelectedId` ως props
   (τα υπολογίζει). ⚠️ Τα bridges μετακινούνται **μαζί** με το `useDxfViewerRibbon` → **ΔΕΝ** χρειάζονται
   Stage C migration (παίρνουν reactivity από το re-render του TopBar).
2. **Selection-driven effects → NEW `SelectionSideEffectsHost.tsx` leaf** (render null) που subscribe-άρει
   `useSelectedEntityIds()`+`usePrimarySelectedId()` και τρέχει τα 2 effects που είναι σήμερα στο
   `useDxfViewerEffects.ts`: (α) auto-expand levels-panel (γρ.~246, dep selectedEntityIds → `floatingRef.
   expandForSelection`), (β) auto-activate-layering (γρ.~277, dep primarySelectedId· το γρ.282
   `universalSelection.context.universalSelection.get(primary)` → `SelectedEntitiesStore.getMap().get(primary)`).
   Props: `floatingRef, currentScene, activeTool, handleToolChange`. `DxfViewerContent` το render-άρει.
3. **`SidebarSection.tsx`:** `primarySelectedId` prop (γρ.123→173 LevelPanel) → self-subscribe
   `usePrimarySelectedId()` μέσα στο SidebarSection· drop το prop από `DxfViewerContent`.
4. **`DxfViewerDialogs.tsx`:** `selectionIds` (γρ.69→186 `BimScheduleHost`) → self-subscribe
   `useSelectedEntityIds()`· drop το prop.

### Event-time consumers → store reads (ΔΕΝ χρειάζονται reactivity):
5. **`useDxfViewerCallbacks.ts`:** drop params `selectedEntityIds`+`universalSelection`. `wrappedHandleAction`
   (organism.*/dim.* → `[...SelectedEntitiesStore.getSelectedEntityIds()]`)· `handleRegionClick` →
   `SelectedEntitiesStore.selectEntity({id,type:'overlay'})`· `nudgeSelection`/`selectionIdSet` → store read
   at call time.
6. **`useDxfViewerEffects.ts`:** μετά τη μετακίνηση των 2 effects (→#2), drop params `selectedEntityIds`/
   `primarySelectedId`/`universalSelection`· το bus effect `dxf.highlightByIds` (γρ.~348) → store.
7. **`useLayerCommandShortcuts.ts`:** διάβασε `SelectedEntitiesStore.getSelectedEntityIds()` στον keydown
   (resolveTargetLayerIds)· drop `selectedEntityIds` param + από deps.
8. **`DxfViewerContent.tsx`:** drop `useUniversalSelection()` (γρ.140) + `selectedEntityIds` memo (194) +
   `primarySelectedId` (199). `wrappedHandleToolChange` → `SelectedEntitiesStore.clearAll()`. `useOverlayDrawing`
   `onOverlaySelect` → store. `wrappedState.selectedEntityIds` → **κράτησέ το** ως non-reactive store read
   (κανένας downstream reactive consumer δεν βρέθηκε σε MainContentSection/NormalView/FullscreenView· grep
   ξανά για σιγουριά πριν το αφήσεις).

### Σειρά (app μένει working μέχρι το τελευταίο βήμα):
Φτιάξε πρώτα όλα τα own-subs/hosts (#1–#4) + τις event-time μετατροπές (#5–#7) **ΕΝΩ** το `DxfViewerContent`
ακόμα subscribe-άρει (redundant αλλά working). **Τελευταίο** βήμα = #8 (drop L140) → flips το win.
Profile μετά το #8: `DxfViewerContent` ΟΧΙ updater σε κλικ-επιλογή.

### Verify B5 (browser):
React-DevTools: κλικ-επιλογή → `DxfViewerContent` ΟΧΙ updater (μόνο TopBar/SideEffectsHost/Sidebar/leaves).
Λειτουργικά: contextual tab αλλάζει· persistence-host properties φορτώνουν στην επιλογή· levels-panel
auto-expand· auto-layering σε overlay· LevelPanel highlight· BIM schedule dialog· Ctrl+Shift+I layer-isolate·
organism.* actions· nudge.

---

## 3. STAGE B4 — CanvasSection (ΧΩΡΙΣΤΟ, grip-architecture)
**ΓΙΑΤΙ ξεχωριστά:** το `selectedEntityIds` (CanvasSection γρ.139) είναι **load-bearing** — τροφοδοτεί
`useUnifiedGripInteraction({selectedEntityIds})` → `unified.gripStateForStack` → render των grips, και το
`unified` ταΐζει ~20 άλλα σημεία. Αν το CanvasSection πάψει να re-render-άρει στην επιλογή, **τα grips δεν
ζωγραφίζονται**. Σωστή λύση (ADR-040): μετακίνηση grip-computation + selection-render σε canvas leaf
(`canvas-layer-stack-leaves.tsx`, `useSelectedEntityIds()`) + getter-conversion ~10 hooks
(useModifyTools/useCanvasEditActions/useCanvasContextMenu/useEntityLayerCommands/buildEntityContextMenuProps).
6B-protected → stage ADR-040+ADR-532. CanvasSection self-subscribe σήμερα = legitimate (ζωγραφίζει grips)·
το severance είναι αφιερωμένο browser-incremental session.

---

## 4. ΚΑΝΟΝΕΣ
- Commit/push = Giorgio. Shared tree: read φρέσκο, μην αγγίξεις beam-column-cutback/ADR-458/529.
  ⚠️ 2026-06-27: HEAD προχώρησε (ADR-538/539/540/541, 3D/face-appearance άλλων agents) — **read φρέσκο**
  το CanvasSection/leaves πριν το B4 (γραμμές μπορεί να μετακινήθηκαν· το «γρ.139» είναι ενδεικτικό).
- 6D files (`DxfViewerContent`, `useDxfViewerEffects`, `useKeyboardShortcuts`) → stage ADR-532.
  TopBar/Sidebar/Dialogs/callbacks/ribbon = ΟΧΙ 6B/6D.
- Ενημέρωσε ADR-532 §3/§5/changelog (B5/B4) στο ίδιο commit.

---

## 5. PAN LAG — Phase XXII.B (διαγνωσμένο 2026-06-26, ΕΚΚΡΕΜΕΙ· ΞΕΧΩΡΙΣΤΟ από B4)
**Σύμπτωμα (Giorgio):** μεγάλο lag «χέρι–κέρσορας» στο pan, **παντού ακόμα & μικρό σχέδιο**.
**Ρίζα (τεκμηριωμένη):** ADR-040 **Phase XXII.B δεν υλοποιήθηκε**. Ο `CanvasLayerStackTransformBridge`
(sole `useTransformValue()` subscriber) περνά το `transform` ως **prop** στο `CanvasLayerStack` (Shell) →
σε **κάθε** pan/zoom frame re-render-άρει ΟΛΟΚΛΗΡΟ το canvas subtree (~20 children) → κορεσμός main
thread → ο compositor-driven crosshair (`CrosshairOverlay` translate3d) καθυστερεί.
**ΑΠΟΚΛΕΙΣΤΗΚΑΝ:** (α) ΟΧΙ από B5 (transform sub isolated σε leaf· τα selection subs δεν αγγίζουν
transform). (β) ΟΧΙ multiple-renders/frame (pan ήδη RAF-coalesced: `mouse-handler-move` γρ.~421-437,
1 setTransform/frame). (γ) bridge αμετάβλητο από 2026-05-27.
**ΑΝΟΙΧΤΟ ΕΡΩΤΗΜΑ (χρειάζεται React-DevTools Profiler κατά pan):** ένα Shell re-render σε ΜΙΚΡΟ σχέδιο
θα έπρεπε ~2-3ms, όχι ορατό lag → πιθανό **συγκεκριμένο child** με βαρύ sync work/frame (ύποπτα:
forced reflow `getBoundingClientRect()` στο `CanvasLayerStack` render path· `preview-canvas` dirty που
μπήκε 2026-06-21 στο `TRANSFORM_CANVAS_IDS`). Το profiling κρίνει: «μικρό στοχευμένο fix» vs «ολόκληρο
Phase XXII.B».
**ΛΥΣΗ:** Phase XXII.B — κάθε transform-dependent leaf (`GridUnderlayCanvas`/`DxfCanvasSubscriber`/
`SnapIndicatorSubscriber`/`PreviewCanvas`/overlays) self-subscribe `useTransformValue()` αντί prop →
ο Shell σταματά να re-render-άρει στο pan/zoom. **6B/6C-protected, 5+ leaves, browser-incremental** →
dedicated session (orchestrator-tier, approval N.8). **Πρώτα ζήτα profiling number από Giorgio.**
