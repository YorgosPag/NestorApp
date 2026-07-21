/**
 * SSoT — entity translation-preview dependencies
 *
 * The three getters every 2-click translation preview needs, bundled once so the
 * Move and Copy preview hooks share ONE wiring (N.18 — no parallel twins):
 *   - `getEntity`     — BEDIT-aware O(1) cached entity getter (ADR-641)
 *   - `getBimPreview` — lazy real-entity renderer factory (ADR-550)
 *   - `getLayersById` — level layer-table getter for ByLayer/ByBlock resolution
 *
 * @see hooks/tools/useMovePreview.ts · hooks/tools/useCopyPreview.ts
 * @module hooks/tools/use-entity-translation-preview-deps
 */

import { useBeditAwareEntityGetter } from './use-bedit-aware-entity-getter';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';

export function useEntityTranslationPreviewDeps(levelManager: LevelSceneReader) {
  const getEntity = useBeditAwareEntityGetter(levelManager);
  const getBimPreview = useBimPreviewRenderer();
  const getLayersById = useLevelLayersById(levelManager);
  return { getEntity, getBimPreview, getLayersById };
}

export type EntityTranslationPreviewDeps = ReturnType<typeof useEntityTranslationPreviewDeps>;
