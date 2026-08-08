'use client';

/**
 * ADR-750 Φ6 — **η ομάδα «Υποδείγματα»**: Κανένα · Πλαίσιο · Πλέγμα.
 *
 * ## 🔴 Το «Πλέγμα» γκριζάρει σε ΕΝΑ κελί — και δεν το αποφασίζει αυτό το αρχείο
 * Η απάντηση έρχεται από το {@link isTableBorderDialogPresetAvailable}, που την **παράγει** από
 * τη διαθεσιμότητα των θέσεών του. Ένας χειρόγραφος κανόνας εδώ (`rows > 1 || cols > 1`) θα
 * ήταν δεύτερος κανόνας δίπλα σε αυτόν που πράγματι εκτελείται — και σε επιλογή 1×3 (όπου το
 * `insideV` **υπάρχει**) οι δύο μπορούν να διαφωνήσουν.
 *
 * `aria-disabled` και όχι `disabled`: το κουμπί μένει ανακοινώσιμο και εστιάσιμο, ίδια σύμβαση
 * με κάθε ανενεργό στοιχείο της μπάρας (Α19) — ο χρήστης μαθαίνει ότι υπάρχει «Πλέγμα».
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableBorderDialogPresets
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  isTableBorderDialogPresetAvailable,
  type TableBorderDialogPresetId,
} from '../../../../bim/table/table-border-dialog-draft';
import type { TableCellRangeBounds } from '../../../../bim/table/table-cell-range';
import {
  TABLE_BORDER_DIALOG_KEY,
  TABLE_BORDER_DIALOG_PRESETS,
} from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

export interface TableBorderDialogPresetsProps {
  readonly bounds: TableCellRangeBounds;
  readonly onApply: (preset: TableBorderDialogPresetId) => void;
}

export function TableBorderDialogPresets({
  bounds, onApply,
}: TableBorderDialogPresetsProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');

  return (
    <div className={styles.presetRow}>
      {TABLE_BORDER_DIALOG_PRESETS.map((preset) => {
        const available = isTableBorderDialogPresetAvailable(preset, bounds);
        return (
          <button
            key={preset}
            type="button"
            className={styles.presetButton}
            aria-disabled={available ? undefined : true}
            onClick={() => {
              if (available) onApply(preset);
            }}
          >
            <PresetGlyph preset={preset} />
            <span>{t(`${TABLE_BORDER_DIALOG_KEY}.presets.${preset}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Το εικονίδιο ενός υποδείγματος: πλέγμα 2×2 με **ό,τι ακριβώς γράφει** η εντολή.
 *
 * Χάρτης τμημάτων και όχι τρία ξεχωριστά SVG: η μόνη διαφορά των τριών είναι **ποιες γραμμές**
 * ζωγραφίζονται, δηλαδή δεδομένα. Τρία σώματα θα ήταν το σχήμα που μετρά το jscpd — και το
 * τέταρτο υπόδειγμα (αν έρθει ποτέ) θα ζητούσε τέταρτο αντίγραφο.
 */
function PresetGlyph({ preset }: { readonly preset: TableBorderDialogPresetId }): React.ReactElement {
  const outline = preset === 'outline';
  const inside = preset === 'inside';
  return (
    <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      {/* Το «χαρτί»: πάντα εκεί, αχνό — δηλώνει ότι μιλάμε για κελιά, όχι για σχήματα. */}
      <rect x={3} y={3} width={20} height={20} fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.3} />
      {outline ? (
        <rect x={3} y={3} width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} />
      ) : null}
      {inside ? (
        <>
          <line x1={13} y1={3} x2={13} y2={23} stroke="currentColor" strokeWidth={1.8} />
          <line x1={3} y1={13} x2={23} y2={13} stroke="currentColor" strokeWidth={1.8} />
        </>
      ) : null}
    </svg>
  );
}
