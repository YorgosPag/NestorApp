'use client';

/**
 * 🚀 PERF (2026-05-09): Draft polygon rubber-band layer — DOWNSTREAM hook.
 *
 * Subscribes to `useCursorWorldPosition()` (ImmediatePositionStore) so the
 * mousemove-driven re-render stays scoped to the canvas tree. Must be invoked
 * inside a leaf component (CanvasLayerStack) — invoking it in CanvasSection
 * would re-introduce the full-subtree cascade we are eliminating.
 *
 * Computes:
 * - `colorLayersWithDraft`: saved colorLayers + rubber-band draft layer
 * - `draftColorLayer`: the in-progress draft polygon preview (or null)
 *
 * `isNearFirstPoint` is intentionally NOT exposed — it is computed
 * on-demand inside `useCanvasClickHandler` via `getImmediateWorldPosition()`
 * to avoid forcing a click handler dependency on the reactive value.
 */

import { useMemo } from 'react';
import type { ColorLayer } from '../../canvas-v2';
import type { RegionStatus } from '../../types/overlay';
import { UI_COLORS } from '../../config/color-config';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
// ADR-933 — μέθοδος «Ορθογώνια»: το rubber band είναι ΤΟ ΙΔΙΟ ορθογώνιο που θα αποθηκευτεί.
import { overlayDrawSettingsStore } from '../../stores/overlay-draw-settings-store';
import { regionRectangleRing } from '../../overlays/region-rectangle';

export interface UseDraftPolygonLayerProps {
  colorLayers: ColorLayer[];
  draftPolygon: Array<[number, number]>;
  currentStatus: RegionStatus;
  overlayMode: 'select' | 'draw' | 'edit';
  transformScale: number;
}

export interface UseDraftPolygonLayerReturn {
  colorLayersWithDraft: ColorLayer[];
  draftColorLayer: ColorLayer | null;
}

/**
 * Κορυφές της προεπισκόπησης. Πολυγωνική: πρόχειρο + κέρσορας. Ορθογώνια (ADR-933): το
 * ορθογώνιο «1η γωνία → κέρσορας» — η μέθοδος διαβάζεται εδώ με `get()` γιατί το leaf
 * ξαναζωγραφίζει ούτως ή άλλως σε κάθε κίνηση του κέρσορα (καμία νέα συνδρομή).
 */
function buildPreviewVertices(
  draftPolygon: Array<[number, number]>,
  mouseWorld: { x: number; y: number } | null,
  overlayMode: 'select' | 'draw' | 'edit',
): Array<[number, number]> {
  if (!mouseWorld || overlayMode !== 'draw') return draftPolygon;
  if (overlayDrawSettingsStore.get().method === 'rectangle' && draftPolygon.length === 1) {
    return regionRectangleRing(draftPolygon[0], mouseWorld) ?? draftPolygon;
  }
  return [...draftPolygon, [mouseWorld.x, mouseWorld.y]];
}

export function useDraftPolygonLayer(
  props: UseDraftPolygonLayerProps,
): UseDraftPolygonLayerReturn {
  const { colorLayers, draftPolygon, currentStatus, overlayMode, transformScale } = props;
  const mouseWorld = useCursorWorldPosition();

  const isNearFirstPoint = useMemo(() => {
    if (draftPolygon.length < 3 || !mouseWorld) return false;
    const firstPoint = draftPolygon[0];
    const distance = calculateDistance(mouseWorld, { x: firstPoint[0], y: firstPoint[1] });
    return distance < (POLYGON_TOLERANCES.CLOSE_DETECTION / transformScale);
  }, [draftPolygon, mouseWorld, transformScale]);

  const draftColorLayer: ColorLayer | null = useMemo(() => {
    if (draftPolygon.length < 1) return null;

    const fillColor = UI_COLORS.LAYER_DRAFT_FILL;
    const strokeColor = UI_COLORS.LAYER_DRAFT_STROKE;

    const previewVertices = buildPreviewVertices(draftPolygon, mouseWorld, overlayMode);

    return {
      id: 'draft-polygon-preview',
      name: 'Draft Polygon (Preview)',
      color: fillColor,
      opacity: 0.5,
      visible: true,
      zIndex: 999,
      status: currentStatus,
      isDraft: true,
      showGrips: true,
      isNearFirstPoint,
      polygons: [{
        id: 'draft-polygon-preview-0',
        vertices: previewVertices.map(([x, y]) => ({ x, y })),
        fillColor,
        strokeColor,
        strokeWidth: 2,
        selected: false,
      }],
    };
  }, [draftPolygon, currentStatus, isNearFirstPoint, mouseWorld, overlayMode]);

  const colorLayersWithDraft = useMemo(() => {
    return draftColorLayer ? [...colorLayers, draftColorLayer] : colorLayers;
  }, [colorLayers, draftColorLayer]);

  return { colorLayersWithDraft, draftColorLayer };
}

export default useDraftPolygonLayer;
