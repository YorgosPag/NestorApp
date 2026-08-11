'use client';

/**
 * 🔴 ADR-755 — **ο κύκλος ζωής ενός πτυσσόμενου πάνελ του mini toolbar**, σε ένα σημείο.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο)
 * Το `TableMergeMenu` γεννήθηκε ως **τρίτο** πτυσσόμενο της γραμμής και αντέγραψε — χωρίς να το
 * θέλει — τα ίδια τέσσερα πράγματα από τα δύο προηγούμενα: την κατάσταση `isOpen`, το `useId`
 * του πάνελ, το «εκτέλεσε → κλείσε → γύρνα την εστίαση στον trigger», και το `Escape` που
 * κλείνει **ένα** επίπεδο. Το jscpd το μέτρησε σε 10 γραμμές / 53 tokens.
 *
 * ## Οι ΤΡΕΙΣ αποφάσεις που κωδικοποιεί — και γιατί ΔΕΝ είναι λεπτομέρειες
 * 1. **Η εστίαση γυρίζει στον trigger** μετά από κάθε εντολή — **μόνο αν ο trigger την είχε**
 *    (§25.6). Χωρίς την επιστροφή, ο χρήστης πληκτρολογίου μένει σε στοιχείο που μόλις
 *    ξεμόνταρε· χωρίς τον όρο, η επιστροφή γίνεται **κλοπή** από το κελί που γράφει.
 * 2. **`stopPropagation` στο `Escape`**: ένα `Escape` = ένα επίπεδο. Χωρίς αυτό, ο γονέας θα
 *    έβλεπε το ίδιο πλήκτρο και θα έκλεινε **και** το μενού από κάτω — δύο επιφάνειες με ένα
 *    πάτημα, ενώ ο χρήστης ζήτησε να φύγει μόνο η λίστα που μόλις άνοιξε.
 * 3. 🔴 **§26.8 — ΠΟΙΟΣ ΕΙΧΕ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΠΡΙΝ ΑΝΟΙΞΕΙ ΤΟ ΠΑΝΕΛ** ({@link
 *    ToolbarPanelController.mayTakeKeyboard}). Η απόφαση (1) απαντά «*πού γυρίζει η εστίαση;*»
 *    και η (3) «*φεύγει καν;*» — και η δεύτερη είναι **προϋπόθεση** της πρώτης: όσο το πάνελ
 *    έπαιρνε το πληκτρολόγιο με `autoFocus` στο άνοιγμα, ο όρος της (1) ήταν δομικά **πάντα
 *    ψευδής** για τον χρήστη ποντικιού, δηλαδή η διόρθωση του §25.6 έπεφτε στο κενό ακριβώς
 *    στα τέσσερα πάνελ που έχουν `autoFocus`.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-toolbar-panel
 * @see ui/table-cell-editor/table-cell-keyboard-ownership.ts — ο ΕΝΑΣ ορισμός ιδιοκτησίας
 */

import { useCallback, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import {
  focusUnlessTableCellFieldOwnsKeyboard,
  tableCellPanelMayClaimKeyboard,
} from '../../table-cell-editor/table-cell-keyboard-ownership';

export interface ToolbarPanelController {
  readonly isOpen: boolean;
  /**
   * 🔴 ADR-753 §26.8 — **επιτρέπεται σε αυτό το άνοιγμα να πάρει το πληκτρολόγιο;** Απαντήθηκε
   * τη στιγμή που ο χρήστης άνοιξε το πάνελ, και **δεν** ξαναρωτιέται όσο μένει ανοιχτό.
   *
   * Ο καταναλωτής το περνά ως `autoFocus` στο **πρώτο** στοιχείο της λίστας:
   * `autoFocus={index === 0 && panel.mayTakeKeyboard}`.
   *
   * | Ποιος άνοιξε | Τιμή | Τι βλέπει ο χρήστης |
   * |---|---|---|
   * | ποντίκι, ενώ γράφει στο κελί | `false` | ο δρομέας **μένει** στο κελί· διαλέγει χρώμα και συνεχίζει να γράφει (Excel) |
   * | `Tab`/βέλη στη γραμμή (ο trigger είχε την εστίαση) | `true` | ο πρώτος εστιάζεται· τα βέλη δουλεύουν (APG) |
   * | ποντίκι, χωρίς ανοιχτή συνεδρία κελιού | `true` | καμία εστίαση δεν υπήρχε για να διατηρηθεί |
   *
   * ⚠️ **Χρονική στιγμή, όχι γούστο.** Η ερώτηση απαντιέται στο `toggle()` επειδή εκεί —και μόνο
   * εκεί— η απάντηση είναι ακόμη «*ποιος είχε το πληκτρολόγιο **πριν** ανοίξει το πάνελ;*». Ένα
   * καρέ αργότερα, μέσα στην απόδοση, το `autoFocus` έχει ήδη προλάβει να αλλάξει την απάντηση —
   * δηλαδή το κατηγόρημα θα επικύρωνε τον εαυτό του.
   */
  readonly mayTakeKeyboard: boolean;
  /** Για το `aria-controls` του trigger και το `id` του πάνελ. */
  readonly panelId: string;
  /** Ο trigger, ώστε να επιστρέφει εκεί η εστίαση στο κλείσιμο. */
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly toggle: () => void;
  /** Εκτελεί την εντολή, κλείνει το πάνελ και επιστρέφει την εστίαση στον trigger. */
  readonly runAndClose: (action: () => void) => void;
  /** `Escape` ⇒ κλείνει **μόνο** αυτό το πάνελ (δες την κεφαλίδα). */
  readonly onPanelKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly close: () => void;
}

/**
 * Το άνοιγμα και η απάντησή του, σε **ένα** state και ως **διακριτή ένωση**.
 *
 * Χωριστά `useState` θα επέτρεπαν τον ενδιάμεσο συνδυασμό «ανοιχτό με μπαγιάτικη απάντηση» — η
 * μία από τις δύο ενημερωμένη και η άλλη όχι. Εδώ η απάντηση **γεννιέται μαζί** με το άνοιγμα
 * και πεθαίνει μαζί του.
 *
 * 🔴 Η ένωση δεν είναι κομψότητα, είναι **μέτρηση**: με ένα επίπεδο αντικείμενο, η τιμή του
 * `mayTakeKeyboard` στο **κλειστό** state ήταν παρατηρήσιμα αδιάφορη — μετάλλαξή της σε `true`
 * άφηνε **και τις 37 άγκυρες πράσινες**, δηλαδή ήταν πεδίο που κανείς δεν μπορούσε να ελέγξει
 * ότι είναι σωστό. «Κλειστό πάνελ που δικαιούται το πληκτρολόγιο» πλέον **δεν εκφράζεται**·
 * αυτό είναι πάντα προτιμότερο από «εκφράζεται αλλά τυχαίνει να μην το γράφει κανείς».
 */
type ToolbarPanelOpenState =
  | { readonly isOpen: false }
  | { readonly isOpen: true; readonly mayTakeKeyboard: boolean };

const CLOSED: ToolbarPanelOpenState = { isOpen: false };

export function useToolbarPanel(): ToolbarPanelController {
  const [open, setOpen] = useState<ToolbarPanelOpenState>(CLOSED);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(CLOSED);
    // 🔴 ADR-753 §25.6 — η επιστροφή στον trigger είναι σωστή **μόνο για όποιον του είχε δώσει
    // την εστίαση**. Από τη στιγμή που το `mousedown` δεν τη μετακινεί πια, ο χρήστης ποντικιού
    // δεν την έδωσε ποτέ — και ένα άνευ όρου `focus()` εδώ θα την **έκλεβε** από το κελί,
    // ξαναγεννώντας το ίδιο ελάττωμα από δεύτερη πόρτα. Δες
    // {@link focusUnlessTableCellFieldOwnsKeyboard}.
    focusUnlessTableCellFieldOwnsKeyboard(triggerRef.current);
  }, []);

  const toggle = useCallback(() => {
    // 🔴 ADR-753 §26.8 — η ερώτηση μπαίνει **εδώ**, στον χειριστή, και όχι μέσα στον updater:
    // ένας updater του React οφείλει να είναι καθαρός, ενώ αυτή η γραμμή διαβάζει το ζωντανό
    // DOM (`document.activeElement`). Στο StrictMode ο updater καλείται δύο φορές· στο
    // concurrent rendering μπορεί να ξαναπαιχτεί αργότερα, όταν η απάντηση έχει ήδη αλλάξει.
    // Είναι το ίδιο μοτίβο *event-time read* που ο ADR-040 επιβάλλει στους χειριστές του καμβά.
    //
    // 🔶 **Δηλωμένο όριο**: η μετάλλαξη «μετακίνησε την ανάγνωση **μέσα** στον updater» μένει
    // πράσινη σε jsdom — το concurrent replay και το διπλό κάλεσμα του StrictMode δεν
    // αναπαράγονται εκεί. Είναι ορθότητα κατά το **συμβόλαιο** του React, όχι μετρήσιμη
    // συμπεριφορά με το σημερινό όργανο. Γραμμένο επειδή είναι μηδέν αν το ξέρεις εκ των
    // προτέρων και ώρες αν το μάθεις από ένα σπάνιο σφάλμα.
    const mayTakeKeyboard = tableCellPanelMayClaimKeyboard();
    setOpen((current) => (current.isOpen ? CLOSED : { isOpen: true, mayTakeKeyboard }));
  }, []);

  const runAndClose = useCallback((action: () => void) => {
    action();
    close();
  }, [close]);

  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  }, [close]);

  return {
    isOpen: open.isOpen,
    mayTakeKeyboard: open.isOpen && open.mayTakeKeyboard,
    panelId,
    triggerRef,
    toggle,
    runAndClose,
    onPanelKeyDown,
    close,
  };
}
