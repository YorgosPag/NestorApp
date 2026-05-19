// ADR-362 Phase 3 hotfix — dimLineRef phase skip-snap helper (SSoT).
// The 3rd click of linear/aligned dims is a position pick (dim line offset),
// not an entity pick. AutoCAD disables object snap for this step so the
// preview position and the commit position match. Centralized to keep
// `useDrawingHandlers` and `drawing-hover-handler` in sync.

import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
import { requiredClickCount } from './dimension-create-state';

export function isDimLineRefPhase(): boolean {
  const state = dimensionCreateStore.get();
  const type = state.currentType;
  if (type !== 'linear' && type !== 'aligned') return false;
  return state.clicks.length === requiredClickCount(type) - 1;
}
