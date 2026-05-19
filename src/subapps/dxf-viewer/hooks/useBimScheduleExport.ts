/**
 * USE BIM SCHEDULE EXPORT — Dialog state + region-pick round-trip hook
 * (ADR-363 §6 Phase 8 / M6).
 *
 * Manages all React state for the BIM Schedule export workflow:
 *
 *   1. Dialog open/close (controlled by ribbon action 'open-schedule-dialog').
 *   2. Saved snapshot (entityType / filters / format) for region-pick
 *      round-trip: dialog closes → canvas pick → dialog reopens with
 *      `initialEntityType` / `initialFilters` / `initialFormat` intact.
 *   3. Active region (BoundingBox3D | null) set after canvas pick commit —
 *      passed to `BimScheduleDialog` as `activeRegion` prop.
 *   4. `pendingRegionPick` flag: when true the caller activates
 *      `useScheduleRegionPickTool` with `activeTool = SCHEDULE_REGION_PICK_TOOL`.
 *
 * Caller responsibilities (DxfViewerContent / NormalView):
 *   a. Intercept ribbon action 'open-schedule-dialog' → call `openDialog()`.
 *   b. Watch `pendingRegionPick` → when true, set `activeTool` to
 *      `SCHEDULE_REGION_PICK_TOOL`. When false, restore prior tool.
 *   c. Wire `useScheduleRegionPickTool` with `onCommit = onRegionPickCommit`
 *      and `onCancel = onRegionPickCancel`.
 *   d. Spread `dialogProps` onto `<BimScheduleDialog />` (plus domain data:
 *      `entities`, `lookups`, `availableFloors`, `availableCategories`,
 *      `selectionIds`).
 *
 * Google-level N.7.2:
 *   1. Proactive — state reset on dialog open (closed→open edge)
 *   2. Race condition — sync state, no async. onRegionPickCommit always
 *      clears pendingRegionPick BEFORE reopening dialog (order guaranteed by
 *      React batching in same event handler).
 *   3. Idempotent — openDialog() called N times = same result (already open)
 *   4. Belt&suspenders — onRegionPickCancel reopens dialog without region
 *      (user doesn't lose work)
 *   5. SSoT — single hook owns all export dialog state
 *   6. Await — N/A (sync)
 *   7. Lifecycle owner — this hook; caller is a dumb wire
 *
 * ADR-040: N/A (zero canvas hooks, zero useSyncExternalStore).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @module hooks/useBimScheduleExport
 */

'use client';

import { useCallback, useState } from 'react';

import type { BoundingBox3D } from '../bim/types/bim-base';
import type { BimScheduleSnapshot, BimScheduleDialogProps } from '../ui/components/bim-schedule/BimScheduleDialog';
import type {
  ScheduleEntityType,
  ScheduleExportFormat,
  ScheduleFilterCriteria,
} from '../bim/schedule';

// ─── Default session state ────────────────────────────────────────────────────

const DEFAULT_ENTITY_TYPE: ScheduleEntityType = 'combined';
const DEFAULT_FILTERS: ScheduleFilterCriteria = {};
const DEFAULT_FORMAT: ScheduleExportFormat = 'xlsx';

const DEFAULT_SNAPSHOT: BimScheduleSnapshot = {
  entityType: DEFAULT_ENTITY_TYPE,
  filters: DEFAULT_FILTERS,
  format: DEFAULT_FORMAT,
};

// ─── Return type ──────────────────────────────────────────────────────────────

/**
 * Props spread onto `<BimScheduleDialog />`. Caller provides remaining
 * domain props (`entities`, `lookups`, `availableFloors`,
 * `availableCategories`, `selectionIds`).
 */
export type BimScheduleDialogOwnedProps = Pick<
  BimScheduleDialogProps,
  | 'open'
  | 'onOpenChange'
  | 'activeRegion'
  | 'onRequestRegionPick'
  | 'onClearRegion'
  | 'initialEntityType'
  | 'initialFilters'
  | 'initialFormat'
>;

export interface UseBimScheduleExportReturn {
  /** Open the dialog (call from ribbon action handler). */
  readonly openDialog: () => void;

  /**
   * When true, caller should activate `useScheduleRegionPickTool`
   * with `activeTool = SCHEDULE_REGION_PICK_TOOL`.
   * Cleared automatically when region-pick resolves (commit or cancel).
   */
  readonly pendingRegionPick: boolean;

  /** Spread these props onto `<BimScheduleDialog />`. */
  readonly dialogProps: BimScheduleDialogOwnedProps;

  /** Wire to `useScheduleRegionPickTool({ onCommit })`. */
  readonly onRegionPickCommit: (bbox: BoundingBox3D) => void;

  /** Wire to `useScheduleRegionPickTool({ onCancel })`. */
  readonly onRegionPickCancel: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBimScheduleExport(): UseBimScheduleExportReturn {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState<BoundingBox3D | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<BimScheduleSnapshot>(DEFAULT_SNAPSHOT);
  const [pendingRegionPick, setPendingRegionPick] = useState(false);

  // ── Open action (ribbon button) ───────────────────────────────────────────
  const openDialog = useCallback(() => setDialogOpen(true), []);

  // ── onOpenChange (dialog close button / overlay click) ───────────────────
  const handleOpenChange = useCallback(
    (next: boolean) => setDialogOpen(next),
    [],
  );

  // ── Region pick request (user clicked region CTA inside dialog) ───────────
  const handleRequestRegionPick = useCallback((snapshot: BimScheduleSnapshot) => {
    setSavedSnapshot(snapshot);
    setDialogOpen(false);
    setPendingRegionPick(true);
  }, []);

  // ── Region pick commit (canvas FSM delivered a BBox) ─────────────────────
  const onRegionPickCommit = useCallback((bbox: BoundingBox3D) => {
    setActiveRegion(bbox);
    setPendingRegionPick(false);
    setDialogOpen(true);
  }, []);

  // ── Region pick cancel (user pressed Escape during pick) ─────────────────
  const onRegionPickCancel = useCallback(() => {
    setPendingRegionPick(false);
    setDialogOpen(true);
  }, []);

  // ── Clear region (X button in dialog filter bar) ──────────────────────────
  const handleClearRegion = useCallback(() => setActiveRegion(null), []);

  return {
    openDialog,
    pendingRegionPick,
    dialogProps: {
      open: dialogOpen,
      onOpenChange: handleOpenChange,
      activeRegion,
      onRequestRegionPick: handleRequestRegionPick,
      onClearRegion: handleClearRegion,
      initialEntityType: savedSnapshot.entityType,
      initialFilters: savedSnapshot.filters,
      initialFormat: savedSnapshot.format,
    },
    onRegionPickCommit,
    onRegionPickCancel,
  };
}
