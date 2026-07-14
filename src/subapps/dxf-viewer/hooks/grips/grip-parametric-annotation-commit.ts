/**
 * ADR-583/612 — shared parametric-annotation grip commit (SSoT).
 *
 * Params-driven annotation entities (graphic scale-bar, opening-info-tag) all commit a grip
 * drag the SAME way: resolve the entity from the scene, run the pure `apply*GripDrag` SSoT
 * (optionally feeding the shared hot-grip rotate `{pivot, anchor}` when the rotation handle is
 * grabbed), then write the flat params patch atomically through the generic `UpdateEntityCommand`
 * (undo/redo-safe, idempotent). Only the entity-type token, the rotation kind, the drag helper and
 * the undo label differ — so those are the `spec`, and the routine lives ONCE here (N.18) instead
 * of being copy-pasted per annotation family.
 *
 * @see hooks/grips/grip-scale-bar-commit.ts — the scale-bar caller
 * @see hooks/grips/grip-opening-info-tag-commit.ts — the opening-info-tag caller
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { UpdateEntityCommand, type EntityPatch } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * Commit a parametric-annotation grip drag. `spec.kind` is the already-resolved grip kind (from
 * the caller's typed `gripKindOf`); when it equals `spec.rotationKind` AND the hot-grip store holds
 * a picked `{pivot, anchor}`, the drag opts into the shared orbit flow — otherwise `apply` falls
 * back to its own-origin transform. No-ops silently on a missing entity / kind / scene manager, or
 * when the resulting command fails validation.
 */
export function commitParametricAnnotationGripDrag<K extends string, E extends object>(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
  spec: {
    readonly kind: K | null;
    readonly entityType: string;
    readonly rotationKind: K;
    readonly apply: (
      kind: K,
      entity: E,
      gripWorldPos: Point2D,
      delta: Point2D,
      rotate?: { readonly pivot: Point2D; readonly anchor: Point2D },
      shiftHeld?: boolean,
    ) => Partial<E>;
    readonly label: string;
  },
): void {
  const { kind } = spec;
  if (!grip.entityId || !kind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as { type?: string }).type !== spec.entityType) return;
  const entity = raw as unknown as E;
  // After the user picks a rotation centre the hook publishes {pivot, anchor} in the shared
  // BimRotateHotGripStore, so the entity ORBITS that centre (Giorgio 2026-07-09 «όπως ο τοίχος»).
  // Absent ctx (non-hot path) → the pure helper falls back to own-origin spin.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    kind === spec.rotationKind && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  // ADR-654 — ο ΖΩΝΤΑΝΟΣ Shift modifier, προωθημένος στον καθαρό transform (η εικόνα τον
  // χρησιμοποιεί για ελευθέρωση του λόγου πλευρών στη γωνιακή λαβή). ΤΟ ΙΔΙΟ SSoT διαβάζει
  // και το live ghost (`apply-parametric-annotation-preview`) → preview ≡ commit. Το native
  // event δεν φτάνει ως εδώ by design (βλ. ShiftKeyTracker) — γι' αυτό ο tracker.
  const patch = spec.apply(
    kind, entity, grip.position, delta,
    useRotatePivot ? { pivot: rotateCtx.pivot!, anchor: rotateCtx.anchor! } : undefined,
    ShiftKeyTracker.getSnapshot(),
  );
  const command = new UpdateEntityCommand(
    grip.entityId,
    patch as unknown as EntityPatch,
    sceneManager,
    spec.label,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}
