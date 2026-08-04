'use client';

/**
 * ADR-750 Φ6 — **το «Χρώμα:» του διαλόγου**: κληρονομιά, παλέτα, πλήρης επιλογέας.
 *
 * ## Γιατί ΔΕΝ γράφει στο store του μολυβιού (Α23)
 * Το χρώμα εδώ είναι **κατάσταση του διαλόγου**, όπως και το στυλ: ισχύει για τις **επόμενες**
 * ακμές που θα πατηθούν και εξαφανίζεται με το «Άκυρο». Το `table-border-pencil-store` κρατά
 * το μολύβι της **μπάρας**, που ζει πέρα από αυτόν τον διάλογο· γράψιμο εκεί θα σήμαινε ότι
 * ένα «Άκυρο» αφήνει πίσω του μόνιμη αλλαγή — δηλαδή το κουμπί θα έλεγε ψέματα.
 *
 * ## Γιατί επαναχρησιμοποιεί, και τι ακριβώς
 * Η **παλέτα** ({@link TableColorSwatchGrid}) και ο **πλήρης επιλογέας**
 * ({@link TableColorDialog}) είναι τα ίδια που βλέπει κάθε άλλο χρώμα της μπάρας — ίδια
 * δείγματα, ίδιο «Περισσότερα χρώματα…», ίδια πρόσφατα. Ένα δεύτερο χρωματολόγιο μέσα σε
 * διάλογο θα ήταν δεύτερη απάντηση στο «ποια χρώματα έχω;» (CHECK 3.28 / N.18).
 *
 * ⚠️ Το `grid` είναι **υποχρεωτικό** όρισμα του πλέγματος και κόστισε ήδη ένα ζωντανό
 * `TypeError` στη Φ5 (145 πράσινα tests, κανένα δεν άνοιξε τη γραμμή χρώματος).
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/TableBorderDialogColor
 */

import React, { useCallback, useId, useState } from 'react';
import { Palette } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { normalizeHexColor } from '../../../../config/color-math';
import { colorGridFor } from '../../../color/aci-color-grid';
import { getRecentColorsStore } from '../../../color/RecentColorsStore';
import { TableColorSwatchGrid } from '../TableColorSwatchGrid';
import { TableColorDialog } from '../TableColorDialog';
import { TABLE_BORDER_DIALOG_KEY } from './table-border-dialog-labels';
import styles from './TableBorderDialog.module.css';

/** Το κοινό «δέρμα» κάθε αναδυόμενης επιφάνειας — ίδιο με του πάνελ της μπάρας. */
const SURFACE_SKIN = 'border border-border rounded-lg bg-popover text-popover-foreground shadow-md';

export interface TableBorderDialogColorProps {
  /** Η **επιλογή** του χρήστη· `undefined` ⇒ «Από το στυλ» (Α20/Α23). */
  readonly selected: string | undefined;
  readonly onSelect: (hex: string | undefined) => void;
  /** Το χρώμα που θα **γραφτεί** πράγματι — επιλογή πάνω στο στυλ. Μόνο για το δείγμα. */
  readonly resolvedHex: string;
}

export function TableBorderDialogColor({
  selected, onSelect, resolvedHex,
}: TableBorderDialogColorProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState<string | null>(null);

  const pick = useCallback((rawHex: string | undefined) => {
    if (rawHex === undefined) {
      onSelect(undefined);
    } else {
      const hex = normalizeHexColor(rawHex);
      onSelect(hex);
      getRecentColorsStore().addColor(hex);
    }
    setOpen(false);
  }, [onSelect]);

  return (
    <span className={styles.colorAnchor}>
      <span className={styles.fieldLabel} id={labelId}>
        {t(`${TABLE_BORDER_DIALOG_KEY}.line.color`)}
      </span>

      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={styles.colorTrigger}
        onClick={() => setOpen((current) => !current)}
      >
        {/* Το χρώμα είναι **δεδομένο**, όχι θέμα — ίδια εξαίρεση με κάθε άλλο δείγμα (N.3). */}
        <span className={styles.colorSwatch} style={{ backgroundColor: resolvedHex }} aria-hidden="true" />
        <span>
          {selected === undefined
            ? t('table.borders.pencil.automatic')
            : t('table.colorMenu.swatchHex', { color: selected })}
        </span>
      </button>

      {open ? (
        <div className={cn(styles.colorPanel, SURFACE_SKIN)}>
          <button
            type="button"
            aria-pressed={selected === undefined}
            className={styles.plainRow}
            onClick={() => pick(undefined)}
          >
            {t('table.borders.pencil.automatic')}
          </button>
          <TableColorSwatchGrid
            grid={colorGridFor('ink')}
            selected={selected}
            onPick={pick}
            label={t('table.borders.pencil.basicColors')}
          />
          <button
            type="button"
            className={styles.plainRow}
            onClick={() => setPickerDraft(selected ?? resolvedHex)}
          >
            <Palette size={15} aria-hidden="true" />
            {t('table.borders.pencil.moreColors')}
          </button>
        </div>
      ) : null}

      <TableColorDialog
        draft={pickerDraft}
        title={t('table.borders.pencil.colorDialogTitle')}
        onDraftChange={setPickerDraft}
        onCancel={() => setPickerDraft(null)}
        onApply={(chosen) => {
          setPickerDraft(null);
          pick(chosen);
        }}
      />
    </span>
  );
}
