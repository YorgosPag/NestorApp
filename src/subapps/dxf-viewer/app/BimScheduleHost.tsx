'use client';

/**
 * BIM SCHEDULE HOST — Revit-grade «Schedules» mount (ADR-363 §6 Phase 8).
 *
 * Lifecycle owner που ενεργοποιεί τον (ήδη φτιαγμένο) `BimScheduleDialog`:
 *   1. Listen σε `bim:schedule-dialog-requested` (ribbon Analyze → «Πίνακας BIM»
 *      → action `'open-schedule-dialog'` → `wrappedHandleAction` → EventBus) →
 *      `openDialog()`.
 *   2. `useCurrentSceneModel()` → όλα τα entities του τρέχοντος ορόφου,
 *      φιλτραρισμένα στους 8 schedulable BIM τύπους (όχι MEP/furniture).
 *   3. `useBimScheduleLookups(entities)` → SSoT lookups + filter options
 *      (όροφοι / κατηγορίες / κτίρια).
 *   4. State (open / region / snapshot) ανήκει στο `useBimScheduleExport`.
 *
 * Region-pick (M5/Phase 2) = DEFER: τα hook callbacks περνούν αυτούσια, αλλά
 * το canvas tool ΔΕΝ ενεργοποιείται ακόμη (`activeRegion` μένει null). Phase 1
 * δίνει πλήρες schedule + export χωρίς region-pick.
 *
 * Mounted as React.Suspense leaf στο `DxfViewerDialogs` — mirror του
 * `DxfFindReplaceHost` + `ThermalEnvelopeHost` (EventBus-subscribe host).
 * ADR-040: zero canvas subscriptions, zero useSyncExternalStore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import * as React from 'react';

import { useBimScheduleExport } from '../hooks/useBimScheduleExport';
import { useBimScheduleLookups } from '../hooks/data/useBimScheduleLookups';
import { useCurrentSceneModel } from '../ui/text-toolbar/hooks/useCurrentSceneModel';
import { BimScheduleDialog } from '../ui/components/bim-schedule/BimScheduleDialog';
import { EventBus } from '../systems/events/EventBus';
import type { AnyBimEntity } from '../bim/schedule/schedule-presets';
import type { Entity } from '../types/entities';
import {
  isWallEntity,
  isOpeningEntity,
  isSlabEntity,
  isSlabOpeningEntity,
  isColumnEntity,
  isBeamEntity,
  isStairEntity,
  isFoundationEntity,
} from '../types/entities';

export interface BimScheduleHostProps {
  /** Live canvas selection ids — feeds the dialog's selection-only filter axis. */
  readonly selectionIds: readonly string[];
}

/** Narrows the broad scene `Entity` union to the 8 schedulable BIM types. */
function isScheduleEntity(entity: Entity): entity is AnyBimEntity {
  return (
    isWallEntity(entity) ||
    isOpeningEntity(entity) ||
    isSlabEntity(entity) ||
    isSlabOpeningEntity(entity) ||
    isColumnEntity(entity) ||
    isBeamEntity(entity) ||
    isStairEntity(entity) ||
    isFoundationEntity(entity)
  );
}

/**
 * Always-mounted lifecycle shell: owns the open state + the ribbon EventBus
 * listener, but renders NOTHING heavy while closed. The O(n) scene scan +
 * lookups live in {@link BimScheduleContent}, which mounts only when the dialog
 * is open — so a closed schedule no longer re-renders on every selection commit
 * (Root B amplifier in HANDOFF_2026-06-25_selection-cascade-and-always-mounted-dialogs).
 */
export function BimScheduleHost({ selectionIds }: BimScheduleHostProps): React.JSX.Element | null {
  const { openDialog, dialogProps } = useBimScheduleExport();

  // Ribbon «Πίνακας BIM» → EventBus → open. Cleanup unsubscribes on unmount.
  React.useEffect(() => EventBus.on('bim:schedule-dialog-requested', openDialog), [openDialog]);

  if (!dialogProps.open) return null;

  return <BimScheduleContent dialogProps={dialogProps} selectionIds={selectionIds} />;
}

interface BimScheduleContentProps {
  readonly dialogProps: ReturnType<typeof useBimScheduleExport>['dialogProps'];
  readonly selectionIds: readonly string[];
}

/** Mounts only while the dialog is open — carries the expensive scene scan. */
function BimScheduleContent({ dialogProps, selectionIds }: BimScheduleContentProps): React.JSX.Element {
  const scene = useCurrentSceneModel();

  const entities = React.useMemo<readonly AnyBimEntity[]>(
    () => (scene?.entities ?? []).filter(isScheduleEntity),
    [scene],
  );

  const { lookups, availableFloors, availableCategories, availableBuildings } =
    useBimScheduleLookups(entities);

  return (
    <BimScheduleDialog
      {...dialogProps}
      entities={entities}
      lookups={lookups}
      availableFloors={availableFloors}
      availableCategories={availableCategories}
      availableBuildings={availableBuildings}
      selectionIds={selectionIds}
    />
  );
}
