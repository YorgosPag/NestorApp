# HANDOFF — WAVE 2.7: `createExternalStore` για DOMAIN-NAMED listener stores

> **Ημερομηνία:** 2026-07-05 (Session 7 → 8)
> **Mode:** 🤖 ORCHESTRATOR **προ-εγκεκριμένο από Giorgio** («αν χρειαστεί orchestrator, χρησιμοποίησε»). N.8: ~18 files / 2+ domains → orchestrator.
> **⚠️ Working tree ΜΟΙΡΑΖΕΤΑΙ** με άλλον agent (+ commit-coordinator) → `git add <specific>` ΠΑΝΤΑ· **ΠΟΤΕ** `add -A`/`restore .`/`reset --hard`/`stash`. **Commit/push = ΜΟΝΟ Giorgio.**
> **Πηγή αλήθειας backlog:** `.claude-rules/pending-ratchet-work.md` → εγγραφή «🔴 WAVE 2.7 DISCOVERED».
> **Γλώσσα:** απαντάς στον Giorgio **στα Ελληνικά**.

---

## 0. TL;DR
- **WAVE 2.6 ΕΚΛΕΙΣΕ** (68 stores migrated + guard). **WAVE 2.7** = 4ος undercount: ~18 ΑΚΟΜΗ hand-rolled pub/sub stores με **domain-named** listener alias (`ViewportListener`, `RegistryListener`, `ModalPresenceListener` κ.λπ.) — ΙΔΙΟ idiom, το grep έψαχνε μόνο generic `Listener`/`Subscriber`.
- **Στόχος:** migrate τα fits στο **ΥΠΑΡΧΟΝ** `stores/createExternalStore.ts` (ΜΗΝ νέο factory). Public API αμετάβλητο ανά store.
- **Big-player doctrine (Giorgio):** FULL enterprise + FULL SSoT, αλλά όπως το κάνουν Revit/Maxon-C4D/Figma. Το `createExternalStore` ΕΙΝΑΙ ακριβώς το vanilla-store primitive (Zustand `createStore` / Redux / Valtio-vanilla) που χρησιμοποιούν οι μεγάλοι + `useSyncExternalStore`. Αν ένας store ΔΕΝ ταιριάζει (multi-cell hot-path / event-bus / async) → NOT-A-FIT (bespoke = big-player practice, όπως VS Code κρατά high-freq bespoke).
- **⛔ ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ (Giorgio, ΠΡΙΝ ξεκινήσεις):** commit τα **18 WAVE 2.6 uncommitted stores + `.ssot-registry.json` + `pending-ratchet-work.md`** + `npm run ssot:baseline`. Αλλιώς μπερδεύεται το tree. **Έλεγξε `git status` στην αρχή** — τα 2.6 files πρέπει να είναι committed/clean.

---

## 1. SSoT target (ΜΗΝ ξαναφτιάξεις factory) — `stores/createExternalStore.ts`
`createExternalStore<T>(initial, { equals? }) => { get, set, subscribe, reset }`. Zero-React vanilla pub/sub. `set` always-notify· `equals` → skip-guard· `reset(next)` = silent set + clear listeners (jest-only).
React binding: ο consumer γράφει μόνος `useSyncExternalStore(store.subscribe, store.get, serverSnap)`.

### EXEMPLARS (ήδη migrated στο WAVE 2.5/2.6 — μιμήσου ΑΚΡΙΒΩΣ):
- **single-nullable + identity guard:** `systems/mep-design/water/water-proposal-store.ts` → `createExternalStore<T|null>(null,{equals:Object.is})`.
- **reducer/patch-merge + field-compare guard ΣΤΟ WRAPPER (no-equals):** `bim/walls/wall-preview-store.ts`, `stores/AutoSaveStatusStore.ts` (`sameSnapshot` guard στο wrapper).
- **class single-value/snapshot + guard:** `systems/grip/GripReferenceStore.ts`, `systems/tracking/TrackingPointStore.ts` (composite snapshot, drop try/catch notify, `subscribe(fn)=>store.subscribe(fn)`).
- **composite multi-`let` → ΕΝΑ snapshot object:** `systems/constraints/cad-toggle-state.ts`, `systems/constraints/polar-tracking-store.ts` (class + localStorage side-channel στους setters).
- **VERSION-SIGNAL (multi-map/multi-let → κρατάς Maps ως `let` mutation-accelerators + `createExternalStore<number>(0)`):** `stores/LayerStore.ts`, `stores/LayerStateStore.ts`, `stores/LayerFiltersStore.ts`, `systems/selection/SelectedEntitiesStore.ts` (`commit(){ rebuildCaches(); store.set(store.get()+1); }`, `getVersion→store.get()`, `subscribe→store.subscribe`).
- **2-INSTANCE (πολλαπλά ΑΝΕΞΑΡΤΗΤΑ subscribe channels → ΕΝΑ createExternalStore ανά signal):** `bim/schedule/stores/region-pick-store.ts` (`phaseStore` Object.is + `firstCornerStore` structural-eq· τα named subscribe/getSnapshot delegate).

### Κανόνες μετάβασης (WAVE 2.5/2.6 doctrine — ΑΠΑΡΑΒΑΤΟΙ):
1. Αντικατέστησε ΜΟΝΟ το pub/sub plumbing (`type XListener`, `let state`/`private field`, `const listeners = new Set<...>`, `subscribe`/`getSnapshot`/`getServerSnapshot`, notify loops, `private emit`/`notify`). **ΚΡΑΤΑ** interfaces/consts/doc-comments/`"use client"`/side-channels/guards/helpers/validation-sets/named exports. (Το `type XListener = (...) => void` κράτα το ΑΝ χρησιμοποιείται σε public subscribe signature — δεν είναι dangling τότε.)
2. **equals:** single-value identity `if(next===cur)return` → `{equals:Object.is}`. Reducer/patch/snapshot που χτίζει νέο object κάθε φορά ή έχει field-compare guard στο wrapper → **ΧΩΡΙΣ equals** (guards μένουν στους mutators/wrapper). Hot-path → **ΧΩΡΙΣ equals** (notify byte-identical).
3. **Test-reset** που ΔΕΝ clear-άρει listeners → κράτα το (χρησιμοποίησε `store.set(INIT)` όχι `store.reset`). Αν clear-άρει listeners → `store.reset(INIT)`. **ΠΡΟΣΟΧΗ:** αν το `reset()` είναι **public runtime API** (όχι test-only, grep τους callers) → `store.set(...)` για να κρατήσει listeners + notify (βλ. `ToolStateStore.reset` WAVE 2.6).
4. **try/catch(console.error) γύρω από notify** = defensive-only απόκλιση → **DROP + migrate** (factory=plain loop, big-player canonical). Multi-field/factory-singleton/event-bus/async → **NOT-A-FIT** ανεξαρτήτως.
5. **Public API ΑΜΕΤΑΒΛΗΤΟ** ανά store (μηδέν consumer change). Grep τους consumers αν αλλάζεις τύπο επιστροφής.

---

## 2. ΕΡΓΑΣΙΑ — ΞΑΝΑ-grep ΠΡΩΤΑ (undercount χτύπησε 4×· η ΜΟΝΗ αξιόπιστη ανίχνευση):
```
rg -n "new Set<\s*\w*(Listener|Subscriber)\s*>|:\s*Set<\s*\w*(Listener|Subscriber)\s*>\s*=\s*new Set" src/subapps/dxf-viewer --type ts -g '!*.test.*' -g '!*.spec.*' | sort
```
Στο τέλος Session 7: **29 sites / ~24 files**. Κατηγοριοποίηση (per-store fit-check ΥΠΟΧΡΕΩΤΙΚΟ — διάβασε ΚΑΘΕΝΑ):

### ⛔ ΗΔΗ ALLOWLISTED (WAVE 2.6 NOT-A-FIT — ΜΗΝ αγγίξεις):
`bim/grips/rotation-snap-store`, `bim-3d/performance/regression-alert-bus`, `snapping/overrides/SnapOverrideOrchestrator`, `systems/canvas-numeric-input/CanvasNumericInputStore`.

### 🟥 ADR-040 HOT-PATH σε protected dir (CHECK 6B/6D) — **NOT-A-FIT → allowlist, ΜΗΝ migrate** (big-player: high-freq multi-cell = bespoke, ίδια απόφαση με ImmediateSnap/ImmediateTransform WAVE 2.5):
- `systems/cursor/ImmediatePositionStore.ts` — 3 listener sets (listeners/worldListeners/realtimeWorldListeners), multi-cell 60fps. Είναι στη λίστα ADR-040 του CLAUDE.md.
- `systems/hover/HoverStore.ts` — 2 sets (entitySubscribers/overlaySubscribers), HoverStore SSoT ADR-040. Protected dir `systems/hover/`.
- ⚠️ Αν παρ' όλα αυτά κρίνεις ότι ταιριάζουν (π.χ. clean 2-instance) → απαιτεί **ADR-040 staging** (CHECK 6B/6D BLOCK) + browser perf-verify. Default: NOT-A-FIT.

### 🟩 GENUINE CANDIDATES (~18· διάβασε & fit-check ΚΑΘΕΝΑ· delegate σε sonnet agents σε batches):

| # | File | Listener type | Πρόχειρη κρίση (επιβεβαίωσε) |
|---|------|---------------|------------------------------|
| 1 | `systems/modal/ModalPresenceStore.ts` | ModalPresenceListener | module single-state — likely fit |
| 2 | `systems/isolate/IsolateEffectsStore.ts` | IsolateEffectsListener | module — likely single-state fit |
| 3 | `systems/line-styles/line-style-registry.ts` | RegistryListener | class registry (Map + version) — likely **version-signal** |
| 4 | `systems/dimensions/dim-style-registry.ts` | RegistryListener | ίδιο registry pattern → version-signal |
| 5 | `systems/viewport/ViewportStore.ts` | ViewportListener ×2 | **2 ανεξάρτητα sets** (activeScale/scaleList) → **2-INSTANCE** ή multi-signal (κρίση) |
| 6 | `systems/guides/guide-store.ts` | StoreListener | class — fit-check (guides = low-freq click, ΟΧΙ 60fps· ΟΧΙ στη 6D λίστα) |
| 7 | `systems/guides/guide-drag-store.ts` | GuideDragListener | module — fit· έλεγξε αν drag=hot-path |
| 8 | `systems/guides/construction-point-store.ts` | StoreListener | class — fit-check |
| 9 | `systems/cursor/device-pixel-ratio.ts` | DevicePixelRatioListener | ⚠️ **cursor/ dir = 6D protected** → αν migrate, stage ADR-040· low-freq (DPR change) όμως. Κρίση/ίσως NOT-A-FIT |
| 10 | `systems/coordination/clash-focus-bus.ts` | FocusListener | ⚠️ **event-bus** — αν μηδέν retained state → **NOT-A-FIT** (όπως regression-alert-bus) |
| 11 | `core/commands/CommandHistory.ts` | CommandHistoryListener | class (ΞΕΧΩΡΙΣΤΟ από το ήδη-migrated `command-line/CommandHistory`) — fit-check (undo/redo stack + version-signal;) |
| 12 | `core/state-machine/DrawingStateMachine.ts` | DrawingMachineListener | class FSM — reducer-over-single-object fit; ή multi-field NOT-A-FIT (κρίση) |
| 13 | `bim/mep-systems/mep-wire-waypoint-ui-store.ts` | HoverListener | module — fit-check |
| 14 | `bim/roofs/roof-edge-selection-store.ts` | RoofEdgeListener | module selection store — likely single-state/version-signal |
| 15 | `bim-3d/edges/bim-edge-resolution-store.ts` | ResolutionListener | class — fit-check |
| 16 | `bim-3d/stores/Bim3DCursorReadoutStore.ts` | ReadoutListener | class — ⚠️ «cursor readout» ίσως high-freq → fit-check + ίσως browser-verify |
| 17 | `bim-3d/accessibility/KeyboardFocusManager.ts` | FocusListener + DescriptionListener | **2 sets** → 2-instance ή NOT-A-FIT (κρίση) |
| 18 | `bim-3d/accessibility/aria-live-bus.ts` | AriaAnnounceListener | ⚠️ **event-bus** announce — αν μηδέν state → **NOT-A-FIT** |

**Event-bus κανόνας (regression-alert-bus precedent):** αν είναι pure fire-and-forget announce με ΜΗΔΕΝ retained state (μόνο `emit(x)` → listeners, κανένα `get()`) → **NOT-A-FIT** (δεν είναι state store). Αν κρατά τελευταία τιμή/state που διαβάζεται με getSnapshot → fit.

---

## 3. GUARD extension (ΤΕΛΟΣ, μετά τις migrations) — module `create-external-store`
Επέκτεινε τα `forbiddenPatterns` να πιάνουν ΚΑΙ domain-named aliases: πρόσθεσε `new Set<\\w*Listener>` + `new Set<\\w*Subscriber>` + `: Set<\\w*Listener>` (**ERE, ΠΟΤΕ `(?:)`** — GNU grep 3.0 σπάει· `feedback_grep_no_noncapturing_groups`). Αυτά καλύπτουν και τα ήδη-υπάρχοντα bare `new Set<Listener>` (μπορείς να τα αντικαταστήσεις με τα `\\w*` variants για να μη διπλο-γράφεις). Allowlist += όσα μείνουν NOT-A-FIT (Immediate*/Hover + event-buses + KeyboardFocusManager αν κριθεί) — τα 4 ήδη-allowlisted μένουν. Στόχος **0-violation** αν όλα τα fits migrated· αλλιώς baseline-ratchet. Validate: `npm run test:registry-golden` (56 GREEN) + `npm run test:ssot-suite` (221 GREEN). 🔴 Giorgio: `npm run ssot:baseline` + commit.
**ΠΡΟΣΟΧΗ golden test:** το `new Set<\\w*Listener>` πρέπει να περνά το ERE-validity + match/skip fixture του `registry-golden-regex.test.js`. Αν το module είναι στο sample, ίσως χρειαστεί fixture update.

---

## 4. ΚΑΝΟΝΕΣ (απαράβατοι)
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ΠΡΙΝ κώδικα.** Reuse `createExternalStore` (+ siblings `createConfirmStore`/`createToggleStore`/`createToolBridgeStore` αν ταιριάζει καλύτερα). ΜΗΝ νέο factory. ΜΗΝ διπλότυπο.
- 💾 **Commit/push = ΜΟΝΟ Giorgio.** shared tree → `git add <specific>`· ΠΟΤΕ `add -A`/`restore .`/`reset --hard`/`stash`· verify `git diff --cached`.
- 🚫 **ΟΧΙ tsc/typecheck** (N.17)· jest ναι (στοχευμένα).
- 🤖 Subagents: `model:"sonnet"` μηχανική migration, `haiku` lookup, `opus` κρίση. **Πες στα subagents ρητά: «ΜΗΝ σταματάς για επιβεβαίωση μοντέλου» (N.14 ΔΕΝ ισχύει για subagent)** — δύο agents κόλλησαν έτσι.
- ✅ **Review discipline:** κάθε subagent diff → grep-verify (μηδέν leftover `new Set<\w*Listener>`/`private emit`/dangling `notify`/`listeners`) + spot-read + `git diff` για public-API-drift + τυχόν reorder side-effects. HEAD ίσως έχει buggy commit άλλου agent → έλεγξε.
- 📄 Big-player/Revit-Maxon-Figma level· full SSoT· public API αμετάβλητο.

---

## 5. ΤΙ ΝΑ ΚΑΝΕΙΣ ΠΡΩΤΟ
1. **`git status`** — επιβεβαίωσε ότι τα WAVE 2.6 files είναι committed (ο Giorgio θα τα έχει κάνει commit + ssot:baseline). Αν όχι, ΜΗΝ τα αγγίξεις.
2. **Re-grep** (§2) — επικύρωσε τη λίστα (undercount-safe).
3. **Batch delegate** σε sonnet agents (π.χ. Batch A = απλά module single-state 1,2,13,14 · Batch B = registries version-signal 3,4 · Batch C = class/FSM κρίση 6,8,11,12,15,16 · Batch D = 2-instance/κρίση 5,17 · Judge NOT-A-FIT 9,10,18 μόνος/opus). Στάση/report μετά από κάθε batch.
4. **Guard** (§3) + tests.
5. **Report** στον Giorgio (Ελληνικά) + update `pending-ratchet-work.md` («WAVE 2.7 DONE» + αφαίρεσε τη DISCOVERED). Commit: Giorgio.

---

## 6. WAVE 2.6 STATE (μη το αγγίξεις — ιστορικό)
68 stores migrated (43 Box1 Session6 + 25 Box2/3/4 Session7), guard extended (`new Set<Listener>`/`Subscriber`/`: Set<Listener>`), 221/221 SSoT tests GREEN. 🟡 Εκκρεμεί browser perf-verify Giorgio (Scene/SelectedEntities/EntityBodyDrag/Lasso @60fps). 🔵 2 non-dxf Firestore stores (`useFirestoreBuildings`, `super-admin-active-company`) = pre-existing `new Set<() => void>` debt → θα μπουν στο baseline του Giorgio (εκτός dxf scope).
