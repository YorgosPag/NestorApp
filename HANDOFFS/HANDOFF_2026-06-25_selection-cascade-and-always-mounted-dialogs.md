# HANDOFF — Selection-click jank: SelectionContext cascade + 29 always-mounted dialogs

**Ημερομηνία:** 2026-06-25
**Σχετικά:** ADR-040 (preview/cursor perf — micro-leaf philosophy)· συνέχεια του
`HANDOFF_2026-06-25_cursor-ghost-lag-synchronous-direct-render.md` (cursor-lag).
**Προτεινόμενο μοντέλο:** Opus (cross-cutting perf· #2 = Orchestrator-tier). **Plan Mode για #2.**

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ
1. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — όχι ο agent. Ετοίμασε, σταμάτα, ανέφερε.
2. **Shared working tree** — άλλος agent δουλεύει. Διάβαζε φρέσκο πριν κάθε Edit. **ΜΗΝ αγγίξεις `useColumnTool.ts`.**
3. **N.17 single-tsc** — το tsc κάνει **OOM**· βασίσου σε **jest (ts-jest compile)** + static checks, ΟΧΙ full tsc.
4. **N.8** — το **#2 (selection refactor) = Orchestrator-tier** (5+ αρχεία, 2+ domains, αγγίζει το selection SSoT που χρησιμοποιείται παντού). **ΖΗΤΑ ΕΓΚΡΙΣΗ ΠΡΙΝ.** Το #1 είναι ασφαλές/στοχευμένο.
5. **SSoT audit με grep ΠΡΙΝ κώδικα** (Giorgio). Reuse, μη διπλότυπο.

---

## 1. ΤΙ ΕΙΝΑΙ ΗΔΗ ΚΑΜΩΜΕΝΟ (UNCOMMITTED — commit ΠΡΩΤΑ απ' όλα)

Από την προηγούμενη session (cursor-lag), **έτοιμο + jest-GREEN, ασχολίαστο**:

**ADR-040 Φ12** (ghost↔cursor sync — ΕΝΑ imperative 60fps effective-world SSoT):
- `systems/cursor/ImmediatePositionStore.ts` — 3ο κανάλι `setRealtimeWorld/getRealtimeWorld/subscribeRealtimeWorld` (+ `*RealtimeWorldCursor` exports).
- `systems/cursor/mouse-handler-move.ts` — `setRealtimeWorldCursor(moveWorldPos)` κάθε frame (γρ.~283).
- `hooks/tools/useCanvasGhostPreview.ts` — αφαίρεση `useCursorWorldPosition`· sync subscription + `createRafCoalescedThrottle`.
- `hooks/grips/grip-projections.ts` — NEW `resolveGripTranslateDelta` + `resolveLiveRotationFromCursor` + flag `rotateCursorDriven` στις cursor-driven returns.
- `hooks/grip-computation-types.ts` — NEW optional `rotateCursorDriven`.
- `hooks/tools/useGripGhostPreview.ts` — `cursorMode 'none'→'world-position'`· live delta + cursor-driven rotation (typed-angle/hatch μένουν React).

**ADR-040 Φ12.1** (hit-test rebuild έξω από per-hover hot path):
- `services/HitTestingService.ts` — guard `if (scene === this.currentScene) return;` (ref-equality· μοναδικός caller = render loop· O(n) map+QuadTree rebuild ανά hover → μόνο σε αλλαγή σκηνής).

**Tests (GREEN):** `useCanvasGhostPreview.test.tsx` (10), `ImmediatePositionStore-realtime.test.ts` (5), `grip-projections-translate-delta.test.ts` (3), `grip-projections-free-rotate.test.ts` (+3 parity), `HitTestingService-scene-guard.test.ts` (4). **ADR-040 changelog** ενημερωμένο (Φ12 + Φ12.1).
**Προϋπάρχον fail (ΟΧΙ δικό μας):** `grip-commit-alt-bypass.test.ts` = stale `sceneManager` mock άλλου agent (ISceneManager mock SSoT migration).
**🔴 Εκκρεμεί:** browser-verify σε Chrome (hover/move/grip/rotate, snaps ON/OFF) + **commit (Giorgio)**.

---

## 2. ΤΟ ΠΡΟΒΛΗΜΑ ΑΥΤΟΥ ΤΟΥ HANDOFF (κόλλημα στο ΚΛΙΚ/ΕΠΙΛΟΓΗ)

Διάγνωση: React DevTools profile έδειξε **ένα 122ms commit** (dev· ~15-25ms prod) σε κάθε **κλικ-επιλογή** οντότητας, με updaters `CanvasSection` + `SelectionSystem` + `CursorSystem`. (Το hover-jank ήταν χωριστό → λύθηκε με Φ12.1 updateScene guard.)

### Ρίζα Α — SelectionContext cascade (ο πυρήνας του 122ms)
- `systems/selection/SelectionSystem.tsx:11-18` provider **ψηλά στο δέντρο** (`DxfViewerApp.tsx:69-75`, πάνω από ribbon/sidebar/canvas).
- `systems/selection/useSelectionSystemState.ts:50-56` — `contextValue = useMemo(..., [state, selectionActions, ...])`. Κάθε dispatch → **νέο `state`** → `selectionActions` memo (`useSelectionActions.ts:31-75`, dep `[state.selectedRegionIds, dispatch]`) invalidate-άρει (νέο `state.selectedRegionIds` ref ακόμα κι αν ίδιο περιεχόμενο) → **νέα ταυτότητα `contextValue`** → re-render σε **ΚΑΘΕ** `useContext(SelectionContext)` consumer.
- **Orchestrator consumers** (re-render όλο το subtree): `DxfViewerContent.tsx:140`, `CanvasSection.tsx:126`, `FloatingPanelsSection.tsx:131`, `useKeyboardShortcuts.ts:79` + ~20 ribbon widgets/hooks.
- **`useUniversalSelection()` (`SelectionSystem.tsx:264`)** memo σε `[context]` → επιστρέφει **νέο object κάθε render** → καταρρέει κάθε downstream memo· `selectedEntityIds` νέος πίνακας παντού → cascades: `useUnifiedGripInteraction`, `useOverlayLayers`, **`useActiveContextualTrigger` (`ribbon-contextual-config.ts:171-333`, O(N×M) σάρωση οντοτήτων×selectedIds)**, context-menu props, `PropertiesPalette`.
- `CursorSystem` re-render-άρει ταυτόχρονα (mouse-up → `SET_MOUSE_DOWN`, `mouse-handler-up.ts:69`), batched στο ίδιο commit.

### Ρίζα Β — 29 μόνιμα-mounted dialogs (amplifier)
- `app/DxfViewerDialogs.tsx` (mount στο `DxfViewerContent.tsx:426`) mount-άρει **29 dialog/host ΧΩΡΙΣ gate** (`<Dialog open={false}>` αντί `{open && <Dialog/>}`). Re-render όλα σε κάθε commit του `DxfViewerContent` (= κάθε επιλογή· επίσης `ui` prop = νέο object κάθε render, `useDxfViewerUiState.ts:74`).
- **Βαριά ενώ ΚΛΕΙΣΤΑ** (priority):
  - `ui/text-toolbar/DxfFindReplaceHost.tsx:34-37` — σαρώνει **ΟΛΕΣ** τις οντότητες (`useMemo([scene])`) κλειστό· early-return `if(!services) return null` ΜΕΤΑ τη σάρωση.
  - `app/BimScheduleHost.tsx:66-92` — παίρνει `selectionIds`, φιλτράρει σκηνή για 8 BIM τύπους + `useBimScheduleLookups`, σε **κάθε επιλογή**· κανένα early-return.
  - `ui/components/bim-openings/RenumberOpeningsHost.tsx:50-139` — 18 `t()` + `useLevels` κάθε render.
  - `ui/components/CreditsDialog.tsx:44-46` — `collectAssetCredits` memo + arrays (μικρό).
- **OK ως έχουν** (self-subscribing, φτηνό early-return `if(!state.open) return null` μετά ΕΝΑ `useSyncExternalStore`): `Column{Perimeter,AdoptSize,BatchFill,Promote}ConfirmDialog`, `HatchOverlapConfirmDialog`. **ΜΗΝ τα πειράξεις.**

---

## 3. ΣΧΕΔΙΟ ΔΙΟΡΘΩΣΗΣ (φθηνό → δομικό)

### #1 — Gate τα βαριά closed-hosts (ΑΣΦΑΛΕΣ, στοχευμένο, ΞΕΚΙΝΑ ΕΔΩ)
- Στο `app/DxfViewerDialogs.tsx`: τύλιξε τα **βαριά** hosts σε `{open && <Host/>}` ώστε να **unmount** κλειστά: `DxfFindReplaceHost`, `BimScheduleHost`, `RenumberOpeningsHost` (+ όσα έχουν καθαρό `isOpen`/`open` prop flag).
  - Εναλλακτικά (αν το mount χρειάζεται για EventBus/animation): **early-return ΠΡΙΝ** τα expensive hooks/σάρωση μέσα στο κάθε host (μετακίνησε το `if(!open) return null` ΠΑΝΩ από το `useMemo([scene])`). ⚠️ Προσοχή Rules-of-Hooks: αν early-return πριν hooks, πρέπει να μετακινηθούν ΟΛΑ τα hooks κάτω από τη συνθήκη ΟΧΙ — οπότε προτίμησε **gate στο mount** (καθαρότερο, μηδέν hook-order ρίσκο).
- **Risk:** χαμηλό. Τα modals χάνουν internal state κλειστά (αποδεκτό — reset on open). Επιβεβαίωσε ότι κανένα δεν βασίζεται σε mounted-while-closed (π.χ. global listener) — τα EventBus-driven (open state σε store) ίσως θέλουν gate με βάση το store flag, όχι prop.
- **Verify:** jest αν υπάρχει· αλλιώς React DevTools profile (κλικ-επιλογή → λιγότερα fibers στο commit· οι 3 hosts να μη re-render-άρουν κλειστοί).
- **Files:** `app/DxfViewerDialogs.tsx` (+ ίσως early-returns στα 3 hosts). 1-4 αρχεία, 1 domain → απλό/Plan Mode.

### #2 — Σταθεροποίηση SelectionContext (ORCHESTRATOR — ΕΓΚΡΙΣΗ ΠΡΙΝ, Plan Mode)
**Στόχος:** η αλλαγή επιλογής να ΜΗΝ re-render-άρει orchestrators (CanvasSection/DxfViewerContent/ribbon) — μόνο τα leaves που όντως δείχνουν selection.
**SSoT AUDIT ΠΡΩΤΑ (grep):** δες πώς δουλεύουν τα `systems/hover/HoverStore.ts` + `systems/cursor/ImmediateSnapStore.ts` (zero-React mutable singleton + `useSyncExternalStore` ΜΟΝΟ στα leaves) — **reuse αυτό το pattern**, μη φτιάξεις νέο.
**Κατευθύνσεις (επιβεβαίωσε με audit):**
- (Α) **Σταθερές actions:** χώρισε `state` από `actions` στο `SelectionContext` (δύο contexts ή actions σε ref-stable object) ώστε οι actions να ΜΗΝ αλλάζουν ταυτότητα ανά dispatch· τα leaves που θέλουν ΜΟΝΟ actions να μη re-render-άρουν. Διόρθωσε το `useUniversalSelection` (`SelectionSystem.tsx:264`) να ΜΗΝ επιστρέφει νέο object κάθε render.
- (Β) **Zero-React SelectionStore (το βαρύ, Revit-grade):** μετακίνηση του selection set σε mutable singleton (mirror HoverStore) + `useSelectionState()` (`useSyncExternalStore`) ΜΟΝΟ στα leaves. Orchestrators διαβάζουν imperatively (getter) σε event-time (ADR-040 cardinal rule #2). Σπάει το context-broadcast εντελώς.
- Διόρθωσε το `ribbon-contextual-config.ts:171-333` O(N×M) → index/memo σταθερό.
**Risk:** υψηλό (selection = SSoT παντού· ~20 consumers). **Plan Mode + per-leaf jest.** Πιθανό **νέο ADR** (επιβεβαίωσε highest ADR# — το CLAUDE.md λέει ADR-370 "next free" αλλά έχουν δημιουργηθεί 526/527+· **grep `adr-index.md` για το πραγματικό highest**).

---

## 4. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (Giorgio).
- ΜΗΝ ξεκινήσεις το #2 χωρίς ρητή έγκριση (Orchestrator, N.8).
- ΜΗΝ πειράξεις τα self-subscribing confirm-dialogs (ήδη φτηνά).
- ΜΗΝ φτιάξεις 2ο selection store/μηχανισμό — reuse HoverStore/ImmediateSnapStore pattern.
- ΜΗΝ αγγίξεις `useColumnTool.ts` (άλλος agent).
- ΜΗΝ βασιστείς σε full tsc (OOM) — jest + static.
- ΜΗΝ μπερδέψεις: το **hover-jank** ήταν το updateScene (Φ12.1, έτοιμο)· **αυτό** το handoff = **click/selection** jank (cascade + dialogs).

---

## 5. VERIFICATION
- **#1:** React DevTools profile — κλικ-επιλογή → οι 3 hosts ΟΧΙ στο commit tree κλειστοί· λιγότερα fibers.
- **#2:** profile — κλικ-επιλογή → orchestrators (CanvasSection/DxfViewerContent) ΟΧΙ updaters· μόνο selection-leaves. Per-leaf jest για κάθε migrated consumer.
- **Browser (Chrome):** φόρτωσε κάτοψη (552 στοιχεία), κλικ-επιλογή οντοτήτων → χωρίς αισθητό «κόλλημα». Performance tab (ΟΧΙ Recorder) → self-time στο click commit ↓.
- **Cleanup:** πρώτα commit τα Φ12 + Φ12.1 (uncommitted §1).
