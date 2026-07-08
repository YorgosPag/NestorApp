/**
 * Circle Text Rendering Utilities
 * Shared utilities for rendering text on circles
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-557 follow-up: center measurement label SSoT (content builder + stacked-label helper)
import { buildCircleAreaCircumferenceLines, renderStackedCenterMeasurementLabel } from './measurement-label';

/**
 * Render area and circumference text on circle
 */
export function renderCircleAreaText(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  screenRadius: number,
  area: number,
  circumference: number
): void {
  // 🏢 ADR-557 follow-up (N.11): content via the SSoT builder (kills the
  // `Εμβαδόν:`/`Περιφέρεια:` hardcoded Greek literals), stacked via the shared
  // centre-label painter (gated — honours dynamic styling/decorations).
  const [areaLine, circumferenceLine] = buildCircleAreaCircumferenceLines(area, circumference);
  renderStackedCenterMeasurementLabel(ctx, screenCenter, [
    { text: areaLine, offsetY: -screenRadius / 2 },
    { text: circumferenceLine, offsetY: screenRadius / 2 },
  ]);
}