/**
 * section-clip-composition — ADR-452/455/665 — the clip-plane COMPOSITION key.
 *
 * N.7.1 size split (ADR-665): extracted from `SectionSceneController` (482/500 lines). Cohesive
 * home — a self-contained, store-reading key builder that the controller's fast path depends on.
 *
 * @module bim-3d/scene/section-clip-composition
 */

import { useSectionStore } from '../stores/SectionStore';
import { useCropRegionStore } from '../render/crop-region/CropRegionStore';
import { axisCutCompositionKey } from './axis-cut-composer';
import type { ResolvedAxisCut } from './cut-plane-3d';

/**
 * ADR-452/455 v2.11 — a cheap string key of the clip-plane COMPOSITION: which sources are active
 * and their geometry, DELIBERATELY excluding the cut POSITIONS. An identical key across two
 * `applyState` calls ⇒ only a cut constant moved ⇒ fast path (mutate `plane.constant` in place,
 * skip the per-mesh `needsUpdate` → the 50-157 ms RAF program re-setup). A flip (sign change), an
 * axis toggle, box drag / crop / mode / enable change ⇒ new key ⇒ full re-apply.
 *
 * ADR-665 — the terrain cut contributes only its PRESENCE (`tc0`/`tc1`), never its elevation. That
 * is the whole point: switching floors moves the terrain plane's constant while the composition
 * stays identical ⇒ the fast path absorbs it ⇒ **changing level costs nothing**.
 */
export function clipCompositionKey(
  resolved: ResolvedAxisCut[],
  terrainCut: ResolvedAxisCut | null,
): string {
  const { enabled, mode, boxBounds, planes } = useSectionStore.getState();
  const box = enabled && mode === 'box' && boxBounds
    ? `${boxBounds.min.join(',')}|${boxBounds.max.join(',')}`
    : '';
  const pl = enabled && mode !== 'box'
    ? planes.filter((p) => p.enabled).map((p) => `${p.normal.join(',')}:${p.constant}`).join('/')
    : '';
  const crop = useCropRegionStore.getState();
  const cr = crop.editState === 'committed' && crop.rectangle
    ? (crop.depthRangeEnabled ? `${crop.nearNorm},${crop.farNorm}` : '-')
    : '';
  const tc = terrainCut ? 1 : 0;
  return `axes:${axisCutCompositionKey(resolved)}|e${enabled ? 1 : 0}|m${mode}|b${box}|p${pl}|r${cr}|tc${tc}`;
}
