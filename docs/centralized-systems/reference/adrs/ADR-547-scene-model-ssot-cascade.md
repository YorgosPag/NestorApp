# ADR-547 — Scene-model SSoT: σπάσιμο του scene-change re-render cascade

**Status:** 🟡 IN PROGRESS (Stage 0 COMMITTED `d0913846` · Stage 2/3 + Stage 4 IMPLEMENTED UNCOMMITTED 2026-06-28)
**Domains:** scene state (SceneModel SSoT), perf (re-render cascade), BIM persistence hosts
**Σχετικά:** ADR-532 (selection-set SSoT — το pattern που μιμούμαστε), ADR-040 (micro-leaf doctrine), ADR-341 (God-context split προηγούμενο)
**Πηγή:** `HANDOFFS/PLAN_2026-06-28_scene-model-ssot-cascade.md` · React-DevTools Profiler `profiling-data.28-06-2026.03-09-14.json` (commit#24 = **252ms / 2695 fibers** σε **μία** αλλαγή παραμέτρου κολόνας)

---

## 1. Πρόβλημα

Το `SceneModel` ανά level prop-drillάρεται μονολιθικά ως `currentScene` από τον orchestrator
(`DxfViewerContent` → `DxfViewerTopBar`) σε **~28 persistence hosts** + το BIM properties panel +
`RibbonContextualTabScope`. Κάθε edit οντότητας παράγει νέα αναφορά `SceneModel`, άρα **κάθε** host
ξανα-εκτελούσε `useMemo(find-by-id)` + `useEffect(filter-by-type)` σε **κάθε** edit — ακόμη κι όταν
άλλαζε εντελώς άσχετος τύπος (column edit → re-render όλων των Wall/Slab/Mep/… hosts).

## 2. Διορθωμένη ρίζα (CODE = source of truth)

Το αρχικό plan §1 περιέγραφε τον **προ-Stage-0** κόσμο («memo dep `[levelScenes]` → νέα context
αναφορά»). **Audit μετά το Stage 0** έδειξε ότι η μηχανική άλλαξε:

- Το `LevelsContext` value είναι **ήδη σταθερό** σε entity edit (deps: μόνο `fileRecordId`/`saveContext`·
  `getLevelScene`/`setLevelScene` = ref-based stable callbacks). Δεν περιέχει reactive `levelScenes`.
- Το πραγματικό waste **δεν** είναι «νέο context ref». Είναι ότι **κανένας host δεν ήταν `React.memo`**
  και έπαιρνε το συνεχώς-μεταβαλλόμενο `currentScene` prop → re-render όποτε re-renderάρει ο
  μη-memoized `DxfViewerTopBar`.

**Συνέπεια για τη θεραπεία:** η σωστή λύση = **granular slice subscription + `React.memo`** (όχι απλώς
severance του orchestrator). Το slice-only χωρίς memo ΔΕΝ μειώνει re-renders· το memo χωρίς αφαίρεση του
changing prop ΔΕΝ bail-άρει. Χρειάζονται **και τα δύο**.

**Reference-stability invariant (το κλειδί):** ο `LevelSceneManagerAdapter.updateEntity` ξαναχτίζει τα
entities με `entities.map(e => e.id === id ? {...e, ...updates} : e)` → κάθε **αμετάβλητο** entity κρατά
την **ίδια** αναφορά· μόνο το επεξεργασμένο αλλάζει. Άρα ένα per-type `filter` slice μένει
**element-wise ίδιο** όταν αλλάζει άλλος τύπος.

## 3. Απόφαση

Κάνε το `SceneModel` SSoT store με **granular, reference-stable selectors** (μίμηση ADR-532
`SelectedEntitiesStore`):

- **`SceneStore`** (Stage 0) — zero-React singleton SSoT για το `Record<levelId, SceneModel>`.
- **Granular leaf selectors** (Stage 2/3):
  - `getSceneEntitiesByType(levelId, guard)` + `useSceneEntitiesByType` — per-type slice, version-gated
    cache (WeakMap ανά guard), επιστρέφει **ίδιο reference** όταν τα στοιχεία δεν άλλαξαν.
  - `getSceneEntityById(levelId, id)` + `useSceneEntityById` — single entity, stable ref για αμετάβλητα.
- **Hosts → `React.memo`** ώστε να bail-άρουν όταν τα (πλέον scene-free) props είναι shallow-equal.

## 4. Στάδια

| Stage | Τι | Κατάσταση |
|---|---|---|
| **0** | `SceneStore.ts` zero-React SSoT· `useSceneManager` → thin adapter | ✅ COMMITTED `d0913846` |
| **2** | 27 persistence hosts → granular slices + `React.memo`, drop `currentScene` prop | ✅ UNCOMMITTED |
| **3** | Properties panel/ribbon bridges → `useSceneEntityById` (μέσω host hooks) | ✅ (μέσω host migration) |
| **4** | Ribbon/TopBar cascade: σταθεροποίηση `wrappedHandleAction` (`useEventCallback`) → `RibbonRoot` memo κρατά | ✅ UNCOMMITTED |
| **1** | Orchestrator severance (event-time read) | ⏸️ ΑΝΑΘΕΩΡΗΘΗΚΕ — βλ. §2 (memo, όχι severance) |
| **MepSystem hooks** | `useMepConnectorReconciliation`/`useMepCircuitEditorSync` → self-subscribe SceneStore | 🔴 FOLLOW-UP |
| **5** | Retire `currentScene` prop εντελώς (μένει μόνο για MepSystem + RibbonContextualTabScope) | 🔴 μετά MepSystem hooks |

## 5. Υλοποίηση (Stage 2/3 — 2026-06-28)

**Νέα αρχεία:**
- `systems/scene/scene-selectors.ts` — `getSceneEntitiesByType`/`getSceneEntityById` (pure, version-gated,
  reference-stable).
- `systems/scene/useSceneSelectors.ts` — `useSceneEntitiesByType`/`useSceneEntityById` (useSyncExternalStore leaves).
- `systems/scene/__tests__/scene-selectors.test.ts` — **10 jest** (invariant: column edit → wall slice
  ίδιο ref· wall edit → νέο ref· per-id stability· null/empty). **20/20 scene jest GREEN**, tsc 0.

**Migrated hosts (27):** Wall, Opening, Slab, Column, Foundation, Beam, MepFixture, Furniture,
FloorplanSymbol, ElectricalPanel, MepManifold, MepRadiator, MepBoiler, MepWaterHeater, MepUnderfloor,
MepSegment, MepFitting, Railing, Roof, FloorFinish, WallCovering, Hatch, ThermalSpace, SpaceSeparator,
SlabOpening, Stair + MepSystem (μόνο `React.memo`). Καθένας: drop `currentScene` prop → `useSceneEntityById`
(selected) + `useSceneEntitiesByType` (3D-sync, όπου υπάρχει) + `React.memo` + `displayName`.

**Παρατηρήσεις:**
- Hosts χωρίς 3D feed (μόνο `useSceneEntityById`): WallCovering, Hatch, SpaceSeparator, FloorplanSymbol,
  ThermalSpace (2D-only/μελλοντικά).
- **OUTLIER `MepSystemPersistenceHost`:** κρατά το `currentScene` prop — το forwardάρει reactively σε
  `useMepConnectorReconciliation` (effect trigger) + `useMepCircuitEditorSync` (memo dep). Το `React.memo`
  δεν bail-άρει μέχρι αυτά τα 2 hooks να self-subscribe στο `SceneStore` (follow-up).
- `MepFitting`: αφαιρέθηκε ένα `fittingsSig` signature-trick (περιττό — το slice είναι ήδη ref-stable).
- `GridGuidePersistenceHost`: δεν χρησιμοποιεί `currentScene` → εκτός scope.

**ADR-040:** κανένα migrated αρχείο δεν είναι canvas-drawing/micro-leaf (hosts/TopBar/selectors) →
CHECK 6B/6D δεν ενεργοποιούνται.

## 5.bis Υλοποίηση (Stage 4 — ribbon/TopBar cascade — 2026-06-28)

**Εύρημα profile 11:32 (record-why ON):** το Stage 2/3 έλυσε τον host-cascade (wall edit → 1 host),
ΑΛΛΑ το πραγματικό self-time bottleneck ήταν το **Ribbon + Radix UI tree** (Tooltip ×63, Primitive.button
×33, Switch, SelectItem, DialogPortal…). Το `RibbonRoot` ΕΙΝΑΙ `React.memo`, αλλά defeat-αρόταν.

**Πλήρες ίχνος (audit, όχι υπόθεση):**
- `RibbonRoot = React.memo` σε props `{commands, contextualTabs}`. `contextualTabs` = σταθερά. Άρα μόνο το
  `commands` (= `ribbonCommands`) κρίνει το bail-out.
- `ribbonCommands` = `useMemo` με dep `onAction` (+ composers). `onAction` dep `wrappedHandleAction`
  (= `arrayActionInterceptor`). Ο interceptor (`useArrayRibbonActions`) έχει dep `levelManager` (memoized,
  γρ.358 `LevelsSystem` → σταθερό σε scene-edit χάρη στο Stage 0 SceneStore) + `fallback = wrappedHandleAction`.
- **Root cause:** το base `wrappedHandleAction` (`useDxfViewerCallbacks`) ήταν `useCallback` με dep
  `fullscreen`. Το `useFullscreen()` επιστρέφει **νέο object literal κάθε render** (μη-memoized) →
  `wrappedHandleAction` churn κάθε render → `arrayActionInterceptor` → `onAction` → `ribbonCommands` →
  defeat `RibbonRoot.memo` → re-render όλου του Radix subtree σε κάθε edit/selection.

**Fix (SSoT, 1 αρχείο):** `wrappedHandleAction` → `useEventCallback` (canonical `useEffectEvent`, ήδη στο
ίδιο αρχείο για `handleFileImportWithEncoding`, ADR-532 Stage 4a.1). Ταυτότητα μόνιμα σταθερή· διαβάζει
latest `fullscreen`/`levelManager`/`user`/`t` στο click-time → μηδέν αλλαγή συμπεριφοράς. Event-only →
ασφαλές. Αποτέλεσμα: `arrayActionInterceptor` σταθερό → `onAction` σταθερό → `ribbonCommands` ref-stable →
`RibbonRoot.memo` κρατά → το ribbon μένει στατικό σε document edits (Revit / Cinema4D command-bar doctrine).

**Αρχείο:** `app/useDxfViewerCallbacks.ts` (swap `React.useCallback(…, [deps])` → `useEventCallback(…)`).
**Tests:** useEventCallback 4/4 + scene-selectors 10/10 GREEN. ADR-040: μη-canvas αρχείο → CHECK 6B/6D off.

**File-size split (N.7.1):** το `useEventCallback` σχόλιο έσπρωξε το `useDxfViewerCallbacks.ts` στις 506 γρ.
(> 500, CHECK 4). Ο μεγάλος special-action switch εξήχθη σε νέο SRP module
`app/dxf-special-actions.ts` → `dispatchDxfSpecialAction(action, deps): boolean` (true=handled, false=fall
through στο base `handleAction`). Pure dispatch, μηδέν hooks/state· deps διαβάζονται event-time. Host 299 γρ.,
module 271 γρ. Συμπεριφορά αμετάβλητη (ίδιοι κλάδοι, ίδια σειρά).

## 5.ter Υλοποίηση (Stage 4 Option A — leaf-button memo + context split — 2026-06-28)

**Εύρημα profile 11:51 (μετά το §5.bis):** το `wrappedHandleAction` fix ήταν **απαραίτητο αλλά ανεπαρκές μόνο
του**. Το `RibbonRootInner [props:commands]` re-render-άρε ΑΚΟΜΑ σε κάθε edit/selection (Ribbon/Radix subtree
55-101ms, 365-801 fibers). Αιτία: τα **36 BIM bridges** είναι δεμένα σε ΕΝΑ `ribbonCommands` object· κάθε bridge
εξαρτάται από ολόκληρο το `levelManager` + το επιλεγμένο entity → έστω ΕΝΑ bridge αλλάζει ταυτότητα → churn
ολόκληρου του ribbon (όλα τα tabs + 75 Tooltips), όχι μόνο του ενεργού contextual panel.

**Απόφαση (Giorgio Option A):** memoize τα leaf buttons + per-key subscription· το ribbon shell ΕΠΙΤΡΕΠΕΤΑΙ να
re-render-άρει αλλά τα ~60+ tool buttons + τα Tooltips τους bail-άρουν. Big-player: στατική command-bar.

**Υλοποίηση — context split (μίμηση God-context split ADR-341):**
- `context/RibbonCommandContext.tsx` — ΕΝΑ context → **ΔΥΟ**:
  - `RibbonDispatchContext` (**σταθερό** σε edits/selection): `activeTool`, `onToolChange`, `onComingSoon`,
    `onAction`, `canUndo/Redo`, `getCommandRecommendation`, `splitLastUsed/setSplitLastUsed`. Churn μόνο σε
    tool-change / undo-state / storey / split-pick — ΟΧΙ σε edit/selection.
  - `RibbonFieldContext` (**volatile**): `onToggle/onComboboxChange/getToggleState/getComboboxState/`
    `getBadgeState/getPanelVisibility`. Churn σε edit/selection ΩΣΤΕ τα value widgets του ενεργού panel να
    ξαναδιαβάσουν την τρέχουσα τιμή (correctness — μηδέν stale).
  - `useRibbonCommand()` = backward-compat combiner (οι 12 υπόλοιποι consumers αμετάβλητοι).
- `hooks/useRibbonCommands.ts` — `onAction` → `useEventCallback` (σταθερή ταυτότητα, διαβάζει latest bridges
  στο click-time) ώστε το dispatch context να ΜΕΝΕΙ σταθερό παρότι το `ribbonCommands` object churn-άρει.
- `RibbonLargeButton`/`RibbonSmallButton`/`RibbonSplitButton` → `useRibbonDispatch()` + `React.memo` (split
  ήταν ήδη memo)· `command`/`button` prop = static config → bail σε edit/selection → τα 75 Radix Tooltips
  δεν ξαναζωγραφίζουν.

**Γιατί δεν σπάει value display:** τα value widgets (Combobox/Toggle) μένουν στο volatile field context →
re-render κανονικά σε selection/edit. Μόνο τα tool buttons (Home/Insert/contextual — η πλειονότητα) bail.

**Αρχεία (5):** `RibbonCommandContext.tsx`, `useRibbonCommands.ts`, `RibbonLargeButton.tsx`,
`RibbonSmallButton.tsx`, `RibbonSplitButton.tsx`. **Tests:** ribbon action+combobox 24/24 GREEN. ADR-040:
μη-canvas (ribbon UI) → CHECK 6B/6D off.

**Επαλήθευση profile 12:13:** wall EDIT (#9) → `RibbonRootInner` **ΔΕΝ render-άρει**, ribbon subtree
**72 fibers / 8.8ms** (ήταν ~400-800 / 55-101ms)· tool buttons + 75 Tooltips bail ✅. Wall SELECT (#8, 259ms)
→ tool buttons ΕΦΥΓΑΝ από top-18, αλλά νέος κυρίαρχος = mount των Radix Select comboboxes του contextual panel.

### Follow-up (lazy combobox options — `RibbonCombobox.tsx`)
Το #8 (259ms) είχε `SelectItem ×76` (19.7ms) + SelectItemText/CollectionSlot: 7× `RibbonComboboxDefault`
mount-άρουν ~11 options έκαστο **eager**. Fix: κρατάμε mounted **μόνο το επιλεγμένο item** όταν κλειστό
(`renderedOptions = open ? options : [selectedOption]`) + **controlled `open`** → 76→~7 items στο mount.
Radix `<SelectValue>`/value-sync/keyboard/a11y **ανέπαφα** (το selected item μένει registered στο collection).
🔴 **Browser-verify ΥΠΟΧΡΕΩΤΙΚΟ** (Radix open/display/keyboard) + family/type widgets (RibbonWall/Slab/Opening
FamilyType) = ίδιο pattern follow-up αν συνεισφέρουν.

## 5.quater Υλοποίηση (Stage 4 Option B — full retained-mode / per-key binding — 2026-06-28)

**Κίνητρο (Giorgio «full Revit-grade»):** μετά τα A + lazy-items, το μόνο μη-retained κομμάτι ήταν τα **live
πεδία του ενεργού contextual panel**: μοιράζονταν το volatile `RibbonFieldContext` → edit **ενός** πεδίου
(π.χ. πάχος τοίχου) ξαναζωγράφιζε **όλα** τα ~7-11 value widgets μαζί (React equivalent ενός non-retained UI).
Στόχος: `INotifyPropertyChanged`/signal — κάθε control ενημερώνεται **μόνο** όταν αλλάξει η δική του ιδιότητα.

**SSoT reuse (ΟΧΙ νέος μηχανισμός):** μίμηση του **`useSceneSelectors`** (ADR-547 Stage 2/3) = `useSyncExternalStore`
πάνω σε zero-React store με per-key **reference-stable slices** (ίδιο doctrine με canvas micro-leaf, ADR-040).

**Υλοποίηση:**
- NEW `context/ribbon-command-types.ts` — value types (`RibbonComboboxState`/`RibbonToggleState`/`RibbonActionPayload`)
  εκτός React module (σπάει context↔store cycle)· το `RibbonCommandContext` τα re-export-άρει (backward compat).
- NEW `context/RibbonFieldStore.ts` — zero-React store· `setRibbonFieldReaders` (push από provider) + per-key
  `getRibbon{Combobox,Toggle,Badge,PanelVisibility}Slice`. Combobox slice = **signature-gated stable ref**
  (`value|disabled|optionValues`) → ίδιο ref όσο δεν κινείται η τιμή (gate για useSyncExternalStore· no loop).
- NEW `context/useRibbonFieldSelectors.ts` — `useRibbon{Combobox,Toggle,Badge,PanelVisibility}State(key)` leaves.
- NEW `context/__tests__/RibbonFieldStore.test.ts` — **9 jest**: per-key isolation (edit A → B ίδιο ref),
  stable-ref invariant, value/option/disabled signature, primitives, subscribe/unsub, reset.
- `RibbonCommandContext.tsx` — οι field WRITERS (`onToggle`/`onComboboxChange`) → STABLE dispatch context
  (useEventCallback)· οι field READERS βγήκαν από context → push στον store (useLayoutEffect κάθε commit).
- `useRibbonCommands.ts` — `onToggle`/`onComboboxChange` → `useEventCallback`.
- `RibbonCombobox.tsx`/`RibbonToggleButton.tsx`/`RibbonTabItem.tsx` — writer από `useRibbonDispatch()`, value από
  per-key selector, **`React.memo`** → edit άλλου πεδίου = no-op.

**Αποτέλεσμα:** edit «πάχος τοίχου» → store notify → **μόνο** το thickness slice αλλάζει → **μόνο** το thickness
combobox re-render-άρει· material/type/badge bail (slice ίδιο ref). Πλήρες per-control binding = retained-mode
parity για το panel. **Tests:** 33/33 (9 store + 17 combobox + 7 action). 🔴 browser-verify.

## 6. Εκκρεμή / ρίσκα

- 🔴 **Browser-verify:** edit column → μόνο ColumnHost + canvas + column panel re-render (όχι οι 26 άλλοι)·
  re-profile (React-DevTools «Record why each component rendered» **ON** — τα προηγούμενα exports ήταν OFF).
  Ρεαλιστικός στόχος: **2695 → ~600-800 fibers**, ΟΧΙ →0 (canvas+panel+widget είναι εγγενή).
- 🔴 **MepSystem hooks** follow-up (τότε Stage 5 retire του prop).
- ⚠️ Multi-agent shared tree (ADR-040/532/3D agents).

## 7. Changelog

- **2026-06-28** — Stage 4 **Option B** IMPLEMENTED (UNCOMMITTED, Opus 4.8): full retained-mode / per-key field
  binding. NEW `RibbonFieldStore` + `useRibbonFieldSelectors` (μίμηση `useSceneSelectors`)· value widgets
  (Combobox/Toggle/TabItem-badge) → per-`commandKey` `useSyncExternalStore` + `React.memo` → edit ενός πεδίου
  re-render-άρει ΜΟΝΟ αυτό το control. Writers → stable dispatch (useEventCallback). 9 store jest / 33 σύνολο.
  Βλ. §5.quater. 🔴 browser-verify.
- **2026-06-28** — Stage 4 Option A **follow-up** (UNCOMMITTED, Opus 4.8): lazy combobox options. Profile 12:13
  επαλήθευσε ότι ο cascade έσπασε (edit #9: 72 fibers/8.8ms)· νέος κυρίαρχος = 76 eager SelectItems στο panel
  mount. `RibbonCombobox.tsx`: κρατάμε mounted μόνο το selected item όταν κλειστό + controlled `open` → 76→~7.
  17/17 combobox jest. 🔴 browser-verify (Radix). Βλ. §5.ter follow-up.
- **2026-06-28** — Stage 4 **Option A** IMPLEMENTED (UNCOMMITTED, Opus 4.8): leaf-button memo + context split.
  Profile 11:51 απέδειξε ότι το wrappedHandleAction fix ήταν ανεπαρκές (ribbon churn-άρε ακόμα μέσω 36 bridges).
  `RibbonCommandContext` → dispatch(σταθερό)+field(volatile)· `onAction`→`useEventCallback`· Large/Small/Split→
  `useRibbonDispatch`+`React.memo` → tool buttons + 75 Tooltips bail σε edit/selection. 5 αρχεία, 24/24 jest. Βλ. §5.ter.
- **2026-06-28** — Stage 4 IMPLEMENTED (UNCOMMITTED, Opus 4.8): ribbon/TopBar cascade. `wrappedHandleAction`
  → `useEventCallback` (root cause: `useFullscreen()` fresh-object dep churn). `ribbonCommands` ref-stable →
  `RibbonRoot.memo` κρατά → Radix/Tooltip subtree μένει στατικό σε edits. 1 αρχείο, 14/14 jest GREEN. Βλ. §5.bis.
- **2026-06-28** — Stage 4 file-size split (UNCOMMITTED, Opus 4.8): special-action switch → νέο
  `app/dxf-special-actions.ts` (`dispatchDxfSpecialAction`) ώστε `useDxfViewerCallbacks.ts` 506→299 γρ. (CHECK 4).
  Καθαρό SRP extract, μηδέν αλλαγή συμπεριφοράς. Βλ. §5.bis.
- **2026-06-28** — Stage 2/3 IMPLEMENTED (UNCOMMITTED, Opus 4.8): granular selectors + 27 hosts migrated +
  `React.memo`. Διορθωμένη ρίζα (§2: memo, όχι context-ref). 10 νέα jest / 20 scene jest GREEN / tsc 0.
- **2026-06-28** — Stage 0 COMMITTED `d0913846`: `SceneStore` SSoT + thin `useSceneManager` adapter.
