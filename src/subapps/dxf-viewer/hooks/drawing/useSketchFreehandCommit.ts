/**
 * useSketchFreehandCommit — ADR-658 M1 commit host for the «Μολύβι» freehand tool.
 *
 * Single-instance hook (mount once, e.g. in DxfViewerContent) that listens for the
 * `sketch:freehand-complete` event, RDP-simplifies the raw pointer trace, and commits
 * a PolylineEntity through the canonical `completeEntity()` → `CreateEntityCommand`
 * SSoT (atomic + undoable). Event-decoupled, mirroring the lasso-crop subscriber —
 * but it emits geometry instead of clipping the scene.
 */
import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { useLevels } from '../../systems/levels';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { simplifyPolyline } from '../../rendering/entities/shared/geometry-polyline-utils';
import { createEntityFromTool } from './drawing-entity-builders';
import { completeEntity } from './completeEntity';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { getSketchFidelityPx } from '../../systems/sketch/sketch-fidelity-store';
import type { Point2D } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';

export function useSketchFreehandCommit(): void {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  useEffect(() => {
    return EventBus.on('sketch:freehand-complete', ({ points, closed }) => {
      if (points.length < 2) return;

      const worldPts: Point2D[] = points.map(([x, y]) => ({ x, y }));
      // D3 — fidelity (screen px) → world tolerance (zoom-independent, Figma pencil pattern).
      const scale = getImmediateTransform().scale || 1;
      const simplified = simplifyPolyline(worldPts, getSketchFidelityPx() / scale);
      if (simplified.length < 2) return;

      // D1/D2 — the builder reads the sketch-output SSoT and returns a plain PolylineEntity
      // («Τεθλασμένη») or a smoothDisplay PolylineEntity («Καμπύλη») from the same points.
      const entity = createEntityFromTool('sketch', simplified, generateEntityId(), false);
      if (!entity) return;
      // D5 — release near the start → closed ring (both output types are polylines).
      if (closed && entity.type === 'polyline') entity.closed = true;

      completeEntity(entity, {
        tool: 'sketch' as ToolType,
        levelId: currentLevelId || '0',
        getScene: getLevelScene,
        setScene: setLevelScene,
      });
    });
  }, [currentLevelId, getLevelScene, setLevelScene]);
}
