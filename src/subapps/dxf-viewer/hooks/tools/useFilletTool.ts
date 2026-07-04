/**
 * USE FILLET TOOL — ADR-510 Φ4e
 *
 * State-machine hook for the AutoCAD-style FILLET command. Two flows:
 *   • two-lines → pick line 1 → pick line 2 → a tangent arc of radius R joins them,
 *                 both lines trimmed back to the tangent points (Trim on by default).
 *   • polyline  → toggle «Polyline» (P) → pick one polyline → EVERY fitting corner
 *                 is rounded with radius R in a single undoable command.
 * Continuous loop until ENTER / ESC / right-click. Mirrors `useOffsetTool`.
 *
 * Keywords: R → start radius entry; T → toggle Trim; P → toggle Polyline mode;
 * U → undo last fillet; digits/`.` → live radius.
 *
 * @module hooks/tools/useFilletTool
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { CornerEntityCommand, type CornerTrimOp } from '../../core/commands/entity-commands/CornerEntityCommand';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { FilletToolStore } from '../../systems/corner/FilletToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import {
  computeFilletTwoLines,
  computeFilletPolyline,
  computeFilletPolylineCorner,
} from '../../systems/corner/fillet-geometry';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
import {
  computeFilletCurve,
  isFilletCurveEntity,
  type FilletCurveEntity,
} from '../../systems/corner/fillet-curve-geometry';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  type Entity,
  type LineEntity,
  type PolylineEntity,
  type LWPolylineEntity,
} from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseFilletToolProps {
  activeTool: string;
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Returns the entity ID hit by `worldPoint` within tolerance (shared with trim/offset). */
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

export interface UseFilletToolReturn {
  isActive: boolean;
  handleFilletClick: (worldPoint: Point2D) => void;
  handleFilletEscape: () => void;
  handleFilletKeyDown: (key: string) => boolean;
}

const KEYWORDS_TRIM = new Set(['t', 'T', 'τ', 'Τ']);
const KEYWORDS_POLYLINE = new Set(['p', 'P', 'π', 'Π']);
const KEYWORDS_RADIUS = new Set(['r', 'R', 'ρ', 'Ρ']);
const KEYWORDS_UNDO = new Set(['u', 'U']);

function findEntity(scene: SceneModel, id: string): Entity | undefined {
  return scene.entities.find((e) => e.id === id) as Entity | undefined;
}

function isLocked(scene: SceneModel, entity: Entity): boolean {
  const layer = entity.layerId ? (scene.layersById ?? {})[entity.layerId] : undefined;
  return layer?.locked === true;
}

export function useFilletTool(props: UseFilletToolProps): UseFilletToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const wasActiveRef = useRef(false);
  const lastCommandRef = useRef<CornerEntityCommand | null>(null);

  const isActive = activeTool === 'fillet';
  const phase = useSyncExternalStore(FilletToolStore.subscribe, () => FilletToolStore.getState().phase);
  const polylineMode = useSyncExternalStore(FilletToolStore.subscribe, () => FilletToolStore.getState().polylineMode);

  // Activation / deactivation lifecycle
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      FilletToolStore.reset();
      ToolCursorStore.set('fillet-pickbox');
    } else if (!isActive && wasActiveRef.current) {
      ToolCursorStore.reset();
      FilletToolStore.reset();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Status-bar prompt sync
  useEffect(() => {
    if (!isActive) {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key = polylineMode
      ? 'filletTool.promptPolyline'
      : phase === 'picking-second'
        ? 'filletTool.promptSecond'
        : 'filletTool.promptFirst';
    toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
    return () => {
      toolHintOverrideStore.setOverride(null);
    };
  }, [isActive, phase, polylineMode]);

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  const commitPolyline = useCallback(
    (scene: SceneModel, poly: PolylineEntity | LWPolylineEntity, worldPoint: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const state = FilletToolStore.getState();
      const result = computeFilletPolyline(poly, state.radius);
      if (!result) return;
      const cmd = new CornerEntityCommand(
        { kind: 'fillet', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: worldPoint },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      FilletToolStore.setLastRadius(state.radius);
      if (result.skipped > 0) {
        toolHintOverrideStore.setOverride(
          i18next.t('tool-hints:filletTool.polylineDone', { filleted: result.filleted, skipped: result.skipped }),
        );
      }
    },
    [getSceneManager, executeCommand],
  );

  const commitTwoLines = useCallback(
    (first: LineEntity, firstPick: Point2D, second: LineEntity, secondPick: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const state = FilletToolStore.getState();
      const result = computeFilletTwoLines(first, firstPick, second, secondPick, state.radius, state.trim, generateEntityId());
      if (!result) return;
      const trims: CornerTrimOp[] = result.trims.map((tr) => ({
        entityId: tr.entityId,
        originalGeom: tr.originalGeom,
        newGeom: tr.newGeom,
      }));
      const cmd = new CornerEntityCommand({ kind: 'fillet', trims, addEntity: result.arc, pickPoint: secondPick }, sm);
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      FilletToolStore.setLastRadius(state.radius);
      FilletToolStore.clearFirst(); // continuous → back to first-line picking
    },
    [getSceneManager, executeCommand],
  );

  const commitCurve = useCallback(
    (first: FilletCurveEntity, firstPick: Point2D, second: FilletCurveEntity, secondPick: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const state = FilletToolStore.getState();
      const result = computeFilletCurve(first, firstPick, second, secondPick, state.radius, state.trim, generateEntityId());
      if (!result) return;
      const cmd = new CornerEntityCommand(
        { kind: 'fillet', trims: result.trims, addEntity: result.arc, pickPoint: secondPick },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      FilletToolStore.setLastRadius(state.radius);
      FilletToolStore.clearFirst(); // continuous → back to first pick
    },
    [getSceneManager, executeCommand],
  );

  const commitPolylineCorner = useCallback(
    (poly: PolylineEntity | LWPolylineEntity, firstPick: Point2D, secondPick: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const cornerIndex = resolveSharedPolylineCorner(poly, firstPick, secondPick);
      if (cornerIndex === null) return; // same or non-adjacent segments — ignore
      const state = FilletToolStore.getState();
      const result = computeFilletPolylineCorner(poly, cornerIndex, state.radius);
      if (!result) return;
      const cmd = new CornerEntityCommand(
        { kind: 'fillet', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: secondPick },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      FilletToolStore.setLastRadius(state.radius);
      FilletToolStore.clearFirst();
    },
    [getSceneManager, executeCommand],
  );

  const performFilletPick = useCallback(
    (worldPoint: Point2D): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId) as SceneModel | null;
      if (!scene) return;
      const hitId = hitTestEntity(worldPoint);
      if (!hitId) return;
      const target = findEntity(scene, hitId);
      if (!target || isLocked(scene, target)) return;
      const state = FilletToolStore.getState();

      // Polyline mode — one pick rounds every fitting corner.
      if (state.polylineMode) {
        if (isPolylineEntity(target) || isLWPolylineEntity(target)) commitPolyline(scene, target, worldPoint);
        return;
      }

      const first = state.first;

      // Same-polyline two-segment fillet (Φ4e.2): both picks on ONE polyline → round the shared corner.
      if (isPolylineEntity(target) || isLWPolylineEntity(target)) {
        if (first && (isPolylineEntity(first) || isLWPolylineEntity(first)) && first.id === target.id) {
          commitPolylineCorner(target, state.firstPick ?? worldPoint, worldPoint);
        } else {
          FilletToolStore.setFirst(target, worldPoint);
        }
        return;
      }

      // Two-entities mode — LINE / ARC / CIRCLE (Φ4e.2 adds arc/circle to the v1 line–line).
      if (!isFilletCurveEntity(target)) return;
      if (state.phase === 'picking-first' || !first) {
        FilletToolStore.setFirst(target, worldPoint);
        return;
      }
      if (target.id === first.id) return; // same entity — ignore
      // First was a polyline but second is a curve → no mixed fillet in v1: restart with the curve.
      if (isPolylineEntity(first) || isLWPolylineEntity(first)) {
        FilletToolStore.setFirst(target, worldPoint);
        return;
      }
      const firstPick = state.firstPick ?? worldPoint;
      // Both lines → the existing tangent-arc-at-corner path; otherwise the curve solver.
      if (isLineEntity(first) && isLineEntity(target)) {
        commitTwoLines(first, firstPick, target, worldPoint);
      } else {
        commitCurve(first, firstPick, target, worldPoint);
      }
    },
    [levelManager, hitTestEntity, commitPolyline, commitTwoLines, commitCurve, commitPolylineCorner],
  );

  const handleFilletClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      performFilletPick(worldPoint);
    },
    [isActive, performFilletPick],
  );

  const handleFilletEscape = useCallback(() => {
    // Two-level escape (Revit-like): first deselect line 1, then exit the tool.
    if (FilletToolStore.getState().phase === 'picking-second') {
      FilletToolStore.clearFirst();
      return;
    }
    FilletToolStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  const handleFilletKeyDown = useCallback(
    (key: string): boolean => {
      if (!isActive) return false;
      // Escape is handled centrally via useCanvasEscapeRegistrations
      // (buildModifyHandler('fillet', handleFilletEscape, …)) — SSoT escape bus.
      if (key === 'Enter') {
        FilletToolStore.reset();
        onToolChange?.('select');
        return true;
      }
      if (/^[0-9]$/.test(key) || key === '.') {
        FilletToolStore.appendTypedChar(key);
        return true;
      }
      if (key === 'Backspace') {
        FilletToolStore.popTypedChar();
        return true;
      }
      if (KEYWORDS_RADIUS.has(key)) {
        FilletToolStore.clearTyped();
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:filletTool.radius'));
        return true;
      }
      if (KEYWORDS_TRIM.has(key)) {
        FilletToolStore.toggleTrim();
        const on = FilletToolStore.getState().trim;
        toolHintOverrideStore.setOverride(i18next.t(`tool-hints:filletTool.${on ? 'trimOn' : 'trimOff'}`));
        return true;
      }
      if (KEYWORDS_POLYLINE.has(key)) {
        FilletToolStore.togglePolylineMode();
        return true;
      }
      if (KEYWORDS_UNDO.has(key)) {
        lastCommandRef.current?.undo();
        lastCommandRef.current = null;
        return true;
      }
      return false;
    },
    [isActive, handleFilletEscape, onToolChange],
  );

  return { isActive, handleFilletClick, handleFilletEscape, handleFilletKeyDown };
}
