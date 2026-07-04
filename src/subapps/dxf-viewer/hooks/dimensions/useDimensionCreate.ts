'use client';

/**
 * ADR-362 Phase D1+D2+D3 — `useDimensionCreate`: orchestrator hook for dim
 * creation (Linear / Aligned / Angular2L / Angular3P / Radius / Diameter /
 * ArcLength / JoggedRadius / Ordinate / Baseline / Continued — 10/10 types).
 *
 * Thin proxy over `dimensionCreateStore` (ADR-040 micro-leaf — no React state
 * subscription here; selective leaves do that in Phase E). Three side-effect
 * responsibilities the store cannot own:
 *
 *   1. Real `id` + `layerId` generation at commit time (enterprise-id SSoT,
 *      SOS N.6) — built `DimensionEntity` handed to the parent through
 *      `onDimensionCreated`.
 *   2. Auto-restart after commit so `allowsContinuous: true` dim tools behave
 *      like AutoCAD / BricsCAD: place one dim, the prompt loops for the next
 *      one without re-clicking the ribbon button.
 *   3. Phase D3 — parent dim resolution for chained baseline/continued flows.
 *      Q-A AutoCAD default = auto-last: the most recently committed
 *      linear/aligned/baseline/continued dim in the current hook session is
 *      remembered and offered as parent. Q-B = auto-progression: after each
 *      commit the chain head advances to the just-committed entity, so the
 *      continuous loop chains end-to-end (continued) or rung-by-rung
 *      (baseline). Q-D = silent + console.warn when no parent exists.
 *      `resolveParentDimension` param is an optional explicit override (Phase
 *      E will wire ribbon "Select parent" pick mode through it).
 *
 * Modifier keys (Tab / Space / Escape) — programmatic via `onKey`, live event
 * routing from the canvas wired in `useDimensionKeyboardRouting`.
 *
 * Out of scope for Phase D3:
 *   - Ribbon Smart DIM dropdown UI       → Phase E1
 *   - Contextual ribbon tab              → Phase E2
 *   - Snap intelligence + grips          → Phase I
 *   - Associativity observers            → Phase J (click-time capture only here)
 *   - DXF export                         → Phase H
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity, DimensionType } from '../../types/dimension';
import { generateDimensionId } from '@/services/enterprise-id-convenience';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import type { ExtendedSnapType } from '../../snapping/extended-types';
import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
import { buildCommittedDimensionEntity } from './dimension-create-entity-builder';
import { requiredClickCount } from './dimension-create-state';
import type { DimensionCreateMode } from './dimension-create-state';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Initial type pick at flow start:
 *   - 'smart'  = detector-driven (Smart DIM)
 *   - 'entity' = ADR-362 Phase N pick-entity quick dim (detector-driven type, but
 *                click 1 picks a whole entity → 2-click flow)
 *   - else     = manual override (one specific `DimensionType`)
 */
export type DimensionCreateStartInput = 'smart' | 'entity' | DimensionType;

/** Modifier keys recognised by the creation flow (subset of physical events). */
export type DimensionCreateKey = 'Tab' | 'Space' | 'Escape' | 'Enter';

/** ADR-362 Phase J3 — snap metadata captured at click time for associativity. */
export interface DimClickSnapInfo {
  /** Active snap mode (drives intersection vs nearest association capture). */
  readonly snapMode?: ExtendedSnapType;
  /** 2nd host entity when the click snapped to an intersection. */
  readonly secondEntity?: DetectableEntity;
}

export interface DimensionCreateAPI {
  start(initial: DimensionCreateStartInput): void;
  onCursorMove(world: Point2D, hoveredEntity?: DetectableEntity): void;
  onClick(world: Point2D, hoveredEntity?: DetectableEntity, snap?: DimClickSnapInfo): void;
  onKey(key: DimensionCreateKey): void;
  cancel(): void;
}

export interface UseDimensionCreateParams {
  /** Receives the freshly committed dimension entity at the end of each flow. */
  readonly onDimensionCreated: (entity: DimensionEntity) => void;
  /** Layer id assigned to the committed entity (active layer / DIMSTYLE target). */
  readonly resolveLayerId: () => string;
  /**
   * Style id resolver — default = active DIMSTYLE registry. Override for tests
   * that don't want to touch the registry singleton.
   */
  readonly resolveStyleId?: () => string;
  /**
   * Phase D3 — explicit parent dim override for chained flows. Returns the
   * dim to chain off (typically from a ribbon "Select parent" pick mode in
   * Phase E). Returning `null` falls back to auto-last (the most recently
   * committed chainable dim in this hook session). When BOTH return null, the
   * hook warns + cancels (silent for the user; nothing reaches the store).
   */
  readonly resolveParentDimension?: (
    mode: 'baseline' | 'continued',
  ) => DimensionEntity | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export function useDimensionCreate(params: UseDimensionCreateParams): DimensionCreateAPI {
  const onDimensionCreatedRef = useRef(params.onDimensionCreated);
  onDimensionCreatedRef.current = params.onDimensionCreated;

  const resolveLayerIdRef = useRef(params.resolveLayerId);
  resolveLayerIdRef.current = params.resolveLayerId;

  const resolveStyleIdRef = useRef(params.resolveStyleId);
  resolveStyleIdRef.current = params.resolveStyleId;

  const resolveParentDimensionRef = useRef(params.resolveParentDimension);
  resolveParentDimensionRef.current = params.resolveParentDimension;

  // Cached start params so we can auto-restart in continuous mode after commit.
  const lastStartRef = useRef<{
    mode: DimensionCreateMode;
    styleId: string;
    manualOverride?: DimensionType;
  } | null>(null);

  // Phase D3 — last committed chainable dim id (linear/aligned/baseline/continued).
  // Drives Q-A auto-last parent resolution + Q-B auto-progression of the chain head.
  const lastChainableRef = useRef<string | null>(null);

  useEffect(() => {
    let scheduled = false;
    return dimensionCreateStore.subscribe(() => {
      if (scheduled) return;
      if (dimensionCreateStore.get().status !== 'commit-ready') return;
      // Defer to a microtask so the listener loop completes before we mutate.
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        runCommit(
          onDimensionCreatedRef.current,
          resolveLayerIdRef.current,
          lastStartRef.current,
          lastChainableRef,
        );
      });
    });
  }, []);

  const start = useCallback<DimensionCreateAPI['start']>((initial) => {
    const styleId = (resolveStyleIdRef.current ?? defaultStyleId)();
    const cached = makeStartParams(initial, styleId);

    if (initial === 'baseline' || initial === 'continued') {
      const parentId = resolveChainParentId(
        initial,
        resolveParentDimensionRef.current,
        lastChainableRef.current,
      );
      if (!parentId) {
        // eslint-disable-next-line no-console
        console.warn(
          `[useDimensionCreate] ${initial} requires a prior linear/aligned dim — no parent available.`,
        );
        return;
      }
      lastStartRef.current = cached;
      dimensionCreateStore.start(cached);
      dimensionCreateStore.setParent(parentId);
      return;
    }

    lastStartRef.current = cached;
    dimensionCreateStore.start(cached);
  }, []);

  const onCursorMove = useCallback<DimensionCreateAPI['onCursorMove']>(
    (world, hoveredEntity) => {
      dimensionCreateStore.cursorMove({ cursorWorld: world, hoveredEntity });
    },
    [],
  );

  const onClick = useCallback<DimensionCreateAPI['onClick']>((world, hoveredEntity, snap) => {
    dimensionCreateStore.click({
      world,
      hoveredEntity,
      snapMode: snap?.snapMode,
      pickedEntity2: snap?.secondEntity,
    });
  }, []);

  const onKey = useCallback<DimensionCreateAPI['onKey']>((key) => {
    if (key === 'Tab') return dimensionCreateStore.pressTab();
    if (key === 'Space') return dimensionCreateStore.pressSpace();
    if (key === 'Escape') {
      lastStartRef.current = null;
      lastChainableRef.current = null;
      return dimensionCreateStore.cancel();
    }
    if (key === 'Enter') {
      // AutoCAD/Revit pattern: Enter commits the current cursor position as the
      // next click, allowing the user to skip the final physical click when the
      // cursor is already positioned correctly (e.g. finish linear with 2 clicks
      // instead of 3 by pressing Enter after placing the 2nd point).
      const state = dimensionCreateStore.get();
      if (state.status !== 'collecting' || !state.cursorWorld || !state.currentType) return;
      const needed = requiredClickCount(state.currentType, state.mode);
      if (state.clicks.length === needed - 1) {
        dimensionCreateStore.click({
          world: state.cursorWorld,
          hoveredEntity: state.hoveredEntity ?? undefined,
        });
      }
    }
  }, []);

  const cancel = useCallback<DimensionCreateAPI['cancel']>(() => {
    lastStartRef.current = null;
    lastChainableRef.current = null;
    dimensionCreateStore.cancel();
  }, []);

  return { start, onCursorMove, onClick, onKey, cancel };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

function defaultStyleId(): string {
  return getDimStyleRegistry().getActiveStyleId();
}

function makeStartParams(
  initial: DimensionCreateStartInput,
  styleId: string,
): { mode: DimensionCreateMode; styleId: string; manualOverride?: DimensionType } {
  if (initial === 'smart') return { mode: 'smart', styleId };
  if (initial === 'entity') return { mode: 'entity', styleId };
  return { mode: 'manual', styleId, manualOverride: initial };
}

function runCommit(
  onDimensionCreated: (entity: DimensionEntity) => void,
  resolveLayerId: () => string,
  lastStart: { mode: DimensionCreateMode; styleId: string; manualOverride?: DimensionType } | null,
  lastChainableRef: { current: string | null },
): void {
  const state = dimensionCreateStore.get();
  if (state.status !== 'commit-ready') return;

  const built = buildCommittedDimensionEntity(state, {
    id: generateDimensionId(),
    layerId: resolveLayerId(),
  });
  if (!built) {
    dimensionCreateStore.cancel();
    return;
  }

  onDimensionCreated(built.entity);

  // Phase D3 — Q-B auto-progression: any chainable commit advances the head so
  // the next baseline/continued in the loop hangs off the just-placed dim.
  if (isChainable(built.entity.dimensionType)) {
    lastChainableRef.current = built.entity.id;
  }

  // Continuous mode: restart with the same initial pick so the user can keep
  // placing dims without re-clicking the ribbon button (matches AutoCAD /
  // BricsCAD `DIM` loop). When the parent cancels the tool, the next click
  // flow will not reach this branch because `start()` resets lastStartRef.
  if (!lastStart) {
    dimensionCreateStore.cancel();
    return;
  }
  dimensionCreateStore.start(lastStart);
  // Chained tools need parentDimensionId re-set after the start() reset.
  if (lastStart.manualOverride === 'baseline' || lastStart.manualOverride === 'continued') {
    const parent = lastChainableRef.current;
    if (parent) dimensionCreateStore.setParent(parent);
    else dimensionCreateStore.cancel();
  }
}

/**
 * Phase D3 — Q-A parent resolution: explicit `resolveParentDimension` callback
 * wins; otherwise fall back to the most recently committed chainable dim in
 * this hook session. Returns null when neither has a parent (caller warns +
 * aborts the start so the store never enters a chained flow without a parent).
 */
function resolveChainParentId(
  mode: 'baseline' | 'continued',
  resolveParentDimension:
    | ((mode: 'baseline' | 'continued') => DimensionEntity | null)
    | undefined,
  fallbackId: string | null,
): string | null {
  const explicit = resolveParentDimension?.(mode);
  if (explicit) return explicit.id;
  return fallbackId;
}

function isChainable(t: DimensionType): boolean {
  return t === 'linear' || t === 'aligned' || t === 'baseline' || t === 'continued';
}
