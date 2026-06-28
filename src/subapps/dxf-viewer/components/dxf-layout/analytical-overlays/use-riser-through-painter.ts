/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-408 Φ15 Task B — cross-floor «riser through» glyphs, ως analytical painter
 * (ADR-552 dispatch). Πηγή λογικής: ο πρώην `RiserThroughOverlay.tsx` (verbatim paint).
 *
 * Plan glyph (κύκλος + up/down βέλος) κάθε κατακόρυφης στήλης (`mep-segment` riser)
 * ΑΛΛΟΥ ορόφου της οποίας το z-span διαπερνά το FFL του ενεργού ορόφου. Derived —
 * single source = οι base-floor risers (zero duplicate persistence). Self-gated σε
 * `mode==='2d'` (through-risers δείχνουν σε κάθε 2D scope).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ15
 */

import { useMemo } from 'react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useBuildingFloorScenes } from '../../../hooks/data/useBuildingFloorScenes';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../../bim-3d/scene/floor-stack-elevation';
import {
  deriveRisersThroughFloor,
  type RiserThroughMark,
} from '../../../bim/mep-segments/derive-risers-through-floor';
import {
  buildRiserSymbol,
  drawRiserSymbol,
  RISER_SYMBOL_RADIUS_PX,
} from '../../../bim/mep-segments/mep-riser-symbol';
import { resolveSegmentClassificationColor } from '../../../bim/mep-systems/mep-system-color';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { isMepSegmentEntity } from '../../../types/entities';
import type { AnalyticalPainter } from './analytical-painter';

/** Fallback glyph colour when the riser has no system classification (copper/pipe). */
const RISER_THROUGH_DEFAULT_COLOR = '#b45309';

/** Riser-through analytical painter (`null` όταν ανενεργό/κενό). */
export function useRiserThroughPainter(): AnalyticalPainter | null {
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

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || marks.length === 0) return null;
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      for (const mark of marks) {
        const centre = CoordinateTransforms.worldToScreen(mark.centreXY, transform, viewport);
        const symbol = buildRiserSymbol(centre, RISER_SYMBOL_RADIUS_PX, mark.direction);
        const color = resolveSegmentClassificationColor(mark.classification) ?? RISER_THROUGH_DEFAULT_COLOR;
        drawRiserSymbol(ctx, symbol, color, RENDER_LINE_WIDTHS.NORMAL);
      }
      ctx.restore();
    };
  }, [active, marks]);
}
