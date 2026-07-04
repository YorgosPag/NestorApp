/**
 * ADR-510 Φ5 — SSoT: inherit an entity's STYLE onto a NEW derived primitive
 * (AutoCAD explode/offset/fillet inheritance: the pieces keep the source's
 * layer / colour / lineweight / linetype / transparency / …).
 *
 * Strips GEOMETRY, IDENTITY, TYPE and transient selection/preview fields; keeps
 * every style-bearing key. The rule lived inline in `systems/corner/
 * fillet-curve-geometry.ts` (`inheritEntityStyle` + `ARC_STYLE_SKIP`) — promoted
 * here so explode / fillet / future modify ops share ONE inheritance rule
 * (N.0.2 boy-scout / N.12 SSoT). The skip set is a SUPERSET of the fillet one
 * (adds rect/polyline geometry keys) — safe for line/arc/circle sources too.
 */

import type { BaseEntity } from '../../types/base-entity';
import type { Entity } from '../../types/entities';

/** Keys that describe GEOMETRY / IDENTITY / transient state — never inherited. */
export const ENTITY_STYLE_SKIP: ReadonlySet<string> = new Set([
  // identity + discriminant
  'id', 'type',
  // line / arc / circle geometry
  'start', 'end', 'center', 'radius', 'startAngle', 'endAngle', 'counterclockwise',
  // polyline geometry
  'vertices', 'bulges', 'closed', 'startWidths', 'endWidths',
  // rectangle geometry
  'x', 'y', 'width', 'height', 'rotation', 'corner1', 'corner2',
  // transient UI state
  'selected', 'preview', 'previewGripPoints', 'showPreviewGrips',
]);

/**
 * Inherit layer/colour/lineweight/linetype style from `source` onto a derived
 * primitive. The caller adds a fresh `id`, the `type` and the new geometry.
 */
export function inheritEntityStyle(source: Entity): Partial<BaseEntity> {
  const src = source as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (!ENTITY_STYLE_SKIP.has(key)) out[key] = src[key];
  }
  return out as Partial<BaseEntity>;
}
