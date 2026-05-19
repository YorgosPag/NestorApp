/**
 * BIM Schedule — Preview Table (ADR-363 §6 Phase 8 / M4).
 *
 * Renders `Schedule.rows` σε ένα read-only grid mirror του τελικού export.
 * Headers via `t('dxf-schedule:<column.i18nKey>')`. Cell values via
 * `formatCellForDisplay` (SSoT formatter — ίδια λογική με xlsx/PDF
 * exporters, ώστε preview === export bit-for-bit).
 *
 * Empty state: η `buildSchedule` επιστρέφει column schema ακόμη και με 0
 * rows. Εμφανίζουμε translated message αντί για κενό table.
 *
 * ADR-040: N/A (zero canvas, zero high-frequency hooks).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

'use client';

import * as React from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { formatCellForDisplay, type Schedule } from '@/subapps/dxf-viewer/bim/schedule';

interface SchedulePreviewTableProps {
  readonly schedule: Schedule;
}

function alignmentClass(align: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function SchedulePreviewTable({ schedule }: SchedulePreviewTableProps): React.JSX.Element {
  const { t } = useTranslation(['dxf-schedule']);

  if (schedule.rows.length === 0) {
    return (
      <section
        aria-label={t('dxf-schedule:preview.title')}
        className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/30"
      >
        <p className="text-sm text-muted-foreground">{t('dxf-schedule:preview.empty')}</p>
      </section>
    );
  }

  return (
    <section aria-label={t('dxf-schedule:preview.title')} className="space-y-2">
      <header className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('dxf-schedule:preview.rowCount', { count: schedule.rows.length })}
        </p>
      </header>
      <ScrollArea className="h-72 rounded-md border border-border bg-background">
        <Table size="compact">
          <TableHeader>
            <TableRow>
              {schedule.columns.map((column) => (
                <TableHead key={column.key} className={alignmentClass(column.align)}>
                  {t(`dxf-schedule:${column.i18nKey}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.rows.map((row) => (
              <TableRow key={row.entityId}>
                {schedule.columns.map((column) => (
                  <TableCell key={column.key} className={alignmentClass(column.align)}>
                    {formatCellForDisplay(row.cells[column.key] ?? null, column.valueType)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </section>
  );
}
