/**
 * SET COMPONENT VISIBILITY COMMAND — ADR-469 (per-element override writer).
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
 * @see docs/centralized-systems/reference/adrs/ADR-469-structural-component-visibility.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { BimElementStyleOverride } from '../../../config/bim-object-styles';
import type { StructuralComponent } from '../../../config/bim-structural-components';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

interface ComponentVisibilityPatch {
  readonly entityId: string;
  readonly prev: BimElementStyleOverride | undefined;
  readonly next: BimElementStyleOverride;
}

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

export class SetComponentVisibilityCommand implements ICommand {
  readonly id: string;
  readonly name = 'SetComponentVisibility';
  readonly type = 'set-component-visibility';
  readonly timestamp: number;

  private patches: ComponentVisibilityPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: readonly string[],
    private readonly component: StructuralComponent,
    private readonly value: boolean | undefined,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
    this.wasExecuted = this.patches.length > 0;
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.entityId, p.prev ?? {});
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
    this.signalPersist();
  }

  private buildPatches(): void {
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as
        { styleOverride?: BimElementStyleOverride } | undefined;
      if (!entity) continue;
      const prev = entity.styleOverride;
      this.patches.push({
        entityId,
        prev,
        next: withComponentVisibility(prev, this.component, this.value),
      });
    }
  }

  private applyPatch(entityId: string, styleOverride: BimElementStyleOverride): void {
    this.sceneManager.updateEntity(entityId, { styleOverride } as unknown as Partial<SceneEntity>);
  }

  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.entityId));
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Set ${this.component} visibility on ${this.entityIds.length} element(s)`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  validate(): string | null {
    if (this.entityIds.length === 0) return 'At least one entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityIds: this.entityIds, component: this.component, value: this.value ?? null },
      version: 1,
    };
  }
}
