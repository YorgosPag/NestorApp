/**
 * Overlay renderer — local types.
 *
 * Re-exports geometry SSoT from `@/types/floorplan-overlays` and adds
 * renderer-internal value types (canvas bounds, fit transform, label
 * struct, render options).
 *
 * @module components/shared/files/media/overlay-renderer/types
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import type {
  FloorplanOverlay,
  OverlayGeometry,
  OverlayGeometryType,
  OverlayRole,
  OverlayStyle,
  Point2D,
} from '@/types/floorplan-overlays';
import type { PropertyStatus } from '@/constants/property-statuses-enterprise';

export type {
  FloorplanOverlay,
  OverlayGeometry,
  OverlayGeometryType,
  OverlayRole,
  OverlayStyle,
  Point2D,
};

/** Axis-aligned world-space bounds of the source scene. */
export interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

/** World→screen affine transform (uniform scale + offset). */
export interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * In-polygon hover label. Caller pre-formats strings with i18n + currency.
 * Renderer is locale-agnostic.
 */
export interface OverlayLabel {
  primaryText?: string;
  secondaryText?: string;
  emphasisText?: string;
}

/**
 * Per-overlay dispatch options. `resolvedStatus` drives polygon role colors;
 * `unitsPerMeter` drives dimension/measurement real-world labeling.
 */
export interface OverlayRenderContext {
  isHighlighted?: boolean;
  resolvedStatus?: PropertyStatus | null;
  unitsPerMeter?: number;
  strokeWidth?: number;
  strokeWidthHighlighted?: number;
  styleOverride?: OverlayStyle;
}
