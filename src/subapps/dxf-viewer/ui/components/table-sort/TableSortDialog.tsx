'use client';

/**
 * 🔴 ADR-828 Φ4β — **Ο ΔΙΑΛΟΓΟΣ «ΠΡΟΣΑΡΜΟΣΜΕΝΗ ΤΑΞΙΝΟΜΗΣΗ…»**: επίπεδα, φορά, και το
 * λεξιλόγιο που δεν ζει στα δεδομένα.
 *
 * ## 🔑 ΤΟ «ΜΕ ΛΙΣΤΑ» ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΑΥΤΟΣ Ο ΔΙΑΛΟΓΟΣ ΑΝΗΚΕΙ ΣΕ ΑΥΤΟ ΤΟ ADR
 * «Ιανουάριος, Φεβρουάριος, Μάρτιος» **δεν** είναι αλφαβητική σειρά, και καμία σύγκριση
 * κειμένου δεν μπορεί να την ανακαλύψει. Είναι η **ίδια** ερώτηση που απαντά η λαβή
 * συμπλήρωσης — «ποια είναι η διάταξη αυτών των ονομάτων;» — με την **ίδια** απάντηση: τις
 * λίστες του ανθρώπου. Γι' αυτό το LibreOffice τις λέει *Sort Lists*: η ταξινόμηση ήταν
 * πάντα ο δεύτερος καταναλωτής τους.
 *
 * ## Γιατί το «ΟΚ» μπορεί να αρνηθεί, και το λέει
 * Η ταξινόμηση έχει **τέσσερις** μετρημένες αρνήσεις (συγχώνευση, μπαγιάτικα όρια, κανένα
 * κριτήριο, ήδη ταξινομημένο). Το Excel τις δείχνει σε modal· εδώ εμφανίζονται **μέσα** στον
 * διάλογο, δίπλα στο κουμπί που τις προκάλεσε, και ο διάλογος **μένει ανοιχτός**: ο άνθρωπος
 * δεν χάνει τα επίπεδα που μόλις έστησε.
 *
 * @module subapps/dxf-viewer/ui/components/table-sort/TableSortDialog
 * @see bim/table/table-sort-plan.ts — η πράξη
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NameListCandidate } from '@/lib/string/name-list-match';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableSortCriterion, TableSortRefusal } from '../../../bim/table/table-sort-types';
import { TABLE_SORT_KEYS } from './table-sort-labels';

/** Ό,τι δεν είναι σειρά ή φορά: ποια λίστα, με **κενό κλειδί** για «φυσική σειρά». */
const NATURAL_ORDER = 'natural';

export interface TableSortDialogProps {
  readonly range: TableCellRangeBounds;
  /** Οι ετικέτες των στηλών της περιοχής, με τον **απόλυτο** δείκτη τους. */
  readonly columns: readonly { readonly index: number; readonly label: string }[];
  /** Οι λίστες του ανθρώπου — **οι ίδιες** που τροφοδοτούν τη λαβή συμπλήρωσης. */
  readonly lists: readonly NameListCandidate[];
  /** Εκτέλεσε· `null` σε επιτυχία, αλλιώς **ο λόγος** που δεν έγινε. */
  readonly onApply: (
    criteria: readonly TableSortCriterion[],
    hasHeader: boolean,
  ) => TableSortRefusal | 'target-missing' | null;
  readonly onCancel: () => void;
}

/** Ένα επίπεδο όπως το κρατά η φόρμα — η λίστα ως **κλειδί**, όχι ως αντικείμενο. */
interface Level {
  readonly columnIndex: number;
  readonly descending: boolean;
  readonly listKey: string;
}

export function TableSortDialog({
  range, columns, lists, onApply, onCancel,
}: TableSortDialogProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer']);
  const [hasHeader, setHasHeader] = useState(true);
  const [levels, setLevels] = useState<readonly Level[]>([
    { columnIndex: range.firstCol, descending: false, listKey: NATURAL_ORDER },
  ]);
  const [refusal, setRefusal] = useState<TableSortRefusal | 'target-missing' | null>(null);

  const patch = (at: number, next: Partial<Level>): void =>
    setLevels((prev) => prev.map((level, i) => (i === at ? { ...level, ...next } : level)));

  const handleApply = (): void => {
    setRefusal(
      onApply(
        levels.map((level) => ({
          columnIndex: level.columnIndex,
          descending: level.descending,
          byList: lists.find((list) => list.key === level.listKey),
        })),
        hasHeader,
      ),
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(event) => setHasHeader(event.target.checked)}
        />
        {t(TABLE_SORT_KEYS.hasHeader)}
      </label>

      <ul className="flex flex-col gap-2">
        {levels.map((level, index) => (
          // Κλειδί ο **δείκτης** και εδώ μόνο: τα επίπεδα δεν έχουν ταυτότητα — είναι θέσεις σε
          // διατεταγμένη λίστα, και δύο επίπεδα πάνω στην ίδια στήλη είναι νόμιμα.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="flex flex-wrap items-center gap-2">
            <Select
              value={String(level.columnIndex)}
              onValueChange={(value) => patch(index, { columnIndex: Number(value) })}
            >
              <SelectTrigger className="w-40" aria-label={t(TABLE_SORT_KEYS.columnLabel)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.index} value={String(column.index)}>
                    {column.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={level.descending ? 'desc' : 'asc'}
              onValueChange={(value) => patch(index, { descending: value === 'desc' })}
            >
              <SelectTrigger className="w-36" aria-label={t(TABLE_SORT_KEYS.orderLabel)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{t(TABLE_SORT_KEYS.ascending)}</SelectItem>
                <SelectItem value="desc">{t(TABLE_SORT_KEYS.descending)}</SelectItem>
              </SelectContent>
            </Select>

            {/*
              ⚠️ Το Radix Select **δεσμεύει** το `''` (CHECK 3.48): ένα `<SelectItem value="">`
              πετά σε χρόνο εκτέλεσης και ρίχνει ολόκληρη την επιφάνεια. Γι' αυτό η «φυσική
              σειρά» έχει ρητό κλειδί και όχι κενό.
            */}
            <Select
              value={level.listKey}
              onValueChange={(value) => patch(index, { listKey: value })}
            >
              <SelectTrigger className="w-44" aria-label={t(TABLE_SORT_KEYS.byListLabel)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NATURAL_ORDER}>{t(TABLE_SORT_KEYS.naturalOrder)}</SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.key} value={list.key}>
                    {list.key.replace(/^user:/u, '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {levels.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t(TABLE_SORT_KEYS.removeLevel)}
                onClick={() => setLevels((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() =>
          setLevels((prev) => [
            ...prev,
            { columnIndex: range.firstCol, descending: false, listKey: NATURAL_ORDER },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        {t(TABLE_SORT_KEYS.addLevel)}
      </Button>

      {/*
        🔑 `role="alert"`: ο λόγος εμφανίζεται **μετά** από πάτημα, δηλαδή τη στιγμή που ο
        αναγνώστης οθόνης έχει ήδη προχωρήσει. Χωρίς αυτό, ο άνθρωπος που δεν βλέπει την
        οθόνη θα βίωνε ένα «ΟΚ» που δεν κάνει τίποτα.
      */}
      {refusal !== null && (
        <p role="alert" className="text-xs text-destructive">
          {t(`${TABLE_SORT_KEYS.refusal}.${refusal}`)}
        </p>
      )}

      <footer className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t(TABLE_SORT_KEYS.cancel)}
        </Button>
        <Button type="button" size="sm" onClick={handleApply}>
          {t(TABLE_SORT_KEYS.apply)}
        </Button>
      </footer>
    </section>
  );
}
