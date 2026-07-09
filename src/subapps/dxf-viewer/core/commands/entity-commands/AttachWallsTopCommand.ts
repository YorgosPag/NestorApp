/**
 * ATTACH WALLS TOP COMMAND — ADR-401 (top auto-attach UX).
 *
 * Batch, undoable «Attach Top to Structural» for N walls onto ONE structural host
 * (beam / slab). Fixed `'top'` side over the `WallHostAttachCommand` shape base
 * (ADR-610), which binds the wall recompute + hosted-opening cascade + the shared
 * host/targets metadata. Same public API (`new AttachWallsTopCommand(hostId, targets, sm)`).
 *
 * @see ./attach-detach-domain-commands.ts — WallHostAttachCommand (the shared shape)
 * @see ./AttachWallsBaseCommand.ts — the base (upper-envelope) twin
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

import { WallHostAttachCommand } from './attach-detach-domain-commands';

export type { WallAttachTarget } from './attach-detach-domain-commands';

export class AttachWallsTopCommand extends WallHostAttachCommand {
  readonly name = 'AttachWallsTop';
  readonly type = 'attach-walls-top';
  protected readonly side = 'top' as const;
}
