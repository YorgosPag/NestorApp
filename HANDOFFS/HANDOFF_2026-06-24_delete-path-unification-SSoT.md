# HANDOFF — Ενοποίηση Delete Path (ribbon ↔ keyboard) σε ΕΝΑ SSoT command-based μονοπάτι

**Ημ/νία:** 2026-06-24
**Τύπος:** SSoT refactor (cross-cutting, orchestrator-scale). Revit-grade, FULL ENTERPRISE + FULL SSoT.
**Γλώσσα:** Απαντάς στον Giorgio **στα Ελληνικά.**
**Προηγούμενα handoffs (context QA):** `HANDOFF_2026-06-24_structural-organism-QA-continuation-and-fixes.md` + `HANDOFF_2026-06-24_column-foundation-wall-structural-organism-QA.md`.

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. ΠΟΤΕ `git add -A` (**shared working tree — δουλεύει κι άλλος agent**).
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE υπάρχοντος κώδικα, μηδέν διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **N.14:** πριν από non-trivial υλοποίηση → δήλωσε μοντέλο (**Opus** — cross-cutting) & **περίμενε «ok»**.
- **N.8:** orchestrator-scale (12+ αρχεία, 2+ domains) → πρότεινε Plan Mode/Orchestrator, πάρε έγκριση.
- **N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM)· verify με **jest**.
- **100% ειλικρίνεια.**

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (το εντόπισε ο Giorgio — σωστό SSoT εύρημα)

Υπάρχουν **ΔΥΟ παράλληλοι μηχανισμοί διαγραφής** για την ίδια ενέργεια:

| | **Keyboard Delete** (`useSmartDelete`) | **Ribbon «Διαγραφή»** |
|---|---|---|
| Μηχανισμός | `DeleteEntityCommand` / `DeleteMultipleEntitiesCommand` (μέσω `CommandHistory`) | raw `EventBus.emit('bim:X-delete-requested')` |
| **Undo (Ctrl+Z)** | ✅ Ναι | ❌ **ΟΧΙ** |
| Scene removal | **σύγχρονα** (command, πριν τα events) | hand-rolled μέσα στο `deleteX` (persistence hook) |
| **Cascades** | ✅ MEP dissolve, wall→opening, slab→slab-opening, **ADR-401 host-detach κολώνας/τοίχου**, cross-level footing | ❌ **ΚΑΝΕΝΑ** |

**Συνέπεια (πραγματικά bugs του ribbon path):**
- Ribbon delete **δεν αναιρείται** (Ctrl+Z).
- Ribbon delete **τοίχου** ΔΕΝ σβήνει τα φιλοξενούμενα ανοίγματα (orphan openings) — το `findHostedOpenings` cascade τρέχει ΜΟΝΟ στο smart-delete.
- Ribbon delete **host** (beam/slab) ΔΕΝ κάνει detach τα attached μέλη (ADR-401) → «ghost attach».
- Το race που μόλις μπαλώσαμε (βλ. §2) ήταν **σύμπτωμα** αυτού του διπλότυπου.

**Η ρίζα:** το ribbon δεν περνά από το canonical command-based delete· έχει δικό του μονοπάτι.

---

## 2. ΚΑΤΑΣΤΑΣΗ WORKING TREE (UNCOMMITTED — ο Giorgio θα κάνει commit)

Από την προηγούμενη συνεδρία QA «δομικού οργανισμού» — **3 διορθώσεις + 1 SSoT ενοποίηση, ΟΛΑ live/jest-verified, ασχολίαστα (uncommitted)**:

**#3 Float-dust πέδιλο (1350→1300)** — ✅ **live-verified** (πέδιλο βγήκε 1300×1300, area 1.69).
**#1 Delete-path race (combined πέδιλο «παγωμένο»)** — ✅ **live-verified** (ribbon delete 1 κολώνας → combined 2.628m² → isolated 1.69m², φορτίο 31.56→192.66).
- Fix = **optimistic update**: scene removal **ΠΡΙΝ** το Firestore `await` σε `useColumnPersistence.deleteColumn` + `useWallPersistence.deleteWall`.
- ⚠️ **Αυτό το fix είναι band-aid** πάνω στο διπλότυπο μονοπάτι. **Μετά την ενοποίηση (§3) θα γίνει σε μεγάλο βαθμό περιττό** (το command αφαιρεί τη σκηνή σύγχρονα πριν τα events) — μένει ως belt-and-suspenders ή καθαρίζεται (δες §5).
**roundUpToModule FULL SSoT (4→1)** — NEW `bim/structural/sizing/module-rounding.ts` (tolerant-ceil + roundDownToModule) αντικατέστησε 4 inline· 117/117 jest· `.ssot-registry.json` module `module-rounding`.

**Αρχεία uncommitted (μην κάνεις git add -A — shared tree):**
```
NEW  bim/structural/sizing/module-rounding.ts
NEW  bim/structural/sizing/__tests__/module-rounding.test.ts
MOD  bim/structural/footing-design/suggest-pad-dimensions.ts
MOD  bim/structural/footing-design/__tests__/suggest-pad-dimensions.test.ts
MOD  bim/structural/sizing/{slab,member,column}-sizing.ts
MOD  hooks/data/useColumnPersistence.ts   (#1)
MOD  hooks/data/useWallPersistence.ts     (#1)
MOD  .ssot-registry.json
MOD  docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md  (v14/v15/v16)
MOD  .claude-rules/pending-ratchet-work.md
```
*(+ προϋπάρχοντα modified αρχεία ΑΛΛΟΥ agent — μην τα αγγίξεις: useCanvasEditActions, useDimensionModify, useStructuralFootingConnect, useStructuralOrganismNotification, dim-break-engine, LevelSceneManagerAdapter.)*

---

## 3. Η ΕΝΟΠΟΙΗΣΗ ΠΟΥ ΖΗΤΑΕΙ Ο GIORGIO (το κυρίως task)

**Στόχος:** ΕΝΑ SSoT μονοπάτι διαγραφής. Το ribbon «Διαγραφή» να περνά από τον **ΙΔΙΟ** command-based delete με το keyboard → undoable + cascades + zero race + μηδέν διπλότυπο.

### 3.1 Τα 6 ribbon emit-sites (το παράλληλο pattern) — ΠΡΟΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗ
```
ui/ribbon/hooks/useRibbonColumnBridge.ts:247   emit('bim:column-delete-requested',  {columnId})
ui/ribbon/hooks/useRibbonBeamBridge.ts:404      emit('bim:beam-delete-requested',    {beamId})
ui/ribbon/hooks/useRibbonWallBridge.ts:301      emit('bim:wall-delete-requested',    {wallId})
ui/ribbon/hooks/useRibbonSlabBridge.ts:326      emit('bim:slab-delete-requested',    {slabId})
ui/ribbon/hooks/useRibbonRoofBridge.ts:347      emit('bim:roof-delete-requested',    {roofId})
ui/ribbon/hooks/useRibbonOpeningBridge.ts:312   emit('bim:opening-delete-requested', {openingId})
```
Καθένα προηγείται από `window.confirm(...)` (κράτα το confirm UX).

### 3.2 Ο canonical delete (SSoT προς εξαγωγή) = `useSmartDelete`
`hooks/canvas/useSmartDelete.ts` — «All deletions go through Command History» (ADR-032). Priority system:
1. grip vertices · 2. overlays · **3. DXF/BIM entities** (≈ γρ. 290–352) · 4. electrical circuit.
Το **PRIORITY 3 branch** (το ζητούμενο) κάνει:
- `collectBimDeleteIds(idsToDelete, adapter)` **πριν** την αφαίρεση (`smart-delete-bim-events.ts`)
- wall→opening + slab→slab-opening cascade (`findHostedOpenings`/`findHostedSlabOpenings`, `bim/cascade/bim-cascade-resolver.ts`)
- `new DeleteEntityCommand` ή `DeleteMultipleEntitiesCommand` (`core/commands/entity-commands/DeleteEntityCommand.ts`) — που ΗΔΗ κάνει **ADR-401 host-detach** (column+wall) + `notifyWallsOnHostDeletion`
- MEP cascade (`resolveMepCascadeOnDelete`) bundled σε `CompoundCommand`
- `executeCommand(...)` (CommandHistory → **σύγχρονη** scene removal + undoable)
- clear selection
- `emitBimDeleteEvents(collected)` → ανά type `emitBimEntityDeleteRequested` → `bim:X-delete-requested` → ο **persistence hook** `deleteX` κάνει **Firestore delete** (+ σήμερα redundant scene filter)

**ΚΟΜΒΙΚΟ:** τα `bim:X-delete-requested` **εξακολουθούν να εκπέμπονται** από το command path (μέσω `emitBimDeleteEvents`) → οι structural αντιδράσεις (`useAutoFoundationDesign`/`useProactiveStructuralLoads`/`useStructuralOrganism` μέσω `useGroupedStructuralReaction`, microtask-coalesced) ΕΞΑΚΟΛΟΥΘΟΥΝ να τρέχουν — αλλά τώρα διαβάζουν **φρέσκια σκηνή** (το command αφαίρεσε σύγχρονα πριν το emit). **→ Η ενοποίηση εξαλείφει δομικά το race του #1** (το band-aid γίνεται περιττό).

### 3.3 SSoT AUDIT ΠΡΩΤΑ (grep — REUSE, μηδέν διπλότυπο)
**ΠΡΙΝ γράψεις:** ψάξε αν υπάρχει ΗΔΗ shared «delete entities by id» dispatch (π.χ. σε `hooks/canvas/`, `core/commands/`, `systems/`). Πιθανά κλειδιά: `deleteEntitiesById`, `deleteEntities`, `buildDeleteCommand`, `emitBimDeleteEvents`, `collectBimDeleteIds`. Αν ο πυρήνας είναι **inline** μέσα στο `useSmartDelete` (πιθανότατο) → **εξάγαγέ τον** σε καθαρό SSoT, ΜΗΝ τον αντιγράψεις.

### 3.4 Προτεινόμενη αρχιτεκτονική (επιβεβαίωσε/βελτίωσε με audit)
- **NEW SSoT** `hooks/canvas/delete-entities-core.ts` (ή κατάλληλο leaf): `deleteEntitiesById(ids, deps)` που ενσωματώνει: cascade collection (opening/slab-opening) + DeleteEntity/Multiple + MEP cascade CompoundCommand + `executeCommand` + `emitBimDeleteEvents`. **Καθαρό από selection/grip/overlay** (αυτά μένουν στο `useSmartDelete`).
- `useSmartDelete` PRIORITY 3 → καλεί `deleteEntitiesById(idsToDelete, deps)` (μηδέν regression — ίδια λογική, μία πηγή).
- Τα **6 ribbons** → αντί για raw emit, καλούν `deleteEntitiesById([entity.id], deps)` (μετά το confirm). Χρειάζονται πρόσβαση στο adapter/levelManager/executeCommand/user — **audit** πώς τα παίρνουν ήδη τα ribbons (πιθανό shared deps/context).
- **Foundation/structural αντιδράσεις:** αμετάβλητες (τα events εκπέμπονται όπως πριν, από το command path).

### 3.5 ΠΡΟΣΟΧΗ / gotchas
- **Cross-level footing path** (`DeleteCrossLevelFootingsCommand`, PRIORITY στο smart-delete) — μην το σπάσεις· αν τα ribbons δεν αφορούν footings, μπορεί να μείνει εκτός του core ή να καλυφθεί.
- **`window.confirm` UX:** κράτα το ανά ribbon (ή κεντρικοποίησέ το αν θες — δες αν υπάρχει shared confirm).
- **`deleteX` persistence hooks** (deleteColumn/deleteWall/deleteBeam/deleteSlab/deleteRoof/deleteOpening): μετά την ενοποίηση παραμένουν ως **Firestore-delete handlers** των `bim:X-delete-requested`. Η scene-removal τους γίνεται **redundant** (το command έχει το scene). **ENDGAME (full SSoT):** κάνε τα `deleteX` **Firestore-only** (αφαίρεσε το scene filter + το #1 band-aid) ώστε ΕΝΑΣ owner του scene (το command). Επιβεβαίωσε ότι κανένα ΑΛΛΟ μονοπάτι δεν βασίζεται στο scene-removal του `deleteX`.
- **Undo συμμετρία (ADR-390):** το DeleteEntityCommand ήδη κάνει emit `bim:entity-restore-requested` στο undo → τα persistence hooks ξαναδημιουργούν το doc. Επαλήθευσε ότι το undo του ribbon-delete πλέον επαναφέρει + το πέδιλο reconcile-άρει πίσω.
- **Shared tree:** άλλος agent ίσως αγγίζει ribbon/persistence — έλεγξε `git status` πριν, δούλεψε στοχευμένα.

### 3.6 Επαλήθευση
- jest: smart-delete σχετικά suites + νέο suite για `deleteEntitiesById` (cascade + command build + events).
- **Browser (ο Giorgio):** ribbon «Διαγραφή» → (α) **Ctrl+Z επαναφέρει** ✅· (β) διαγραφή τοίχου σβήνει τα ανοίγματά του· (γ) διαγραφή κολώνας από combined → πέδιλο reconcile (όπως #1)· «ΔΕΣ ΒΑΣΗ» στο Firestore.

### 3.7 ADR
Ψάξε σχετικό ADR (ADR-032 command history / ADR-363 bim drawing / ADR-401 cascade). Code = source of truth· ενημέρωσε ADR changelog + (αν χρειαστεί) `.ssot-registry` module («forbid raw `bim:X-delete-requested` emit σε ribbon bridges → χρήση `deleteEntitiesById`»).

---

## 4. ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ
«Ενοποιώ το ribbon delete (6 bridges: column/beam/wall/slab/roof/opening) με το keyboard delete (`useSmartDelete`) σε ΕΝΑ command-based SSoT `deleteEntitiesById`. Στόχος: undoable + cascades + zero race. SSoT audit (grep) ΠΡΩΤΑ — εξάγω τον πυρήνα από το `useSmartDelete` PRIORITY 3, ΔΕΝ τον αντιγράφω. Τα `deleteX` persistence hooks γίνονται Firestore-only (endgame). Verify με jest + browser (Ctrl+Z + cascade + "ΔΕΣ ΒΑΣΗ"). Commit κάνει ο Giorgio. Shared tree — όχι git add -A. Ελληνικά.»

---

## 5. CONTEXT
Προηγούμενη συνεδρία έκλεισε στο 🔴 ~87% μετά τα live QA + 3 fixes + SSoT ενοποίηση. Νέα συνεδρία = καθαρό context για το delete-unification refactor.
