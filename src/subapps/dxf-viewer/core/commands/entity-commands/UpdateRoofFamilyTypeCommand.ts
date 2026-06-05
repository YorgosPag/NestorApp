/**
 * UPDATE ROOF FAMILY TYPE COMMAND — ADR-417 §10 #3 (BIM Family Types). Roof
 * analogue of {@link UpdateSlabFamilyTypeCommand}.
 *
 * Edits a roof TYPE's `typeParams` (thickness / dna / material) as a single
 * undoable operation. Unlike `AssignRoofTypeCommand` (which patches ONE
 * instance), this mutates the shared catalog type — so the change re-flows to
 * EVERY placed instance.
 *
 * ── Why a SYNCHRONOUS optimistic command (not a CompoundCommand) ─────────────
 * The heavy in-scene propagation ALREADY EXISTS: the optimistic `setTypes` bumps
 * the catalog store `version`, and `useRoofTypeReresolution` re-resolves the
 * active scene's typed roofs SYNCHRONOUSLY off that bump. So this command must
 * NOT iterate instances or emit per-roof child commands — that would
 * double-propagate. It just:
 *   1. optimistically replaces the type's `typeParams` in the store,
 *   2. fire-and-forget persists the type doc (`service.updateType`),
 *   3. fire-and-forget records audit,
 *   4. notifies the all-floors BOQ re-feed side-effect (EventBus).
 *
 * Idempotent (N.7.2 #3): applying the same params twice = same result. Race-free
 * (#2): the store write happens BEFORE the BOQ fan-out.
 *
 * @see core/commands/entity-commands/UpdateSlabFamilyTypeCommand.ts — the slab sibling
 * @see bim/family-types/family-type-side-effects.ts — all-floors BOQ re-feed
 * @see hooks/data/useRoofTypeReresolution.ts — the free in-scene propagation
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import type { ICommand, SerializedCommand } from '../interfaces';
import type { BimFamilyType, RoofTypeParams } from '../../../bim/types/bim-family-type';
import { generateEntityId } from '../../../systems/entity-creation/utils';

/**
 * Injected side-effects so the command stays testable (no React/Firestore/store
 * imports). The controller wires these to the live store + service + audit +
 * EventBus.
 */
export interface RoofFamilyTypeMutationDeps {
  /** Current catalog snapshot (live store). */
  readonly getTypes: () => readonly BimFamilyType[];
  /** Optimistic catalog replace (bumps store `version` → in-scene re-resolution). */
  readonly setTypes: (types: readonly BimFamilyType[]) => void;
  /** Fire-and-forget Firestore persist of the new type params. */
  readonly persist: (typeParams: RoofTypeParams) => void;
  /** Fire-and-forget audit (`from` → `to` diff). */
  readonly audit: (from: RoofTypeParams, to: RoofTypeParams) => void;
  /** Notify the all-floors BOQ re-feed side-effect (EventBus emit). */
  readonly notifyChanged: () => void;
}

export class UpdateRoofFamilyTypeCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateRoofFamilyType';
  readonly type = 'update-roof-family-type';
  readonly timestamp: number;

  constructor(
    private readonly typeId: string,
    private readonly next: RoofTypeParams,
    private readonly previous: RoofTypeParams,
    private readonly deps: RoofFamilyTypeMutationDeps,
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
  private apply(from: RoofTypeParams, to: RoofTypeParams): void {
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
    return `Edit roof type (${this.typeId})`;
  }

  /** Catalog edit — no scene entity is directly affected (instances re-resolve). */
  getAffectedEntityIds(): string[] {
    return [];
  }

  validate(): string | null {
    if (!this.typeId) return 'Family type ID is required';
    if (this.next.thickness <= 0) return 'thickness must be > 0';
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
