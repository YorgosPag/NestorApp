/**
 * ADR-362 Phase D1 — Pure state machine for the dimension creation flow.
 *
 * No React, no stores, no I/O. Pure `state + action → state` reducer feeding
 * the `DimensionCreateStore` external store + `useDimensionCreate` hook.
 *
 * Modes:
 *   - 'smart'  — Smart DIM tool. `detectDimensionType` (Phase C2) drives
 *                `currentType` from hover + first-click context + Tab/Space
 *                cycles. Falls back to `'linear'` when click 1 has no hover.
 *   - 'manual' — Ribbon manual overrides (`dim-linear` / `dim-aligned` /
 *                `dim-angular2L` / `dim-angular3P`). `manualOverride` feeds the
 *                detector at Tier 1 so the type stays pinned regardless of
 *                hover/cycle counters.
 *
 * Per-type click counts (see ADR-362 §3 D4 + §7 Phase C1 changelog):
 *   - linear/aligned   → 3 clicks: extOrigin1, extOrigin2, dimLineRef
 *   - angular2L        → 3 clicks: line1 pick, line2 pick, arcPoint
 *   - angular3P        → 4 clicks: vertex, ray1End, ray2End, arcPoint
 *
 * `defPoints` derivation lives in `dimension-create-entity-builder.ts` so the
 * reducer stays focused on state transitions. Real ID generation /
 * `DimensionAssociation` materialisation live in the hook (side effects).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionType } from '../../types/dimension';
import type { ExtendedSnapType } from '../../snapping/extended-types';
import {
  detectDimensionType,
  type DetectableEntity,
} from '../../systems/dimensions/dim-smart-detector';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export type DimensionCreateMode = 'smart' | 'manual' | 'entity';

/** Reducer lifecycle phase — drives the hook's commit / preview decisions. */
export type DimensionCreateStatus = 'idle' | 'collecting' | 'commit-ready';

/** Single user click during dim creation — geometry pick + association seed. */
export interface ClickRecord {
  readonly world: Point2D;
  /** Entity under cursor at click time (drives D11 associativity). */
  readonly pickedEntity?: DetectableEntity;
  /**
   * ADR-362 Phase J3 (gap #2) — active snap mode at click time. Lets the
   * association capture distinguish an `intersection` OSNAP (→ 2-host anchor)
   * from a generic `nearest` pick (→ parametric anchor).
   */
  readonly snapMode?: ExtendedSnapType;
  /**
   * ADR-362 Phase J3 (gap #2) — second host entity when the click snapped to an
   * `intersection` (the curve crossing `pickedEntity` at `world`).
   */
  readonly pickedEntity2?: DetectableEntity;
}

export interface DimensionCreateState {
  readonly status: DimensionCreateStatus;
  readonly mode: DimensionCreateMode | null;
  /** Active type — null while idle or before smart mode has anything to suggest. */
  readonly currentType: DimensionType | null;
  /** Tier-1 detector override (set when mode === 'manual'). */
  readonly manualOverride: DimensionType | null;
  /** Active DIMSTYLE id resolved at `start` time (kept stable for the session). */
  readonly styleId: string | null;
  readonly clicks: readonly ClickRecord[];
  readonly cursorWorld: Point2D | null;
  readonly hoveredEntity: DetectableEntity | null;
  readonly spacePressCount: number;
  readonly tabPressCount: number;
  /**
   * Phase D3 — parent dim id for chained baseline/continued flows. Set via
   * `setParent` action right after `start('baseline'|'continued')` by the hook
   * orchestrator. Null for all other dim types.
   */
  readonly parentDimensionId: string | null;
}

export type DimensionCreateAction =
  | {
      readonly kind: 'start';
      readonly mode: DimensionCreateMode;
      readonly styleId: string;
      readonly manualOverride?: DimensionType;
    }
  | {
      readonly kind: 'cursorMove';
      readonly cursorWorld: Point2D;
      readonly hoveredEntity?: DetectableEntity;
    }
  | {
      readonly kind: 'click';
      readonly world: Point2D;
      readonly hoveredEntity?: DetectableEntity;
      /** ADR-362 Phase J3 — active snap mode at click time (associativity capture). */
      readonly snapMode?: ExtendedSnapType;
      /** ADR-362 Phase J3 — 2nd host when the click snapped to an intersection. */
      readonly pickedEntity2?: DetectableEntity;
    }
  | { readonly kind: 'pressTab' }
  | { readonly kind: 'pressSpace' }
  | { readonly kind: 'setParent'; readonly parentDimensionId: string }
  | { readonly kind: 'cancel' };

// ──────────────────────────────────────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────────────────────────────────────

export const initialDimensionCreateState: DimensionCreateState = Object.freeze({
  status: 'idle',
  mode: null,
  currentType: null,
  manualOverride: null,
  styleId: null,
  clicks: [],
  cursorWorld: null,
  hoveredEntity: null,
  spacePressCount: 0,
  tabPressCount: 0,
  parentDimensionId: null,
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Clicks needed to finish the given dimension type (see ADR-362 §3 D4 + §7 Phase D2).
 *
 * ADR-362 Phase N — in entity-pick mode (`dim-entity`) EVERY variant collapses to
 * 2 clicks: click 1 picks the whole entity (endpoints / center+radius auto-derived),
 * click 2 is the placement/offset. The resolved `type` is irrelevant to the count.
 */
export function requiredClickCount(
  type: DimensionType,
  mode?: DimensionCreateMode | null,
): number {
  if (mode === 'entity') return 2;
  switch (type) {
    case 'joggedRadius':
      // [center via entity pick, arcPoint, jogPoint, jogVertex]
      return 4;
    case 'linear':
    case 'aligned':
    case 'angular2L':
      return 3;
    case 'angular3P':
      return 4;
    case 'radius':
    case 'diameter':
    case 'arcLength':
    case 'ordinate':
      // Phase D2 — radial family + ordinate (AutoCAD DIMRADIUS/DIMDIAMETER/DIMARC/DIMORDINATE: pick + text position).
      return 2;
    case 'baseline':
    case 'continued':
      // Phase D3 — 1 click per chained dim (new extOrigin2; extOrigin1 + dimLineRef inherited from parent).
      return 1;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return 3;
    }
  }
}

/**
 * Q-A (ADR-362 Phase D2): AutoCAD-style entity-pick requirement for the radial
 * family. Manual `dim-radius` / `dim-diameter` / `dim-arc-length` / `dim-jogged-radius`
 * tools reject click 1 when the cursor isn't over a valid arc/circle — matches
 * DIMRADIUS / DIMDIAMETER / DIMARC behaviour (no freestyle 2-point variant).
 */
function firstClickNeedsEntityPick(
  type: DimensionType | null,
  picked: DetectableEntity | undefined,
): boolean {
  switch (type) {
    case 'radius':
    case 'joggedRadius':
      return !picked || (picked.type !== 'arc' && picked.type !== 'circle');
    case 'diameter':
      return !picked || picked.type !== 'circle';
    case 'arcLength':
      return !picked || picked.type !== 'arc';
    default:
      return false;
  }
}

/**
 * ADR-362 Phase N: entity-pick mode gate. Click 1 of `dim-entity` must land on a
 * dim-able entity — a line/wall (→ length) or circle/arc (→ diameter/radius).
 * Anything else (or empty space) is rejected silently so the user keeps hovering.
 */
function isEntityPickable(picked: DetectableEntity | undefined): boolean {
  if (!picked) return false;
  return (
    picked.type === 'line' ||
    picked.type === 'wall' ||
    picked.type === 'circle' ||
    picked.type === 'arc'
  );
}

/** Resolve `currentType` for the given state using the Phase C2 detector. */
function resolveCurrentType(
  state: DimensionCreateState,
  firstClickedEntity: DetectableEntity | undefined,
  cursorWorld: Point2D | null,
): DimensionType | null {
  // Manual mode: detector returns manualOverride verbatim (Tier 1).
  if (state.mode === 'manual' && state.manualOverride) {
    return state.manualOverride;
  }
  // Smart mode without cursor data yet — keep the current type stable.
  if (!cursorWorld) return state.currentType;

  const detected = detectDimensionType({
    cursorWorld,
    hoveredEntity: state.hoveredEntity ?? undefined,
    firstClickedEntity,
    spacePressCount: state.spacePressCount,
    tabPressCount: state.tabPressCount,
    manualOverride: state.manualOverride ?? undefined,
  });

  // Smart-mode fallback: once the user has clicked, never drop back to null.
  // AutoCAD Smart DIM defaults to 'linear' when the picks are bare points.
  if (!detected && state.clicks.length > 0) return state.currentType ?? 'linear';
  return detected ?? state.currentType;
}

function firstPickedEntity(clicks: readonly ClickRecord[]): DetectableEntity | undefined {
  return clicks[0]?.pickedEntity;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────────────────────────────────────

export function dimensionCreateReducer(
  state: DimensionCreateState,
  action: DimensionCreateAction,
): DimensionCreateState {
  switch (action.kind) {
    case 'start':
      return handleStart(state, action);
    case 'cursorMove':
      return handleCursorMove(state, action);
    case 'click':
      return handleClick(state, action);
    case 'pressTab':
      return handleTab(state);
    case 'pressSpace':
      return handleSpace(state);
    case 'setParent':
      return handleSetParent(state, action);
    case 'cancel':
      return initialDimensionCreateState;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Action handlers (kept small per the 40-line function rule)
// ──────────────────────────────────────────────────────────────────────────────

function handleStart(
  _prev: DimensionCreateState,
  action: Extract<DimensionCreateAction, { kind: 'start' }>,
): DimensionCreateState {
  const manualOverride = action.manualOverride ?? null;
  return {
    ...initialDimensionCreateState,
    status: 'collecting',
    mode: action.mode,
    manualOverride,
    styleId: action.styleId,
    currentType: action.mode === 'manual' ? manualOverride : null,
  };
}

function handleCursorMove(
  state: DimensionCreateState,
  action: Extract<DimensionCreateAction, { kind: 'cursorMove' }>,
): DimensionCreateState {
  if (state.status !== 'collecting') return state;
  const hovered = action.hoveredEntity ?? null;
  const next: DimensionCreateState = {
    ...state,
    cursorWorld: action.cursorWorld,
    hoveredEntity: hovered,
  };
  const nextType = resolveCurrentType(next, firstPickedEntity(next.clicks), action.cursorWorld);
  return { ...next, currentType: nextType };
}

function handleClick(
  state: DimensionCreateState,
  action: Extract<DimensionCreateAction, { kind: 'click' }>,
): DimensionCreateState {
  if (state.status !== 'collecting') return state;

  // Q-A guard: manual radial tools require a valid arc/circle pick on click 1.
  // Reject silently so the user can keep moving the cursor until they hover one.
  if (
    state.mode === 'manual' &&
    state.clicks.length === 0 &&
    firstClickNeedsEntityPick(state.manualOverride, action.hoveredEntity)
  ) {
    return state;
  }

  // ADR-362 Phase N: entity-pick mode requires a dim-able entity under click 1.
  if (
    state.mode === 'entity' &&
    state.clicks.length === 0 &&
    !isEntityPickable(action.hoveredEntity)
  ) {
    return state;
  }

  // Phase D3 pre-requisite guard: chained dims need a parent id set BEFORE any
  // click is registered. Hook orchestrator validates + dispatches setParent at
  // start() time; this is defensive (programmer-error path, silent no-op).
  if (
    state.mode === 'manual' &&
    (state.manualOverride === 'baseline' || state.manualOverride === 'continued') &&
    !state.parentDimensionId
  ) {
    return state;
  }

  const record: ClickRecord = {
    world: action.world,
    ...(action.hoveredEntity ? { pickedEntity: action.hoveredEntity } : {}),
    ...(action.snapMode ? { snapMode: action.snapMode } : {}),
    ...(action.pickedEntity2 ? { pickedEntity2: action.pickedEntity2 } : {}),
  };
  const nextClicks = [...state.clicks, record];
  const nextHovered = action.hoveredEntity ?? null;

  const withClick: DimensionCreateState = {
    ...state,
    clicks: nextClicks,
    cursorWorld: action.world,
    hoveredEntity: nextHovered,
  };

  const nextType = resolveCurrentType(
    withClick,
    firstPickedEntity(nextClicks),
    action.world,
  );
  const effectiveType = nextType ?? state.currentType ?? 'linear';
  const required = requiredClickCount(effectiveType, state.mode);
  const status: DimensionCreateStatus =
    nextClicks.length >= required ? 'commit-ready' : 'collecting';

  return { ...withClick, currentType: effectiveType, status };
}

function handleTab(state: DimensionCreateState): DimensionCreateState {
  if (state.status !== 'collecting' || state.mode !== 'smart') return state;
  const tabPressCount = state.tabPressCount + 1;
  const intermediate: DimensionCreateState = { ...state, tabPressCount };
  const nextType = resolveCurrentType(
    intermediate,
    firstPickedEntity(state.clicks),
    state.cursorWorld,
  );
  return { ...intermediate, currentType: nextType };
}

function handleSpace(state: DimensionCreateState): DimensionCreateState {
  if (state.status !== 'collecting' || state.mode !== 'smart') return state;
  const spacePressCount = state.spacePressCount + 1;
  const intermediate: DimensionCreateState = { ...state, spacePressCount };
  const nextType = resolveCurrentType(
    intermediate,
    firstPickedEntity(state.clicks),
    state.cursorWorld,
  );
  return { ...intermediate, currentType: nextType };
}

function handleSetParent(
  state: DimensionCreateState,
  action: Extract<DimensionCreateAction, { kind: 'setParent' }>,
): DimensionCreateState {
  if (state.status !== 'collecting') return state;
  if (state.parentDimensionId === action.parentDimensionId) return state;
  return { ...state, parentDimensionId: action.parentDimensionId };
}
