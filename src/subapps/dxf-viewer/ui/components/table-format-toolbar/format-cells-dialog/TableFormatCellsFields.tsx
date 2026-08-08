'use client';

/**
 * 🔴 ADR-739 §60 — **τα δύο σχήματα πεδίου** του διαλόγου «Μορφοποίηση κελιών»: ένα πτυσσόμενο
 * με ετικέτα, και ένα κουτάκι με ετικέτα.
 *
 * ## Γιατί υπάρχει — **το έπιασε η πύλη, όχι η επιθεώρηση** (N.18 / CHECK 3.28)
 * Οι δύο καρτέλες γράφτηκαν χωριστά και κατέληξαν με **έξι** αντίγραφα του ίδιου εφτάγραμμου
 * σώματος (`label` + `Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `map`).
 * Το `jscpd --diff` τα ονόμασε μέσα στο ίδιο commit — ακριβώς ο **sibling clone** που ο κανόνας
 * N.18 υπάρχει για να πιάνει, και που καμία ανάγνωση δεν βλέπει επειδή κάθε αντίγραφο είναι
 * σωστό μόνο του.
 *
 * 🔑 Και δεν είναι ζήτημα γραμμών: έξι αντίγραφα είναι **έξι** ευκαιρίες να μάθει το ένα
 * διαφορετική σημασιολογία για το «ανάμεικτο» — και το σύμπτωμα θα ήταν ένα πτυσσόμενο που
 * δείχνει την τιμή του **πρώτου** κελιού σαν να ισχύει παντού.
 *
 * ## 🔴 ΤΟ «ΑΝΑΜΕΙΚΤΟ» ΕΙΝΑΙ `null`, ΠΟΤΕ ΚΕΝΟ ΑΛΦΑΡΙΘΜΗΤΙΚΟ
 * Το Radix Select **δεσμεύει** το `''` ως «καμία επιλογή»: ένα `value=""` σε `SelectItem` πετά
 * σε dev και **ολόκληρη η επιφάνεια δεν αποδίδεται** (§59.6.3 — το βρήκε άνθρωπος ανοίγοντας
 * την καρτέλα, με όλες τις πύλες πράσινες). Εδώ η «καμία επιλογή» εκφράζεται με `undefined`
 * στο `value` του **Select**, όχι με τιμή σε option: το `placeholder` δείχνει «Διαφέρει», όπως
 * το κενό combobox του Excel.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsFields
 */

import React, { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TABLE_CELL_SESSION_MARKER } from '../../../table-cell-editor/table-cell-session-focus';
import styles from './TableFormatCellsDialog.module.css';

/** Μια επιλογή: η **τιμή του μοντέλου** και το κείμενο που διαβάζει ο άνθρωπος. */
export interface TableFormatCellsOption<V extends string> {
  readonly value: V;
  readonly label: string;
}

export interface TableFormatCellsSelectProps<V extends string> {
  readonly label: string;
  /** `null` ⇒ ανάμεικτος στόχος: **καμία** επιλογή, ποτέ η πρώτη. */
  readonly value: V | null;
  /** Τι δείχνει το κλειστό πεδίο σε ανάμεικτο στόχο («Διαφέρει»). */
  readonly placeholder: string;
  readonly options: readonly TableFormatCellsOption<V>[];
  readonly onChange: (value: V) => void;
}

/**
 * Πτυσσόμενο με ετικέτα — **ένα** σώμα για τα έξι πεδία του διαλόγου.
 *
 * Γενικό ως προς τον τύπο τιμής, ώστε ο καλών να μη χρειάζεται cast: το `onChange` επιστρέφει
 * την **ίδια** ένωση που έδωσε στα `options`. Ένα `(value: string) => void` θα έσπρωχνε ένα
 * `as TableDateStyle` σε κάθε κλήση — δηλαδή θα έσβηνε τον έλεγχο που κάνει αδύνατο να
 * προσγειωθεί μονάδα γωνίας στο πεδίο της ημερομηνίας (N.2).
 */
export function TableFormatCellsSelect<V extends string>(
  props: TableFormatCellsSelectProps<V>,
): React.ReactElement {
  const { label, value, placeholder, options, onChange } = props;
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
      <Select
        value={value ?? undefined}
        onValueChange={(next) => onChange(next as V)}
      >
        <SelectTrigger id={id} className={styles.selectTrigger}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        {/*
          🔴 ADR-739 §62 — **ΤΟ ΣΗΜΑΔΙ ΣΤΟ PORTAL, ΚΑΙ ΕΔΩ ΕΙΝΑΙ Η ΜΟΝΗ ΘΕΣΗ ΤΟΥ.**

          Το `SelectContent` αποδίδεται μέσα σε `SelectPrimitive.Portal`, δηλαδή στο `document.body`
          και **έξω** από τον περιτυλιγμένο `<div>` του διαλόγου που φέρει το σημάδι. Το ADR-750 Φ6β
          πλήρωσε ακριβώς αυτό το τίμημα για την παλέτα χρωμάτων και άφησε άγκυρα· τα επτά
          πτυσσόμενα του **ίδιου** διαλόγου το επανέλαβαν σιωπηλά, γιατί κανείς δεν ξαναρώτησε.

          Μετρημένο (2026-08-08, jsdom με πραγματικό Radix Select): χωρίς αυτή τη γραμμή το
          `option.closest('[data-table-cell-cursor="true"]')` είναι **`null`** για κάθε επιλογή.
          Ζωντανά αυτό σημαίνει: το `<textarea>` του κελιού κάνει `blur` με `relatedTarget` **μέσα
          στο portal** ⇒ ο φύλακας δεν βρίσκει σημάδι ⇒ ούτε δήλωση pointer, ούτε keepalive ⇒
          `onClose()`: **ο δρομέας κελιού πεθαίνει με το πρώτο πτυσσόμενο** — και το §60 είχε ήδη
          γράψει ότι με επτά πτυσσόμενα αυτό δεν είναι ενόχληση, είναι διάλογος που δεν συμπληρώνεται.

          ⚠️ Μπαίνει **εδώ**, στο ΕΝΑ κοινό σώμα των επτά πεδίων, και όχι στις υποδοχές: επτά
          ατομικά σημάδια είναι επτά ευκαιρίες να ξεχαστεί το όγδοο — κατά λέξη η αστοχία που
          τεκμηριώνει το ADR-750 §21.9 («20+ σημεία σε 12 αρχεία»).
        */}
        <SelectContent {...TABLE_CELL_SESSION_MARKER}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface TableFormatCellsCheckProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}

/**
 * Κουτάκι με ετικέτα — τα τρία «ναι/όχι» του διαλόγου (χιλιάδες · αναδίπλωση · σμίκρυνση).
 *
 * ⚠️ Το `onCheckedChange` του Radix δίνει `boolean | 'indeterminate'`. Ο έλεγχος `next === true`
 * δεν είναι αμυντικός: το `'indeterminate'` είναι **αληθές** σε σκέτο boolean context, οπότε ένα
 * `Boolean(next)` θα διάβαζε «μερικώς τσεκαρισμένο» ως «τσεκαρισμένο».
 */
export function TableFormatCellsCheck(props: TableFormatCellsCheckProps): React.ReactElement {
  const { label, checked, onChange } = props;
  const id = useId();
  return (
    <div className={styles.checkRow}>
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
    </div>
  );
}
