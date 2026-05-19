/**
 * BIM Schedule — Format Picker + Export CTA (ADR-363 §6 Phase 8 / M4).
 *
 * RadioGroup με 3 format options (csv / xlsx / pdf) + primary «Εξαγωγή»
 * button. Disabled όταν 0 rows (orchestrator passes `disabled`). Export
 * action dispatch γίνεται από τον orchestrator μέσω `downloadSchedule`
 * (top-level barrel).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

'use client';

import * as React from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { ScheduleExportFormat } from '@/subapps/dxf-viewer/bim/schedule';

const FORMATS: readonly ScheduleExportFormat[] = ['xlsx', 'csv', 'pdf'] as const;

interface ScheduleFormatPickerProps {
  readonly format: ScheduleExportFormat;
  readonly onChange: (next: ScheduleExportFormat) => void;
  readonly onExport: () => void;
  readonly disabled: boolean;
}

export function ScheduleFormatPicker({
  format,
  onChange,
  onExport,
  disabled,
}: ScheduleFormatPickerProps): React.JSX.Element {
  const { t } = useTranslation(['dxf-schedule']);

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <fieldset className="flex-1">
        <legend className="mb-2 text-sm font-medium text-foreground">
          {t('dxf-schedule:format.label')}
        </legend>
        <RadioGroup
          value={format}
          onValueChange={(next) => onChange(next as ScheduleExportFormat)}
          className="flex flex-wrap gap-3"
        >
          {FORMATS.map((entry) => {
            const id = `schedule-format-${entry}`;
            return (
              <div
                key={entry}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
              >
                <RadioGroupItem value={entry} id={id} />
                <Label htmlFor={id} className="cursor-pointer text-sm">
                  {t(`dxf-schedule:format.${entry}`)}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </fieldset>

      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={onExport}
        disabled={disabled}
        className="sm:self-end"
      >
        <Download className="h-4 w-4" />
        {t('dxf-schedule:export.button')}
      </Button>
    </div>
  );
}
