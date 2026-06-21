# HANDOFF — Phase 2: True 3D vertical move unification (ADR-049, Revit `MoveElement(dx,dy,dz)`)

**Ημ/νία:** 2026-06-21 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **COMMIT/PUSH = ΜΟΝΟ ο Giorgio (N.-1) — ΟΧΙ εσύ.**
> ⚠️ **Shared working tree** με άλλον agent. `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. Πριν edit κάθε αρχείου → `git status` σ' αυτό.
> ⚠️ **N.17 (ΕΝΑ tsc τη φορά):** πριν τρέξεις tsc έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … tsc`), μετά background.
> 🎯 **Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT.»

---

## 0. ΤΟ ΖΗΤΟΥΜΕΝΟ
Στη Revit η μετακίνηση είναι **ΜΙΑ** API: `ElementTransformUtils.MoveElement(doc, id, XYZ(dx,dy,dz))` — ΕΝΑ command, ΕΝΑ vector 3D, **πολυμορφική ερμηνεία ανά τύπο**. Drag / numeric / grip / gizmo / vertical = χειρονομίες εισόδου, ΟΧΙ διαφορετικοί μηχανισμοί.

**Σήμερα το vertical (3D gizmo axis-Y) είναι ΞΕΧΩΡΙΣΤΟ:** πάει σε `Update*ParamsCommand` + event `bim:entity-params-updated`, ΟΧΙ στο `MoveEntityCommand` + `bim:entities-moved`. Phase 2 = ενοποίησέ το ώστε το vertical να γίνει το **z-component του ΕΝΟΣ move command**, με **reuse** (όχι duplication) των 6 υπαρχόντων per-type vertical computers.

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
Μην εμπιστευτείς τυφλά αυτό το handoff — **shared tree, τα paths ίσως μετακινήθηκαν**. Επιβεβαίωσε ότι (α) δεν υπάρχει ήδη z-aware move SSoT, (β) ο άλλος agent δεν αγγίζει τα ίδια αρχεία.

```
# Πού ζει το vertical move (per-type computers + builders):
grep -rn "computeWallVerticalMove\|computeColumnVerticalMove\|computeBeamVerticalMove\|computeSlabVerticalMove\|computeStairVerticalMove\|computeMep.*VerticalMove" src/subapps/dxf-viewer
grep -rn "buildVerticalMoveCommand\|verticalCommandForEntity\|buildMepCombinedMoveCommand\|deltaUpMm" src/subapps/dxf-viewer/bim-3d
# Το polymorphic move geometry SSoT (εδώ μπαίνει το z-branch):
grep -rn "calculateBimMovedGeometry\|calculateMovedGeometry\|shiftPoint3D" src/subapps/dxf-viewer
# Point3D type + delta types στα commands:
grep -rn "interface Point3D\|Point2D \| Point3D\|delta: Point2D" src/subapps/dxf-viewer/core/commands src/subapps/dxf-viewer/rendering/types
# Persistence binding (gate — βλ. §4.5):
grep -rln "useBimEntityMovedPersistEffect" src/subapps/dxf-viewer/hooks/data
# Άλλος agent στα ίδια αρχεία;
git status --short src/subapps/dxf-viewer/bim-3d/ src/subapps/dxf-viewer/bim/utils/ src/subapps/dxf-viewer/core/commands/entity-commands/
```

**Δες ΚΑΙ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (το όραμα οργανισμού — associative regen on move· το vertical move ΠΡΕΠΕΙ να ρέει στο ίδιο `bim:entities-moved` ώστε ο organism/persist να το δουν με ΕΝΑ pass).

---

## 2. ΤΙ ΕΓΙΝΕ ΗΔΗ (Phase 0+1 + cut-plane fix — UNCOMMITTED, ΜΗΝ το ξανακάνεις)
Ο μηχανισμός είναι **ήδη ενιαίος** για plan moves. Phase 0+1 έκλεισε 5 κενά/διπλότυπα. **Phase 2 χτίζει ΠΑΝΩ σ' αυτό.**

| SSoT (υπάρχον, ΧΡΗΣΙΜΟΠΟΙΗΣΕ) | Ρόλος |
|---|---|
| `core/commands/entity-commands/MoveEntityCommand.ts` (+`MoveMultipleEntitiesCommand`) | ΤΟ κέντρο. execute/undo/redo → `move-entity-cascade.ts` |
| `core/commands/entity-commands/move-entity-cascade.ts` (`runMoveForwardCascade`/`runMoveUndoCascade`) | SSoT cascade ordering (pipes→updates→wall-openings→slab-openings→reframe+emit) |
| `bim/utils/bim-move-geometry.ts` → `calculateBimMovedGeometry(entity, delta)` | **Πολυμορφικό per-type move** (21 τύποι· `moveWall`/`moveSlab`/…). **ΕΔΩ μπαίνει το z-branch.** |
| `core/commands/entity-commands/move-entity-geometry.ts` → `calculateMovedGeometry` | BIM→DXF fallback wrapper |
| `bim/cascade/slab-opening-move-cascade.ts` (`cascadeMovedSlabOpenings`) | κενό 1 (Phase 1) |
| `bim/mep-segments/cascade-connected-pipes-by-delta.ts` (`cascadeConnectedPipesByDelta`) | κενό 2 (Phase 1) |
| `bim-3d/gizmo/bim3d-vertical-move.ts` | **Οι 6 per-type vertical computers** (`compute*VerticalMove` + `computeMep*VerticalMove`) — καθαρές params→params. **REUSE, μην τις ξαναγράψεις.** |
| `bim-3d/animation/bim3d-edit-command-builders.ts` | `buildVerticalMoveCommand` / `verticalCommandForEntity` / `buildMepCombinedMoveCommand` — **εδώ αντικαθιστάς το vertical path** |
| `bim-3d/animation/bim3d-edit-mep-commands.ts` | `mepVerticalNextParams` / `mepVerticalCommand` (MEP vertical) |

**Cut-plane fix (UNCOMMITTED, μέρος αυτής της δουλειάς):** `bim/visibility/entity-z-extents.ts` — NEW `nestedParams()` helper διαβάζει params tolerant (wrapped DxfEntityUnion Ή flat store-feed) στα slab/slab-opening/stair/opening. Latent bug ADR-452 που εκτέθηκε στο Φ1 verify (τα `*PersistenceHost` σπρώχνουν flat scene entities στο `Bim3DEntitiesStore`). 17/17 jest.

---

## 3. Ο ΣΧΕΔΙΑΣΜΟΣ Phase 2 (Revit-grade, FULL SSoT)
**Αρχή:** ΕΝΑ command, ΕΝΑ event (`bim:entities-moved`), πολυμορφική ερμηνεία με **reuse** των vertical computers.

1. **3D delta type.** `MoveEntityCommand`/`MoveMultiple` δέχονται `Point2D | Point3D` (z optional → default 0· **ΟΛΟΙ οι 2D callers αμετάβλητοι**). `reverseDelta`/`canMergeWith`/`mergeWith`/`serialize` περιλαμβάνουν z. Snapshot undo (deepClone→restore) δουλεύει type-agnostic για z-params (πλεονέκτημα).
2. **Re-home vertical computers (boy-scout, ΜΗΔΕΝ dup).** Μετακίνησε τις καθαρές `compute*VerticalMove` + `computeMep*VerticalMove` από `bim-3d/gizmo/bim3d-vertical-move.ts` → NEW `bim/utils/bim-vertical-move.ts` (neutral, δίπλα στο `bim-move-geometry`· **αποφεύγει core→bim-3d coupling**). `bim-3d/gizmo/bim3d-vertical-move.ts` → re-export για back-compat. ⚠️ Το stair χρειάζεται `mmToEntityUnitFactor` (`bim-3d/utils/bim3d-edit-math`) — έλεγξε cycle-free· αν χρειαστεί re-home κι αυτό ή import-safe.
3. **z-branch στο geometry SSoT.** Στο `calculateBimMovedGeometry(entity, delta)`: όταν `delta.z` (≠0), μετά το plan move εφάρμοσε τον per-type vertical computer στα newParams (π.χ. `moveWall` → αν z, `computeWallVerticalMove(newParams, delta.z)`), recompute geometry **ΜΙΑ φορά**. **Reuse — ΟΧΙ αντιγραφή.** Κράτα τα 6 computers ΩΣ SSoT.
4. **Αντικατάσταση vertical entry points.** `buildVerticalMoveCommand` + `buildMepCombinedMoveCommand` (`bim3d-edit-command-builders.ts`) → χτίζουν `MoveEntityCommand`/`MoveMultiple` με z-delta (combined = {x,y,z} όλα non-zero → εξαφανίζεται το special case). Διέγραψε το per-type `Update*ParamsCommand` vertical path + `verticalCommandForEntity`. Event: `bim:entities-moved` (ΟΧΙ πια `bim:entity-params-updated` για vertical).
5. **🔴 Persistence gate (ΚΡΙΣΙΜΟ — verify ΠΡΙΝ διαγράψεις το params path).** `useBimEntityMovedPersistEffect` είναι per-type-generic στο `bim:entities-moved`. Επιβεβαιωμένο ότι wall/column/beam/slab/slab-opening/MEP-segment το καλούν. **ΕΛΕΓΞΕ ειδικά: `useStairPersistence`** (+ point-MEP hosts: fixture/manifold/radiator/boiler/water-heater) ακούνε `bim:entities-moved`; Αν ΟΧΙ → πρόσθεσε `useBimEntityMovedPersistEffect` call ΠΡΩΤΑ, αλλιώς το vertical move δεν θα persist-άρει (reverts on refresh).

---

## 4. ΕΠΑΛΗΘΕΥΣΗ (Revit-grade — DB ground-truth)
- **DB:** Firestore collection `entity_audit_trail` (μέσω `mcp__firestore__*`), orderBy `timestamp` desc, reconstruct latest-value ανά `entityId`. Test floor `lvl_21982f3b` «Ισόγειο», companyId `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`, ύψος 3000mm. Όταν ο Giorgio λέει «ΔΕΣ ΤΩΡΑ» ξανατράβα.
- **Browser:** 3D gizmo axis-Y σε wall/column/beam/slab/**stair**/MEP → νέο elevation **persist-άρει** (reload-survives). Combined plane-handle drag (XY+Z) → ΕΝΑ undo. pipe-follow στο vertical (το `withConnectedPipeFollow` στο vertical branch — δες αν χρειάζεται ή αν το command αυτο-cascade-άρει τώρα). `Ctrl+Z` ΕΝΑ βήμα.

## 5. TESTS (πράσινα πριν & μετά)
```
npx jest src/subapps/dxf-viewer/core/commands/entity-commands/__tests__/
npx jest src/subapps/dxf-viewer/bim/utils/__tests__/   # bim-move-geometry (+ NEW bim-vertical-move)
npx jest src/subapps/dxf-viewer/bim-3d/animation/
```
+ ΝΕΑ tests: z-delta στο `calculateBimMovedGeometry` (wall/column/beam/slab/stair/MEP)· re-homed vertical computers· combined XY+Z.
**Pre-existing fail (ΟΧΙ δικό σου):** `AssignWallTypeCommand.test.ts` «undo before execute».

## 6. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 / N.15) — ίδιο commit με κώδικα (ο Giorgio commit-άρει)
- **ADR-049** changelog (το vertical-unification entry· Phase 0+1 entry υπάρχει ήδη 2026-06-21).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές: τι εκκρεμεί) + `adr-index.md` (αν χρειαστεί) + `MEMORY.md` (`reference_unified_move_ssot_dxf_bim.md`).

## 7. EXECUTION MODE (N.8)
~6-9 αρχεία, 2-3 domains (commands + bim/utils + bim-3d). **Orchestrator-scale ή προσεκτικό Plan Mode.** Ρώτησε τον Giorgio mode ΠΡΙΝ, αν δεν το έχει ήδη πει. Φασικά, lowest-risk-first: (Φ2a) re-home computers → (Φ2b) 3D delta type → (Φ2c) z-branch → (Φ2d) αντικατάσταση builders + persistence gate.

---

## 8. ΚΑΤΑΣΤΑΣΗ UNCOMMITTED ΑΡΧΕΙΩΝ (Phase 0+1 + fix — ο Giorgio θα commit-άρει)
NEW: `systems/grid/grid-snap.ts`, `bim/cascade/slab-opening-move-cascade.ts`(+test), `bim/mep-segments/cascade-connected-pipes-by-delta.ts`(+test), `core/commands/entity-commands/move-entity-cascade.ts`.
MOD: `hooks/{useEntityDrag,useGripMovement,useMoveEntities}.ts`, `hooks/grips/grip-scene-manager-adapter.ts`, `hooks/tools/useMoveTool.ts`, `bim/cascade/bim-cascade-resolver.ts`(+test), `core/commands/entity-commands/MoveEntityCommand.ts`, `bim-3d/animation/bim3d-edit-command-builders.ts`, `bim/visibility/entity-z-extents.ts`(+test), `ADR-049`.
⚠️ `bim3d-edit-command-builders.ts` + `move-entity-cascade.ts` = concurrent refactor άλλου → `git status` πριν αγγίξεις.
