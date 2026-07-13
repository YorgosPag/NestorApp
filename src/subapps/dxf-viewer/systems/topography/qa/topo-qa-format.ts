/**
 * ADR-650 M5α — tiny presentation helpers shared by the QA checks.
 *
 * Keeps every check honest about frames and units: a TIN node's world position (LOCAL +
 * origin) and a canonical-mm length rendered as a metre string. Length conversion goes
 * through the units SSoT (`lengthMmToM`) — never an inline `/1000`.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { TinSurface } from '../topo-types';
import { lengthMmToM } from '../../../utils/scene-units';

/** WORLD canonical mm position of TIN node `index` (LOCAL position + surface origin). */
export function nodeWorld(surface: TinSurface, index: number): Point2D {
  const [lx, ly] = surface.positions[index]!;
  return { x: lx + surface.origin.x, y: ly + surface.origin.y };
}

/** A canonical-mm length as a fixed-decimals metre string (default 2 dp), for flag messages. */
export function mmToMetreString(lengthMm: number, decimals = 2): string {
  return lengthMmToM(lengthMm).toFixed(decimals);
}
