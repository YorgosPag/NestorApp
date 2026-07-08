/**
 * USE CHAMFER TOOL — ADR-510 Φ4f
 *
 * State-machine hook for the AutoCAD-style CHAMFER command. Two flows:
 *   • two-lines → pick line 1 → pick line 2 → a straight bevel joins them, both
 *                 lines trimmed back to the bevel endpoints (Trim on by default).
 *   • polyline  → toggle «Polyline» (P) → pick one polyline → EVERY fitting corner
 *                 is beveled (d1,d2) in a single undoable command.
 * Continuous loop until ENTER / ESC / right-click. Mirrors `useFilletTool`.
 *
 * Keywords: D → distance mode; A → angle mode; T → toggle Trim; P → toggle Polyline;
 * U → undo last chamfer; digits/`.` → live distance (symmetric) or angle.
 *
 * @module hooks/tools/useChamferTool
 */

import { useCallback, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { ChamferToolStore } from '../../systems/corner/ChamferToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import { computeChamferTwoLines, computeChamferPolyline, computeChamferPolylineCorner } from '../../systems/corner/chamfer-geometry';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  type LineEntity,
  type PolylineEntity,
  type LWPolylineEntity,
} from '../../types/entities';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
import { useToolHintPrompt } from './useToolHintPrompt';
import { resolveCornerTarget, executeCornerCommand, toCornerTrimOps, useCornerCommandRef, type CornerToolProps, CORNER_KEYWORDS_TRIM, CORNER_KEYWORDS_POLYLINE, CORNER_KEYWORDS_UNDO } from './corner-tool-core';

export type UseChamferToolProps = CornerToolProps;

export interface UseChamferToolReturn {
  isActive: boolean;
  handleChamferClick: (worldPoint: Point2D) => void;
  handleChamferEscape: () => void;
  handleChamferKeyDown: (key: string) => boolean;
}

// Tool-specific keys; TRIM / POLYLINE / UNDO come from the shared corner-tool-core SSoT.
const KEYWORDS_DISTANCE = new Set(['d', 'D', 'δ', 'Δ']);
const KEYWORDS_ANGLE = new Set(['a', 'A', 'γ', 'Γ']);

export function useChamferTool(props: UseChamferToolProps): UseChamferToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const lastCommandRef = useCornerCommandRef();

  const isActive = activeTool === 'chamfer';
  const phase = useSyncExternalStore(ChamferToolStore.subscribe, () => ChamferToolStore.getState().phase);
  const polylineMode = useSyncExternalStore(ChamferToolStore.subscribe, () => ChamferToolStore.getState().polylineMode);

  // Activation / deactivation lifecycle (ADR-589 edge-triggered SSoT)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      ChamferToolStore.reset();
      ToolCursorStore.set('chamfer-pickbox');
    },
    () => {
      ToolCursorStore.reset();
      ChamferToolStore.reset();
    },
  );

  // Status-bar prompt sync (ADR-589 SSoT)
  useToolHintPrompt(
    isActive,
    polylineMode
      ? 'chamferTool.promptPolyline'
      : phase === 'picking-second'
        ? 'chamferTool.promptSecond'
        : 'chamferTool.promptFirst',
  );

  const getSceneManager = useSceneManagerAdapter(levelManager);

  // Store bookkeeping shared by the two-lines / polyline-corner commits: remember the
  // distances and loop back to first-pick. Runs only after a command actually executed.
  const commitTail = useCallback(() => {
    const st = ChamferToolStore.getState();
    ChamferToolStore.setLastDistances(st.d1, st.d2);
    ChamferToolStore.clearFirst();
  }, []);

  const commitPolyline = useCallback(
    (poly: PolylineEntity | LWPolylineEntity, worldPoint: Point2D): void => {
      const s = ChamferToolStore.getState();
      const result = computeChamferPolyline(poly, s.d1, s.d2);
      if (!result) return;
      executeCornerCommand(
        getSceneManager,
        { kind: 'chamfer', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: worldPoint },
        executeCommand, lastCommandRef,
        () => {
          ChamferToolStore.setLastDistances(s.d1, s.d2);
          if (result.skipped > 0) {
            toolHintOverrideStore.setOverride(
              i18next.t('tool-hints:chamferTool.polylineDone', { chamfered: result.chamfered, skipped: result.skipped }),
            );
          }
        },
      );
    },
    [getSceneManager, executeCommand],
  );

  const commitTwoLines = useCallback(
    (first: LineEntity, firstPick: Point2D, second: LineEntity, secondPick: Point2D): void => {
      const s = ChamferToolStore.getState();
      const result = computeChamferTwoLines(
        first, firstPick, second, secondPick, s.d1, s.d2, s.angle, s.mode, s.trim, generateEntityId(),
      );
      if (!result) return;
      executeCornerCommand(
        getSceneManager,
        { kind: 'chamfer', trims: toCornerTrimOps(result.trims), addEntity: result.bevel, pickPoint: secondPick },
        executeCommand, lastCommandRef, commitTail,
      );
    },
    [getSceneManager, executeCommand, commitTail],
  );

  const commitPolylineCorner = useCallback(
    (poly: PolylineEntity | LWPolylineEntity, firstPick: Point2D, secondPick: Point2D): void => {
      const cornerIndex = resolveSharedPolylineCorner(poly, firstPick, secondPick);
      if (cornerIndex === null) return; // same or non-adjacent segments — ignore
      const s = ChamferToolStore.getState();
      const result = computeChamferPolylineCorner(poly, cornerIndex, s.d1, s.d2);
      if (!result) return;
      executeCornerCommand(
        getSceneManager,
        { kind: 'chamfer', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: secondPick },
        executeCommand, lastCommandRef, commitTail,
      );
    },
    [getSceneManager, executeCommand, commitTail],
  );

  const performChamferPick = useCallback(
    (worldPoint: Point2D): void => {
      const resolved = resolveCornerTarget(levelManager, hitTestEntity, worldPoint);
      if (!resolved) return;
      const { target } = resolved;
      const s = ChamferToolStore.getState();

      // Polyline mode — one pick bevels every fitting corner.
      if (s.polylineMode) {
        if (isPolylineEntity(target) || isLWPolylineEntity(target)) commitPolyline(target, worldPoint);
        return;
      }

      const first = s.first;

      // Same-polyline two-segment chamfer (Φ4f.2): both picks on ONE polyline → bevel the shared corner.
      if (isPolylineEntity(target) || isLWPolylineEntity(target)) {
        if (first && (isPolylineEntity(first) || isLWPolylineEntity(first)) && first.id === target.id) {
          commitPolylineCorner(target, s.firstPick ?? worldPoint, worldPoint);
        } else {
          ChamferToolStore.setFirst(target, worldPoint);
        }
        return;
      }

      // Two-lines mode — LINE entities (arcs/circles are NOT chamfer-able, AutoCAD).
      if (!isLineEntity(target)) return;
      if (s.phase === 'picking-first' || !first) {
        ChamferToolStore.setFirst(target, worldPoint);
        return;
      }
      if (target.id === first.id) return; // same entity — ignore
      // First was a polyline but second is a line → no mixed chamfer in v1: restart with the line.
      if (isPolylineEntity(first) || isLWPolylineEntity(first)) {
        ChamferToolStore.setFirst(target, worldPoint);
        return;
      }
      commitTwoLines(first, s.firstPick ?? worldPoint, target, worldPoint);
    },
    [levelManager, hitTestEntity, commitPolyline, commitTwoLines, commitPolylineCorner],
  );

  const handleChamferClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      performChamferPick(worldPoint);
    },
    [isActive, performChamferPick],
  );

  const handleChamferEscape = useCallback(() => {
    if (ChamferToolStore.getState().phase === 'picking-second') {
      ChamferToolStore.clearFirst();
      return;
    }
    ChamferToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  const handleChamferKeyDown = useCallback(
    (key: string): boolean => {
      if (!isActive) return false;
      // Escape is handled centrally via useCanvasEscapeRegistrations
      // (buildModifyHandler('chamfer', handleChamferEscape, …)) — SSoT escape bus.
      if (key === 'Enter') {
        ChamferToolStore.reset();
        onToolChange?.('select');
        return true;
      }
      if (/^[0-9]$/.test(key) || key === '.') {
        ChamferToolStore.appendTypedChar(key);
        return true;
      }
      if (key === 'Backspace') {
        ChamferToolStore.popTypedChar();
        return true;
      }
      if (KEYWORDS_DISTANCE.has(key)) {
        ChamferToolStore.setMode('distance');
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:chamferTool.distanceMode'));
        return true;
      }
      if (KEYWORDS_ANGLE.has(key)) {
        ChamferToolStore.setMode('angle');
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:chamferTool.angleMode'));
        return true;
      }
      if (CORNER_KEYWORDS_TRIM.has(key)) {
        ChamferToolStore.toggleTrim();
        const on = ChamferToolStore.getState().trim;
        toolHintOverrideStore.setOverride(i18next.t(`tool-hints:chamferTool.${on ? 'trimOn' : 'trimOff'}`));
        return true;
      }
      if (CORNER_KEYWORDS_POLYLINE.has(key)) {
        ChamferToolStore.togglePolylineMode();
        return true;
      }
      if (CORNER_KEYWORDS_UNDO.has(key)) {
        lastCommandRef.current?.undo();
        lastCommandRef.current = null;
        return true;
      }
      return false;
    },
    [isActive, handleChamferEscape, onToolChange],
  );

  return { isActive, handleChamferClick, handleChamferEscape, handleChamferKeyDown };
}
