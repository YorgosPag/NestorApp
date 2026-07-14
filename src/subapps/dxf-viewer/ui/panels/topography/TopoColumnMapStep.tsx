'use client';
/**
 * ADR-650 Milestone 2 — the column-mapping step (the heart of the wizard).
 *
 * This is the screen that beats CASS: the surveyor never edits the file. A preset (PNEZD,
 * PENZD, …) or a per-column dropdown declares what each column MEANS, the preview grid
 * shows the file exactly as it is, and the point count updates live underneath.
 *
 * The grid itself is `TopoColumnMapTable` — shared with the ASCII point-cloud step since M8β/Δ,
 * because both roads ask the surveyor the same question and take the same `ColumnMapping` answer.
 * What stays HERE is what is specific to the table road: the live «N points / M skipped» count.
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { TopoColumnMapTable } from './TopoColumnMapTable';
import type { UseTopoImport } from './useTopoImport';
import styles from './TopoImportWizard.module.css';

interface Props {
  readonly wizard: UseTopoImport;
}

export function TopoColumnMapStep({ wizard }: Props): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-panels');
  const { table, mapping, unit } = wizard;

  if (!table) return null;

  return (
    <section className={styles.step}>
      <TopoColumnMapTable
        headers={table.headers}
        rows={table.rows}
        mapping={mapping}
        unit={unit}
        onRole={wizard.setRole}
        onPreset={wizard.applyPreset}
        onUnit={wizard.setUnit}
      />

      <p className={styles.status}>
        {t('topography.import.previewCount', { count: wizard.points.length })}
        {wizard.skippedCount > 0 ? ` · ${t('topography.import.previewSkipped', { count: wizard.skippedCount })}` : ''}
      </p>
    </section>
  );
}
