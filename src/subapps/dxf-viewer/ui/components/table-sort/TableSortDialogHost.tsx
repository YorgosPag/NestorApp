'use client';

/**
 * 🔴 ADR-828 Φ4β — **Ο ΕΝΑΣ ΞΕΝΙΣΤΗΣ** του διαλόγου «Προσαρμοσμένη ταξινόμηση…».
 *
 * Ίδιο μοτίβο με τον `TableFormatCellsDialogHost` (ADR-739 §61) και για τον ίδιο λόγο: ο
 * εκκινητής είναι item υπομενού, δηλαδή κάτι που ξεμοντάρει τη στιγμή που το πατάς. Ζει στο
 * `DxfViewerDialogs`, τον τεκμηριωμένο «growth sink» των μόνιμα μονταρισμένων hosts.
 *
 * ## 🔑 ΤΟ «ΟΚ» ΠΕΡΝΑ ΑΠΟ ΤΗ ΜΙΑ ΠΟΡΤΑ
 * Η δέσμευση γίνεται με `TableFormatPort.commitModel(target, model)` — τον **ίδιο** δρόμο που
 * χρησιμοποιεί κάθε άλλη αλλαγή πίνακα από διάλογο. Δύο πόρτες προς την ίδια ουρά θα σήμαιναν
 * ότι η μέρα που η μία μαθαίνει φύλακα (π.χ. «μη γράφεις σε κλειδωμένο κελί») αφήνει την άλλη
 * πίσω, σιωπηλά — το ακριβές επιχείρημα που έκλεισε το `borders.commitModel` στο §61.
 *
 * ⚠️ Και ο **compare-and-swap** έρχεται δωρεάν από εκεί: το `target.model` είναι η βάση
 * σύγκρισης, άρα ένα `Ctrl+Z` ανάμεσα στο άνοιγμα και το «ΟΚ» δίνει άρνηση αντί για εγγραφή
 * πάνω σε πίνακα που δεν υπάρχει πια.
 *
 * @module subapps/dxf-viewer/ui/components/table-sort/TableSortDialogHost
 * @see state/table-sort-dialog-store.ts — η κατάσταση και η μία υποδοχή
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { columnLetter } from '@/lib/spreadsheet/column-letter';
import {
  closeTableSortDialog,
  useTableSortRequest,
  type TableSortRequestState,
} from '../../../state/table-sort-dialog-store';
import { getTableFormatPort } from '../../table-cell-editor/table-format-port';
import { rangeLabel } from '../../table-cell-editor/table-range-menu-target';
import { autoFillListCandidates } from '../../../settings/auto-fill-lists';
import { applyTableSort, planTableSort } from '../../../bim/table/table-sort-plan';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import type { TableSortCriterion, TableSortRefusal } from '../../../bim/table/table-sort-types';
import { TableSortDialog } from './TableSortDialog';
import { TABLE_SORT_KEYS } from './table-sort-labels';

/** Gate-at-mount: το δέντρο του διαλόγου ζει μόνο όσο υπάρχει αίτημα. */
export function TableSortDialogHost(): React.ReactElement | null {
  const request = useTableSortRequest();
  if (request === null) return null;
  // 🔑 Το `key` δεν είναι διακοσμητικό: τα επίπεδα είναι `useState` που σπέρνεται στο mount,
  // και ένα δεύτερο άνοιγμα πάνω σε άλλη περιοχή πρέπει να ξεκινά από φρέσκα κριτήρια.
  return <TableSortDialogMount key={request.id} request={request} />;
}

function TableSortDialogMount({
  request,
}: {
  readonly request: TableSortRequestState;
}): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer']);
  const { target, range } = request;
  const model = resolveTableModel(target.model);

  const columns = [];
  for (let index = range.firstCol; index <= range.lastCol; index += 1) {
    columns.push({ index, label: columnLetter(index) });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeTableSortDialog(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t(TABLE_SORT_KEYS.title)}</DialogTitle>
          <DialogDescription>
            {t(TABLE_SORT_KEYS.description, { range: rangeLabel(range) })}
          </DialogDescription>
        </DialogHeader>
        <TableSortDialog
          range={range}
          columns={columns}
          lists={autoFillListCandidates()}
          onCancel={closeTableSortDialog}
          onApply={(criteria, hasHeader) => {
            const refusal = commitSort(request, criteria, hasHeader, model);
            if (refusal === null) closeTableSortDialog();
            return refusal;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Δέσμευσε — ή δώσε τον **λόγο** που δεν έγινε.
 *
 * ⚠️ Το σχέδιο υπολογίζεται **πρώτα**, ώστε οι τέσσερις αρνήσεις της ταξινόμησης να φτάσουν
 * στον άνθρωπο ονομαστικά. Ένα σκέτο `applyTableSort` θα επέστρεφε σιωπηλά το ίδιο μοντέλο και
 * ο διάλογος θα έκλεινε σαν να έγινε κάτι — η ακριβής σιωπηλή αποτυχία που το §63 έκλεισε για
 * τη μορφοποίηση.
 *
 * ⚠️ **Χωρίς θύρα ⇒ `target-missing`, ποτέ σιωπή και ποτέ εξαίρεση**: ο διάλογος μπορεί να
 * επιβιώσει ένα καρέ μετά το ξεμοντάρισμα του καμβά, και εκεί ο πίνακας είναι όντως άφταστος.
 */
function commitSort(
  request: TableSortRequestState,
  criteria: readonly TableSortCriterion[],
  hasHeader: boolean,
  model: ReturnType<typeof resolveTableModel>,
): TableSortRefusal | 'target-missing' | null {
  const outcome = planTableSort(model, { range: request.range, criteria, hasHeader });
  if (!outcome.ok) return outcome.reason;

  const port = getTableFormatPort();
  if (!port) return 'target-missing';

  const next = applyTableSort(request.target.model, {
    range: request.range,
    criteria,
    hasHeader,
  });
  const plan = port.commitModel(request.target, next);
  return plan.status === 'refused' ? 'target-missing' : null;
}

export default TableSortDialogHost;
