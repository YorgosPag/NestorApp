'use client';

/**
 * ADR-739 §39 — **«Εισαγωγή πίνακα…»**: ό,τι δεν χωρά στο πλέγμα 10×8.
 *
 * Το πλέγμα καλύπτει το συνηθισμένο· εδώ φτάνουν οι ακραίες τιμές (έως 256 στήλες × 1002
 * γραμμές) και το πλάτος στήλης. **Ίδιο λεξιλόγιο με το πλέγμα**: «Αριθμός γραμμών» σημαίνει
 * **σύνολο** — αν ο διάλογος μετρούσε γραμμές δεδομένων και το πλέγμα σύνολα, το ίδιο μενού
 * θα είχε δύο μονάδες μέτρησης.
 *
 * Το Escape το χειρίζεται το Radix `Dialog` (`onOpenChange`), όπως το `DimStyleCreateDialog`
 * — και το `ModalKeyboardScope` του `dialog.tsx` κλειδώνει τους global accelerators όσο είναι
 * ανοιχτός, οπότε τα βέλη δεν φτάνουν ποτέ στον καμβά.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/TableInsertDialog
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_TABLE_COLUMN_WIDTH_MM,
  sanitizeTableColumnWidthMm,
} from '../../../../bim/table/build-table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../../../types/table-entity';
import {
  MAX_TABLE_COLUMNS,
  MAX_TOTAL_TABLE_ROWS,
  MIN_TABLE_COLUMNS,
  MIN_TOTAL_TABLE_ROWS,
  type TableMenuSize,
  sanitizeMenuSize,
} from './table-size-menu-model';

interface TableInsertDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initialSize: TableMenuSize;
  readonly initialColumnWidthMm: number;
  readonly onConfirm: (size: TableMenuSize, columnWidthMm: number) => void;
}

/** Τα πεδία κρατούν **κείμενο**, όχι αριθμούς: ένα άδειο πεδίο είναι νόμιμη ενδιάμεση κατάσταση. */
interface DraftFields {
  readonly columns: string;
  readonly rows: string;
  readonly widthMm: string;
}

function toDraft(size: TableMenuSize, widthMm: number): DraftFields {
  return {
    columns: String(size.columnCount),
    rows: String(size.totalRowCount),
    widthMm: String(widthMm),
  };
}

/** Το φράγμα ζει στο `build-table-entity.ts` — εδώ γίνεται μόνο η ανάγνωση του κειμένου. */
function resolveDraft(draft: DraftFields): { size: TableMenuSize; widthMm: number } {
  const size = sanitizeMenuSize({
    columnCount: Number.parseInt(draft.columns, 10),
    totalRowCount: Number.parseInt(draft.rows, 10),
  });
  return { size, widthMm: sanitizeTableColumnWidthMm(Number.parseFloat(draft.widthMm)) };
}

export const TableInsertDialog: React.FC<TableInsertDialogProps> = ({
  open,
  onOpenChange,
  initialSize,
  initialColumnWidthMm,
  onConfirm,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [draft, setDraft] = useState<DraftFields>(() => toDraft(initialSize, initialColumnWidthMm));

  // Κάθε άνοιγμα ξεκινά από την τρέχουσα κατάσταση του store, όχι από ό,τι έμεινε πέρυσι.
  useEffect(() => {
    if (open) setDraft(toDraft(initialSize, initialColumnWidthMm));
  }, [open, initialSize, initialColumnWidthMm]);

  const handleConfirm = useCallback(() => {
    const { size, widthMm } = resolveDraft(draft);
    onConfirm(size, widthMm);
    onOpenChange(false);
  }, [draft, onConfirm, onOpenChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') handleConfirm();
    },
    [handleConfirm],
  );

  const field = (
    id: string,
    labelKey: string,
    value: string,
    min: number,
    max: number,
    onChange: (next: string) => void,
  ) => (
    <p className="dxf-table-insert-field">
      <label htmlFor={id}>{t(labelKey)}</label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('ribbon.commands.tableMenu.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('ribbon.commands.tableMenu.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <section className="dxf-table-insert-fields">
          {field(
            'dxf-table-insert-columns',
            'ribbon.commands.tableMenu.dialogColumns',
            draft.columns,
            MIN_TABLE_COLUMNS,
            MAX_TABLE_COLUMNS,
            (columns) => setDraft((d) => ({ ...d, columns })),
          )}
          {field(
            'dxf-table-insert-rows',
            'ribbon.commands.tableMenu.dialogRows',
            draft.rows,
            MIN_TOTAL_TABLE_ROWS,
            MAX_TOTAL_TABLE_ROWS,
            (rows) => setDraft((d) => ({ ...d, rows })),
          )}
          <p className="dxf-table-insert-hint">
            {t('ribbon.commands.tableMenu.dialogRowsHint', { min: MIN_TOTAL_TABLE_ROWS })}
          </p>
          {field(
            'dxf-table-insert-width',
            'ribbon.commands.tableMenu.dialogColumnWidth',
            draft.widthMm,
            MIN_TABLE_COLUMN_WIDTH_MM,
            MAX_TABLE_COLUMN_WIDTH_MM,
            (widthMm) => setDraft((d) => ({ ...d, widthMm })),
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('ribbon.commands.tableMenu.dialogCancel')}
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            {t('ribbon.commands.tableMenu.dialogConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
