/**
 * Parametric grip-commit resolution SSoT — the two preambles every parametric
 * grip-commit / hot-grip-copy handler repeats verbatim (ADR-584 CHECK 3.28,
 * cluster A). Extracted from grip-parametric-commits.ts /
 * grip-parametric-copy.ts / grip-parametric-centred-box-commits.ts, where the
 * same two blocks were copy-pasted once per entity type:
 *
 *   1. `resolveParametricGripEntity` — `createSceneManagerAdapter → getEntity →
 *      cast → type/params guard`, the ~20× entity-resolution preamble.
 *   2. `resolveGripCommitAnchor` — the rotate-pivot-vs-plain-anchor block that
 *      picks the drag anchor + live cursor for a rotation hot-grip.
 *
 * Neither helper widens behaviour: each is byte-for-byte what the call sites did
 * inline, so the public commit API and its outputs are unchanged.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { ISceneManager } from '../../core/commands/interfaces';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import type { DxfCommitDeps } from './unified-grip-types';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';

/** A parametric BIM entity: discriminant `type` literal + a derived `params` bag. */
interface ParametricSceneEntity {
  readonly type: string;
  readonly params: unknown;
}

/**
 * Resolves the scene-manager adapter + the typed parametric entity behind a grip
 * commit, or `null` when the adapter is unavailable / the entity is missing / it
 * is the wrong `type` / it has no `params`. SSoT for the identical
 * `createSceneManagerAdapter → getEntity → cast → type/params guard` preamble
 * every parametric commit + hot-grip-copy handler used to inline.
 *
 * `T` is the concrete entity type and `entityType` its discriminant literal; on
 * success `entity` is narrowed to `T` (the same `candidate as T`-after-guard cast
 * each call site did by hand — declared-not-enforced, mirror gripKindOf).
 */
export function resolveParametricGripEntity<T extends ParametricSceneEntity>(
  deps: DxfCommitDeps,
  entityId: string,
  entityType: T['type'],
): { sceneManager: ISceneManager; entity: T } | null {
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return null;
  const raw = sceneManager.getEntity(entityId);
  if (!raw) return null;
  const candidate = raw as unknown as Partial<T>;
  if (candidate.type !== entityType || !candidate.params) return null;
  return { sceneManager, entity: candidate as T };
}

/**
 * Rotate-pivot vs plain-anchor resolution for a parametric grip commit. When the
 * dragged grip is the entity's rotation hot-grip AND the hook has published a
 * `{pivot, anchor}` in `BimRotateHotGripStore` (the 6-click AutoCAD ROTATE→Reference
 * flow), the drag orbits the picked centre: `anchor` is the published reference arm
 * and `currentPos = anchor + delta` is the live cursor / align point, with `pivot`
 * the rotation centre. Every other grip anchors at the grip position (and downstream
 * ignores `currentPos`). SSoT for the block that was copy-pasted once per entity type.
 *
 * `pivotPatch` is spread straight into the `apply*GripDrag` input — `{ pivot }` for a
 * rotate drag, `{}` otherwise — so callers forward the pivot without re-deriving it.
 */
export function resolveGripCommitAnchor(
  isRotationGrip: boolean,
  gripPosition: Point2D,
  delta: Point2D,
): {
  anchor: Point2D;
  currentPos: Point2D;
  pivotPatch: { pivot: Point2D } | Record<string, never>;
} {
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    isRotationGrip && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : gripPosition;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const pivotPatch: { pivot: Point2D } | Record<string, never> = useRotatePivot
    ? { pivot: rotateCtx.pivot! }
    : {};
  return { anchor, currentPos, pivotPatch };
}
