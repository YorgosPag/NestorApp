# HANDOFF — Selection-store ADR-532: Stage B (orchestrators) + Stage C (retire legacy)

**Ημερομηνία:** 2026-06-25
**ADR:** ADR-532 (selection-set SSoT)· επεκτείνει ADR-040 (dual-access micro-leaf invariant).
**Προτεινόμενο μοντέλο:** Opus (cross-cutting perf, Orchestrator-tier). **Plan Mode για Stage B.**
**Εγκεκριμένο εύρος (Giorgio):** A+B+C — full enterprise + full SSoT, Revit-grade. Μία πηγή αλήθειας.

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ
1. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — όχι ο agent. Ετοίμασε (`git add` ΜΟΝΟ δικά σου αρχεία, ποτέ `-A`), σταμάτα, ανέφερε.
2. **Shared working tree** — άλλος agent δουλεύει ταυτόχρονα. **Διάβασε ΦΡΕΣΚΟ πριν κάθε Edit** (οι γραμμές παρακάτω ίσως έχουν μετακινηθεί). Υπάρχουν ξένα uncommitted (beam-column-cutback, ADR-458/529) — **ΜΗΝ τα αγγίξεις**.
3. **N.17 single-tsc** — full `tsc --noEmit` κάνει **OOM**. Βασίσου σε **jest (ts-jest per-file compile)** + targeted, ΟΧΙ full tsc.
4. **SSoT AUDIT ΜΕ GREP ΠΡΙΝ ΚΩΔΙΚΑ (Giorgio, ρητό)** — ψάξε υπάρχοντα κώδικα/helpers ΠΡΙΝ γράψεις. Reuse, μη διπλότυπο. Δες §6.
5. **CHECK 6B/6D** — `CanvasSection.tsx` είναι 6B-protected, και drawing/effects files 6D-protected → **stage ADR-040 + ADR-532** μαζί με τα edits αλλιώς ο pre-commit hook μπλοκάρει.
6. **ADR-driven (N.0.1)** — ενημέρωσε ADR-532 changelog (Stage B/C) στο ίδιο commit.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ — Stage A (✅ COMMITTED από Giorgio)

Zero-React `SelectedEntitiesStore` = **ο μοναδικός SSoT** για το entity selection set (Map + primary). Behavior-identical (κανένα perf win ακόμα — σκόπιμα η βάση). **67 jest GREEN** (22 store/hooks + 45 selection-suite).

**Διαθέσιμο API (χρησιμοποίησέ το στο Stage B):**
- `systems/selection/SelectedEntitiesStore.ts` — **imperative getters** (για orchestrators, event-time, ΧΩΡΙΣ subscription): `getSelectedEntityIds()`, `getPrimaryId()`, `isSelected(id)`, `getIdsByType(type)`, `getOverlayRegionIds()`, `getByType(type)`, `getEntries()`, `getIds()`, `count()`, `countByType(type)`, `getMap()`. **mutators** (preserve internal Map+primary): `selectEntity/selectEntities/addEntity/addEntities/deselectEntity/toggleEntity/clearAll/clearByType/replaceEntitySelection` — **κάθε mutator επιστρέφει `LegacyMirror`**.
- `systems/selection/useSelectedEntities.ts` — **leaf hooks** (ΜΟΝΟ για leaves που δείχνουν επιλογή): `useSelectedEntityIds()`, `usePrimarySelectedId()`, `useIsSelected(id)`, `useSelectionByType(type)`, `useSelectionCount()`. Όλα reference/value-stable snapshots.
- Exports και από `systems/selection/index.ts`.
- `useUniversalSelection()` (compat) τώρα subscribe-άρει στο store **version** → consumers re-render όπως πριν. **Στο Stage B οι orchestrators ΦΕΥΓΟΥΝ από αυτό** → imperative getters + leaf subs.

**⚠️ ΚΡΙΣΙΜΟ — legacy mirror & mutations:** το legacy `selectedRegionIds` (overlay-only projection) + το reset των `editingRegionId`/`draggedVertexIndex` τα συγχρονίζει το **`useSelectionActions` wrapper** μέσω **ΕΝΟΣ** dispatch `SYNC_UNIVERSAL_LEGACY` (ΟΧΙ ο store· ο store δεν έχει dispatch). Άρα:
- **Καλώντας `SelectedEntitiesStore.<mutator>()` ΑΠΕΥΘΕΙΑΣ → ΠΑΡΑΚΑΜΠΤΕΙ το legacy mirror** (selectedRegionIds δεν ενημερώνεται). Μόνη ασφαλής απευθείας κλήση σήμερα: `replaceEntitySelection` (επιστρέφει NO_MIRROR — μόνο dxf).
- Για mutations που αγγίζουν overlay/region ή clearAll, οι orchestrators **πρέπει** να καλούν τις action functions (compat hook ή context wrappers) **ή** να λυθεί το design (§2 Decision).

---

## 2. STAGE B — ΣΤΟΧΟΣ + ΑΡΧΕΙΑ (πιάνει το ~122ms)

**Στόχος:** η αλλαγή επιλογής να ΜΗΝ re-render-άρει orchestrators — μόνο leaves. Οι 4 orchestrators σταματούν να καλούν `useUniversalSelection()` (που subscribe-άρει), διαβάζουν imperatively από τον store, και τα children-leaves subscribe.

### Διάγνωση (React DevTools): baseline ~122ms commit ανά κλικ-επιλογή. **Κάνε capture baseline ΠΡΙΝ αλλάξεις** για σύγκριση.

### Στόχοι (re-grep για φρέσκες γραμμές — shared tree):
- **`app/DxfViewerContent.tsx`** (~γρ.140) — `const universalSelection = useUniversalSelection()`· `selectedEntityIds = useMemo(()=>universalSelection.getSelectedEntityIds(),[universalSelection])` (~194)· `primarySelectedId = universalSelection.getPrimaryId()` (~199)· `wrappedHandleToolChange` (~148-153). Περνά selectedEntityIds σε: useDxfViewerCallbacks, useDxfViewerEffects, useKeyboardShortcuts, useLayerCommandShortcuts, useDxfViewerRibbon→`useActiveContextualTrigger`, `DxfViewerDialogs` (selectionIds). **Σχέδιο:** drop subscription· event-time/callbacks → imperative `SelectedEntitiesStore.getX()`· reactive selectedEntityIds/primaryId → push σε μικρά leaves ή σε hooks που τα χρειάζονται reactively.
- **`app/useDxfViewerEffects.ts`** (~277-288 auto-activate-layering· ~282 raw `universalSelection.context.universalSelection.get(primary)` — δουλεύει μέσω live getter· ~347-358 bus effect) → `usePrimarySelectedId()` σε leaf + imperative map read.
- **`components/dxf-layout/CanvasSection.tsx`** (~126 `useUniversalSelection`· ~131-134 `universalSelectionRef.current=...`· ~139 selectedEntityIds memo· ~189 `useUnifiedGripInteraction`· ~251-256 `useOverlayLayers({isSelected: universalSelection.isSelected})`). **6B-protected.** → refs/getters στον store· το reactive `selectedEntityIds` → `useSelectedEntityIds()` ή push στο selection-drawing canvas leaf.
- **`layout/FloatingPanelsSection.tsx`** (~131 `useUniversalSelection`· ~134 `getIdsByType('overlay')[0]`· ~141-146 effect· ~236 `getByType('overlay').length`) → `useSelectionByType('overlay')` (re-render μόνο σε overlay change, ΟΧΙ σε dxf clicks).
- **`hooks/useKeyboardShortcuts.ts`** (~79 `useUniversalSelection`) → drop subscription· store mutators (μέσω actions, βλ. §2 Decision) στον keydown handler· διάβασε ids imperatively.
- **`app/ribbon-contextual-config.ts`** `useActiveContextualTrigger` (~149-334· loops ~180-189/196-206/221-231) — **O(selectedIds × scene.entities)** μέσω `currentScene.entities.find()`. **FIX:** build `Map<id,entity>` once (`useMemo([currentScene])`) → αντικατάσταση των 3 `.find()` με `index.get(id)`. **ΔΙΑΤΗΡΗΣΕ το `crossLevelEntities` fallback** (το `resolveSelectedEntityFrom` το συμβουλεύεται). Τάισέ το με **STABLE** `selectedEntityIds` (από store getter).
- **`hooks/layers/useOverlayLayers.ts`** (~175-270, dep `isSelected`) → stable `SelectedEntitiesStore.isSelected` (module-stable ref)· overlay reactivity → `useSelectionByType('overlay')`.
- **`hooks/canvas/useCanvasContextMenu.ts`** (~116-241, effect dep `selectedEntityIds` ξανα-registers DOM listener) → stable ref / store getter αντί reactive array.
- **`hooks/grips/useUnifiedGripInteraction.ts`** (~113-118 `selectedOverlays` memo dep `universalSelection`· ~196 `entitySelectionKey`· ~120 useGripRegistry· ~299/306 handleMouseDown) → stable inputs.

### ⚠️ DESIGN DECISION ΓΙΑ STAGE B (λύσε στο Plan Mode):
**Πώς mutate-άρουν οι orchestrators ενώ διαβάζουν imperatively (χωρίς subscription);** Το mirror (selectedRegionIds + editing reset) χρειάζεται σήμερα dispatch (React). Επιλογές:
- **(α)** Orchestrator κρατά stable ref στις actions (τα universalActions είναι ΗΔΗ ref-stable, deps `[dispatch]`) — αλλά η πρόσβαση μέσω `useSelection()`/`useUniversalSelection()` subscribe-άρει. Χρειάζεσαι non-subscribing accessor.
- **(β) (ΣΥΝΙΣΤΩΜΕΝΟ, Revit-grade)** Κάνε τον store **self-contained**: μετακίνησε το legacy projection (overlay-region ids) ώστε οι readers (§3 Stage C) να διαβάζουν `SelectedEntitiesStore.getOverlayRegionIds()` / `useSelectionByType('overlay')` αντί για `selectedRegionIds`· το `editingRegionId`/`draggedVertexIndex` reset → χωριστό μικρό concern (region-edit store ή κράτησε minimal dispatch μέσω bridge effect στον provider). Τότε orchestrators καλούν **module-level store mutators απευθείας** (zero React) — καθαρό ADR-040 dual-access. Αυτό **ενοποιεί** Stage B+C: το retire του `selectedRegionIds` ξεκλειδώνει τον self-contained store.
- **SSoT audit πρώτα:** grep ποιος γράφει/διαβάζει `selectedRegionIds` (μόνο 4: `FullscreenView`, `OverlayPanel`, `overlay-drawing`, `useEnhancedSelection`) + τις legacy region actions (`selectRegion`/`SELECT_ALL_ENTITIES`/`SELECT_BY_LAYER`/`ADD_MULTIPLE_TO_SELECTION`) πριν αποφασίσεις.

### Verify Stage B:
- React DevTools profile: κλικ-επιλογή → οι 4 orchestrators **ΟΧΙ** updaters· μόνο selection-leaves· 122ms → μικρό leaf commit.
- jest: `useActiveContextualTrigger` ίδια triggers μετά το index-refactor (γράψε test με panel+fixture / pipe-network / 2×BIM).
- Browser (Chrome): κάτοψη 552 στοιχείων, κλικ → χωρίς «κόλλημα»· snaps ON/OFF.

---

## 3. STAGE C — retire legacy (full SSoT)
- ~21 leaf consumers του `useUniversalSelection()` (ribbon family controllers `useWall/Slab/Roof/OpeningFamilyTypeController`, widgets `RibbonWallDimensionWidget`/`RibbonHatchListWidget`/`RibbonMep*Widget`, `LevelPanel`, `LayerItem`, `useLayersCallbacks`/`useKeyboardNavigation`/`useLayerOperations`) → granular hooks (`usePrimarySelectedId()`/`useSelectedEntityIds()`). Bridge hooks (~28, inject-don't-subscribe) → γονείς περνούν store/getter αντί του compat hook.
- Migrate τους 4 readers του `selectedRegionIds` → `useSelectionByType('overlay')` / `SelectedEntitiesStore.getOverlayRegionIds()`. Μετά → retire `selectedRegionIds` + οι legacy region actions/cases (ή κράτησέ το ως thin projection αν `useEnhancedSelection` το θέλει).
- Καθάρισε `useUniversalSelection` compat hook αν δεν έχει πια consumers (ή κράτησέ το ως facade).
- Verify: per-leaf jest + full app smoke.

---

## 4. GOTCHAS
- **useSyncExternalStore snapshot stability**: getters επιστρέφουν cached ref· ΠΟΤΕ μη φτιάχνεις νέο array σε getSnapshot (infinite loop). Το store το τηρεί ήδη.
- **3D bridge** `bim-3d/systems/selection/use-3d-selection-universal-bridge.ts` = one-way (3D→universal) με `join('|')` guard· `replaceEntitySelection` έχει skip-if-unchanged → μηδέν feedback loop. ΜΗΝ κάνεις τον store να push-άρει πίσω στο 3D.
- **`useSelectionLevelReset`** `clearAll` σε level change — first-mount-skip guard· κράτησέ το.
- **SSR**: όλα `'use client'`· πέρνα `getServerSnapshot` σε κάθε `useSyncExternalStore` (το `useSelectedEntities.ts` το κάνει)· μηδέν `window` στον store.
- **getPrimaryId() semantics**: last-affected-entry (parity με παλιό reducer DESELECT/CLEAR_BY_TYPE — recompute = first remaining key). Καλυμμένο σε jest.
- **CHECK 6B/6D**: stage ADR-040 + ADR-532 με τα CanvasSection/effects/drawing edits.

---

## 5. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (Giorgio).
- ΜΗΝ φτιάξεις 2ο selection store/μηχανισμό — ο `SelectedEntitiesStore` είναι ο SSoT. Reuse.
- ΜΗΝ καλέσεις store mutators που αγγίζουν overlay/region απευθείας χωρίς να λύσεις το mirror (§2 Decision) — θα μείνει stale το `selectedRegionIds`.
- ΜΗΝ βάλεις `useSyncExternalStore` σε orchestrator (CanvasSection/CanvasLayerStack) — CHECK 6C blocks· push σε leaves.
- ΜΗΝ βασιστείς σε full tsc (OOM).
- ΜΗΝ αγγίξεις τα ξένα uncommitted (beam-column-cutback, ADR-458/529).

---

## 6. SSoT AUDIT CHECKLIST (ΠΡΙΝ ΚΩΔΙΚΑ — Giorgio mandate)
Τρέξε grep ΠΡΙΝ γράψεις, για να μη δημιουργήσεις διπλότυπα:
- `grep -rn "useUniversalSelection\|getSelectedEntityIds\|getPrimaryId" src/subapps/dxf-viewer` → ποιοι είναι orchestrators vs leaves (re-classify, οι γραμμές ίσως άλλαξαν).
- `grep -rn "selectedRegionIds\|editingRegionId\|draggedVertexIndex" src/subapps/dxf-viewer` → οι 4 legacy readers (FullscreenView/OverlayPanel/overlay-drawing/useEnhancedSelection).
- `grep -rn "currentScene.entities.find\|entities\.find" src/subapps/dxf-viewer/app/ribbon-contextual-config.ts` → οι O(N×M) loops.
- Ψάξε αν υπάρχει ΗΔΗ `Map<id,entity>` index helper στη σκηνή (π.χ. στο `HitTestingService` / scene utils) πριν φτιάξεις νέο index στο contextual-config — **reuse αν υπάρχει**.
- `grep -rn "useHoveredEntity\|canvas-layer-stack-leaves\|*Subscriber" ...` → πρότυπο leaf-subscriber για να μιμηθείς (ADR-040).

---

## 7. ΚΑΤΑΣΤΑΣΗ ΑΡΧΕΙΩΝ
- **Stage A COMMITTED** (Giorgio): `systems/selection/{SelectedEntitiesStore.ts, useSelectedEntities.ts, SelectionSystem.tsx, useSelectionActions.ts, useSelectionSystemState.ts, useSelectionReducer.ts, index.ts}` + 2 tests + ADR-532 + adr-index.
- **Πριν το #2 είχε γίνει #1** (gate-at-mount βαριών dialogs — DxfViewerDialogs/BimScheduleHost/RenumberOpeningsHost + 2 tests + ADR-040 changelog) — έλεγξε αν committed· αν όχι, είναι ξεχωριστό ασφαλές commit.
- **Plan file:** `C:\Users\user\.claude\plans\floating-kindling-nygaard.md` (πλήρες A+B+C plan).
