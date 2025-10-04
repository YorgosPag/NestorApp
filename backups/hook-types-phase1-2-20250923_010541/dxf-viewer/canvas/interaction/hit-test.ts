import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
import type { Point2D, ViewTransform } from '../../systems/rulers-grid/config';
import type { SceneModel } from '../../types/scene';
import { DEFAULT_TOLERANCE } from '../../config/tolerance-config';

export function findEntityAtPoint(
  pt: Point2D,
  scene: SceneModel,
  layers: SceneModel['layers'],
  transform: ViewTransform,
  rect: DOMRect,
  tolerancePx = DEFAULT_TOLERANCE
) {
  return UnifiedEntitySelection.findEntityAtPoint(pt, scene.entities, layers, transform, rect, tolerancePx);
}