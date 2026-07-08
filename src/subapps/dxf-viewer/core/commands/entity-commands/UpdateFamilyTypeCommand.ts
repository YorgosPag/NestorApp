/**
 * UPDATE FAMILY TYPE COMMAND — generic (ADR-412 / ADR-421 SLICE C).
 *
 * Category-agnostic version of `UpdateWallFamilyTypeCommand`: edits a TYPE's
 * `typeParams` as a single undoable, optimistic operation that re-flows to EVERY
 * placed instance via the catalog-store `version` bump (the per-category
 * `use…TypeReresolution` hook does the synchronous in-scene re-resolution for
 * free — this command must NOT iterate instances or emit per-entity children,
 * which would double-propagate).
 *
 * Generic over the type-param payload `TP` (e.g. `OpeningTypeParams`,
 * `WallTypeParams`). Identical algorithm to the wall command:
 *   1. optimistically replace the type's `typeParams` in the store,
 *   2. fire-and-forget persist the type doc,
 *   3. fire-and-forget audit,
 *   4. notify the all-floors BOQ re-feed side-effect (EventBus).
 *
 * Idempotent (N.7.2 #3) + race-free (#2): store write precedes the BOQ fan-out.
 *
 * SSoT (ADR-604): the former per-entity `Update{Wall,Slab,Roof}FamilyTypeCommand`
 * duplicates were removed — Wall/Slab/Roof/Opening controllers all inject this
 * single generic via `makeUpdateCommand`. (The wall twin also carried a
 * `thickness > 0` validate branch; it was dead — `CommandHistory.execute()` never
 * calls `validate()` — so it is intentionally not reproduced here.)
 *
 * @see core/commands/entity-commands/AssignOpeningTypeCommand.ts — per-instance sibling
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.5 §5
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { BimFamilyType, BimTypeParamsByCategory } from '../../../bim/types/bim-family-type';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/** Any category's type-param payload (default generic bound). */
type AnyTypeParams = BimTypeParamsByCategory[keyof BimTypeParamsByCategory];

/**
 * Injected side-effects so the command stays testable (no React/Firestore/store
 * imports). The controller wires these to the live store + service + audit +
 * EventBus. Generic over the type-param payload `TP`.
 */
export interface FamilyTypeMutationDeps<TP = AnyTypeParams> {
  /** Current catalog snapshot (live store). */
  readonly getTypes: () => readonly BimFamilyType[];
  /** Optimistic catalog replace (bumps store `version` → in-scene re-resolution). */
  readonly setTypes: (types: readonly BimFamilyType[]) => void;
  /** Fire-and-forget Firestore persist of the new type params. */
  readonly persist: (typeParams: TP) => void;
  /** Fire-and-forget audit (`from` → `to` diff). */
  readonly audit: (from: TP, to: TP) => void;
  /** Notify the all-floors BOQ re-feed side-effect (EventBus emit). */
  readonly notifyChanged: () => void;
}

export class UpdateFamilyTypeCommand<TP = AnyTypeParams> implements ICommand {
  readonly id: string;
  readonly name = 'UpdateFamilyType';
  readonly type = 'update-family-type';
  readonly timestamp: number;

  constructor(
    private readonly typeId: string,
    private readonly next: TP,
    private readonly previous: TP,
    private readonly deps: FamilyTypeMutationDeps<TP>,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.apply(this.previous, this.next);
  }

  undo(): void {
    this.apply(this.next, this.previous);
  }

  redo(): void {
    this.apply(this.previous, this.next);
  }

  /** Replace the type's params in the catalog, then re-run derived side effects. */
  private apply(from: TP, to: TP): void {
    const nextCatalog = this.deps.getTypes().map((t) =>
      t.id === this.typeId ? ({ ...t, typeParams: to } as BimFamilyType) : t,
    );
    // Store write FIRST — bumps `version`, drives synchronous in-scene
    // re-resolution (geometry re-flow is free) before any BOQ read.
    this.deps.setTypes(nextCatalog);
    this.deps.persist(to);
    this.deps.audit(from, to);
    this.deps.notifyChanged();
  }

  getDescription(): string {
    return `Edit family type (${this.typeId})`;
  }

  /** Catalog edit — no scene entity is directly affected (instances re-resolve). */
  getAffectedEntityIds(): string[] {
    return [];
  }

  validate(): string | null {
    if (!this.typeId) return 'Family type ID is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        typeId: this.typeId,
        next: this.next,
        previous: this.previous,
      },
      version: 1,
    };
  }
}
