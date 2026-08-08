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
import { useKeepOpenOnSurface } from './dxf-context-menu/use-keep-open-on-surface';
import { TABLE_CELL_SESSION_MARKER } from '../table-cell-editor/table-cell-session-focus';
import { TableHeaderMenuItems } from './TableHeaderMenuItems';
import { TableFormatToolbar } from './table-format-toolbar/TableFormatToolbar';
// 🔴 ADR-739 §64 — η εφήμερη επιφάνεια υποχωρεί στη μόνιμη. Η γνώση ΔΕΝ ζει στο item που
// πατήθηκε: οι υποδοχές του διαλόγου είναι πέντε (§61) — δες την κεφαλίδα του module.
import { useYieldToPersistentSurface } from './table-format-toolbar/use-yield-to-persistent-surface';
// 🔴 ADR-739 §55 — τα τρία νέα τμήματα χτίζονται **μία** φορά για τις δύο υποδοχές (δες την
// κεφαλίδα του module): εδώ αλλάζει μόνο ο τυλιχτής εκτέλεσης.
import { tableToolbarExtrasProps } from './table-format-toolbar/table-toolbar-extras';
import { useTableHeaderMenuCommands } from './use-table-header-menu-commands';
// 🔴 ADR-739 §62 — ο τύπος του χτυπήματος χρησιμοποιείται στην υπογραφή του `open` παρακάτω και
// **δεν ήταν εισηγμένος**: όταν το ADR-755 μετακόμισε το συμβόλαιο στο `table-header-menu-types`,
// η δήλωση έφυγε και η **χρήση** έμεινε. Αόρατο επί μήνες γιατί το root `tsconfig` εξαιρεί
// ολόκληρο το subapp (N.17) — το βλέπει μόνο το CHECK 3.29 στο CI, και το αρχείο δεν είναι στη
// baseline του, δηλαδή ήταν ζωντανό σφάλμα σε αναμονή.
import type { TableIndicatorHit } from '../../bim/table/table-indicator-geometry';
import type {
  TableHeaderAction,
  TableHeaderContextMenuHandle,
  TableHeaderMenuProps,
  TableHeaderOpenTarget,
} from './table-header-menu-types';

// Επανεξαγωγή: οι καλούντες εισάγουν το συμβόλαιο από **ένα** σημείο, όπως και πριν τη
// διάσπαση του ADR-755 — καμία υπάρχουσα διαδρομή εισαγωγής δεν αλλάζει.
export type {
  TableBorderMenuHostProps,
  TableHeaderContextMenuHandle,
  TableHeaderMenuProps,
} from './table-header-menu-types';

const TableHeaderContextMenuInner = forwardRef<TableHeaderContextMenuHandle, TableHeaderMenuProps>(
  ({
    onInsertBefore, onInsertAfter, onDelete, onFormatCells, resolveState,
    resolveFormat, onToggleFormat, onStepTextHeight, onResetFormat,
    onSetTextColor, onSetFillColor,
    resolveToolbar, onSetFormatField, onSetOverflow,
    resolveBorderMenu, resolveMergeMenu, onClosed,
  }, ref) => {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<TableHeaderOpenTarget | null>(null);

    /**
     * 🔴 Η θέση του κρυφού trigger γράφεται από το **state**, όχι μέσα στο `open()`.
     *
     * ⚠️ Ο μηχανισμός (και η ζωντανή μέτρηση του σφάλματος που τον γέννησε) μετακόμισε στο
     * {@link useAnchoredHiddenTrigger}: το ίδιο ακριβώς ζητά και το μενού περιγραμμάτων
     * (ADR-750 Φ4), και το CHECK 3.28 μέτρησε την αντιγραφή ως sibling clone. Εδώ μένει **μία
     * πηγή αλήθειας** για τη θέση — το `anchor` του {@link TableHeaderOpenTarget} — με δύο καταναλωτές που
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
          toolbar: resolveToolbar(hit),
          borders: resolveBorderMenu(hit),
          merge: resolveMergeMenu(hit),
          anchor: { x, y },
        });
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setTarget(null);
      },
    }), [
      resolveState, resolveFormat, resolveToolbar, resolveBorderMenu, resolveMergeMenu,
      placeTrigger,
    ]);

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
     * 🔴 ADR-739 §64 — όσο ζει ο διάλογος «Μορφοποίηση κελιών», η γραμμή **δεν** ζει.
     *
     * `setTarget(null)` και όχι `handleOpenChange(false)`: το μενού έχει **ήδη** κλείσει από
     * τον {@link closeMenuKeepToolbar}, και ο δεύτερος δρόμος θα ξανακαλούσε το `onClosed()` —
     * δηλαδή θα ξαναζωντάνευε τη συνεδρία κελιού πάνω σε ανοιχτό διάλογο. Δες την κεφαλίδα του
     * `use-yield-to-persistent-surface` για το γιατί η γνώση δεν ζει στο item που πατήθηκε.
     */
    const dismissToolbar = useCallback(() => { setTarget(null); }, []);
    useYieldToPersistentSurface(dismissToolbar);

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
     * 🔴 ADR-739 §62 — **η εκτέλεση εντολής μετακόμισε**, ολόκληρη, στο
     * {@link useTableHeaderMenuCommands}: πέντε τυλιχτές που δεν ξέρουν τίποτα από trigger,
     * Radix ή escape-bus — μόνο «εφάρμοσε → ξαναρώτησε → κλείσε **μόνο** το μενού».
     *
     * ⚠️ Ο **ένας** δρόμος εξόδου ({@link closeMenuKeepToolbar}) μένει εδώ και περνά μέσα ως
     * παράμετρος: ζει από τον κύκλο ζωής (`isOpen`, `onClosed`), και ένα δεύτερο σώμα εκεί θα
     * ήταν ακριβώς η ασυμμετρία που ο ένας δρόμος του §27.7 υπάρχει για να λείπει.
     */
    const {
      runFormat, setToolbarField, setToolbarOverflow, runBorder, runMerge,
    } = useTableHeaderMenuCommands(
      { resolveFormat, resolveToolbar, resolveBorderMenu, resolveMergeMenu, onSetFormatField, onSetOverflow },
      target,
      setTarget,
      closeMenuKeepToolbar,
    );

    /**
     * 🔴 Το toolbar είναι «έξω» για το Radix — και δεν επιτρέπεται να κλείνει το μενού **ΕΔΩ**.
     *
     * ⚠️ **ADR-755** — ο μηχανισμός (και ολόκληρη η αιτιολόγησή του: γιατί ο φύλακας ΔΕΝ έγινε
     * περιττός όταν ο ιδιοκτήτης ζήτησε «να κλείνει το μενού», αλλά **προϋπόθεση**) μετακόμισε
     * στο {@link useKeepOpenOnSurface}: το ίδιο ζητά πλέον και το μενού των **κελιών**, που
     * απέκτησε κι εκείνο mini toolbar από πάνω. Το κλείσιμο ανήκει στο {@link runFormat},
     * **μετά** την πράξη — δες την τεκμηρίωσή του για τη σειρά.
     */
    const keepOpenOnToolbar = useKeepOpenOnSurface(toolbarRef);

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
          scope={target.hit.axis}
          label={axisLabel}
          surfaceRef={toolbarRef}
          format={{
            format: target.format,
            onToggle: (key) => runFormat((hit) => onToggleFormat(hit, key)),
            onStepSize: (direction) => runFormat((hit) => onStepTextHeight(hit, direction)),
            onReset: () => runFormat(onResetFormat),
            onSetTextColor: (value) => runFormat((hit) => onSetTextColor(hit, value)),
            onSetFillColor: (value) => runFormat((hit) => onSetFillColor(hit, value)),
          }}
          /* 🔴 §55/§58 — τα τέσσερα τμήματα, από τον **κοινό** builder με το μενού της περιοχής. */
          {...tableToolbarExtrasProps(target.toolbar, setToolbarField, setToolbarOverflow)}
          merge={{
            ...target.merge,
            // Ίδια σειρά με κάθε άλλη εντολή: εφαρμογή → ξαναρώτημα → κλείσιμο μενού.
            onApply: (id) => runMerge(() => target.merge.onApply(id)),
          }}
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
            /*
              🔴 ADR-739 §61 — **`run`, όχι `runFormat`.** Η διαφορά δεν είναι λεπτομέρεια: ο
              `runFormat` εκτελεί, **ξαναρωτά** τα δύο στιγμιότυπα της γραμμής και κλείνει μόνο
              το μενού. Εδώ δεν εκτελείται καμία πράξη — **ανοίγει διάλογο**, και η γραμμή δεν
              έχει τίποτα να ξαναρωτήσει μέχρι το «ΟΚ». Το `run` περνά από τον έναν δρόμο εξόδου
              του Radix (§27.7), δηλαδή ολόκληρη η επιφάνεια φεύγει — ακριβώς όπως και στα τρία
              δομικά items, και για τον ίδιο λόγο με τη συγχώνευση: με το `role="menu"` ζωντανό,
              το `FocusScope` επαναφέρει κάθε εστίαση σε αυτό και ο διάλογος δεν συμπληρώνεται.
            */
            onFormatCells={() => run(onFormatCells)}
          />
        </DxfMenuContent>
      </DropdownMenu>
      </>
    );
  },
);

TableHeaderContextMenuInner.displayName = 'TableHeaderContextMenu';

export const TableHeaderContextMenu = React.memo(TableHeaderContextMenuInner);
