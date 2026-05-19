/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * GripDimAnnotationMount (ADR-363 Phase 4.5c.5) — micro-leaf για live
 * dimension annotations κατά τη διάρκεια grip drag σε column/beam entities.
 * Extracted σε ξεχωριστό αρχείο για SRP / N.7.1 (<500 lines).
 *
 * Draws "w=350mm" / "d=400mm" / "al=150mm" labels near the active grip handle
 * on the PreviewCanvas — Revit/AutoCAD live-dim convention.
 * CanvasSection δεν re-renderάρει επιπλέον: rides the existing dragPreview
 * React-state cycle (same frequency as GripDragPreviewMount).
 */

'use client';

import React from 'react';
import { useGripDimAnnotation } from '../../hooks/tools/useGripDimAnnotation';
import type { UseGripDimAnnotationProps } from '../../hooks/tools/useGripDimAnnotation';

export type GripDimAnnotationMountProps = UseGripDimAnnotationProps;

export const GripDimAnnotationMount = React.memo(function GripDimAnnotationMount(
  props: GripDimAnnotationMountProps,
) {
  useGripDimAnnotation(props);
  return null;
});
