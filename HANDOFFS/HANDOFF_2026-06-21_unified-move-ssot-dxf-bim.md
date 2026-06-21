# HANDOFF — Ενοποίηση μηχανισμού ΜΕΤΑΚΙΝΗΣΗΣ DXF + BIM σε ΕΝΑ SSoT (Revit-grade)

**Ημ/νία:** 2026-06-21 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent (δουλεύει σε `export/` + ADR-505/507 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`). `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. Πριν edit κάθε αρχείου → `git status` σ' αυτό.
> ⚠️ **N.17 (ΕΝΑ tsc τη φορά):** πριν τρέξεις tsc έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process ... tsc`), μετά background.

---

## 0. ΤΟ ΖΗΤΟΥΜΕΝΟ (Giorgio)
Ο μηχανισμός μετακίνησης οντοτήτων **DXF και BIM** πρέπει να είναι **ΕΝΑΣ και μοναδικός SSoT** — όπως οι μεγάλοι παίκτες (Revit). FULL ENTERPRISE + FULL SSOT.

**Αρχιτεκτονική αρχή (Revit, επιβεβαιωμένη):** Μία API/`Transaction` μετακίνησης (`ElementTransformUtils.MoveElement`). Drag / numeric / grip / gizmo / keyboard nudge = **χειρονομίες εισόδου**, ΟΧΙ διαφορετικοί μηχανισμοί. Όλες καταλήγουν στον ΙΔΙΟ αγωγό:
`delta → snap → command → event(bim:entities-moved) → undo → associative regeneration`.
Πολυμορφικά **ΜΟΝΟ**: (α) εφαρμογή translation ανά τύπο γεωμετρίας, (β) associative αντιδράσεις (re-host/re-frame).

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — RE-VERIFY SSoT AUDIT (shared tree → paths ίσως μετακινήθηκαν)
```
grep -rn "MoveEntityCommand\|MoveMultipleEntitiesCommand\|calculateMovedGeometry\|bim:entities-moved" src/subapps/dxf-viewer/core/commands src/subapps/dxf-viewer/hooks
grep -rn "expandSelectionForMove\|withConnectedPipeFollow\|snapToGrid\|snapDeltaToGrid" src/subapps/dxf-viewer
grep -rln "SceneManager.*adapter\|LevelSceneManagerAdapter" src/subapps/dxf-viewer
```
**⚠️ Δες ΠΡΩΤΑ δύο σημερινά handoffs που ίσως αγγίζουν τον ίδιο κώδικα (πιθανό overlap άλλου agent):**
- `HANDOFFS/HANDOFF_2026-06-21_mergeable-move-command-base.md`
- `HANDOFFS/HANDOFF_2026-06-21_mergeable-update-command-base.md`
Αν ο άλλος agent ήδη αγγίζει `MoveEntityCommand`/merge → **συνεννοήσου / απόφυγε conflict** πριν edit.

---

## 2. Ο ΥΠΑΡΧΩΝ SSoT — ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΝΟΠΟΙΗΜΕΝΟ (ΜΗΝ το ξαναχτίσεις)
Η αρχιτεκτονική είναι **ήδη ~90% ενιαία** — ΕΝΑ σύστημα με κενά κάλυψης, **ΟΧΙ** δύο παράλληλα.

| SSoT (υπάρχον) | Ρόλος | Κάλυψη |
|---|---|---|
| `core/commands/entity-commands/MoveEntityCommand.ts` (+ `MoveMultipleEntitiesCommand`) | **ΤΟ κέντρο** — όλα τα plan-move paths περνούν από εδώ | DXF + BIM, 2D + 3D |
| `core/commands/entity-commands/move-entity-geometry.ts` → `calculateMovedGeometry()` | **Polymorphic** delta-apply: πρώτα BIM (`calculateBimMovedGeometry`), fallback DXF type-guards (`isLineEntity`/`isCircleEntity`...) | DXF + BIM |
| `bim:entities-moved` event | Ενιαίο event για ΟΛΑ τα plan moves | όλα |
| `beam-column-reframe-cascade.ts` → `reframeBeamsAndEmit` | re-frame δοκαριών σε κολώνες (ADR-492) μέσα στο command execute/undo | associative |
| `cascadeHostedOpeningsForWalls` (`MoveEntityCommand.ts:81`) | openings ακολουθούν τοίχο | associative |
| `systems/entity-creation/LevelSceneManagerAdapter.ts` | **canonical** scene adapter | (αλλά διπλασιάζεται — βλ. §3) |

**Entry points (όλα → `MoveEntityCommand` → `bim:entities-moved`):**
| Entry | Hook | Σημείο |
|---|---|---|
| Move Tool 2D (M) | `useMoveTool.ts:141` | + `expandSelectionForMove` (slab cascade) `:168` |
| Direct drag | `useEntityDrag.ts:301` | |
| Grip-drag entity | `useGripMovement.ts:383` | |
| Keyboard nudge | `useMovementOperations.ts:297` | |
| 3D gizmo plan | `bim3d-edit-command-builders.ts:210` | + `withConnectedPipeFollow` `:213` |
| Overlay drag (DXF) | `useModifyTools.ts:184` | `MoveOverlayCommand` (Firestore overlays — ξεχωριστό domain, βλ. ADR-049) |

---

## 3. ΤΑ ΚΕΝΑ ΠΡΟΣ ΕΝΟΠΟΙΗΣΗ (αυτό είναι το task — μικρά, στοχευμένα)
**Στόχος SSoT = επέκταση `MoveEntityCommand`** ώστε οι associative αντιδράσεις να τρέχουν **μέσα στο command** (όχι ανά entry point) → κλείνουν τα κενά για ΟΛΕΣ τις χειρονομίες με ΜΗΔΕΝ αλλαγή στα entry points (Revit-style: η regeneration ζει στο transaction, όχι στο UI gesture).

1. **Κενό 1 — Slab cascade ασύμμετρο:** `expandSelectionForMove` (slab→slab-opening) τρέχει ΜΟΝΟ στο Move Tool (`useMoveTool.ts:168`). Λείπει από drag (`useEntityDrag.ts`) + nudge. → **Μετέφερέ το ΜΕΣΑ στο `MoveEntityCommand`/`MoveMultipleEntitiesCommand`** (ή σε κοινό pre-step που καλούν όλα). Drag πλάκας → openings ακολουθούν.
2. **Κενό 2 — MEP pipe follow:** `withConnectedPipeFollow` τρέχει ΜΟΝΟ στο 3D (`bim3d-edit-command-builders.ts:213`). Λείπει από 2D. → ένταξη στο command SSoT.
3. **Κενό 3 — 3D vertical move:** χρησιμοποιεί `Update*ParamsCommand` + `bim:entity-params-updated` αντί `MoveEntityCommand`+`bim:entities-moved`. → **ΑΞΙΟΛΟΓΗΣΕ** αν πρέπει να ενοποιηθεί (vertical = αλλαγή offset/binding· ίσως δικαιολογημένα ξεχωριστό — Revit το vertical είναι κι αυτό MoveElement με Z vector). Κρίνε με Giorgio αν αξίζει.
4. **Διπλότυπο — SceneManager adapter ×4:** inline adapters σε `useMoveEntities.ts:77`, `useGripMovement.ts:188`, `hooks/grips/grip-commit-adapters.ts` → να χρησιμοποιήσουν την canonical `LevelSceneManagerAdapter.ts`. (Boy-scout, N.0.2.)
5. **Διπλότυπο — snap:** `snapToGrid` (`useEntityDrag.ts:149`) + `snapDeltaToGrid` (`useGripMovement.ts:144`) = ίδια λογική, δύο ονόματα → ΕΝΑ shared leaf module.

⚠️ **ΜΗΝ** φτιάξεις νέο move σύστημα. Επέκτεινε `MoveEntityCommand` + ενοποίησε στα υπάρχοντα. **DXF overlay move** (`MoveOverlayCommand`, Firestore-backed) είναι **σκόπιμα ξεχωριστό domain** (ADR-049) — μην το συγχωνεύσεις βίαια· εστίασε στο entity move SSoT.

---

## 4. ΕΠΑΛΗΘΕΥΣΗ (Revit-grade πειθαρχία — ΠΡΙΝ & ΜΕΤΑ)
**ΑΥΤΟ ΕΙΝΑΙ ΚΡΙΣΙΜΟ — μάθημα από προηγούμενη συνεδρία:** ΜΗΝ φτιάξεις fix χωρίς ντετερμινιστική αναπαραγωγή.
- DB ground-truth: Firestore collection **`entity_audit_trail`** (μέσω `mcp__firestore__*`) — query orderBy `timestamp` desc, reconstruct latest-value ανά `entityId`. Ο Giorgio καθαρίζει/ξαναγεμίζει από browser· όταν λέει «ΔΕΣ ΤΩΡΑ» ξανατράβα.
- Test floor: `lvl_21982f3b` «Ισόγειο», companyId `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`.
- Repro ανά κενό: π.χ. drag πλάκας με opening → δες αν το opening ακολούθησε (Κενό 1)· 2D move MEP → pipe follow (Κενό 2). Επιβεβαίωσε ΠΡΙΝ τον κώδικα ότι το κενό όντως εκδηλώνεται.

## 5. TESTS (πράσινα πριν & μετά)
```
npx jest src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/  # Move*, Mirror, Scale, Rotate persistence
npx jest src/subapps/dxf-viewer/bim/beams/__tests__/beam-column-reframe-cascade.test.ts
```
+ ΝΕΑ tests ανά κενό που κλείνεις (π.χ. «drag slab → openings follow σε ΕΝΑ undo»).

## 6. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 / N.15)
- **ADR:** `ADR-049-unified-move-tool-dxf-overlays.md` (το unified-move ADR) → update changelog με τα κλεισμένα κενά. Δες & `ADR-487-living-structural-organism-vision.md` (το όραμα οργανισμού — associative regen on move).
- Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές: τι εκκρεμεί) + `adr-index.md` + memory `MEMORY.md`.
- **ΜΗΝ** κάνεις commit/push — ο Giorgio.

## 7. EXECUTION MODE (N.8)
~4-6 αρχεία, 1-2 domains (commands + hooks). **Plan Mode** πιθανώς αρκεί· αν επεκταθεί σε 3D vertical + adapter consolidation (5+ αρχεία, 2+ domains) → **ρώτησε Giorgio orchestrator vs plan ΠΡΙΝ**.

---

## 8. STATUS ΠΡΟΗΓΟΥΜΕΝΗΣ ΣΥΝΕΔΡΙΑΣ (context γι' αυτή — ΜΗΝ το ξανακάνεις)
Διερευνήθηκε «undo διαγραφής κολώνας → resize σε 400» (ADR-459 atomic undo). **ΕΥΡΗΜΑ: ΔΕΝ υπάρχει bug.** Καθαρό single-column + 3-column ταυτόχρονο delete→1× undo → `action:'restored'` @250 σταθερά (DB-verified `entity_audit_trail`). Οι proactive αντιδράσεις σωστά ΔΕΝ πυροδοτούνται στο undo-restore (ήδη «quiet transaction»). Η αρχική παρατήρηση →400 ήταν confound παλιάς/βρώμικης συνεδρίας (`action:'created'` αντί `'restored'`). **Καμία αλλαγή κώδικα — σωστή απόφαση μηχανικού.** Άσχετο με το παρόν move task.
