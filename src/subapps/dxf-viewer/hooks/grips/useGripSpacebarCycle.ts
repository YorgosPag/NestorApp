/**
 * USE GRIP SPACEBAR CYCLE — ADR-349 Phase 1c-A
 *
 * Listens for Spacebar while a DXF grip is "hot" (hovering / warm / dragging)
 * and cycles `GripModeStore` through the industry-standard order
 * (Stretch → Move → Rotate → Scale → Mirror → Stretch). Each cycle updates
 * the status-bar hint via `toolHintOverrideStore` so the user sees the
 * current mode in real time.
 *
 * Also resets the mode to default whenever the grip phase returns to idle —
 * matching AutoCAD's "grip release → mode reset" rule.
 *
 * ADR-040: no useSyncExternalStore — only `useEffect` against discrete
 * inputs and a window keydown listener. Safe to invoke from CanvasSection.
 *
 * @see GripModeStore
 * @see grip-mode-cycle
 */

import { useEffect } from 'react';
import i18next from 'i18next';
import type { UnifiedGripPhase } from './unified-grip-types';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import { nextGripMode, gripModeMeta } from '../../systems/grip/grip-mode-cycle';
import { toolHintOverrideStore } from '../toolHintOverrideStore';

export interface UseGripSpacebarCycleParams {
  readonly phase: UnifiedGripPhase;
  readonly activeTool: string;
}

function updateHint(): void {
  const meta = gripModeMeta(GripModeStore.getSnapshot());
  const modeLabel = i18next.t(`tool-hints:${meta.labelKey}`);
  const cycleHint = i18next.t('tool-hints:gripMode.cycleHint', { mode: modeLabel });
  toolHintOverrideStore.setOverride(cycleHint);
}

export function useGripSpacebarCycle(params: UseGripSpacebarCycleParams): void {
  const { phase, activeTool } = params;

  // ── Reset mode + clear hint when phase returns to idle ───────────────────
  useEffect(() => {
    if (phase === 'idle') {
      GripModeStore.reset();
      toolHintOverrideStore.setOverride(null);
      return;
    }
    if (phase === 'hovering' || phase === 'warm' || phase === 'dragging') {
      updateHint();
    }
  }, [phase]);

  // ── Spacebar handler — only active while a grip is hot ───────────────────
  useEffect(() => {
    const isGripMode = activeTool === 'select' || activeTool === 'layering';
    if (!isGripMode) return;
    if (phase === 'idle') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      // Don't hijack spacebar when typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      e.preventDefault();
      GripModeStore.set(nextGripMode(GripModeStore.getSnapshot()));
      updateHint();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [phase, activeTool]);
}
