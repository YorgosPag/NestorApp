# ADR-566 — Ένωση Τοίχων (Merge / Join Walls)

**Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED) — 2026-07-03
**Domain:** DXF Viewer · BIM · Wall Editing
**Related:** ADR-363 (BIM drawing mode / Wall Split §5.6) · ADR-040 (canvas perf / wiring) · ADR-527 (SceneManager adapter) · ADR-420/395 (persistence scope)

---

## 1. Context / Πρόβλημα

Ο χρήστης χρειάζεται να **ενώνει δύο ομοαξονικούς τοίχους σε έναν** (η ανατολική
παρειά του τοίχου 1 με τη δυτική παρειά του τοίχου 2 → ένας ενιαίος τοίχος από το
δυτικό άκρο του 1 έως το ανατολικό άκρο του 2· ο 2ος διαγράφεται· τα ανοίγματα
επιβιώνουν). Είναι το **αντίστροφο** του υπάρχοντος Wall Split (ADR-363 §5.6).

Δύο ροές πρέπει να δουλεύουν (Revit / AutoCAD parity):
- **(Α) command-first:** πάτα «Ένωση Τοίχων» → κλικ τοίχο 1 → κλικ τοίχο 2 → ένωση.
- **(Β) selection-first:** επίλεξε 2 τοίχους → πάτα «Ένωση Τοίχων» → ένωση αμέσως.

## 2. Big-player research (100% ειλικρίνεια για την ποιότητα πηγών)

- **Revit:** ΔΕΝ έχει άμεσο «merge two walls». Αυτο-ενώνει σε **coincident endpoints**
  (Wall Joins) + Trim/Extend· το «κάνε δύο τοίχους έναν» δεν υπάρχει ως εντολή.
- **AutoCAD:** `JOIN` — ενώνει **συγγραμμικά** lines/arcs/polylines σε ένα αντικείμενο,
  **γεφυρώνοντας κενά**. Η ΠΙΟ κοντινή αναλογία στο ζητούμενο.
- **Cinema 4D / Figma:** vector weld/merge paths (γενικό, όχι BIM-aware).
- **Απόφαση:** μοντελοποιείται ως **AutoCAD JOIN για τοίχους** — ΕΝΑ εργαλείο, select-2
  → merge, με command-first ΚΑΙ selection-first.

## 3. Απόφαση — αρχιτεκτονική (FULL SSoT, mirror του Wall Split)

Το Wall Split είναι τέλειος καθρέφτης· το merge είναι το αντίστροφό του με reuse ΟΛΩΝ
των υπαρχόντων μηχανισμών:

| Layer | NEW αρχείο | Mirror από |
|-------|-----------|-----------|
| Pure geometry | `bim/walls/wall-merge.ts` | `bim/walls/wall-split.ts` |
| Opening patch SSoT | `bim/walls/opening-host-patch.ts` (Boy Scout extract) | `WallSplitCommand.applyOpeningPatch` |
| Undoable command | `core/commands/entity-commands/WallMergeCommand.ts` | `WallSplitCommand.ts` |
| Tool (FSM) | `hooks/tools/useWallMergeTool.ts` | `useWallSplitTool` (picking) + `useWallAttachTool` (activation-snapshot) |
| Persistence | `hooks/data/useWallMergePersistence.ts` | `useWallSplitPersistence.ts` |

**Pure geometry (`wall-merge.ts`):**
- `canMergeWalls(a, b)` → `{ ok }` ή `{ ok:false, reason }` — straight-only, collinear
  (παράλληλοι άξονες + perp-distance≈0), ίδιο πάχος.
- `buildMergedWallParams(a, b)` → clone PRIMARY params, άξονας outer-to-outer (προβολή
  και των 4 endpoints στον κοινό άξονα), bevel inheritance από τα outer άκρα, clear
  miters + measurementLength.
- `collectMergedOpenings(a, b, lookup, mergedId)` → `OpeningUpdate[]` (re-host ΟΛΩΝ των
  openings και των 2 με νέο offsetFromStart από το merged start).

**Dual-flow tool:** ο `useWallMergeTool` διαβάζει το selection στην ενεργοποίηση (ροή Β,
mirror attach `wasActiveRef`)· αν 2 τοίχοι → άμεση ένωση· αλλιώς picking (ροή Α, mirror
split). Και οι δύο ροές περνούν από `canMergeWalls` → `WallMergeCommand` → `executeCommand`
+ `bim:wall-merge-committed` (persistence). **preview ≡ commit**.

**Highlight/preview:** ΔΕΝ φτιάχτηκε νέος canvas renderer — ο πρώτος επιλεγμένος τοίχος
χρησιμοποιεί το standard selection highlight, ο hover candidate το HoverStore (ήδη
renderάρονται). Αποφεύγει churn στα ADR-040 render αρχεία.

## 4. Edge-case αποφάσεις (AutoCAD-JOIN defaults)

| Περίπτωση | Απόφαση |
|-----------|---------|
| Διαφορετικό πάχος | **ΜΠΛΟΚ** (`different-thickness`). Κατηγορία μπορεί να διαφέρει → primary wins. |
| Κενό στον άξονα | **Γεφυρώνεται** (merged = outer-to-outer· καλύπτει επαφή + επικάλυψη + κενό). |
| >2 τοίχοι | **Ακριβώς 2** (καθρέφτης split 1→2). Το geometry είναι γενικό → chain-merge = μελλοντική φάση. |
| Curved / polyline | Deferred (straight-only, όπως split Phase 1). |

> ⚠️ Τα defaults τέθηκαν αυτόνομα (ο χρήστης έλειπε τη στιγμή της ερώτησης). Είναι όλα
> ισολιμένα στο `canMergeWalls` / `buildMergedWallParams` — αλλάζουν με ελάχιστο ρίσκο.

## 5. Wiring

- Ribbon: `contextual-wall-tab.ts` panel `wall-actions` → simple button `wall.merge`
  (commandKey `wall-merge`, icon `bim-wall-merge` = lucide `Merge`), δίπλα στο `wall.split`.
- Tool id: `tool-definitions.ts` + `ui/toolbar/types.ts` → `'wall-merge'` (editing, continuous).
- Instantiate: `useModifyTools` → `useWallMergeTool` (`selectEntities` = `replaceEntitySelection`).
- Click routing: `useCanvasClickHandler` + `canvas-click-types.ts` (PRIORITY 1.617), plumbed
  through `CanvasSection` (ADR-040 orchestrator — additive props, μηδέν νέο subscription → CHECK 6C safe).
- ESC: `useCanvasEscapeRegistrations` + `useCanvasKeyboardShortcuts.types.ts`.
- Persistence: `useWallMergePersistence` mounted στο `WallPersistenceHost`.
- Event: `bim:wall-merge-committed` (`drawing-event-map-bim.ts`).
- i18n (el+en, `dxf-viewer-shell`): `ribbon.commands.wallEditor.merge` + `wallMerge.pickFirst/pickSecond/blocked.*`.

## 6. Tests

- `bim/walls/__tests__/wall-merge.test.ts` — 17 tests (canMerge reasons, union/gap/overlap/reversed,
  bevel inheritance, primary-wins, opening re-host, ghost axis).
- `core/commands/entity-commands/__tests__/WallMergeCommand.test.ts` — 5 tests (execute/undo/redo/no-op/affected ids).

## 7. Verification (browser)

Και οι 2 ροές (Α/Β)· openings επιβιώνουν· ένα Ctrl+Z επαναφέρει 2 τοίχους + openings·
άκυρη ένωση → Revit-style μήνυμα (καμία αλλαγή)· γεωαναφερμένο DXF (~17M).

## 8. Επιλογή/φωτισμός & contextual tabs (follow-ups)

- **Hover highlight στο tool:** το `wall-merge` προστέθηκε στο `entityPickingActive`
  (`CanvasSection.tsx`) ώστε οι τοίχοι να φωτίζονται στο hover (το highlight-pass ήταν
  gated σε `select`/picking-tools).
- **Picked-A = ο ορατός τοίχος:** το picking προτιμά το `getHoveredEntity()` (ίδιος με τον
  φωτισμένο) με fallback axis-projection hit-test — mirror `wall-on-entity`. Έτσι ο
  επιλεγμένος (selected) τοίχος είναι εγγυημένα ο ορατός → μένει φωτισμένος.
- **Dual contextual tab (ADR-566):** ομοιογενής πολλαπλή επιλογή (π.χ. 2 τοίχοι) →
  εμφανίζονται ΚΑΙ το per-kind «Ιδιότητες Τοίχου» (ΕΝΕΡΓΟ) ΚΑΙ το «Πολλαπλή Επιλογή».
  Υλοποίηση: **composite trigger** (per-kind + multi joined με `CONTEXTUAL_TRIGGER_SEPARATOR`,
  παραμένει single string → διατηρεί ADR-532 string-identity perf). `useActiveContextualTrigger`
  παράγει το composite (per-kind ΠΡΩΤΟ = active)· `RibbonRoot.visibleContextualTabs` κάνει
  split + ordering. Μεικτά είδη → μόνο «Πολλαπλή Επιλογή» (αμετάβλητο). Γενικεύεται σε όλα
  τα ομοιογενή BIM είδη (κολόνες/πλάκες κ.λπ.).

## 9. Changelog

- **2026-07-03** — Αρχική υλοποίηση (UNCOMMITTED). NEW `wall-merge.ts` + `opening-host-patch.ts`
  (Boy Scout extract, reused από WallSplitCommand) + `WallMergeCommand` + `useWallMergeTool`
  (dual-flow) + `useWallMergePersistence` + wiring + i18n. 22 jest πράσινα.
- **2026-07-03 (follow-up)** — highlight fixes (entityPickingActive + hovered-id pick) + dual
  contextual tab για ομοιογενή πολλαπλή επιλογή (composite trigger, §8).
