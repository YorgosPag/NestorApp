# HANDOFF 2026-06-28 — Ribbon/TopBar cascade: Η ΠΡΑΓΜΑΤΙΚΗ ΡΙΖΑ = `levelManager` churn

**Profiler:** `C:\Users\user\Downloads\profiling-data.28-06-2026.11-47-13.json` (React DevTools, 35 commits,
«record why» ON). Ανάλυση script: `scratchpad/` (per-commit reasons + id→displayName).
**Working tree: SHARED** με agent ADR-547 (scene/MEP cascade). ❌ ΟΧΙ commit (ο Giorgio committ-άρει). ❌ ΟΧΙ `--no-verify`.

---

## ✅ STATUS UPDATE 2026-06-28 (Opus 4.8) — Fix C ΥΛΟΠΟΙΗΘΗΚΕ (ADR-548)

Και οι 2 churn vectors σε edit έκλεισαν:
- **(a) Fix A** — `useImportWizard.ts` memoized (ήδη, UNCOMMITTED).
- **(b) Fix C** — οι `getCurrentFileName`/`getAutoSaveStatus` **αφαιρέθηκαν** εντελώς (όχι ref-stable —
  μόνος consumer ήταν το AutoSaveStatus). Το volatile save-status πήγε σε **NEW `stores/AutoSaveStatusStore.ts`**
  (zero-React, `useSyncExternalStore`, mirror του `CompletionStyleStore`). Writer = ΕΝΑΣ effect στο
  `useAutoSaveSceneManager`. Reader = `AutoSaveStatus.tsx` via `useAutoSaveStatus()`.
- **(c)** δεν χτυπά σε edit (μόνο Firestore snapshot) → ΟΚ.

Αρχεία: NEW `stores/AutoSaveStatusStore.ts` + test (5 jest GREEN) · `useAutoSaveSceneManager.ts` (writer effect) ·
`AutoSaveStatus.tsx` (store reader) · `LevelsSystem.tsx` (getters removed: def+return+deps) ·
`useLevels.ts` (2 optional type fields removed). **ADR-548** + adr-index ενημερωμένα.
`CentralizedAutoSaveStatus` = ΑΣΧΕΤΟ (διαβάζει `useSettingsSaveStatusOptional`, ADR-341) → μηδέν regression εκεί.

🔴 ΕΚΚΡΕΜΕΙ: browser re-profile («record why» ON, self-time top-25) — επιβεβαίωση ότι save cycle re-render-άρει
ΜΟΝΟ το AutoSaveStatus, όχι ribbon/tooltips · μετά commit (Giorgio).

---

## 0. Συμπτώματα (profile 11:47)
- **69% του session σε render** (2.595ms / 3.776ms wall). 10 commits >150ms (έως 236ms), ~1.600 fibers ο καθένας.
- Top self-time = **Ribbon + Radix tree**: `Tooltip/TooltipTrigger/TooltipContent ×903`, `RibbonSplitButtonInner`,
  `RibbonSmallButton/LargeButton`, `RibbonTabItem`, `Primitive.button ×453`.
- changeDescriptions: **context-changed** σε ΟΛΟ το ribbon (RibbonTabItem ×182, SplitButton ×169, Small ×143, Large ×130).
- Updaters των βαρέων commits = **providers**: `LevelsSystem`, `EnterpriseDxfSettingsProvider`, `OverlayStoreProvider`,
  `CursorSystem`. Changed prop ρητά: **`levelManager:52`**.

## 1. ΡΙΖΑ (επαληθευμένη στον κώδικα, ΟΧΙ το God-context split)

```
entity edit → SceneStore.emit() (record = {...record,[levelId]:scene})
  → LevelsSystem re-render (useSyncExternalStore μέσω useAutoSaveSceneManager→useSceneManager→levelScenes)
    → LevelsContext useMemo (LevelsSystem.tsx:358) ΣΚΑΕΙ γιατί deps churn:
        (a) 7 import-wizard callbacks  [useImportWizard un-memoized → useLevelImportWizardOps deps]
        (b) getCurrentFileName/getAutoSaveStatus  [dep [sceneManager], sceneManager νέο κάθε edit]
        (c) level-ops (addLevel/removeLevel/renameLevel/…)  [dep [levels] — μόνο σε Firestore snapshot, ΟΧΙ κάθε edit]
      → levelManager = ΝΕΟ reference
        → useDxfBimBridges: ~40 bridges churn (κάθε useCallback έχει levelManager dep)
          → useRibbonCommands: 7 useCallback (onAction/onToggle/getComboboxState/…) recompute
            → ribbonCommands = ΝΕΟ ref → RibbonRoot React.memo ΣΠΑΕΙ
              → RibbonCommandContext.value αλλάζει → ΟΛΟ το ribbon + Tooltip ×903 re-render
```

**Γιατί ΟΧΙ το God-context split ως primary:** το split προστατεύει **μόνο 2/12** consumers (DISPATCH-ONLY:
`ZoomControlsWidget`, `RibbonSplitDropdown`). Οι 10 STATE-READER/MIXED (όλα τα buttons διαβάζουν `activeTool` κ.λπ.)
**συνεχίζουν** να re-render-άρουν όσο churn-άρει ο `levelManager`, γιατί οι getters εξαρτώνται από τους bridges.
→ Το split ΜΟΝΟ του ΔΕΝ σταματά το cascade. `universalSelection` είναι ΗΔΗ stable (ADR-532 B6).

## 2. ✅ ΕΓΙΝΕ (UNCOMMITTED) — Fix A (ασφαλές, prerequisite)
**`hooks/common/useImportWizard.ts`** — και οι 9 μέθοδοι σε `useCallback` + return σε `useMemo`.
- Deps: action setters → `[]` (setImportWizard stable). `validateImportData` → `[importWizard]`.
  `completeImport` → `[importWizard, validateImportData]`.
- Αφαιρεί το dep (a). 1 αρχείο, type-safe (SKIP tsc per workflow). **Μόνο του ΔΕΝ σταματά το cascade** (μένει το (b)).

## 3. 🔴 ΕΠΟΜΕΝΟ — Fix C (ο πραγματικός cascade-killer, reactivity-sensitive)
**Στόχος:** ref-stable `getCurrentFileName`/`getAutoSaveStatus` ώστε ο `levelManager` να ΜΗΝ αλλάζει σε edit.

`LevelsSystem.tsx:347-351` — αλλάζουν deps `[sceneManager]` → `sceneManagerRef.current` (υπάρχει ΗΔΗ ref γρ.71-72,
το χρησιμοποιούν setLevelScene/getLevelScene· το σχόλιο γρ.344-346 ΛΕΕΙ «ref-stable» αλλά ο κώδικας δεν το κάνει):
```ts
const getCurrentFileName = useCallback(() => sceneManagerRef.current.currentFileName, []);
const getAutoSaveStatus = useCallback(() => ({ lastSaveTime: sceneManagerRef.current.lastSaveTime, saveStatus: sceneManagerRef.current.saveStatus }), []);
```

**⚠️ ΡΙΣΚΟ REGRESSION:** ο `ui/components/AutoSaveStatus.tsx` (γρ.17-18) διαβάζει
`levelsSystem.getCurrentFileName()/.getAutoSaveStatus()` στο render και βασίζεται στην αλλαγή του `levelManager`
identity για να ανανεωθεί. Με ref-stable getters → **κολλάει** ο indicator. Επίσης `CentralizedAutoSaveStatus`
(profile ×18) — έλεγξε ΚΑΙ αυτόν (grep, πιθανός δεύτερος consumer).

**ΛΥΣΗ (SSoT, μηδέν regression):** dedicated reactive κανάλι ΜΟΝΟ για το status. Το status είναι local `useState` στο
`useAutoSaveSceneManager.ts` (γρ.82-83 `lastSaveTime`/`saveStatus`, γρ.76 `currentFileName`). Επιλογές:
- **(προτιμώμενο, ADR-040 doctrine)** module store (όπως HoverStore/ImmediatePositionStore) γραμμένο από τους setters
  του useAutoSaveSceneManager, read από AutoSaveStatus μέσω `useSyncExternalStore`. ΠΛΗΡΗΣ αποσύνδεση από levelManager.
- (απλούστερο) μικρό `AutoSaveStatusContext` με `{currentFileName,saveStatus,lastSaveTime}`, provider στο `LevelsSystem`.
- **ΠΡΩΤΑ SSoT audit (grep)** — μήπως υπάρχει ήδη status store/emitter πριν φτιάξεις νέο.

Μετά το Fix C: `levelManager` reference-stable σε edit → bridges σταθεροί → ribbonCommands σταθερό → **cascade ΝΕΚΡΟ**.
(Ο LevelsSystem ΑΚΟΜΑ re-render-άρει σε edit, αλλά φθηνά: memo bail. Fix B = να μην re-render-άρει καθόλου — optional,
deeper· αποσύνδεση useAutoSaveSceneManager από LevelsSystem render. ΟΧΙ απαραίτητο για το cascade.)

## 4. 🟡 Layer 2 (optional defense-in-depth) — God-context split (ADR-341 doctrine)
Μετά το Fix C, το ribbon re-render-άρει μόνο σε νόμιμη αλλαγή `activeTool`/`canUndo`/toggle/combobox. Split:
- **RibbonDispatchContext** (stable, ref-indirection): `onToolChange,onComingSoon,onAction,onToggle,onComboboxChange,setSplitLastUsed`.
- **RibbonStateContext** (reactive): `activeTool,canUndo,canRedo,getToggleState,getComboboxState,getBadgeState,getPanelVisibility,getCommandRecommendation,splitLastUsed`.
- Consumers (12 total, audited): DISPATCH-ONLY=2, STATE-READER=2 (`RibbonTabItem`/getBadgeState, `RibbonBody`/getPanelVisibility),
  MIXED=8. Most-used reactive field = **`activeTool`** (RibbonSmall/Large/SplitButton).
- Files: `ui/ribbon/context/RibbonCommandContext.tsx` (split) + 12 consumer migrations.
- **Re-profile ΠΡΙΝ** το κάνεις — μετά το Fix C ίσως δεν αξίζει (μην gold-plate).

## 5. Επαλήθευση / κανόνες
- **Re-profile** «record why» ON· στόχος = να φύγει το Ribbon/Tooltip subtree από τους βαρείς commits (self-time top-25),
  ΟΧΙ μόνο fiber count.
- ADR-040 CHECK 6B/6D: LevelsSystem/useImportWizard/AutoSaveStatus **ΔΕΝ** είναι στη λίστα → χωρίς ADR-040 staging.
  Σχετίζεται με ADR-547 (ο άλλος agent το αγγίζει — συντονισμός για changelog).
- N.17: ΕΝΑ tsc τη φορά. N.(-1): ΟΧΙ commit/push χωρίς εντολή Giorgio.
- jest: τρέξε levels + ribbon suites μετά το Fix C.

## 6. Αρχεία-κλειδιά
- `systems/levels/LevelsSystem.tsx` (value memo 358-441· getters 347-351· sceneManagerRef 71-72).
- `hooks/common/useImportWizard.ts` (Fix A ✅).
- `hooks/scene/useAutoSaveSceneManager.ts` (status useState 76/82/83).
- `ui/components/AutoSaveStatus.tsx` (consumer 17-18).
- `app/useDxfViewerRibbon.ts` → `ui/ribbon/hooks/useRibbonCommands.ts` (40-bridge memo) → `app/useDxfBimBridges.ts`.
- `ui/ribbon/context/RibbonCommandContext.tsx` (Layer 2 split target).
