# HANDOFF — `MergeableUpdateCommand<TPatch>` base (SSoT για το merge-command boilerplate)

> **Ημερομηνία:** 2026-06-21
> **Origin:** ADR-507 hatch grip-move· κατά την υλοποίηση εντοπίστηκε ότι το merge boilerplate (`canMergeWith`/`mergeWith` + undo skeleton) είναι copy-pasted σε ~24 `Update*ParamsCommand`. Δεν είναι νέο διπλότυπο — ακολουθήθηκε η υπάρχουσα σύμβαση· flagged για base-class.
> **Καταγραφή:** `.claude-rules/pending-ratchet-work.md` (entry «Merge-capable Update*ParamsCommand base»).
> **Στόχος ποιότητας:** FULL ENTERPRISE + FULL SSoT, Revit-grade. ΕΝΑ skeleton, μηδέν copy-paste.

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Μην εμπιστευτείς αυτό το handoff τυφλά — **επιβεβαίωσε με grep** ότι δεν προστέθηκε στο μεταξύ base/mixin:
```
grep -rn "abstract class\|BaseCommand\|MergeableCommand\|extends .*Command" src/subapps/dxf-viewer/core/commands
grep -rln "canMergeWith" src/subapps/dxf-viewer/core/commands/entity-commands
```
**Εύρημα συνεδρίας-origin (2026-06-21):** ΔΕΝ υπάρχει abstract base — όλα `implements ICommand` απευθείας. Το merge family = ~24 `Update*ParamsCommand` (βλ. §3). Αν ο νέος grep δείξει ότι κάποιος έφτιαξε base στο μεταξύ → **χρησιμοποίησέ το, μη φτιάξεις 2ο**.

Επίσης grep για τυχόν υπάρχον generic patch-command:
```
grep -rn "class UpdateEntityCommand" src/subapps/dxf-viewer/core/commands  # generic, ΧΩΡΙΣ merge — δες §4
```

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (το διπλότυπο)

Κάθε `Update<X>ParamsCommand` (`core/commands/entity-commands/`) επαναλαμβάνει το ΙΔΙΟ skeleton:
- fields: `id` (generateEntityId), `name`, `type`, `timestamp`, `wasExecuted`, ctor `(entityId, params, previousParams, sceneManager, isDragging=false)`
- `execute()` → `applyPatch(params)` + `wasExecuted=true`
- `undo()` → guard `wasExecuted` → `applyPatch(previousParams)`
- `redo()` → `applyPatch(params)`
- `canMergeWith(other)` → `other instanceof <ThisClass>` + `same entityId` + `both isDragging` + `(other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow`
- `mergeWith(other)` → `new <ThisClass>(id, o.params, this.previousParams, sceneManager, true)`
- `getAffectedEntityIds()` → `[entityId]`
- `serialize()` → ίδιο shape (`type/id/name/timestamp/data:{...}/version:1`)

**Το ΜΟΝΟ που διαφέρει ανά command** = το `applyPatch` (recompute geometry/validation specifics) + το `validate()` + το `getDescription()` + το shape του patch (`params` vs `boundaryPaths`).

Πρότυπο για σύγκριση: `UpdateFloorFinishParamsCommand.ts` (geometry recompute στο applyPatch) και `UpdateHatchBoundaryCommand.ts` (NEW 2026-06-21, χωρίς geometry recompute — flat boundaryPaths). Δες και `interfaces.ts` για `ICommand` + `DEFAULT_MERGE_CONFIG` + `SerializedCommand`.

---

## 2. Η ΛΥΣΗ (design — abstract base + template method)

NEW `core/commands/entity-commands/MergeableUpdateCommand.ts`:

```ts
export abstract class MergeableUpdateCommand<TPatch> implements ICommand {
  readonly id: string;
  readonly timestamp: number;
  abstract readonly name: string;
  abstract readonly type: string;          // ΜΟΝΑΔΙΚΟ ανά subclass — οδηγεί το canMergeWith
  private wasExecuted = false;

  constructor(
    protected readonly entityId: string,
    protected readonly patch: TPatch,
    protected readonly previousPatch: TPatch,
    protected readonly sceneManager: ISceneManager,
    protected readonly isDragging: boolean = false,
  ) { this.id = generateEntityId(); this.timestamp = Date.now(); }

  /** Subclass: εφάρμοσε το patch (recompute geometry/validation εδώ αν χρειάζεται). */
  protected abstract applyPatch(patch: TPatch): void;
  /** Subclass: factory για merge (αποφεύγει το `new Subclass` στο generic base). */
  protected abstract withMergedPatch(nextPatch: TPatch): MergeableUpdateCommand<TPatch>;

  execute(): void { this.applyPatch(this.patch); this.wasExecuted = true; }
  undo(): void { if (this.wasExecuted) this.applyPatch(this.previousPatch); }
  redo(): void { this.applyPatch(this.patch); }

  canMergeWith(other: ICommand): boolean {
    // type-equality αντί instanceof → δουλεύει από το generic base (κάθε subclass έχει μοναδικό `type`).
    if (!(other instanceof MergeableUpdateCommand)) return false;
    if (other.type !== this.type || other.entityId !== this.entityId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }
  mergeWith(other: ICommand): ICommand {
    const o = other as MergeableUpdateCommand<TPatch>;
    return this.withMergedPatch(o.patch);   // κρατά this.previousPatch (πρώτο), νέο patch
  }

  getAffectedEntityIds(): string[] { return [this.entityId]; }
  abstract getDescription(): string;
  abstract validate(): string | null;
  serialize(): SerializedCommand { /* κοινό shape· subclass δίνει extra data αν θες */ }
}
```

Κάθε subclass γίνεται ~25 γραμμές: `type`/`name`, `applyPatch` (το geometry recompute του), `withMergedPatch` (1-liner `new Self(...)`), `validate`, `getDescription`. **ΜΗΔΕΝ merge/undo/redo/canMerge boilerplate.**

⚠️ **ΚΡΙΣΙΜΟ — μη χαλάσεις behavior:**
- Το `applyPatch` ΚΑΘΕ command πρέπει να μεταφερθεί **byte-for-byte** (recompute geometry/validation, emit specifics). Άλλα commands ΔΕΝ κάνουν recompute (hatch). Μη «κανονικοποιήσεις» — μετάφερε ό,τι έκανε το καθένα.
- Το `serialize().data` διαφέρει (`params` vs `boundaryPaths` vs extras). Κράτα per-subclass override αν το shape διαφέρει.
- Μερικά κρατούν `snapshot` αντί `previousParams` (π.χ. το generic `UpdateEntityCommand`) — ΜΗΝ τα μπερδέψεις στο family (δες §4).

---

## 3. ΛΙΣΤΑ COMMANDS (merge family — επιβεβαίωσε με grep `canMergeWith` count=2)

**🟢 ΑΣΦΑΛΗ — migrate ΠΡΩΤΑ (όχι structural, όχι shared-tree hot):**
`UpdateFloorFinishParams`, `UpdateHatchBoundary` (NEW, δικό μας), `UpdateRoofParams`, `UpdateRailingParams`, `UpdateOpeningParams`, `UpdateThermalSpaceParams`, `UpdateStairParams`, `UpdateFloorplanSymbolParams`, `UpdateFurnitureParams`, `UpdateElectricalPanelParams`, `UpdateArrayParams`, `UpdateMep{Segment,Fixture,Manifold,Radiator,Boiler,WaterHeater,Underfloor,System}Params`.

**🔴 STRUCTURAL — migrate ΤΕΛΕΥΤΑΙΑ + ΜΕ ΣΥΝΕΝΝΟΗΣΗ (ADR-487 living-structural-organism, ΕΝΕΡΓΟ domain άλλου agent):**
`UpdateColumnParams`, `UpdateBeamParams`, `UpdateSlabParams`, `UpdateSlabOpeningParams`, `UpdateFoundationParams`, `UpdateWallParams`.
→ Δες `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`. Αυτά τα commands εκτελούνται μέσα στον «ζωντανό οργανισμό» (auto-size/reinforce/footing reactions). **ΜΗΝ τα αγγίξεις χωρίς να επιβεβαιώσει ο Giorgio ότι ο άλλος agent δεν είναι μέσα τους.** Αν είναι hot → άφησέ τα στην παλιά μορφή (το base είναι opt-in· συνυπάρχουν).

**Όρια family:** `UpdateEntityPset` (δες αν ταιριάζει), `WallSplitCommand`/`RotateEntityCommand`/`MoveEntityCommand` έχουν merge αλλά **ΟΧΙ** params-update shape → ΕΚΤΟΣ scope (μην τα ζορίσεις στο base).

---

## 4. ΜΗΝ ΜΠΕΡΔΕΨΕΙΣ — υπάρχοντα SSoT/near-misses
- `UpdateEntityCommand` (`core/commands/entity-commands/UpdateEntityCommand.ts`): generic patch command **ΧΩΡΙΣ merge** (snapshot-based undo). ΔΕΝ είναι το base· είναι για one-shot field edits (Quick Properties). Μην το επεκτείνεις για drag-merge — διαφορετικό use case.
- `DEFAULT_MERGE_CONFIG` (`interfaces.ts`): ο canonical merge-window. ΧΡΗΣΙΜΟΠΟΙΗΣΕ τον, μη hardcode 500ms.
- `generateEntityId` (`systems/entity-creation/utils`): canonical command id source.

---

## 5. TESTS
Υπάρχουν ήδη `__tests__/Update{Slab,Column,Beam,SlabOpening,Opening,Stair,Array}Params*.test.ts` (καλύπτουν merge/undo). **Πρέπει να μείνουν GREEN αυτούσια** (το public behavior δεν αλλάζει). + NEW `MergeableUpdateCommand.test.ts` (base: canMerge type-equality, time-window, withMergedPatch κρατά previousPatch, undo guard). Τρέξε όλα τα command tests μετά από κάθε migration batch.

---

## 6. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- **COMMIT = Giorgio** (N.(-1)). Εσύ ΟΧΙ.
- **Shared tree** — `git add` ΜΟΝΟ δικά σου. ΜΗΝ αγγίξεις structural commands αν είναι hot (§3).
- **ΕΝΑ tsc** (N.17) — έλεγξε ότι δεν τρέχει άλλος πρώτα.
- N.8: ~26 αρχεία = orchestrator-scale → ζήτησε mode από Giorgio (Plan ή Orchestrator) ΠΡΙΝ ξεκινήσεις. Πρότεινε **incremental: base + 🟢 batch πρώτα → commit → structural σε δεύτερο γύρο**.
- N.15 μετά: ADR (νέο ADR ή στο ADR-040/υπάρχον commands ADR) + ΕΚΚΡΕΜΟΤΗΤΕΣ + pending-ratchet (κλείσε το entry όταν ολοκληρωθεί) + MEMORY.

---

## 7. BASELINE — τι έγινε στη συνεδρία-origin (ADR-507, ΘΑ ΕΧΕΙ ΓΙΝΕΙ COMMIT από Giorgio πριν ξεκινήσεις)
Hatch creation system: S2-persist (NEW `floorplan_hatches` collection· rules+indexes deployed στο `pagonis-87766`) + S2-fix-2 (hover/select/grips) + S2-fix-3 (grip-MOVE: parametric `hatchGripKind`, NEW `bim/hatch/hatch-grips.ts` + `UpdateHatchBoundaryCommand.ts`) + ortho-delta SSoT (5→1). **ΚΡΙΣΙΜΟ fix:** Firestore απαγορεύει nested arrays → `boundaryPaths` persisted ως array-of-maps (`{vertices}`). Αν το hatch δεν persist-άρει, δες ADR-507 changelog «S2-persist-fix».
→ Το `UpdateHatchBoundaryCommand` είναι **ήδη γραμμένο με το παλιό (copy-paste) skeleton** — θα είναι από τα πρώτα που θα migrate-άρεις στο νέο base (🟢 ασφαλές, δικό μας).

**Πλήρες context:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` §8 changelog.
