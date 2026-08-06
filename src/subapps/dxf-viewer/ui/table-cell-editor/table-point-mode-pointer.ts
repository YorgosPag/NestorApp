'use client';

/**
 * 🔴 ADR-754 §3 — **ΤΟ ΚΛΙΚ ΠΟΥ ΓΡΑΦΕΙ ΔΙΕΥΘΥΝΣΗ ΑΝΤΙ ΝΑ ΜΕΤΑΚΙΝΗΣΕΙ ΤΟΝ ΔΡΟΜΕΑ.**
 *
 * Ο χρήστης γράφει `=` σε ένα κελί, κάνει κλικ σε ένα άλλο, και η διεύθυνσή του (`E4`) μπαίνει
 * μέσα στον τύπο. Είναι η «κατάσταση Point» του Excel — και εδώ **δεν είναι κατάσταση**.
 *
 * ## Τι ΔΕΝ υπάρχει σε αυτό το αρχείο
 * Δεν υπάρχει σημαία «είμαι σε υπόδειξη», δεν υπάρχει τέταρτη τιμή στο `TableCellCursorMode`,
 * δεν υπάρχει τίποτα να συγχρονιστεί. Η απάντηση στο «τι σημαίνει τώρα αυτό το κλικ;»
 * **παράγεται** κάθε φορά από δύο πράγματα που υπάρχουν ήδη: το **πρόχειρο** (store) και τη
 * **θέση του κέρσορα** (το εστιασμένο πεδίο). Συνέπεια που κερδήθηκε δωρεάν: `Enter`,
 * `Escape`, `F2` και η πληκτρολόγηση **δεν χρειάστηκαν καμία γραμμή** — αλλάζουν το πρόχειρο,
 * άρα η απάντηση πέφτει μόνη της σε `off`.
 *
 * ## Ο καταμερισμός — τρία αρχεία, τρεις ερωτήσεις
 * | ερώτηση | ποιος απαντά |
 * |---|---|
 * | «τι σημαίνει τώρα ένα κλικ;» | `formula/table-formula-point-state.ts` (καθαρό) |
 * | «τι γίνεται το κείμενο;» | `formula/table-formula-reference-edit.ts` (καθαρό) |
 * | «πού έπεσε το χέρι, και ποιος γράφει;» | **εδώ** (DOM + store) |
 *
 * Τα δύο πρώτα είναι καθαρά επίτηδες: τα καταναλώνουν **και τα δύο** πεδία της συνεδρίας
 * (κελί και γραμμή τύπων) και δεν επιτρέπεται να ξέρουν από `<textarea>`.
 *
 * ## 🔴 ADR-763 Φ2.4 — Η ΤΕΤΑΡΤΗ ΕΡΩΤΗΣΗ ΠΟΥ ΕΛΕΙΠΕ: «**ΠΟΙΟΣ** ΓΡΑΦΕΙ;»
 * Μέχρι τη Φ2.2 η απάντηση ήταν μία και υπονοούμενη — το πρόχειρο του κελιού. Ο διάλογος
 * «Ορίσματα συνάρτησης» πρόσθεσε **δεύτερο** παραλήπτη, και μαζί του ένα σφάλμα που δεν
 * φαινόταν πουθενά: ο κέρσορας ερχόταν από το **κουτί ορίσματος** (φέρει το ίδιο σημάδι
 * συνεδρίας, υποχρεωτικά — ADR-763 §10) και μετριόταν πάνω στο **κείμενο του κελιού**. Με κενό
 * κουτί η απάντηση ήταν πάντα `off` και **το κλικ δεν έγραφε πουθενά**· με γεμάτο, ο δείκτης
 * έπεφτε μέσα στο όνομα της συνάρτησης και θα έγραφε διεύθυνση **εκεί**, σιωπηλά.
 *
 * Η διόρθωση είναι **δρομολόγηση, όχι δεύτερη μηχανή**: κείμενο, κέρσορας και γραφέας έρχονται
 * πλέον **μαζί**, από τον έναν {@link TablePointTarget}, ώστε η αναντιστοιχία να είναι μη
 * εκφράσιμη. Ίδιο σχήμα με την παραμετροποίηση `write` της σύρσης (δες παρακάτω): αλλάζει ο
 * **παραλήπτης**, όχι ο μηχανισμός.
 *
 * ## 🔴 Γιατί ΔΕΝ γράφεται εδώ δεύτερος βρόχος `mousemove`
 * Η σύρση υπόδειξης (`=SUM(` + σύρσιμο ⇒ `=SUM(A1:B5`) είναι η **ίδια χειρονομία** με τη
 * σύρση επιλογής: ίδιος κύκλος ζωής, ίδιος φύλακας «γράψε μόνο όταν αλλάζει κελί» (ADR-735),
 * ίδιο auto-pan στην άκρη. Αλλάζει **μόνο ο παραλήπτης**. Γι' αυτό το
 * `table-cell-drag-session.ts` απέκτησε παράμετρο `write` και όχι δίδυμο — δες την τεκμηρίωση
 * εκεί (N.18 / CHECK 3.28).
 *
 * ## 🔴 Γιατί οι ζώνες δείκτη γράφουν `E1:E5` και όχι `E:E`
 * Στο Excel το κλικ σε γράμμα στήλης μέσα σε τύπο δίνει **ολόκληρη τη στήλη** (`E:E`). Η
 * γραμματική μας δεν έχει τέτοια μορφή — και **δεν πρέπει να αποκτήσει**: το `E:E` είναι
 * λύση για φύλλο **χωρίς τέλος**, και είναι τεκμηριωμένη πηγή προβλημάτων (πλήρης στήλη ⇒
 * περιττός υπολογισμός, σπασμένες αναφορές σε εισαγωγή γραμμών). Ένας πίνακας CAD έχει
 * **πεπερασμένες** γραμμές, άρα το `E1:E5` λέει το ίδιο πράγμα **ακριβώς** — και το λέει με
 * τον ΕΝΑ ορισμό της «ολόκληρης στήλης» που ήδη χρησιμοποιούν το κλικ, η σύρση και το
 * `Shift+κλικ` στη ζώνη (`wholeAxisSelection`). Μηδέν νέα γραμματική, μηδέν νέα γεωμετρία.
 *
 * ## Ρητό όριο: τα **διαχωριστικά** δεν είναι αναφορές
 * Πάτημα στο σύνορο δύο γραμμάτων είναι **σύρσιμο πλάτους** — γεωμετρία, όχι διεύθυνση. Το
 * αφήνουμε να πέσει στον κανονικό δρόμο (δέσμευση + resize), γιατί ο χρήστης που σημαδεύει
 * διαχωριστικό σημαδεύει διαχωριστικό. Καταγράφεται εδώ ώστε η επόμενη ανάγνωση να ξέρει ότι
 * είναι **απόφαση**, όχι παράλειψη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-point-mode-pointer
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ο ΕΝΑΣ φρουρός που το καλεί
 * @see ui/table-cell-editor/table-cell-drag-session.ts — ο ΕΝΑΣ κύκλος ζωής της σύρσης
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §3
 */

import type { RefObject } from 'react';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { parseTableCellReference } from '../../bim/table/table-cell-reference';
import { resolveFormulaPointState } from '../../bim/table/formula/table-formula-point-state';
import {
  applyPointedReference,
  pointedCellReference,
  pointedRangeReference,
} from '../../bim/table/formula/table-formula-reference-edit';
// 🔴 Ο ΕΝΑΣ ορισμός της «ολόκληρης στήλης/γραμμής» — ο ίδιος που εξυπηρετεί το κλικ στη ζώνη,
// το κινούμενο άκρο της σύρσης και το `Shift+κλικ` (ADR-739 §27.16 Ε2). **Καθαρός**: σε
// αντίθεση με το `selectWholeAxis`, δεν γράφει στο store — και εδώ αυτό είναι απαραίτητο,
// γιατί μια μετακίνηση δρομέα θα έσβηνε το πρόχειρο που μόλις πάμε να επεξεργαστούμε.
import { wholeAxisSelection } from '../../bim/table/table-cell-range';
import { axisEndAt, cellEndAt } from './table-pointer-axis-selection';
import { startTableCellDrag } from './table-cell-drag-session';
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
} from './table-cell-session-focus';
// 🔴 ADR-763 Φ2.4 — **ΠΟΥ πάει η διεύθυνση**: στο πρόχειρο του κελιού, ή στο ενεργό κουτί
// ορίσματος όσο ο διάλογος της Φάσης 2 είναι ανοιχτός. Δες την κεφαλίδα εκείνου του module για
// το γιατί η απάντηση εκφράζεται **πάντα ως τύπος** και όχι με κλάδο εδώ.
import { resolveTablePointTarget, type TablePointTarget } from './table-point-target';
// ADR-763 Φ2.4 — η **αυτόματη σύμπτυξη** της κάρτας όσο κρατά η χειρονομία. No-op όταν ο
// διάλογος δεν είναι ανοιχτός, δηλαδή στην ιστορική διαδρομή δεν αλλάζει τίποτα.
import { setFunctionArgumentPointing } from '../../state/function-arguments-dialog-store';
import type { FormulaPointState } from '../../bim/table/formula/table-formula-point-state';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import type { TableCellRef, TableSelectionKind } from '../../bim/table/table-cell-range';
import type { TablePointerHit } from './table-cell-pointer-hit';
import type { TableModel } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/** Ό,τι ξέρει ο φρουρός του ποντικιού τη στιγμή του πατήματος. */
export interface TablePointModePress {
  /** Η **ζωντανή** οντότητα του δρομέα. */
  readonly entity: TableEntity;
  readonly cursor: TableCellCursorState;
  /** Πού έπεσε το πάτημα — η **ίδια** απάντηση που χρησιμοποιεί και ο κανονικός δρόμος. */
  readonly hit: TablePointerHit | null;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
}

/** Η χειρονομία που ξεκινά: ποια γωνία μένει, πού βρίσκεται τώρα, πώς κινείται. */
interface PointedGesture {
  /** Η γωνία που **ΜΕΝΕΙ** — ίδια σύμβαση με τη σύρση επιλογής. */
  readonly anchor: TableCellRef;
  /** Το άκρο **τη στιγμή του πατήματος**: το ίδιο κελί, ή το τέλος ολόκληρου άξονα. */
  readonly end: TableCellRef;
  readonly kind: TableSelectionKind;
  readonly resolveAt: (event: MouseEvent) => TableCellRef | null;
}

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ.** `true` ⇒ αυτό το πάτημα ήταν υπόδειξη· το κατανάλωσε ολόκληρο (δήλωση,
 * `preventDefault`, γραφή, έναρξη σύρσης) και ο καλών οφείλει να σταματήσει εκεί.
 *
 * `false` ⇒ δεν είναι υπόδειξη· ο κανονικός δρόμος τρέχει αυτούσιος. Η άρνηση είναι η
 * **συνηθισμένη** έκβαση και δεν κοστίζει σχεδόν τίποτα: οι δύο πρώτες ερωτήσεις («είναι
 * ανοιχτός ο διάλογος ορισμάτων;», «έχει κάποιο πεδίο της συνεδρίας την εστίαση;») απαντιούνται
 * με μία ανάγνωση store και μία ανάγνωση DOM.
 */
export function tryTablePointModeMouseDown(event: MouseEvent, press: TablePointModePress): boolean {
  // Το δεξί/μεσαίο πλήκτρο δεν γράφει ποτέ τύπο: το δεξί ανοίγει μενού (ο κανονικός δρόμος το
  // χειρίζεται και **δηλώνει** τη συνεδρία), το μεσαίο κάνει pan.
  if (event.button !== 0) return false;
  const state = resolvePressState(press);
  if (!state) return false;

  const gesture = resolveGesture(press, state, event.shiftKey);
  if (!gesture) return false;

  claimTableCellSessionPointerDown();
  claimTableCellPointerGesture();
  // 🔴 §3.2 — **η μεταφορά εστίασης είναι η προεπιλεγμένη ενέργεια του `mousedown`.**
  // Χωρίς αυτή τη γραμμή, κάθε κλικ υπόδειξης θα έβγαζε το `<textarea>` από την εστίαση, θα
  // πυροδοτούσε `blur`, και ο φύλακας θα το ανέκτανε **ξαναστήνοντας** το πεδίο — δηλαδή
  // remount σε κάθε κλικ, με τον κέρσορα να ξαναγεννιέται από την αρχή. Αναιρώντας την
  // προεπιλογή, το συμβάν που θα χρειαζόταν όλο αυτό **δεν γεννιέται καν**.
  //
  // 🔴 ADR-763 Φ2.4 — **η ίδια γραμμή προστατεύει τώρα ΔΕΥΤΕΡΟ πεδίο**: με τον διάλογο
  // ορισμάτων ανοιχτό, ο εστιασμένος είναι το **κουτί ορίσματος**. Χωρίς αυτήν, κάθε κλικ σε
  // κελί θα το έβγαζε από την εστίαση και το **επόμενο** κλικ δεν θα είχε κέρσορα να διαβάσει.
  event.preventDefault();

  const write = referenceWriter(state, gesture.anchor);
  write(gesture.end);
  // 🔴 ADR-763 Φ2.4 — **η κάρτα μαζεύεται τώρα, όχι στην πρώτη κίνηση**: στο Excel το παράθυρο
  // εξαφανίζεται με το πάτημα, ώστε το κελί κάτω από το δάχτυλο να είναι ορατό **πριν** ο
  // χρήστης αρχίσει να σέρνει. Αναβολή μέχρι το πρώτο `mousemove` θα σήμαινε ότι ένα σκέτο
  // κλικ σε κρυμμένο κελί δεν αποκαλύπτει ποτέ τι διάλεξες.
  setFunctionArgumentPointing(true);
  startTableCellDrag({
    anchor: gesture.anchor,
    kind: gesture.kind,
    container: press.container,
    resolveAt: gesture.resolveAt,
    // ADR-754 §5 — ο **ίδιος** κύκλος ζωής σύρσης, άλλος παραλήπτης. Δες `table-cell-drag-session`.
    write: (span) => write(span.to),
    // Ο **φυσικός** τερματισμός — και καλύπτει και το κουμπί που αφέθηκε εκτός παραθύρου (ο
    // βρόχος κίνησης το ανιχνεύει και τερματίζει μόνος του). Δες `TableCellDragStart.onEnd`.
    onEnd: () => setFunctionArgumentPointing(false),
  });
  return true;
}

/** Ό,τι κρίθηκε τη στιγμή του πατήματος και **παγώνει** για όλη τη χειρονομία. */
interface PointPressState {
  readonly model: TableModel;
  readonly state: FormulaPointState;
  /** Ποιος γράφει, και πάνω σε ποιο κείμενο κρίθηκε ο κέρσορας. */
  readonly target: TablePointTarget;
}

/**
 * Οι τρεις ερωτήσεις που πρέπει να απαντηθούν **πριν** κοιτάξουμε καν πού έπεσε το χέρι:
 * «**ποιος** γράφει τώρα;», «σε ποιο κείμενο και σε ποια θέση;» και «τι σημαίνει ένα κλικ
 * εκεί;».
 *
 * 🔴 Η **πρώτη** ήταν κρυμμένη μέχρι τη Φ2.4: το `activeTableCellSessionCaret()` έδινε τον
 * κέρσορα ενός πεδίου και το `press.cursor.draft` το κείμενο ενός **άλλου** — δύο συστήματα
 * συντεταγμένων σε δύο διαδοχικές γραμμές. Πλέον έρχονται **μαζί**, από τον ίδιο στόχο, και η
 * αναντιστοιχία γίνεται μη εκφράσιμη.
 *
 * `null` σε κάθε άρνηση — που είναι η κανονική κατάσταση της εφαρμογής.
 */
function resolvePressState(press: TablePointModePress): PointPressState | null {
  // ADR-040: ανάγνωση **τη στιγμή του συμβάντος**, ποτέ στιγμιότυπο απόδοσης.
  const target = resolveTablePointTarget(press.cursor);
  if (!target) return null;
  // Ο ΙΔΙΟΣ απομνημονευμένος (WeakMap) δρόμος που περνά και η γεωμετρία — ίδιο persisted ⇒
  // ίδιο μοντέλο, καμία δεύτερη αποσειριοποίηση ανά πάτημα.
  const model = resolveTableModel(press.entity.model);
  const state = resolveFormulaPointState(model, target.formulaText, target.caretIndex);
  return state.kind === 'off' ? null : { model, state, target };
}

/**
 * Πού «πιάνεται» η αναφορά και πώς θα κινηθεί όσο το κουμπί είναι κάτω.
 *
 * `null` για ό,τι δεν είναι διεύθυνση: τα **διαχωριστικά** (σύρσιμο πλάτους) και τα
 * περιθώρια του πίνακα — δες το ρητό όριο στην κεφαλίδα.
 */
function resolveGesture(
  press: TablePointModePress,
  pressed: PointPressState,
  shiftKey: boolean,
): PointedGesture | null {
  const { model, state, target } = pressed;
  const base = baseGesture(press, model);
  if (!base) return null;
  // 🔴 `Shift+κλικ` **επεκτείνει** την αναφορά που μόλις μπήκε, αντί να την αντικαταστήσει —
  // το κάτοπτρο του `Shift+βέλος` και του `Shift+κλικ` στη ζώνη. Όταν δεν υπάρχει ζωντανή
  // αναφορά να επεκταθεί (κατάσταση `armed`), το πάτημα γίνεται **σκέτο κλικ**: ίδια στάση
  // με το `extendWholeAxis`, καμία εφεύρεση.
  const extendFrom = shiftKey ? liveReferenceAnchor(model, target.formulaText, state) : null;
  return extendFrom ? { ...base, anchor: extendFrom } : base;
}

/** Η χειρονομία χωρίς το `Shift`: κελί ⇒ σημείο· ζώνη ⇒ ολόκληρος άξονας. */
function baseGesture(press: TablePointModePress, model: TableModel): PointedGesture | null {
  const { entity, container, transformRef, hit } = press;
  if (hit?.where === 'cell') {
    const cell: TableCellRef = { rowId: hit.cell.rowId, colId: hit.cell.colId };
    return {
      anchor: cell,
      end: cell,
      kind: 'range',
      resolveAt: (moveEvent) => cellEndAt(moveEvent, entity, container, transformRef),
    };
  }
  if (hit?.where !== 'band') return null;

  const axis = hit.band.axis;
  const span = wholeAxisSelection(model, hit.band);
  if (!span) return null;
  return {
    anchor: span.from,
    end: span.to,
    kind: span.kind,
    resolveAt: (moveEvent) => axisEndAt(moveEvent, entity, container, transformRef, axis),
  };
}

/**
 * Η **αρχή** της ζωντανής αναφοράς ως ταυτότητες κελιού — η γωνία που κρατά το `Shift+κλικ`.
 *
 * Το κείμενο ξαναδιαβάζεται από τον **ΕΝΑ** μεταφραστή (`parseTableCellReference`), που
 * λύνει και εύρη στην αρχή τους (`A1:B2` ⇒ `A1`). Καμία δεύτερη ανάλυση: μια τοπική
 * `split(':')` εδώ θα ήταν δεύτερος ορισμός του τι είναι αναφορά.
 */
function liveReferenceAnchor(
  model: TableModel,
  formulaText: string,
  state: FormulaPointState,
): TableCellRef | null {
  if (state.kind !== 'liveRef') return null;
  const position = parseTableCellReference(model, formulaText.slice(state.from, state.to));
  return position ? { rowId: position.rowId, colId: position.colId } : null;
}

/**
 * 🔴 **Ο γραφέας — και η βάση του είναι ΠΑΓΩΜΕΝΗ.**
 *
 * Το πρόχειρο και η κατάσταση κλειδώνονται τη στιγμή του πατήματος, και **κάθε** ενημέρωση
 * της σύρσης γράφεται πάνω σε αυτά, όχι πάνω στο αποτέλεσμα της προηγούμενης. Είναι η
 * διαφορά ανάμεσα σε **αντικατάσταση** και **συσσώρευση**: με ζωντανή ανάγνωση, η δεύτερη
 * κίνηση θα έβλεπε πρόχειρο που περιέχει ήδη `A1:B2` και θα προσπαθούσε να το ξαναλύσει —
 * ακριβώς το `=SUM(A1:A1:C3` που έπιασε το test της αλυσίδας κλικ (§1.3).
 *
 * Έτσι η πράξη είναι **ιδεμποτής**: ίδιο άκρο ⇒ ίδιο κείμενο, όσες φορές κι αν κληθεί.
 *
 * 🔴 ADR-763 Φ2.4 — **και ο ΠΑΡΑΛΗΠΤΗΣ παγώνει μαζί τους.** Ο στόχος κρατά τον δείκτη του
 * ορίσματος στο οποίο έπεσε το πάτημα· αν τον ξαναρωτούσαμε σε κάθε κίνηση, μια αλλαγή του
 * `activeIndex` στη μέση της σύρσης (ο διάλογος ξαναστήνεται όταν μαζεύεται) θα έστελνε το
 * υπόλοιπο του εύρους σε **άλλο κουτί**.
 */
function referenceWriter(
  pressed: PointPressState,
  anchor: TableCellRef,
): (to: TableCellRef) => void {
  const { model, state, target } = pressed;
  return (to) => {
    const reference = pointedReference(model, anchor, to);
    if (!reference) return;
    const edit = applyPointedReference(target.formulaText, state, reference);
    if (!edit) return;
    target.write(edit.draft, edit.caretIndex);
  };
}

/**
 * `'E4'` ή `'E4:F6'` — **δύο ερωτήσεις**, όχι μία με ειδική περίπτωση.
 *
 * Το σκέτο κλικ ρωτά «πώς λέγεται **αυτό το κελί**;» και η απάντηση οφείλει να σέβεται τη
 * **συγχώνευση**: ένα συγχωνευμένο κελί κρατά ένα περιεχόμενο, στην άγκυρα, οπότε η αναφορά
 * είναι `B3` και όχι `B3:C4` (αλλιώς ο μέσος όρος θα άλλαζε επειδή ο χρήστης έτυχε να
 * πατήσει σε συγχωνευμένο). Η σύρση ρωτά «πώς λέγεται **αυτό το ορθογώνιο**;».
 */
function pointedReference(model: TableModel, anchor: TableCellRef, to: TableCellRef): string | null {
  return anchor.rowId === to.rowId && anchor.colId === to.colId
    ? pointedCellReference(model, anchor)
    : pointedRangeReference(model, anchor, to);
}
