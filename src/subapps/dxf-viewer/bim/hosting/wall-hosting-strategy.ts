/**
 * Associative Grid Hosting — WALL strategy (ADR-441, Slice WALL).
 *
 * Γραμμικό hosting (mirror foundation strip): ο τοίχος κρέμεται σε άξονες μέσω
 * start/end x/y bindings → όταν κουνηθεί ο άξονας, τα bound endpoints re-derive και η
 * γεωμετρία ξαναβγαίνει από το SSoT `computeWallGeometry`. Το σταθερό `extend` του binding
 * κρατά τη Location Line (παρειά) πάνω στον άξονα (Revit wall-on-grid).
 *
 * @see bim/hosting/hosting-strategy-types.ts
 * @see bim/hosting/derive-slots.ts — deriveLineSlots (shared SSoT)
 */

import type { WallGeometry } from '../types/wall-types';
import { isWallEntity } from '../../types/entities';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { validateWallParams } from '../validators/wall-validator';
import { mmScaleFor } from '../../utils/scene-units';
import { hasGuideBindings } from './guide-binding-types';
import { deriveLineSlots, type Vec2 } from './derive-slots';
import type { HostingStrategy } from './hosting-strategy-types';

export const wallHostingStrategy: HostingStrategy = {
  reconcile(entity, getOffset) {
    if (!isWallEntity(entity) || !hasGuideBindings(entity)) return null;
    const scale = mmScaleFor(entity.params);
    const next = deriveLineSlots(entity.params.start, entity.params.end, entity.guideBindings, getOffset, scale);
    if (!next) return null;
    const nextParams = {
      ...entity.params,
      start: { ...entity.params.start, x: next.start.x, y: next.start.y },
      end: { ...entity.params.end, x: next.end.x, y: next.end.y },
    };
    const sceneUnits = entity.params.sceneUnits ?? 'mm';
    return {
      id: entity.id,
      type: 'wall',
      nextParams,
      nextGeometry: computeWallGeometry(nextParams, entity.kind),
      nextValidation: validateWallParams(nextParams, sceneUnits).bimValidation,
    };
  },
  outline(nextGeometry) {
    const geometry = nextGeometry as WallGeometry;
    const outer = geometry.outerEdge.points;
    const inner = geometry.innerEdge.points;
    // Κλειστό δαχτυλίδι: outer →, μετά inner ← (αντίστροφα) ώστε να κλείσει το πολύγωνο.
    const ring: Vec2[] = [];
    for (const p of outer) ring.push({ x: p.x, y: p.y });
    for (let i = inner.length - 1; i >= 0; i--) ring.push({ x: inner[i].x, y: inner[i].y });
    return ring;
  },
};
