# HANDOFF — ADR-401: Κεντρικοποίηση (SSoT) column attach reverse-lookup + stale re-link + detach-on-host-delete

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent (ADR-483/499/502/503/504 = beam-3d / structural / codes / sizing). `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `git add -A`**. **ΜΗΝ αγγίξεις** `bim/structural/*`, `bim/structural/sizing/*`, `bim/structural/organism/*`, `bim/structural/codes/*`, `bim-3d/diagrams/*`, `ADR-483/499/502/503/504*`.

---

## 0. ΓΙΑΤΙ ΑΥΤΟ ΤΟ HANDOFF (το πρόβλημα)
Σε προηγούμενη συνεδρία διορθώθηκε πραγματικό bug (κολώνες «κολλημένες» σε διαγραμμένα δοκάρια-φαντάσματα δεν re-link-άρανε στα νέα). Ο κώδικας **λειτουργεί** (73 jest GREEN, tsc clean) ΑΛΛΑ **ΔΕΝ είναι SSoT** — δημιουργήθηκε **column-parallel διπλότυπο** του υπάρχοντος wall μηχανισμού αντί για **γενίκευση**. Ο Giorgio το εντόπισε και ζητά να γίνει σωστά (full enterprise + full SSoT, Revit-grade).

**ΣΤΟΧΟΣ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ:** Refactor → ΜΙΑ γενική (entity-agnostic) πηγή αλήθειας για: (α) reverse-lookup «ποια attachable entities δείχνουν σε deleted host», (β) «stale attach» predicate, (γ) detach-on-host-delete. Τα wall + column (+stair όπου ισχύει) γίνονται thin wrappers. **Μηδέν νέα διπλότυπα.**

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
Ο Giorgio το ζήτησε ρητά. **ΜΗΝ** δημιουργήσεις τίποτα πριν επιβεβαιώσεις τι υπάρχει ήδη:
```
grep -rn "findAttachedWalls\|findAttachedColumns" src/subapps/dxf-viewer
grep -rn "attachTopToIds\|attachBaseToIds" src/subapps/dxf-viewer/bim/entities/entity-attach-detach.ts
grep -rn "topBinding !== 'storey-ceiling'\|topBinding === 'attached'" src/subapps/dxf-viewer/bim
grep -rn "AttachBindingParams\|detachEntitySide\|isEntitySideAttached" src/subapps/dxf-viewer
grep -rn "findWallsToAutoAttachToHost\|findColumnsFramedByBeam\|findColumnsToAutoAttachToHost" src/subapps/dxf-viewer
```
Επιβεβαίωσε με **Read** ότι τα paths/υπογραφές παρακάτω ισχύουν ακόμα (shared tree μετακινεί).

---

## 2. Ο ΥΠΑΡΧΩΝ SSoT ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ (ΟΧΙ νέο)
| SSoT | Τι δίνει | Σημείωση |
|---|---|---|
| `bim/entities/entity-attach-detach.ts` | **Η generic πηγή για ANY attachable entity** (wall+column+stair). `AttachBindingParams` {topBinding, baseBinding, attachTopToIds, attachBaseToIds}· `detachEntitySide`, `isEntitySideAttached`, `detachSidesAffectedByVerticalEdit`. | **ΕΔΩ** μπαίνουν οι νέοι generic predicates. |
| `bim/cascade/bim-cascade-resolver.ts` | `findAttachedWalls(hostIds, entities): string[]` (top-only, wall-only) — **το ΠΡΟΤΥΠΟ που διπλασίασα**. | Mirror `findHostedOpenings`. |
| `core/commands/entity-commands/DetachColumnsCommand.ts` | Batch undoable detach (snapshot+geometry+persist+undo) — **reuse, μην ξαναγράψεις**. | `DetachWallsCommand` ο δίδυμος. |
| `bim/walls/wall-structural-attach-coordinator.ts` → `notifyWallsOnHostDeletion` | wall host-delete path (warning-only). Καλεί `findAttachedWalls`. | |

**Καλούντες του `findAttachedWalls` (ΠΡΕΠΕΙ να μείνουν byte-for-byte ίδιοι):**
1. `bim/walls/wall-structural-attach-coordinator.ts` → `notifyWallsOnHostDeletion`
2. `bim-3d/animation/bim3d-edit-interaction-helpers.ts` → `captureMoveDependents` (3D move live re-clip)

---

## 3. ΤΙ ΥΛΟΠΟΙΗΘΗΚΕ ΗΔΗ (UNCOMMITTED, δικό μου — ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΔΙΠΛΟΤΥΠΟ ΠΡΟΣ ΕΞΑΛΕΙΨΗ)
3 αρχεία + 2 tests (όλα δικά μου, UNCOMMITTED):
- `bim/cascade/bim-cascade-resolver.ts` → NEW `findAttachedColumns(hostIds, entities): {topIds, baseIds}` ← **διπλότυπο** του `findAttachedWalls` (top+base αντί top).
- `bim/columns/column-structural-attach-coordinator.ts` → NEW `columnTopEligibleForAutoAttach(col, liveIds)` (stale-or-storey-ceiling) + χαλάρωσε 2 guards (`findColumnsToAutoAttachToHost`, `findColumnsFramedByBeam`: `topBinding!=='storey-ceiling'` → `!columnTopEligibleForAutoAttach(...)`). **Ο graph-variant `findColumnsFramedByBeamForGraph` ΕΜΕΙΝΕ αμετάβλητος** (connectivity, χωρίς guard — ΜΗΝ τον αγγίξεις).
- `core/commands/entity-commands/DeleteEntityCommand.ts` → NEW module-level `detachColumnsOnHostDeletion(deletedHostIds, sceneManager): ICommand[]` (χτίζει+εκτελεί `DetachColumnsCommand` ανά affected side, reuse) + field `hostDeletionDetaches` σε **DeleteEntityCommand ΚΑΙ DeleteMultipleEntitiesCommand** + wiring σε execute/undo/redo (undo re-attaches ΑΦΟΥ επανέλθει ο host· ΕΝΑ undo entry).
- tests: `bim/cascade/__tests__/bim-cascade-resolver.test.ts` (+`findAttachedColumns`), `bim/columns/__tests__/column-structural-attach-coordinator.test.ts` (stale-eligibility· **ένα παλιό test ενημερώθηκε** από "skips attached" σε "skips VALIDLY-attached-to-live / re-links stale").

(Άσχετο, επίσης UNCOMMITTED δικό μου από ίδια συνεδρία: ADR-483 Slice 6 beam-3D diagrams σε `bim-3d/diagrams/*` — **ΔΙΑΦΟΡΕΤΙΚΑ αρχεία, μην μπερδευτείς**, δεν αγγίζει το refactor.)

---

## 4. Η ΣΩΣΤΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ (full SSoT — τι να κάνεις)

### Βήμα Α — generic predicates στο `entity-attach-detach.ts` (ο υπάρχων generic SSoT)
Πάνω στο υπάρχον `AttachBindingParams` shape (entity-agnostic, pure):
- `attachSideReferencesAny(params, side: EntityAttachSide, hostIds: ReadonlySet<string>): boolean` — η side είναι `'attached'` ΚΑΙ η αντίστοιχη attach-list τέμνει το `hostIds`.
- `attachSideIsStale(params, side, liveIds: ReadonlySet<string>): boolean` — `'attached'` ΑΛΛΑ **όλα** τα attach ids εκτός `liveIds` (ή κενή/απούσα λίστα). (= η ουσία του `columnTopEligibleForAutoAttach` minus το `storey-ceiling` branch.)

### Βήμα Β — γενίκευσε το reverse-lookup στο `bim-cascade-resolver.ts`
- NEW generic `findEntitiesAttachedToHosts(hostIds, entities, side): string[]` (entity-agnostic, χρησιμοποιεί `attachSideReferencesAny` + έναν `isAttachableEntity` guard — wall|column|stair).
- `findAttachedWalls` → **thin wrapper** (`isWallEntity` φίλτρο + side 'top'). **ΚΡΑΤΑ ΥΠΟΓΡΑΦΗ/ΣΥΜΠΕΡΙΦΟΡΑ** (callers §2).
- `findAttachedColumns` → wrapper που επιστρέφει `{topIds, baseIds}` καλώντας το generic για 'top' και 'base' με `isColumnEntity` φίλτρο. (Ή κατάργησέ το και κάνε τους callers να καλούν το generic — ό,τι δίνει λιγότερο διπλότυπο.)

### Βήμα Γ — eligibility generic
- Στο `entity-attach-detach.ts`: `entitySideEligibleForReAutoAttach(params, side, defaults, liveIds): boolean` = (side binding === default π.χ. 'storey-ceiling') Ή `attachSideIsStale`. 
- `columnTopEligibleForAutoAttach` → delegate σε αυτό (ή κατάργησέ το). Οι 2 column detectors καλούν το generic.

### Βήμα Δ — detach-on-host-delete generic
- Το `detachColumnsOnHostDeletion` να βασιστεί στο generic `findEntitiesAttachedToHosts` + reuse `DetachColumnsCommand`. (Δομικά είναι ήδη ΟΚ· απλώς να τραβά από το generic.)
- **ΑΠΟΦΑΣΗ προς Giorgio:** να επεκταθεί το ΙΔΙΟ generic detach-on-delete και στους **τοίχους** (έχουν το ΙΔΙΟ bug — stale attach μπλοκάρει wall re-attach μέσω `findWallsToAutoAttachToHost`); Σήμερα οι τοίχοι κάνουν **μόνο warning** (ADR-401 Phase C). Full-enterprise = ναι, αλλά αλλάζει established wall behavior → **ρώτα τον Giorgio** πριν το κάνεις (μπορεί να θέλει να μείνει warning για back-compat). Αν ναι: κράτα ΚΑΙ το warning ΚΑΙ πρόσθεσε detach, με wall tests πράσινα.

### Επαλήθευση «πραγματικά SSoT»
Μετά το refactor: `grep "topBinding === 'attached'" / ".some(id => hostIds.has"` → να ΜΗΝ υπάρχουν ≥2 ανεξάρτητες υλοποιήσεις. Μία πηγή, wrappers.

---

## 5. TESTS ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΟΥΝ ΠΡΑΣΙΝΑ (run πριν & μετά)
```
npx jest \
  src/subapps/dxf-viewer/bim/cascade/__tests__/bim-cascade-resolver.test.ts \
  src/subapps/dxf-viewer/bim/columns/__tests__/column-structural-attach-coordinator.test.ts \
  src/subapps/dxf-viewer/bim/walls/__tests__/wall-structural-attach-coordinator.test.ts \
  src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/AttachColumnsCommand.test.ts \
  src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/DetachWallsCommand.test.ts \
  src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/DeleteEntityCommand.test.ts \
  src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/DeleteArrayCommand.test.ts
```
+ πρόσθεσε generic-level tests στο `entity-attach-detach` test (αν υπάρχει· αλλιώς δημιούργησε) για `attachSideReferencesAny` / `attachSideIsStale`.
**tsc (N.17 — ΕΝΑ τη φορά, έλεγξε ότι δεν τρέχει άλλος):** `npx tsc --noEmit` στο background.

---

## 6. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 / N.15)
- ADR-401 changelog: νέα γραμμή «SSoT consolidation — generic reverse-lookup/eligibility/detach· wall+column wrappers».
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: ενημέρωσε τη γραμμή «ADR-401 Column host-delete detach + stale re-link» (η ίδια εκκρεμότητα, τώρα SSoT-clean· κράτα 🔴 browser-verify+commit).
- memory: ενημέρωσε `reference_column_host_delete_detach_relink.md` (από «δημιούργησε parallel» → «γενικεύτηκε σε ΕΝΑ SSoT»).
- **ΜΗΝ** κάνεις commit (Giorgio).

## 7. ΚΑΤΑΣΤΑΣΗ
- Ο functional fix υπάρχει & δουλεύει (73 jest, tsc 0). Αυτό το task = **μόνο SSoT refactor** χωρίς αλλαγή συμπεριφοράς (πλην της ΑΠΟΦΑΣΗΣ §4.Δ για τοίχους).
- 🔴 browser-verify (μετά το refactor, ίδιο σενάριο proj_12788b6a): διαγραφή δοκαριού→κολώνες detach· νέο δοκάρι→re-attach (`attachTopToIds`=νέο beam)· undo. Δες `HANDOFFS/BASELINE_2026-06-19_columns-beams-top-vertices.md` για τα ids.
