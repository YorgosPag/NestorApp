/**
 * Associative Grid Hosting — FOUNDATION strategy (ADR-441, Slice GEN).
 *
 * Wraps το υπάρχον foundation follow-on-move (`deriveFoundationParamsFromGuides` +
 * `computeFoundationGeometry` + `validateFoundationParams`) στο generic `HostingStrategy`
 * contract. **Zero behavior change** — η foundation regression suite αποδεικνύει ότι η
 * συμπεριφορά μένει identical με το παλιό `reconcileOne`.
 *
 * @see bim/hosting/hosting-strategy-types.ts
 * @see bim/hosting/derive-params-from-guides.ts
 */

import type { FoundationGeometry } from '../types/foundation-types';
import { isFoundationEntity } from '../../types/entities';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { validateFoundationParams } from '../validators/foundation-validator';
import { hasGuideBindings } from './guide-binding-types';
import { deriveFoundationParamsFromGuides } from './derive-params-from-guides';
import type { HostingStrategy } from './hosting-strategy-types';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';

export const foundationHostingStrategy: HostingStrategy = {
  reconcile(entity, getOffset) {
    if (!isFoundationEntity(entity) || !hasGuideBindings(entity)) return null;
    const nextParams = deriveFoundationParamsFromGuides(entity.params, entity.guideBindings, getOffset);
    if (!nextParams) return null;
    return {
      id: entity.id,
      type: 'foundation',
      nextParams,
      nextGeometry: computeFoundationGeometry(nextParams),
      nextValidation: validateFoundationParams(nextParams).bimValidation,
    };
  },
  outline(nextGeometry) {
    const geometry = nextGeometry as FoundationGeometry;
    return projectVerticesTo2D(geometry.footprint.vertices);
  },
};
