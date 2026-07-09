/**
 * DETACH STAIRS COMMAND — ADR-401 (manual/host-delete detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N stairs — the inverse of
 * `AttachStairsCommand`. Resets the side binding to its stair default + clears the host
 * list via the shared `detachStairSide` SSoT (stair top default = 'unconnected', Phase G),
 * then recomputes geometry + validation.
 *
 * Thin subclass of the `StairAttachDetachCommand` base (ADR-610).
 *
 * @see ./attach-detach-domain-commands.ts — the stair base (recompute + snapshot)
 * @see ./AttachStairsCommand.ts — the attach twin
 * @see bim/stairs/stair-attach-detach.ts — detachStairSide SSoT (stair defaults)
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { StairKind, StairParams } from '../../../bim/types/stair-types';
import { detachStairSide } from '../../../bim/stairs/stair-attach-detach';
import type { EntityAttachSide } from '../../../bim/entities/entity-attach-detach';
import { StairAttachDetachCommand } from './attach-detach-domain-commands';
import type { AttachDetachPatch } from './attach-detach-command-base';

export type StairDetachSide = EntityAttachSide;

/** A stair to detach + its `kind` (carried for target-build parity with column). */
export interface StairDetachTarget {
  readonly stairId: string;
  readonly kind: StairKind;
}

export class DetachStairsCommand extends StairAttachDetachCommand {
  readonly name = 'DetachStairs';
  readonly type = 'detach-stairs';

  constructor(
    private readonly side: StairDetachSide,
    private readonly targets: readonly StairDetachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): AttachDetachPatch<StairParams>[] {
    return this.buildStairPatches(this.targets, (t) => t.stairId, (prev) =>
      detachStairSide(prev, this.side),
    );
  }

  getDescription(): string {
    return `Detach ${this.targets.length} stair(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.stairId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one stair target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { side: this.side, targets: this.targets };
  }
}
