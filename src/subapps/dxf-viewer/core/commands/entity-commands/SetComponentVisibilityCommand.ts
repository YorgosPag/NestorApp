/**
 * SET COMPONENT VISIBILITY COMMAND — ADR-470 (per-element override writer).
 *
 * Batch, undoable per-element override του structural component visibility
 * (Revit «Override Graphics in View by Element»). Για N επιλεγμένα δομικά
 * στοιχεία θέτει/καθαρίζει το `styleOverride.componentVisibility[component]`:
 *   - value = true  → ανάγκασε εμφάνιση του component σε αυτό το στοιχείο
 *   - value = false → ανάγκασε απόκρυψη
 *   - value = undefined → καθάρισε το override (επιστροφή στο per-view flag)
 *
 * Δεν αγγίζει geometry/validation (καθαρά display). Per-entity snapshots χτίζονται
 * ΜΙΑ φορά στο πρώτο `execute()` ώστε `undo()`/`redo()` να είναι pure re-applies.
 * Persist μέσω του κοινού `signalEntitiesAttached` SSoT (non-selected-safe).
 *
 * @see config/bim-structural-components.ts — StructuralComponent SSoT
 * @see bim/visibility/structural-component-visibility.ts — ο resolver που το διαβάζει
 * @see docs/centralized-systems/reference/adrs/ADR-470-structural-component-visibility.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { BimElementStyleOverride } from '../../../config/bim-object-styles';
import type { StructuralComponent } from '../../../config/bim-structural-components';
import {
  EntityIdsBatchPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

/** Per-entity styleOverride snapshot — `prev` may be undefined (no prior override). */
type ComponentVisibilityState = BimElementStyleOverride | undefined;

/** Συνθέτει το νέο styleOverride θέτοντας/καθαρίζοντας ΕΝΑ component. Firestore-safe
 *  (κανένα explicit `undefined` — άδειο componentVisibility ⇒ key αφαιρείται). */
function withComponentVisibility(
  prev: BimElementStyleOverride | undefined,
  component: StructuralComponent,
  value: boolean | undefined,
): BimElementStyleOverride {
  const prevCV = prev?.componentVisibility ?? {};
  const nextCV: Partial<Record<StructuralComponent, boolean>> = { ...prevCV };
  if (value === undefined) delete nextCV[component];
  else nextCV[component] = value;
  const next: BimElementStyleOverride = { ...prev };
  if (Object.keys(nextCV).length > 0) next.componentVisibility = nextCV;
  else delete next.componentVisibility;
  return next;
}

export class SetComponentVisibilityCommand extends EntityIdsBatchPatchCommand<ComponentVisibilityState> {
  readonly name = 'SetComponentVisibility';
  readonly type = 'set-component-visibility';

  constructor(
    entityIds: readonly string[],
    private readonly component: StructuralComponent,
    private readonly value: boolean | undefined,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager, true);
  }

  protected buildPatches(): BatchPatchEntry<ComponentVisibilityState>[] {
    const out: BatchPatchEntry<ComponentVisibilityState>[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as
        { styleOverride?: BimElementStyleOverride } | undefined;
      if (!entity) continue;
      const prev = entity.styleOverride;
      out.push({ entityId, prev, next: withComponentVisibility(prev, this.component, this.value) });
    }
    return out;
  }

  protected applyState(entry: BatchPatchEntry<ComponentVisibilityState>, styleOverride: ComponentVisibilityState): void {
    // undo may restore an entity that had no prior override → write an empty map.
    this.sceneManager.updateEntity(entry.entityId, { styleOverride: styleOverride ?? {} } as unknown as Partial<SceneEntity>);
  }

  getDescription(): string {
    return `Set ${this.component} visibility on ${this.entityIds.length} element(s)`;
  }
  // getAffectedEntityIds / validate inherited (EntityIdsBatchPatchCommand).

  protected serializeData(): Record<string, unknown> {
    return { entityIds: this.entityIds, component: this.component, value: this.value ?? null };
  }
}
