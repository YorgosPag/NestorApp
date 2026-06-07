/**
 * ADR-363 — Wall Tool state-machine types + initial state (extracted from
 * `useWallTool.ts` for N.7.1 file-size compliance). Pure declarations / data —
 * no logic. The hook and its `useWallCommit` sub-hook share these.
 *
 * @see ./useWallTool.ts
 * @see ./use-wall-commit.ts
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity, WallKind } from '../../bim/types/wall-types';
import type { Entity } from '../../types/entities';
import type { WallSource } from '../../bim/walls/wall-from-entity';
import type { RegionLineSeg } from '../../bim/walls/wall-in-region';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';
import type { SceneUnits, WallParamOverrides } from './wall-completion';

// ─── State machine types ─────────────────────────────────────────────────────

export type WallToolPhase =
  | 'idle'
  | 'awaitingStart'
  | 'awaitingEnd'
  | 'awaitingAlignment'
  | 'awaitingCurveControl'
  | 'awaitingNextVertex'
  // ADR-363 Phase 1J — on-entity: source picked (click 1), awaiting side click (click 2).
  | 'awaitingSide';

/**
 * Wall placement mode:
 *   - 'freehand'  — classic click-to-click drawing (straight/curved/polyline).
 *   - 'on-entity' — (Phase 1J) pick an existing 2D entity (line/rectangle), then a side.
 *   - 'in-region' — (Phase 1K) pick 4 lines that close a rectangle (or click inside
 *                   a region / box-select) → ONE wall filling it (length = long side,
 *                   thickness = short side).
 *   - 'outer-perimeter' — («από περίγραμμα») box-select the faces of a structural
 *                   element (rectangle / Γ / Τ / Π) → chain of WallEntity, one per
 *                   straight leg, thickness derived per-leg from the geometry, miter
 *                   joins via the central trim recompute.
 */
export type WallPlacementMode = 'freehand' | 'on-entity' | 'in-region' | 'outer-perimeter';

export interface WallToolState {
  readonly phase: WallToolPhase;
  readonly kind: WallKind;
  readonly placementMode: WallPlacementMode;
  /**
   * ADR-419 — όταν `placementMode === 'in-region'`, ποιον τρόπο δέχεται το εργαλείο:
   * 'lines' (4 γραμμές) / 'inside' (κλικ μέσα) / 'box' (πλαίσιο). Οδηγείται από το
   * active tool id (wall-region-lines/inside/box). Αδιάφορο στα άλλα modes.
   */
  readonly regionMethod: RegionMethod;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly polylineVertices: readonly Point2D[];
  /** ADR-363 Phase 1J — picked 2D entity source (on-entity mode, awaitingSide). */
  readonly pickedSource: WallSource | null;
  /** ADR-363 Phase 1K — accumulated line picks (in-region mode, 4-click flow). */
  readonly regionPicks: readonly RegionLineSeg[];
  readonly overrides: WallParamOverrides;
  readonly error: string | null;
}

export const INITIAL_STATE: WallToolState = {
  phase: 'idle',
  kind: 'straight',
  placementMode: 'freehand',
  regionMethod: 'lines',
  startPoint: null,
  endPoint: null,
  polylineVertices: [],
  pickedSource: null,
  regionPicks: [],
  overrides: {},
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseWallToolOptions {
  /** Callback fired after a `WallEntity` is built & committed. */
  readonly onWallCreated?: (entity: WallEntity) => void;
  /** Layer ID at which the WallEntity is registered. */
  readonly currentLevelId?: string;
  /**
   * Scene units getter (called at commit time so the builder converts the
   * mm-baked defaults into the active scene's units). Defaults to `'mm'`
   * when omitted (back-compat). Mirrors stair `getSceneUnits` contract.
   */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * ADR-363 Phase 1J — live scene entities getter for the on-entity placement
   * mode (hit-test of existing lines/rectangles at click time). Omit ⇒ no
   * source is ever picked (on-entity click becomes a no-op).
   */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseWallToolResult {
  readonly state: WallToolState;
  activate(): void;
  /** Switch active kind (`'straight' | 'curved' | 'polyline'`). Resets the state machine. */
  setKind(kind: WallKind): void;
  /**
   * ADR-363 Phase 1J — switch placement mode (`'freehand' | 'on-entity'`).
   * Resets the state machine (keeps kind + overrides). Driven by the active
   * tool id (`wall` → freehand, `wall-on-entity` → on-entity).
   */
  setPlacementMode(mode: WallPlacementMode): void;
  /** ADR-419 — in-region method ('lines' | 'inside' | 'box'), driven by tool id. */
  setRegionMethod(method: RegionMethod): void;
  deactivate(): void;
  reset(): void;
  /**
   * ADR-363 Phase 1H — incremental ESC: step the straight-wall flow back from
   * `awaitingAlignment` to `awaitingEnd` (drops the picked end, keeps the
   * start) so the user can re-pick the end instead of cancelling the tool.
   * No-op outside `awaitingAlignment`. Returns true if a step-back occurred.
   */
  backToAwaitingEnd(): boolean;
  /** Returns true if the click advanced the state machine. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** Commit-and-finish the polyline chain (Enter key path). Returns true on commit. */
  finishPolyline(): boolean;
  /** Dynamic Input field overrides (category/height/thickness/flip). */
  setParamOverrides(overrides: WallParamOverrides): void;
  /** Status text for status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  /**
   * ADR-363 Phase 1K — entity ids of the currently accumulated in-region line
   * picks (for selection highlight). Empty array outside in-region mode or after
   * a commit clears the picks. Reads the live ref (post-click accurate).
   */
  getRegionPickIds(): string[];
  readonly isActive: boolean;
  readonly isAwaitingStart: boolean;
  readonly isAwaitingEnd: boolean;
  readonly isAwaitingAlignment: boolean;
  readonly isAwaitingCurveControl: boolean;
  readonly isAwaitingNextVertex: boolean;
  /** ADR-363 Phase 1J — on-entity: source picked, awaiting side click. */
  readonly isAwaitingSide: boolean;
}
