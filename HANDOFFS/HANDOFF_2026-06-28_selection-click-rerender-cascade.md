# HANDOFF 2026-06-28 — Click-select re-render cascade (INP / ribbon / dialogs)

**Θέμα:** κλικ-επιλογή entity στο DXF/BIM viewer προκαλεί τεράστιο σύγχρονο React commit.
**ADR:** `docs/centralized-systems/reference/adrs/ADR-532-selection-set-ssot.md` (changelog ενημερωμένο — Stage A-fix + B6). Όλη η τεχνική λεπτομέρεια εκεί.

---

## 📊 ΜΕΤΡΗΣΕΙΣ (ground truth)

**React DevTools Profiler** (`C:\Users\user\Downloads\profiling-data.28-06-2026.02-09-41.json`) — το click-select = **commit#8: 243ms, ~1500 fibers**, κατανεμημένα:

| Κατηγορία | self-ms | fibers |
|---|---|---|
| Other (ribbon children, hosts, icons, toggles, `#NNNN`) | 89.8 | 786 |
| Dialogs (όλα τα dialog hosts στο `DxfViewerDialogs`) | 42.7 | 117 |
| Ribbon | 39.7 | 96 |
| Tooltips/Portals/Presence (κυρίως παιδιά ribbon buttons) | 20.4 | **302** |
| ContextMenus | 14.0 | 67 |
| Canvas2D+3D | 16.2 | 43 |
| Panel+StatusBar+PersistenceHost | 20.2 | 85 |

> Το αρχικό Chrome Performance trace (`Trace-20260628T012423.json.gz`) έδειχνε INP 1868ms/proc 1480ms — **φουσκωμένο** από dev-mode + React DevTools extension (`installHook.js`) + CPU profiler (`CpuProfiler::StartProfiling` 2480ms). Το πραγματικό κόστος είναι τα **243ms** του React Profiler (κι αυτό dev). Scripts ανάλυσης: scratchpad `react-prof*.js`, `analyze.js`, `profile.js`, `inclusive.js`.

**Καλό νέο:** οι orchestrators (`DxfViewerContent`/`DxfViewerApp`/`SelectionSystem`) **ΔΕΝ** re-renderάρουν (severance προηγούμενων ADR-532 stages B4/B5 δουλεύει).

**Root pattern:** το ADR-532 «έσπρωξε subscriptions στα leaves» — αλλά ~10 leaves (TopBar→ribbon, `DxfViewerDialogs`→dialogs, tooltips, context menus, canvas, 3D) subscribάρουν στο selection και το καθένα renderάρει μεγάλο **unmemoized subtree**.

---

## ✅ ΤΙ ΕΓΙΝΕ (UNCOMMITTED — όλα στο working tree, καθαρό git πριν)

**Phase 1 — idempotent reducer** (root #1):
- `src/subapps/dxf-viewer/systems/selection/useSelectionReducer.ts` — το `SYNC_UNIVERSAL_LEGACY` επιστρέφει **ίδιο `state`** όταν δεν αλλάζει τίποτα (πριν: `{ ...state }` νέα αναφορά κάθε dxf-click → context value churn → re-render όλων των `useContext(SelectionContext)`).
- `.../__tests__/selection-legacy-mirror.test.tsx` — +1 test (referential stability). **5/5 + 87/87 selection suite GREEN.**

**Phase 2 Stage 1 — ribbon commands decoupled** (root #2, μέρος 1):
- `src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx` (γρ. 29 import + γρ. ~91-95):
  - `useUniversalSelection()` → **`useUniversalSelectionStable()`** (reference-stable facade· bridges διαβάζουν live getters event-time → σταθερά `useCallback` deps → `ribbonCommands` memo holds → `RibbonRoot` `React.memo` ΔΕΝ σπάει από το commands ref).
  - `primarySelectedId`/`selectedEntityIds` → reactive `usePrimarySelectedId()`/`useSelectedEntityIds()` (μόνο αυτά τρέφουν contextual-tab trigger + persistence hosts).
- **✅ ΕΠΙΒΕΒΑΙΩΜΕΝΟ LIVE** στο build (Sources tab, γρ. 29 — screenshot 02:18).
- Type-clean (`UniversalSelectionHook`/`string|null`/`string[]`). Δεν γίνεται jest-verify (TopBar render σε jsdom τραβά Firestore/auth).

**ADR:** `ADR-532` changelog — entries «2026-06-28 Stage A-fix» + «Stage B6».

**ΑΠΟΤΕΛΕΣΜΑ:** Stage 1 σωστό θεμέλιο αλλά **αόρατο στο profile** — το ribbon ΑΚΟΜΑ renderάρει (96 fibers) γιατί το επισκιάζει το Stage 2 (κάτω).

---

## 🔴 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (σχέδιο, με re-profile μετά από ΚΑΘΕ βήμα)

### Stage 2 — ribbon: `activeContextualTrigger` → leaf subscription ✅ ΕΓΙΝΕ (2026-06-28)
**Υλοποιήθηκε** (βλ. ADR-532 changelog «Stage 2» + §5 Files). Ο trigger φεύγει από prop του `RibbonRoot`
→ περνά μέσω context (NEW `ui/ribbon/context/RibbonContextualTabContext.tsx`) που τον τροφοδοτεί NEW
app-layer `app/RibbonContextualTabScope.tsx` (self-subscribe selection). Μέσα στο RibbonRoot: NEW leaf
`RibbonTabsRegion` = ο μόνος consumer· shell `RibbonRootInner` (memo) + `RibbonCommandProvider` ΔΕΝ
re-renderάρουν στην επιλογή. Boy-scout: `RibbonBody`→`React.memo`. 7 αρχεία (2 NEW), type-clean, μηδέν
jest (κανένα test δεν αγγίζει RibbonRoot/Body· TopBar μη-testable σε jsdom). **🔴 ΕΚΚΡΕΜΕΙ
browser-verify** (Profiler: μόνο `RibbonTabsRegion` updater στο click-select) + commit.

<details><summary>Αρχικό σχέδιο (ιστορικό)</summary>

**Πρόβλημα:** `DxfViewerTopBar` περνά `activeContextualTrigger` ως **prop** στο `<RibbonRoot>`. Αλλάζει σε κάθε select → `RibbonRoot` (React.memo) βλέπει αλλαγμένο prop → `RibbonRootInner` re-renderάρει → `RibbonBody` (active-tab buttons, NON-memo) + ~250 tooltips re-render.
- **Αρχεία:** `ui/ribbon/components/RibbonRoot.tsx` (γρ. 60-72 `visibleContextualTabs`/`orderedTabs`, γρ. 117-152 render, γρ. 158 `React.memo`), `app/useDxfViewerRibbon.ts` (γρ. 80-82 `useActiveContextualTrigger`), `app/DxfViewerTopBar.tsx` (γρ. 100-104, 140-144).
- **Σχέδιο:** το `activeContextualTrigger` (και το `contextualTabs`) να ΜΗΝ είναι props που αλλάζουν στο `RibbonRoot`. Αντ' αυτού ένα **leaf component μέσα στο RibbonRoot** να κάνει `useActiveContextualTrigger`/self-subscribe → μόνο το tab-bar + contextual-tab area re-renderάρει, ΟΧΙ τα static panel buttons. Έτσι τα props του `RibbonRoot` γίνονται ΟΛΑ σταθερά (commands ήδη σταθερό από Stage 1) → `React.memo` holds → `RibbonRootInner` ΔΕΝ re-renderάρει.
- **Στόχος profile:** ribbon fibers 96→~0 + tooltips 302→~λίγα στο selection commit.
- **Προσοχή:** ο auto-activate `useEffect` (RibbonRoot γρ. 77-100) χρειάζεται το `visibleContextualTabs` — μετακίνησέ τον μαζί με το trigger στο leaf, ΟΧΙ να σπάσει.
</details>

### ✅ ΝΕΟ EUREMA + FIX — `EnterpriseDxfSettingsProvider` God-context full-tree cascade (2026-06-28)
**Re-profile (02-42-14.json) μετά Stage 2:** Stage 2 ΕΠΙΒΕΒΑΙΩΘΗΚΕ — Ribbon στο click-select 96→**24 fibers**,
`RibbonBody` re-renders **0/64 commits** (memo), `RibbonTabsRegion` (νέο leaf) μόνο 7/64. **ΟΜΩΣ** το handoff
απέδιδε λάθος τα ~786 "Other" fibers σε «ribbon children» — στην πραγματικότητα είναι StatusBar/HUD/toggles/
Radix scattered app-wide (όχι ribbon). Τα **βαρύτερα** commits (#26/#30/#46/#47 = **267-322ms, ~1980 fibers**)
πυροδοτούνται από **`EnterpriseDxfSettingsProvider`** (God context ψηλά στο δέντρο): το monolithic `contextValue`
έψηνε `saveStatus`/`lastSaved`/`isSaving`/`lastError` στο `settings` spread + memo deps → autosave (`SAVE_START→
SAVE_SUCCESS`, 2 dispatch/edit) ξαναχτίζει ΟΛΟ το context → re-render ~28 consumer-subtrees.
**FIX (ΕΓΙΝΕ, ADR-341 changelog):** νέο `SettingsSaveStatusContext` (`useSettingsSaveStatus`/`...Optional`) —
save-status βγήκε από το main value+deps → main value αλλάζει ΜΟΝΟ σε πραγματικό settings edit· `CentralizedAutoSaveStatus`
διαβάζει settings-content από main + status από νέο context (behaviour-identical). 3 αρχεία
(`EnterpriseDxfSettingsProvider.tsx`, `settings-provider/index.tsx`, `CentralizedAutoSaveStatus.tsx`), tsc-clean.
🔴 browser-verify (autosave commit → μόνο `CentralizedAutoSaveStatus`, ΟΧΙ ~1980 fibers) + commit.
**ΜΕΝΕΙ follow-up:** η αλλαγή ΡΥΘΜΙΣΗΣ (combobox, commit#47) ξαναχτίζει το main value → όλοι οι ~28 consumers·
χρειάζεται domain-split ή selector-context (μεγαλύτερο refactor).

### Stage 3 — `DxfViewerDialogs` dialog hosts ✅ ΕΓΙΝΕ (2026-06-28, UNCOMMITTED)
**Re-profile (`03-15-26.json`) μετά Stage 1/2 + ADR-341:** click-select = **commit 212ms / 883 fibers**
(από 243ms/~1500 → 322ms/~1980 στα ενδιάμεσα → **212/883**). Τα closed dialogs που ζωγραφίζονταν ακόμη:
`ExportDialog, ThermalEnvelopeDialog, OpeningTagStyleDialog, DetailSheetDialog ×3` → 1-προς-1 με
always-mounted hosts στο `DxfViewerDialogs`. Root: κάθε host είναι always-listed (για να ακούει το
open-event) αλλά κρατούσε ζωντανό ΟΛΟ το βαρύ body ΚΑΙ κλειστό.

**FIX (Split pattern, SSoT — Giorgio approved):** NEW `app/dialog-hosts/useEventGatedDialog.ts` (typed
EventBus mount-gate `{open, payload, close}`, ref-stable `accept`). Κάθε host → **thin gate (always-listed)
+ heavy Body (mounted ΜΟΝΟ όταν open)**· closed → `null` → μηδέν subtree στο selection commit:
- `ColumnDetailHost`/`FoundationDetailHost`/`BeamDetailHost`/`SlabDetailHost` → `*DetailBody` (payload
  `{id, levelId}`· 3D capture + model μόνο στο body).
- `ExportHost` → `ExportBody` (no payload).
- `ThermalEnvelopeHost` → `ThermalEnvelopeBody`· **`useEnvelopeFloorSlabs()` ΜΕΝΕΙ always-on** στον thin
  host (cross-floor slab producer για 2D/3D κέλυφος)· init-on-open = lazy `useState(draft)` + mount-effect
  (regions + wallDna snapshot, ισοδύναμο με το παλιό event-time read).
- `OpeningTagStyleHost` → hydration + repaint-subscribe ΜΕΝΟΥΝ always-on· μόνο ο dialog gate-άρεται.

`DxfViewerDialogs.tsx` **αμετάβλητο** (hosts self-gate). Trade-off: close=unmount (χωρίς Radix exit-anim)
— ίδιο με το υπάρχον gate-at-mount (Credits/import). 5/5 jest GREEN (`useEventGatedDialog.test.tsx`).
ADR-532 changelog + Files ενημερωμένα.
- **Στόχος:** dialogs 117→~0 στο selection commit. **🔴 ΕΚΚΡΕΜΕΙ browser-verify** (Profiler: closed dialogs
  ΟΧΙ updaters/renders στο click· κάθε dialog ανοίγει/εφαρμόζει/κλείνει σωστά — ειδικά Thermal apply +
  per-region override, που μετακινήθηκαν σε mount-init) + commit (Giorgio· stage ADR-040+532, CHECK 6B/6D).
- **Follow-up:** `React.memo` στους hosts (να μην re-render-άρουν καν ως null)· λοιποί always-mounted hosts
  (Renumber/Print/Admin/FloorMgmt/Calibration) αν φανούν σε re-profile.

### Stage 4 (αν χρειαστεί) — canvas/3D/panels/statusbar leaves
Μικρότερα (43+85 fibers). Ίδιο μοτίβο: granular subscription / memo boundaries.

---

## ⚠️ ΚΑΝΟΝΕΣ / ΠΡΟΣΟΧΗ
- **N.(-1):** ΚΑΝΕΝΑ commit/push χωρίς ρητή εντολή Giorgio. Τα 4 αρχεία (Phase 1 + Stage 1 + ADR) είναι έτοιμα — περιμένουν «commit».
- **CHECK 6B/6D:** αλλαγές σε `DxfViewerContent`/canvas/selection files → stage ADR (ADR-532 ήδη staged). Το `DxfViewerTopBar`/`RibbonRoot` δεν είναι ρητά στη 6D λίστα αλλά stage ADR-532 για ασφάλεια.
- **N.17:** ΕΝΑ tsc τη φορά. Έλεγξε για running tsc πριν. Stage 1 type-verified χειροκίνητα — full tsc skip OK.
- **Verify:** ΜΟΝΟ React DevTools **Profiler** (όχι Chrome Performance — φουσκώνει). Setting «Record why each component rendered» βοηθά (στο export 02:09 ήταν OFF → `changeDescriptions: 0`).
- **Browser-verify λειτουργικότητας μετά από κάθε stage:** select τοίχο → εμφανίζεται contextual καρτέλα «Τοίχος»· widgets (διαστάσεις τοίχου) σωστές τιμές· dialogs ανοίγουν.

## 🔧 Reusable υποδομή (ΜΗΝ ξαναφτιάξεις)
- `useUniversalSelectionStable()` (SelectionSystem.tsx γρ. 297) — stable facade.
- `usePrimarySelectedId()`/`useSelectedEntityIds()`/`useSelectionCount()`/`useIsSelected()` (useSelectedEntities.ts) — canonical reactive leaf hooks (ADR-532). Όλα re-export από `systems/selection/index.ts`.
- `buildUniversalSelection` SSoT (SelectionSystem.tsx γρ. 169).

## Πηγή
[[feedback_giorgio_ssot_audit_before_new_mechanism]] — grep υπάρχουσα υποδομή ΠΡΙΝ νέο μηχανισμό.
