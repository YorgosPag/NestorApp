'use client';

/**
 * ADR-739 Φ.Ε/Φ4 — **το χρωματολόγιο**: 13 στήλες × 6 σειρές, σχήμα Excel, περιεχόμενο AutoCAD.
 *
 * Τα δεδομένα δεν γεννιούνται εδώ — έρχονται από το {@link ACI_COLOR_GRID}, όπου κάθε δείγμα
 * είναι **ακριβής** τιμή της παλέτας ACI (δες την κεφαλίδα εκείνου του module για το γιατί δεν
 * υπολογίζουμε αποχρώσεις όπως το Excel). Εδώ ζει μόνο η **παρουσίαση**.
 *
 * ## 🔴 Μία ένδειξη ονόματος, ΟΧΙ 78 tooltips
 * Η προφανής κίνηση είναι ένα `Tooltip` ανά δείγμα. Θα ήταν 78 στιγμιότυπα Radix που
 * μοντάρονται κάθε φορά που ανοίγει το μενού, για πληροφορία που ο χρήστης θέλει **ένα κάθε
 * φορά**. Η καρτέλα «Index Color» του AutoCAD λύνει ακριβώς το ίδιο πρόβλημα με μία γραμμή
 * κάτω από την παλέτα («if you hover over a color, the number of the color … is displayed below
 * the palette») — ένα στοιχείο, μηδέν μοντάρισμα, και είναι το ιδίωμα που ο μηχανικός ξέρει.
 *
 * Η γραμμή είναι `aria-hidden`: το όνομα υπάρχει ήδη στο `aria-label` κάθε δείγματος, και μια
 * live region θα ανακοίνωνε **δύο φορές** το ίδιο πράγμα σε κάθε μετακίνηση.
 *
 * ## Γιατί `role="grid"` και όχι λίστα κουμπιών
 * Οι στήλες **έχουν νόημα**: κάθε μία είναι η ίδια απόχρωση σε έξι φωτεινότητες. Ένα
 * μονοδιάστατο roving θα σήμαινε ότι το `↓` δεν κάνει τίποτα και ότι για να κατέβεις μία σειρά
 * πατάς `→` δεκατρείς φορές. Δες {@link useRovingToolbar} (παράμετρος `columns`).
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableColorSwatchGrid
 * @see ui/color/aci-color-grid.ts — τα δεδομένα και η εγγύηση εξαγωγής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.14
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import {
  ACI_GRID_HUE_KEYS,
  ACI_GRID_SHADE_KEYS,
  type AciGridColumn,
  type AciGridHueKey,
  type AciGridShadeKey,
  type AciGridSwatch,
} from '../../color/aci-color-grid';
import { useRovingToolbar } from './use-roving-toolbar';
import styles from './TableAxisColorMenu.module.css';

/**
 * Τα κλειδιά i18n, **ρητά γραμμένα** αντί για `t(\`…hue.${key}\`)`.
 *
 * Ένα δυναμικό κλειδί είναι αόρατο σε κάθε στατικό εργαλείο του έργου (CHECK 3.8 «λείπον
 * κλειδί», 3.33 φρεσκάδα τύπων, 3.34 shell slice) — δηλαδή μια ορθογραφία που λείπει από τα
 * locales θα εμφανιζόταν ως ωμό κλειδί **στην οθόνη**, με όλες τις πύλες πράσινες. Ο ρητός
 * χάρτης ελέγχεται εξαντλητικά και από τον μεταγλωττιστή: νέα απόχρωση χωρίς κλειδί δεν
 * μεταγλωττίζεται.
 */
const HUE_LABEL_KEY: Readonly<Record<AciGridHueKey, string>> = {
  neutral: 'table.colorMenu.hue.neutral',
  red: 'table.colorMenu.hue.red',
  orange: 'table.colorMenu.hue.orange',
  yellow: 'table.colorMenu.hue.yellow',
  chartreuse: 'table.colorMenu.hue.chartreuse',
  green: 'table.colorMenu.hue.green',
  springGreen: 'table.colorMenu.hue.springGreen',
  cyan: 'table.colorMenu.hue.cyan',
  azure: 'table.colorMenu.hue.azure',
  blue: 'table.colorMenu.hue.blue',
  violet: 'table.colorMenu.hue.violet',
  magenta: 'table.colorMenu.hue.magenta',
  rose: 'table.colorMenu.hue.rose',
};

const SHADE_LABEL_KEY: Readonly<Record<AciGridShadeKey, string>> = {
  light: 'table.colorMenu.shade.light',
  base: 'table.colorMenu.shade.base',
  dark1: 'table.colorMenu.shade.dark1',
  dark2: 'table.colorMenu.shade.dark2',
  dark3: 'table.colorMenu.shade.dark3',
  dark4: 'table.colorMenu.shade.dark4',
};

/**
 * Τα **τρία** δείγματα ολόκληρης της εφαρμογής που δεν έχουν δείκτη ACI — και έχουν όνομα.
 *
 * Το μαύρο (πλέγμα μελανιού **και** γεμίσματος) και οι δύο ανοιχτές βαθμίδες που το ACI δεν
 * διαθέτει (δες `aci-color-grid`: μεταξύ `#BEBEBE` και `#FFFFFF` η παλέτα δεν έχει τίποτα).
 * Χωρίς αυτόν τον χάρτη θα λέγονταν «Χρώμα #f2f2f2» — τεχνικά αληθές, αλλά ο μηχανικός δεν
 * διαβάζει hex για να καταλάβει ότι κοιτάζει το γκρι της κεφαλίδας.
 *
 * ⚠️ Πιο κάτω, όχι πιο πάνω: ένα άγνωστο hex **δεν** είναι σφάλμα — πέφτει στο `swatchHex`.
 * Ένας εξαντλητικός `Record` θα απαιτούσε ενημέρωση εδώ κάθε φορά που αλλάζει μια βαθμίδα, και
 * η τιμωρία της λήθης θα ήταν ωμό κλειδί στην οθόνη αντί για μια λιγότερο ωραία ετικέτα.
 */
const OFF_PALETTE_LABEL_KEY: Readonly<Record<string, string | undefined>> = {
  '#000000': 'table.colorMenu.black',
  '#f2f2f2': 'table.colorMenu.greyLighter',
  '#d9d9d9': 'table.colorMenu.greyLight',
};

export interface TableColorSwatchGridProps {
  /**
   * Ποιο πλέγμα — μελανιού ή γεμίσματος (`colorGridFor(role)`).
   *
   * Περνά ως δεδομένα και **δεν** διαλέγεται εδώ μέσα από τον ρόλο: έτσι το component μένει
   * καθαρή παρουσίαση, δοκιμάσιμο με στημένο πλέγμα, και η αντιστοίχιση ρόλου → παλέτα ζει σε
   * **ένα** σημείο (το `aci-color-grid`), όχι σε δύο που μπορούν να αποκλίνουν.
   */
  readonly grid: readonly AciGridColumn[];
  /** Το τρέχον χρώμα, **κανονικοποιημένο**· `undefined` όταν δεν υπάρχει ρητό χρώμα να δειχθεί. */
  readonly selected: string | undefined;
  readonly onPick: (hex: string) => void;
  /** Προσβάσιμο όνομα του πλέγματος. */
  readonly label: string;
}

const COLUMNS = ACI_GRID_HUE_KEYS.length;

export function TableColorSwatchGrid({
  grid, selected, onPick, label,
}: TableColorSwatchGridProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const [readout, setReadout] = useState<string | null>(null);

  /**
   * Το {@link ACI_COLOR_GRID} είναι **κατά στήλη** (μια στήλη = μια απόχρωση), το DOM όμως
   * γράφεται **κατά σειρά**. Η αντιμετάθεση γίνεται εδώ, μία φορά: αν την έκανε ο καταναλωτής,
   * ο επίπεδος δείκτης του roving (`σειρά × στήλες + στήλη`) θα έδειχνε σε άλλο δείγμα από
   * αυτό που βλέπει ο χρήστης.
   */
  const rows = useMemo(
    () => ACI_GRID_SHADE_KEYS.map((_, row) => grid.map((column) => column[row])),
    [grid],
  );

  const roving = useRovingToolbar(rows.length * COLUMNS, 'horizontal', COLUMNS);

  const nameOf = (swatch: AciGridSwatch): string => {
    if (swatch.aci !== undefined) {
      return t('table.colorMenu.swatchAci', {
        hue: t(HUE_LABEL_KEY[swatch.hue]),
        shade: t(SHADE_LABEL_KEY[swatch.shade]),
        index: swatch.aci,
      });
    }
    const named = OFF_PALETTE_LABEL_KEY[swatch.hex];
    return named ? t(named) : t('table.colorMenu.swatchHex', { color: swatch.hex });
  };

  return (
    <>
      <div role="grid" aria-label={label} className={styles.grid}>
        {rows.map((row, rowIndex) => (
          <div role="row" key={ACI_GRID_SHADE_KEYS[rowIndex]} className={styles.gridRow}>
            {row.map((swatch, columnIndex) => {
              const name = nameOf(swatch);
              const item = roving.itemProps(rowIndex * COLUMNS + columnIndex);
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  role="gridcell"
                  ref={item.ref}
                  tabIndex={item.tabIndex}
                  onKeyDown={item.onKeyDown}
                  onFocus={() => {
                    item.onFocus();
                    setReadout(name);
                  }}
                  onBlur={() => setReadout(null)}
                  onPointerEnter={() => setReadout(name)}
                  onPointerLeave={() => setReadout(null)}
                  className={cn(styles.swatch, selected === swatch.hex && styles.swatchSelected)}
                  style={{ backgroundColor: swatch.hex }}
                  aria-label={name}
                  aria-selected={selected === swatch.hex}
                  onClick={() => onPick(swatch.hex)}
                  {...TABLE_CELL_SESSION_MARKER}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/*
        Η γραμμή κρατά **πάντα** ύψος, ακόμη και κενή: αλλιώς το μενού θα πηδούσε κατά μία
        γραμμή τη στιγμή που ο δείκτης μπαίνει στην παλέτα, δηλαδή ακριβώς όταν ο χρήστης
        στοχεύει — και το δείγμα κάτω από το ποντίκι θα άλλαζε από μόνο του.
      */}
      <p className={styles.readout} aria-hidden="true">{readout ?? ' '}</p>
    </>
  );
}
