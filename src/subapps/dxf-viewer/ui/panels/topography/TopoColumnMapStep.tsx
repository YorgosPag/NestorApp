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
 * What stays HERE is what is specific to the table road: the live count underneath, which since
 * ADR-720 is `TopoImportPointSummary` — the same component the confirm step renders, so the two
 * screens cannot drift into describing the same file differently.
 */

import * as React from 'react';
import { TopoColumnMapTable } from './TopoColumnMapTable';
import { TopoImportPointSummary } from './TopoImportPointSummary';
import type { UseTopoImport } from './useTopoImport';
import styles from './TopoImportWizard.module.css';

interface Props {
  readonly wizard: UseTopoImport;
}

export function TopoColumnMapStep({ wizard }: Props): React.JSX.Element | null {
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

      <TopoImportPointSummary
        coverage={wizard.coverage}
        skippedCount={wizard.skippedCount}
        tone="preview"
      />
    </section>
  );
}
