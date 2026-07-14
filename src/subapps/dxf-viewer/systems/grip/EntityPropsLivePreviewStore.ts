/**
 * ADR-654 — live «Properties panel» preview channel during a grip / body drag.
 *
 * Zero-React imperative singleton (pattern ≡ `GripDragStore` / `ImmediateSnapStore`): a
 * per-type grip-sync leaf mounted NEAR the canvas publishes the LIVE geometry patch of the
 * dragged entity, and the (subtree-distant) left Properties palette READS it so its fields
 * track the drag frame-for-frame — the SAME `preview ≡ commit` idea as ADR-557's text-toolbar
 * channel, but for the object inspector. The patch carries only the geometry fields the drag
 * changed (position / width / height / rotation …), computed via the entity's OWN grip-drag SSoT
 * (`applyImageGripDrag` for image), so the panel never re-derives math and can never diverge.
 *
 * Lifecycle: the sync leaf sets a `{ entityId, patch }` per frame (redundant-write guarded on its
 * side) and clears to `null` on release, so the panel reconciles to the committed scene. This is a
 * PREVIEW channel only — it never triggers a command / undo entry (the drag commits once, on mouseup).
 *
 * @see hooks/grips/useImagePropsGripSync.ts — the image producer (writer)
 * @see ui/image-advanced-panel/ImageAdvancedPanel.tsx — the panel consumer (reader)
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

/** The live geometry patch of the currently-dragged entity whose panel is open. */
export interface EntityPropsLivePreview {
  readonly entityId: string;
  readonly patch: Readonly<Record<string, unknown>>;
}

/**
 * The pub/sub cell itself is the shared `createExternalStore` SSoT (ADR-294) — this module
 * only owns the domain: what the value MEANS and how it is merged. No hand-rolled listener set.
 */
const store = createExternalStore<EntityPropsLivePreview | null>(null);

/** Read (useSyncExternalStore getSnapshot) — the live patch, or `null` when no drag is active. */
export const getEntityPropsLivePreview = store.get;

/** Subscribe (useSyncExternalStore) — fires on every set (per drag frame + on release). */
export const subscribeEntityPropsLivePreview = store.subscribe;

/** Write — the grip-sync leaf publishes the live patch, or `null` to clear on release. */
export const setEntityPropsLivePreview = store.set;

/**
 * Merge the live preview onto a committed entity when it targets that entity — the ONE place the
 * overlay is applied, shared by every panel consumer (image now· block/line on adopt). Returns the
 * committed entity unchanged when no drag targets it (identity → no needless re-render churn).
 */
export function withEntityPropsLivePreview<T extends { readonly id: string }>(
  entity: T,
  preview: EntityPropsLivePreview | null,
): T {
  return preview && preview.entityId === entity.id ? { ...entity, ...preview.patch } : entity;
}
