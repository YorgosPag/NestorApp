/**
 * ADR-557 — UpdateTextTransformCommand (minimal, top-level fields).
 *
 * Commits a text/mtext grip-box transform (move / rotate / corner+edge resize) by
 * patching the TOP-LEVEL geometry fields the renderer + scene→DxfText converter
 * actually read: `position`, `rotation`, `height` (+ `fontSize` alias kept in
 * sync, mirror `scaleText`), and EITHER `width` (MTEXT frame) OR `widthFactor`
 * (simple-TEXT X-scale). Never both.
 *
 * Why NOT `UpdateTextGeometryCommand` (audit §4.3): that command writes
 * `textNode.rotation` (the renderer reads the FLAT `rotation` → desync) and only
 * patches `width` when `textNode.columns` exists (silently dropped for every
 * single-column MTEXT + every TEXT). This command writes the flat fields directly,
 * so preview ≡ commit and a continuous drag collapses into one undo via the shared
 * `MergeableUpdateCommand` merge window (ADR-031 / ADR-507 §8).
 *
 * @see bim/text/text-grips.ts — the pure transform (`applyTextGripDrag`) this commits
 * @see core/commands/entity-commands/MergeableUpdateCommand.ts — merge/undo skeleton
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { DxfTextNode } from '../../../text-engine/types';
import { MergeableUpdateCommand } from '../entity-commands/MergeableUpdateCommand';

/** The full top-level transform state written by the command (forward + undo are symmetric). */
export interface TextTransformState {
  position: Point2D;
  rotation: number;
  height: number;
  /** Alias of `height` kept in sync (mirror `scaleText`/`scaleMText`). */
  fontSize: number;
  /** MTEXT frame width (world units). Present for MTEXT only. */
  width?: number;
  /** Simple-TEXT X-scale (horizontal stretch). Present for TEXT only. */
  widthFactor?: number;
  /**
   * ADR-557 Φ-attachment — the run-height-scaled textNode. Height's SSoT is
   * `textNode.runs[].style.height` (`resolveTextHeight` reads it FIRST), so the flat
   * `height` above is a shadowed mirror; this is the durable write. Present only when a
   * resize changed the height. Undo carries the pre-drag node (symmetric).
   */
  textNode?: DxfTextNode;
}

export class UpdateTextTransformCommand extends MergeableUpdateCommand<TextTransformState> {
  readonly name = 'UpdateTextTransform';
  readonly type = 'update-text-transform';

  constructor(
    entityId: string,
    next: TextTransformState,
    previous: TextTransformState,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(entityId, next, previous, sceneManager, isDragging);
  }

  protected applyPatch(state: TextTransformState): void {
    const patch: Record<string, unknown> = {
      position: state.position,
      rotation: state.rotation,
      height: state.height,
      fontSize: state.fontSize,
    };
    // Exactly one width channel — never write the other entity-type's field.
    if (state.width != null) patch.width = state.width;
    if (state.widthFactor != null) patch.widthFactor = state.widthFactor;
    // ADR-557 Φ-attachment — durable height: write the run-height-scaled textNode (the
    // SSoT `resolveTextHeight` reads first). Without this the flat `height` above is
    // shadowed same-tick and a resize visually reverts (Giorgio 2026-07-06).
    if (state.textNode != null) patch.textNode = state.textNode;
    this.sceneManager.updateEntity(this.entityId, patch as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(next: TextTransformState): UpdateTextTransformCommand {
    return new UpdateTextTransformCommand(this.entityId, next, this.previousPatch, this.sceneManager, true);
  }

  getDescription(): string {
    return 'Update text transform';
  }

  validate(): string | null {
    if (!this.entityId) return 'entityId is required';
    if (!(this.patch.height > 0)) return 'height must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    if (this.patch.width != null && !(this.patch.width > 0)) return 'width must be > 0';
    if (this.patch.widthFactor != null && !(this.patch.widthFactor > 0)) return 'widthFactor must be > 0';
    return null;
  }
}
