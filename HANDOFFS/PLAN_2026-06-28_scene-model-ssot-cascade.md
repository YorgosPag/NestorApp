# PLAN 2026-06-28 — Scene-model SSoT: σπάσιμο του scene-change re-render cascade

**Status:** 📋 PROPOSED PLAN (όχι υλοποιημένο). Να γίνει **ADR-547** (επιβεβαίωσε τον αριθμό στο
`adr-index.md` τη στιγμή της υλοποίησης — concurrent agents· highest ήταν ADR-546 στις 2026-06-28).
**Domains:** scene state (SceneModel SSoT), perf (re-render cascade), bim properties, persistence hosts.
**Πηγή:** React-DevTools Profiler `profiling-data.28-06-2026.03-09-14.json`, **commit#24 = 252ms / 2695 fibers**
(ολόκληρο το δέντρο) σε **μία αλλαγή παραμέτρου κολόνας**. Συνέχεια της δουλειάς ADR-532 (selection SSoT)
+ ADR-341 (settings save-status split) — αυτό είναι ο **scene-axis analog** του ίδιου προβλήματος.
**Σχετικά ADR:** ADR-532 (selection-set SSoT — το pattern να μιμηθούμε), ADR-040 (micro-leaf doctrine),
ADR-341 (God-context split προηγούμενο).

---

## 1. Επιβεβαιωμένη ρίζα (file:line evidence)

Το `SceneModel` ανά level ζει στο **`useSceneManager.levelScenes`** (React state σε context) και
prop-drillάρεται μονολιθικά παντού. Κάθε edit οντότητας → νέα αναφορά `currentScene` → re-render όλων.

| Βήμα | Αρχείο | Τι |
|---|---|---|
| edit → νέο scene | `systems/entity-creation/LevelSceneManagerAdapter.ts:199-212` | `updateEntity` φτιάχνει **νέο** `{...scene, entities:[...]}` (σωστό — το περιεχόμενο όντως άλλαξε) |
| store write | `hooks/scene/useSceneManager.ts:30-45` | `setLevelScene` → `setLevelScenes(next)` (React state· early-exit μόνο σε ίδια αναφορά) |
| context value | `hooks/scene/useSceneManager.ts:71-79` | memo dep `[levelScenes]` → νέα context αναφορά |
| derive | `hooks/scene/useSceneState.ts:49` | `currentScene = getLevelScene(currentLevelId)` (όχι memo· ΟΜΩΣ `getLevelScene` διαβάζει ref → **ίδια αναφορά μεταξύ edits**, νέα **μόνο** σε edit) |
| orchestrator | `app/DxfViewerContent.tsx` (`useDxfViewerState` → `wrappedState` memo dep `[state]`) | ο orchestrator **re-renderάρει σε κάθε scene edit** → επισκέπτεται όλο το render output |
| prop-drill | `app/DxfViewerTopBar.tsx` | `currentScene` → **28 persistence hosts** + `RibbonContextualTabScope` |
| panel | `ui/column-advanced-panel/ColumnPropertiesTab.tsx:45-49` | `column = useMemo(... [primarySelectedId, currentScene])` → νέο `currentScene` rebuild |

**⚠️ Λάθος «εύκολο fix»:** «memoize το `currentScene`» ΔΕΝ βοηθά — το περιεχόμενο όντως άλλαξε, άρα νέα
αναφορά είναι σωστή. Το πρόβλημα είναι το **εύρος του prop-drill**, όχι η αναφορά.

## 2. Τι είναι εγγενές vs σπατάλη (ειλικρινής διάκριση)

Σε αλλαγή γεωμετρίας κολόνας, **ΠΡΕΠΕΙ** να re-renderάρουν (~500-800 fibers, αναπόφευκτο):
- Ο **canvas** (ξαναζωγραφίζει — ADR-040 bitmap cache ήδη το μετριάζει).
- Το **column properties panel** (νέες τιμές).
- Το **column ribbon widget** (νέες διαστάσεις).

**Σπατάλη** (~1900 fibers — ο στόχος μας):
- Ο orchestrator `DxfViewerContent` re-renderάρει → επισκέπτεται ΟΛΟ το subtree (κι ας κάνουν memo-bail τα παιδιά).
- **27 άσχετοι persistence hosts** (Wall/Slab/Mep/…) re-renderάρουν (render null — φθηνά αλλά αθροίζονται).
- **Άσχετα ribbon panels** + side panels (`LayersSection`/`LevelPanel`/`FloatingPanelContainer`).

## 3. Αρχιτεκτονική απόφαση — μιμήσου το ADR-532

Κάνε το `SceneModel` **SSoT store με granular selectors** (όπως το `SelectedEntitiesStore`):
- **`SceneStore`** (zero-React ή external store ανά level) = η πηγή αλήθειας· οι mutators γράφουν εκεί.
- **Granular leaf hooks** (`useSyncExternalStore` + reference-stable cached slices):
  - `useSceneEntitiesByType(type)` → ένας host re-renderάρει **μόνο** όταν αλλάζει ο ΔΙΚΟΣ του τύπος.
  - `useEntityById(id)` → το properties panel re-renderάρει **μόνο** όταν αλλάζει η ΕΠΙΛΕΓΜΕΝΗ οντότητα.
  - `useSceneVersion()` → για όσους θέλουν «κάτι άλλαξε» χωρίς τα entities.
- **Orchestrators** (`DxfViewerContent`) διαβάζουν **event-time** (`SceneStore.getCurrentScene()`), ΟΧΙ subscription → παύουν να re-renderάρουν σε scene edit (ακριβώς το ADR-532 B5 για το selection).

## 4. Σταδιακό πλάνο (ROI-ordered, incremental — κάθε stage profile-verified)

> **Προαπαιτούμενο:** re-profile μετά από ΚΑΘΕ stage (React-DevTools Profiler «Record why each
> component rendered» ON αυτή τη φορά — στα προηγούμενα exports ήταν OFF → `changeDescriptions:0`).

- **Stage 0 (foundation) — ✅ ΕΓΙΝΕ (2026-06-28, UNCOMMITTED):** NEW `systems/scene/SceneStore.ts`
  (zero-React singleton SSoT για το `Record<levelId, SceneModel>`· mirror `SelectedEntitiesStore` —
  getRecord/getLevelScene/setLevelScene/clear*/subscribe/version/`_resetForTests`· no-op guard +
  sync-write invariant για CompoundCommand). Ο `hooks/scene/useSceneManager.ts` έγινε **thin adapter**
  (`useSyncExternalStore(subscribeScene, getSceneRecord)` + stable store mutators· public
  `SceneManagerState` API αμετάβλητο). NEW `systems/scene/__tests__/SceneStore.test.ts` (13).
  **Behavior-identical επιβεβαιωμένο:** 25/25 (SceneStore + useAutoSaveSceneManager origin-gate +
  orphaned-target + LevelSceneManagerAdapter singleton) + 113/113 levels-system GREEN. Δεν υλοποιήθηκαν
  ακόμη granular slices (`useSceneEntitiesByType`/`useEntityById`) — έρχονται όταν τα καταναλώσει το
  Stage 2/3 (όχι speculative API). Μηδέν perf win ακόμη — θεμέλιο.
  > **Pro-snap εύρημα (resolved):** το 2ο call-site `useProSnapIntegration` κρατούσε ΞΕΧΩΡΙΣΤΟ άγραφο
  > `useState({})` → `getLevelScene` πάντα null → ο pro-snap τροφοδοτούσε **νεκρό** `stats.entityCount`
  > (κανείς consumer δεν το διαβάζει· `CadDock`/`StandaloneStatusBar` παίρνουν μόνο
  > `enabledModes`/`toggleMode`/`snapEnabled`). Ο πραγματικός snap engine παίρνει entities από
  > `SnapOrchestrator`/`snapping/engines`. Άρα το singleton **ενοποιεί** τις 2 πηγές (διορθώνει latent
  > SSoT violation) με **μηδενικό λειτουργικό αντίκτυπο** στον pro-snap (μόνο 1 extra mount render).
- **Stage 1 (orchestrator severance — ΥΨΗΛΟ ROI):** το `DxfViewerContent` παύει να subscribe-άρει στο
  `currentScene` (event-time read). Οι reactive consumers → leaf hosts/hooks. Στόχος: ο orchestrator
  ΟΧΙ updater σε scene edit → καταρρέει το «επίσκεψη όλου του δέντρου».
- **Stage 2 (persistence hosts):** οι 28 hosts → `useSceneEntitiesByType(<δικός τους τύπος>)` αντί για
  `currentScene` prop. Ένα column edit re-renderάρει μόνο τον ColumnHost (όχι τους άλλους 27).
- **Stage 3 (properties panel + ribbon bridges):** `ColumnPropertiesTab`/`*AdvancedPanel` + BIM ribbon
  bridges → `useEntityById(primarySelectedId)`. Re-render μόνο όταν αλλάζει η επιλεγμένη οντότητα.
- **Stage 4 (side panels):** `LayersSection`/`LevelPanel`/`FloatingPanelContainer` → granular slice.
- **Stage 5 (retire):** αφαίρεση του μονολιθικού `currentScene` prop-drill όπου έγινε περιττό.

## 5. Ρίσκα / open questions

- **Μεγάλο εύρος:** ~28 hosts + scene-state migration + properties + ribbon = orchestrator-scale (N.8).
  Να γίνει σταδιακά με adapter (Stage 0) ώστε κάθε stage να είναι ανεξάρτητα commit-able & reversible.
- **Multi-agent shared tree:** ADR-040 / ADR-532 / 3D agents αγγίζουν τα ίδια αρχεία. Συντόνισε
  staging (CHECK 6B/6D → stage ADR-040 + το νέο ADR-547).
- **Canvas correctness:** ο canvas ΠΡΕΠΕΙ να βλέπει την πλήρη scene — βεβαιώσου ότι το store γράφει
  **πριν** το redraw (το `levelScenesRef` sync-write pattern ήδη το εξασφαλίζει· διατήρησέ το).
- **undo/redo:** οι commands διαβάζουν `getLevelScene()` σειριακά (CompoundCommand) — το store πρέπει να
  κρατήσει το ίδιο sync-write-then-read invariant (`useSceneManager.ts:37-43`).
- **Εγγενές υπόλοιπο:** ακόμη κι όλα τέλεια, ένα column edit θα re-renderάρει canvas+panel+widget
  (~500-800 fibers). Ο ρεαλιστικός στόχος: **2695 → ~600-800**, ΟΧΙ →0.

## 6. Πηγή / context

- Root-cause trace: Explore subagent (2026-06-28), επιβεβαιωμένο χειροκίνητα σε `useSceneState.ts:49`
  + `useSceneManager.ts:30-45,71-79`.
- Pattern προς μίμηση: `ADR-532-selection-set-ssot.md` (ίδιο πρόβλημα, selection axis — Stage A→C).
- [[feedback_giorgio_ssot_audit_before_new_mechanism]] — grep υπάρχουσα υποδομή ΠΡΙΝ νέο store
  (reuse `SelectedEntitiesStore` patterns/helpers· μην ξαναγράψεις generic factory).
