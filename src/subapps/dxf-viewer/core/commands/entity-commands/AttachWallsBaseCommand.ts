/**
 * ATTACH WALLS BASE COMMAND — ADR-401 (γ) (base auto-attach UX).
 *
 * Batch, undoable «Attach Base to Structural» for N walls onto ONE structural host
 * (foundation beam / slab). Fixed `'base'` side over the `WallHostAttachCommand` shape
 * base (ADR-610), which binds the wall recompute + hosted-opening cascade + the shared
 * host/targets metadata. Same public API (`new AttachWallsBaseCommand(hostId, targets, sm)`).
 *
 * @see ./attach-detach-domain-commands.ts — WallHostAttachCommand (the shared shape)
 * @see ./AttachWallsTopCommand.ts — the top (lower-envelope) twin + the shared target type
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

import { WallHostAttachCommand, type WallAttachTarget } from './attach-detach-domain-commands';

/** A wall to attach base + its `kind` — identical shape to the top target. */
export type WallBaseAttachTarget = WallAttachTarget;

export class AttachWallsBaseCommand extends WallHostAttachCommand {
  readonly name = 'AttachWallsBase';
  readonly type = 'attach-walls-base';
  protected readonly side = 'base' as const;
}
