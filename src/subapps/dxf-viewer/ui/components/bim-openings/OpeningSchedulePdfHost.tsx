'use client';

/**
 * ADR-376 Phase C.3 — Opening Schedule PDF host.
 *
 * Headless Suspense leaf that listens to `bim:opening-schedule-pdf-requested`
 * and triggers a combined door + window PDF download.
 *
 * Data flow:
 *   1. `getEntities` getter called only on EventBus fire — no re-render on
 *      every entity change.
 *   2. `levels` prop resolves floor IDs to human-readable names.
 *   3. `buildSchedule` SSoT builds door + window schedules.
 *   4. `downloadOpeningScheduleAsPdf` SSoT generates + downloads PDF.
 *
 * ADR-040: headless leaf, no canvas subscriptions, no useSyncExternalStore.
 * Pattern mirror: OpeningTagStyleHost / RenumberOpeningsHost.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 C.3
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { buildSchedule } from '../../../bim/schedule/schedule-builder';
import type { AnyBimEntity } from '../../../bim/schedule/schedule-presets';
import type { ScheduleLookups } from '../../../bim/schedule/types';

type EntityLike = Record<string, unknown>;
import { downloadOpeningScheduleAsPdf } from '../../../bim/schedule/exporters/opening-schedule-pdf-exporter';
import { EventBus } from '../../../systems/events/EventBus';
import type { Level } from '../../../systems/levels/config';

export interface OpeningSchedulePdfHostProps {
  /**
   * Getter called on EventBus fire — avoids re-render on entity changes.
   * Typed loosely so DxfViewerContent need not import AnyBimEntity; the
   * host casts internally via `as AnyBimEntity[]`.
   */
  readonly getEntities: () => ReadonlyArray<EntityLike>;
  /** Floor list from levelManager — resolves floorId → name. */
  readonly levels: readonly Level[];
  /** Optional project name appended to PDF title. */
  readonly projectName?: string;
}

function buildLookupsFromLevels(levels: readonly Level[]): ScheduleLookups {
  const map = new Map(levels.map((l) => [l.id, l.name]));
  return {
    floor: (floorId) => (floorId ? (map.get(floorId) ?? floorId) : ''),
    material: (matId) => matId ?? '',
    floorFinish: () => undefined,
  };
}

export function OpeningSchedulePdfHost(props: OpeningSchedulePdfHostProps): null {
  const { getEntities, levels, projectName = '' } = props;
  const { t: tSchedule } = useTranslation('dxf-schedule');
  const { t: tShell } = useTranslation('dxf-viewer-shell');

  const handleExport = React.useCallback(async (): Promise<void> => {
    const entities = getEntities() as AnyBimEntity[];
    const lookups = buildLookupsFromLevels(levels);

    const doorSchedule = buildSchedule(entities, { entityType: 'door', filters: {} }, lookups);
    const windowSchedule = buildSchedule(entities, { entityType: 'window', filters: {} }, lookups);

    if (doorSchedule.rows.length === 0 && windowSchedule.rows.length === 0) return;

    const safeProjectSlug = projectName
      ? projectName.replace(/\s+/g, '-').toLowerCase()
      : '';
    const filename = safeProjectSlug
      ? `opening-schedule-${safeProjectSlug}`
      : 'opening-schedule';

    await downloadOpeningScheduleAsPdf(
      doorSchedule,
      windowSchedule,
      {
        scheduleTitle: tShell('ribbon.commands.openingEditor.scheduleExport.label'),
        projectName,
        doorLabel: tSchedule('entityType.door'),
        windowLabel: tSchedule('entityType.window'),
        filename,
      },
      (key) => tSchedule(key),
    );
  }, [getEntities, levels, projectName, tSchedule, tShell]);

  React.useEffect(() => {
    return EventBus.on('bim:opening-schedule-pdf-requested', () => {
      void handleExport();
    });
  }, [handleExport]);

  return null;
}
