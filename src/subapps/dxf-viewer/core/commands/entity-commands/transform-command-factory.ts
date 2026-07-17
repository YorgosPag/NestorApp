/**
 * TRANSFORM COMMAND FACTORY — the ONE seam where "copy or in-place?" is decided.
 *
 * Every caller that can rotate/scale/mirror WITH a copy goes through here. Callers
 * pass their copy intent (`copy`) and get back the right `ICommand` — they never
 * name `CloneWithTransformCommand` or branch on the flag themselves.
 *
 * Before this, the choice was a boolean threaded INTO the transform commands
 * (`RotateEntityCommand.copyMode`, `ScaleEntityCommand.copyMode`,
 * `MirrorEntityCommand.keepOriginals`), which forced each command to carry a copy
 * branch its base class explicitly refused to model (ADR-507 §8). The flag now dies
 * at this boundary: above it lives UI intent, below it live two clean commands.
 *
 * ⚠️ Copy intent is the CALLER's to resolve, not this factory's — the two families
 * read it from different places and that asymmetry is deliberate:
 *   - grip commits  → `isGripCopyIntent()` (persistent toggle OR live Ctrl at commit)
 *   - tool hooks    → `GripHandoffStore` one-shot options (persistent toggle only)
 * Do not "unify" that here without deciding the UX question first.
 *
 * @see CloneWithTransformCommand — the copy branch
 * @see SnapshotTransformCommand — the in-place branch's shared spine
 * @see transform-patch-builders.ts — the per-entity patch SSoT both branches share
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 */

import type { ICommand, ISceneManager } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { MirrorAxis } from '../../../utils/mirror-math';
import { RotateEntityCommand } from './RotateEntityCommand';
import { ScaleEntityCommand } from './ScaleEntityCommand';
import { MirrorEntityCommand } from './MirrorEntityCommand';
import { CloneWithTransformCommand } from './CloneWithTransformCommand';
import {
  buildRotatePatch,
  buildScalePatch,
  buildMirrorPatch,
  rotateParamError,
  scaleParamError,
  mirrorParamError,
} from './transform-patch-builders';
import type { ScaleParams } from './transform-patch-builders';

interface RotateCommandArgs {
  readonly entityIds: string[];
  readonly pivot: Point2D;
  readonly angleDeg: number;
  readonly sceneManager: ISceneManager;
  /** Marks a drag sample so consecutive samples coalesce into one undo step. */
  readonly isDragging?: boolean;
  /** true → rotated clones, sources untouched. false → rotate in place. */
  readonly copy: boolean;
}

interface ScaleCommandArgs {
  readonly entityIds: string[];
  readonly basePoint: Point2D;
  readonly params: ScaleParams;
  readonly sceneManager: ISceneManager;
  readonly copy: boolean;
}

interface MirrorCommandArgs {
  readonly entityIds: string[];
  readonly axis: MirrorAxis;
  readonly sceneManager: ISceneManager;
  /**
   * true → mirrored clones, sources untouched. false → mirror in place.
   * NOTE: this is the old `keepOriginals` under its honest name — same polarity.
   */
  readonly copy: boolean;
}

export function createRotateCommand(args: RotateCommandArgs): ICommand {
  if (args.copy) {
    return new CloneWithTransformCommand(
      args.entityIds,
      args.sceneManager,
      buildRotatePatch(args.pivot, args.angleDeg),
      'rotate',
      rotateParamError(args.angleDeg),
    );
  }
  return new RotateEntityCommand(
    args.entityIds,
    args.pivot,
    args.angleDeg,
    args.sceneManager,
    args.isDragging ?? false,
  );
}

export function createScaleCommand(args: ScaleCommandArgs): ICommand {
  if (args.copy) {
    return new CloneWithTransformCommand(
      args.entityIds,
      args.sceneManager,
      buildScalePatch(args.basePoint, args.params),
      'scale',
      scaleParamError(args.params),
    );
  }
  return new ScaleEntityCommand(args.entityIds, args.basePoint, args.params, args.sceneManager);
}

export function createMirrorCommand(args: MirrorCommandArgs): ICommand {
  if (args.copy) {
    return new CloneWithTransformCommand(
      args.entityIds,
      args.sceneManager,
      buildMirrorPatch(args.axis),
      'mirror',
      mirrorParamError(args.axis),
    );
  }
  return new MirrorEntityCommand(args.entityIds, args.axis, args.sceneManager);
}
