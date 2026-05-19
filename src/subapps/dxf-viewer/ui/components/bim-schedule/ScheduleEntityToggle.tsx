/**
 * BIM Schedule — Entity-Type Toggle (ADR-363 §6 Phase 8 / M4).
 *
 * RadioGroup με 9 mutually-exclusive options: 8 per-type schedules
 * (door / window / wall / slab / column / beam / stair / slab-opening) +
 * 'combined' (mixed mini-table). Drives `ScheduleConfig.entityType` στον
 * orchestrator (BimScheduleDialog).
 *
 * SSoT: type από `bim/schedule/index.ts` (top-level barrel). Labels
 * resolve via `dxf-schedule:entityType.<kind>` (M7 fills locales).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { ScheduleEntityType } from '@/subapps/dxf-viewer/bim/schedule';

// ─── Public option list (mirrors ScheduleEntityType union) ───────────────────

const ENTITY_TYPES: readonly ScheduleEntityType[] = [
  'combined',
  'door',
  'window',
  'wall',
  'slab',
  'column',
  'beam',
  'stair',
  'slab-opening',
] as const;

interface ScheduleEntityToggleProps {
  readonly value: ScheduleEntityType;
  readonly onChange: (next: ScheduleEntityType) => void;
}

/**
 * Per-type / combined selector. 'combined' lives first για discoverability
 * (αρχικό default στον orchestrator). Layout: 3-column grid σε ευρύ
 * container, single-column σε mobile (sm breakpoint).
 */
export function ScheduleEntityToggle({ value, onChange }: ScheduleEntityToggleProps): React.JSX.Element {
  const { t } = useTranslation(['dxf-schedule']);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        {t('dxf-schedule:entityType.label')}
      </legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as ScheduleEntityType)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {ENTITY_TYPES.map((kind) => {
          const id = `schedule-entity-${kind}`;
          return (
            <div
              key={kind}
              className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
            >
              <RadioGroupItem value={kind} id={id} />
              <Label htmlFor={id} className="cursor-pointer text-sm">
                {t(`dxf-schedule:entityType.${kind}`)}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
