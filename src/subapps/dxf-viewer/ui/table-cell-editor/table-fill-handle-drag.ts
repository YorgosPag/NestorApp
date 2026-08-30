'use client';

/**
 * 🔴 ADR-754 **Γ4** — **Η ΧΕΙΡΟΝΟΜΙΑ ΤΗΣ ΛΑΒΗΣ ΣΥΜΠΛΗΡΩΣΗΣ**: πιάσιμο, σύρσιμο, εκτέλεση.
 *
 * Το αδελφό του `table-point-mode-pointer.ts`, με την ίδια δομή και τον ίδιο καταμερισμό:
 *
 * | ερώτηση | ποιος απαντά |
 * |---|---|
 * | «πού κάθεται η λαβή, και τι υπόσχεται η σύρση;» | `bim/table/table-fill-handle.ts` (καθαρό) |
 * | «τι γίνεται το μοντέλο;» | `bim/table/table-fill-apply.ts` (καθαρό) |
 * | «πού έπεσε το χέρι, και ποιος γράφει;» | **εδώ** (DOM + store) |
 *
 * ## 🔴 Γιατί ΔΕΝ γράφεται εδώ δεύτερος βρόχος `mousemove`
 * Η σύρση της λαβής είναι η **ίδια χειρονομία** με τη σύρση επιλογής και με τη σύρση
 * υπόδειξης: κουμπί κάτω, ακολούθα το χέρι, γράψε **μόνο όταν αλλάζει κελί** (ADR-735),
 * συνέχισε στην άκρη με auto-pan, τερμάτισε στο `mouseup` όπου κι αν γίνει. Είναι ο **τρίτος
 * παραλήπτης** του ενός κύκλου ζωής (`table-cell-drag-session.ts`), όχι τρίτη μηχανή — δες
 * εκεί το `write` (ADR-754 §5) και το `onEnd` (Γ4).
 *
 * ## 🔴 Η ΣΥΡΣΗ ΔΕΙΧΝΕΙ, Η ΑΠΕΛΕΥΘΕΡΩΣΗ ΓΡΑΦΕΙ
 * Ανά κίνηση γράφεται **μόνο** το store προεπισκόπησης. Το μοντέλο γράφεται **μία φορά**, στο
 * `mouseup`. Ένα γράψιμο ανά κελί θα άφηνε δέκα βήματα undo για μία χειρονομία — και θα
 * ξαναϋπολόγιζε τον πίνακα δέκα φορές. Ίδια δομή με τη μεταφορά περιοχής (§36.15).
 *
 * ## Ρητό όριο: η λαβή δεν πιάνεται σε **γραφή**
 * Όσο ο χρήστης πληκτρολογεί, ο ζωγράφος δεν τη δείχνει (Excel parity) — και ο φρουρός εδώ
 * ρωτά το ίδιο. Είναι απαραίτητο, όχι διακοσμητικό: το `table-point-mode-pointer` τρέχει
 * **πριν** από αυτόν και διεκδικεί τα κλικ σε κελιά όσο γράφεται τύπος· δύο φρουροί με
 * διαφορετική άποψη για την ίδια στιγμή θα έδιναν «λαβή που πιάνεται αλλά δεν φαίνεται».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-fill-handle-drag
 * @see ui/table-cell-editor/table-point-mode-pointer.ts — το αδελφό, ίδια δομή
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import type { RefObject } from 'react';
import { computeTableEntityGeometryLive, tablePxPerMm, tableWorldToFrame } from '../../bim/table/table-entity-geometry';
import { tableMmToWorldLive } from '../../bim/table/table-entity-geometry';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../../bim/table/table-cell-range';
import {
  resolveTableFillTarget,
  tableFillHandleHitAtFrame,
  tableFillPreviewBounds,
  type TableFillTarget,
} from '../../bim/table/table-fill-handle';
// 🔴 ADR-739 §36.9 — η ερώτηση «ποια περιοχή εννοεί ο χρήστης» μετακόμισε σε δικό της module
// όταν απέκτησε **τέταρτο** καταναλωτή που δεν αφορά λαβή: τη μετακίνηση περιγράμματος.
import { tableEffectiveRangeBounds } from '../../bim/table/table-effective-range';
import { applyTableFill } from '../../bim/table/table-fill-apply';
import { indexById, resolveTableModel } from '../../bim/table/table-model-helpers';
import { startTableCellDrag } from './table-cell-drag-session';
import { cellEndAt } from './table-pointer-axis-selection';
import { claimTableCellPointerGesture, claimTableCellSessionPointerDown } from './table-cell-session-focus';
import { setTableCellSelection, type TableCellCursorState } from '../../state/table-cell-cursor-store';
import { clearTableFillPreview, setTableFillPreview } from '../../state/table-fill-preview-store';
// 🔴 ADR-828 Φ4α — το κουμπί «Επιλογές Αυτόματης Συμπλήρωσης» οπλίζεται από τη **μία** εγγραφή,
// δηλαδή από ένα σημείο για τις τρεις αφορμές. Δες `commitTableFill`.
import { setTableFillBadge } from '../../state/table-fill-badge-store';
import {
  hideTableResizeReadout,
  showTableResizeReadout,
} from '../../state/table-resize-readout-store';
import { readModifierSnapshot } from '../../keyboard/modifier-snapshot';
import {
  tableFillFrontier,
  tableFillMenuOffer,
  tableFillModeFor,
  tableFillPreviewText,
  tableFillSourceTexts,
  type TableFillMode,
} from '../../bim/table/table-fill-plan';
// 🔴 ADR-828 §7.2 — η θύρα του μενού δεξιού συρσίματος. Ανάγνωση **τη στιγμή της
// απελευθέρωσης**, ποτέ στιγμιότυπο: δες την κεφαλίδα εκείνου του module για το γιατί η
// χειρονομία δεν περνά από τον δρομολογητή δεξιού κλικ.
import { getTableFillMenuPort } from './table-fill-menu-port';
// 🔴 ADR-828 Φ4β — οι λίστες του ανθρώπου, διαβασμένες **τη στιγμή της χειρονομίας**
// (ADR-040 κανόνας #2). Σύγχρονη ανάγνωση, ποτέ στιγμιότυπο render: ο άνθρωπος μπορεί να
// πρόσθεσε λίστα πριν από ένα δευτερόλεπτο και να τραβά τη λαβή τώρα.
import { autoFillListCandidates } from '../../settings/auto-fill-lists';
import type { TableEntity, TableFramePoint } from '../../types/table-entity';
import type { TableLayout } from '../../bim/table/table-layout-types';
import type {
  PersistedTableModel,
  TableModel,
} from '../../types/table';
import type { ViewTransform } from '../../rendering/types/Types';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

/**
 * 🔴 ADR-828 §7.2 / Φ4α — **ΟΛΟ Ο ΚΟΣΜΟΣ ΠΟΥ ΧΡΕΙΑΖΕΤΑΙ Η ΜΙΑ ΕΓΓΡΑΦΗ**: ποιος διαβάζει τη
 * σκηνή **τώρα**, και ποιος γράφει.
 *
 * Εξήχθη από το {@link TableFillHandlePress} όταν απέκτησε **τρίτο** καλούντα που δεν είναι
 * πάτημα λαβής: το κουμπί επιλογών (πάτημα **και** `Alt+↓`). Εκείνοι δεν έχουν —και δεν
 * πρέπει να αποκτήσουν— `worldPoint`, `container` ή `transformRef`· έχουν όμως ακριβώς αυτά
 * τα δύο. Ένα όρισμα `press` εκεί θα ζητούσε από το πληκτρολόγιο να κατασκευάσει ψεύτικη
 * χειρονομία ποντικιού για να μπορέσει να γράψει.
 */
export interface TableFillWriter {
  /**
   * 🔴 ADR-828 §7.2 — ο **αναγνώστης** της οντότητας, για όποιον γράφει **αργότερα**.
   *
   * `null` ⇒ ο πίνακας δεν υπάρχει πια (undo, αλλαγή ορόφου) και η σωστή πράξη είναι **καμία**.
   */
  readonly liveTable: () => TableEntity | null;
  /** Η **ΜΙΑ** διαδρομή εγγραφής μοντέλου — η ίδια που χρησιμοποιεί η μεταφορά περιοχής. */
  readonly commit: (entity: TableEntity, model: PersistedTableModel) => void;
}

/** Ό,τι ξέρει ο φρουρός του ποντικιού τη στιγμή του πατήματος. */
export interface TableFillHandlePress extends TableFillWriter {
  /** Η **ζωντανή** οντότητα του δρομέα. */
  readonly entity: TableEntity;
  readonly cursor: TableCellCursorState;
  /** Το σημείο του πατήματος σε **κόσμο** — η ίδια τιμή που ήδη υπολόγισε ο καλών. */
  readonly worldPoint: { readonly x: number; readonly y: number };
  readonly transform: ViewTransform;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
}

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ.** `true` ⇒ αυτό το πάτημα ήταν η λαβή· την κατανάλωσε ολόκληρη και ο καλών
 * οφείλει να σταματήσει εκεί.
 *
 * `false` ⇒ ο κανονικός δρόμος τρέχει αυτούσιος. Η άρνηση είναι η **συνηθισμένη** έκβαση.
 */
export function tryTableFillHandleMouseDown(event: MouseEvent, press: TableFillHandlePress): boolean {
  // 🔴 ADR-828 §7.2 — **ΔΥΟ ΠΛΗΚΤΡΑ ΠΙΑΝΟΥΝ ΤΗ ΛΑΒΗ**, με διαφορετική κατάληξη: το αριστερό
  // γράφει την προεπιλογή, το δεξί **ρωτά**. Το μεσαίο είναι pan του καμβά και δεν μας αφορά.
  const withMenu = event.button === 2;
  if (event.button !== 0 && !withMenu) return false;
  // Σε γραφή η λαβή δεν φαίνεται — δες το ρητό όριο στην κεφαλίδα.
  if (press.cursor.mode !== 'nav') return false;

  const model = resolveTableModel(activeTableModel(press.entity));
  const source = fillSourceBounds(model, press.cursor);
  if (!source) return false;
  if (!isOnHandle(press, source)) return false;

  const anchor = cellAt(model, source.lastRow, source.lastCol);
  if (!anchor) return false;

  // 🔴 ADR-754 §14.9.3 — **ΟΙ ΔΗΛΩΣΕΙΣ ΜΕΤΑ ΤΗΝ ΤΕΛΕΥΤΑΙΑ ΑΡΝΗΣΗ, ΠΟΤΕ ΠΡΙΝ.**
  //
  // Ζούσαν πάνω από τον έλεγχο της άγκυρας, δηλαδή ένα `return false` από κάτω άφηνε πίσω του
  // **διεκδικημένη χειρονομία για πάτημα που δεν καταναλώθηκε**. Στην κοινή περίπτωση κρυβόταν
  // (ο κλάδος «κελί» ξαναδηλώνει από κάτω), αλλά με **μπαγιάτικα** όρια μετά από undo —ακριβώς
  // η περίπτωση που γεννά `anchor === null`— το `pointerHit` μπορεί να είναι `null` και ο
  // χειριστής να γυρίσει χωρίς καμία δήλωση: τότε η δήλωση επιζεί ως σκέτο κλείδωμα του
  // body-drag (ADR-560) για χειρονομία που κανείς δεν ανέλαβε. Ο κανόνας του §26.15 μιλά για
  // πάτημα που **αναγνωρίστηκε**· η αναγνώριση ολοκληρώνεται εδώ, όχι τρεις γραμμές πιο πάνω.
  claimTableCellSessionPointerDown();
  claimTableCellPointerGesture();

  let target = resolveTableFillTarget(source, { row: source.lastRow, col: source.lastCol });
  // 🔴 ADR-828 §5 — η **πρόθεση**, χωριστά από τη **θέση**. Διαβάζεται μία φορά εδώ και
  // ενημερώνεται από τον παρατηρητή· ποτέ από το `MouseEvent`, που είναι παγωμένο στιγμιότυπο.
  let modifiers = readModifierSnapshot();

  /**
   * Η ετικέτα-φάντασμα: **τι θα πάρει το κελί που κρατά ο δείκτης** — η υπόσχεση που το
   * `mouseup` οφείλει να τηρήσει, γιατί βγαίνει από το **ίδιο** σχέδιο.
   *
   * Το κόστος είναι O(**πηγή**), όχι O(στόχου): το σχέδιο σαρώνει μόνο τα κελιά-σπόρους, που
   * είναι συνήθως ένα. Γι' αυτό επιτρέπεται να ξαναχτίζεται σε κάθε καρέ της σύρσης, πίσω από
   * τον ίδιο φύλακα «άλλαξε κελί;» με την υπόλοιπη χειρονομία.
   */
  /** Η **μία** εγγραφή, δεμένη σε αυτή τη χειρονομία. Δες {@link commitTableFill}. */
  const commitFill = (chosen: TableFillTarget, mode: TableFillMode): void => {
    commitTableFill(press, source, chosen, mode);
  };

  const showFillLabel = (): void => {
    // 🔴 ADR-828 §7.2 — **ΣΤΟ ΔΕΞΙ ΣΥΡΣΙΜΟ Η ΕΤΙΚΕΤΑ ΣΩΠΑΙΝΕΙ**, και είναι ο ίδιος κανόνας
    // που τη γέννησε: *η ετικέτα λέει πάντα κάτι αληθινό*. Εκεί δεν έχει αποφασιστεί ακόμη
    // **τίποτα** — η πρόθεση θα δοθεί στο μενού, μετά την απελευθέρωση. Μια ετικέτα που
    // διαφημίζει τη σειρά και μετά ο χρήστης διαλέγει «Αντιγραφή κελιών» θα ήταν υπόσχεση που
    // η ίδια η χειρονομία σχεδιάστηκε να αθετεί. Το **μέγεθος** της περιοχής εξακολουθεί να
    // ανακοινώνεται (`sizeReadout`): εκείνο είναι γεγονός, όχι πρόθεση.
    if (target === null || withMenu) {
      hideTableResizeReadout();
      return;
    }
    const lists = autoFillListCandidates();
    const mode = tableFillModeFor(model, source, target, modifiers, lists);
    const text = tableFillPreviewText(
      model,
      source,
      target,
      mode,
      tableFillFrontier(source, target),
      lists,
    );
    // Κενό κείμενο δεν είναι ετικέτα: μια άδεια πινακίδα δίπλα στον δείκτη είναι θόρυβος.
    if (text === null || text === '') hideTableResizeReadout();
    else showTableResizeReadout(text);
  };

  startTableCellDrag({
    anchor,
    kind: 'range',
    // 🔴 ADR-828 §7.2 — **το πλήκτρο που κρατά τη χειρονομία**. Χωρίς αυτό, ο φρουρός
    // `(buttons & 1) === 0` της συνεδρίας θα τερμάτιζε τη δεξιά σύρση στο πρώτο `mousemove`.
    button: withMenu ? 2 : 0,
    container: press.container,
    resolveAt: (moveEvent) => cellEndAt(moveEvent, press.entity, press.container, press.transformRef),
    /**
     * 🔴 ADR-739 §69 — **Η ΜΟΝΗ ΑΠΟ ΤΙΣ ΤΕΣΣΕΡΙΣ ΠΟΥ ΔΕΝ ΑΝΑΚΟΙΝΩΝΕΙ Ο,ΤΙ ΣΕΡΝΕΙ.**
     *
     * Το span που φτάνει εδώ έχει άγκυρα τη **γωνία της λαβής** και τέλος το κελί κάτω από το
     * χέρι — δηλαδή τη **διαδρομή του χεριού**. Ο χρήστης όμως βλέπει (και θα πάρει) την
     * **προεπισκόπηση**, που περιλαμβάνει **και την πηγή**: σύρσιμο μιας γραμμής προς τα κάτω
     * δίνει διαδρομή `2R` αλλά γέμισμα `2R` **μαζί με** την πηγή ⇒ διαφορετικοί αριθμοί για
     * επιλογή τεσσάρων στηλών. Με ταυτοτική μετάφραση, το πλαίσιο ονόματος θα διαφωνούσε με το
     * περίγραμμα του **ίδιου καρέ** — και αυτή ακριβώς η κατηγορία σφάλματος (δύο απαντήσεις
     * για το ίδιο πράγμα μέσα στο ίδιο καρέ) είναι που γέννησε το `tableFillSourceBounds`.
     *
     * Ρωτά τα **ίδια** `tableFillPreviewBounds` + `cellAt` που χρησιμοποιεί το `selectFilled`
     * — δηλαδή αυτό που θα μαρκαριστεί όταν αφήσεις. Η ένδειξη είναι **υπόσχεση**, όχι δεύτερος
     * υπολογισμός.
     *
     * `null` όσο ο στόχος δεν λύνεται (χέρι έξω από το πλέγμα, μπαγιάτικα όρια): καμία ένδειξη
     * είναι καλύτερη από μαντεψιά — η ίδια σύμβαση με όλο το αρχείο.
     */
    sizeReadout: () => {
      if (target === null) return null;
      const bounds = tableFillPreviewBounds(source, target);
      const from = cellAt(model, bounds.firstRow, bounds.firstCol);
      const to = cellAt(model, bounds.lastRow, bounds.lastCol);
      return from && to ? { from, to, kind: 'range' } : null;
    },
    // ADR-754 §5 — ο **ίδιος** κύκλος ζωής, τρίτος παραλήπτης: γράφεται **μόνο** η υπόσχεση.
    write: (span) => {
      target = fillTargetOf(model, source, span.to);
      setTableFillPreview(
        target === null
          ? null
          : { entityId: press.entity.id, bounds: tableFillPreviewBounds(source, target) },
      );
      showFillLabel();
    },
    // 🔴 ADR-828 §5 — το `Ctrl` πατήθηκε ή αφέθηκε **χωρίς** να κουνηθεί το χέρι. Εδώ γράφεται
    // μόνο η πρόθεση· την επανα-δημοσίευση την κάνει η ίδια η συνεδρία, αμέσως μετά.
    //
    // 🔴 §7.2 — **απών στο δεξί σύρσιμο**, και όχι για οικονομία: εκεί το `Ctrl` δεν σημαίνει
    // τίποτα (την πρόθεση τη δίνει το μενού), οπότε ένας παρατηρητής θα ήταν σκέτο κόστος σε
    // κάθε πάτημα πλήκτρου του κόσμου — ακριβώς αυτό που η προαιρετικότητα του `onModifier`
    // υπάρχει για να αποφύγει.
    onModifier: withMenu
      ? undefined
      : (next) => {
          modifiers = next;
        },
    // 🔴 Το μοντέλο γράφεται **μία φορά**, εδώ. Δες την κεφαλίδα.
    onEnd: (release) => {
      clearTableFillPreview();
      hideTableResizeReadout();
      if (target === null) return;
      const chosen = target;

      // 🔴 §7.2 — **ΤΟ ΔΕΞΙ ΡΩΤΑΕΙ.** Καμία εγγραφή εδώ: το μενού κρατά την πράξη και τη
      // λύνει όταν —και **αν**— ο άνθρωπος διαλέξει. Ένα `Escape` δεν γράφει τίποτα, όπως στο
      // Excel. Δες `table-fill-menu-port.ts` για το γιατί δεν περνά από τον δρομολογητή.
      if (withMenu) {
        getTableFillMenuPort()?.open(release.clientX, release.clientY, {
          offer: tableFillMenuOffer(model, source, chosen, autoFillListCandidates()),
          seeds: tableFillSourceTexts(model, source),
          apply: (mode) => commitFill(chosen, mode),
        });
        return;
      }

      // Η **ίδια** ερώτηση που απάντησε η ετικέτα ένα καρέ πριν — ο χρήστης παίρνει ό,τι είδε.
      commitFill(chosen, tableFillModeFor(model, source, chosen, modifiers, autoFillListCandidates()));
    },
  });
  return true;
}

/**
 * 🔴 ADR-828 §7.2 — **Η ΜΙΑ ΕΓΓΡΑΦΗ**, κοινή σε **τρεις** αφορμές.
 *
 * Το αριστερό σύρσιμο τη φτάνει αμέσως με τη δική του πρόθεση· το δεξί τη φτάνει από το μενού,
 * αργότερα και με άλλη· και από τη Φ4α τη φτάνει **και το κουμπί επιλογών** — με πάτημα ή με
 * `Alt+↓`, ώρες μετά τη χειρονομία. Ο κώδικας που γράφει είναι ο **ίδιος** σε όλες, αλλιώς οι
 * διαδρομές θα μπορούσαν να αποκλίνουν στο τι μαρκάρεται μετά, δηλαδή στο μόνο σημείο όπου η
 * απόκλιση δεν είναι ορατή σε κανένα test που κοιτά μοντέλο.
 *
 * ⚠️ Διαβάζει τη σκηνή **τώρα** ({@link TableFillWriter.liveTable}), όχι από το πάτημα:
 * `null` ⇒ ο πίνακας δεν υπάρχει πια (undo, αλλαγή ορόφου) και η σωστή πράξη είναι **καμία**.
 *
 * ## 🔴 Φ4α — ΕΔΩ ΟΠΛΙΖΕΤΑΙ ΤΟ ΚΟΥΜΠΙ, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΠΑΝ-ΟΠΛΙΖΕΤΑΙ ΔΩΡΕΑΝ
 * Επειδή αυτή είναι η **μία** εγγραφή, το κουμπί γεννιέται από κάθε συμπλήρωση χωρίς να το
 * ξέρει καμία από τις τρεις αφορμές — και, κρίσιμο, **ξαναγεννιέται** όταν ο άνθρωπος διαλέξει
 * κάτι από το ίδιο του το μενού: εκείνη η επιλογή περνά από εδώ, άρα γράφει νέα σφραγίδα
 * έκδοσης. Έτσι μπορεί να δοκιμάσει «σειρά», να δει, και να γυρίσει σε «αντιγραφή» — Excel
 * parity, με **μηδέν** γραμμές αφιερωμένες στην επαν-όπλιση.
 *
 * ⚠️ Η σφραγίδα είναι το **νέο** μοντέλο, όχι το `activeTableModel(live)`: το `UpdateEntityCommand` γράφει
 * ακριβώς την αναφορά που του δόθηκε, οπότε από την επόμενη ανάγνωση η οντότητα **ταυτίζεται**
 * με αυτό. Αν η εγγραφή αποτύχει σιωπηλά (κανένας ενεργός όροφος), η οντότητα κρατά την **παλιά**
 * αναφορά ⇒ η σφραγίδα είναι μπαγιάτικη από τη γέννησή της ⇒ κανένα κουμπί. Αστοχία **προς τη
 * σιωπή**, που είναι η μόνη ανεκτή κατεύθυνση για affordance που υπόσχεται πράξη.
 */
export function commitTableFill(
  writer: TableFillWriter,
  source: TableCellRangeBounds,
  target: TableFillTarget,
  mode: TableFillMode,
): void {
  const live = writer.liveTable();
  if (live === null) return;
  const nextModel = applyTableFill(activeTableModel(live), source, target, mode, autoFillListCandidates());
  writer.commit(live, nextModel);
  selectFilled(source, target, resolveTableModel(activeTableModel(live)));
  setTableFillBadge({
    entityId: live.id,
    source,
    target,
    // Η **ίδια** ένωση που μόλις μαρκαρίστηκε — δες `tableFillPreviewBounds`. Δεύτερος
    // υπολογισμός εδώ θα ήταν δεύτερη απάντηση στο «ποια περιοχή γέμισε», και το κουμπί θα
    // μπορούσε να καθίσει κάτω από άλλο ορθογώνιο από αυτό που φωτίζεται.
    filled: tableFillPreviewBounds(source, target),
    modelRef: nextModel,
  });
}

/**
 * Η **πηγή** της συμπλήρωσης: η επιλογή αν υπάρχει, αλλιώς το ενεργό κελί.
 *
 * 🔴 **ADR-754 §14 — η απόφαση δεν γράφεται πια εδώ.** Εδώ ζούσε η **δεύτερη** διατύπωσή της
 * (`if (cursor.selection) return resolveTableSelectionBounds(...)`), δίπλα στην πρώτη του
 * ζωγράφου (`selectionBounds ?? ενεργό κελί`) — και οι δύο **διαφωνούσαν** όταν η επιλογή ήταν
 * μπαγιάτικη: ο ζωγράφος ζωγράφιζε λαβή στο ενεργό κελί, αυτός εδώ αρνιόταν να την πιάσει.
 * Τώρα ρωτούν οι τρεις (ζωγράφος, πάτημα, **δείκτης**) την ίδια `tableFillSourceBounds`.
 *
 * ⚠️ Η ανάλυση της επιλογής μένει εδώ και δεν μετακόμισε μέσα της: εκείνη τη ζητά ο ζωγράφος
 * **ήδη λυμένη** για το περίγραμμα του ίδιου καρέ, και μια δεύτερη ανάλυση εκεί θα ήταν δεύτερη
 * απάντηση στο «τι μάρκαρε ο χρήστης» μέσα στο ίδιο καρέ.
 */
function fillSourceBounds(model: TableModel, cursor: TableCellCursorState): TableCellRangeBounds | null {
  const cell: TableCellRef = { rowId: cursor.position.rowId, colId: cursor.position.colId };
  const selected = cursor.selection ? resolveTableSelectionBounds(model, cursor.selection) : null;
  return tableEffectiveRangeBounds(model, cell, selected);
}

/**
 * Έπεσε το πάτημα πάνω στη λαβή; Η γεωμετρία περνά από τον **έναν** δρόμο — τον ίδιο
 * `tableFillHandleHitAtFrame` που απαντά και στον **δείκτη** (§14). Ο χρήστης πιάνει ό,τι του
 * υπόσχεται ο λεπτός σταυρός, στο ίδιο ακριβώς pixel.
 *
 * ## 🔴 ADR-754 §14.9.2 — ΕΔΩ Ο ΔΕΙΚΤΗΣ ΕΨΕΥΔΕΤΑΙ, ΚΑΙ Η ΑΙΤΙΑ ΗΤΑΝ **ΤΑ ΟΡΙΣΜΑΤΑ**
 * Έγραφε `tableWorldToFrame(press.entity, press.worldPoint.x, press.worldPoint.y, mmToWorld)` —
 * **τέσσερα** ορίσματα σε συνάρτηση **τριών**. Δηλαδή το `world` έπαιρνε **αριθμό** (`x`), το
 * `mmToWorld` έπαιρνε το **`y` του κόσμου**, και το τέταρτο αγνοούνταν. Το `world.x` ήταν
 * `undefined` ⇒ `{ u: NaN, v: NaN }` ⇒ **κάθε** σύγκριση του `isOnTableFillHandle` ψευδής ⇒
 * η συνάρτηση επέστρεφε `false` **πάντα**: η συμπλήρωση δεν εκτελέστηκε ποτέ, ενώ ο δείκτης
 * —που περνά από το `indicatorProbeBasis`, με τη **σωστή** κλήση— υποσχόταν `fill-handle`. Η
 * πρώτη παραβίαση του «*ο δείκτης δεν ψεύδεται*» (ADR-739 §31) στο έργο.
 *
 * 🔑 Το λάθος ήταν **αόρατο σε κάθε πύλη**: το `src/subapps/dxf-viewer/**` είναι εκτός του root
 * `tsconfig.json` (ADR-663), άρα ούτε το `npm run typecheck` ούτε το pre-commit hook είδαν ποτέ
 * το «Expected 3 arguments, but got 4» — και ο φρουρός **δεν είχε κανένα test**. Η μία γραμμή
 * που το κλείνει είναι η σωστή κλήση· το δίχτυ που το κρατά κλειστό ζει στο
 * `__tests__/table-fill-handle-drag.test.tsx`, που εκτελεί τη **ζωντανή** χειρονομία.
 */
function isOnHandle(press: TableFillHandlePress, source: TableCellRangeBounds): boolean {
  const probe = tableFillPressFrame(press);
  return tableFillHandleHitAtFrame(probe.layout, probe.frame, probe.pxPerMm, source) !== null;
}

/**
 * 🔴 ADR-828 Φ4α — **Η ΒΑΣΗ ΚΑΘΕ ΕΡΩΤΗΣΗΣ ΤΗΣ ΓΩΝΙΑΣ**: διάταξη, κλίμακα χαρτιού, κλίμακα px.
 *
 * Εξήχθη όταν η ίδια τριάδα απέκτησε **τρίτο** καταναλωτή: τη λαβή (πάτημα), το κουμπί
 * επιλογών (πάτημα) και το **πληκτρολόγιο** του κουμπιού, που δεν έχει σημείο αλλά χρειάζεται
 * ολόκληρη τη βάση για να βρει **πού** να αγκυρώσει το μενού.
 *
 * ⚠️ Το `pxPerMm` βγαίνει από το {@link tableMmToWorldLive} και **όχι** από το `mmToWorld` της
 * γεωμετρίας — η διατύπωση διατηρείται **ακέραιη** από τον φρουρό της λαβής. Δεν είναι
 * στολίδι: αν οι δύο αποκλίνουν σε κάποια κλίμακα σχεδίου, η αλλαγή της εδώ θα μετακινούσε τη
 * ζώνη σύλληψης της λαβής χωρίς κανείς να το ζητήσει — δηλαδή θα ήταν σιωπηλή αλλαγή
 * συμπεριφοράς κρυμμένη μέσα σε εξαγωγή.
 *
 * ⚠️ Ίδιο σχήμα με το `indicatorProbeBasis`, αλλά **χωρίς τον φύλακα LOD** του: εκείνος ρωτά
 * «ζωγραφίζεται ο δείκτης σε αυτό το ζουμ;», ερώτηση που δεν αφορά ούτε τη λαβή ούτε το
 * κουμπί — και τα δύο ζωγραφίζονται όσο υπάρχει δρομέας, ανεξάρτητα από τις ζώνες.
 */
export interface TableFillFrameBasis {
  readonly layout: TableLayout;
  readonly mmToWorld: number;
  readonly pxPerMm: number;
}

export function tableFillFrameBasis(entity: TableEntity, viewScale: number): TableFillFrameBasis {
  const geometry = computeTableEntityGeometryLive(entity);
  return {
    layout: geometry.layout,
    mmToWorld: geometry.mmToWorld,
    pxPerMm: tablePxPerMm(tableMmToWorldLive(), viewScale),
  };
}

/** Η ίδια βάση, **με το σημείο του πατήματος** μεταφρασμένο στο πλαίσιο του πίνακα. */
export function tableFillPressFrame(
  press: TableFillHandlePress,
): TableFillFrameBasis & { readonly frame: TableFramePoint } {
  const basis = tableFillFrameBasis(press.entity, press.transform.scale);
  return { ...basis, frame: tableWorldToFrame(press.entity, press.worldPoint, basis.mmToWorld) };
}

/** Το κελί κάτω από το χέρι, μεταφρασμένο σε **δείκτες**, και από εκεί σε υπόσχεση. */
function fillTargetOf(model: TableModel, source: TableCellRangeBounds, to: TableCellRef) {
  const row = indexById(model.rows).get(to.rowId);
  const col = indexById(model.columns).get(to.colId);
  if (row === undefined || col === undefined) return null;
  return resolveTableFillTarget(source, { row, col });
}

/**
 * 🔴 Μετά τη συμπλήρωση, μαρκαρισμένη μένει **ολόκληρη** η περιοχή — πηγή και γέμισμα μαζί
 * (Excel parity). Χωρίς αυτό η λαβή θα έμενε στη γωνία της **παλιάς** επιλογής, δηλαδή ο
 * χρήστης θα έπρεπε να ξαναμαρκάρει για να συνεχίσει.
 */
function selectFilled(
  source: TableCellRangeBounds,
  target: NonNullable<ReturnType<typeof resolveTableFillTarget>>,
  model: TableModel,
): void {
  const bounds = tableFillPreviewBounds(source, target);
  const from = cellAt(model, bounds.firstRow, bounds.firstCol);
  const to = cellAt(model, bounds.lastRow, bounds.lastCol);
  if (from && to) setTableCellSelection({ from, to, kind: 'range' });
}

/** Δείκτες → ταυτότητες· `null` έξω από το πλέγμα (μπαγιάτικα όρια μετά από undo). */
function cellAt(model: TableModel, row: number, col: number): TableCellRef | null {
  const rowEntry = model.rows[row];
  const colEntry = model.columns[col];
  return rowEntry && colEntry ? { rowId: rowEntry.id, colId: colEntry.id } : null;
}
