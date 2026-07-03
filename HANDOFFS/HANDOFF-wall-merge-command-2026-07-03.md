# HANDOFF — «Ένωση Τοίχων» (Merge/Join Walls) εντολή στο ribbon

**Ημ/νία:** 2026-07-03
**ADR:** ΝΕΟ (επόμενο ελεύθερο — έλεγξε `docs/centralized-systems/reference/adr-index.md`· πιθανό **ADR-566**) ή επέκταση ADR-363 (wall editing). Δες §7.
**Status:** 🔴 NOT STARTED — σχεδιασμός + υλοποίηση
**Μοντέλο:** Opus (αρχιτεκτονική/cross-cutting· 5+ αρχεία, 2 domains)
**⚠️ COMMIT:** Ο **Giorgio** κάνει commit — **ΕΣΥ ΠΟΤΕ** (N.-1). **Shared working tree με άλλον agent.**

---

## 0. ΤΙ ΝΑ ΚΑΝΕΙΣ ΠΡΩΤΑ (μη το προσπεράσεις)

1. **N.8 → Plan Mode** πρώτα (5+ αρχεία, 2 domains: modify-tool FSM + ribbon UI + command/geometry). ΟΧΙ κώδικας πριν το plan.
2. **ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις γραμμή** — §3. Reuse, μη δημιουργείς διπλότυπα.
3. **Big-player πρώτα** (§1): Revit / Cinema 4D (Maxon) / Figma-level. FULL ENTERPRISE + FULL SSoT. Αν οι μεγάλοι δεν προτείνουν κάτι → ακολουθούμε ΤΗΝ πρακτική τους.
4. **ΜΗΝ αγγίξεις** αρχεία άλλου agent στο shared tree. Άγγιξε ΜΟΝΟ wall-merge / ribbon / command αρχεία δικά μας.

---

## 1. Ο ΣΤΟΧΟΣ (τι θέλει ο Giorgio)

Νέα εντολή **«Ένωση Τοίχων»** στο ribbon που **ενώνει δύο τοίχους σε έναν**.

**Δύο ροές (και οι δύο πρέπει να δουλεύουν — Revit/AutoCAD parity):**
- **(Α) command-first:** πάτα «Ένωση τοίχων» → επίλεξε τοίχο 1 → επίλεξε τοίχο 2 → ενώνονται.
- **(Β) selection-first:** επίλεξε 2 τοίχους → πάτα «Ένωση τοίχων» → ενώνονται αμέσως.

**Γεωμετρία ένωσης (από το στιγμιότυπο `Στιγμιότυπο οθόνης 2026-07-03 142620.jpg`):**
δύο **οριζόντιοι, ομοαξονικοί** τοίχοι (1 αριστερά, 2 δεξιά). Η **ανατολική παρειά του τοίχου 1** ενώνεται με τη **δυτική παρειά του τοίχου 2** → **ΕΝΑΣ** ενιαίος τοίχος από το **δυτικό άκρο του 1** έως το **ανατολικό άκρο του 2** (union του axis), ίδιο πάχος/ύψος/params, ο δεύτερος τοίχος διαγράφεται. Ανοίγματα/openings και των δύο πρέπει να **επιβιώσουν** (redistribute στον νέο τοίχο — δες `redistributeOpenings` του wall-split, το αντίστροφο).

**Προϋποθέσεις εγκυρότητας (validate + Revit-style μη-blocking μήνυμα αν αποτύχει):**
συνγραμμικότητα αξόνων (collinear, εντός tol), ίδιο πάχος (ή απόφαση Giorgio για διαφορετικό), επικάλυψη/επαφή παρειών (τα δύο άκρα «κοιτάνε» το ένα το άλλο). **Ρώτα τον Giorgio** με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό/οπτικό παράδειγμα (memory: lead-with-concrete-example) για: (α) τι γίνεται αν διαφέρει το πάχος/κατηγορία· (β) αν επιτρέπεται ένωση με κενό (gap) ανάμεσα ή μόνο επαφή/επικάλυψη· (γ) >2 τοίχοι μαζί;

---

## 2. BIG-PLAYER RESEARCH (κάνε το ΠΡΙΝ το design)

- **Revit:** ΔΕΝ έχει άμεσο «merge two walls». Αυτο-ενώνει σε **coincident endpoints** (Wall Joins) + Trim/Extend. Το «κάνε δύο τοίχους έναν» = AutoCAD-style.
- **AutoCAD:** `JOIN` — ενώνει **συγγραμμικά** lines/arcs/polylines σε ένα αντικείμενο (η ΠΙΟ κοντινή αναλογία στο ζητούμενο).
- **Cinema 4D / Figma:** vector merge/weld paths (γενικό, όχι BIM).
- **Απόφαση:** μοντελοποίησε το ως **AutoCAD JOIN για τοίχους** — ΕΝΑ εργαλείο, select-2 → merge, με command-first ΚΑΙ selection-first (§1). Τεκμηρίωσε τις πηγές στο ADR (100% ειλικρίνεια για την ποιότητα πηγών).

---

## 3. SSoT AUDIT — GREP ΠΡΙΝ ΚΩΔΙΚΑ (ΥΠΟΧΡΕΩΤΙΚΟ)

```
# ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΕΡΓΑΛΕΙΟ — MIRROR IT (split → merge)
grep -rn "useWallSplitTool\|WallSplitCommand\|WallSplitStore\|redistributeOpenings\|computeSplitWallParams" src/subapps/dxf-viewer

# ΥΠΑΡΧΟΝ merge SSoT (collinear lines→Line) — collinearity + merge semantics
grep -rn "EntityMergeService\|arePointsCollinear\|entityToSegments\|samePoint" src/subapps/dxf-viewer

# Wall geometry / trims / collinear-overlap / axis projection (reuse, ΜΗΝ ξαναγράψεις)
grep -rn "isMemberCollinearOverlap\|projectPointOnWallAxis\|computeWallGeometry\|buildWallEntity\|extendFillingWallToNeighbors" src/subapps/dxf-viewer

# Selection-first: πώς παίρνει 2 selected walls ένα εργαλείο/bridge
grep -rn "getSelectedEntityIds\|getPrimaryId\|useUniversalSelection\|clearByType" src/subapps/dxf-viewer/hooks/tools src/subapps/dxf-viewer/ui/ribbon

# Ribbon wiring του wall-split (ΤΟ ΝΕΟ command πάει ΔΙΠΛΑ ΤΟΥ)
grep -rn "wall-split\|wall\.split\|'wall-split'" src/subapps/dxf-viewer/ui/ribbon src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts src/subapps/dxf-viewer/hooks/tools/useModifyTools.ts src/subapps/dxf-viewer/systems/tools/tool-definitions.ts

# Undoable command pattern + scene adapter + enterprise id
grep -rn "createLevelSceneManagerAdapter\|executeCommand\|generateWallId\|ICommand" src/subapps/dxf-viewer/core/commands src/subapps/dxf-viewer/hooks/tools
```

**Κανόνας:** αν υπάρχει helper → reuse. Νέα geometry ΜΟΝΟ αν δεν υπάρχει, ως ΕΝΑ SSoT (π.χ. `bim/walls/wall-merge.ts`).

---

## 4. ΤΙ ΥΠΑΡΧΕΙ ΝΑ ΚΑΝΕΙΣ REUSE (πρώτα ευρήματα audit)

**Το αντίστροφο εργαλείο = το template σου (MIRROR):**
- `hooks/tools/useWallSplitTool.ts` — modify-tool FSM (idle→picking→click→command→loop, ESC/right-click exit). Ζει στο `hooks/tools/` (όχι drawing) γιατί θέλει `executeCommand` (undo/redo), όπως `useTrimTool`. **Το `useWallMergeTool` = καθρέφτης του** (πάρε 2 τοίχους αντί 1 split point).
- `core/commands/entity-commands/WallSplitCommand.ts` — undoable command → **NEW `WallMergeCommand`** (delete 2 + create 1, με proper undo). Reuse `createLevelSceneManagerAdapter`.
- `bim/walls/wall-split.ts` (`computeSplitWallParams`/`redistributeOpenings`/`computeSplitIndicatorLine`) → **NEW `bim/walls/wall-merge.ts`** (build merged WallParams από 2 τοίχους + collect/redistribute openings + merged-preview line). Reuse `computeWallGeometry`, `buildWallEntity`.
- `systems/wall-split/WallSplitStore.ts` — zero-React preview store (split indicator) → **NEW `WallMergeStore`** (highlight των 2 picked + ghost του merged, ADR-040 high-freq path, μηδέν React state).
- `hooks/data/useWallSplitPersistence.ts` — persistence pattern → merge persistence (delete του 2ου + update/create).

**Merge/collinear SSoT:**
- `services/EntityMergeService.ts` — υπάρχον merge (collinear lines→Line, `arePointsCollinear`, `entityToSegments`, `samePoint`). Collinearity + union semantics· ΟΧΙ walls, αλλά reuse τη λογική συγγραμμικότητας.
- `bim/framing/linear-member-face-snap.ts` `isMemberCollinearOverlap` — έλεγχος ομοαξονικής επικάλυψης μελών (validate ένωσης).
- `bim/walls/wall-axis-projection.ts` `projectPointOnWallAxis`, `bim/walls/wall-region-autojoin.ts` `extendFillingWallToNeighbors` — axis/extend helpers.

**Ribbon (το «σπίτι» της εντολής):**
- `ui/ribbon/data/contextual-wall-tab.ts` — έχει ΗΔΗ το `wall.split` (commandKey `wall-split`, icon `bim-wall-split`) στο panel «wall-actions». **Πρόσθεσε `wall.merge` / commandKey `wall-merge` δίπλα του** (ίδιο pattern, νέο icon + i18n key).
- `ui/ribbon/hooks/bridge/wall-command-keys.ts` — `WALL_RIBBON_KEYS_ACTIONS` (αν το κάνεις action) ή commandKey→ToolType (αν το κάνεις tool, όπως το split).
- **Selection-first path:** `useRibbonWallBridge.onAction` (ή ο tool-change handler) — αν 2 τοίχοι είναι ήδη selected όταν πατηθεί → merge αμέσως· αλλιώς → ενεργοποίησε το picking tool. Reuse `useUniversalSelection.getSelectedEntityIds`.

**Wiring (mirror του wall-split):**
- `systems/tools/tool-definitions.ts` + `ui/toolbar/types.ts` — νέο tool id `'wall-merge'`.
- `hooks/canvas/useCanvasClickHandler.ts` — route wall-merge clicks (mirror wall-split branch).
- `hooks/tools/useModifyTools.ts` (ή useSpecialTools) — instantiate `useWallMergeTool`.
- `app/ribbon-contextual-config.ts` — αν χρειάζεται να μένει ανοιχτή η καρτέλα κατά το picking.
- Icon: `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` / `structural-icon-methods.tsx` — νέο glyph `bim-wall-merge` (⚠️ shared με άλλον agent· προτίμησε self-contained αν γίνεται, ή stage προσεκτικά).

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (προς επικύρωση στο Plan)

- **NEW pure** `bim/walls/wall-merge.ts`: `canMergeWalls(a,b,tol) → {ok, reason?}` (collinear + thickness + touch/overlap) + `buildMergedWallParams(a,b,units) → WallParams` (axis union outer-to-outer, keep params του primary) + `collectMergedOpenings(a,b)` (reuse redistribute). ΚΑΘΑΡΟ, testable, μηδέν React.
- **NEW** `WallMergeCommand` (undoable: remove b + replace a με merged, ή remove both + add merged· proper undo restore).
- **NEW** `useWallMergeTool` (mirror split): picking 2 walls → `canMergeWalls` gate → `WallMergeCommand` → `executeCommand` → loop. + `WallMergeStore` για highlight/ghost preview (**preview ≡ commit**).
- **Selection-first:** στο ribbon action, αν `getSelectedEntityIds().filter(isWall).length === 2` → build+execute αμέσως· αλλιώς activate tool.
- **i18n** (N.11, el+en): label/tooltip + status prompts + validation reasons.

---

## 6. CONSTRAINTS / DoD

- **N.-1:** ΟΧΙ commit/push (ο Giorgio). **Shared tree** — άγγιξε ΜΟΝΟ wall-merge/ribbon/command αρχεία.
- **N.11:** όλα τα νέα UI strings → locale keys (el+en). **N.7.1:** ≤500 γρ/αρχείο, ≤40 γρ/function.
- **N.6:** νέο WallEntity → `generateWallId()` (enterprise-id.service). **N.17:** ΟΧΙ tsc — μόνο colocated jest.
- **ADR-040 (CHECK 6B/6D):** αν αγγίξεις preview/canvas/hover render → stage ADR-040. Το preview highlight/ghost = ADR-040 leaf pattern (zero React, mirror WallSplitStore).
- **Undo/redo:** ένα Ctrl+Z αναιρεί την ένωση (επαναφέρει 2 τοίχους + openings). Idempotent.
- **Preview ≡ commit:** το ghost του merged = ίδιο `buildWallEntity` με το command.
- **Verify:** jest (pure `wall-merge` — collinear/thickness/union/openings + canMerge reasons) + browser (και οι 2 ροές Α/Β· openings επιβιώνουν· undo· Revit-style message σε άκυρη ένωση· γεωαναφερμένο DXF ~17M).
- **ADR:** νέο ADR (big-player research §2 + απόφαση αρχιτεκτονικής + changelog) ή επέκταση ADR-363· ενημέρωσε adr-index.

---

## 7. ΚΑΤΑΣΤΑΣΗ WORKING TREE (context)

- **UNCOMMITTED (θα τα κάνει commit ο Giorgio, ίσως πριν ξεκινήσεις):** (α) ADR-565 «Draw Options Bar» καμπύλου τοίχου (6 arc draw-variants)· (β) **fix viewport-culling** (`dxf-viewport-culling.ts` — `getEntityBBox` χωρίς `case 'wall'` έκρυβε τοίχους σε γεωαναφερμένα DXF ~1e7). **Χάρη στο (β) οι τοίχοι φαίνονται πλέον** στη γεωαναφερμένη περιοχή του στιγμιότυπου.
- Το `git status` ίσως δείχνει modified άλλου agent (snapping/engines, useColumnTool, radial-*, icon files) — **ΔΕΝ είναι δικά σου**, μην τα stage-άρεις.
