'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-408 Φ15 Task B — cross-floor «riser through» 2D overlay (Revit «cut plane»).
 *
 * Dedicated **read-only** overlay canvas που ζωγραφίζει, πάνω στον ΕΝΕΡΓΟ όροφο,
 * το plan glyph (κύκλος + up/down βέλος) κάθε κατακόρυφης στήλης (`mep-segment`
 * riser) ΑΛΛΟΥ ορόφου της οποίας το z-span διαπερνά το FFL του ενεργού ορόφου.
 * Single source = οι base-floor risers· εδώ τα σύμβολα είναι **derived** (zero
 * duplicate persistence). Έτσι ο μηχανικός βλέπει ότι μια στήλη περνά από το
 * επίπεδό του, ακριβώς όπως στη Revit.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (ViewMode3DStore mode + cross-floor
 * sourcing via `useBuildingFloorScenes`). Ο shell `CanvasLayerStack` δεν αποκτά
 * νέο `useSyncExternalStore` (CHECK 6C safe). Repaint σε αλλαγή
 * marks/transform/viewport (anchored στο world μέσω transform → pan/zoom redraw,
 * σταθερό μέγεθος glyph σε screen px).
 *
 * **Selection/persistence isolation:** ξεχωριστό canvas ΧΩΡΙΣ hit-test handlers +
 * `pointer-events-none` — αδύνατο να επιλεγεί/μετακινηθεί entity άλλου ορόφου.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ15
 */

import { useEffect, useMemo, useRef } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useBuildingFloorScenes } from '../../hooks/data/useBuildingFloorScenes';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../bim-3d/scene/floor-stack-elevation';
import {
  deriveRisersThroughFloor,
  type RiserThroughMark,
} from '../../bim/mep-segments/derive-risers-through-floor';
import {
  buildRiserSymbol,
  drawRiserSymbol,
  RISER_SYMBOL_RADIUS_PX,
} from '../../bim/mep-segments/mep-riser-symbol';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { isMepSegmentEntity } from '../../types/entities';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

/** Fallback glyph colour when the riser has no system classification (copper/pipe). */
const RISER_THROUGH_DEFAULT_COLOR = '#b45309';

export interface RiserThroughOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

export function RiserThroughOverlay({ transform, viewport }: RiserThroughOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscription (ADR-040): render mode. Through-risers show in any 2D scope
  // — a stack that crosses the current floor must read even in single-floor view.
  const mode = useViewMode3DStore((s) => s.mode);
  const active = mode === '2d';

  // Active level → building + floor (for the FFL the risers are tested against).
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const activeLevel = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId) ?? null : null),
    [active, levels, currentLevelId],
  );
  const buildingId = activeLevel?.buildingId ?? null;
  const activeFloorId = activeLevel?.floorId ?? null;

  // Canonical storey elevations (SAME Firestore source as the floor tabs / 3D stack).
  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, active);

  // Datum-relative FFL (mm) of the active floor — the cut plane for the riser test.
  const currentFloorElevMm = useMemo(() => {
    if (!activeFloorId) return null;
    const datumM = resolveBuildingDatumElevationM(buildingFloors);
    const elevM = buildingFloors.find((f) => f.id === activeFloorId)?.elevation ?? 0;
    return resolveFloorDatumRelativeElevationMm(elevM, datumM);
  }, [activeFloorId, buildingFloors]);

  // Raw SceneModels of the OTHER building floors (shared sourcing SSoT).
  const otherFloors = useBuildingFloorScenes(active);

  // Derive one mark per cross-floor riser passing through the active FFL.
  const marks = useMemo<readonly RiserThroughMark[]>(() => {
    if (!active || currentFloorElevMm === null) return [];
    const out: RiserThroughMark[] = [];
    for (const f of otherFloors) {
      const segments = f.model.entities.filter(isMepSegmentEntity);
      out.push(...deriveRisersThroughFloor(segments, currentFloorElevMm));
    }
    return out;
  }, [active, currentFloorElevMm, otherFloors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR-aware backing store sized from the authoritative viewport (mirror of
    // FloorUnderlayOverlay / DxfCanvas).
    const dpr = getDevicePixelRatio();
    const w = Math.max(1, Math.round(viewport.width * dpr));
    const h = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!active || marks.length === 0) return;

    ctx.save();
    ctx.setLineDash([]);
    for (const mark of marks) {
      const centre = CoordinateTransforms.worldToScreen(mark.centreXY, transform, viewport);
      const symbol = buildRiserSymbol(centre, RISER_SYMBOL_RADIUS_PX, mark.direction);
      const color = resolveSegmentClassificationColor(mark.classification) ?? RISER_THROUGH_DEFAULT_COLOR;
      drawRiserSymbol(ctx, symbol, color, RENDER_LINE_WIDTHS.NORMAL);
    }
    ctx.restore();
  }, [active, marks, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="riser-through"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
