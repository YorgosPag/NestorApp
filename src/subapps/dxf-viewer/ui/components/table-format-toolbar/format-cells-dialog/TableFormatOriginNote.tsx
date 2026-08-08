'use client';

/**
 * 🏆 ADR-739 §60 — **«ΠΟΙΟΣ ΤΟ ΑΠΟΦΑΣΙΣΕ;»**: η ερώτηση που το μοντέλο μπορούσε πάντα να
 * απαντήσει και **καμία** επιφάνεια δεν έκανε ποτέ.
 *
 * ## Τι δείχνει, και γιατί δύο πράγματα και όχι ένα
 * ```
 *   «Το ορίζει η ΣΤΗΛΗ»            → κληρονομιά· το κουμπί επαναφοράς είναι σβηστό
 *   «Ορισμένο σε αυτά τα ΚΕΛΙΑ»    → ρητό· το κουμπί επαναφοράς είναι ζωντανό
 *   «Διαφέρει ανά κελί»            → ο στόχος δεν έχει ΜΙΑ προέλευση
 * ```
 * Το `explicit` (§55) απαντά μόνο **ναι/όχι**. Σε πίνακα με τέσσερα επίπεδα κληρονομιάς αυτό
 * είναι μισή απάντηση: όταν λέει *όχι*, ο χρήστης μαθαίνει ότι κάποιος **άλλος** το είπε, χωρίς
 * να μάθει **ποιος** — δηλαδή δεν ξέρει πού να πάει να το αλλάξει σωστά.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΚΟΥΜΠΙ ΚΑΙ Η ΕΝΔΕΙΞΗ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΧΕΙΡΙΣΤΗΡΙΟ
 * Η «Επαναφορά σε κληρονομιά» έχει νόημα **ακριβώς όταν** η ένδειξη λέει «ρητό» — αλλιώς δεν
 * υπάρχει τι να αφαιρεθεί. Χωριστά, θα ήταν δύο στοιχεία που πρέπει να συμφωνούν και μπορούν να
 * μη συμφωνήσουν· μαζί, η συμφωνία είναι **δομική**: το `disabled` διαβάζεται από το ίδιο
 * `explicit` που γράφει το κείμενο.
 *
 * ⚠️ Είναι το idiom του Revit («By Category») και του Figma (detached override), φερμένο σε
 * **κελί πίνακα** — όπου κανένα από τα πέντε εργαλεία αναφοράς δεν το έχει. Το Excel προσφέρει
 * μόνο «Απαλοιφή μορφών», που σβήνει **ολόκληρο** το κελί: για να ξεκαρφώσεις τα δεκαδικά
 * χάνεις και τα έντονα και το γέμισμα.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatOriginNote
 * @see bim/table/table-format-origin.ts — η ανάγνωση (καθαρή, `bim/`)
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Info, RotateCcw } from 'lucide-react';
import type { TableFormatOriginState } from '../../../../bim/table/table-format-origin';
import {
  TABLE_FORMAT_CELLS_KEY,
  TABLE_FORMAT_ORIGIN_KEY,
} from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

export interface TableFormatOriginNoteProps {
  readonly origin: TableFormatOriginState;
  /** Ο στόχος δηλώνει το πεδίο **ρητά** — η προϋπόθεση της επαναφοράς. */
  readonly explicit: boolean;
  /** Σβήσε την παράκαμψη ⇒ επιστροφή στην κληρονομιά. */
  readonly onClear: () => void;
}

export function TableFormatOriginNote(
  props: TableFormatOriginNoteProps,
): React.ReactElement | null {
  const { origin, explicit, onClear } = props;
  const { t } = useTranslation('dxf-viewer');

  // `null` = ο στόχος δεν επιβίωσε. Καμία ένδειξη είναι η **ειλικρινής** απάντηση — μια
  // «κληρονομεί» εκεί θα ήταν δήλωση για κελιά που δεν υπάρχουν.
  if (origin === null) return null;

  return (
    <p className={styles.originNote}>
      <Info size={13} aria-hidden="true" className={styles.originIcon} />
      <span>
        {origin === 'mixed'
          ? t(`${TABLE_FORMAT_CELLS_KEY}.origin.mixed`)
          : t(TABLE_FORMAT_ORIGIN_KEY[origin])}
      </span>
      <button
        type="button"
        className={styles.originReset}
        // Εστιάσιμο και ανακοινώσιμο ακόμη κι όταν δεν κάνει τίποτα: ο χρήστης μαθαίνει ότι
        // **υπάρχει** επαναφορά και γιατί δεν εφαρμόζεται τώρα (Α19, ίδια σύμβαση με τη μπάρα).
        aria-disabled={explicit ? undefined : true}
        onClick={() => {
          if (explicit) onClear();
        }}
      >
        <RotateCcw size={12} aria-hidden="true" />
        {t(`${TABLE_FORMAT_CELLS_KEY}.origin.reset`)}
      </button>
    </p>
  );
}
