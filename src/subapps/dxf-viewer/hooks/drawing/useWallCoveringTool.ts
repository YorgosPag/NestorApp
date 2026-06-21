/**
 * ADR-511 — Wall-Covering Tool React Hook Orchestrator.
 *
 * State machine (manual «διάλεξε τοίχο → πλευρά → span»):
 *   idle → awaitingWall → awaitingSpanEnd → (commit) → awaitingWall (continuous)
 *
 *   - 1ο κλικ: `pickWallFaceFromPoint` → κλειδώνει host τοίχο + παρειά (inner/outer) +
 *     spanStart (διαμήκης θέση). Γράφει το draw-context στο `wallCoveringPreviewStore`
 *     ώστε ο generator να δείχνει τη ζωντανή λωρίδα προς τον cursor.
 *   - 2ο κλικ: `alongMmOnWall` στον ΙΔΙΟ τοίχο → spanEnd → build + commit. Συνεχής αλυσίδα.
 *
 * SSoT: entity build μέσω `buildDefaultWallCoveringParams`/`buildWallCoveringEntity`
 * (`wall-covering-completion.ts`). Pick + projection μέσω `wall-covering-pick.ts`.
 * ADR-040 micro-leaf: hook owns React state, no `useSyncExternalStore` σε high-freq stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see hooks/drawing/useFloorFinishTool.ts — το πρότυπο (lifecycle/preview-store pattern)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { WallCoveringEntity, WallCoveringFaceSide } from '../../bim/types/wall-covering-types';
import {
  buildDefaultWallCoveringParams,
  buildWallCoveringEntity,
  type WallCoveringParamOverrides,
  type SceneUnits,
} from './wall-covering-completion';
import {
  pickWallFaceFromPoint,
  alongMmOnWall,
} from '../../bim/wall-coverings/wall-covering-pick';
import type { WallCoveringHost } from '../../bim/wall-coverings/wall-covering-strip-geometry';
import { wallCoveringPreviewStore } from '../../bim/wall-coverings/wall-covering-preview-store';
import { DEFAULT_WALL_COVERING_LAYERS } from '../../bim/types/wall-covering-types';

// ─── State machine types ─────────────────────────────────────────────────────

export type WallCoveringToolPhase = 'idle' | 'awaitingWall' | 'awaitingSpanEnd';

interface LockedFace {
  readonly host: WallCoveringHost;
  readonly faceSide: WallCoveringFaceSide;
  readonly spanStartMm: number;
}

export interface WallCoveringToolState {
  readonly phase: WallCoveringToolPhase;
  readonly locked: LockedFace | null;
  readonly overrides: WallCoveringParamOverrides;
  readonly error: string | null;
}

const INITIAL_STATE: WallCoveringToolState = {
  phase: 'idle',
  locked: null,
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseWallCoveringToolOptions {
  /** Callback μετά από επιτυχές build + commit. */
  readonly onWallCoveringCreated?: (entity: WallCoveringEntity) => void;
  /** Layer ID στο οποίο γράφεται το νέο covering. */
  readonly currentLevelId?: string;
  /** Live walls (host candidates) από τη σκηνή. */
  readonly getWalls?: () => readonly WallCoveringHost[];
  /** Active scene units. Default 'mm'. */
  readonly getSceneUnits?: () => SceneUnits;
}

export interface UseWallCoveringToolResult {
  readonly state: WallCoveringToolState;
  activate(): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click προχώρησε το FSM. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Dynamic Input field overrides (assembly / height / name). */
  setParamOverrides(overrides: WallCoveringParamOverrides): void;
  /** Status text key για status-bar / Dynamic Input prompt. */
  getStatusText(): string;
  readonly isActive: boolean;
}

// ─── Hook implementation ─────────────────────────────────────────────────────

export function useWallCoveringTool(options: UseWallCoveringToolOptions = {}): UseWallCoveringToolResult {
  const { onWallCoveringCreated, currentLevelId = '0', getWalls, getSceneUnits } = options;

  const [state, setState] = useState<WallCoveringToolState>(INITIAL_STATE);
  const stateRef = useRef<WallCoveringToolState>(state);
  stateRef.current = state;

  // ── live preview — single-writer into wallCoveringPreviewStore (draw-context). ──
  useEffect(() => {
    if (state.phase === 'awaitingSpanEnd' && state.locked) {
      wallCoveringPreviewStore.set({
        host: state.locked.host,
        faceSide: state.locked.faceSide,
        spanStartMm: state.locked.spanStartMm,
        layers: state.overrides.layers && state.overrides.layers.length > 0
          ? state.overrides.layers
          : DEFAULT_WALL_COVERING_LAYERS,
        sceneUnits: getSceneUnits?.() ?? 'mm',
      });
    } else {
      wallCoveringPreviewStore.reset();
    }
  }, [state, getSceneUnits]);
  useEffect(() => () => wallCoveringPreviewStore.reset(), []);

  // ── lifecycle ────────────────────────────────────────────────────────────
  const activate = useCallback(() => {
    setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingWall' }));
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...INITIAL_STATE,
      overrides: prev.overrides,
      phase: prev.phase === 'idle' ? 'idle' : 'awaitingWall',
    }));
  }, []);

  const setParamOverrides = useCallback((overrides: WallCoveringParamOverrides) => {
    setState((prev) => ({ ...prev, overrides: { ...prev.overrides, ...overrides } }));
  }, []);

  // ── commit (2ο κλικ) ──────────────────────────────────────────────────────
  const commitSpanEnd = useCallback(
    (locked: LockedFace, point: Readonly<Point2D>): boolean => {
      const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
      const spanEndMm = alongMmOnWall(locked.host, point, sceneUnits);
      if (spanEndMm === null) return false;
      const params = buildDefaultWallCoveringParams(
        {
          hostWallId: locked.host.id,
          faceSide: locked.faceSide,
          spanStartMm: locked.spanStartMm,
          spanEndMm,
        },
        stateRef.current.overrides,
        sceneUnits,
      );
      const result = buildWallCoveringEntity(params, currentLevelId, locked.host);
      if (!result.ok) {
        setState((prev) => ({ ...prev, error: result.hardErrors[0] ?? null }));
        return false;
      }
      onWallCoveringCreated?.(result.entity);
      setState((prev) => ({ ...INITIAL_STATE, overrides: prev.overrides, phase: 'awaitingWall' }));
      return true;
    },
    [currentLevelId, onWallCoveringCreated, getSceneUnits],
  );

  // ── click pipeline ───────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (point: Readonly<Point2D>): boolean => {
      const s = stateRef.current;
      if (s.phase === 'idle') return false;

      if (s.phase === 'awaitingWall') {
        const walls = getWalls?.() ?? [];
        const sceneUnits: SceneUnits = getSceneUnits?.() ?? 'mm';
        const pick = pickWallFaceFromPoint(point, walls, { sceneUnits });
        if (!pick) {
          setState((prev) => ({ ...prev, error: 'wall-covering.error.noWallPicked' }));
          return false;
        }
        setState((prev) => ({
          ...prev,
          phase: 'awaitingSpanEnd',
          locked: { host: pick.wall, faceSide: pick.faceSide, spanStartMm: pick.alongMm },
          error: null,
        }));
        return true;
      }

      if (s.phase === 'awaitingSpanEnd' && s.locked) {
        return commitSpanEnd(s.locked, point);
      }
      return false;
    },
    [getWalls, getSceneUnits, commitSpanEnd],
  );

  // ── status text (i18n keys) ──────────────────────────────────────────────
  const getStatusText = useCallback((): string => {
    switch (stateRef.current.phase) {
      case 'awaitingWall':
        return 'tools.wallCovering.statusPickWall';
      case 'awaitingSpanEnd':
        return 'tools.wallCovering.statusSpanEnd';
      default:
        return '';
    }
  }, []);

  return {
    state,
    activate,
    deactivate,
    reset,
    onCanvasClick,
    setParamOverrides,
    getStatusText,
    isActive: state.phase !== 'idle',
  };
}
