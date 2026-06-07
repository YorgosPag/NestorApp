# ADR-399 — DXF Viewer: Building Floor Navigation Tabs + Auto-Provisioned Levels

**Status**: 🟢 IMPLEMENTED 2026-05-30 (pending commit)
**Date**: 2026-05-30
**Category**: Canvas & Rendering / DXF Viewer — Levels & Navigation
**Author**: Giorgio Pagonis + Claude (Opus 4.8)
**Related ADRs**: ADR-286 (DXF Level Creation Centralization SSoT), ADR-240 (Floorplan Pipeline → Κάτοψη Ορόφου), ADR-187/ADR-181 (Floor-Level Floorplans / IFC Floor Management), ADR-369 (Floor naming/elevation SSoT), ADR-309 (level context: floorplanType/entityLabel), ADR-237 (level↔floor link), ADR-040 (canvas layout micro-leaf / event-time)

---

## 1. Context

Όταν ο χρήστης εισάγει κάτοψη **ορόφου** μέσω του Wizard (Εταιρεία→Έργο→Κτίριο→Όροφος → `FloorplanImportWizard`), ο καμβάς δείχνει **μόνο** εκείνον τον όροφο. Για πλοήγηση σε άλλον όροφο του ίδιου κτιρίου ο χρήστης πρέπει να ανοίξει το αριστερό `LevelPanel` και να διαχειριστεί χειροκίνητα «επίπεδα» — αργό και μη-προφανές ότι το κτίριο έχει κι άλλους ορόφους.

Ζητούμενο (Giorgio): μόλις εισαχθεί κάτοψη ορόφου, οριζόντια **μπάρα καρτελών ορόφων** ακριβώς κάτω από το status bar (κάτω από ribbon, πάνω από καμβά), με **μία καρτέλα ανά όροφο του κτιρίου** (το σύστημα ήδη ξέρει πόσους έχει). Ενεργή η καρτέλα του ορόφου που εισήχθη· οι υπόλοιπες κενές αλλά πλοηγήσιμες — κλικ σε κενή → άδειος καμβάς έτοιμος για εισαγωγή κάτοψης εκείνου του ορόφου.

**Αποφάσεις Giorgio (2026-05-30):**
1. Οι υπόλοιποι όροφοι = **κενές** καρτέλες, με δυνατότητα import στην καθεμία.
2. Ετικέτες = **πραγματικά ονόματα ορόφων** («Υπόγειο», «Ισόγειο», «1ος Όροφος»), σειρά **κάτω→πάνω** (αύξων `number`).
3. Η μπάρα εμφανίζεται **μόνο** για κάτοψη **ορόφου** — όχι έργου/κτιρίου/ακινήτου.

---

## 2. Existing infrastructure reused (γιατί minimal)

| Κομμάτι | Πηγή | Ρόλος |
|---------|------|-------|
| Πολλαπλές σκηνές keyed-by-level | `hooks/scene/useSceneManager.ts` → `levelScenes: Record<string, SceneModel>` | μία σκηνή ανά όροφο, ταυτόχρονα |
| Auto-load σκηνής σε switch | `systems/levels/hooks/useLevelSceneLoader.ts` | φόρτωση από Storage όταν αλλάζει `currentLevelId` |
| Level CRUD μέσω SSoT gateway | `systems/levels/hooks/useLevelOperations.ts` → `/api/dxf-levels` (ADR-286) | `addLevel(name, setAsDefault, floorId)` με audit/tenancy/enterprise-id |
| Level context fields | `systems/levels/config.ts` → `Level.{floorId,buildingId,floorplanType,entityLabel}` | σύνδεση level↔όροφος + τύπος κάτοψης |
| Λίστα ορόφων κτιρίου | `components/properties/shared/useFloorsByBuilding.ts` | real-time, αύξουσα κατά `number` |
| Ονοματοδοσία | `utils/floor-naming.ts` → `generateAutoLongName` + `inferKindFromNumber` | ελληνικά canonical labels (ADR-369) |

Το import path (`LevelPanel.tsx` `onComplete`) **ήδη** κάνει `updateLevelContext(currentLevelId, { floorplanType:'floor', floorId, buildingId, entityLabel })`. Άρα ο τρέχων όροφος αποκτά context αυτόματα.

---

## 3. Decision

**SSoT για τις καρτέλες = οι όροφοι του κτιρίου** (`useFloorsByBuilding`). **buildingId = `currentLevel.buildingId`** (το έθεσε το import). Κάθε καρτέλα ορόφου αντιστοιχίζεται σε ένα `Level`:

- Υπάρχει `level` με `level.floorId === floor.id` → η καρτέλα κάνει `setCurrentLevel(level.id)`.
- Δεν υπάρχει → **virtual** καρτέλα. Κλικ → **lazy provision**: `addLevel(label, false, floor.id)` (ADR-286 gateway) → `updateLevelContext(newId, { floorplanType:'floor', buildingId, floorId, entityLabel })` → `setCurrentLevel(newId)`. Το Firestore subscription μετατρέπει το virtual tab σε «πραγματικό».

**Αρχιτεκτονικά invariants:**

1. **Lazy provisioning, όχι eager** — δεν δημιουργούνται άχρηστα κενά levels εκ των προτέρων· level γεννιέται μόνο όταν ο χρήστης επισκεφθεί τον όροφο. Δεν φουσκώνει το Firestore.
2. **Idempotency (Google-level)** — provision μόνο αν δεν υπάρχει level με αυτό το `floorId` (`levelByFloorId` map)· in-flight guard (`provisioningRef: Set<floorId>`) ώστε διπλό κλικ → ένα `addLevel`.
3. **floorplanType:'floor' στο provision** — ο νέος κενός όροφος παίρνει `floorplanType:'floor'` ώστε **μετά** το switch η μπάρα να **παραμείνει** ορατή (αλλιώς θα εξαφανιζόταν).
4. **Visibility gate** — render μόνο αν `currentLevel?.floorplanType === 'floor'` **και** `currentLevel.buildingId` (απόφαση #3). Αλλιώς `null`.
5. **Active tab** = ο όροφος με `floor.id === currentLevel.floorId`.
6. **Label SSoT** = `floor.longName ?? floor.name ?? generateAutoLongName(floor.kind ?? inferKindFromNumber(floor.number), floor.number)` — μηδέν hardcoded strings (N.11).
7. **hasFloorplan badge** = `!!level && (level.sceneFileId || scene.entities.length > 0)` — δείχνει «κενός» όροφος, ορθό ακόμα και για μη-επισκεφθέντες (βάσει `sceneFileId`, όχι μόνο φορτωμένων entities).
8. **No ADR-040 regression** — η μπάρα είναι leaf component που καταναλώνει `useLevelsContext()` (state χαμηλής συχνότητας: levels/currentLevelId), όχι high-freq stores. Δεν αγγίζει `CanvasSection`/transform/hover.

---

## 4. Files

**NEW**
- `src/subapps/dxf-viewer/hooks/data/useFloorTabs.ts` — reconciliation hook (mapping, lazy provision, idempotency, visibility).
- `src/subapps/dxf-viewer/components/dxf-layout/FloorTabBar.tsx` — presentational `<nav role="tablist">`, centralized tokens.

**MOD**
- `src/subapps/dxf-viewer/components/dxf-layout/NormalView.tsx` — mount `<FloorTabBar />` ανάμεσα σε `StandaloneStatusBar` και `CanvasSection`.
- `src/components/properties/shared/useFloorsByBuilding.ts` — additive `longName?` + `kind?` στο `FloorOption` (μη-breaking για ADR-329 consumers).
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `floorTabs.ariaLabel`, `floorTabs.emptyBadge`.

**TEST (NEW)**
- `src/subapps/dxf-viewer/hooks/data/__tests__/useFloorTabs.test.ts` — 10/10 PASS (visibility, mapping, label fallback, ascending order, switch vs provision, double-click guard).

### Phase B + C — 3Δ Multi-floor («Όλοι οι όροφοι»)

**NEW**
- `src/subapps/dxf-viewer/bim-3d/scene/multi-floor-3d-source.ts` — non-React SSoT (`FloorStackEntry[]` get/set/subscribe) για το aggregated stack.
- `src/subapps/dxf-viewer/bim-3d/scene/bim3d-resync.ts` — scope-aware SSoT `resyncBimScene(manager, opts)` (single vs multi-floor).
- `src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts` — producer: per-floor entities (live active + `getLevelScene`/`loadFileV2` snapshots) + elevation → source.
- `src/subapps/dxf-viewer/bim-3d/viewport/use-bim3d-multifloor-sync.ts` — wiring (run aggregator while 'all', resync on scope/stack change).

**MOD**
- `bim-3d/stores/ViewMode3DStore.ts` — `floor3DScope` + `setFloor3DScope` + `selectFloor3DScope`.
- `bim-3d/stores/Bim3DEntitiesStore.ts` — `EMPTY_BIM_ENTITIES` μετακινήθηκε εδώ (cycle-avoidance).
- `bim-3d/scene/BimSceneLayer.ts` — extract `syncFloorEntities`/`buildContext` + νέο `syncMultiFloor`.
- `bim-3d/scene/scene-manager-actions.ts` — `syncMultiFloorBimEntitiesIntoScene`.
- `bim-3d/scene/ThreeJsSceneManager.ts` — `syncBimEntitiesMultiFloor`.
- `bim-3d/viewport/use-bim3d-store-sync.ts` + `use-bim3d-vg-resync.ts` + `BimViewport3D.tsx` — inline `syncBimEntities` → `resyncBimScene` (SSoT, scope-aware) + mount `useBim3DMultiFloorSync`.
- `hooks/data/useFloorTabs.ts` — `floor3DScope` + `onSelectAllFloors` + `floorVisibilityModes` + `onToggleFloorVisible`.
- `components/dxf-layout/FloorTabBar.tsx` — «Όλοι οι όροφοι» tab (first-left) + per-tab visibility checkbox.
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — `floorTabs.allFloors`/`.allFloorsAria`/`.floorVisibleAria`.

**TEST (NEW)** — `useFloors3DAggregator.test.ts` (per-building stack, live vs snapshot, loadFileV2, exclusion), `BimSceneLayer-multifloor.test.ts` (stacking, per-floor elevation, hide gate, no accumulation), + `useFloorTabs.test.ts` Phase B/C block (scope, enter-3D, toggle). 42/42 PASS.

### Phase D — 2Δ Underlay («Όλοι οι όροφοι» σε 2Δ, AutoCAD xref)

**NEW**
- `src/subapps/dxf-viewer/components/dxf-layout/FloorUnderlayOverlay.tsx` — read-only micro-leaf canvas (z-[5], `pointer-events-none`). Subscribe scope+mode (`ViewMode3DStore`)· merge ορατών μη-ενεργών ορόφων → `DxfRenderer.render({skipInteractive:true})` + `destination-out` fade. Gating: `scope==='all' && mode==='2d'`.
- `src/subapps/dxf-viewer/hooks/data/useFloors2DUnderlay.ts` — producer (mirror του 3D aggregator): non-active building floors → converted `DxfScene` (getLevelScene / loadFileV2 snapshot)· εξαιρεί active + `floorVisibilityModes==='hide'`.

**MOD**
- `hooks/canvas/useDxfSceneConversion.ts` — export **SSoT** `convertSceneToDxf(scene, units?)` (pure/uncached extract· ο hook κρατά το cached path).
- `components/dxf-layout/CanvasLayerStack.tsx` *(ADR-040-critical)* — mount `<FloorUnderlayOverlay>` ανάμεσα σε `FloorplanBackgroundCanvas` και `DraftLayerSubscriber`.
- `hooks/data/useFloorTabs.ts` — `onSelectAllFloors`: αφαίρεση `enterRasterMode()` σε 2Δ (μένει 2Δ → overlay).

**TEST (NEW)** — `useFloors2DUnderlay.test.ts` (active-exclusion, hide-exclusion, building filter, getLevelScene vs loadFileV2, inactive gating). 5/5 PASS· `useFloorTabs.test.ts` ενημερώθηκε (2Δ μένει 2Δ) → 16/16 PASS.

---

## 5. Flow

```
import floorplan (Wizard, entityType='floor')
  └─ LevelPanel.onComplete → updateLevelContext(currentLevel, {floorplanType:'floor', floorId, buildingId})
       └─ FloorTabBar visible (floorplanType==='floor' && buildingId)
            └─ useFloorsByBuilding(buildingId) → [floor … ] ascending by number
                 ├─ floor has level (floorId match) → tab → click → setCurrentLevel(level.id) → auto-load scene
                 └─ floor without level → virtual tab → click → addLevel(floorId) → updateLevelContext → setCurrentLevel
```

---

## 6. Verification

- **Tests**: `npx jest src/subapps/dxf-viewer/hooks/data/__tests__/useFloorTabs.test.ts` → 10/10 PASS.
- **tsc**: clean στα νέα/τροποποιημένα αρχεία.
- **Browser** (`/dxf/viewer`): import 1ου ορόφου κτιρίου με ≥2 ορόφους → μπάρα με καρτέλα/όροφο, σωστά ελληνικά ονόματα, σειρά κάτω→πάνω, ενεργή ο 1ος· κλικ σε κενό → άδειος καμβάς + μπάρα μένει + import εκεί· επιστροφή → re-load· import κτιρίου/έργου/ακινήτου → μπάρα κρυφή.

---

## 7. Changelog

- **2026-05-30** — Initial implementation (Opus 4.8). NEW `useFloorTabs` + `FloorTabBar`, MOD `NormalView` + `useFloorsByBuilding` + i18n, 10/10 tests. Lazy provisioning via ADR-286 gateway, visibility gated to floor-plan context. Pending commit.
- **2026-05-30 (BUGFIX — μπάρα δεν εμφανιζόταν μετά από Wizard→Όροφος import)** — Root cause: ο `FloorplanImportWizard` δεν προωθούσε `buildingId` για κάτοψη ορόφου (το `WizardCompleteMeta` είχε μόνο `entityType`+`entityId`=floorId· το `saveContext` έθετε `buildingId` **μόνο** για `entityType==='building'`). Άρα το level έπαιρνε `floorplanType='floor'` αλλά `buildingId=undefined` → visibility gate (§3.4) false → μπάρα κρυφή. Fix (3 σημεία): (1) `WizardCompleteMeta.buildingId?` νέο πεδίο· (2) `handleUploadComplete` περνά `state.selection.buildingId`· (3) `LevelPanel.onComplete` → `updateLevelContext({ buildingId: meta.buildingId ?? saveContext.buildingId })`. ⚠️ Γνωστό residual edge: αν στο import **δεν** υπάρχει ενεργό level (`currentLevelId` null), το `onComplete` κάνει skip το `updateLevelContext` και το νέο level (που δημιουργεί το `handleFileImportWithEncoding`) δεν παίρνει context — καλύπτεται μόνο όταν υπάρχει ήδη ενεργό level (συνήθης περίπτωση). Follow-up αν εμφανιστεί.
- **2026-05-30 (✅ BROWSER VERIFIED)** — Επιβεβαιωμένο live (Giorgio): κτίριο 2 ορόφων → μπάρα με «1ος Όροφος» + «2ος Όροφος» ορατή κάτω από το status bar. Προστέθηκε `shrink-0` στο `<nav>` του `FloorTabBar` (μην το συμπιέζει το flex-col layout στο μηδέν). Διαγνωστικά logs αφαιρέθηκαν.
- **2026-05-30 (🐛 ROOT-CAUSE FIX — «ίδιο 3Δ/2Δ σε όλους τους ορόφους», αρχικά αναφερθέν ως 3Δ bug)** — Διαγνώστηκε με instrumentation 6 σημείων (host push / 3D store-sub / DXF overlay / level↔scene map). **Το 3Δ ήταν αθώο**: το `BimViewport3D` pipeline καθρέφτιζε σωστά το store· το πρόβλημα ήταν ότι το `getLevelScene(levelId)` γύρναγε **ίδιο scene** για δύο διαφορετικά levels. Root cause: **cross-floor `sceneFileId` link** — level του ορόφου Β κρατούσε το `sceneFileId` του ορόφου Α (επιβεβαιωμένο: `lvl_2ba743b8`/floor `flr_0b2995f8` είχε `file_e4188466` που ανήκει σε floor `flr_ecebe795`). Μηχανισμός μόλυνσης: στο `useLevelSceneLoader`, όταν αλλάζεις σε level **χωρίς** `sceneFileId`, **δεν μηδενιζόταν** το auto-save target (`fileRecordId`/`currentFileName` sticky) → edit στον νέο όροφο σωζόταν στο αρχείο του προηγούμενου + το re-linkάρει. **Fix (2 layers, belt-and-suspenders):** (1) **Reset auto-save target** (`fileRecordId`/`saveContext`/`currentFileName`=null) σε κάθε file-less / cross-link switch — μηδενίζει το auto-save gate (απαιτεί filename) ώστε file-less level να μη γράφει ποτέ DXF σε ξένο αρχείο· τα BIM entities σώζονται ανεξάρτητα (floorId-keyed). (2) **Cross-floor load guard** (`isCrossFloorSceneLink` SSoT helper) — αν το φορτωμένο FileRecord είναι floor-scoped και ανήκει σε άλλον όροφο, skip load + reset target + κενό scene. NEW `systems/levels/cross-floor-link.ts` + 6/6 tests· MOD `useLevelSceneLoader.ts`. 🔴 Browser verify: hard reload → κάθε όροφος δείχνει το δικό του περιεχόμενο (2Δ ΚΑΙ 3Δ). ⚠️ Stale Firestore link του ορόφου Β παραμένει αλλά αβλαβές (guard το αγνοεί κάθε load)· optional follow-up = καθάρισμα του λάθος `sceneFileId`.

- **2026-05-30 (Phase B + C — 3Δ Multi-floor «Όλοι οι όροφοι», Opus 4.8)** — pending commit, 🔴 browser verify εκκρεμεί. **Phase B**: νέα καρτέλα «Όλοι οι όροφοι» ΠΡΩΤΗ-αριστερά στη μπάρα → `floor3DScope='all'` (+ enter 3D raster αν 2Δ) → όλο το κτίριο στοιβαγμένο κατά elevation (ADR-369 `floor.elevation` m × 1000). **Phase C**: checkbox στην αρχή κάθε καρτέλας ορόφου που ορίζει αν ο όροφος εμφανίζεται μέσα στο «Όλοι» — **κοινό SSoT** με Floor3DPanel (`ViewMode3DStore.floorVisibilityModes`, checked=show/unchecked=hide), disabled για virtual καρτέλες.

  **Αρχιτεκτονική (reuse converters, μηδέν νέα geometry):** οι converters (`wallToMesh`/`columnToMesh`/`stairToMeshes`/envelope) ήδη δέχονταν `floorElevationMm` (περνιόταν πάντα 0). Νέα διαδρομή `BimSceneLayer.syncMultiFloor(stack)` → ένα `clearGroup` + loop ανά όροφο με δικό του `floorElevationMm`+levelId (τα meshes tag-άρονται με levelId → το υπάρχον `applyFloorVisibility` post-pass δίνει show/ghost/hide δωρεάν). **Data sourcing:** ενεργός όροφος = live `Bim3DEntitiesStore`· υπόλοιποι = `getLevelScene(levelId)` (visited) ή one-shot `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot (BIM entities ζουν μέσα στο persisted scene, keyed-by-floorplanId = `level.sceneFileId`). ⚠️ Όροφος που σώθηκε σε Firestore collections αλλά όχι στο scene file → snapshot drift· ο ενεργός όροφος πάντα live.

  **SSoT scope-aware resync (Boy-Scout N.0.2):** πριν, ~6 call sites (`BimViewport3D` mount+entity-sub, `use-bim3d-store-sync` floor-mode/LayerStore, `use-bim3d-vg-resync` V/G/envelope) κάλεσαν inline `syncBimEntities(storeSnapshot,0,…)` — σε scope='all' θα έσβηναν το στοιβαγμένο κτίριο σε κάθε layer/V/G/checkbox toggle. Κεντρικοποιήθηκαν σε `resyncBimScene(manager, opts)` που διαβάζει `floor3DScope`: 'all'→`syncBimEntitiesMultiFloor(stack)`+floor-vis pass, 'single'→legacy.

- **2026-05-30 (✅ Phase D — 2Δ underlay όλων των κατόψεων, Opus 4.8)** — pending commit, 🔴 browser verify εκκρεμεί. Η καρτέλα «Όλοι» σε **2Δ** δείχνει πλέον overlay όλων των κατόψεων DXF (AutoCAD xref / Revit underlay): ο ενεργός όροφος κανονικός + editable, οι άλλοι ξεθωριασμένοι (ίδια χρώματα, ~35% opacity) + read-only. Το per-floor checkbox (`floorVisibilityModes`, **κοινό SSoT** με 3Δ/Phase C) κρύβει/δείχνει όροφο και στο 2Δ overlay.

  **Αρχιτεκτονική (ADR-040-safe):** νέο **read-only micro-leaf** `FloorUnderlayOverlay.tsx` — ξεχωριστό canvas `pointer-events-none` σε z-[5] (πίσω από DxfCanvas z-10), subscribe ΜΟΝΟ στο leaf (`ViewMode3DStore` scope/mode + `useFloors2DUnderlay`). Ο shell `CanvasLayerStack` ΔΕΝ αποκτά νέο `useSyncExternalStore` (CHECK 6C). **Selection/persistence isolation:** το ξεχωριστό canvas δεν συνδέει hit-test/selection → αδύνατο edit/save entity άλλου ορόφου σε λάθος `floorplanId`. **Render:** merge ορατών μη-ενεργών ορόφων σε ΕΝΑ read-only `DxfScene` → `DxfRenderer.render({skipInteractive:true})` + `destination-out` fade wash. Καμία αλλαγή σε bitmap cache key (ADR-040 rule 3). **Gating:** ενεργό μόνο `floor3DScope==='all'` ΚΑΙ `mode==='2d'`.

- **2026-05-30 (🐛 ROOT-CAUSE FIX — Phase B: όλοι οι όροφοι στοιβάζονταν στο Y=0 σε 3Δ, Opus 4.8)** — pending commit. Giorgio: «τοποθετώ BIM οντότητες σε 1ο+2ο όροφο → 3Δ → φαίνονται στο **ίδιο υψόμετρο**· δεν διαβάζεται το elevation της καρτέλας “Όροφοι”». **Root cause:** ο `useFloors3DAggregator` έπαιρνε `floorElevationMm` από `Bim3DEntitiesStore.floors[].elevation`, που τρέφεται από `useBuildingFloors3DSync` ← `ProjectHierarchyContext`. ΑΛΛΑ ο μετασχηματισμός ορόφων στο `ProjectHierarchyContext.loadProjectsForCompany` **πετούσε** το `elevation` (έχτιζε `{id,name,number,units}` μόνο)· επιπλέον το by-company API δεν επιστρέφει floor elevation → `elevation` πάντα `undefined` → aggregator `?? 0` → **floorElevationMm = 0 για ΟΛΟΥΣ**. **Fix (SSoT):** ο aggregator διαβάζει πλέον elevation από την **ίδια canonical Firestore πηγή με τα tabs** — `useFloorsByBuilding(buildingId)` (collection `FLOORS`, field `elevation` σε m, default = number×3m, γραμμένο από την καρτέλα «Όροφοι»/`useFloorsTabState`). `FloorOption.elevation?` εκτέθηκε (additive). +Boy-Scout: ο `ProjectHierarchyContext` μετασχηματισμός έγινε lossless (διατηρεί `elevation` όταν υπάρχει — ωφελεί horizontal-cut-preset-resolver κ.ά.). 2 MOD code (`useFloorsByBuilding`, `useFloors3DAggregator`) + 1 MOD (`ProjectHierarchyContext`) + test mock update. 9/9 aggregator+underlay + 5/5 multifloor PASS. 🔴 browser verify: BIM σε 1ο+2ο → 3Δ «Όλοι» → σωστά υψόμετρα.

  **Data sourcing:** νέο `useFloors2DUnderlay(active)` (mirror του `useFloors3DAggregator`) — non-active building floors → `getLevelScene` (visited) ή `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot, converted μέσω **SSoT** `convertSceneToDxf` (extract από `useDxfSceneConversion`, pure/uncached — μηδέν side effects στον LayerStore/DIMSTYLE του ενεργού ορόφου). `onSelectAllFloors` δεν κάνει πλέον `enterRasterMode()` σε 2Δ → μένει 2Δ (overlay)· σε 3Δ στοιβάζει (Phase B). 2 NEW (`FloorUnderlayOverlay`, `useFloors2DUnderlay`) + `convertSceneToDxf` export + 3 MOD (`CanvasLayerStack` mount, `useFloorTabs.onSelectAllFloors`, `useDxfSceneConversion`). Tests: `useFloors2DUnderlay.test.ts` 5/5 + `useFloorTabs.test.ts` 16/16 PASS. ⚠️ **Pending (N.0.2):** το per-floor scene sourcing διπλασιάζεται με `useFloors3DAggregator` → extraction κοινού `useBuildingFloorScenes` SSoT **μετά** το browser-verify B/C/D (flagged στο pending-ratchet).

- **2026-06-07 (🏢 Phase B — Revit-grade datum anchoring: BIM οντότητες χαμηλότερου ορόφου «επέπλεαν» κατά elevation σε 3Δ «Όλοι», Opus 4.8)** — pending commit, 🔴 browser verify εκκρεμεί. Giorgio: «BIM οντότητες στον 1ο όροφο φαίνονται στο 0 σε single-floor 3Δ, αλλά στο combined ανεβαίνουν ~3m». **Root cause (ΔΕΝ ήταν inversion):** ο aggregator έδινε `floorElevationMm = floor.elevation × 1000` **απόλυτο**, οπότε κτίριο που ο χαμηλότερος όροφός του είναι «1ος» (number 1, elevation 3m· **χωρίς** Ισόγειο/number 0) επέπλεε 3m. Το single-floor view (`floorElevationMm=0`) δεν είχε το πρόβλημα → ασυνέπεια/«jump». **Fix (Revit «the building rests on its ground-floor datum»):** νέο pure SSoT `bim-3d/scene/floor-stack-elevation.ts` (`resolveBuildingDatumElevationM` = elevation του Ισογείου/number 0 αν υπάρχει, αλλιώς ο χαμηλότερος όροφος· `resolveFloorDatumRelativeElevationMm` = `(elevation − datum) × 1000`). Ο `useFloors3DAggregator` στοιβάζει πλέον **datum-relative** → datum όροφος στο world 0 (+ `building.baseElevation` downstream από converters), υπόλοιποι κατά διαφορά. **Υπόγειο σωστό:** datum = Ισόγειο (ΟΧΙ ο χαμηλότερος) → ορισμένο υπόγειο μένει **κάτω** από το 0. Συνεπές με single-floor «κάθεται στο 0» για τον datum. 1 NEW SSoT + test (13 cases) + 1 MOD `useFloors3DAggregator` + aggregator test (datum-anchoring case) + Boy-Scout fix stale `BimSceneLayer-multifloor.test.ts` (έγκυρα wall params + 8-arg `wallToMesh` signature, ADR-401). 18/18 + 5/5 PASS, tsc clean (scope). ⚠️ **Επισημάνσεις (όχι σε αυτό το commit):** (1) duplicate elevation-default logic `computeSmartElevation` (FloorInlineCreateForm) vs `computeDefaultElevation` (useFloorsTabState) = SSoT violation → pending-ratchet· (2) stale `dxf_viewer_levels.sceneFileId` που δείχνει σε ανύπαρκτο file (πιθανό import-linking κατάλοιπο) → καθαρό re-setup για browser verify. **Single-floor view αμετάβλητο** (focus-at-0, χωρίς regression).

- **2026-06-07 (🏢 Phase B — DXF κάτοψη multi-floor στο 3Δ «Όλοι»: εμφανιζόταν μόνο του ενεργού ορόφου, Opus 4.8)** — pending commit, 🔴 browser verify. Giorgio: «στο 3Δ δεν εμφανίζεται η κάτοψη DXF του 2ου ορόφου». **Root cause:** ο `DxfToThreeConverter` (DXF wireframe underlay στο 3Δ) ζωγράφιζε **ΜΟΝΟ** την κάτοψη του ενεργού ορόφου στο Y=0 — δεν ήταν multi-floor (σε αντίθεση με τα BIM entities). **Fix (mirror του BIM multi-floor path):** (a) `DxfToThreeConverter.syncMultiFloor(entries)` — per-floor color group στο datum-relative elevation (extract `buildColorGroup` SSoT· single `sync` flat-structure αμετάβλητο για back-compat). (b) NEW `bim-3d/scene/multi-floor-dxf-source.ts` (non-React source, mirror `multi-floor-3d-source`). (c) NEW `bim-3d/scene/dxf-overlay-resync.ts` `resyncDxfOverlay(manager)` scope-aware (all→syncDxfOverlayMultiFloor, single→syncDxfOverlay· mirror `bim3d-resync`). (d) NEW producer `hooks/data/useFloors3DDxfOverlay.ts` — όλοι οι όροφοι κτιρίου, ενεργός=live overlay store scene, υπόλοιποι=getLevelScene/loadFileV2 snapshot→`convertSceneToDxf`, datum-relative elevation (κοινό SSoT `floor-stack-elevation` + `useFloorsByBuilding`), hide-gate (Phase C). (e) Wiring: `ThreeJsSceneManager.syncDxfOverlayMultiFloor` + `syncDxfOverlayMultiFloorIntoScene` action· `use-bim3d-multifloor-sync` mount producer + subscribe DXF source + resync on scope· `use-bim3d-store-sync` + `BimViewport3D` mount → scope-aware `resyncDxfOverlay`. 3 NEW + 5 MOD· DxfToThreeConverter 42/42 (+4 multi-floor) PASS, tsc clean (scope). ΕΚΤΟΣ ADR-040 micro-leaf (3Δ scene path, όχι 2Δ canvas). ⚠️ Pending (N.0.2): 3-way per-floor scene sourcing dup (aggregator/2D-underlay/3D-dxf-overlay) → ενισχύει το flagged `useBuildingFloorScenes` extract.
