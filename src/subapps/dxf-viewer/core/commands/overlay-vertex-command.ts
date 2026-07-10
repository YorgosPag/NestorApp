/**
 * @module core/commands/overlay-vertex-command
 * @description Family base for commands that edit a single vertex of an overlay.
 *
 * `DeleteOverlayVertexCommand` and `MoveOverlayVertexCommand` share the same
 * target surface (an `overlayId` + a `vertexIndex` + the overlay store) and so the
 * same `getAffectedEntityIds()` plus the target prologue of `validate()`. This
 * base owns those; each subclass layers its own polygon check (min-vertices vs
 * bounds) and, for the move variant, drag-coalescing.
 *
 * Generic over the concrete store interface so each subclass keeps its full store
 * type (add/remove vs update) while the base only needs `.overlays`.
 *
 * @see ./base-command.ts (id/timestamp/serialize envelope)
 * @see ./vertex-command-validation.ts (validateOverlayVertexTarget)
 */

import type { Overlay } from '../../overlays/types';
import { BaseCommand } from './base-command';
import { validateOverlayVertexTarget } from './vertex-command-validation';

/** Minimal store surface the base reads for validation. */
export interface OverlayVertexStore {
  readonly overlays: Record<string, Overlay>;
}

/** Base for a single-vertex edit on an overlay (`overlayId` + `vertexIndex`). */
export abstract class OverlayVertexCommand<
  TStore extends OverlayVertexStore,
> extends BaseCommand {
  constructor(
    protected readonly overlayId: string,
    protected readonly vertexIndex: number,
    protected readonly overlayStore: TStore,
  ) {
    super();
  }

  /** 🏢 ENTERPRISE: Get affected entity IDs. */
  getAffectedEntityIds(): string[] {
    return [this.overlayId];
  }

  /**
   * Shared target guard: overlay id present + non-negative index + overlay
   * exists. Subclasses call this first, then layer their own polygon check.
   */
  protected validateVertexTarget(): string | null {
    return validateOverlayVertexTarget(this.overlayId, this.vertexIndex, this.overlayStore.overlays);
  }
}
