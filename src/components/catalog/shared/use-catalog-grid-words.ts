'use client';
/**
 * **Οι λέξεις του γενικού πλέγματος στον κατάλογο** (ADR-923 §5.10.4) — ένα σημείο για λίστα, παραλλαγές, πίνακες.
 *
 * Το `DataGrid` δεν φέρνει δικές του λέξεις (κανένα κόστος στο κέλυφος i18n)· τις δίνει ο καλών από το namespace της
 * σελίδας. Η ανακοίνωση επικόλλησης λέει **πάντα** τι δεν μπήκε (κόπηκε · κλειδωμένο · απορρίφθηκε).
 *
 * @module components/catalog/shared/use-catalog-grid-words
 */

import { useMemo } from 'react';

import type { DataGridWords } from '@/components/ui/data-grid/data-grid-types';

import { useCatalogText } from './catalog-ui-hooks';

export function useCatalogGridWords(): DataGridWords {
  const { t } = useCatalogText();
  return useMemo(() => ({
    pasted: (report, rejected) => t('grid.pasted', {
      rows: report.offeredRows,
      cols: report.offeredCols,
      appended: report.appendedRows,
      clipped: report.clippedRows * report.offeredCols + report.clippedCols * Math.max(report.offeredRows - report.clippedRows, 0),
      locked: report.skippedReadOnly,
      rejected,
    }),
    locked: (reason) => t('grid.locked', { reason }),
    choicesLabel: (column) => t('grid.choices', { column }),
    empty: t('grid.empty'),
  }), [t]);
}
