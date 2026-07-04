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

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import i18next from 'i18next';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { CornerEntityCommand, type CornerTrimOp } from '../../core/commands/entity-commands/CornerEntityCommand';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { ChamferToolStore } from '../../systems/corner/ChamferToolStore';
import { ToolCursorStore } from '../../systems/cursor/ToolCursorStore';
import { computeChamferTwoLines, computeChamferPolyline, computeChamferPolylineCorner } from '../../systems/corner/chamfer-geometry';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
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

export interface UseChamferToolProps {
  activeTool: string;
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

export interface UseChamferToolReturn {
  isActive: boolean;
  handleChamferClick: (worldPoint: Point2D) => void;
  handleChamferEscape: () => void;
  handleChamferKeyDown: (key: string) => boolean;
}

const KEYWORDS_TRIM = new Set(['t', 'T', 'τ', 'Τ']);
const KEYWORDS_POLYLINE = new Set(['p', 'P', 'π', 'Π']);
const KEYWORDS_DISTANCE = new Set(['d', 'D', 'δ', 'Δ']);
const KEYWORDS_ANGLE = new Set(['a', 'A', 'γ', 'Γ']);
const KEYWORDS_UNDO = new Set(['u', 'U']);

function findEntity(scene: SceneModel, id: string): Entity | undefined {
  return scene.entities.find((e) => e.id === id) as Entity | undefined;
}

function isLocked(scene: SceneModel, entity: Entity): boolean {
  const layer = entity.layerId ? (scene.layersById ?? {})[entity.layerId] : undefined;
  return layer?.locked === true;
}

export function useChamferTool(props: UseChamferToolProps): UseChamferToolReturn {
  const { activeTool, levelManager, executeCommand, hitTestEntity, onToolChange } = props;
  const wasActiveRef = useRef(false);
  const lastCommandRef = useRef<CornerEntityCommand | null>(null);

  const isActive = activeTool === 'chamfer';
  const phase = useSyncExternalStore(ChamferToolStore.subscribe, () => ChamferToolStore.getState().phase);
  const polylineMode = useSyncExternalStore(ChamferToolStore.subscribe, () => ChamferToolStore.getState().polylineMode);

  // Activation / deactivation lifecycle
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      ChamferToolStore.reset();
      ToolCursorStore.set('chamfer-pickbox');
    } else if (!isActive && wasActiveRef.current) {
      ToolCursorStore.reset();
      ChamferToolStore.reset();
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
      ? 'chamferTool.promptPolyline'
      : phase === 'picking-second'
        ? 'chamferTool.promptSecond'
        : 'chamferTool.promptFirst';
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
    (poly: PolylineEntity | LWPolylineEntity, worldPoint: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const s = ChamferToolStore.getState();
      const result = computeChamferPolyline(poly, s.d1, s.d2);
      if (!result) return;
      const cmd = new CornerEntityCommand(
        { kind: 'chamfer', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: worldPoint },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      ChamferToolStore.setLastDistances(s.d1, s.d2);
      if (result.skipped > 0) {
        toolHintOverrideStore.setOverride(
          i18next.t('tool-hints:chamferTool.polylineDone', { chamfered: result.chamfered, skipped: result.skipped }),
        );
      }
    },
    [getSceneManager, executeCommand],
  );

  const commitTwoLines = useCallback(
    (first: LineEntity, firstPick: Point2D, second: LineEntity, secondPick: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const s = ChamferToolStore.getState();
      const result = computeChamferTwoLines(
        first, firstPick, second, secondPick, s.d1, s.d2, s.angle, s.mode, s.trim, generateEntityId(),
      );
      if (!result) return;
      const trims: CornerTrimOp[] = result.trims.map((tr) => ({
        entityId: tr.entityId,
        originalGeom: tr.originalGeom,
        newGeom: tr.newGeom,
      }));
      const cmd = new CornerEntityCommand({ kind: 'chamfer', trims, addEntity: result.bevel, pickPoint: secondPick }, sm);
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      ChamferToolStore.setLastDistances(s.d1, s.d2);
      ChamferToolStore.clearFirst(); // continuous → back to first-line picking
    },
    [getSceneManager, executeCommand],
  );

  const commitPolylineCorner = useCallback(
    (poly: PolylineEntity | LWPolylineEntity, firstPick: Point2D, secondPick: Point2D): void => {
      const sm = getSceneManager();
      if (!sm) return;
      const cornerIndex = resolveSharedPolylineCorner(poly, firstPick, secondPick);
      if (cornerIndex === null) return; // same or non-adjacent segments — ignore
      const s = ChamferToolStore.getState();
      const result = computeChamferPolylineCorner(poly, cornerIndex, s.d1, s.d2);
      if (!result) return;
      const cmd = new CornerEntityCommand(
        { kind: 'chamfer', trims: [{ entityId: poly.id, originalGeom: poly, newGeom: result.entity }], addEntity: null, pickPoint: secondPick },
        sm,
      );
      executeCommand(cmd);
      lastCommandRef.current = cmd;
      ChamferToolStore.setLastDistances(s.d1, s.d2);
      ChamferToolStore.clearFirst();
    },
    [getSceneManager, executeCommand],
  );

  const performChamferPick = useCallback(
    (worldPoint: Point2D): void => {
      if (!levelManager.currentLevelId) return;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId) as SceneModel | null;
      if (!scene) return;
      const hitId = hitTestEntity(worldPoint);
      if (!hitId) return;
      const target = findEntity(scene, hitId);
      if (!target || isLocked(scene, target)) return;
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
      if (KEYWORDS_TRIM.has(key)) {
        ChamferToolStore.toggleTrim();
        const on = ChamferToolStore.getState().trim;
        toolHintOverrideStore.setOverride(i18next.t(`tool-hints:chamferTool.${on ? 'trimOn' : 'trimOff'}`));
        return true;
      }
      if (KEYWORDS_POLYLINE.has(key)) {
        ChamferToolStore.togglePolylineMode();
        return true;
      }
      if (KEYWORDS_UNDO.has(key)) {
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
