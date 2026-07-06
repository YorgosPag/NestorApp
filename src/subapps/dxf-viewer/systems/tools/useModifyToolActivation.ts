/**
 * USE MODIFY-TOOL ACTIVATION — SSoT for the AutoCAD 2-click modify-tool FSM
 * activation/selection invariant (ADR-577).
 *
 * Every 2-click modify tool (Move, Copy, Rotate, Scale, Mirror) hand-rolled the
 * SAME activation bookkeeping: two refs (`wasActive`, `prevSelectionCount`) plus a
 * 4-branch `useEffect` that:
 *   1. on ACTIVATE   → enter the base-pick phase if something is selected, else
 *                      the entity-pick phase (clicks fall through to selection),
 *   2. on DEACTIVATE → reset to idle,
 *   3. selection APPEARED while waiting → advance entity-pick → base-pick,
 *   4. selection LOST while active       → fall back to the entity-pick phase.
 *
 * This hook owns branches 2–4 + the ref bookkeeping (byte-identical across tools).
 * The ACTIVATE branch (branch 1) is the only genuinely tool-specific part —
 * Rotate/Scale restore a pending typed-input phase, Mirror hands off to its
 * second-point phase — so it is delegated to the optional `onActivate` callback;
 * when it returns falsy the hook applies the default `hasSelection ? base : entity`.
 *
 * Phase STORAGE stays with the tool (useState for Move/Copy/Rotate/Mirror, an
 * external store for Scale) — the tool wires `setPhase` / `onDeactivate` / reads
 * `phase`, so this hook is storage-agnostic. It manages ONLY the phase; per-tool
 * transient state (base point, preview canvas) is cleared inside the tool's own
 * `setPhase`/`onDeactivate` handlers, exactly as before.
 *
 * @see hooks/tools/useMoveTool.ts / useCopyTool.ts — canonical consumers
 */
'use client';

import { useEffect, useRef } from 'react';

export interface ModifyToolActivationConfig {
  /** `activeTool === <thisToolId>`. */
  readonly isActive: boolean;
  /** Count of currently-selected inputs (entities, plus overlays for tools that move them). */
  readonly selectionCount: number;
  /** The tool's current FSM phase (read from its useState or its store). */
  readonly phase: string;
  /** Phase name held while waiting for the user to pick an entity (clicks pass through). */
  readonly entityPhase: string;
  /** Phase name the tool collects its first pick in (base / first point). */
  readonly basePhase: string;
  /** Enter a phase — wired to the tool's `setState` or `store.setPhase`. */
  readonly setPhase: (phase: string) => void;
  /** Reset to idle on deactivation — the tool clears its transient state here. */
  readonly onDeactivate: () => void;
  /**
   * Optional override for the ACTIVATION branch (typed-input restore / mirror
   * handoff). Return `true` when it fully handled activation (skip the default);
   * return falsy to apply `hasSelection ? basePhase : entityPhase`.
   */
  readonly onActivate?: (hasSelection: boolean) => boolean | void;
}

/**
 * Drive the shared activate/deactivate/selection-transition FSM for a 2-click
 * modify tool. Storage-agnostic: the tool owns the phase; this hook only decides
 * the transitions. Reads config via a ref so the effect depends solely on the
 * three primitives that can change a transition (isActive, selectionCount, phase)
 * — mirroring each tool's original effect deps, zero extra re-runs.
 */
export function useModifyToolActivation(cfg: ModifyToolActivationConfig): void {
  const wasActiveRef = useRef(false);
  const prevCountRef = useRef(0);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    const {
      isActive, selectionCount, phase, entityPhase, basePhase,
      setPhase, onDeactivate, onActivate,
    } = cfgRef.current;
    const hasSelection = selectionCount > 0;

    if (isActive && !wasActiveRef.current) {
      const handled = onActivate?.(hasSelection);
      if (!handled) setPhase(hasSelection ? basePhase : entityPhase);
    } else if (!isActive && wasActiveRef.current) {
      onDeactivate();
    } else if (isActive && wasActiveRef.current) {
      if (prevCountRef.current === 0 && hasSelection && phase === entityPhase) {
        setPhase(basePhase);
      } else if (prevCountRef.current > 0 && !hasSelection) {
        setPhase(entityPhase);
      }
    }

    wasActiveRef.current = isActive;
    prevCountRef.current = selectionCount;
  }, [cfg.isActive, cfg.selectionCount, cfg.phase]);
}
