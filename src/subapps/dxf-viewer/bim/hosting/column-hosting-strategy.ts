/**
 * Associative Grid Hosting — COLUMN strategy (ADR-441, Slice COL).
 *
 * Σημειακό hosting (mirror foundation pad): η κολώνα κρέμεται σε τομή δύο αξόνων μέσω
 * center-x/center-y bindings → όταν κουνηθεί ο άξονας, το `position` re-derives και η
 * γεωμετρία ξαναβγαίνει από το SSoT `computeColumnGeometry`. Revit «Column → At Grids».
 *
 * @see bim/hosting/hosting-strategy-types.ts
 * @see bim/hosting/derive-slots.ts — derivePointSlots (shared SSoT)
 */

import type { ColumnGeometry } from '../types/column-types';
import { isColumnEntity } from '../../types/entities';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { validateColumnParams } from '../validators/column-validator';
import { mmScaleFor } from '../../utils/scene-units';
import { hasGuideBindings } from './guide-binding-types';
import { derivePointSlots } from './derive-slots';
import type { HostingStrategy } from './hosting-strategy-types';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';

export const columnHostingStrategy: HostingStrategy = {
  reconcile(entity, getOffset) {
    if (!isColumnEntity(entity) || !hasGuideBindings(entity)) return null;
    const scale = mmScaleFor(entity.params);
    const next = derivePointSlots(entity.params.position, entity.guideBindings, getOffset, scale);
    if (!next) return null;
    const nextParams = {
      ...entity.params,
      position: { ...entity.params.position, x: next.x, y: next.y },
    };
    return {
      id: entity.id,
      type: 'column',
      nextParams,
      nextGeometry: computeColumnGeometry(nextParams),
      nextValidation: validateColumnParams(nextParams).bimValidation,
    };
  },
  outline(nextGeometry) {
    const geometry = nextGeometry as ColumnGeometry;
    return projectVerticesTo2D(geometry.footprint.vertices);
  },
};
