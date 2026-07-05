# HANDOFF — Session 2: Store-factory family (νέα συνεδρία)

> **Ημερομηνία:** 2026-07-05
> **Subapp:** `src/subapps/dxf-viewer` (+ `stores/`, `ui/ribbon/hooks/bridge/`, `.ssot-registry.json`)
> **Πηγή αλήθειας backlog:** `.claude-rules/pending-ratchet-work.md`
> **Πλήρες σχέδιο όλων των sessions:** `HANDOFFS/2026-07-05_ratchet-backlog_full-implementation-plan.md`

---

## 0. TL;DR
- ✅ **Session 1 DONE** (A-items + 3 registry guards, 263 jest GREEN). **ΠΡΟΫΠΟΘΕΣΗ:** να έχει γίνει **commit** από τον Giorgio πριν ξεκινήσει το Session 2 (καθαρό tree).
- 📋 **Session 2 = Store-factory family:** ενοποίηση του ίδιου boilerplate «mini-store» σε 3 έτοιμα factories.
- 🎯 **Mode:** Plan Mode (audit → plan → implement → jest → commit Giorgio). Καθαρό tree + solo agent → **μεγάλα batches OK**, χωρίς φόβο conflict.

---

## 1. ΚΡΙΣΙΜΟ CONTEXT (από Session 1 — άλλαξε τα πάντα)
- 🟢 **Καθαρό tree + ΚΑΝΕΝΑΣ άλλος agent** (ο Giorgio το επιβεβαίωσε). → Όλα τα παλιά «DEFER: shared tree / άλλος agent» flags στο backlog είναι **ΑΚΥΡΑ**.
- 🟢 **ADR-573 (color/grip) landed** — δεν υπάρχει uncommitted color/grip να «μην αγγίξεις».
- 🟢 **WAVE 3 ξεκλείδωσε** (ο bim-3d agent που το μπλόκαρε δεν τρέχει).

---

## 2. ΤΙ ΘΑ ΚΑΝΟΥΜΕ — 3 sub-tasks (ίδιο μοτίβο: «ένα factory, πολλά consumers»)

### 2A. `createExternalStore` — WAVE 2 + WAVE 3
**Factory ΕΤΟΙΜΟ:** `stores/createExternalStore.ts` (commit `8b4ff004`, 7 jest). WAVE 1 (4 stores) DONE.
Το idiom προς αντικατάσταση: `let state; const listeners = new Set<() => void>(); set(notify)/get/subscribe`.

- **WAVE 2 (safe, single-state, non-hot-path):**
  `bim/grid/grid-perimeter-mode-store`, `bim/hatch/hatch-draw-defaults-store`, `bim/hatch/hatch-pick-mode-store`, `bim/stores/envelope-floor-slabs-store`, `stores/DimensionCreateStore`, `systems/dimensions/DimRowHandleModeStore`, `systems/layers/opening-tag-layer`, `ui/panels/dimensions/DimTextOverrideStore`, `hooks/toolHintOverrideStore` (object-shape 2 fields + `===` guard → `equals: Object.is` + object wrapper).
- **WAVE 3 (ξεκλείδωσε):** `bim-3d/scene/multi-floor-3d-source`, `bim-3d/scene/multi-floor-dxf-source`, `bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache`.
- **⛔ NOT-A-FIT (μην αγγίξεις):** `ui/ribbon/context/RibbonFieldStore` (per-key slice store), `bim/materials/material-thumbnail-resolver` (async cache — έλεγξε πρώτα).
- **ΣΗΜ.:** τα ADR-040 hot-path stores (`HoverStore`/`ImmediatePositionStore`/`ImmediateTransformStore`) = **ΔΙΑΦΟΡΕΤΙΚΟ pattern**, ΧΩΡΙΣΤΟ pass με browser perf-verify + ADR-040 staging (CHECK 6B/6C). **ΟΧΙ σε αυτό το session.**

### 2B. `createConfirmStore` — 2 column stores
**Factory ΕΤΟΙΜΟ:** `stores/createConfirmStore.ts` (Promise-handshake confirm· 5 jest).
Migrate: `bim/columns/column-perimeter-confirm-store.ts` + `bim/columns/column-adopt-size-confirm-store.ts` (ίδιο `_state`/`_pendingResolve`/`_subs`/`_notify` → `createConfirmStore<XState,XAction>(closed)` + thin wrappers, public API αμετάβλητο).

### 2C. `createToolBridgeStore` — 15 bridge stores (LARGE)
**Factory ΔΕΝ υπάρχει ακόμη → φτιάξ' το** (sibling του `stores/createToggleStore.ts`).
15 αρχεία `ui/ribbon/hooks/bridge/*-tool-bridge-store.ts` (column, foundation, railing, furniture, electrical-panel, floorplan-symbol, mep-{segment,riser,boiler,radiator,manifold,water-heater,fixture}, wall, slab) με **ταυτόσημο** `let handle:T|null` + `Set<Listener>` + `emit/subscribe/getSnapshot/{set(identity),get,use}`. Διαφέρει ΜΟΝΟ το `THandle`.
→ `export const xToolBridgeStore = createToolBridgeStore<XHandle>()`.

### 2D. Registry guards (μετά κάθε ολοκληρωμένο migration)
Πρόσθεσε `.ssot-registry.json` modules (ίδιο μοτίβο με Session 1):
- `create-external-store` → forbid inline `new Set<() => void>` σε νέο `*-store.ts`.
- `create-confirm-store` → forbid inline `_pendingResolve` σε `*-confirm-store.ts`.
- `create-tool-bridge-store` → forbid inline `let handle` + `Set<Listener>` σε `*-tool-bridge-store.ts`.
→ **ΠΡΩΤΑ** grep ότι 0 matches έξω από allowlist, **μετά** πρόσθεσε module, μετά `npm run test:registry-golden` (πρέπει GREEN) + `npm run ssot:baseline`.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ (καθαρό tree → μεγάλα batches)
1. **2A WAVE 2** (9 stores, safe) → jest.
2. **2A WAVE 3** (3 bim-3d stores) → jest (bim-3d suites).
3. **2B** confirm (2 stores) → jest (column confirm suites).
4. **2C** νέο factory + 15 bridge stores → jest (ribbon/bridge suites).
5. **2D** registry guards + baseline.
> Αν το context φτάσει ~70%, σπάσε: **Session 2a** = 2A (external stores), **Session 2b** = 2B+2C (confirm + bridge). Ένα handoff στο τέλος.

## 4. ΜΕΘΟΔΟΣ ανά sub-task (ο βρόχος)
1. **grep audit** — βρες ΟΛΑ τα consumers του idiom (μη βασίζεσαι στη λίστα· Session 1 έδειξε undercount 3→7). 
2. **Plan** στον Giorgio ΠΡΙΝ κώδικα (public API αμετάβλητο; edge cases;).
3. Implement — `git add` specific.
4. **jest** στοχευμένα (ΟΧΙ tsc).
5. **commit → Giorgio.**
6. Update `pending-ratchet-work.md` (✅ DONE + changelog) + handoff.

---

## 5. ΚΑΝΟΝΕΣ (απαράβατοι)
- 💾 **Commit/push ΜΟΝΟ Giorgio** (N.(-1)). `git add <specific>` + `git diff --cached`· ΠΟΤΕ `add -A`/`restore .`/`reset --hard`.
- 🚫 **ΟΧΙ tsc** (N.17)· jest επιτρέπεται.
- 🏢 Big-player-grade + full SSoT· **grep-audit ΠΡΙΝ** νέο κώδικα· **ΟΧΙ band-aid / partial-field SSoT**· public API αμετάβλητο.
- 📄 Registry: **πρώτα grep 0-violation**, μετά module + `test:registry-golden` GREEN + `ssot:baseline`. ERE patterns: **ΠΟΤΕ `(?:)`** — μόνο `(...)`, `\w`, `\s`, `\b`.
- ⚠️ Public API κάθε store ΠΡΕΠΕΙ να μείνει ίδιο (τα consumers δεν αλλάζουν).

---

## 6. PASTE-PROMPT για νέα session (μετά /clear)

```
Διάβασε ΠΡΩΤΑ: C:\Nestor_Pagonis\HANDOFFS\2026-07-05_session2_store-factory-family.md
+ C:\Nestor_Pagonis\.claude-rules\pending-ratchet-work.md (πηγή αλήθειας).

Session 1 (A-items + registry guards) είναι COMMITTED — μη το πειράξεις.
Καθαρό tree, solo agent (κανένα shared-tree caution δεν ισχύει).

Session 2 = Store-factory family. Σειρά: 2A WAVE 2 → 2A WAVE 3 → 2B confirm → 2C bridge (15) → 2D registry guards.
Ξεκίνα με: [ΓΙΩΡΓΟ ΔΙΑΛΕΞΕ — π.χ. 2A WAVE 2].

Κάνε ΠΡΩΤΑ grep-audit (ΟΛΑ τα consumers — προσοχή undercount), μετά πες μου το plan ΠΡΙΝ κώδικα.
Public API αμετάβλητο. ΟΧΙ band-aid — full SSoT. ΟΧΙ tsc (jest ναι).
Commit μόνο εσύ. Shared tree: git add μόνο specific.
```
