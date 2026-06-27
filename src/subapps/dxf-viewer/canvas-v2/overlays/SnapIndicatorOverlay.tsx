/**
 * SnapIndicatorOverlay — the 2D-canvas wrapper for the snap marker (■ endpoint, △ midpoint,
 * ┘ corner, ▲ midpoint, ⊕ centre, κλπ).
 *
 * ADR-542: the glyph + label + colour now live in the shared `SnapIndicatorGlyph` SSoT so
 * the 3D BIM viewport draws the EXACT same marker. This wrapper owns ONLY the 2D projection:
 * it converts the snap point from world → screen via `CoordinateTransforms.worldToScreen`
 * (the same pipeline as entity rendering: Y-inversion + margins) and the grid/guide silence
 * gate (`isSnapMarkerVisible`), then hands a screen-space position to `SnapIndicatorGlyph`.
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 4: Εμφάνιση ένδειξης
 * @see SnapIndicatorGlyph.tsx - shared screen-space glyph (2D + 3D)
 */
'use client';
import React from 'react';
import type { ViewTransform } from '../../systems/rulers-grid/config';
// 🏢 ENTERPRISE (2026-02-17): World→Screen conversion for correct indicator positioning
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// 🏢 SSoT view-model for the snap glyph (ADR-137 §Step 2).
// `isSnapMarkerVisible` = ΕΝΑ SSoT για «πότε φωτίζεται έλξη» (grid/guide σιωπηλά).
import { isSnapMarkerVisible, type SnapIndicatorView } from '../../snapping/extended-types';
// 🏢 ADR-542 — the ONE screen-space presentational glyph (shared 2D + 3D).
import { SnapIndicatorGlyph } from './SnapIndicatorGlyph';

interface SnapIndicatorOverlayProps {
  snapResult?: SnapIndicatorView | null;
  viewport: { width: number; height: number };
  canvasRect: DOMRect | null;
  transform?: ViewTransform;  // ✅ ENTERPRISE: Proper type instead of any
  className?: string;
}

export default function SnapIndicatorOverlay({
  snapResult,
  viewport,
  transform,
  className = ''
}: SnapIndicatorOverlayProps) {
  // AutoCAD standard: grid snap has no floating visual marker — cursor snaps silently.
  // ADR-189 §3.17 (2026-06-11): a guide *line* snap is likewise silent. ADR-515: ο κανόνας
  // grid/guide-σιωπηλό ζει στο `isSnapMarkerVisible` SSoT.
  if (!transform || !isSnapMarkerVisible(snapResult)) return null;

  // 🏢 ENTERPRISE (2026-02-17): Convert world coordinates → screen coordinates.
  // The snap result carries world-space coordinates from ProSnapEngineV2; the 2D wrapper is
  // the place that projects (the 3D wrapper projects through the camera instead). ADR-542.
  const screenPos = CoordinateTransforms.worldToScreen(
    snapResult.point,
    transform as { scale: number; offsetX: number; offsetY: number },
    viewport
  );

  return (
    <SnapIndicatorGlyph
      screenPos={screenPos}
      type={snapResult.type}
      description={snapResult.description}
      className={className}
    />
  );
}
