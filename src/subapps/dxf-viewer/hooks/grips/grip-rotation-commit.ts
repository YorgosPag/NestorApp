/**
 * GRIP ROTATION COMMIT — SSoT for "a grip drag resolved to a rotation; commit it".
 *
 * Every grip rotation handle — line, arc, annotation symbol, polyline/area outline,
 * group, block, hatch — ends the same way once its own geometry work has produced a
 * pivot + a swept angle:
 *
 *   read the live copy intent → build the command → validate → execute
 *
 * That tail was copy-pasted across five call sites in four files. What varies is
 * everything BEFORE it (which handle, which entity shape, how the pivot is derived);
 * what follows is identical, so it lives here once.
 *
 * ADR-507 §8 — `createRotateCommand` decides in-place vs `CloneWithTransformCommand`;
 * this helper only supplies the copy intent and the execute/validate gate.
 *
 * NOTE: the copy intent is read HERE, at commit time, via `isGripCopyIntent()` — not
 * passed in. The mouseup that triggers a grip commit has lost the native KeyboardEvent
 * by the time it reaches the dispatcher, so live Ctrl state must come from the tracker
 * singleton (see `createModifierKeyTracker`). Callers that already resolved their own
 * intent (e.g. the rect-explode branch) pass it explicitly via `copy`.
 *
 * @see systems/grip/grip-copy-intent.ts — the toggle-OR-live-Ctrl predicate
 * @see core/commands/entity-commands/transform-command-factory.ts — in-place vs copy
 */

import type { ISceneManager } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import { createRotateCommand } from '../../core/commands/entity-commands/transform-command-factory';
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';

interface GripRotationCommitArgs {
  readonly entityId: string;
  readonly pivot: Point2D;
  readonly angleDeg: number;
  readonly sceneManager: ISceneManager;
  readonly execute: (command: ReturnType<typeof createRotateCommand>) => void;
  /** Override the live copy intent — omit to read it at commit time. */
  readonly copy?: boolean;
}

/**
 * Builds, validates and executes the rotation for a single grip-driven entity.
 * Silently no-ops when the command is invalid (zero sweep) — the callers' contract.
 */
export function commitGripRotation(args: GripRotationCommitArgs): void {
  const command = createRotateCommand({
    entityIds: [args.entityId],
    pivot: args.pivot,
    angleDeg: args.angleDeg,
    sceneManager: args.sceneManager,
    copy: args.copy ?? isGripCopyIntent(),
  });
  if (command.validate() !== null) return;
  args.execute(command);
}
