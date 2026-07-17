/**
 * USE SCHEDULE REGION-PICK TOOL — 2-click BBox FSM (ADR-363 §6 Phase 8 / M5).
 *
 * 2-click FSM που εκπέμπει `BoundingBox3D` (mm, z-agnostic) μέσω `onCommit`
 * callback. Καταναλώνεται από το BimScheduleDialog parent: όταν ο χρήστης
 * πατάει το «Επιλογή περιοχής» CTA, το parent κλείνει το dialog +
 * activate-ει αυτό το tool. Στο 2ο click το tool εκπέμπει BBox και
 * αυτό-deactivate-εται (caller ξανανοίγει το dialog με
 * `activeRegion = bbox`).
 *
 * State machine:
 *   idle → awaiting-first-corner → awaiting-second-corner → commit → idle
 *
 * Activation:
 *   - `activeTool === 'schedule-region-pick'` → phase = awaiting-first-corner
 *   - `activeTool` αλλάζει σε άλλο → reset σε idle (no commit)
 *
 * Click handler:
 *   - Phase awaiting-first → store first corner, advance σε
 *     awaiting-second.
 *   - Phase awaiting-second → compute BBox, call `onCommit`, reset σε idle,
 *     `onToolChange('select')` ώστε να μην παγιδευτεί ο χρήστης σε pick mode.
 *
 * Escape handler:
 *   - Reset σε idle, call `onCancel` (αν δοθεί), `onToolChange('select')`.
 *
 * BoundingBox3D produced:
 *   - `min.{x,y}` = min(first.x, second.x), min(first.y, second.y)
 *   - `max.{x,y}` = max(first.x, second.x), max(first.y, second.y)
 *   - `z = 0` σε min+max (filter pipeline ignores z per ADR-363 §6 Phase 8)
 *
 * ADR-040 compliance:
 *   - R1 ✅ Hook ζει στον orchestrator (CanvasSection ή parent dialog
 *     controller), όχι σε leaf renderer.
 *   - R2 ✅ Δεν διαβάζει high-frequency stores με snapshot — οι click
 *     handlers δέχονται `worldPoint` directly από canvas event pipeline
 *     (mirror του Move tool pattern).
 *   - R3 ✅ Δεν επηρεάζει `dxf-bitmap-cache` (cache key irrelevant).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * @module hooks/tools/useScheduleRegionPickTool
 */

'use client';

import { useCallback, useState } from 'react';
import i18next from 'i18next';

import type { Point2D } from '../../rendering/types/Types';
import type { BoundingBox3D } from '../../bim/types/bim-base';
import {
  getRegionPickFirstCorner,
  resetRegionPickStore,
  setRegionPickFirstCorner,
  setRegionPickPhase,
  type RegionPickPhase,
} from '../../bim/schedule/stores/region-pick-store';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';
import { useToolHintPromptText } from './useToolHintPrompt';

// ─── Public tool-name constant ───────────────────────────────────────────────

export const SCHEDULE_REGION_PICK_TOOL = 'schedule-region-pick' as const;
export type ScheduleRegionPickToolName = typeof SCHEDULE_REGION_PICK_TOOL;

// ─── BBox builder ────────────────────────────────────────────────────────────

function bboxFromTwoCorners(a: Point2D, b: Point2D): BoundingBox3D {
  return {
    min: {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      z: 0,
    },
    max: {
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y),
      z: 0,
    },
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseScheduleRegionPickToolProps {
  /** Current active tool name (matches against `SCHEDULE_REGION_PICK_TOOL`). */
  readonly activeTool: string;
  /** Fired με την BBox όταν ο χρήστης κάνει το 2ο click. */
  readonly onCommit: (bbox: BoundingBox3D) => void;
  /** Fired όταν ο χρήστης κάνει Escape πριν ολοκληρωθεί το pick. */
  readonly onCancel?: () => void;
  /** Tool-switch callback — αυτο-επιστρέφει στο 'select' μετά από commit ή cancel. */
  readonly onToolChange?: (tool: string) => void;
}

export interface UseScheduleRegionPickToolReturn {
  readonly phase: RegionPickPhase;
  readonly isActive: boolean;
  readonly handleClick: (worldPoint: Point2D) => void;
  readonly handleEscape: () => void;
  readonly prompt: string;
}

export function useScheduleRegionPickTool(
  props: UseScheduleRegionPickToolProps,
): UseScheduleRegionPickToolReturn {
  const { activeTool, onCommit, onCancel, onToolChange } = props;

  const isActive = activeTool === SCHEDULE_REGION_PICK_TOOL;
  // Local React state mirrors store phase. Store remains SSoT για canvas
  // leaves (rubber-band preview) — hook state αναγκαία ώστε prompt +
  // return value να ανανεώνονται στους consumers.
  const [phase, setPhase] = useState<RegionPickPhase>('idle');

  // ── Activation transitions (ADR-589 edge-triggered SSoT) ──────────────────
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      setRegionPickFirstCorner(null);
      setRegionPickPhase('awaiting-first-corner');
      setPhase('awaiting-first-corner');
    },
    () => {
      resetRegionPickStore();
      setPhase('idle');
    },
  );

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (worldPoint: Point2D) => {
      if (!isActive) return;

      if (phase === 'awaiting-first-corner') {
        setRegionPickFirstCorner({ x: worldPoint.x, y: worldPoint.y });
        setRegionPickPhase('awaiting-second-corner');
        setPhase('awaiting-second-corner');
        return;
      }

      if (phase === 'awaiting-second-corner') {
        const first = getRegionPickFirstCorner();
        if (!first) {
          // Defensive: φάση mismatch με store. Reset + escape.
          resetRegionPickStore();
          setPhase('idle');
          onToolChange?.('select');
          return;
        }
        const bbox = bboxFromTwoCorners(first, worldPoint);
        resetRegionPickStore();
        setPhase('idle');
        onCommit(bbox);
        onToolChange?.('select');
      }
    },
    [isActive, phase, onCommit, onToolChange],
  );

  // ── Escape handler ────────────────────────────────────────────────────────
  const handleEscape = useCallback(() => {
    if (!isActive) return;
    resetRegionPickStore();
    setPhase('idle');
    onCancel?.();
    onToolChange?.('select');
  }, [isActive, onCancel, onToolChange]);

  // ── Prompt text (i18n) ────────────────────────────────────────────────────
  let prompt = '';
  if (phase === 'awaiting-first-corner') {
    prompt = i18next.t('dxf-schedule:regionPick.awaitingFirst');
  } else if (phase === 'awaiting-second-corner') {
    prompt = i18next.t('dxf-schedule:regionPick.awaitingSecond');
  }

  // No phase gate here — this tool has no 'idle' phase; `isActive` alone drives it.
  useToolHintPromptText(isActive, prompt);

  return {
    phase,
    isActive,
    handleClick,
    handleEscape,
    prompt,
  };
}
