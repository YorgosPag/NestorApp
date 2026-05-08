/* eslint-disable design-system/no-hardcoded-colors */
/**
 * Overlay renderer — color resolution.
 *
 * Polygon overlays mapped to a `PropertyStatus` get role-tinted colors via
 * `getStatusColors`. Non-polygon (annotation) shapes get a neutral default
 * stroke. Renderers always honor an `OverlayStyle` override when supplied.
 *
 * @module components/shared/files/media/overlay-renderer/colors
 * @enterprise ADR-340 §3.6 / ADR-258D Phase 9 STEP E
 */

import { getStatusColors } from '@/subapps/dxf-viewer/config/color-mapping';
import {
  UI_COLORS,
  withOpacity,
  OVERLAY_OPACITY,
} from '@/subapps/dxf-viewer/config/color-config';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';
import type { OverlayStyle } from './types';

/** Fallback (no status / unlinked / annotation) — ADR-258 SSoT opacity. */
export const OVERLAY_FALLBACK = {
  stroke: UI_COLORS.DARK_GRAY,
  fill: withOpacity(UI_COLORS.DARK_GRAY, OVERLAY_OPACITY.MUTED),
} as const;

export interface ResolvedColors {
  stroke: string;
  fill: string;
}

/**
 * Resolve stroke + fill for a polygon overlay. `isHighlighted` toggles the
 * gallery hover-fill convention (no fill at rest, translucent fill on hover).
 * `styleOverride` (overlay.style on the entity) wins over computed colors.
 */
export function resolvePolygonColors(
  resolvedStatus: PropertyStatus | null | undefined,
  isHighlighted: boolean,
  styleOverride?: OverlayStyle,
): ResolvedColors {
  const base = (resolvedStatus && getStatusColors(resolvedStatus)) ?? OVERLAY_FALLBACK;
  const fill = isHighlighted
    ? withOpacity(base.stroke, OVERLAY_OPACITY.GALLERY_FILL)
    : 'transparent';
  return {
    stroke: styleOverride?.stroke ?? base.stroke,
    fill: styleOverride?.fill ?? fill,
  };
}

/** Resolve stroke for non-polygon (annotation) geometry. */
export function resolveAnnotationStroke(
  isHighlighted: boolean,
  styleOverride?: OverlayStyle,
): string {
  if (styleOverride?.stroke) return styleOverride.stroke;
  return isHighlighted
    ? withOpacity(OVERLAY_FALLBACK.stroke, 1)
    : OVERLAY_FALLBACK.stroke;
}
