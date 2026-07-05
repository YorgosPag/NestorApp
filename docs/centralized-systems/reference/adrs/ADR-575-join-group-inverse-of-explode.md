# ADR-575 — JOIN «Ένωση» + GROUP «Ομαδοποίηση»: το αντίστροφο της «Διάλυσης» (Explode)

- **Status:** 🟢 IMPLEMENTED (UNCOMMITTED)
- **Date:** 2026-07-05
- **Domain:** DXF Viewer · Modify commands · Entity model · Ribbon
- **Related:** ADR-186 (Entity Join), ADR-510 Φ5 (Explode), ADR-353 (Associative Array — ο αρχιτεκτονικός καθρέφτης), ADR-032 (Command History)

---

## 1. Context

Ο viewer είχε ήδη τη **«Διάλυση» (Explode)**: σπάει compound οντότητες (polyline/rectangle)
σε primitives. Έλειπε το **αντίστροφο**, σε δύο γεύσεις που ζήτησε ρητά ο Giorgio:

1. **JOIN «Ένωση»** — ξεχωριστά τμήματα (γραμμές/τόξα/πολυγραμμές) → **ΕΝΑ** αντικείμενο.
2. **GROUP «Ομαδοποίηση»** — πολλά αντικείμενα → **ΕΝΑ** επαναχρησιμοποιήσιμο σύνθετο (+ Ungroup).

Πρότυπα big-player: AutoCAD JOIN/BLOCK/GROUP, Revit Group⇄Ungroup, Figma/Cinema 4D Group.

### SSoT audit ευρήματα (πριν τον κώδικα)
- **JOIN υπήρχε ΗΔΗ, σχεδόν πλήρες**: `EntityMergeService` (pure, AutoCAD semantics) +
  `JoinEntityCommand` (undoable) + `useEntityJoin`. Εκτίθετο μόνο σε context-menu + keyboard.
  **Κενό**: καμία έκθεση στο ribbon Home ▸ Modify symmetric με τη «Διάλυση».
- **GROUP create-from-selection ΕΛΕΙΠΕ** εντελώς.
- ⚠️ **Ο τύπος `type: 'block'` ΔΕΝ ήταν ελεύθερος**: είναι πραγματικός DXF INSERT τύπος με
  load-bearing consumers (`dxf-export.types` → `INSERT`, `InsertionSnapEngine` → single-point
  snap, `entity-bounds`/`bounds-entity` → point bbox, `stretch`/`PathCache`/`array-transform` →
  translate-only). Reuse του `'block'` ως container θα εμφάνιζε την ομάδα ως σημείο στο (0,0),
  αόρατη/μη-επιλέξιμη, και θα την mis-export-αρε ως INSERT.

---

## 2. Decision

### 2.1 JOIN — έκθεση στο ribbon (μηδέν νέος merge πυρήνας)
Νέος action-interceptor `useJoinRibbonAction` (καθρέφτης του `useExplodeRibbonAction`) που
**reuse-άρει** το υπάρχον `useEntityJoin` SSoT. Κουμπί «Ένωση» στο Home ▸ Modify δίπλα στη
«Διάλυση». Αλυσίδα interceptors: `group → join → explode → array → base`.

### 2.2 GROUP — νέος `type: 'group'` container (καθρέφτης του ArrayEntity)
- Νέο **dedicated** `EntityType` literal `'group'` (ΟΧΙ reuse του `'block'`).
- `GroupEntity { type:'group'; members: Entity[] }` — **in-place, IDENTITY transform**
  (Revit/Figma/C4D): τα members κρατούν τις **απόλυτες** συντεταγμένες τους και τα **κατέχει** ο
  container (αφαιρούνται από το scene). Ορίζεται στο `types/entities.ts` (όπως ο `ArrayEntity`,
  για αποφυγή circular import `Entity ↔ GroupEntity`).
- **Render/hit-test/selection «τζάμπα»** μέσω του **expand-before-convert** pattern του
  ArrayEntity: `expandGroupEntity` επιστρέφει τα members tagged με το `group.id`, ώστε click σε
  οποιοδήποτε member να επιλέγει ολόκληρη την ομάδα. Recursive (nested groups/arrays).
- **UNGROUP ≡ EXPLODE ενός group**: το `explode-entity.ts` delegate-άρει το `'group'` case στο
  `ungroupGroup` (single SSoT). Άρα το πλήκτρο «Διάλυση» (X) ΚΑΙ το «Κατάργηση Ομαδοποίησης»
  κάνουν το ίδιο — πλήρως symmetric με AutoCAD (EXPLODE ενός INSERT).
- **Undoable**: `CreateGroupCommand` (δομικός καθρέφτης του `JoinEntityCommand`). Ungroup μέσω
  του υπάρχοντος `ExplodeEntityCommand` (χειρίζεται πλέον `'group'`).
- **Transforms**: MOVE/ROTATE/SCALE/MIRROR ενός group κάνουν **SSoT recursion** πάνω στα members
  (κάθε per-primitive geometry SSoT: `calculateMovedGeometry`, `rotateEntity`, `scaleEntity`,
  `mirrorEntity`) — ο container δεν ξέρει τη γεωμετρία κάθε primitive.
- **Persistence**: μηδέν επιπλέον κώδικας. Το scene σειριοποιείται ως opaque JSON blob στο Cloud
  Storage (όχι Firestore doc fields), άρα το nested `members: Entity[]` round-trip-άρει διαφανώς
  — ακριβώς όπως το `ArrayEntity.hiddenSources`.

---

## 3. Architecture

```
JOIN (γεωμετρικό αντίστροφο)          GROUP (container αντίστροφο)
───────────────────────────          ────────────────────────────
EntityMergeService (pure)            systems/group/group-entity.ts (pure)
  → JoinEntityCommand (undoable)       createGroupEntity / ungroupGroup / isGroupable
  → useEntityJoin (hook)             systems/group/group-expander.ts (render+snap)
  → useJoinRibbonAction (NEW)          expandGroupEntity (1:1, tag group.id, recursive)
  → Home▸Modify «Ένωση» (NEW)        CreateGroupCommand (undoable, mirror JoinEntityCommand)
                                     ExplodeEntityCommand: 'group' → ungroupGroup (UNGROUP)
                                     useGroupRibbonAction (NEW): group / ungroup
                                     Home▸Modify «Ομαδοποίηση» / «Κατάργηση» (NEW)
```

**Integration touch-points (καθρέφτης ArrayEntity, exact anchors):**
| Domain | Αρχείο | Αλλαγή |
|---|---|---|
| Type | `types/base-entity.ts` | `+ 'group'` στο `EntityType` |
| Type | `types/entities.ts` | `GroupEntity` interface + union member + `isGroupEntity` guard |
| Export | `types/dxf-export.types.ts` | `'group': null` (exhaustive Record) |
| Render | `hooks/canvas/useDxfSceneConversion.ts` | expand-before-convert (cached + uncached) |
| Snap | `snapping/hooks/useGlobalSnapSceneSync.ts` | expand-before-snap |
| Move | `core/commands/entity-commands/move-entity-geometry.ts` | `'group'` recursion |
| Rotate/Scale/Mirror | `utils/rotation-math.ts` · `systems/scale/scale-entity-transform.ts` · `utils/mirror-math.ts` | `'group'` recursion |
| Ribbon | `ui/ribbon/data/home-tab-modify.ts` · `app/useDxfViewerRibbon.ts` · icons/i18n | κουμπιά + interceptors |

---

## 4. Alternatives rejected
- **Reuse `type: 'block'`**: απορρίφθηκε — load-bearing DXF INSERT τύπος (§1).
- **Membership-tag group** (τα μέλη μένουν στο scene με `groupId`): απορρίφθηκε — δεν είναι
  «επαναχρησιμοποιήσιμο σύνθετο», δεν δίνει symmetric Ungroup=Explode, σπάει το ArrayEntity SSoT.
- **Dedicated `UngroupCommand`**: απορρίφθηκε — UNGROUP ≡ EXPLODE ενός group (μηδέν διπλότυπο).

---

## 5. Testing
- `systems/group/__tests__/group-entity.test.ts` — createGroup/ungroup/isGroupable/explode-delegation.
- `systems/group/__tests__/group-transform.test.ts` — MOVE/ROTATE/SCALE/MIRROR recursion.
- `core/commands/entity-commands/__tests__/CreateGroupCommand.test.ts` — execute/undo/redo.
- Σύνολο: **26/26 pass** (μαζί με τα υπάρχοντα explode tests — καμία regression).

## 6. Google-level declaration
✅ **YES** για το δηλωμένο εύρος (αντίστροφο του Explode): JOIN πλήρες· GROUP create/ungroup/
select/render/snap/move/rotate/scale/mirror/persist/undo-redo, SSoT reuse, μηδέν διπλότυπο.
Follow-up (full Block μετά, ανά απόφαση Giorgio): named block definitions + INSERT instances +
block library — ξεχωριστό, μεγαλύτερο subsystem.

---

## Changelog
- **2026-07-05** — Αρχική υλοποίηση. JOIN ribbon exposure + GROUP `type:'group'` container
  (engine/command/expander/transforms/ribbon) + UNGROUP=EXPLODE delegation. 26/26 tests.
