/**
 * BIM Schedule — Dialog Orchestrator (ADR-363 §6 Phase 8 / M4).
 *
 * Controlled Radix Dialog που συνθέτει τα 4 children:
 *   - ScheduleEntityToggle (per-type / combined)
 *   - ScheduleFilterBar (4 axes)
 *   - SchedulePreviewTable (live `buildSchedule` rendering)
 *   - ScheduleFormatPicker (csv / xlsx / pdf + Export CTA)
 *
 * State ownership:
 *   - Dialog owns entityType / filters / format (session state).
 *   - Parent owns `open`, `activeRegion` (preserved across canvas FSM pick),
 *     `selectionIds` (live canvas selection).
 *
 * Region-pick flow (placeholder για M5):
 *   1. User clicks region-pick CTA σε FilterBar.
 *   2. Dialog καλεί `onRequestRegionPick(snapshot)` με full state.
 *   3. Parent αποθηκεύει snapshot + κλείνει dialog + ενεργοποιεί canvas
 *      FSM (M5 wires `useScheduleRegionPickTool`).
 *   4. FSM commits BBox → parent ανοίγει dialog ξανά με
 *      `initialEntityType` + `initialFilters` (region συμπληρωμένο) +
 *      `initialFormat` από το snapshot.
 *
 * Export flow:
 *   - `onExport` καλεί `downloadSchedule(schedule, format, options)` —
 *     SSoT dispatcher στο `bim/schedule/exporters`. Trigger DOM anchor
 *     download (no React state mutation).
 *
 * Google-level N.7.2:
 *   1. Proactive — buildSchedule memo στο render
 *   2. Race — internal state σύγχρονο, zero async cross-talk
 *   3. Idempotent — buildSchedule pure
 *   4. Belt&suspenders — disabled export όταν 0 rows + empty preview state
 *   5. SSoT — μόνο top-level barrel imports από bim/schedule
 *   6. Await — N/A (sync exporter trigger; xlsx/pdf lazy-import handled εσωτερικά)
 *   7. Lifecycle owner — Dialog owns session state, parent owns open/region/selection
 *
 * ADR-040: N/A (zero canvas, zero useSyncExternalStore).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  buildSchedule,
  downloadSchedule,
  type AnyBimEntity,
  type Schedule,
  type ScheduleEntityType,
  type ScheduleExportFormat,
  type ScheduleFilterCriteria,
  type ScheduleLookups,
} from '@/subapps/dxf-viewer/bim/schedule';
import type { BoundingBox3D } from '@/subapps/dxf-viewer/bim/types/bim-base';

import { ScheduleEntityToggle } from './ScheduleEntityToggle';
import { ScheduleFilterBar, type FilterOption } from './ScheduleFilterBar';
import { SchedulePreviewTable } from './SchedulePreviewTable';
import { ScheduleFormatPicker } from './ScheduleFormatPicker';
import { nowISO } from '@/lib/date-local';

// ─── Snapshot for region-pick pass-through (M5 hand-off) ─────────────────────

export interface BimScheduleSnapshot {
  readonly entityType: ScheduleEntityType;
  readonly filters: ScheduleFilterCriteria;
  readonly format: ScheduleExportFormat;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BimScheduleDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;

  /** All BIM entities in scope. Builder selects subset by entityType. */
  readonly entities: readonly AnyBimEntity[];
  readonly lookups: ScheduleLookups;

  /** Multi-select floor options (id + localized label). */
  readonly availableFloors: readonly FilterOption[];
  /** Multi-select category options (material OR kind labels merged). */
  readonly availableCategories: readonly FilterOption[];
  /** ADR-369 §9.2 Q2.4 — building options for filter dropdown. Omit in single-building context. */
  readonly availableBuildings?: readonly FilterOption[];
  /** Live canvas selection ids — used by selection-only filter axis. */
  readonly selectionIds: readonly string[];

  /** Region BBox preserved across canvas pick (M5 round-trip). */
  readonly activeRegion: BoundingBox3D | null;
  readonly onRequestRegionPick: (snapshot: BimScheduleSnapshot) => void;
  readonly onClearRegion: () => void;

  /** Initial state on open (defaults: combined / empty filters / xlsx). */
  readonly initialEntityType?: ScheduleEntityType;
  readonly initialFilters?: ScheduleFilterCriteria;
  readonly initialFormat?: ScheduleExportFormat;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ENTITY_TYPE: ScheduleEntityType = 'combined';
const DEFAULT_FILTERS: ScheduleFilterCriteria = {};
const DEFAULT_FORMAT: ScheduleExportFormat = 'xlsx';

// ─── Component ───────────────────────────────────────────────────────────────

export function BimScheduleDialog({
  open,
  onOpenChange,
  entities,
  lookups,
  availableFloors,
  availableCategories,
  availableBuildings,
  selectionIds,
  activeRegion,
  onRequestRegionPick,
  onClearRegion,
  initialEntityType = DEFAULT_ENTITY_TYPE,
  initialFilters = DEFAULT_FILTERS,
  initialFormat = DEFAULT_FORMAT,
}: BimScheduleDialogProps): React.JSX.Element {
  const { t } = useTranslation(['dxf-schedule']);

  const [entityType, setEntityType] = React.useState<ScheduleEntityType>(initialEntityType);
  const [filters, setFilters] = React.useState<ScheduleFilterCriteria>(initialFilters);
  const [format, setFormat] = React.useState<ScheduleExportFormat>(initialFormat);

  // Reset internal state όταν το dialog ανοίγει (closed → open transition).
  const wasOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setEntityType(initialEntityType);
      setFilters(initialFilters);
      setFormat(initialFormat);
    }
    wasOpenRef.current = open;
  }, [open, initialEntityType, initialFilters, initialFormat]);

  // Sync activeRegion prop → filters.region (parent-owned region from M5 FSM).
  React.useEffect(() => {
    setFilters((prev) =>
      activeRegion ? { ...prev, region: activeRegion } : { ...prev, region: undefined },
    );
  }, [activeRegion]);

  // Selection-only axis: toggle flips `filters.selectionIds` between live ids OR undefined.
  const selectionActive = (filters.selectionIds?.length ?? 0) > 0;
  const handleSelectionToggle = React.useCallback(
    (active: boolean) =>
      setFilters((prev) => ({ ...prev, selectionIds: active ? [...selectionIds] : undefined })),
    [selectionIds],
  );
  // Keep selectionIds fresh αν αλλάξει η canvas selection ενώ είναι active.
  React.useEffect(() => {
    setFilters((prev) =>
      prev.selectionIds && prev.selectionIds.length > 0
        ? { ...prev, selectionIds: [...selectionIds] }
        : prev,
    );
  }, [selectionIds]);

  // Build the schedule on every state change — pure, fast (no I/O).
  const schedule: Schedule = React.useMemo(
    () => buildSchedule(entities, { entityType, filters }, lookups),
    [entities, entityType, filters, lookups],
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleExport = React.useCallback(() => {
    if (schedule.rows.length === 0) return;
    const stamp = nowISO().slice(0, 10);
    const slug = entityType === 'combined' ? 'bim-schedule' : `bim-${entityType}`;
    void downloadSchedule(
      schedule,
      format,
      {
        filename: `${slug}-${stamp}`,
        title: t(`dxf-schedule:entityType.${entityType}`),
        rtl: false,
      },
      (key) => t(`dxf-schedule:${key}`),
    );
  }, [schedule, format, entityType, t]);

  const handleRequestRegionPick = React.useCallback(() => {
    onRequestRegionPick({ entityType, filters, format });
  }, [onRequestRegionPick, entityType, filters, format]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('dxf-schedule:dialog.title')}</DialogTitle>
          <DialogDescription>{t('dxf-schedule:dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <ScheduleEntityToggle value={entityType} onChange={setEntityType} />

          <ScheduleFilterBar
            criteria={filters}
            onChange={setFilters}
            availableFloors={availableFloors}
            availableCategories={availableCategories}
            availableBuildings={availableBuildings}
            selectionActive={selectionActive}
            selectionCount={selectionIds.length}
            onSelectionToggle={handleSelectionToggle}
            hasActiveRegion={activeRegion !== null}
            onRequestRegionPick={handleRequestRegionPick}
            onClearRegion={onClearRegion}
          />

          <SchedulePreviewTable schedule={schedule} />

          <ScheduleFormatPicker
            format={format}
            onChange={setFormat}
            onExport={handleExport}
            disabled={schedule.rows.length === 0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
