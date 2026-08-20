/**
 * ADR-739 §31.10 — **η γεωμετρία της σύρσης**: πού βρίσκεται το κινούμενο άκρο, και τι
 * σημαίνει «ολόκληρη στήλη/γραμμή».
 *
 * Εξήχθη από το `use-table-cell-pointer` όταν εκείνο ξεπέρασε τις 500 γραμμές (N.7.1).
 * **Εξαγωγή, όχι κόψιμο**: καμία από αυτές τις συναρτήσεις δεν χρειάζεται τίποτα από το
 * hook — δεν βλέπουν React, δεν βλέπουν συνεδρία, δέχονται οντότητα + συμβάν και απαντούν.
 * Εκεί μένει το **ποιος ακούει και πότε**· εδώ ζει το **πού έπεσε και τι μαρκάρεται**.
 *
 * ⚠️ Δύο από τις πέντε (`selectWholeAxis`, `extendWholeAxis`) **γράφουν** στο store, και
 * αυτό είναι σκόπιμο: η επιλογή άξονα είναι μία αδιαίρετη πράξη «δρομέας + περιοχή» με
 * υποχρεωτική **σειρά** (το `setTableCellCursor` διαλύει κάθε υπάρχουσα περιοχή, δες τα
 * σχόλια παρακάτω). Σπασμένη στα δύο, η σειρά θα ήταν ευθύνη του καλούντος — δηλαδή κάτι
 * που ξεχνιέται στο δεύτερο σημείο κλήσης.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-pointer-axis-selection
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ο κύκλος ζωής των ακροατών
 * @see bim/table/table-cell-range.ts — ο ΕΝΑΣ ορισμός της «ολόκληρης στήλης/γραμμής»
 */

import type { RefObject } from 'react';
import {
  computeTableEntityGeometryLive,
  tableCellAtWorld,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import {
  tableAxisTickAtFrame,
  type TableIndicatorHit,
} from '../../bim/table/table-indicator-geometry';
import { tableEventWorldPoint } from './table-cell-pointer-hit';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';
// ADR-739 §26.15/§27.15 — ο ΕΝΑΣ ορισμός του «αυτό το πάτημα είναι της συνεδρίας μου», και
// στις δύο μορφές του (εστίαση / χειρονομία).
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
} from './table-cell-session-focus';
// ADR-739 §27.15 — ο κύκλος ζωής της σύρσης· εδώ ζει μόνο η **έναρξή** της.
import { startTableCellDrag } from './table-cell-drag-session';
// 🔴 ADR-739 §68 — ο ΕΝΑΣ φρουρός «επιτρέπεται στο δεξί κλικ να μετακινήσει;», και ο ΕΝΑΣ
// ορισμός του «έπεσε μέσα στην επιλογή;» για άξονες. Κανένα από τα δύο δεν ξαναγράφεται εδώ.
import { tableContextMenuMayMoveSelection } from './table-context-menu-selection';
import { resolveTableAxisActionTarget } from '../../bim/table/table-axis-action-target';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  setTableCellCursor,
  setTableCellSelection,
} from '../../state/table-cell-cursor-store';
// ADR-739 §27.16 Ε2 — ο ΕΝΑΣ ορισμός της «ολόκληρης στήλης/γραμμής» και ο ΕΝΑΣ επεκτατής.
import {
  extendTableSelectionTo,
  wholeAxisSelection,
  type TableCellRef,
  type TableSelectionSpan,
} from '../../bim/table/table-cell-range';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/** Το κινούμενο άκρο μιας σύρσης **κελιών**· `null` έξω από το πλέγμα (η επιλογή μένει). */
export function cellEndAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
): TableCellRef | null {
  const world = tableEventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const hit = tableCellAtWorld(entity, world, computeTableEntityGeometryLive(entity));
  return hit ? { rowId: hit.rowId, colId: hit.colId } : null;
}

/**
 * Το κινούμενο άκρο μιας σύρσης **άξονα** (πάνω στα γράμματα ή στους αριθμούς).
 *
 * Η θέση κατά μήκος του άξονα είναι το μόνο που μετράει — όπως στο Excel, όπου η σύρση
 * `B → D` συνεχίζει να επιλέγει στήλες ακόμα κι αν το χέρι ξεφύγει κατακόρυφα από τη
 * λωρίδα. Το άλλο άκρο καρφώνεται στο **τέλος** του πλέγματος, ώστε η στήλη/γραμμή να
 * μένει **ολόκληρη** σε κάθε καρέ της σύρσης.
 *
 * 🔴 §27.16 Ε2 — το «τέλος του πλέγματος» **δεν ξαναγράφεται εδώ**: είναι το `to` της
 * {@link wholeAxisSelection}, δηλαδή η ίδια έκφραση που δίνει και το σκέτο κλικ. Πριν
 * υπήρχε δεύτερη φορά, λίγες γραμμές πιο κάτω — δύο αντίγραφα που κανένα εργαλείο δεν
 * θα έπιανε και που θα απέκλιναν στην πρώτη αλλαγή.
 */
export function axisEndAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
  axis: 'column' | 'row',
): TableCellRef | null {
  const tick = axisTickAt(event, entity, container, transformRef, axis);
  return tick ? (wholeAxisSelection(entity.model, tick)?.to ?? null) : null;
}

/** Σε ποια στήλη/γραμμή δείχνει το συμβάν **κατά μήκος** του άξονα· `null` έξω από αυτόν. */
function axisTickAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
  axis: 'column' | 'row',
): TableIndicatorHit | null {
  const world = tableEventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const geometry = computeTableEntityGeometryLive(entity);
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);
  return tableAxisTickAtFrame(geometry.layout, frame, axis);
}

/**
 * Επιλογή **ολόκληρης** στήλης ή γραμμής.
 *
 * Δεν χρειάζεται νέος τύπος επιλογής: η περιοχή είναι ήδη «δύο γωνίες», και μια ολόκληρη
 * στήλη είναι απλώς η γωνία (πρώτη γραμμή, αυτή η στήλη) ως την (τελευταία γραμμή, αυτή η
 * στήλη). Το ενεργό κελί πάει στην **αρχή** του άξονα, όπως στο Excel: εκεί αρχίζει η
 * πληκτρολόγηση αν συνεχίσεις να γράφεις.
 *
 * Η σειρά μετράει: το `setTableCellCursor` **διαλύει** κάθε υπάρχουσα περιοχή (τεκμηριωμένο
 * στο store), οπότε η επιλογή γράφεται μετά — αλλιώς θα έσβηνε τη στιγμή που γεννιέται.
 *
 * Επιστρέφει την **άγκυρα** (τη γωνία που μένει) για τη σύρση που μπορεί να ακολουθήσει·
 * `null` σε πίνακα χωρίς γραμμές ή χωρίς στήλες.
 */
export function selectWholeAxis(entity: TableEntity, hit: TableIndicatorHit): TableCellRef | null {
  // 🔴 ADR-739 §27.15/§27.16 — η πρόθεση ταξιδεύει μαζί με τις γωνίες, και τις **τρεις** τις
  // παράγει ο ΕΝΑΣ ορισμός. Ο άξονας **δεν κουμπώνει** σε συγχωνεύσεις: ο πίνακας της
  // σκηνής έχει τίτλο συγχωνευμένο σε όλες τις στήλες, και χωρίς αυτή τη λέξη το «κλικ στο
  // B» μάρκαρε **ολόκληρο τον πίνακα** (Giorgio, 02/08).
  const selection = wholeAxisSelection(entity.model, hit);
  if (!selection) return null;

  setTableCellCursor(entity.id, tableCursorAt(selection.from.rowId, selection.from.colId), 'nav');
  setTableCellSelection(selection);
  return selection.from;
}

/**
 * 🔴 ADR-739 §27.16 Ε2 — **`Shift+κλικ` σε δεύτερο γράμμα/αριθμό**.
 *
 * Excel: κλικ στο «A», `Shift+κλικ` στο «C» ⇒ **τρεις ολόκληρες στήλες**. Επιστρέφει την
 * **άγκυρα** που μένει (για τη σύρση που μπορεί να ακολουθήσει), ή `null` όταν αυτό το
 * πάτημα **δεν** είναι επέκταση και πρέπει να το χειριστεί ο κανονικός δρόμος.
 *
 * ## Επεκτείνει ΜΟΝΟ όταν η τρέχουσα επιλογή είναι του ΙΔΙΟΥ άξονα — και γιατί
 * Αν η τρέχουσα επιλογή είναι **περιοχή** (ή ο άλλος άξονας) και ο χρήστης κάνει
 * `Shift+κλικ` σε γράμμα στήλης, δεν υπάρχει σωστό `kind` για το αποτέλεσμα: κάθε επιλογή
 * θα ήταν **εφεύρεση**. Το §27.15 έβγαλε ρητά την προεπιλογή από το `kind` ακριβώς για να
 * μην μπορεί να συμβεί σιωπηλά αυτό. Άρα το πάτημα πέφτει πίσω στη συμπεριφορά του σκέτου
 * κλικ — **νέα** επιλογή άξονα, ακριβώς αυτό που βλέπει ο χρήστης σε κάθε φύλλο υπολογισμού
 * όταν αλλάζει είδος επιλογής.
 *
 * ## Καμία δέσμευση προχείρου — και είναι κανόνας, όχι παράλειψη
 * Ο κανόνας που ισχύει παντού στη συνεδρία: **δεσμεύεις μόνο όταν κουνιέται το ενεργό
 * κελί**. Η επέκταση δεν το κουνά (ίδια σύμβαση με `Shift+βέλος` και `Shift+κλικ` σε κελί).
 */
export function extendWholeAxis(
  entity: TableEntity,
  hit: TableIndicatorHit,
  selection: TableSelectionSpan | null | undefined,
): TableCellRef | null {
  if (!selection || selection.kind !== hit.axis) return null;
  const target = wholeAxisSelection(entity.model, hit);
  if (!target) return null;
  // Ο ΕΝΑΣ επεκτατής — ο ίδιος που εξυπηρετεί το `Shift+βέλος` (§27.16 Ε2).
  const extended = extendTableSelectionTo(selection, target.to);
  setTableCellSelection(extended);
  return extended.from;
}

/**
 * 🔴 ADR-739 §27.16 — **ΤΟ ΠΑΤΗΜΑ ΕΠΕΣΕ ΣΕ ΖΩΝΗ** (γράμμα στήλης / αριθμό γραμμής): μαρκάρεται
 * ολόκληρος ο άξονας, και η σύρση από εκεί μαρκάρει πολλούς.
 *
 * Ήρθε εδώ από το `use-table-cell-pointer` όταν εκείνο ξαναχτύπησε τις 500 γραμμές (N.7.1).
 * **Εξαγωγή, όχι κόψιμο**: ο κλάδος καλούσε ήδη **και τις τρεις** συναρτήσεις αυτού του module
 * ({@link extendWholeAxis}, {@link selectWholeAxis}, {@link axisEndAt}) και **τίποτα άλλο** από
 * το hook πέρα από τη δέσμευση προχείρου — δηλαδή ήταν η δρομολόγηση της ίδιας γεωμετρίας,
 * γραμμένη ένα αρχείο πιο πέρα από αυτήν.
 *
 * ⚠️ Η **σειρά** μέσα του είναι η προδιαγραφή, όχι στυλ: δήλωση συνεδρίας **και** χειρονομίας
 * πριν από κάθε έξοδο (αλλιώς το δεξί κλικ αφήνει «πίνακας χωρίς δρομέα», §27.14, και το
 * body-drag του ADR-560 armάρει στα 3 px, §27.15) · `Shift` πριν από το σκέτο κλικ (η πιο
 * **ειδική** ερώτηση πρώτη) · δέσμευση προχείρου **μόνο** στον δρόμο που κουνά το ενεργό κελί.
 *
 * @param primary `true` για το αριστερό πλήκτρο· το δεξί **εγκαθιστά τον στόχο του** (§68).
 * @param commitPending Δέσμευση ό,τι γράφεται, πριν κουνηθεί ο δρομέας (§26.15).
 */
export function handleTableBandMouseDown(params: {
  readonly entity: TableEntity;
  readonly hit: TableIndicatorHit;
  /**
   * 🔴 §68 — ο **ολόκληρος** δρομέας, όχι μόνο η επιλογή: το δεξί κλικ ρωτά επιπλέον το `mode`
   * (ο φρουρός «γράφει κάποιος τώρα;»). Δύο πεδία της ίδιας κατάστασης — και ο καλών τα
   * διαβάζει ούτως ή άλλως μαζί, με **μία** ανάγνωση τη στιγμή του συμβάντος.
   */
  readonly cursor: TableCellCursorState;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
  readonly primary: boolean;
  readonly shiftKey: boolean;
  readonly commitPending: () => void;
}): void {
  const { entity, hit, cursor, container, transformRef, primary, shiftKey } = params;
  const selection: TableSelectionSpan | null = cursor.selection;
  claimTableCellSessionPointerDown();
  claimTableCellPointerGesture();
  // 🔴 §68 — **ΤΟ ΔΕΞΙ ΜΑΡΚΑΡΕΙ ΤΟΝ ΑΞΟΝΑ ΠΟΥ ΠΑΤΗΘΗΚΕ**, όταν είναι έξω από την επιλογή (Excel:
  // με μαρκαρισμένες τις `B:D`, δεξί κλικ στο `C` τις κρατά, στο `F` μαρκάρει μόνο την `F`).
  // Εδώ έγραφε «το δεξί σταματά εδώ: δήλωσε και παραδώσου» (§27.14) — η δήλωση από πάνω μένει,
  // η ακινησία έφυγε. Δες `table-context-menu-selection.ts` για την αρχή και τους φρουρούς.
  if (!primary) {
    installAxisMenuSelection(entity, hit, cursor, params.commitPending);
    return;
  }
  const startDrag = (anchor: TableCellRef): void => {
    startTableCellDrag({
      anchor,
      kind: hit.axis,
      container,
      // Το κινούμενο άκρο ακολουθεί μόνο τη θέση **κατά μήκος** του άξονα — γι' αυτό το
      // `tableAxisTickAtFrame` μέσα στο `axisEndAt` αγνοεί τη ζώνη.
      resolveAt: (moveEvent) => axisEndAt(moveEvent, entity, container, transformRef, hit.axis),
    });
  };
  // 🔴 §27.16 Ε2 — `Shift+κλικ` σε δεύτερο γράμμα/αριθμό: **επέκταση**, όχι νέα επιλογή.
  // Δοκιμάζεται πρώτη γιατί είναι η πιο **ειδική** ερώτηση· όταν δεν ισχύει (καμία επιλογή, ή
  // επιλογή άλλου είδους) επιστρέφει `null` και το πάτημα συνεχίζει στον κανονικό δρόμο —
  // δηλαδή γίνεται σκέτο κλικ, χωρίς καμία εφεύρεση.
  const shiftAnchor = shiftKey ? extendWholeAxis(entity, hit, selection) : null;
  if (shiftAnchor) {
    startDrag(shiftAnchor);
    return;
  }
  // Η ζώνη μετακινεί το ενεργό κελί στην αρχή του άξονα, άρα ισχύει το ίδιο συμβόλαιο με το
  // απλό κλικ: ό,τι γράφεται δεσμεύεται πρώτα.
  params.commitPending();
  // Σύρση **πάνω στα γράμματα/αριθμούς** = πολλές ολόκληρες στήλες/γραμμές (Excel).
  const axisAnchor = selectWholeAxis(entity, hit);
  if (axisAnchor) startDrag(axisAnchor);
}

/**
 * 🔴 ADR-739 §68 — η **τρίτη** διαδρομή του «το δεξί κλικ εγκαθιστά τον στόχο του».
 *
 * Ζει εδώ και όχι δίπλα στις άλλες δύο επειδή ο γραφέας του άξονα ({@link selectWholeAxis})
 * ζει εδώ: μια κλήση από το `table-context-menu-selection` θα ήταν **κύκλος εισαγωγών**. Ο
 * κοινός *κανόνας* δεν διχάζεται παρ' όλα αυτά — ο φρουρός `nav` εισάγεται από εκεί, και το
 * «μέσα ή έξω;» είναι το `insideSelection` του {@link resolveTableAxisActionTarget}, δηλαδή
 * **ακριβώς** το κριτήριο που θα εφαρμόσει το μενού λίγα χιλιοστά αργότερα.
 *
 * ⚠️ Δύο κριτήρια εδώ θα σήμαιναν «μάρκαρα τη `C` και έσβησα τις `B:D`» ενώ ο τίτλος του μενού
 * γράφει `B:D` — η οθόνη να λέει άλλα από την πράξη, δηλαδή το ελάττωμα του §27.17 ανάποδα.
 *
 * ⚠️ **Καμία σύρση**: το δεξί δεν σύρει ποτέ, και μια σύρση οπλισμένη εδώ θα περίμενε στο
 * `document` ένα `mouseup` που ήρθε ήδη — δηλαδή θα μάρκαρε άξονες στην **επόμενη** κίνηση.
 */
function installAxisMenuSelection(
  entity: TableEntity,
  hit: TableIndicatorHit,
  cursor: TableCellCursorState,
  commitPending: () => void,
): void {
  if (!tableContextMenuMayMoveSelection(cursor)) return;

  const target = resolveTableAxisActionTarget(resolveTableModel(entity.model), hit, cursor.selection);
  // `null` ⇒ μπαγιάτικη ταυτότητα άξονα μετά από undo: καμία μαντεψιά, καμία εγγραφή.
  if (!target || target.insideSelection) return;

  // Η ζώνη μετακινεί το ενεργό κελί στην **αρχή** του άξονα, άρα ισχύει το ίδιο συμβόλαιο με το
  // αριστερό κλικ: ό,τι γράφεται δεσμεύεται πρώτα.
  commitPending();
  selectWholeAxis(entity, hit);
}
