/**
 * ADR-363 — Wall Tool commit builders (extracted from `useWallTool.ts` for
 * N.7.1 file-size compliance). One sub-hook owns the four build-and-commit
 * paths (straight / curved / polyline / on-entity); behavior is identical to
 * the inlined callbacks — same SSoT builders, same validator-abort semantics,
 * same "reset to awaitingStart" continuous-chain tail.
 *
 * @see ./useWallTool.ts
 * @see ./wall-completion.ts (buildDefaultWallParams / buildWallEntity SSoT)
 * @see ../../bim/walls/wall-from-entity.ts (on-entity geometry bridge)
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { WallEntity } from '../../bim/types/wall-types';
import { buildWallForLine, buildWallsForClosed } from '../../bim/walls/wall-from-entity';
import { buildWallFillingRect, type DetectedRectangle } from '../../bim/walls/wall-in-region';
import { buildDefaultWallParams, buildWallEntity, type SceneUnits } from './wall-completion';
import { INITIAL_STATE, type WallToolState } from './wall-tool-types';

export interface WallCommitContext {
  readonly currentLevelId: string;
  readonly onWallCreated?: (entity: WallEntity) => void;
  readonly getSceneUnits?: () => SceneUnits;
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
}

export interface WallCommitApi {
  /** Straight 3-click commit (start + end + optional lateral alignment point). */
  commitStraightFromState(
    s: WallToolState,
    endPoint: Readonly<Point2D>,
    alignmentPoint?: Readonly<Point2D> | null,
  ): boolean;
  /** Curved 3-click commit (start + end + quadratic Bezier control). */
  commitCurvedFromState(s: WallToolState, controlPoint: Readonly<Point2D>): boolean;
  /** Polyline N-click commit (Enter to finish, ≥2 vertices). */
  commitPolylineFromState(s: WallToolState): boolean;
  /** ADR-363 Phase 1J on-entity commit (pick-side click → wall(s)). */
  commitOnEntity(s: WallToolState, sidePoint: Readonly<Point2D>): boolean;
  /**
   * ADR-363 Phase 1K in-region commit: ONE filling wall per detected rectangle
   * (length = long side, thickness = short side). Multiple rects (box-select).
   * Clears `regionPicks`, stays in-region (continuous chain). Returns true if
   * ≥1 wall was built.
   */
  commitInRegionRects(s: WallToolState, rects: readonly DetectedRectangle[]): boolean;
}

/**
 * Memoized commit builders for the wall tool. Each function mirrors the
 * inlined `useCallback` it replaced, including its dependency array, so the
 * tool's React identity/perf profile is unchanged.
 */
export function useWallCommit(ctx: WallCommitContext): WallCommitApi {
  const { currentLevelId, onWallCreated, getSceneUnits, setState } = ctx;

  // ── commit (straight) ────────────────────────────────────────────────────
  const commitStraightFromState = useCallback(
    (
      s: WallToolState,
      endPoint: Readonly<Point2D>,
      alignmentPoint?: Readonly<Point2D> | null,
    ): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const params = buildDefaultWallParams(
        s.startPoint,
        endPoint,
        s.overrides,
        sceneUnits,
        alignmentPoint,
      );
      const result = buildWallEntity(params, currentLevelId, 'straight', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (curved) ──────────────────────────────────────────────────────
  const commitCurvedFromState = useCallback(
    (s: WallToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultWallParams(s.startPoint, s.endPoint, s.overrides, sceneUnits);
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params = { ...base, curveControl };
      const result = buildWallEntity(params, currentLevelId, 'curved', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (polyline) ────────────────────────────────────────────────────
  const commitPolylineFromState = useCallback(
    (s: WallToolState): boolean => {
      const verts = s.polylineVertices;
      if (verts.length < 2) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const startPt = verts[0];
      const endPt = verts[verts.length - 1];
      const base = buildDefaultWallParams(startPt, endPt, s.overrides, sceneUnits);
      const polylineVertices: Point3D[] = verts.map((v) => ({ x: v.x, y: v.y, z: 0 }));
      const params = { ...base, polylineVertices };
      const result = buildWallEntity(params, currentLevelId, 'polyline', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (on-entity, ADR-363 Phase 1J) ─────────────────────────────────
  /**
   * Commit the on-entity placement from the second (side) click. Line source →
   * one wall; closed source → one wall per perimeter edge. Each built entity is
   * emitted via `onWallCreated` (the caller's `addWallToScene` recomputes miter
   * joins across all walls). Returns to `awaitingStart` (continuous chain).
   */
  const commitOnEntity = useCallback(
    (s: WallToolState, sidePoint: Readonly<Point2D>): boolean => {
      if (!s.pickedSource) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      if (s.pickedSource.kind === 'line') {
        const entity = buildWallForLine(
          s.pickedSource.start,
          s.pickedSource.end,
          sidePoint,
          s.overrides,
          sceneUnits,
          currentLevelId,
        );
        if (entity) onWallCreated?.(entity);
      } else {
        const walls = buildWallsForClosed(
          s.pickedSource.polygon,
          sidePoint,
          s.overrides,
          sceneUnits,
          currentLevelId,
        );
        for (const w of walls) onWallCreated?.(w);
      }
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        placementMode: s.placementMode,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (in-region, ADR-363 Phase 1K) ─────────────────────────────────
  const commitInRegionRects = useCallback(
    (s: WallToolState, rects: readonly DetectedRectangle[]): boolean => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      let built = 0;
      for (const rect of rects) {
        const entity = buildWallFillingRect(rect, s.overrides, sceneUnits, currentLevelId);
        if (entity) {
          onWallCreated?.(entity);
          built++;
        }
      }
      if (built === 0) {
        // Validator rejected every rect (e.g. short side > MAX_WALL_THICKNESS_MM).
        setState({ ...s, regionPicks: [], error: 'wall.validation.hardErrors.thicknessExceedsMax' });
        return false;
      }
      setState({
        ...INITIAL_STATE,
        kind: s.kind,
        placementMode: s.placementMode,
        overrides: s.overrides,
        phase: 'awaitingStart',
      });
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  return {
    commitStraightFromState,
    commitCurvedFromState,
    commitPolylineFromState,
    commitOnEntity,
    commitInRegionRects,
  };
}
