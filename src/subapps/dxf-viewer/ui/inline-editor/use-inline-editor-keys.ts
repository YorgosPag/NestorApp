'use client';

/**
 * **SSoT: το πληκτρολόγιο ενός inline editor πάνω στον καμβά** — «Enter δεσμεύει · ESC ακυρώνει».
 *
 * ## Γιατί υπάρχει
 * Το DXF viewer έχει **τρεις** μικρούς επεξεργαστές που ζουν ως DOM πάνω από τον καμβά όσο γράφει
 * ο χρήστης: το `OpeningInfoTagEditorOverlay` (ADR-612, αριθμητικό κελί), το
 * `TableCellEditorOverlay` (ADR-739 Φ.Δ, κελί πίνακα) και — με δικό του, πλουσιότερο πληκτρολόγιο —
 * το `TextEditorOverlay` (ADR-344). Οι δύο πρώτοι είχαν **ταυτόσημες 15 γραμμές**: την ίδια
 * εγγραφή στον escape-bus και τον ίδιο `onKeyDown` για το Enter. Το CHECK 3.28 (jscpd, N.18) το
 * χαρακτήρισε clone — σωστά: ένας τέταρτος επεξεργαστής θα τις αντέγραφε ξανά, και μια αλλαγή στη
 * σημασιολογία του ESC θα έπρεπε να θυμηθεί **όλα** τα αντίγραφα.
 *
 * ## Τι ιδιοκτησία αναλαμβάνει
 * Ο **φρουρός «μία φορά»** (`committedRef`) ζει **εδώ**, όχι στα call sites. Αυτό δεν είναι
 * καλλωπισμός: το `onBlur={commit}` και το Enter μπορούν να πυροδοτήσουν **και τα δύο** στην ίδια
 * χειρονομία (το Enter δεσμεύει, ο editor ξεφορτώνεται, το input χάνει εστίαση → δεύτερο `commit`).
 * Χωρίς τον φρουρό αυτό είναι **δύο εντολές undo για μία πληκτρολόγηση**. Κάθε call site έπρεπε να
 * θυμηθεί να τον γράψει· τώρα δεν μπορεί να τον ξεχάσει.
 *
 * ## Τι ΔΕΝ αναλαμβάνει
 * Την **τιμή** και τον έλεγχό της: το αριθμητικό φίλτρο του info-tag (`NUMERIC_DRAFT`) και το
 * ελεύθερο κείμενο του κελιού πίνακα μένουν στα call sites. Ένας κοινός helper που δεχόταν και
 * σχήμα τιμής θα ήταν ο god-helper που απαγορεύει ο N.0.2 — η κοινή ουσία είναι **μόνο** το
 * πληκτρολόγιο.
 *
 * @module subapps/dxf-viewer/ui/inline-editor/use-inline-editor-keys
 * @see systems/escape-bus/useEscapeHandler — ADR-364, ο κεντρικός δίαυλος του ESC
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §19.9
 */

import { useCallback, useRef, type KeyboardEvent } from 'react';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';

export interface InlineEditorKeysOptions {
  /** Μοναδικό id εγγραφής στον escape-bus — ένα ανά επεξεργαστή. */
  readonly id: string;
  /** Τι σημαίνει «δέσμευσε»· καλείται **το πολύ μία φορά**. */
  readonly onCommit: () => void;
  /** Τι σημαίνει «ακύρωσε»· καλείται **το πολύ μία φορά**, και ποτέ μετά από commit. */
  readonly onCancel: () => void;
}

export interface InlineEditorKeys {
  /** Δέσμευση (Enter / blur). Ιδεμποτής: η δεύτερη κλήση δεν κάνει τίποτα. */
  readonly commit: () => void;
  /** Ακύρωση (ESC). Ιδεμποτής, και δεν εκτελείται αν έχει ήδη γίνει commit. */
  readonly cancel: () => void;
  /**
   * Χειριστής για το `onKeyDown` του πεδίου — Enter δεσμεύει· το ESC περνά από τον bus.
   *
   * Ο τύπος είναι `HTMLElement` και όχι `HTMLInputElement` επίτηδες: οι καταναλωτές είναι
   * ήδη **και** `<input>` (info-tag) **και** `<textarea>` (κελί πίνακα, από το βήμα 6), και
   * ο χειριστής δεν αγγίζει τίποτα ειδικό του στοιχείου — μόνο το `key`.
   */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * ADR-364 §10.14 — το ESC δρομολογείται **πάντα** από τον κεντρικό escape-bus, ποτέ με inline
 * σύγκριση `e.key === 'Escape'` (SSoT / CHECK 3.7). Το `allowWhenEditable` είναι απαραίτητο:
 * το input κρατά την εστίαση, που είναι ακριβώς η κατάσταση που παρακάμπτει η ασπίδα
 * «editable focus» του bus.
 */
export function useInlineEditorKeys({ id, onCommit, onCancel }: InlineEditorKeysOptions): InlineEditorKeys {
  const settledRef = useRef(false);

  const commit = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCommit();
  }, [onCommit]);

  const cancel = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  }, [onCancel]);

  useEscapeHandler({
    id,
    priority: ESC_PRIORITY.MODAL_DIALOG,
    allowWhenEditable: true,
    // Μόλις κριθεί η συνεδρία, ο επεξεργαστής παύει να διεκδικεί το ESC — αλλιώς θα το
    // κατάπινε από έναν χειριστή που δεν έχει πια τίποτα να ακυρώσει.
    canHandle: () => !settledRef.current,
    handle: () => {
      cancel();
      return true;
    },
  });

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Μόνο το Enter· το ESC ταξιδεύει από τον bus παραπάνω.
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
    },
    [commit],
  );

  return { commit, cancel, onKeyDown };
}
