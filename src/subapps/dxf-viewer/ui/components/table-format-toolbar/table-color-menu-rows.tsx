'use client';

/**
 * ADR-739 Φ.Ε/Φ4β + §38 — **οι δύο σειρές του μενού χρώματος**: η εντολή της ζώνης 0 και η
 * επίπεδη ζώνη εγγράφου.
 *
 * ## Γιατί χωριστό αρχείο
 * Ζούσαν ως «Ιδιωτικά» στο τέλος του `TableAxisColorMenu.tsx`. Η νέα γραμμή «Αυτόματο» (§38)
 * έφερε το component στις **505/500** γραμμές (N.7.1) — και είναι η **δεύτερη** φορά που το ίδιο
 * αρχείο χτυπά το όριο (η πρώτη γέννησε το `table-color-menu-roles.ts` στις 501).
 *
 * **Εξαγωγή, ποτέ trim**: ο κώδικας και τα σχόλιά του μετακόμισαν αυτούσια. Η τομή είναι
 * φυσική και όχι αυθαίρετη γραμμή: εκεί μένει η **σύνθεση** του πάνελ (ποιες ζώνες, με ποια
 * σειρά, ποια εντολή γράφει τι), εδώ έρχεται το **πώς δείχνει μια σειρά** — καθαρή παρουσίαση,
 * μηδέν κατάσταση, μηδέν εγγραφή στο μοντέλο.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/table-color-menu-rows
 * @see TableAxisColorMenu.tsx — ο μοναδικός καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §35, §38
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { TABLE_CELL_SESSION_MARKER } from '../../table-cell-editor/table-cell-session-focus';
import { useRovingToolbar } from './use-roving-toolbar';
import styles from './TableAxisColorMenu.module.css';

export interface CommandRowProps {
  /**
   * Τι δείχνει το δείγμα — **τρία** πράγματα, όχι δύο:
   * `hex` το χρώμα · `'none'` το γλυφό «κανένα» (λευκό + κόκκινη διαγώνιος) · `'varies'` η
   * **μη-δήλωση** για μεικτή κληρονομιά (`<varies>` του Revit).
   *
   * 🔴 Το `'varies'` δεν είναι καλλωπισμός: το γλυφό «κανένα» είναι **θετικός ισχυρισμός**
   * («δεν θα βαφτεί τίποτα»), και σε μεικτό άξονα αυτός ο ισχυρισμός είναι ψευδής.
   *
   * ⚠️ ADR-739 §38 — ό,τι φτάνει εδώ ως `hex` οφείλει να είναι **πραγματικό** `#rrggbb`: το
   * σεντινέλι `AUTOMATIC_TABLE_INK` είναι **έγκυρη** τιμή για το CSS `background-color` (`auto`),
   * άρα δεν θα έσπαγε — απλώς δεν θα έβαφε, δίνοντας κενό τετράγωνο σε γραμμή που υπόσχεται
   * χρώμα. Ο καλών επιλύει (`resolveTableInk`) πριν φτάσει εδώ.
   */
  readonly swatch: string | 'none' | 'varies';
  readonly active: boolean;
  readonly label: string;
  readonly hint: string;
  readonly onActivate: () => void;
}

/**
 * Μια εντολή της ζώνης 0 — «Από το στυλ», «Αυτόματο» ή «Κανένα γέμισμα».
 *
 * ## Το δείγμα δείχνει το **πραγματικό** χρώμα που θα ισχύσει
 * Το Excel δείχνει εκεί ένα μόνιμα μαύρο τετράγωνο, που είναι ψέμα όποτε το στυλ λέει άλλο
 * χρώμα. Αφού το επιλυμένο χρώμα το ξέρουμε ούτως ή άλλως (το χρειάζεται ο ζωγράφος), το
 * δείχνουμε: ο χρήστης βλέπει *σε τι* επιστρέφει, όχι απλώς ότι επιστρέφει.
 *
 * ## 🔴 Μία γραμμή για τρεις εντολές, και όχι τρία components
 * Οι γραμμές διαφέρουν **μόνο** σε ετικέτα, υπόδειξη και δείγμα. Χωριστά components θα ήταν
 * τρία σημεία που μπορούν να αποκτήσουν διαφορετική συμπεριφορά εστίασης ή διαφορετικό
 * `role` — δηλαδή τρεις διαφορετικές απαντήσεις στον αναγνώστη οθόνης για την ίδια ομάδα radio.
 */
export function CommandRow({
  swatch, active, label, hint, onActivate,
}: CommandRowProps): React.ReactElement {
  const glyph = swatch === 'none' ? styles.swatchNone
    : swatch === 'varies' ? styles.swatchVaries
      : undefined;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      className={styles.command}
      onClick={onActivate}
      {...TABLE_CELL_SESSION_MARKER}
    >
      <span
        className={cn(styles.swatch, styles.commandSwatch, glyph)}
        style={glyph ? undefined : { backgroundColor: swatch }}
        aria-hidden="true"
      />
      <span className={styles.commandText}>
        {label}
        <span className={styles.commandHint}>{hint}</span>
      </span>
    </button>
  );
}

export interface DrawingColorsRowProps {
  readonly colors: readonly string[];
  readonly selected: string | undefined;
  readonly onPick: (hex: string) => void;
  readonly nameOf: (hex: string) => string;
}

/**
 * Η ζώνη εγγράφου — **επίπεδη**, χωρίς παραγόμενες αποχρώσεις.
 *
 * Τρεις από τους τέσσερις μεγάλους (Figma, Cinema 4D, ArchiCAD) τη δείχνουν έτσι· μόνο το Excel
 * φτιάχνει ράμπα, και τη φτιάχνει από θέμα εγγράφου **που το DXF δεν έχει**. Οριζόντιο roving:
 * είναι μία σειρά, όχι πλέγμα — τα `↑/↓` δεν έχουν πού να πάνε.
 */
export function DrawingColorsRow({
  colors, selected, onPick, nameOf,
}: DrawingColorsRowProps): React.ReactElement {
  const roving = useRovingToolbar(colors.length);
  return (
    <div className={styles.gridRow} role="group">
      {colors.map((hex, index) => {
        const item = roving.itemProps(index);
        return (
          <button
            key={hex}
            type="button"
            ref={item.ref}
            tabIndex={item.tabIndex}
            onKeyDown={item.onKeyDown}
            onFocus={item.onFocus}
            className={cn(styles.swatch, selected === hex && styles.swatchSelected)}
            style={{ backgroundColor: hex }}
            aria-label={nameOf(hex)}
            aria-pressed={selected === hex}
            onClick={() => onPick(hex)}
            {...TABLE_CELL_SESSION_MARKER}
          />
        );
      })}
    </div>
  );
}
