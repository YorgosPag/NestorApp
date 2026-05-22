/**
 * ADR-366 Phase 9 / C.3.Q1 — 3D Dimensions Tool FSM.
 *
 * States (mirror ADR-362 placement FSM):
 *   idle          → tool inactive
 *   placing1      → first endpoint click pending
 *   placing2      → second endpoint click pending (snap preview live)
 *   placingText   → drag text anchor (only when placement mode is aligned/linear)
 *   committed     → terminal — caller transitions back to idle/placing1
 *
 * Transitions exposed as pure functions; the Zustand store wraps them so the
 * FSM stays unit-testable without any store/component imports.
 */

import type { Dim3DAnchor, Dim3DMode, Vec3 } from './dim3d-types';

export type Dim3DFsmState =
  | 'idle'
  | 'placing1'
  | 'placing2'
  | 'placingText'
  | 'committed';

export interface Dim3DFsmContext {
  readonly mode: Dim3DMode;
  readonly endpointA?: Vec3;
  readonly endpointB?: Vec3;
  readonly additionalPoints?: readonly Vec3[];
}

/** Start tool from idle. */
export function activateTool(mode: Dim3DMode): { state: Dim3DFsmState; context: Dim3DFsmContext } {
  return { state: 'placing1', context: { mode } };
}

/** Click 1 — capture endpoint A. */
export function placeFirstPoint(
  ctx: Dim3DFsmContext,
  point: Vec3,
): { state: Dim3DFsmState; context: Dim3DFsmContext } {
  return {
    state: ctx.mode === 'angular' ? 'placing2' : 'placing2',
    context: { ...ctx, endpointA: point },
  };
}

/** Click 2 — capture endpoint B. For angular mode, expects 3 points total. */
export function placeSecondPoint(
  ctx: Dim3DFsmContext,
  point: Vec3,
): { state: Dim3DFsmState; context: Dim3DFsmContext } {
  if (ctx.mode === 'angular') {
    const existing = ctx.additionalPoints ?? [];
    const nextAdditional = [...existing, point];
    if (nextAdditional.length < 2) {
      return { state: 'placing2', context: { ...ctx, additionalPoints: nextAdditional } };
    }
    return {
      state: 'placingText',
      context: {
        ...ctx,
        endpointB: ctx.endpointA,
        additionalPoints: nextAdditional,
      },
    };
  }
  return {
    state: 'placingText',
    context: { ...ctx, endpointB: point },
  };
}

/** Click 3 — text anchor commit. */
export function placeTextAnchor(
  ctx: Dim3DFsmContext,
): { state: Dim3DFsmState; context: Dim3DFsmContext } {
  return { state: 'committed', context: ctx };
}

/** TAB cycles placement mode mid-placement (C.3.Q3). */
const MODE_CYCLE: readonly Dim3DMode[] = ['aligned', 'linear', 'radial', 'angular'];

export function cycleMode(ctx: Dim3DFsmContext): Dim3DFsmContext {
  const idx = MODE_CYCLE.indexOf(ctx.mode);
  const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
  return { ...ctx, mode: next };
}

/** ESC cancels — back to idle, drops captured points. */
export function cancelTool(): { state: Dim3DFsmState; context: Dim3DFsmContext } {
  return { state: 'idle', context: { mode: 'aligned' } };
}

/** Continuous mode: after commit, reset to placing1 keeping the active mode. */
export function continueTool(ctx: Dim3DFsmContext): {
  state: Dim3DFsmState;
  context: Dim3DFsmContext;
} {
  return { state: 'placing1', context: { mode: ctx.mode } };
}

/** Build a complete anchor from the FSM context (callable only when committed). */
export function buildAnchorFromContext(ctx: Dim3DFsmContext): Dim3DAnchor {
  if (!ctx.endpointA || !ctx.endpointB) {
    throw new Error('buildAnchorFromContext: endpoints missing — FSM not committed');
  }
  return {
    endpointA: ctx.endpointA,
    endpointB: ctx.endpointB,
    additionalPoints: ctx.additionalPoints,
  };
}
