/**
 * ADR-423 / ADR-424 — Stage 0 space-binding (agnostic).
 *
 * Assigns each recognized element to the **smallest containing space** (mirror of
 * the ADR-419 `pickSmallestContainingPerimeter` min-area rule), then writes the
 * back-references both ways: `element.spaceId` + `space.containedElementIds`.
 * Point-in-polygon reuses the `GeometryUtils` SSoT — zero new geometry.
 *
 * @see ../../bim/walls/perimeter-from-faces.ts (pickSmallestContainingPerimeter)
 */

import type { Point2D } from '../../rendering/types/Types';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { RecognizedElement, RecognizedSpace } from './recognition-types';

/** Result of binding — spaces and elements with cross-references populated. */
export interface SpaceBindingResult {
  readonly spaces: readonly RecognizedSpace[];
  readonly elements: readonly RecognizedElement[];
}

/** Smallest-area space whose polygon contains `point`, or `null`. */
function smallestContainingSpace(
  point: Point2D,
  spaces: readonly RecognizedSpace[],
): RecognizedSpace | null {
  let best: RecognizedSpace | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const s of spaces) {
    if (!isPointInPolygon(point, [...s.polygon])) continue;
    if (s.area < bestArea) {
      best = s;
      bestArea = s.area;
    }
  }
  return best;
}

/**
 * Bind elements to spaces. An element outside every space keeps `spaceId`
 * undefined (e.g. a fixture in an unrecognized/open area) — not an error.
 */
export function bindElementsToSpaces(
  spaces: readonly RecognizedSpace[],
  elements: readonly RecognizedElement[],
): SpaceBindingResult {
  const containment = new Map<string, string[]>();
  const boundElements = elements.map((el) => {
    const space = smallestContainingSpace(el.position, spaces);
    if (!space) return el;
    const list = containment.get(space.spaceId) ?? [];
    list.push(el.elementId);
    containment.set(space.spaceId, list);
    return { ...el, spaceId: space.spaceId };
  });
  const boundSpaces = spaces.map((s) => ({
    ...s,
    containedElementIds: containment.get(s.spaceId) ?? [],
  }));
  return { spaces: boundSpaces, elements: boundElements };
}
