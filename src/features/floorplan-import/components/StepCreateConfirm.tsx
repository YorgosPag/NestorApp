'use client';

/**
 * StepCreateConfirm — βήμα 6 του οδηγού κάτοψης σε mode `'create'` (ADR-914).
 *
 * Αντί για ανέβασμα αρχείου, ο οδηγός δείχνει ΠΟΥ θα ανήκει η νέα κενή κάτοψη και περιμένει
 * επιβεβαίωση. Μόνο παρουσίαση: η δημιουργία γίνεται από τον καλούντα του οδηγού.
 *
 * @module features/floorplan-import/components/StepCreateConfirm
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FloorplanImportSelection } from '../hooks/floorplan-import-types';
import '@/lib/design-system';

interface StepCreateConfirmProps {
  readonly selection: FloorplanImportSelection;
}

/** Η διαδρομή ιδιοκτησίας, από το έργο προς τα μέσα — μία γραμμή ανά επίπεδο που επιλέχθηκε. */
const OWNERSHIP_ROWS: readonly {
  readonly labelKey: string;
  readonly pick: (selection: FloorplanImportSelection) => string | null;
}[] = [
  { labelKey: 'floorplanImport.steps.project', pick: (s) => s.projectName },
  { labelKey: 'floorplanImport.steps.building', pick: (s) => s.buildingName },
  { labelKey: 'floorplanImport.steps.floor', pick: (s) => s.floorName },
  { labelKey: 'floorplanImport.steps.property', pick: (s) => s.propertyName },
  { labelKey: 'floorplanImport.create.propertyLevel', pick: (s) => s.levelName },
];

/**
 * Τι επαναχρησιμοποιείται αντί να γεννηθεί — ίδιος κανόνας με τον provisioner (ADR-914 §2.2):
 * ταυτότητα έχουν μόνο ο όροφος και το (ακίνητο, όροφος). Έργο / κτίριο γεννούν πάντα νέα κάτοψη,
 * άρα εκεί δεν υπόσχεται τίποτα.
 */
function reuseHintKey(selection: FloorplanImportSelection): string | null {
  if (selection.propertyId) return 'floorplanImport.create.propertyReuseHint';
  if (selection.floorId) return 'floorplanImport.create.storeyReuseHint';
  return null;
}

export function StepCreateConfirm({ selection }: StepCreateConfirmProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const reuseKey = reuseHintKey(selection);
  const rows = OWNERSHIP_ROWS
    .map((row) => ({ label: t(row.labelKey), value: row.pick(selection) }))
    .filter((row): row is { label: string; value: string } => !!row.value);

  return (
    <section className="space-y-4 py-4" aria-labelledby="floorplan-create-heading">
      <header className="space-y-1">
        <h3 id="floorplan-create-heading" className="text-base font-semibold text-foreground">
          {t('floorplanImport.create.heading')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('floorplanImport.create.hint')}
          {reuseKey ? ` ${t(reuseKey)}` : ''}
        </p>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium text-foreground">{row.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}
