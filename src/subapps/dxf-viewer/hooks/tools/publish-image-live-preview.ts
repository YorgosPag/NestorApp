/**
 * ADR-654 — the ONE writer that pushes a live-previewed entourage IMAGE's geometry to the panel
 * channel (`EntityPropsLivePreviewStore`). Shared by BOTH per-frame RAF ghost loops so they can
 * never diverge (N.18): `useGripGhostPreview` (grip drag) + `useEntityBodyDragPreview` (body drag /
 * Ctrl-copy). No-op for every non-image entity.
 *
 * The `transformed` entity handed in already ran the SAME `applyImageGripDrag` / `calculateMovedGeometry`
 * SSoT the commit runs (preview ≡ commit), so the panel shows EXACTLY what will be written on mouseup.
 *
 * @see systems/grip/EntityPropsLivePreviewStore.ts — the channel (equals-guarded, 60fps-safe)
 */

import { setEntityPropsLivePreview } from '../../systems/grip/EntityPropsLivePreviewStore';

/** If `transformed` is an entourage image, publish its live geometry· otherwise do nothing. */
export function publishImageLivePreview(transformed: { readonly type: string; readonly id: string }): void {
  if (transformed.type !== 'image') return;
  const img = transformed as unknown as {
    id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    rotation?: number;
  };
  setEntityPropsLivePreview({
    entityId: img.id,
    patch: { position: img.position, width: img.width, height: img.height, rotation: img.rotation ?? 0 },
  });
}
