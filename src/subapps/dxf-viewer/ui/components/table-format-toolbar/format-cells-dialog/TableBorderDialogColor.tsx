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
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableBorderDialogColor
 */

import React, { useCallback, useId, useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AnchoredPopover } from '@/components/ui/floating';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../../table-cell-editor/table-cell-session-focus';
import { normalizeHexColor } from '../../../../config/color-math';
import { colorGridFor } from '../../../color/aci-color-grid';
import { getRecentColorsStore } from '../../../color/RecentColorsStore';
import { TableColorSwatchGrid } from '../TableColorSwatchGrid';
import { TableColorDialog } from '../TableColorDialog';
import { TABLE_BORDER_DIALOG_KEY } from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

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
  /**
   * Η άγκυρα ως **στοιχείο**, όχι `ref`: το {@link AnchoredPopover} πρέπει να αποδώσει ξανά
   * όταν το κουμπί προσαρτηθεί, και ένα `useRef` δεν το προκαλεί αυτό (δες την κεφαλίδα του).
   */
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

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
        ref={setAnchor}
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
        {/*
          🔴 Το βελάκι είναι **λειτουργικό**, όχι διακοσμητικό: χωρίς αυτό η γραμμή διαβάζεται ως
          ετικέτα «Χρώμα: Από το στυλ» και κανείς δεν την πατά. Στο Excel το ίδιο χειριστήριο
          είναι combo με `▾` — η μόνη ένδειξη ότι υπάρχει επιλογή από κάτω. `aria-hidden` γιατί
          το «ανοίγει κάτι» το λέει ήδη το `aria-haspopup` στον αναγνώστη οθόνης.
        */}
        <ChevronDown size={14} aria-hidden="true" className={styles.colorCaret} />
      </button>

      {/*
        🔴 ADR-750 §21.10 — **top layer, όχι `absolute` παιδί.** Μετρημένο ζωντανά: η παλέτα
        άνοιγε κανονικά (`aria-expanded` → `true`, στοιχείο στο DOM, 246×217) και ψαλιδιζόταν
        στο **μηδέν** από το `<section className={styles.layout}>` του διαλόγου — που είναι
        δοχείο κύλισης χωρίς να το ζητήσει κανείς, επειδή το `globals.css:1105` δίνει
        `overflow-x: hidden` σε **κάθε** `<section>` και η προδιαγραφή CSS μετατρέπει τότε τον
        άλλο άξονα σε `auto`. Δες την κεφαλίδα του {@link AnchoredPopover}.

        🔑 Το `TABLE_CELL_SESSION_MARKER` ΔΕΝ είναι προαιρετικό εδώ: σε portal, το popup ζει
        **έξω** από τη σημαδεμένη γραμμή εργαλείων, οπότε ένα κλικ σε δείγμα θα διαβαζόταν από
        τον φύλακα ως «ο χρήστης έφυγε από τον πίνακα» και θα σκότωνε τη συνεδρία **ανάμεσα
        στο `mousedown` και το `click`** — δηλαδή θα ξαναγεννούσε ακριβώς το σφάλμα «ορατό
        αλλά νεκρό» που μόλις έκλεισε (ADR-739 §26.15, ADR-750 §21.9).
      */}
      <AnchoredPopover
        open={open}
        onOpenChange={setOpen}
        anchor={anchor}
        className={cn(styles.colorPanel, SURFACE_SKIN)}
        {...TABLE_CELL_SESSION_MARKER}
      >
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
      </AnchoredPopover>

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
