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
import { SelectionCyclingStore, buildCandidatesFromHits, type EntityResolver } from './SelectionCyclingStore';
// ADR-659 fix — the LIVE hit-testing instance (the one the render loop feeds via
// updateScene) lives in the ServiceRegistry. The exported `hitTestingService` singleton
// never gets a scene → hitTestAll returns [] (this is why Shift+Space cycling never worked).
import { serviceRegistry } from '../../services/ServiceRegistry';
import { getImmediatePosition, getClientPosition } from '../cursor/ImmediatePositionStore';
import { getImmediateTransform } from '../cursor/ImmediateTransformStore';
// ADR-659 — canvas pre-highlight of the currently-cycled candidate (zero-React, ADR-040).
import { setHoveredEntity } from '../hover/HoverStore';
// ADR-364 — Escape Command Bus SSoT
import { useEscapeHandler, ESC_PRIORITY } from '../escape-bus';

export interface UseSelectionCyclingParams {
  activeTool: string;
  onSelectEntity: (entityId: string) => void;
  /**
   * Optional entity lookup (scene.entities.find by id) so the popover row can show a
   * semantic label (slab role/thickness/elevation) instead of the raw entity-type +
   * internal level id. Threaded straight into `buildCandidatesFromHits` — ADR-040:
   * the lookup happens ONCE here, at Shift+Space trigger time, never per popover render.
   */
  resolveEntity?: EntityResolver;
}

/**
 * Side-effect-only hook — no useSyncExternalStore, so CanvasSection never re-renders
 * due to cycling state changes (ADR-040). State is consumed by SelectionCyclingPopover.
 */
export function useSelectionCycling({ activeTool, onSelectEntity, resolveEntity }: UseSelectionCyclingParams): void {
  // Stable callback — reads onSelectEntity via ref to avoid effect re-runs.
  const onSelectRef = useRef(onSelectEntity);
  onSelectRef.current = onSelectEntity;
  // Stable ref for resolveEntity — same rationale (avoid effect churn on identity change).
  const resolveEntityRef = useRef(resolveEntity);
  resolveEntityRef.current = resolveEntity;

  const triggerCycling = useCallback(() => {
    const screenPos = getImmediatePosition();
    if (!screenPos) return;

    const transform = getImmediateTransform();
    const canvas = document.getElementById('dxf-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };

    const hits = serviceRegistry.get('hit-testing').hitTestAll(screenPos, transform, viewport);

    // ADR-659 — shared dedup SSoT (no clone of the loop, N.18).
    const candidates = buildCandidatesFromHits(hits, resolveEntityRef.current);

    if (candidates.length >= 2) {
      const { x, y } = getClientPosition();
      SelectionCyclingStore.startCycling(candidates, x, y);
      // Pre-highlight the top candidate on the canvas the moment cycling opens.
      setHoveredEntity(candidates[0]?.id ?? null);
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
          // ADR-659 — keep the canvas pre-highlight in sync with the cycled candidate.
          setHoveredEntity(SelectionCyclingStore.getCurrentId());
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
        // ADR-659 — selection now owns the highlight; drop the transient pre-highlight.
        setHoveredEntity(null);
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
    handle: () => { SelectionCyclingStore.cancel(); setHoveredEntity(null); return true; },
  });
}
