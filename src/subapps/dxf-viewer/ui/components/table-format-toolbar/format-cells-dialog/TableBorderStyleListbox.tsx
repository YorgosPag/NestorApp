'use client';

/**
 * ADR-750 Φ6 — **το listbox «Στυλ:»**: 2 στήλες × 7 σειρές, η σειρά του Excel.
 *
 * ## 🔑 Η διάταξη ΔΕΝ ξαναδηλώνεται εδώ
 * Η σειρά (**κατά στήλη**) και το πλήθος έρχονται αυτούσια από το
 * {@link TABLE_BORDER_STYLES} / {@link TABLE_BORDER_STYLE_GRID}. Το CSS τα αποδίδει με
 * `grid-auto-flow: column`, δηλαδή η σειρά του DOM **είναι** η σειρά του καταλόγου — καμία
 * αναδιάταξη, κανένα δεύτερο ευρετήριο που μπορεί να αποκλίνει.
 *
 * ## 🔴 Γιατί `listbox`/`option` και όχι `radiogroup`
 * Και τα δύο εκφράζουν «διάλεξε ένα». Το APG όμως ορίζει το `radiogroup` για **ονομασμένες**
 * επιλογές που ο χρήστης διαβάζει· εδώ κάθε θέση είναι μια **εικόνα γραμμής** μέσα σε πλέγμα
 * που πλοηγείται σαν λίστα. Το `listbox` είναι ακριβώς αυτό, και δίνει δωρεάν τη σωστή
 * ανακοίνωση («λίστα, 14 στοιχεία, στοιχείο 7»), που το `radiogroup` δεν έχει.
 *
 * ⚠️ Το όνομα κάθε θέσης είναι **κρυφό κείμενο**, όχι `aria-label`: έτσι ο κατάλογος και οι
 * ετικέτες μένουν δύο λίστες που η άγκυρα του `table-border-style-catalog.test.ts` συγκρίνει —
 * και ένα ωμό κλειδί θα φαινόταν σε test με `getByRole('option', { name })`.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableBorderStyleListbox
 * @see bim/table/table-border-style-catalog.ts — οι 14 ταυτότητες και η σειρά τους
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { resolveLinetypePatternMm } from '../../../../rendering/linetype-dash-resolver';
import {
  TABLE_BORDER_STYLES,
  type TableBorderStyleId,
  type TableBorderStylePreset,
} from '../../../../bim/table/table-border-style-catalog';
import { TableLinePreview } from '../TableLinePreview';
import { useRovingToolbar } from '../use-roving-toolbar';
import { TABLE_BORDER_DIALOG_KEY } from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

export interface TableBorderStyleListboxProps {
  readonly selected: TableBorderStyleId;
  readonly onSelect: (id: TableBorderStyleId) => void;
  /** Το τρέχον χρώμα του μολυβιού· απόν ⇒ `currentColor` (κληρονομιά από το στυλ του πίνακα). */
  readonly colorHex?: string;
  readonly label: string;
}

export function TableBorderStyleListbox({
  selected, onSelect, colorHex, label,
}: TableBorderStyleListboxProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  // Κατακόρυφο roving: το `↓` πάει στην επόμενη θέση **της λίστας**, δηλαδή κατεβαίνει την
  // αριστερή στήλη και συνεχίζει στη δεξιά — η σειρά που βλέπει και ο χρήστης.
  const roving = useRovingToolbar(TABLE_BORDER_STYLES.length, 'vertical');

  return (
    <div role="listbox" aria-label={label} className={styles.styleGrid}>
      {TABLE_BORDER_STYLES.map((preset, index) => {
        const item = roving.itemProps(index);
        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            ref={item.ref}
            tabIndex={item.tabIndex}
            onKeyDown={item.onKeyDown}
            onFocus={item.onFocus}
            aria-selected={preset.id === selected}
            className={cn(
              styles.styleOption,
              preset.id === selected && styles.styleOptionSelected,
            )}
            onClick={() => onSelect(preset.id)}
          >
            <StyleSample preset={preset} colorHex={colorHex} />
            <span className="sr-only">
              {t(`${TABLE_BORDER_DIALOG_KEY}.lineStyles.${preset.id}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Η εικόνα μιας θέσης.
 *
 * Το «Καμία» δεν έχει γραμμή να δείξει — και **δεν** δείχνει κενό: δείχνει το όνομά του, όπως
 * κάνει και το Excel. Ένα κενό κουτί θα ήταν αδιάκριτο από «δεν φόρτωσε».
 *
 * Η **διπλή** ζωγραφίζεται με δύο παράλληλες: μία γραμμή θα την έκανε οπτικά ταυτόσημη με τη
 * «συνεχή λεπτή» δύο θέσεις πιο πάνω, δηλαδή το listbox θα είχε δύο ίδια κουτάκια.
 */
function StyleSample({
  preset, colorHex,
}: {
  readonly preset: TableBorderStylePreset;
  readonly colorHex?: string;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const pen = preset.pen;
  if (!pen) {
    return (
      <span className={styles.styleNone} aria-hidden="true">
        {t(`${TABLE_BORDER_DIALOG_KEY}.line.styleNone`)}
      </span>
    );
  }

  const patternMm = resolveLinetypePatternMm(pen.linetypeName);
  const line = (
    <TableLinePreview
      patternMm={patternMm}
      widthMm={pen.widthMm}
      colorHex={colorHex}
      className={styles.styleLine}
    />
  );
  if (pen.double !== true) return line;

  return (
    <span className={styles.styleDouble} aria-hidden="true">
      {line}
      <TableLinePreview
        patternMm={patternMm}
        widthMm={pen.widthMm}
        colorHex={colorHex}
        className={styles.styleLine}
      />
    </span>
  );
}
