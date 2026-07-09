/**
 * ATTACH STAIRS COMMAND — ADR-401 Phase G.3 (stair auto/manual attach UX).
 *
 * Batch, undoable «Attach Top/Base to Structural» for N stairs onto ONE structural
 * host (beam / slab / landing). Sets each stair's side binding to `'attached'` and
 * appends the host id, then recomputes geometry + validation. The stored `params` stay
 * NOMINAL (the effective re-step happens at render time, G.2). Stairs do NOT host
 * openings → no cascade.
 *
 * Thin subclass of the `StairAttachDetachCommand` base (ADR-610).
 *
 * @see ./attach-detach-domain-commands.ts — the stair base (recompute + snapshot)
 * @see ./DetachStairsCommand.ts — the detach twin
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { StairKind, StairParams } from '../../../bim/types/stair-types';
import { attachEntitySide, type EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import { StairAttachDetachCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

export type StairAttachSide = EntityAttachSide;

/** A stair to attach + its `kind` (carried for target-build parity with column). */
export interface StairAttachTarget {
  readonly stairId: string;
  readonly kind: StairKind;
}

export class AttachStairsCommand extends StairAttachDetachCommand {
  readonly name = 'AttachStairs';
  readonly type = 'attach-stairs';

  constructor(
    private readonly side: StairAttachSide,
    private readonly hostId: string,
    private readonly targets: readonly StairAttachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): AttachDetachPatch<StairParams>[] {
    return this.buildStairPatches(this.targets, (t) => t.stairId, (prev) =>
      attachEntitySide(prev, this.side, this.hostId),
    );
  }

  getDescription(): string {
    return `Attach ${this.targets.length} stair(s) ${this.side} to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.stairId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
    if (this.targets.length === 0) return 'At least one stair target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { side: this.side, hostId: this.hostId, targets: this.targets };
  }
}
