'use client';

/**
 * ADR-654 — release/non-image CLEAR guard for the live «Ιδιότητες» panel channel.
 *
 * The per-frame WRITERS are the two RAF ghost loops (`useGripGhostPreview` for a grip drag,
 * `useEntityBodyDragPreview` for a body drag / Ctrl-copy), both driven by the high-freq
 * `effectiveCursor`. They can only PUBLISH while a ghost is drawn· they cannot clear on release
 * (they early-return when idle). This tiny leaf owns the other half of the lifecycle: it clears
 * `EntityPropsLivePreviewStore` whenever NO active drag (grip OR body) targets an image — release,
 * or a different entity type — so the panel reconciles to the committed scene and a stale image
 * preview never lingers.
 *
 * While an image IS being dragged (either path) it does NOTHING — the RAF loop owns the value — so
 * the writers never fight. React-frequency clears are fine (release is a one-shot, not a hot path).
 *
 * @see hooks/tools/publish-image-live-preview.ts — the shared per-frame writer
 * @see systems/grip/EntityPropsLivePreviewStore.ts — the channel
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import type { DxfGripDragPreview } from '../grip-computation';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { EntityBodyDragStore } from '../../systems/drag/EntityBodyDragStore';
import {
  getEntityPropsLivePreview,
  setEntityPropsLivePreview,
} from '../../systems/grip/EntityPropsLivePreviewStore';

export interface UseImagePropsGripSyncProps {
  /** Live grip-drag snapshot (null between grip drags). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelSceneReader;
}

export function useImagePropsGripSync(props: UseImagePropsGripSyncProps): void {
  const { dragPreview, levelManager } = props;
  // Body-drag activation is a SEPARATE low-freq channel (arm/clear once per gesture) — subscribe so
  // the clear re-runs on body-drag release too, not only on grip-drag changes.
  const bodyActive = useSyncExternalStore(
    EntityBodyDragStore.subscribe,
    () => EntityBodyDragStore.getActive(),
    () => false,
  );

  useEffect(() => {
    const typeOf = (id: string): string | undefined => {
      const { currentLevelId } = levelManager;
      if (!currentLevelId) return undefined;
      return levelManager.getLevelScene(currentLevelId)?.entities?.find((e) => e.id === id)?.type;
    };
    // An image being dragged via a GRIP, or via a BODY drag? Leave the channel — the RAF loop owns it.
    const gripImage = !!dragPreview && typeOf(dragPreview.entityId) === 'image';
    const bodyImage = bodyActive && EntityBodyDragStore.getSession()?.entityIds.some((id) => typeOf(id) === 'image');
    if (gripImage || bodyImage) return;
    // No image drag active → drop any lingering image preview (idempotent via the store equals guard).
    if (getEntityPropsLivePreview() !== null) setEntityPropsLivePreview(null);
  }, [dragPreview, bodyActive, levelManager]);
}

/** Zero-JSX mount (ADR-040 micro-leaf) — clears the live image-props channel on release/non-image. */
export const ImagePropsGripSyncMount = React.memo(function ImagePropsGripSyncMount(
  props: UseImagePropsGripSyncProps,
) {
  useImagePropsGripSync(props);
  return null;
});
