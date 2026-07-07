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
  (παράλληλοι άξονες + perp-distance≈0), ίδιο πάχος. *(collinear-only gate — παραμένει.)*
- **`classifyWallJoin(a, b)` → `WallJoinPlan` (2026-07-03, corner-join):** το superset gate που
  αποφασίζει ΤΟΝ ΤΥΠΟ ένωσης: `collinear` (→ ένας τοίχος) | `corner` (μη-παράλληλοι άξονες →
  γωνία L στην τομή, ΔΥΟ τοίχοι) | `blocked` (typed reason). Παράλληλοι-μη-ομοαξονικοί →
  `parallel-offset` (καμία κοινή γωνία). Corner επιτρέπει **διαφορετικό πάχος** (μένουν 2 τοίχοι).
- **`computeWallCornerJoin(a, b)` → `{ joinPoint, wallAParams, wallBParams }` (2026-07-03):**
  `lineIntersection` (infinite axes, reuse `angle-entity-math`) → μετακινεί το ΚΟΝΤΙΝΟΤΕΡΟ άκρο
  κάθε τοίχου στο σημείο τομής (Revit "Wall Join" / AutoCAD trim-extend to corner = Fillet r=0).
  Καλύπτει επέκταση (γωνία πέρα από τους τοίχους) ΚΑΙ κόψιμο (γωνία ανάμεσα). Το μακρινό άκρο
  αμετάβλητο· clear miters + measurementLength (το wall corner framing ξανα-παράγει τη γωνία).
- `buildMergedWallParams(a, b)` → clone PRIMARY params, άξονας outer-to-outer (προβολή
  και των 4 endpoints στον κοινό άξονα), bevel inheritance από τα outer άκρα, clear
  miters + measurementLength.
- `collectMergedOpenings(a, b, lookup, mergedId)` → `OpeningUpdate[]` (re-host ΟΛΩΝ των
  openings και των 2 με νέο offsetFromStart από το merged start).

**Dual-flow tool:** ο `useWallMergeTool` διαβάζει το selection στην ενεργοποίηση (ροή Β,
mirror attach `wasActiveRef`)· αν 2 τοίχοι → άμεση ένωση· αλλιώς picking (ροή Α, mirror
split). Και οι δύο ροές περνούν από `classifyWallJoin`:
- **collinear** → `WallMergeCommand` → `executeCommand` + `bim:wall-merge-committed` (delete+add,
  custom persistence).
- **corner** (2026-07-03) → **2× `UpdateWallParamsCommand`** (a, b) τυλιγμένα σε **`CompositeCommand`**
  (ένα Ctrl+Z). Καθαρό reuse: το `UpdateWallParamsCommand` κάνει ΗΔΗ geometry recompute + hosted-opening
  cascade + auto-family-type reflow· η persistence ρέει από το **standard debounced wall auto-save**
  (`useWallPersistence`, όπως grip/move) → ΚΑΝΕΝΑ custom event/command χρειάστηκε.

**preview ≡ commit**.

**Highlight/preview:** ΔΕΝ φτιάχτηκε νέος canvas renderer — ο πρώτος επιλεγμένος τοίχος
χρησιμοποιεί το standard selection highlight, ο hover candidate το HoverStore (ήδη
renderάρονται). Αποφεύγει churn στα ADR-040 render αρχεία.

## 4. Edge-case αποφάσεις (AutoCAD-JOIN defaults)

| Περίπτωση | Απόφαση |
|-----------|---------|
| Μη-ομοαξονικοί (γωνία/κάθετα/υπό κλίση) | **CORNER JOIN** (2026-07-03, εντολή Giorgio): προέκταση/κόψιμο και των δύο αξόνων μέχρι την τομή → γωνία L· μένουν 2 τοίχοι. |
| Διαφορετικό πάχος | Collinear → **ΜΠΛΟΚ** (`different-thickness`)· Corner → **ΕΠΙΤΡΕΠΕΤΑΙ** (2 ξεχωριστοί τοίχοι). Κατηγορία collinear → primary wins. |
| Παράλληλοι αλλά με offset | **ΜΠΛΟΚ** (`parallel-offset`) — δεν είναι ομοαξονικοί ΚΑΙ δεν τέμνονται (καμία γωνία). |
| Κενό στον άξονα (collinear) | **Γεφυρώνεται** (merged = outer-to-outer· καλύπτει επαφή + επικάλυψη + κενό). |
| Ποιο άκρο μετακινείται (corner) | Το **κοντινότερο στην τομή** (Revit trim/extend)· το μακρινό αμετάβλητο. |
| >2 τοίχοι | **Ακριβώς 2**. Chain-merge/multi-corner = μελλοντική φάση. |
| Curved / polyline | Deferred (straight-only, όπως split Phase 1). |

> ⚠️ Τα collinear defaults τέθηκαν αυτόνομα (2026-07-03 αρχικά)· το **corner-join ζητήθηκε ρητά
> από τον Giorgio** με συγκεκριμένο παράδειγμα (οριζόντιος 1m + κάθετος 3m κάτω-δεξιά → γωνία στο
> σημείο τομής αξόνων). Όλα ισολιμένα σε `classifyWallJoin` / `computeWallCornerJoin`.

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

- `bim/walls/__tests__/wall-merge.test.ts` — 27 tests (canMerge reasons, union/gap/overlap/reversed,
  bevel inheritance, primary-wins, opening re-host, ghost axis, **+8 corner-join 2026-07-03**:
  `classifyWallJoin` collinear/corner/parallel-offset/not-straight/diff-thickness, `computeWallCornerJoin`
  Giorgio-example/miter-clear/parallel-null).
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
- **2026-07-03 (CORNER JOIN, εντολή Giorgio)** — η ΙΔΙΑ εντολή «Ένωση τοίχων» ενώνει πλέον ΚΑΙ
  μη-ομοαξονικούς τοίχους (κάθετα/γωνία/υπό κλίση): προέκταση/κόψιμο και των δύο αξόνων μέχρι την
  τομή → γωνία L, μένουν 2 τοίχοι. NEW `classifyWallJoin` + `computeWallCornerJoin` (`wall-merge.ts`,
  reuse `lineIntersection`). Tool branch: corner → 2× `UpdateWallParamsCommand` σε `CompositeCommand`
  (opening cascade + geometry recompute + auto-save = standard reuse, μηδέν custom event). NEW block
  reason `parallel-offset` + i18n (`wallMerge.blocked.parallelOffset`, `wallMerge.joinedCorner`).
  27 jest πράσινα. 🔴 browser-verify (γωνία/κάθετα/υπό-κλίση· 1 Ctrl+Z· openings· auto-save reload) + commit.
- **2026-07-07 (SSoT scaffold extract, flagged item E — Opus 4.8, shared tree)** — Το «pick two walls»
  dual-flow interaction (Flow B selection-first ⊕ Flow A command-first pick loop + escape) + οι scene
  helpers (`getScene`/`getWallById`/`findWallAtPoint`/`collectSelectedWalls`) ήταν **byte-identical**
  διπλότυπα στο `useWallMergeTool` **και** `useWallGapOpeningTool` (ADR-568). Εξήχθησαν σε **NEW SSoT**
  `hooks/tools/useWallPickScaffold.ts` (generic πάνω στον level manager, reuse του ADR-577
  `useSceneManagerAdapter`). Τα 2 hooks κρατούν μόνο το per-tool JOIN action (`executeMerge`/`executeBridge`),
  που δέχεται όλα όσα χρειάζεται μέσω **execute context** (`getSceneManager`/`getScene`/`levelManager`/`setHint`)
  → μηδέν circular dep, το action μένει pure closure πάνω στα δικά του commands/geometry. **Public API
  (props + return) αμετάβλητο** → μηδέν αλλαγή στα call sites (`useModifyTools`) & downstream (`CanvasSection`).
  Το `useWallSplitTool` **ΔΕΝ** είναι consumer (είναι point→point knife, όχι wall-pick — grep-verified, το
  αρχικό flag «3×» ήταν stale· ήδη migrated σε `useSceneManagerAdapter`). **NEW test**
  `__tests__/useWallPickScaffold.test.ts` (6 GREEN: Flow B ×3 / Flow A loop / execute-ctx / escape). ΟΧΙ tsc
  (N.17). 🔴 browser-verify (merge + gap-bridge, selection-first & pick-loop) + commit (Giorgio).
