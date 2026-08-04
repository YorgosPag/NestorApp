'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **το μενού των ζωνών δείκτη**: δεξί κλικ σε γράμμα στήλης ή αριθμό
 * γραμμής ⇒ εισαγωγή / διαγραφή.
 *
 * ## Ρητή κατεύθυνση, όχι σκέτο «Εισαγωγή»
 * Το Excel δείχνει ένα item και εισάγει **πάντα πριν** — κανόνας που ο χρήστης μαθαίνει με
 * δοκιμή και undo. Το AutoCAD (μενού κελιού πίνακα) και τα Google Sheets δείχνουν και τις δύο
 * κατευθύνσεις. Εδώ ακολουθούμε τα δεύτερα: ο πίνακας είναι **σχέδιο**, και μια εισαγωγή στη
 * λάθος μεριά μετακινεί γεωμετρία που ο μηχανικός μόλις τακτοποίησε.
 *
 * ## Ένα σώμα, δύο άξονες
 * Τα items είναι **τρία** (`πριν` / `μετά` / `διαγραφή`) και ο άξονας του χτυπήματος αποφασίζει
 * μόνο τι **λένε** και τι εικονίδιο έχουν. Δύο ξεχωριστά μπλοκ JSX θα ήταν sibling clone (N.18)
 * και, χειρότερα, δύο σημεία που μπορούν κάποτε να αποκτήσουν διαφορετική συμπεριφορά για την
 * ίδια ακριβώς πράξη.
 *
 * ## 🔴 Το μενού ΕΙΝΑΙ μέλος της συνεδρίας επεξεργασίας
 * Το {@link TABLE_CELL_SESSION_MARKER} απλώνεται στο περιεχόμενο **και** στον κρυφό trigger.
 * Χωρίς αυτό, το Radix θα έπαιρνε την εστίαση, ο φύλακας `useTableCellSessionBlur` θα έκλεινε
 * τον δρομέα ένα καρέ αργότερα, και **οι ζώνες θα εξαφανίζονταν τη στιγμή ακριβώς που τις
 * πατάς**. Ο ορισμός του σημαδιού το λέει ρητά: «απλώνεται σε **κάθε** εστιάσιμο στοιχείο της
 * συνεδρίας» — το μενού του πίνακα είναι ένα από αυτά.
 *
 * Ίδιο μοτίβο imperative handle με `EntityContextMenu` / `GuideContextMenu`: το άνοιγμα δεν
 * περνά από `useState` του γονέα, άρα δεν ξανα-αποδίδει ο `CanvasSection` (ADR-040).
 *
 * @see ui/table-cell-editor/use-table-header-menu.ts — ποιος το ανοίγει και τι κάνει κάθε item
 * @see ui/components/dxf-context-menu/DxfContextMenu.tsx — το SSoT της οπτικής γλώσσας
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuHiddenTrigger,
} from './dxf-context-menu/DxfContextMenu';
import { useAnchoredHiddenTrigger } from './dxf-context-menu/use-anchored-hidden-trigger';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import { TableHeaderMenuItems, type TableHeaderMenuState } from './TableHeaderMenuItems';
import {
  TableFormatToolbar,
  type TableAxisFormatSnapshot,
  type TableToggleFormatKey,
} from './table-format-toolbar/TableFormatToolbar';
import type { TextHeightStepDirection } from '../../bim/table/table-text-height-scale';
import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';
import type { TableBorderMenuProps } from './table-format-toolbar/TableBorderMenu';

/**
 * ADR-750 Φ5 — το dropdown περιγραμμάτων **όπως το βλέπει ο ξενιστής**: όλα τα props του
 * πάνελ εκτός από τη θέση roving, που την ξέρει μόνο η γραμμή εργαλείων.
 *
 * Ονομασμένος τύπος και όχι inline `Omit<…>`: τον χρειάζονται **τρία** αρχεία (το prop, το
 * `OpenTarget`, ο ξενιστής της Φ4) και τρία inline `Omit` είναι τρεις ευκαιρίες να αποκλίνουν.
 */
export type TableBorderMenuHostProps = Omit<TableBorderMenuProps, 'roving'>;

/** Ένα item δέχεται πάντα **ποια** υποδιαίρεση πατήθηκε — ποτέ κρυφή κατάσταση. */
type TableHeaderAction = (hit: TableIndicatorHit) => void;

/**
 * Το σχήμα ενός συμβάντος «αλληλεπίδραση **έξω** από το μενού» του Radix, στο ελάχιστο που
 * χρειαζόμαστε.
 *
 * Δηλώνεται τοπικά αντί να εισαχθεί ο τύπος του `DismissableLayer`: εκείνος δεν εξάγεται από
 * το wrapper μας, και η μόνη εναλλακτική θα ήταν `any` — απαγορευμένο (N.2). Η παράμετρος
 * είναι σκόπιμα **ευρύτερη** από την πραγματική (`Event` αντί `PointerEvent`), ώστε να δέχεται
 * και τα δύο συμβάντα (`pointerDownOutside` και `focusOutside`) με έναν φύλακα.
 */
interface OutsideInteraction {
  readonly detail: { readonly originalEvent: Event };
  readonly target: EventTarget | null;
  preventDefault: () => void;
}

export interface TableHeaderMenuProps {
  readonly onInsertBefore: TableHeaderAction;
  readonly onInsertAfter: TableHeaderAction;
  readonly onDelete: TableHeaderAction;
  readonly resolveState: (hit: TableIndicatorHit) => TableHeaderMenuState;
  /** Η κατάσταση των χειριστηρίων μορφοποίησης — ξαναρωτιέται **μετά από κάθε** πάτημα. */
  readonly resolveFormat: (hit: TableIndicatorHit) => TableAxisFormatSnapshot;
  readonly onToggleFormat: (hit: TableIndicatorHit, key: TableToggleFormatKey) => void;
  readonly onStepTextHeight: (hit: TableIndicatorHit, direction: TextHeightStepDirection) => void;
  readonly onResetFormat: TableHeaderAction;
  /**
   * ADR-739 Φ.Ε/Φ4 — το χρώμα **κειμένου** του άξονα: `hex` ρητό · `undefined` «Αυτόματο»
   * (αφαιρεί την παράκαμψη· δεν γράφει ποτέ το χρώμα του στυλ ως ρητή τιμή).
   *
   * Περνά από το **ίδιο** {@link runFormat} με τα Β/Ι/Υ, όχι από δικό του δρόμο: είναι πράξη
   * άξονα, άρα οφείλει να κλείνει το μενού και να αφήνει τη γραμμή ακριβώς όπως εκείνα (§28.13).
   */
  readonly onSetTextColor: (hit: TableIndicatorHit, value: string | undefined) => void;
  /**
   * ADR-739 Φ.Ε/Φ4β — το **γέμισμα**, με την τρίτη κατάσταση: `hex` ρητό · `null` ρητά κανένα ·
   * `undefined` «Αυτόματο». Δες `TableFormatToolbar` για το γιατί είναι ένα prop και όχι τρία.
   */
  readonly onSetFillColor: (hit: TableIndicatorHit, value: string | null | undefined) => void;
  /**
   * ADR-750 Φ3/Φ5 — **όλο** το dropdown περιγραμμάτων του άξονα που πατήθηκε, σε μία ερώτηση.
   *
   * Ζει δίπλα στη μορφοποίηση κειμένου αλλά είναι **άλλο επίπεδο**: εκείνη γράφει στυλ άξονα,
   * αυτό γράφει ρητές ακμές πλέγματος και διαγωνίους κελιών. Γι' αυτό έχει και δική του
   * «Επαναφορά» (Α19).
   *
   * 🔑 **Μία** ερώτηση και όχι πέντε props (εντολή / επαναφορά / canReset / διαγώνιος /
   * μολύβι): το πάνελ μεγάλωσε από 2 σε 5 ικανότητες στη Φ5, και κάθε επόμενη θα πρόσθετε
   * ακόμη ένα prop σε **τρία** αρχεία. Εδώ ο τύπος του πάνελ **είναι** το συμβόλαιο — μια νέα
   * ικανότητα εμφανίζεται μόνη της, και ο μεταγλωττιστής δείχνει το ένα σημείο που τη γεμίζει.
   */
  readonly resolveBorderMenu: (hit: TableIndicatorHit) => TableBorderMenuHostProps;
  /** Το μενού έκλεισε — με ή χωρίς ενέργεια. Εδώ επιστρέφει η εστίαση στο κελί. */
  readonly onClosed: () => void;
}

export interface TableHeaderContextMenuHandle {
  open: (x: number, y: number, hit: TableIndicatorHit) => void;
  close: () => void;
}

/**
 * Στόχος + κατάσταση, παγωμένα μαζί στο άνοιγμα: δεν μπορούν να αποκλίνουν μεταξύ τους.
 *
 * Το `format` είναι το **μόνο** πεδίο που ανανεώνεται όσο ζει η επιφάνεια — και οφείλει να
 * ανανεώνεται: μετά την απόφαση του ιδιοκτήτη (2026-08-03) το πάτημα διώχνει το μενού αλλά
 * **αφήνει τη γραμμή στην οθόνη**, οπότε ένα «Β» που δεν φώτιζε θα έδειχνε ότι η πράξη
 * απέτυχε ενώ έχει ήδη εφαρμοστεί στον καμβά. Δες {@link closeMenuKeepToolbar}.
 */
interface OpenTarget {
  readonly hit: TableIndicatorHit;
  readonly state: TableHeaderMenuState;
  readonly format: TableAxisFormatSnapshot;
  /** ADR-750 Φ3/Φ5 — ανανεώνεται μαζί με το `format`, για τον ίδιο ακριβώς λόγο. */
  readonly borders: TableBorderMenuHostProps;
  /** Το σημείο του δεξιού κλικ — το toolbar κάθεται από πάνω του. */
  readonly anchor: { readonly x: number; readonly y: number };
}

const TableHeaderContextMenuInner = forwardRef<TableHeaderContextMenuHandle, TableHeaderMenuProps>(
  ({
    onInsertBefore, onInsertAfter, onDelete, resolveState,
    resolveFormat, onToggleFormat, onStepTextHeight, onResetFormat,
    onSetTextColor, onSetFillColor,
    resolveBorderMenu, onClosed,
  }, ref) => {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<OpenTarget | null>(null);

    /**
     * 🔴 Η θέση του κρυφού trigger γράφεται από το **state**, όχι μέσα στο `open()`.
     *
     * ⚠️ Ο μηχανισμός (και η ζωντανή μέτρηση του σφάλματος που τον γέννησε) μετακόμισε στο
     * {@link useAnchoredHiddenTrigger}: το ίδιο ακριβώς ζητά και το μενού περιγραμμάτων
     * (ADR-750 Φ4), και το CHECK 3.28 μέτρησε την αντιγραφή ως sibling clone. Εδώ μένει **μία
     * πηγή αλήθειας** για τη θέση — το `anchor` του {@link OpenTarget} — με δύο καταναλωτές που
     * τη διαβάζουν: ο trigger και το toolbar (από το prop του).
     */
    const placeTrigger = useAnchoredHiddenTrigger(triggerRef, target?.anchor ?? null);

    useImperativeHandle(ref, () => ({
      open: (x: number, y: number, hit: TableIndicatorHit) => {
        placeTrigger(x, y);
        setTarget({
          hit,
          state: resolveState(hit),
          format: resolveFormat(hit),
          borders: resolveBorderMenu(hit),
          anchor: { x, y },
        });
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setTarget(null);
      },
    }), [resolveState, resolveFormat, resolveBorderMenu, placeTrigger]);

    /**
     * **Ολόκληρη** η επιφάνεια φεύγει — μενού **και** γραμμή εργαλείων.
     *
     * Αυτός είναι ο ένας δρόμος του §27.7 για την «έξοδο»: `Escape`, κλικ έξω, επιλογή δομικού
     * item. Ο άλλος ({@link closeMenuKeepToolbar}) **δεν** είναι δεύτερη έξοδος — είναι
     * διαφορετικό γεγονός: το μενού υποχωρεί ενώ η επιφάνεια συνεχίζει να ζει.
     */
    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setTarget(null);
        onClosed();
      }
    }, [onClosed]);

    /**
     * 🔴 Φεύγει **ΜΟΝΟ** το μενού· η γραμμή εργαλείων μένει ζωντανή — ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ.
     *
     * «Θέλω να εξαφανίζεται **μόνον το μενού** όταν κάνω κλικ πάνω σε εντολές του mini
     * toolbar» (2026-08-03). Είναι ακριβώς το Excel: μία εντολή διώχνει το context menu, αλλά
     * η γραμμή μορφοποίησης παραμένει για την **επόμενη** εντολή — και η μορφοποίηση είναι
     * κατεξοχήν επαναλαμβανόμενη (έντονα, μετά πλάγια, μετά ένα μέγεθος πάνω).
     *
     * 🔑 **Η παρενέργεια είναι κέρδος, όχι τυχαία**: μόλις φύγει το modal μενού, το Radix
     * ξετυλίγει το `hideOthers()` **και** το `FocusScope`. Δηλαδή η γραμμή παύει να είναι
     * «άσχετο υπόβαθρο» και γίνεται **προσπελάσιμη με πληκτρολόγιο** — το roving tabindex και
     * το tooltip-on-focus, που το §28.12.9(β) μέτρησε ως απροσπέλαστα όσο το μενού ήταν
     * ανοιχτό, ζωντανεύουν από αυτή την αλλαγή.
     *
     * ⚠️ Το `onClosed()` καλείται κανονικά: επιστρέφει την εστίαση στο κελί, που είναι το
     * σωστό — η γραμμή δεν χρειάζεται εστίαση για να πατηθεί με ποντίκι, και ο δρομέας του
     * κελιού πρέπει να μείνει ζωντανός για να έχει νόημα η επόμενη εντολή.
     *
     * Ο φρουρός `if (!isOpen) return` δεν είναι διακοσμητικός: το δεύτερο, τρίτο, τέταρτο
     * πάτημα στη γραμμή περνούν κι αυτά από εδώ με το μενού **ήδη** κλειστό — χωρίς αυτόν θα
     * ξανα-εκκινούσαν τη συνεδρία δρομέα σε κάθε κλικ.
     */
    const closeMenuKeepToolbar = useCallback(() => {
      if (!isOpen) return;
      setIsOpen(false);
      onClosed();
    }, [isOpen, onClosed]);

    /**
     * Όσο ζει **μόνη** της η γραμμή, το «κλικ έξω» είναι δική μας ευθύνη.
     *
     * Με ανοιχτό μενού το αναλαμβάνει το `DismissableLayer` του Radix (και ο φύλακας
     * {@link keepOpenOnToolbar} εξαιρεί τη γραμμή). Μόλις το μενού φύγει, εκείνο το στρώμα
     * ξεμοντάρει και η γραμμή θα έμενε **για πάντα** στην οθόνη. Γι' αυτό ο ακροατής είναι
     * ενεργός **ακριβώς** στο διάστημα `target && !isOpen` — ποτέ και τα δύο μαζί, που θα
     * σήμαινε δύο μηχανές να απαντούν την ίδια ερώτηση.
     *
     * `useClickOutside` = το κεντρικό SSoT του έργου (N.0.2), όχι δεύτερος `document` ακροατής.
     */
    useClickOutside(toolbarRef, () => { handleOpenChange(false); }, {
      enabled: target !== null && !isOpen,
    });

    /**
     * 🔴 ADR-364 — το ανοιχτό μενού ΟΦΕΙΛΕΙ να έχει slot στον escape-bus.
     *
     * ── ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (ζωντανή επαλήθευση 2026-08-02, 3/3 επαναλήψεις, δύο άξονες) ──
     *
     * Ο bus είναι ο **πρώτος** window-capture listener και, μόλις κάποιος handler διεκδικήσει,
     * καλεί `stopImmediatePropagation()`. Το `DismissableLayer` του Radix ακούει σε **document**
     * capture, δηλαδή **μετά** — άρα ό,τι καταναλωθεί στον bus δεν φτάνει ποτέ σ' αυτό.
     *
     * Χωρίς εγγραφή εδώ, το πρώτο `Escape` το άρπαζε το `canvas/fallback-deselect` (P400):
     * το `canHandle` του είναι «υπάρχει επιλεγμένη οντότητα;» και σε λειτουργία πίνακα ο
     * πίνακας **είναι** η επιλεγμένη οντότητα, άρα αληθές πάντα. Δεν έχει `allowWhenEditable`,
     * οπότε η ασπίδα «editable focus» θα το έκοβε αν η εστίαση ήταν στο `<textarea>` του
     * κελιού — αλλά με ανοιχτό μενού η εστίαση είναι στο `<div role="menu">` του Radix, που
     * **δεν** είναι πεδίο κειμένου. Περνούσε, και έκανε τρία κακά με ένα πάτημα:
     *   1. το μενού **δεν έκλεινε** (το Radix δεν είδε ποτέ το ESC),
     *   2. ο πίνακας **αποεπιλεγόταν** (`clearEntitySelection`),
     *   3. άρα ο ζωγράφος σταματούσε να βγάζει δρομέα και ζώνες (`TableRenderer`: `selected
     *      ? cursorOf(...) : null`) ⇒ **τα γράμματα και οι αριθμοί εξαφανίζονταν** ενώ η
     *      γραμμή τύπων και η γραμμή κατάστασης έδειχναν ζωντανή συνεδρία. Κατάσταση-φάντασμα:
     *      «είμαι σε λειτουργία πίνακα» χωρίς τίποτα να πατήσεις.
     *
     * Το ίδιο το dev audit το φώναζε (`SHADOW-OWNER … ανήκει σε slot του ESC_PRIORITY`).
     *
     * ── ΓΙΑΤΙ `POPOVER_DROPDOWN` ──
     * Το ίδιο σκαλί με κάθε άλλο dropdown του θεατή (ribbon split, layer-state, quick
     * properties — 14 καταναλωτές), και **πάνω** από το P400 του fallback. Δεν χρειάζεται
     * ψηλότερα: το μόνο που έπρεπε να νικηθεί είναι η αποεπιλογή.
     *
     * ── ΓΙΑΤΙ ΠΕΡΝΑ ΑΠΟ ΤΟ `handleOpenChange` ──
     * §27.7: **ένας** δρόμος κλεισίματος. Ένα σκέτο `setIsOpen(false)` εδώ θα ήταν δεύτερος —
     * και η έξοδος με `Escape` δεν θα επέστρεφε την εστίαση στο κελί, ενώ η έξοδος με κλικ
     * σε item θα την επέστρεφε. Ακριβώς η ασυμμετρία που ο ένας δρόμος υπάρχει για να λείπει.
     */
    /**
     * ── ΔΥΟ ΑΛΛΑΓΕΣ ΠΟΥ ΤΙΣ ΕΠΙΒΑΛΛΕΙ Η ΕΠΙΒΙΩΣΗ ΤΗΣ ΓΡΑΜΜΗΣ (ζωντανή μέτρηση 2026-08-03) ──
     *
     * **`target !== null` αντί για `isOpen`**: η γραμμή ζει πλέον και μετά το μενού, και ένα
     * `Escape` πάνω σε **σκέτη** γραμμή πρέπει να τη διώχνει. Με `isOpen` το ESC θα έπεφτε στο
     * `canvas/fallback-deselect` (P400) — που αποεπιλέγει τον πίνακα και εξαφανίζει ζώνες και
     * δρομέα, ακριβώς το σφάλμα που περιγράφεται παραπάνω.
     *
     * **`allowWhenEditable: true`**: μετά το πάτημα μιας εντολής, το `onClosed()`
     * (`restartTableCellCursorSession`) επιστρέφει την εστίαση στο `<textarea>` του κελιού —
     * μετρημένο, `focusAt: "textarea.box-border…"`. Χωρίς τη σημαία, η ασπίδα «editable focus»
     * του bus θα παρέκαμπτε τον handler σιωπηλά. Δεν φαινόταν πριν επειδή ο handler ζούσε μόνο
     * με **ανοιχτό** μενού, όπου η εστίαση ήταν πάντα στο `<div role="menu">` του Radix.
     *
     * ⚠️ **ΤΙ ΔΕΝ ΛΥΝΕΙ ΑΥΤΟ — μετρημένο, μην το διαβάσεις ως «το Escape κλείνει τη γραμμή»:**
     * ο επεξεργαστής κελιού (`table-cell-editor/table-cell-cursor`) είναι `MODAL_DIALOG` (1000)
     * με `canHandle: () => !settled`, δηλαδή **πάντα αληθές** όσο υπάρχει ζωντανή συνεδρία —
     * και το 1000 είναι **πάνω** από το 800 εδώ. Άρα το **πρώτο** `Escape` το παίρνει εκείνος
     * (ακυρώνει την επεξεργασία), και μόνο ένα **δεύτερο** φτάνει χαμηλότερα. Αυτή η ιεραρχία
     * είναι **σωστή** (το βαθύτερο πράγμα ακυρώνεται πρώτο) και **δεν** αναδιατάχθηκε.
     *
     * Οι πραγματικές, επαληθευμένες έξοδοι της γραμμής είναι:
     *   · **κλικ σε άλλο κελί** — ζωντανά επαληθευμένο, η γραμμή φεύγει, η συνεδρία ζει
     *   · **νέο δεξί κλικ σε λωρίδα** — το `open()` αντικαθιστά το `target`
     *   · **Escape ×2**
     * ➖ Κλικ σε **κενό καμβά** δεν τη διώχνει: ο καμβάς είναι σκόπιμα κλειδωμένος όσο ζει η
     *   λειτουργία κελιών (§29, `useTableCanvasLockdown`), άρα το συμβάν δεν φτάνει ποτέ στο
     *   `document`. Είναι συνέπεια εκείνης της απόφασης, όχι κενό εδώ.
     */
    useEscapeHandler({
      id: 'table/header-menu',
      priority: ESC_PRIORITY.POPOVER_DROPDOWN,
      allowWhenEditable: true,
      canHandle: () => target !== null,
      handle: () => { handleOpenChange(false); return true; },
    });

    /**
     * Κάθε item εκτελεί με τον **πατημένο** στόχο και **δεν κλείνει μόνο του**: το κλείσιμο το
     * ζητά το ίδιο το Radix (`onSelect` ⇒ `onOpenChange(false)`), δηλαδή περνά από τον **έναν**
     * δρόμο του {@link handleOpenChange}. Δεύτερος δρόμος θα σήμαινε ότι μια έξοδος (κλικ σε
     * item) επιστρέφει την εστίαση στο κελί και μια άλλη (Esc / κλικ έξω) όχι.
     */
    const run = useCallback((action: TableHeaderAction) => {
      if (target) action(target.hit);
    }, [target]);

    /**
     * Μια πράξη μορφοποίησης: εκτελείται και **μετά κλείνει ολόκληρη η επιφάνεια**.
     *
     * ## 🔴 ΑΝΑΤΡΟΠΗ ΤΟΥ ΡΙΣΚΟΥ 1 — ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ (2026-08-03)
     * Μέχρι σήμερα εδώ γινόταν `setTarget({ …target, format: resolveFormat(…) })`: η πράξη
     * εκτελούνταν, η κατάσταση των κουμπιών ανανεωνόταν, και **το μενού έμενε ανοιχτό**. Ήταν
     * σχεδιασμένο, όχι τυχαίο — το §28.7 το ονομάζει «ρίσκο 1» και ολόκληρος ο φύλακας
     * {@link keepOpenOnToolbar} γράφτηκε γι' αυτό, με επιχείρημα ότι «η μορφοποίηση είναι
     * κατεξοχήν επαναλαμβανόμενη πράξη».
     *
     * Ο ιδιοκτήτης το ανέτρεψε ρητά: «όταν κάνω κλικ πάνω σε εντολές του toolbar **το κάτω
     * μενού να κλείνει**, όπως στο Excel». Και το Excel πράγματι κλείνει **και τις δύο**
     * επιφάνειες μετά από μία εντολή. Καταγράφεται ως ανατροπή ώστε να μη «διορθωθεί» πίσω
     * από κάποιον που θα διαβάσει μόνο το §28.7 ή τα παλιά σχόλια του toolbar.
     *
     * ## 🔴 ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ: ο φύλακας ΔΕΝ αφαιρείται — γίνεται ΠΡΟΫΠΟΘΕΣΗ
     * Η «προφανής» υλοποίηση είναι να σβήσει κανείς τον `keepOpenOnToolbar` και να αφήσει το
     * Radix να κλείσει μόνο του. **Θα έσπαγε την ίδια την εντολή**: το `DismissableLayer`
     * κλείνει στο `pointerdown`, δηλαδή **πριν** το `click`. Το toolbar θα ξεμόνταρε ενδιάμεσα
     * και το `onClick` του κουμπιού **δεν θα έτρεχε ποτέ** — μενού που κλείνει χωρίς να έχει
     * γίνει τίποτα, η χειρότερη δυνατή εκδοχή.
     *
     * Άρα η σειρά είναι ρητή και αντίστροφη από τη διαίσθηση:
     * `pointerdown` ⇒ ο φύλακας **κρατά** ανοιχτό · `click` ⇒ εκτελείται η πράξη ⇒ **μετά**
     * κλείνουμε εμείς. Το κλείσιμο περνά από το {@link handleOpenChange} (§27.7: **ένας**
     * δρόμος), άρα η εστίαση επιστρέφει στο κελί ακριβώς όπως και στα δομικά items.
     *
     * ## 🔴 Η κατάσταση των κουμπιών ΞΑΝΑΡΩΤΙΕΤΑΙ — γιατί η γραμμή ΔΕΝ φεύγει
     * Ο ιδιοκτήτης διόρθωσε το εύρος μέσα στην ίδια συνεδρία: φεύγει **μόνο** το μενού. Άρα η
     * γραμμή μένει στην οθόνη και ένα «Β» που δεν φώτιζε μετά το πάτημα θα έδειχνε ότι η πράξη
     * απέτυχε ενώ έχει ήδη εφαρμοστεί στον καμβά.
     *
     * 🔴 Η ανανέωση γίνεται εδώ, **έξω** από τον updater του `setTarget`. Ένα
     * `setTarget(prev => { action(prev.hit); … })` θα εκτελούσε την πράξη **δύο φορές** σε
     * StrictMode (ο updater καλείται δύο φορές επίτηδες) — δύο εντολές, δύο βήματα undo, και
     * ένα «Β» που ανάβει και σβήνει μόνο του.
     */
    const runFormat = useCallback((action: TableHeaderAction) => {
      if (!target) return;
      action(target.hit);
      setTarget({ ...target, format: resolveFormat(target.hit) });
      closeMenuKeepToolbar();
    }, [target, resolveFormat, closeMenuKeepToolbar]);

    /**
     * ADR-750 Φ3 — μια εντολή περιγράμματος: **ίδια σειρά** με το {@link runFormat}.
     *
     * Ξεχωριστός χειριστής και όχι κοινός, επειδή ανανεώνεται **άλλη** ερώτηση: η μορφοποίηση
     * ξαναρωτά το στυλ του άξονα, το περίγραμμα ξαναρωτά τις ρητές ακμές. Ένας χειριστής που
     * ξαναρωτούσε και τα δύο θα διέτρεχε όλα τα κελιά του άξονα **και** όλες τις ακμές της
     * περιοχής σε κάθε πάτημα — διπλάσια δουλειά, με τη μισή να απαντά σε ερώτηση που κανείς
     * δεν έκανε.
     */
    const runBorder = useCallback((action: TableHeaderAction) => {
      if (!target) return;
      action(target.hit);
      setTarget({ ...target, borders: resolveBorderMenu(target.hit) });
      closeMenuKeepToolbar();
    }, [target, resolveBorderMenu, closeMenuKeepToolbar]);

    /**
     * 🔴 Το toolbar είναι «έξω» για το Radix — και δεν επιτρέπεται να κλείνει το μενού **ΕΔΩ**.
     *
     * Ζει σε δικό του portal (μόνο έτσι κάθεται **πάνω** από το μενού με κενό, απόφαση Α7),
     * άρα κάθε πάτημα κουμπιού φτάνει εδώ ως `pointerDownOutside`.
     *
     * ⚠️ **Ο φύλακας ΔΕΝ έγινε περιττός όταν ο ιδιοκτήτης ζήτησε «να κλείνει το μενού»** — έγινε
     * **προϋπόθεση** για να δουλέψει αυτό ακριβώς. Το `DismissableLayer` κλείνει στο
     * `pointerdown`, δηλαδή **πριν** το `click`: αν το αφήναμε, το toolbar θα ξεμόνταρε
     * ενδιάμεσα και το `onClick` του κουμπιού **δεν θα έτρεχε ποτέ**. Θα κλείναμε το μενού
     * χωρίς να έχει γίνει η εντολή. Το κλείσιμο ανήκει στο {@link runFormat}, **μετά** την
     * πράξη — δες την τεκμηρίωσή του για τη σειρά.
     *
     * Ο έλεγχος γίνεται στο `originalEvent.target`: το `target` του συνθετικού συμβάντος είναι
     * το ίδιο το περιεχόμενο του μενού, όχι ό,τι πάτησε ο χρήστης.
     */
    const keepOpenOnToolbar = useCallback((event: OutsideInteraction) => {
      const node = (event.detail.originalEvent.target ?? event.target) as Node | null;
      if (node && toolbarRef.current?.contains(node)) event.preventDefault();
    }, []);

    if (!target) {
      // Κλειστό μενού χωρίς στόχο: ο trigger πρέπει να υπάρχει (το `open` τον τοποθετεί),
      // αλλά δεν υπάρχει τίποτα να δείξει — και κυρίως, καμία ετικέτα να μαντέψουμε.
      return (
        <DropdownMenu open={false} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
          </DropdownMenuTrigger>
        </DropdownMenu>
      );
    }

    const isColumn = target.hit.axis === 'column';
    // Μόνο η ετικέτα χρειάζεται εδώ: οι σημαίες `canInsert`/`canDelete` ταξιδεύουν ολόκληρες
    // στο {@link TableHeaderMenuItems}, που είναι και το μόνο που τις καταναλώνει.
    //
    // 🔴 ADR-739 §27.17 — η γραμμή παίρνει το `axisLabel` (**ο ένας** άξονας που πατήθηκε) και
    // όχι το `label` (ο στόχος της πράξης, που μπορεί να είναι `A:C`): οι δομικές εντολές
    // ακολουθούν την επιλογή, η μορφοποίηση **όχι ακόμη**. Κάθε ετικέτα λέει την αλήθεια για
    // το δικό της χειριστήριο — ποτέ μία ετικέτα που καλύπτει δύο διαφορετικά εύρη.
    const { axisLabel } = target.state;

    return (
      <>
      {/*
        ⚠️ Κρέμεται από το `target`, ΟΧΙ από το `isOpen` — εδώ ζει η απόφαση του ιδιοκτήτη.
        Με `isOpen` η γραμμή θα εξαφανιζόταν μαζί με το μενού στο πρώτο πάτημα· με `target`
        επιβιώνει και φεύγει μόνο με `Escape` / κλικ έξω / νέο δεξί κλικ — δες
        {@link closeMenuKeepToolbar}.
      */}
      {target ? (
        <TableFormatToolbar
          anchorX={target.anchor.x}
          anchorY={target.anchor.y}
          axis={target.hit.axis}
          label={axisLabel}
          format={target.format}
          surfaceRef={toolbarRef}
          onToggle={(key) => runFormat((hit) => onToggleFormat(hit, key))}
          onStepSize={(direction) => runFormat((hit) => onStepTextHeight(hit, direction))}
          onReset={() => runFormat(onResetFormat)}
          onSetTextColor={(value) => runFormat((hit) => onSetTextColor(hit, value))}
          onSetFillColor={(value) => runFormat((hit) => onSetFillColor(hit, value))}
          borders={{
            ...target.borders,
            // Κάθε **εντολή** περνά από τον χειριστή: εφαρμογή → ξαναρώτημα → κλείσιμο μενού.
            // Οι ρυθμίσεις του μολυβιού (χρώμα/τύπος/πάχος/διπλή) **δεν** περνούν: δεν είναι
            // εντολές, και ένα κλείσιμο εκεί θα ανάγκαζε τον χρήστη να ξανανοίξει το μενού για
            // να εφαρμόσει το περίγραμμα που μόλις ρύθμισε.
            onApply: (id) => runBorder(() => target.borders.onApply(id)),
            onReset: () => runBorder(() => target.borders.onReset()),
            onApplyDiagonal: (id) => runBorder(() => target.borders.onApplyDiagonal(id)),
          }}
        />
      ) : null}

      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <DxfMenuHiddenTrigger ref={triggerRef} {...TABLE_CELL_SESSION_MARKER} />
        </DropdownMenuTrigger>

        <DxfMenuContent
          {...TABLE_CELL_SESSION_MARKER}
          onPointerDownOutside={keepOpenOnToolbar}
          onFocusOutside={keepOpenOnToolbar}
        >
          <TableHeaderMenuItems
            isColumn={isColumn}
            state={target.state}
            onInsertBefore={() => run(onInsertBefore)}
            onInsertAfter={() => run(onInsertAfter)}
            onDelete={() => run(onDelete)}
          />
        </DxfMenuContent>
      </DropdownMenu>
      </>
    );
  },
);

TableHeaderContextMenuInner.displayName = 'TableHeaderContextMenu';

export const TableHeaderContextMenu = React.memo(TableHeaderContextMenuInner);
