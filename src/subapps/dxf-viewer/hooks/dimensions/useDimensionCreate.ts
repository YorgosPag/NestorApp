'use client';

/**
 * ADR-362 Phase D1 — `useDimensionCreate`: orchestrator hook for dimension
 * creation flows (Linear / Aligned / Angular2L / Angular3P).
 *
 * Thin proxy over `dimensionCreateStore` (ADR-040 micro-leaf — no React state
 * subscription here; selective leaves do that in Phase E). Two responsibilities
 * the store cannot own because they are side-effect work:
 *
 *   1. Real `id` + `layerId` generation at commit time (enterprise-id SSoT,
 *      SOS N.6) — built `DimensionEntity` is handed to the parent through
 *      `onDimensionCreated`.
 *   2. Auto-restart after commit so `allowsContinuous: true` dim tools behave
 *      like AutoCAD / BricsCAD: place one dim, the prompt loops for the next
 *      one without re-clicking the ribbon button.
 *
 * Modifier keys (Tab / Space) for type cycling are wired here too — the
 * detector reads `tabPressCount` / `spacePressCount` from the store.
 *
 * Out of scope for Phase D1 (explicitly per the orchestrator brief):
 *   - Radial / ordinate creation         → Phase D2
 *   - Baseline / continued chains        → Phase D3
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
import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
import { buildCommittedDimensionEntity } from './dimension-create-entity-builder';
import type { DimensionCreateMode } from './dimension-create-state';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

/** Initial type pick at flow start — 'smart' = detector-driven, else manual. */
export type DimensionCreateStartInput = 'smart' | DimensionType;

/** Modifier keys recognised by the creation flow (subset of physical events). */
export type DimensionCreateKey = 'Tab' | 'Space' | 'Escape';

export interface DimensionCreateAPI {
  start(initial: DimensionCreateStartInput): void;
  onCursorMove(world: Point2D, hoveredEntity?: DetectableEntity): void;
  onClick(world: Point2D, hoveredEntity?: DetectableEntity): void;
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

  // Cached start params so we can auto-restart in continuous mode after commit.
  const lastStartRef = useRef<{
    mode: DimensionCreateMode;
    styleId: string;
    manualOverride?: DimensionType;
  } | null>(null);

  useEffect(() => {
    let scheduled = false;
    return dimensionCreateStore.subscribe(() => {
      if (scheduled) return;
      if (dimensionCreateStore.get().status !== 'commit-ready') return;
      // Defer to a microtask so the listener loop completes before we mutate.
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        runCommit(onDimensionCreatedRef.current, resolveLayerIdRef.current, lastStartRef.current);
      });
    });
  }, []);

  const start = useCallback<DimensionCreateAPI['start']>((initial) => {
    const styleId = (resolveStyleIdRef.current ?? defaultStyleId)();
    const cached = makeStartParams(initial, styleId);
    lastStartRef.current = cached;
    dimensionCreateStore.start(cached);
  }, []);

  const onCursorMove = useCallback<DimensionCreateAPI['onCursorMove']>(
    (world, hoveredEntity) => {
      dimensionCreateStore.cursorMove({ cursorWorld: world, hoveredEntity });
    },
    [],
  );

  const onClick = useCallback<DimensionCreateAPI['onClick']>((world, hoveredEntity) => {
    dimensionCreateStore.click({ world, hoveredEntity });
  }, []);

  const onKey = useCallback<DimensionCreateAPI['onKey']>((key) => {
    if (key === 'Tab') return dimensionCreateStore.pressTab();
    if (key === 'Space') return dimensionCreateStore.pressSpace();
    if (key === 'Escape') {
      lastStartRef.current = null;
      return dimensionCreateStore.cancel();
    }
  }, []);

  const cancel = useCallback<DimensionCreateAPI['cancel']>(() => {
    lastStartRef.current = null;
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
  return { mode: 'manual', styleId, manualOverride: initial };
}

function runCommit(
  onDimensionCreated: (entity: DimensionEntity) => void,
  resolveLayerId: () => string,
  lastStart: { mode: DimensionCreateMode; styleId: string; manualOverride?: DimensionType } | null,
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

  // Continuous mode: restart with the same initial pick so the user can keep
  // placing dims without re-clicking the ribbon button (matches AutoCAD /
  // BricsCAD `DIM` loop). When the parent cancels the tool, the next click
  // flow will not reach this branch because `start()` resets lastStartRef.
  if (lastStart) {
    dimensionCreateStore.start(lastStart);
  } else {
    dimensionCreateStore.cancel();
  }
}
