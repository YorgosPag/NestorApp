/**
 * ADR-563 (Auto-Dimension) — command flow (dialog → engine → commit).
 *
 * Opens the options dialog, then runs the pure engine over the current
 * selection (or the whole plan when nothing is selected) and commits the
 * generated dimensions as one undoable batch. All heavy lifting is delegated to
 * existing SSoT: `runAutoDimension` (engine), `addDimensionsToScene`
 * (batch commit), `getDimStyleRegistry` (active style), `getLayer` (layer id).
 *
 * @see app/dxf-special-actions.ts — the `'auto-dimension'` action calls this.
 */

import type { SceneAppendAccessor } from '../../../bim/scene/append-entity-to-scene';
import { addDimensionsToScene } from '../../../bim/scene/add-dimensions-to-scene';
import { getLayer } from '../../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../../config/layer-config';
import { getDimStyleRegistry } from '../dim-style-registry';
import { runAutoDimension } from './auto-dimension-engine';
import { requestAutoDimensionDialog } from './auto-dimension-dialog-store';

/**
 * Run the full auto-dimension flow. Returns the number of dimensions placed
 * (0 when cancelled / nothing to dimension). Selection-driven: when
 * `selectedEntityIds` is non-empty only those elements are dimensioned,
 * otherwise the whole active-level plan.
 */
export async function runAutoDimensionFlow(
  accessor: SceneAppendAccessor,
  selectedEntityIds: readonly string[],
): Promise<number> {
  const levelId = accessor.currentLevelId;
  if (!levelId) return 0;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return 0;

  const result = await requestAutoDimensionDialog();
  if (result.kind !== 'run') return 0;

  const selected = new Set(selectedEntityIds);
  const elements = selected.size > 0
    ? scene.entities.filter((e) => selected.has(e.id))
    : scene.entities;

  const style = getDimStyleRegistry().getActiveStyle();
  const layerId = getLayer(DXF_DEFAULT_LAYER)?.id ?? '0';
  const dims = runAutoDimension(elements, result.options, { styleId: style.id, layerId, style });
  if (dims.length === 0) return 0;

  addDimensionsToScene(dims, accessor);
  return dims.length;
}
