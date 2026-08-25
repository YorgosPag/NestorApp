'use client';

/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **Η ΧΕΙΡΟΝΟΜΙΑ ΤΗΣ ΜΕΤΑΦΟΡΑΣ**: πιάσε το περίγραμμα, σύρε, άσε.
 *
 * Η **τρίτη** χειρονομία του πίνακα, με το **σκόπιμα ίδιο** σχήμα με τις δύο πρώτες
 * (`table-cell-drag-session`, `table-axis-resize-drag`): ακροατές στο `document`, ένας
 * ενεργός κύκλος τη φορά, ρητό `end…` στην αποπροσάρτηση. **Καμία τέταρτη κλάση drag
 * controller** — το SSoT audit (02/08) μέτρησε ήδη τρεις ανεξάρτητες κλάσεις `idle → dragging`
 * και **κανέναν** γενικό SSoT· μια τέταρτη θα ήταν ακριβώς ο structural clone του CHECK 3.28.
 * Εδώ δεν υπάρχει μηχανή καταστάσεων, υπάρχουν **ακροατές που ζουν όσο η χειρονομία**.
 *
 * ## 🔴 ΤΟ DROP ΕΚΤΕΛΕΙ ΤΟ **ΣΧΕΔΙΟ ΠΟΥ ΕΙΔΕ Ο ΧΡΗΣΤΗΣ**, ΟΧΙ ΝΕΑ ΑΝΑΓΝΩΣΗ ΠΛΗΚΤΡΩΝ
 * Είναι η μία θέση όπου **αρνούμαστε** ρητά το parity, και ο λόγος είναι μετρημένος. Το Excel
 * διαβάζει την πρόθεση **τη στιγμή του `mouseup`**: τεκμηριωμένο και επαναλαμβανόμενο σε
 * οδηγούς — *«άσε πρώτα το ποντίκι και μετά το `Shift`· αν αφήσεις το `Shift` πρώτο, το Excel
 * γυρίζει σε σκέτη μετακίνηση και **αντικαθιστά** τη στήλη πάνω στην οποία έριξες»*. Δηλαδή
 * **η σειρά με την οποία χαλαρώνουν δύο δάχτυλα** αποφασίζει αν θα εισαχθούν δεδομένα ή θα
 * σβηστούν, και ο χρήστης έχει δει ως την τελευταία στιγμή τη γραμμή-Ι να υπόσχεται εισαγωγή.
 *
 * Εδώ το `mouseup` **δεν διαβάζει τίποτα**: εκτελεί το {@link pendingPlan}, δηλαδή ακριβώς το
 * σχέδιο που τροφοδοτούσε το φάντασμα στο τελευταίο καρέ. Η υπόσχεση και η πράξη γίνονται
 * **το ίδιο αντικείμενο**, άρα δεν μπορούν να αποκλίνουν. Δεν είναι «μαλακότερη» εκδοχή του
 * Excel — είναι η **αφαίρεση ενός δρόμου**: εκεί υπάρχουν δύο πηγές αλήθειας (η ζωγραφική και
 * το `mouseup`), εδώ μία.
 *
 * ⚠️ Αυτό **δεν** καταργεί την ανθρώπινη ταυτοχρονία: όποιος αφήσει το `Shift` κλάσματα πριν
 * το ποντίκι θα δει το φάντασμα να αλλάζει και **μετά** θα πάρει σκέτη μετακίνηση. Η διαφορά
 * είναι ότι θα το **δει**. Η τελευταία υπεράσπιση κατά της σιωπηλής καταστροφής είναι ούτως ή
 * άλλως η **Φάση 4** (*«υπάρχουν ήδη δεδομένα εδώ»*), που τροφοδοτείται από το ίδιο σχέδιο και
 * ζει στο `table-range-transfer-drop.ts` — **όχι** εδώ: αυτό το αρχείο τελειώνει σύγχρονα.
 *
 * ## 🔴 ΓΡΑΦΕΙ ΜΟΝΟ ΟΤΑΝ ΑΛΛΑΖΕΙ Η ΑΠΑΝΤΗΣΗ — ADR-735
 * Η σύρση είναι 60-120 συμβάντα το δευτερόλεπτο· η υπόσχεση αλλάζει μερικές φορές. Ο φύλακας
 * ζει στον **γραφέα** (`setTableRangeTransferPreview`), όχι εδώ, ώστε κανένας δεύτερος καλών
 * να μην μπορεί να τον παρακάμψει. Εδώ πληρώνεται μόνο ένα σχέδιο ανά κίνηση — καθαρή
 * γεωμετρία πάνω σε δείκτες, χωρίς μοντέλο, ακριβώς για να επιτρέπεται ανά καρέ (§36).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-range-transfer-drag
 * @see bim/table/table-range-drop-target.ts — τι ζητά αυτό το σημείο
 * @see bim/table/table-range-transfer-plan.ts — αν γίνεται, και τι ακριβώς
 * @see ui/table-cell-editor/table-range-transfer-drop.ts — ΦΑΣΗ 4: η ερώτηση και η γραφή
 * @see state/table-range-transfer-store.ts — πού ζει η υπόσχεση για τον ζωγράφο
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import {
  computeTableEntityGeometryLive,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import {
  edgeAutoPanSample,
  startDragEdgeAutoPan,
  stopDragEdgeAutoPan,
} from '../../systems/navigation/drag-edge-autopan';
import {
  planTableRangeTransfer,
  tableRangeDroppedRect,
} from '../../bim/table/table-range-transfer-plan';
import {
  completeTableRangeTransfer,
  type TableRangeDropTarget,
} from './table-range-transfer-drop';
import {
  tableRangeDropRequest,
  type TableRangeGrab,
} from '../../bim/table/table-range-drop-target';
import {
  tableRangeDragIntentOf,
  type TableRangeIntentModifiers,
} from '../../bim/table/table-range-move-zone';
import {
  MODIFIER_OBSERVER_PRIORITY,
  observeModifierSnapshot,
  type ModifierSnapshot,
} from '../../keyboard/modifier-snapshot';
import {
  clearTableRangeTransferPreview,
  getTableRangeTransferPreview,
  setTableRangeTransferPreview,
  type TableRangeTransferPreview,
} from '../../state/table-range-transfer-store';
import { tableEventWorldPoint } from './table-cell-pointer-hit';
import type { RefObject } from 'react';
import type { TableCellRangeBounds } from '../../bim/table/table-cell-range';
import type { TableIndicatorCursorRole } from '../../bim/table/table-indicator-cursor-role';
import type { TableRangeTransferPlan } from '../../bim/table/table-range-transfer-types';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/**
 * Ό,τι χρειάζεται η χειρονομία για να ζήσει — τη γεωμετρία τη διαβάζει μόνη της, ζωντανά.
 *
 * Επεκτείνει το {@link TableRangeDropTarget}: ό,τι αφορά τη **γραφή** (οντότητα, commit, ζωντανός
 * αναγνώστης) ορίζεται **μία** φορά, εκεί που ζει και η γραφή. Δεύτερη δήλωση των ίδιων τριών
 * πεδίων θα ήταν το σχήμα που αποκλίνει την πρώτη μέρα που θα προστεθεί τέταρτο.
 */
export interface TableRangeTransferStart extends TableRangeDropTarget {
  /** Η περιοχή που πιάστηκε από το περίγραμμά της (§36 / `tableRangeGrabAtWorld`). */
  readonly source: TableCellRangeBounds;
  /** Πού μέσα της έπεσε το χέρι — υπολογισμένο **μία** φορά, στην αρχή (§36). */
  readonly grab: TableRangeGrab;
  /** Το δοχείο του καμβά: γεωμετρία **και** η άκρη του auto-pan (§27.16 Ε1). */
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
}

/** Η κατάσταση ενός καρέ: τι δείχνει ο δείκτης, τι το φάντασμα, τι θα εκτελεστεί. */
interface TableRangeTransferFrame {
  readonly cursor: TableIndicatorCursorRole;
  readonly preview: TableRangeTransferPreview;
  /** `null` όταν η απόθεση **δεν** θα κάνει τίποτα (άρνηση ή καμία μετακίνηση ακόμη). */
  readonly plan: TableRangeTransferPlan | null;
}

/** Οι ακροατές της τρέχουσας σύρσης· `null` όταν δεν σέρνεται τίποτα. */
let activeTeardown: (() => void) | null = null;
/** Τι οφείλει ο δείκτης του ΟΣ **όσο** σέρνει — δες {@link activeTableRangeTransferCursor}. */
let activeCursor: TableIndicatorCursorRole | null = null;
/** Το σχέδιο του τελευταίου καρέ: αυτό ακριβώς εκτελεί το `mouseup`. Δες την κεφαλίδα. */
let pendingPlan: TableRangeTransferPlan | null = null;

/**
 * Ξεκινά μεταφορά περιοχής. Ιδεμποτής ως προς την προηγούμενη: μια νέα χειρονομία **κλείνει**
 * την προηγούμενη αντί να προστεθεί — δύο ταυτόχρονες σύρσεις δεν υπάρχουν.
 */
export function beginTableRangeTransfer(start: TableRangeTransferStart): void {
  if (typeof document === 'undefined') return;
  endTableRangeTransferDrag();

  /**
   * Η τελευταία θέση **του χεριού**. Τρεις αφορμές ξαναλύνουν την ίδια ερώτηση: κινήθηκε το
   * χέρι, κινήθηκε ο **κόσμος** (auto-pan), ή άλλαξε η **πρόθεση** (πλήκτρο) κάτω από ακίνητο
   * χέρι. Μία `applyAt`, τρεις καλούντες — δύο μονοπάτια θα ήταν δύο φύλακες που αποκλίνουν.
   */
  let lastEvent: MouseEvent | null = null;

  const applyAt = (event: MouseEvent, modifiers: TableRangeModifiers): void => {
    const frame = resolveTransferFrame(start, event, modifiers);
    if (!frame) return; // στιγμιαία αδύνατη ανάγνωση — η σύρση **επιζεί** (§31.9)
    activeCursor = frame.cursor;
    pendingPlan = frame.plan;
    setTableRangeTransferPreview(frame.preview);
  };

  const onMove = (event: MouseEvent): void => {
    // Το κουμπί αφέθηκε εκτός παραθύρου (ή το `mouseup` χάθηκε): τερμάτισε **χωρίς** εκτέλεση.
    // Μια μεταφορά που ο χρήστης δεν ολοκλήρωσε δεν επιτρέπεται να γράψει μοντέλο.
    if ((event.buttons & 1) === 0) {
      endTableRangeTransferDrag();
      return;
    }
    lastEvent = event;
    applyAt(event, event);
  };

  /**
   * 🔴 Η πρόθεση διαβάζεται από το **πλήκτρο**, όχι από το παλιό `MouseEvent`.
   *
   * Τα `ctrlKey`/`shiftKey` ενός `MouseEvent` είναι **παγωμένο στιγμιότυπο** της στιγμής που
   * γεννήθηκε. Επαναλαμβάνοντας το τελευταίο `mousemove` για να απαντηθεί ένα `Ctrl` που μόλις
   * πατήθηκε, η απάντηση θα ερχόταν από την **προηγούμενη** κατάσταση πλήκτρων — δηλαδή τίποτα
   * δεν θα άλλαζε μέχρι την επόμενη κίνηση, που είναι ακριβώς η συμπεριφορά που ο ακροατής
   * ήρθε να καταργήσει. Γι' αυτό ταξιδεύουν **δύο** αντικείμενα: το ένα δίνει **θέση**, το
   * άλλο **πρόθεση**.
   */
  const onModifier = (modifiers: ModifierSnapshot): void => {
    // Κανένας έλεγχος «είναι δικό μου πλήκτρο;»: ο παρατηρητής ειδοποιεί **μόνο** όταν
    // αλλάζει όντως η κατάσταση των modifiers. Το παλιό φίλτρο ήταν επίσης το μόνο που
    // κρατούσε έξω την **αυτόματη επανάληψη** του πλήκτρου — τώρα την κόβει η ισότητα
    // `Object.is` του store, δηλαδή δομικά αντί για χειροκίνητα.
    if (lastEvent) applyAt(lastEvent, modifiers);
  };

  const onUp = (): void => {
    // Η σειρά είναι το συμβόλαιο (§31.9): **πρώτα** σβήνουν οι ακροατές και το φάντασμα, μετά
    // γράφεται το μοντέλο. Το commit αλλάζει τη σκηνή, δηλαδή παράγει συμβάντα· ακροατής που
    // ζει ακόμα θα τα έβλεπε ως συνέχεια της σύρσης που μόλις τελείωσε.
    //
    // 🔴 §36 ΦΑΣΗ 4 — το συμβόλαιο **δεν** χαλαρώνει επειδή μπορεί να μεσολαβήσει ερώτηση: οι
    // ακροατές σβήνουν εδώ, σύγχρονα, **πάντα**. Ό,τι επιζεί ταξιδεύει σε τοπικές μεταβλητές
    // αυτού του κλεισίματος — καμία «εν αναμονή» κατάσταση σε επίπεδο module, δηλαδή τίποτα που
    // να μπορεί να επιβιώσει της συνεδρίας του (το σχήμα που η Φάση 3 απέκλεισε ρητά).
    const plan = pendingPlan;
    // Το τελευταίο καρέ **πριν** σβηστεί: αν ακολουθήσει ερώτηση, ο χρήστης πρέπει να συνεχίσει
    // να βλέπει **πού** προσγειώνεται αυτό που θα εγκρίνει. Δες `table-range-transfer-drop`.
    const lastFrame = getTableRangeTransferPreview();
    const target = start;
    endTableRangeTransferDrag();
    if (!plan) return;
    completeTableRangeTransfer(target, plan, lastFrame);
  };

  document.addEventListener('mousemove', onMove, { capture: true });
  document.addEventListener('mouseup', onUp, { capture: true });
  // Παθητικοί: **μόνο** ξαναρωτούν την ίδια ερώτηση. Στο `window`, γιατί το πληκτρολόγιο δεν
  // έχει θέση και η εστίαση ανήκει στο `<textarea>` της συνεδρίας — ακροατής στο δοχείο δεν
  // θα έβλεπε ποτέ το πλήκτρο (ίδιο σκεπτικό με τον δείκτη, §36).
  //
  // 🔴 **ΣΥΛΛΗΨΗ, ΚΑΙ ΤΟ ΒΡΗΚΕ Η ΟΘΟΝΗ.** Ο γραφέας του δείκτη (`use-table-indicator-hover`)
  // ακούει **κι αυτός** `keydown`/`keyup` στο `window`, εγγεγραμμένος στην **προσάρτηση** —
  // δηλαδή **πριν** από εδώ. Σε φάση αναπήδησης οι ακροατές του `window` τρέχουν με σειρά
  // εγγραφής, οπότε ο γραφέας ρωτούσε το {@link activeTableRangeTransferCursor} **πριν** αυτό
  // εδώ το ενημερώσει: με το χέρι ακίνητο, ένα `Shift` που κάνει την απόθεση παράνομη άφηνε
  // τον δείκτη να λέει «μετακίνηση» ενώ το φάντασμα είχε ήδη σβήσει. Ο δείκτης έλεγε **ψέματα**
  // κατά ένα συμβάν (§31: *ο δείκτης δεν επιτρέπεται να ψεύδεται*).
  //
  // Η **σύλληψη** το λύνει ντετερμινιστικά: το `window` είναι η κορυφή της διαδρομής, άρα οι
  // ακροατές σύλληψης εδώ τρέχουν **πριν** από κάθε ακροατή αναπήδησης — ανεξάρτητα από το
  // ποιος εγγράφηκε πρώτος. Ίδια θεραπεία με το `mousemove` παραπάνω, ίδιος λόγος.
  //
  // 🔑 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΠΛΕΟΝ ΔΗΛΩΜΕΝΗ, ΟΧΙ ΠΑΡΑΓΩΓΟ ΤΗΣ ΦΑΣΗΣ.** Η σύλληψη έλυνε το
  // πρόβλημα σωστά, αλλά **πλάγια**: ο λόγος ζούσε στο σχόλιο από πάνω και ο επόμενος
  // που θα άγγιζε οποιονδήποτε από τους δύο ακροατές δεν είχε τίποτα να τον σταματήσει.
  // Εδώ ο ρόλος γράφεται: **παραγωγός** — γράφει τον ενεργό δείκτη που ο γραφέας του
  // `use-table-indicator-hover` διαβάζει στο **ίδιο** πέρασμα.
  const stopObservingModifiers = observeModifierSnapshot(
    onModifier,
    MODIFIER_OBSERVER_PRIORITY.STATE_PRODUCER,
  );
  // §27.16 Ε1 — η άκρη: ο κόσμος κουνιέται κάτω από ακίνητο χέρι, η ερώτηση είναι η ίδια.
  startDragEdgeAutoPan({
    sample: () => (lastEvent ? edgeAutoPanSample(lastEvent, start.container) : null),
    onPanned: () => {
      if (lastEvent) applyAt(lastEvent, lastEvent);
    },
  });

  activeTeardown = (): void => {
    document.removeEventListener('mousemove', onMove, { capture: true });
    document.removeEventListener('mouseup', onUp, { capture: true });
    stopObservingModifiers();
    stopDragEdgeAutoPan();
  };
}

/**
 * Τερματίζει τη σύρση **χωρίς** να εκτελέσει τίποτα, και σβήνει το φάντασμα. Ιδεμποτής — και
 * γι' αυτό μπορεί να κληθεί από cleanup effect, όπου η συνεδρία μπορεί να έκλεισε με το κουμπί
 * ακόμα κάτω: οι ακροατές ζουν στο `document` και **δεν** θα έφευγαν μόνοι τους.
 */
export function endTableRangeTransferDrag(): void {
  activeTeardown?.();
  activeTeardown = null;
  activeCursor = null;
  pendingPlan = null;
  clearTableRangeTransferPreview();
}

/**
 * 🔴 §36 ΦΑΣΗ 3 — **ΤΙ ΟΦΕΙΛΕΙ Ο ΔΕΙΚΤΗΣ ΟΣΟ ΣΕΡΝΕΙ**· `null` όταν δεν σέρνεται τίποτα.
 *
 * Ο δείκτης έχει **έναν** γραφέα (`use-table-indicator-hover` → `setTableIndicatorCursor`) και
 * αυτό δεν αλλάζει: εδώ δεν γράφεται τίποτα, **ρωτιέται**. Χωρίς αυτό, η σάρωση του hover θα
 * απαντούσε «είμαι μέσα σε κελί ⇒ `cell`» μόλις το χέρι φύγει από το περίγραμμα — δηλαδή ο
 * δείκτης θα γινόταν σταυρός **στη μέση της μεταφοράς**, τη στιγμή ακριβώς που ο χρήστης
 * χρειάζεται να ξέρει ότι κρατά κάτι.
 */
export function activeTableRangeTransferCursor(): TableIndicatorCursorRole | null {
  return activeCursor;
}

/** Σέρνεται μεταφορά αυτή τη στιγμή; Μόνο για tests και για τον φύλακα αποπροσάρτησης. */
export function isTableRangeTransferDragging(): boolean {
  return activeTeardown !== null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Ό,τι χρειάζεται η πρόθεση — το ικανοποιούν **και** το `MouseEvent` **και** το `KeyboardEvent`. */
type TableRangeModifiers = TableRangeIntentModifiers;

/**
 * Η κατάσταση αυτού του καρέ· `null` όταν η προβολή δεν διαβάζεται (η σύρση επιζεί, §31.9).
 *
 * Οι τρεις εκβάσεις είναι **τρεις**, όχι δύο, και η μεσαία είναι η ενδιαφέρουσα:
 * ```
 *   σχέδιο ΟΚ            →  φάντασμα στο plan.destination        · δείκτης move/copy
 *   'no-movement'        →  φάντασμα ΠΑΝΩ ΣΤΗΝ ΠΗΓΗ, καμία άρνηση · δείκτης move/copy
 *   κάθε άλλη άρνηση     →  φάντασμα κόκκινο (αν σχεδιάζεται)     · δείκτης not-allowed
 * ```
 * Το `'no-movement'` **δεν** είναι άρνηση: είναι η κατάσταση κάθε σύρσης **στην αρχή της**,
 * όσο το χέρι δεν έχει βγει από την πηγή. Ένα `not-allowed` εκεί θα ανακοίνωνε αποτυχία τη
 * στιγμή που ο χρήστης απλώς ξεκινά — και θα ήταν το πρώτο πράγμα που θα έβλεπε **κάθε φορά**.
 */
function resolveTransferFrame(
  start: TableRangeTransferStart,
  event: MouseEvent,
  modifiers: TableRangeModifiers,
): TableRangeTransferFrame | null {
  const world = tableEventWorldPoint(event, start.container, start.transformRef.current);
  if (!world) return null;

  const { entity, source, grab } = start;
  const intent = tableRangeDragIntentOf(modifiers);
  const held: TableIndicatorCursorRole = intent.copy ? 'range-copy' : 'range-move';
  const geometry = computeTableEntityGeometryLive(entity);
  const asked = tableRangeDropRequest({
    model: entity.model,
    layout: geometry.layout,
    // ADR-040 — η προβολή διαβάζεται **τη στιγμή του συμβάντος**: ο χρήστης μπορεί να ζουμάρει
    // με τον τροχό ενώ σέρνει.
    frame: tableWorldToFrame(entity, world, geometry.mmToWorld),
    source,
    grab,
    intent,
  });
  if (!asked.ok) return refusedFrame(entity.id, null);

  const planned = planTableRangeTransfer(entity.model, asked.request);
  if (planned.ok) {
    return {
      cursor: held,
      plan: planned.plan,
      preview: {
        entityId: entity.id,
        // §36.5 — **το σχέδιο**, ποτέ η αφελής μετατόπιση: με `Shift` που κλείνει την τρύπα,
        // η περιοχή κάθεται ψηλότερα από όσο δείχνει η αφαίρεση δεικτών.
        destination: planned.plan.destination,
        insertAxis: intent.insert ? asked.request.shiftAxis : null,
        refused: false,
      },
    };
  }

  const dropped = tableRangeDroppedRect(entity.model, source, asked.request.to);
  if (planned.reason !== 'no-movement') return refusedFrame(entity.id, dropped);
  return {
    cursor: held,
    plan: null,
    preview: { entityId: entity.id, destination: dropped, insertAxis: null, refused: false },
  };
}

/** Άρνηση: κόκκινο φάντασμα όπου σχεδιάζεται, `not-allowed` **πάντα**. */
function refusedFrame(
  entityId: string,
  destination: TableCellRangeBounds | null,
): TableRangeTransferFrame {
  return {
    cursor: 'range-refuse',
    plan: null,
    preview: { entityId, destination, insertAxis: null, refused: true },
  };
}

