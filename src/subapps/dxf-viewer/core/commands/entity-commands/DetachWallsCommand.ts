/**
 * DETACH WALLS COMMAND — ADR-401 Phase E.1 (manual detach UX).
 *
 * Batch, undoable «Detach Top/Base» for N walls — the inverse of
 * `AttachWalls{Top|Base}Command`. Restores the wall's binding to its default
 * (`storey-ceiling` for top / `storey-floor` for base) and clears the host list via the
 * shared `detachWallSide` SSoT, then recomputes geometry + validation and cascades
 * hosted openings.
 *
 * Thin subclass of the `WallAttachDetachCommand` base (ADR-610): a single generic
 * `side` command; the base binds the wall recompute + the hosted-opening cascade.
 *
 * @see ./attach-detach-domain-commands.ts — the wall base (recompute + cascade + snapshot)
 * @see ./AttachWallsBaseCommand.ts — the attach twin
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */

import type { ISceneManager, SerializedCommand } from '../interfaces';
import type { WallKind } from '../../../bim/types/wall-types';
import { detachWallSide, type WallAttachSide } from '../../../bim/walls/wall-attach-detach';
import { WallAttachDetachCommand } from './attach-detach-domain-commands';
import type { WallAttachDetachPatch } from './attach-detach-entity-recompute';

export type WallDetachSide = WallAttachSide;

/** A wall to detach + its `kind` (needed for the geometry recompute). */
export interface WallDetachTarget {
  readonly wallId: string;
  readonly kind: WallKind;
}

export class DetachWallsCommand extends WallAttachDetachCommand {
  readonly name = 'DetachWalls';
  readonly type = 'detach-walls';

  constructor(
    private readonly side: WallDetachSide,
    private readonly targets: readonly WallDetachTarget[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): WallAttachDetachPatch[] {
    return this.buildWallPatches(this.targets, (t) => t.wallId, (prev) =>
      detachWallSide(prev, this.side),
    );
  }

  getDescription(): string {
    return `Detach ${this.targets.length} wall(s) ${this.side}`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.wallId);
  }

  validate(): string | null {
    if (this.targets.length === 0) return 'At least one wall target is required';
    return null;
  }

  protected serializedData(): SerializedCommand['data'] {
    return { side: this.side, targets: this.targets };
  }
}
