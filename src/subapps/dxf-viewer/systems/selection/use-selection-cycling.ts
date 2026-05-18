'use client';
/**
 * useSelectionCycling — ADR-357 Phase 15 (G13 Selection Cycling).
 *
 * Registers Shift+Space to cycle through overlapping entities at the cursor.
 * ADR-040 compliant: subscribes only to SelectionCyclingStore (low-freq).
 *
 * Keyboard contract (while cycling is inactive):
 *   Shift+Space in select mode → run hit-test → if N≥2 entities → startCycling
 *
 * Keyboard contract (while cycling is active):
 *   Shift+Space → cycleNext
 *   Enter       → confirm current + cancel
 *   Escape      → cancel (no selection change)
 */

import { useCallback, useEffect, useRef } from 'react';
import { SelectionCyclingStore, type CyclingCandidate } from './SelectionCyclingStore';
import { hitTestingService } from '../../services/HitTestingService';
import { getImmediatePosition } from '../cursor/ImmediatePositionStore';
import { getImmediateTransform } from '../cursor/ImmediateTransformStore';
// ADR-364 — Escape Command Bus SSoT
import { useEscapeHandler, ESC_PRIORITY } from '../escape-bus';

export interface UseSelectionCyclingParams {
  activeTool: string;
  onSelectEntity: (entityId: string) => void;
}

/**
 * Side-effect-only hook — no useSyncExternalStore, so CanvasSection never re-renders
 * due to cycling state changes (ADR-040). State is consumed by SelectionCyclingPopover.
 */
export function useSelectionCycling({ activeTool, onSelectEntity }: UseSelectionCyclingParams): void {
  // Track last mouse client position for popover anchor (page coordinates).
  const mouseClientRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseClientRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Stable callback — reads onSelectEntity via ref to avoid effect re-runs.
  const onSelectRef = useRef(onSelectEntity);
  onSelectRef.current = onSelectEntity;

  const triggerCycling = useCallback(() => {
    const screenPos = getImmediatePosition();
    if (!screenPos) return;

    const transform = getImmediateTransform();
    const canvas = document.getElementById('dxf-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    const hits = hitTestingService.hitTestAll(screenPos, transform, viewport);

    // Deduplicate by entity ID and build candidate list.
    const seen = new Set<string>();
    const candidates: CyclingCandidate[] = [];
    for (const hit of hits) {
      if (hit.entityId && !seen.has(hit.entityId)) {
        seen.add(hit.entityId);
        candidates.push({
          id: hit.entityId,
          entityType: hit.entityType ?? 'entity',
          layer: hit.layer ?? '0',
        });
      }
    }

    if (candidates.length >= 2) {
      const { x, y } = mouseClientRef.current;
      SelectionCyclingStore.startCycling(candidates, x, y);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) return;

      // Shift+Space: trigger cycling or advance to next candidate.
      if (e.code === 'Space' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (SelectionCyclingStore.isActive()) {
          SelectionCyclingStore.cycleNext();
        } else if (activeTool === 'select') {
          triggerCycling();
        }
        return;
      }

      if (!SelectionCyclingStore.isActive()) return;

      // Enter: confirm selection. stopImmediatePropagation prevents useCanvasKeyboardShortcuts
      // from also handling Enter (e.g. finish polyline).
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = SelectionCyclingStore.getCurrentId();
        if (id) onSelectRef.current(id);
        SelectionCyclingStore.cancel();
        return;
      }

      // ADR-364: Escape moved to EscapeCommandBus (SELECTION_CYCLING priority).
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [activeTool, triggerCycling]);

  // ADR-364 — SELECTION_CYCLING priority slot.
  useEscapeHandler({
    id: 'selection-cycling/cancel',
    priority: ESC_PRIORITY.SELECTION_CYCLING,
    canHandle: () => SelectionCyclingStore.isActive(),
    handle: () => { SelectionCyclingStore.cancel(); return true; },
  });
}
