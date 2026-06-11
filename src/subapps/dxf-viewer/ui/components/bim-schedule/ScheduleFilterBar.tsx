/**
 * BIM Schedule — Filter Bar (ADR-363 §6 Phase 8 / M4).
 *
 * 4 composable filter axes (one section each):
 *   1. Floor multi-select — checklist via ScrollArea + Checkbox primitives
 *   2. Category multi-select — heterogeneous (material OR entity kind labels)
 *   3. Region pick — CTA button που εκπέμπει `onRequestRegionPick` (M5 wires
 *      canvas FSM). Όταν `activeRegion` υπάρχει, εμφανίζει badge + clear.
 *   4. Selection-only — Checkbox toggle, ενεργό μόνο όταν `selectionCount > 0`.
 *
 * Filter criteria SSoT: `ScheduleFilterCriteria` από `bim/schedule/index.ts`.
 * Empty array σε καθορισμένο axis = match-nothing (intentional, ορισμός types).
 * Undefined axis = no filter.
 *
 * ADR-040: N/A (pure UI, zero canvas hooks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

'use client';

import * as React from 'react';
import { MapPin, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import type { ScheduleFilterCriteria } from '@/subapps/dxf-viewer/bim/schedule';

// ─── Public option shape ─────────────────────────────────────────────────────

export interface FilterOption {
  readonly id: string;
  readonly label: string;
}

interface ScheduleFilterBarProps {
  readonly criteria: ScheduleFilterCriteria;
  readonly onChange: (next: ScheduleFilterCriteria) => void;
  readonly availableFloors: readonly FilterOption[];
  readonly availableCategories: readonly FilterOption[];
  /** ADR-369 §9.2 Q2.4 — building options. Shown only when length > 1. */
  readonly availableBuildings?: readonly FilterOption[];
  /** True when user enabled the "selection-only" filter axis (real ids owned by orchestrator). */
  readonly selectionActive: boolean;
  readonly selectionCount: number;
  readonly onSelectionToggle: (active: boolean) => void;
  readonly hasActiveRegion: boolean;
  readonly onRequestRegionPick: () => void;
  readonly onClearRegion: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toggleId(list: readonly string[] | undefined, id: string): readonly string[] {
  const current = list ?? [];
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

// ─── Section: multi-select checklist ─────────────────────────────────────────

interface ChecklistSectionProps {
  readonly legend: string;
  readonly emptyHint: string;
  readonly options: readonly FilterOption[];
  readonly selected: readonly string[] | undefined;
  readonly onToggle: (id: string) => void;
  readonly idPrefix: string;
}

function ChecklistSection({
  legend,
  emptyHint,
  options,
  selected,
  onToggle,
  idPrefix,
}: ChecklistSectionProps): React.JSX.Element {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ScrollArea className="h-32 rounded-md border border-border bg-background p-2">
          <ul className="space-y-1.5">
            {options.map((option) => {
              const id = `${idPrefix}-${option.id}`;
              const checked = selected?.includes(option.id) ?? false;
              return (
                <li
                  key={option.id}
                  className={cn(
                    'flex items-center gap-2 rounded px-1.5 py-1 transition-colors',
                    checked ? 'bg-primary/10' : 'hover:bg-accent',
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => onToggle(option.id)}
                  />
                  <Label
                    htmlFor={id}
                    className={cn('cursor-pointer text-sm', checked && 'font-medium')}
                  >
                    {option.label}
                  </Label>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </fieldset>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function ScheduleFilterBar({
  criteria,
  onChange,
  availableFloors,
  availableCategories,
  availableBuildings,
  selectionActive,
  selectionCount,
  onSelectionToggle,
  hasActiveRegion,
  onRequestRegionPick,
  onClearRegion,
}: ScheduleFilterBarProps): React.JSX.Element {
  const { t } = useTranslation(['dxf-schedule']);

  const handleFloorToggle = React.useCallback(
    (id: string) => onChange({ ...criteria, floorIds: toggleId(criteria.floorIds, id) }),
    [criteria, onChange],
  );
  const handleCategoryToggle = React.useCallback(
    (id: string) => onChange({ ...criteria, categories: toggleId(criteria.categories, id) }),
    [criteria, onChange],
  );

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChecklistSection
        legend={t('dxf-schedule:filters.floor.label')}
        emptyHint={t('dxf-schedule:filters.floor.empty')}
        options={availableFloors}
        selected={criteria.floorIds}
        onToggle={handleFloorToggle}
        idPrefix="schedule-floor"
      />
      <ChecklistSection
        legend={t('dxf-schedule:filters.category.label')}
        emptyHint={t('dxf-schedule:filters.category.empty')}
        options={availableCategories}
        selected={criteria.categories}
        onToggle={handleCategoryToggle}
        idPrefix="schedule-category"
      />

      {(availableBuildings?.length ?? 0) > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            {t('dxf-schedule:filters.building.label')}
          </legend>
          <Select
            value={criteria.buildingIds?.[0] ?? ''}
            onValueChange={(v) =>
              onChange({ ...criteria, buildingIds: v === '' ? undefined : [v] })
            }
          >
            <SelectTrigger
              className="h-8 w-full"
              aria-label={t('dxf-schedule:filters.building.filterAria')}
            >
              <SelectValue placeholder={t('dxf-schedule:filters.building.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('dxf-schedule:filters.building.all')}</SelectItem>
              {availableBuildings!.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {t('dxf-schedule:filters.region.label')}
        </legend>
        {hasActiveRegion ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-accent px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="flex-1 text-foreground">{t('dxf-schedule:filters.region.active')}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClearRegion}>
              <X className="h-4 w-4" />
              <span className="sr-only">{t('dxf-schedule:filters.region.clear')}</span>
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onRequestRegionPick}>
            <MapPin className="h-4 w-4" />
            {t('dxf-schedule:filters.region.pick')}
          </Button>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {t('dxf-schedule:filters.selection.label')}
        </legend>
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border p-2 transition-colors',
            selectionActive ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background',
          )}
        >
          <Checkbox
            id="schedule-selection-only"
            checked={selectionActive}
            disabled={selectionCount === 0}
            onCheckedChange={(next) => onSelectionToggle(next === true)}
          />
          <Label
            htmlFor="schedule-selection-only"
            className={`cursor-pointer text-sm ${selectionCount === 0 ? 'text-muted-foreground' : ''}`}
          >
            {t('dxf-schedule:filters.selection.toggle', { count: selectionCount })}
          </Label>
        </div>
      </fieldset>
    </section>
  );
}
