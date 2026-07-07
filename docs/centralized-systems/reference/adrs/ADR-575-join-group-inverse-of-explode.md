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

## 7. SSoT centralization (boy-scout, N.0.2 / N.12)
Ο `CreateGroupCommand` αρχικά ξανάγραφε **inline** το extract/restore (snapshot+remove / restore)
— διπλότυπο του υπάρχοντος `extractSourcesFromScene`/`restoreSourcesToScene` (που χρησιμοποιεί ήδη
ο `CreateArrayCommand`). Διόρθωση:
- **Promote** των δύο helpers σε ουδέτερο SSoT `core/commands/entity-commands/entity-source-extraction.ts`
  (ήταν κακώς κάτω από `systems/array/` με «array» όνομα, αν και γενικοί). Το παλιό
  `array-source-extraction.ts` = thin re-export (μηδέν αλλαγή για array consumers).
- **Reuse** από `CreateGroupCommand` **ΚΑΙ** από τον sibling `JoinEntityCommand` (πρωτο-ϋπάρχον
  διπλότυπο — κεντρικοποιήθηκε επίσης· προστέθηκε το `JoinEntityCommand.test.ts` που έλειπε).
- Επαλήθευση: **580/580** array + entity-command tests pass (μηδέν regression).
- **Considered-not-applied**: ο `ExplodeEntityCommand` έχει διαφορετικό 1→N interleaved shape
  (per-source add-primitives) → δεν ταιριάζει καθαρά στο extract helper.
- **DONE (2026-07-05)**: ο `JoinEntityCommand` και ο `CreateGroupCommand` (~95% πανομοιότυπη δομή)
  ενοποιήθηκαν σε κοινή abstract βάση **`ReplaceEntitiesWithContainerCommand`** (Template Method —
  GoF Command + Template Method, όπως Autodesk/SAP command hierarchies). Η βάση κατέχει ΜΙΑ φορά τον
  invariant lifecycle (collect→extract→`buildContainer`(once)→add / undo / redo /
  `getAffectedEntityIds`) πάνω στο υπάρχον `entity-source-extraction` SSoT. Τα subclasses δίνουν ΜΟΝΟ
  το διαφορετικό: `name`/`type`, το `buildContainer` hook (JOIN → επιστρέφει έτοιμο merged entity·
  GROUP → `createGroupEntity(snapshots)`), `getDescription`/`validate`/`serialize` + `minMembers`.
  **Μηδέν αλλαγή public API/behavior** (callers `useEntityJoin`/`useGroupRibbonAction`, serialize
  schemas, `getCreatedEntityId()` αμετάβλητα).
- **Considered-not-applied**: ο `CreateArrayCommand` ΔΕΝ μπήκε στη βάση — διαφορετικό redo (re-extract
  αντί reuse-snapshot) + parametrized factory (layerId/kind/params/path/basePoint). Ήδη μοιράζεται το
  ίδιο extract/restore SSoT· αυτό αρκεί (μην over-abstract-άρεις — big-player κρίση).

## 8. GROUP selection affordance (Figma / Revit / Cinema 4D parity)

**Πρόβλημα:** κλικ σε ομαδοποιημένες οντότητες → ο χρήστης ΔΕΝ αντιλαμβανόταν πόσες/ποιες
είναι επιλεγμένες. **Ρίζα:** το `expandGroupEntity` δίνει σε ΚΑΘΕ member το ίδιο `group.id`
(σκόπιμο — click→container), οπότε το `grip-registry` `entityMap` (dedup ανά id) κρατά **έναν**
member → λαβές + MOVE/ROTATION σε **μία μόνο** γραμμή (mis-read ως «ένα αντικείμενο»).

**Λύση (industry-convergent — bbox + πλήθος + ενιαία μονάδα):**
- **`systems/group/group-selection-bounds.ts`** (NEW SSoT, pure): `computeGroupSelectionBounds(group)`
  = `expandGroupEntity` (flatten nested, SSoT) → `calculateCombinedEntityBounds` (ADR-394 union AABB,
  SSoT) → `{min,max,center,memberCount}`. `resolveSelectedGroups(entities, selectedIds)` = τα
  selected `type:'group'` containers. **Μηδέν νέο bbox math.**
- **Overlay** `canvas-v2/overlays/GroupSelectionOverlay.tsx` (NEW, presentational SVG) + leaf
  `components/dxf-layout/GroupSelectionOverlaySubscriber.tsx` (ADR-040 micro-leaf: subscribe selection +
  scene, project world→screen μέσω `CoordinateTransforms.worldToScreen`, mirror `SnapIndicatorOverlay`).
  Σχεδιάζει **ΕΝΑ διακεκομμένο πλαίσιο** γύρω από όλα τα μέλη + pill **«Ομάδα · N αντικείμενα»**
  (`UI_COLORS_BASE.SELECTION_MARQUEE` SSoT). Mount στο `CanvasLayerStack` δίπλα στο `SnapIndicatorSubscriber`.
- **grip-registry** (`hooks/grips/grip-registry.ts` + `GripRegistryPublisher.tsx`): νέο `groupEntityIds`
  → όταν selected id = group container, **skip** τα per-member grips (η ομάδα = ενιαία μονάδα· το overlay
  κατέχει το whole-group affordance). Αφαιρεί την «μία γραμμή» αμφισημία.
- **Status bar** `ui/toolbar/StatusBarGroupSelectionLeaf.tsx` (ADR-040 leaf) → inline «Ομάδα · N αντικείμενα»
  / «K ομάδες». i18n `groupSelection.*` (el/en, ICU plurals). Tests: `group-selection-bounds.test.ts`.
- **Highlight όλων των μελών**: ήδη ισχύει (κάθε expanded member έχει `group.id` → `_selectionSet.has`
  true για όλους στον `DxfRenderer`) — VERIFY live.
- **DONE (Phase 2 — interactive gizmo):** ΕΝΑ κοινό **βελάκι** στο κέντρο του group bbox (Revit /
  Cinema 4D) — move-cross + rotation handle. **SSoT reuse, μηδέν νέα math/engine:**
  - **Grips** `systems/group/group-gizmo-grips.ts` `getGroupGizmoGrips(group, bounds)` — mirror του
    `getPolylineMoveRotateGrips` πάνω στο world-axis AABB: move `type:'vertex'` @ `bounds.center`
    (`group-move`), rotation @ `rectLocalWorld(frame, 0, rotationHandleMidwayOffset(halfLength*2))`
    (`group-rotation`, ίδια policy με column/text/rectangle). Πάντα ορατά (κανένα showMidpoints gate).
  - **Kind** `GroupGripKind = 'group-move' | 'group-rotation'` (`grip-kinds-primitives.ts`) → forward
    σε `GripInfo`/`UnifiedGripInfo` (`wrapDxfGrip`). Εκπομπή στο `grip-registry` (στο branch που πριν
    έκανε skip τα per-member grips· `groupEntityIds:Set` → `groupEntities:Map<id,GroupEntity>` για bounds).
  - **Hot-grip flow (entity-agnostic):** `hotGripKindOf` chain + `HOT_GRIP_OP_REGISTRY`
    (`group-move`→move 3-click, `group-rotation`→rotate free/6-click reference) + `GRIP_GLYPH_REGISTRY`
    (`group-move`→4-arrow, `group-rotation`→curved) — ίδιο pipeline με line/arc/text.
  - **Commit:** `grip-commit-adapters` gates → `group-move` = `commitWholeEntityMove` (→ `moveEntities`
    → `calculateMovedGeometry` case 'group' recurse)· `group-rotation` = `commitGroupGizmoRotation`
    (`grip-group-commits.ts`) → canonical `RotateEntityCommand` (`rotateEntity` case 'group' recurse),
    pivot = bbox centre, reuse του shared `resolveRotation` (BimRotateHotGripStore).
  - **Live ghost (WYSIWYG):** `applyEntityPreview` group move/rotation branches (reuse
    `calculateMovedGeometry` / `applyPrimitiveRotationDrag`→`rotateEntity` — preview ≡ commit by
    identity)· `useGripGhostPreview` expand-άρει το transformed group + `drawGhostEntity` ανά member.
    Rotation pivot ⊙ + live angle arc = τα υπάρχοντα hot-grip overlays.
  - **Render (pixel-identical, επιλογή Giorgio):** `components/dxf-layout/GroupGizmoLayer.tsx` — dedicated
    ADR-040 canvas leaf που ζωγραφίζει το gizmo με τον ΙΔΙΟ `UnifiedGripRenderer`/`gripGlyphShape` +
    warm/hot temperature (από `gripInteractionState`), αφού το group είναι expanded → δεν έχει
    per-entity renderer. Mount στο `CanvasLayerStack` δίπλα στο `GroupSelectionOverlaySubscriber`.
  - Tests: `group-gizmo-grips.test.ts` (grips + glyph/hot-grip wiring + ghost move/rotate). 8/8 pass.
- **DEFERRED (επόμενη φάση):** custom rotation pivot (3ds Max «Affect Pivot»)· group **copy** μέσω
  gizmo (Ctrl+rotate/move) εξαρτάται από `RotateEntityCommand.copyMode`/`CopyEntityCommand` support για
  `type:'group'` (best-effort τώρα, no-op αν το command δεν κλωνοποιεί group).

## Changelog
- **2026-07-07** — **Phase 2: interactive GIZMO ομάδας (§8 DONE).** ΕΝΑ κοινό move-cross + rotation
  handle στο κέντρο του group bbox (Revit/C4D). FULL SSoT reuse (mirror `getPolylineMoveRotateGrips`):
  `GroupGripKind` + `getGroupGizmoGrips` + εκπομπή στο `grip-registry` (Map<id,GroupEntity>) + hot-grip
  registry/glyph wiring (`wall-hot-grip-fsm`/`grip-glyph-registry`) + commit gates (`grip-commit-adapters`
  → `commitWholeEntityMove` / `commitGroupGizmoRotation`→`RotateEntityCommand`, pivot=bbox centre) + live
  ghost (`apply-entity-preview` group branches + `useGripGhostPreview` member-expand draw) + pixel-identical
  canvas render leaf `GroupGizmoLayer` (ΙΔΙΟΣ `UnifiedGripRenderer`/glyph, warm/hot temperature) mounted στο
  `CanvasLayerStack`. Group MOVE/ROTATE ήδη recurse σε members (`calculateMovedGeometry`/`rotateEntity` case
  'group') — μηδέν νέα math/engine. **8/8 group-gizmo tests + 103/103 touched-shared regression GREEN.** ΟΧΙ
  tsc (N.17). Render leaf + `CanvasLayerStack`/`useGripGhostPreview` touch → ADR-040 §changelog (CHECK 6B/6D).
  🔴 εκκρεμεί browser-verify (drag move-cross → όλη η ομάδα· drag rotation handle → περιστροφή γύρω από κέντρο).
- **2026-07-07** — Η ΓΡΑΜΜΟΣΚΙΑΣΗ δεν ΟΜΑΔΟΠΟΙΟΥΝΤΑΝ με τις γραμμές (Giorgio: «αντιλαμβάνεται μόνον τις γραμμές»). **Ρίζα (trace ολόκληρου του selection→group pipeline):** το GROUP παίρνει τα μέλη από `getSelectedEntityIds()`· ο χρήστης επιλέγει hatch+γραμμές με **window/crossing marquee**, αλλά ο marquee bounds SSoT `systems/selection/shared/selection-duplicate-utils.ts:175 calculateEntityBounds` **δεν είχε `case 'hatch'`** → `null` → `findEntitiesInMarquee` (window `isEntityFullyInsideBounds` / crossing `entityIntersectsBounds`) σιωπηλά **απέκλειε** τη hatch → ποτέ στη selection → ποτέ μέλος της ομάδας. (Το single-click hit-test χειρίζεται hatch — `hit-test-entity-tests.ts:77` even-odd — άρα το click-select δούλευε· ΜΟΝΟ το marquee το έκοβε.) **FIX (2 αρχεία):** (α) `selection-duplicate-utils.ts` — `case 'hatch'` = AABB over `boundaryPaths` (καθρέφτης `types/entity-bounds.ts` case 'hatch' + `Bounds.ts` broad-phase). (β) Πληρότητα: hatch key-points + boundary-segments στο lasso (`systems/selection/utils.ts` `getEntityKeyPoints`/`getEntitySegments`). Πλέον window/crossing/lasso πιάνουν τη hatch → ομαδοποιείται μαζί με τις γραμμές· έτσι το click σε οποιοδήποτε μέλος επιλέγει όλη την ομάδα (id re-tag `group.id`) και το Alt-move μετακινεί ΟΛΟ το σύστημα (μαζί με το προηγούμενο hatch-move fix). **+2 tests** (`calculate-entity-bounds-dxf.test.ts` hatch AABB + empty). **85/85 selection GREEN.** ⚠️ **SSoT χρέος (boy-scout):** ΔΥΟ `calculateEntityBounds` (το `types/entity-bounds.ts` είχε hatch, το selection-copy όχι) — σύγκλιση = μεγάλο/ριψοκίνδυνο → pending. 🔴 εκκρεμεί browser-verify.
- **2026-07-07** — GROUP-move έχανε τη ΓΡΑΜΜΟΣΚΙΑΣΗ-member (Giorgio: «Alt+drag λαβής → μετακινούνται μόνο οι γραμμές, όχι όλο το σύστημα»). **Ρίζα:** το group move (`calculateMovedGeometry`, γρ.120) αναδρομεί τον κανονικό rigid-move SSoT **ανά member**, αλλά ο SSoT δεν είχε **`hatch` case** → η hatch επέστρεφε `{}` → έμενε στη θέση της ενώ τα line-members μετακινούνταν. (Το Alt+drag σε επιλεγμένη ομάδα, με grip suppression §8, πέφτει σε whole-entity body-move της ομάδας → ίδιο path.) **FIX (SSoT, 1 αρχείο):** `core/commands/entity-commands/move-entity-geometry.ts` — προστέθηκε `isHatchEntity` case που μετατοπίζει `boundaryPaths` (outer + islands) + `seedPoints`. Επειδή είναι ο ΚΑΝΟΝΙΚΟΣ rigid-move SSoT (body-drag / directional / Alt move-from-point / COPY + `translateEntityByAnchor` delegate εκεί), διορθώνεται ΚΑΙ το standalone hatch move (ήταν επίσης no-op). **ΝΕΟ** `move-entity-geometry-hatch.test.ts` (standalone hatch + group-with-hatch). **468/468 core/commands+group+stretch tests GREEN.** 🔴 εκκρεμεί browser-verify (Alt+drag ομάδας πλαίσιο+hatch → μετακινείται όλο μαζί).
- **2026-07-07** — GROUP selection affordance (§8): dashed bbox + «Ομάδα · N» overlay leaf +
  status-bar leaf + grip suppression για group containers + `group-selection-bounds` SSoT (reuse
  `expandGroupEntity` + `calculateCombinedEntityBounds`). i18n el/en. 16/16 group tests pass. ΟΧΙ tsc
  (N.17). Overlay leaf + `CanvasLayerStack` mount → ADR-040 §changelog (CHECK 6B/6D). Interactive gizmo
  = deferred.
- **2026-07-05** — Αρχική υλοποίηση. JOIN ribbon exposure + GROUP `type:'group'` container
  (engine/command/expander/transforms/ribbon) + UNGROUP=EXPLODE delegation. 26/26 tests.
- **2026-07-05** — SSoT boy-scout (§7): promote `entity-source-extraction` σε ουδέτερο SSoT·
  reuse από Group+Join· `JoinEntityCommand.test.ts`. 580/580 tests.
- **2026-07-05** — SSoT βάση (§7): abstract `ReplaceEntitiesWithContainerCommand` (Template Method)·
  `JoinEntityCommand` + `CreateGroupCommand` → thin subclasses (μηδέν διπλός lifecycle)· νέο
  `ReplaceEntitiesWithContainerCommand.test.ts`. Public API/behavior αμετάβλητα. 569/569 core/commands
  tests pass (+185 στο targeted Join/Group/array/group run).
