/**
 * Associative Grid Hosting — BEAM strategy (ADR-441, Slice GEN-BEAM).
 *
 * Γραμμικό hosting (ακριβές mirror του `wallHostingStrategy`): η δοκός κρέμεται σε
 * άξονες μέσω start/end x/y bindings → όταν κουνηθεί ο άξονας, τα bound endpoints
 * re-derive και η γεωμετρία ξαναβγαίνει από το SSoT `computeBeamGeometry`. Το σταθερό
 * `extend` του binding κρατά το άκρο πάνω στον άξονα (Revit beam-on-grid).
 *
 * Διαφορά από τον τοίχο: ο `BeamParams` κρατά τον άξονα ως `startPoint`/`endPoint`
 * (Point3D), όχι `start`/`end` (Point2D) — γι' αυτό το write-back **διατηρεί το z**
 * (`{ ...startPoint, x, y }`). Η `deriveLineSlots` δουλεύει σε x/y (Vec2) όπως παντού.
 *
 * @see bim/hosting/hosting-strategy-types.ts
 * @see bim/hosting/derive-slots.ts — deriveLineSlots (shared SSoT)
 * @see bim/hosting/wall-hosting-strategy.ts — γραμμικό πρότυπο
 */

import type { BeamGeometry, BeamParams } from '../types/beam-types';
import { isBeamEntity } from '../../types/entities';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { validateBeamParams } from '../validators/beam-validator';
import { mmScaleFor } from '../../utils/scene-units';
import { hasGuideBindings } from './guide-binding-types';
import { deriveLineSlots, type Vec2 } from './derive-slots';
import type { HostingStrategy } from './hosting-strategy-types';

export const beamHostingStrategy: HostingStrategy = {
  reconcile(entity, getOffset) {
    if (!isBeamEntity(entity) || !hasGuideBindings(entity)) return null;
    const p = entity.params;
    const scale = mmScaleFor(p);
    const next = deriveLineSlots(p.startPoint, p.endPoint, entity.guideBindings, getOffset, scale);
    if (!next) return null;
    const nextParams: BeamParams = {
      ...p,
      // Διατήρησε το z (Point3D): re-derive μόνο x/y από τους άξονες.
      startPoint: { ...p.startPoint, x: next.start.x, y: next.start.y },
      endPoint: { ...p.endPoint, x: next.end.x, y: next.end.y },
    };
    const sceneUnits = p.sceneUnits ?? 'mm';
    return {
      id: entity.id,
      type: 'beam',
      nextParams,
      nextGeometry: computeBeamGeometry(nextParams),
      nextValidation: validateBeamParams(nextParams, sceneUnits).bimValidation,
    };
  },
  outline(nextGeometry) {
    const geometry = nextGeometry as BeamGeometry;
    // Plan-view outline = ένα κλειστό ορθογώνιο (width × length) — το ζωγραφίζει
    // ο follow-ghost. Map Point3D vertices → Vec2 (x/y).
    const ring: Vec2[] = [];
    for (const v of geometry.outline.vertices) ring.push({ x: v.x, y: v.y });
    return ring;
  },
};
