'use client';

/**
 * 🔴 ADR-739 §31.9 — **Η ΣΥΡΣΗ ΤΟΥ ΔΙΑΧΩΡΙΣΤΙΚΟΥ**, χωρίς λαβή. Και για τους **δύο** άξονες.
 *
 * ## Γιατί ο πίνακας τη χειρίζεται μόνος του
 * Το Excel **δεν δείχνει λαβή** ανάμεσα στα γράμματα — δείχνει μόνο δείκτη πάνω σε μια αόρατη
 * ζώνη. Εδώ η ίδια συμπεριφορά είναι και η **μόνη** που γίνεται: η λωρίδα έχει σταθερό πάχος
 * σε px οθόνης, άρα η θέση της σε mm εξαρτάται από το zoom, ενώ το κοινό μητρώο λαβών καλεί
 * `getTableGrips(entity)` **χωρίς viewScale** (§31.8). Λαβή στη λωρίδα θα απαιτούσε να μάθουν
 * κλίμακα οι λαβές **όλων** των οντοτήτων.
 *
 * Το §29 ήδη το εξουσιοδοτεί: «η λειτουργία πίνακα κατέχει και το ποντίκι». Αυτό εδώ είναι η
 * δεύτερη χειρονομία που ασκεί αυτό το δικαίωμα — η πρώτη είναι η σύρση επιλογής
 * (`table-cell-drag-session`), και το σχήμα είναι **σκόπιμα** το ίδιο: ακροατές στο
 * `document`, ένας ενεργός κύκλος τη φορά, ρητό `endTableAxisResizeDrag` στην αποπροσάρτηση.
 *
 * ## ⚠️ Λεγόταν `table-column-resize-drag` — μετονομάστηκε, δεν κλωνοποιήθηκε (2026-08-04)
 * Όταν ο Giorgio ζήτησε σύρσιμο **ύψους γραμμής**, η προφανής κίνηση ήταν ένα δεύτερο module
 * `table-row-resize-drag`. Θα ήταν sibling clone του N.18 με **ταυτόσημο** σώμα: ο κύκλος
 * ζωής της σύρσης (ακροατές, «ένας τη φορά», «καμία εντολή αν δεν κουνήθηκε το χέρι») δεν
 * έχει **τίποτα** αξονικό μέσα του. Αξονικό είναι μόνο το «πού βρίσκεται το χέρι» και το
 * «ποια αριθμητική γράφει το μοντέλο» — δύο μικρές επιλογές, όχι δύο μηχανές.
 *
 * ## 🔴 ΜΙΑ ΕΝΤΟΛΗ ΑΝΑΙΡΕΣΗΣ, ΟΧΙ ΜΙΑ ΑΝΑ ΚΑΡΕ
 * Η προφανής υλοποίηση —commit σε κάθε `mousemove`— θα ήταν σφάλμα με **δύο** συμπτώματα: ο
 * σωρός αναίρεσης θα γέμιζε με 60 βήματα ανά σύρσιμο (ένα `Ctrl+Z` θα γύριζε ένα pixel πίσω),
 * και κάθε καρέ θα πλήρωνε πλήρη εγγραφή σκηνής. Γι' αυτό η σύρση **γράφει σε κάθε κίνηση**
 * (ώστε να υπάρχει ζωντανή προεπισκόπηση, όπως στο Excel) αλλά η αναίρεση καταγράφεται
 * **μία** φορά, στο `mouseup`: το ενδιάμεσο περνά από `preview`, το τελικό από `commit`.
 *
 * ⚠️ Ο διαχωρισμός ζει στον **καλούντα** και όχι εδώ. Αυτό το module δεν ξέρει τι είναι
 * «εντολή» — ξέρει μόνο ότι υπάρχουν δύο γραφείς, ένας φθηνός και ένας τελικός. Έτσι μένει
 * καθαρός κύκλος ζωής χειρονομίας, δοκιμάσιμος χωρίς σκηνή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-axis-resize-drag
 * @see bim/table/table-entity-grips.ts — `resizeTableColumnLeftOfEdge` / `resizeTableRowAboveEdge`
 * @see ui/table-cell-editor/table-cell-drag-session.ts — η αδελφή χειρονομία (επιλογή)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31.9
 */

import {
  computeTableEntityGeometryLive,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
// §31.9 — οι ΔΥΟ αριθμητικές του «νέο μέγεθος», κοινές με τις λαβές (αλλιώς sibling clone, N.18).
import {
  resizeTableColumnLeftOfEdge,
  resizeTableRowAboveEdge,
} from '../../bim/table/table-entity-grips';
import { tableEventWorldPoint, type TablePointerHit } from './table-cell-pointer-hit';
// §66 — ο ΕΝΑΣ κύκλος ζωής χειρονομίας, κοινός με τη μετακίνηση (CHECK 3.28 τον μέτρησε).
import { createTablePointerDragSession } from './table-pointer-drag-session';
// §66 — ο ΕΝΑΣ ορισμός του «αυτό το πάτημα ανήκει στη συνεδρία», και στις δύο μορφές του. Ήρθε
// μαζί με τη δρομολόγηση: οι δηλώσεις είναι μέρος του «το κατανάλωσα εγώ», όχι του καλούντος.
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
} from './table-cell-session-focus';
// 🔴 Giorgio 2026-08-04 — η **ζωντανή ένδειξη μεγέθους** («Πλάτος: 14,14 (104 pixel)»).
import { tableResizeReadoutText } from '../../bim/table/table-resize-readout';
import {
  hideTableResizeReadout,
  showTableResizeReadout,
} from '../../state/table-resize-readout-store';
import { tablePxPerMm } from '../../bim/table/table-entity-geometry';
import type { RefObject } from 'react';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';
import type { TableResizeAxis } from '../../bim/table/table-resize-axis';

// Ο άξονας ζει στο `bim/` και **επανεξάγεται** εδώ: τον χρειάζεται και η καθαρή ένδειξη
// μεγέθους, που δεν επιτρέπεται να εισάγει από το `ui/`.
export type { TableResizeAxis } from '../../bim/table/table-resize-axis';

/** Ό,τι χρειάζεται η χειρονομία για να ζήσει. Καμία γνώση γεωμετρίας — τη δίνει ο καλών. */
export interface TableAxisResizeStart {
  /**
   * «Πού είναι το χέρι κατά μήκος του άξονα;» — από συμβάν ποντικιού, σε sheet-mm. Ζει στον
   * καλούντα επειδή **μόνο εκείνος** ξέρει τη ζωντανή προβολή και τη γωνία του πίνακα. `null`
   * όταν η ανάγνωση αποτύχει — η κίνηση αγνοείται, η σύρση **επιζεί** (μια στιγμιαία αποτυχία
   * δεν είναι λόγος να χαθεί η χειρονομία στη μέση).
   */
  readonly resolveEdgeMm: (event: MouseEvent) => number | null;
  /** Ζωντανή προεπισκόπηση — καλείται σε **κάθε** κίνηση. Καμία καταγραφή αναίρεσης. */
  readonly preview: (edgeMm: number) => void;
  /**
   * Το τελικό μέγεθος, **μία** φορά. `null` όταν το χέρι δεν κουνήθηκε καθόλου (σκέτο πάτημα
   * στο διαχωριστικό ⇒ καμία εντολή, όπως ένα σκέτο κλικ δεν γράφει επιλογή, §27.15).
   */
  readonly commit: (edgeMm: number | null) => void;
}

/**
 * Η **δική** της συνεδρία σύρσης. §66 — ο σκελετός (ακροατές σύλληψης, «ένας κύκλος τη φορά»,
 * ιδεμποτής τερματισμός) εξήχθη όταν η μετακίνηση τον έκανε **πέμπτο** αντίγραφο και το CHECK
 * 3.28 τον μέτρησε· κοινός ο **μηχανισμός**, ποτέ η κατάσταση.
 */
const session = createTablePointerDragSession();

/**
 * Ξεκινά σύρση μεγέθους (πλάτος στήλης **ή** ύψος γραμμής). Ιδεμποτής ως προς την προηγούμενη:
 * μια νέα χειρονομία **κλείνει** την προηγούμενη αντί να προστεθεί — δύο ταυτόχρονες σύρσεις
 * δεν υπάρχουν, ούτε καν σε διαφορετικούς άξονες (το χέρι είναι ένα).
 */
export function startTableAxisResizeDrag(start: TableAxisResizeStart): void {
  // Η τελευταία **έγκυρη** θέση. `null` ⇒ το χέρι δεν κουνήθηκε ⇒ καμία εντολή στο τέλος.
  let lastEdgeMm: number | null = null;

  const onMove = (event: MouseEvent): void => {
    const edgeMm = start.resolveEdgeMm(event);
    if (edgeMm === null) return;
    lastEdgeMm = edgeMm;
    start.preview(edgeMm);
  };

  const onUp = (): void => {
    // Η σειρά είναι το συμβόλαιο: **πρώτα** σβήνουμε τους ακροατές, μετά γράφουμε. Το commit
    // αλλάζει τη σκηνή, δηλαδή μπορεί να παράγει συμβάντα· ένας ακροατής που ζει ακόμα θα
    // τα έβλεπε ως συνέχεια της σύρσης που μόλις τελείωσε.
    const edge = lastEdgeMm;
    endTableAxisResizeDrag();
    start.commit(edge);
  };

  session.start({ onMove, onUp });
}

/**
 * Τερματίζει τη σύρση **χωρίς** commit. Ιδεμποτής — και γι' αυτό μπορεί να κληθεί από το
 * cleanup ενός effect, όπου η συνεδρία μπορεί να έκλεισε με το κουμπί ακόμα κάτω: οι ακροατές
 * ζουν στο `document` και **δεν** θα έφευγαν μόνοι τους.
 */
export function endTableAxisResizeDrag(): void {
  session.end();
}

// ADR-700 §4 (2026-08-24): isTableAxisResizeDragging() ΔΙΑΓΡΑΦΗΚΕ — test helper ΧΩΡΙΣ ΚΑΝΕΝΑ test.

/** Ό,τι χρειάζεται το {@link beginTableAxisResize} — γεωμετρία **και** οι δύο γραφείς. */
export interface TableAxisResizeParams {
  readonly entity: TableEntity;
  /** Ο δείκτης του **εσωτερικού ορίου** (1..N-1) που πιάστηκε. */
  readonly edgeIndex: number;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
  /** Ζωντανή προεπισκόπηση, σε κάθε καρέ — καμία καταγραφή αναίρεσης. */
  readonly preview: (entity: TableEntity, model: TableEntity['model']) => void;
  /** Το τελικό μέγεθος ως **μία** εντολή. */
  readonly commit: (entity: TableEntity, model: TableEntity['model']) => void;
}

/**
 * 🔴 §31.9 — **ολόκληρη η χειρονομία σε μία κλήση**: γεωμετρία → μέγεθος → δύο γραφείς.
 *
 * Ζει εδώ και όχι στον `use-table-cell-pointer` επειδή αυτό το module **είναι** η χειρονομία:
 * ο καλών ξέρει μόνο «πιάστηκε το όριο `i` αυτού του άξονα». Ο διαχωρισμός δεν είναι
 * αισθητικός — ο pointer είχε ήδη περάσει το όριο των 500 γραμμών του N.7.1, και η θεραπεία
 * που επιβάλλει ο κανόνας είναι **εξαγωγή σε υπεύθυνο module**, ποτέ ψαλίδισμα σχολίων.
 */
export function beginTableAxisResize(
  axis: TableResizeAxis,
  params: TableAxisResizeParams,
): void {
  const { entity, edgeIndex, container, transformRef, preview, commit } = params;
  const modelAt = (edgeMm: number): TableEntity['model'] | null =>
    axis === 'column'
      ? resizeTableColumnLeftOfEdge(entity, edgeIndex, edgeMm)
      : resizeTableRowAboveEdge(entity, edgeIndex, edgeMm);

  startTableAxisResizeDrag({
    resolveEdgeMm: (moveEvent) => {
      // Η ένδειξη γράφεται **εδώ** και όχι στο `preview`, γιατί χρειάζεται το ίδιο το συμβάν:
      // η θέση της ακολουθεί το χέρι, όχι τον πίνακα. Το `preview` παίρνει μόνο αριθμούς.
      const edgeMm = edgeAlongAxisAt(moveEvent, axis, entity, container, transformRef);
      if (edgeMm !== null) showResizeReadout({ axis, entity, edgeIndex, edgeMm, transformRef });
      return edgeMm;
    },
    preview: (edgeMm) => {
      const model = modelAt(edgeMm);
      if (model) preview(entity, model);
    },
    commit: (edgeMm) => {
      // Η ένδειξη σβήνει **πάντα**, ακόμα κι όταν δεν γράφεται εντολή (σκέτο πάτημα): η
      // χειρονομία τελείωσε, άρα δεν υπάρχει τίποτα ζωντανό να ανακοινωθεί.
      hideTableResizeReadout();
      // Σκέτο πάτημα χωρίς κίνηση ⇒ **καμία** εντολή. Ίδια αρχή με το «σκέτο κλικ δεν γράφει
      // επιλογή» (§27.15): χειρονομία που δεν άλλαξε τίποτα δεν γεμίζει τον σωρό αναίρεσης
      // με βήμα που ο χρήστης δεν αναγνωρίζει.
      if (edgeMm === null) return;
      const model = modelAt(edgeMm);
      if (model) commit(entity, model);
    },
  });
}

/**
 * 🔴 §31.9 — **Η ΔΡΟΜΟΛΟΓΗΣΗ ΤΟΥ ΠΑΤΗΜΑΤΟΣ**: «έπεσε σε διαχωριστικό; τότε είναι δικό μου».
 *
 * Ίδιο σχήμα με τους δύο αδελφούς φρουρούς που ήδη καλεί ο `use-table-cell-pointer` πριν από
 * τους κλάδους του (`tryTablePointModeMouseDown`, `tryTableFillHandleMouseDown`): ο pointer
 * ρωτά, το module απαντά `true` όταν κατανάλωσε τη χειρονομία. Μετακόμισε εδώ (§66) όταν ο
 * pointer ξαναχτύπησε τις 500 γραμμές του N.7.1 — **εξαγωγή σε υπεύθυνο module**, όχι
 * ψαλίδισμα σχολίων, και σε αυτό ακριβώς το module ανήκε εξαρχής: εδώ ζει η χειρονομία.
 *
 * ⚠️ **Ένας** χειριστής για τους δύο άξονες, όχι δύο σχεδόν-ίδιοι (Giorgio 2026-08-04): το
 * μόνο που αλλάζει είναι η παράμετρος `axis`, και δύο σώματα με ταυτόσημο περιεχόμενο θα ήταν
 * sibling clone — μαζί με το ρίσκο να ξεχαστεί το `commitPending()` στον έναν.
 */
export interface TableAxisResizePress {
  readonly entity: TableEntity;
  /** Η **μία** απάντηση «πού έπεσε;» του §29 — ο pointer την έχει ήδη πληρώσει. */
  readonly hit: TablePointerHit | null;
  /** Αριστερό πλήκτρο· το δεξί δηλώνει και παραδίδεται (§27.14). */
  readonly primary: boolean;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
  /** §26.15 — ό,τι γράφεται δεσμεύεται πριν αλλάξει η διάταξη κάτω από τον δρομέα. */
  readonly commitPending: () => void;
  readonly preview: (entity: TableEntity, model: TableEntity['model']) => void;
  readonly commit: (entity: TableEntity, model: TableEntity['model']) => void;
}

/** `true` όταν το πάτημα ήταν διαχωριστικό και καταναλώθηκε εδώ. */
export function tryTableAxisResizeMouseDown(press: TableAxisResizePress): boolean {
  const { entity, hit, primary, container, transformRef, commitPending, preview, commit } = press;
  if (hit?.where !== 'column-edge' && hit?.where !== 'row-edge') return false;
  claimTableCellSessionPointerDown();
  // §27.15 — και η χειρονομία: χωρίς αυτό το body-drag του ADR-560 armάρει στα 3px και
  // το σύρσιμο του διαχωριστικού θα **μετακινούσε τον πίνακα**.
  claimTableCellPointerGesture();
  if (!primary) return true;
  commitPending();
  const axis: TableResizeAxis = hit.where === 'column-edge' ? 'column' : 'row';
  const edgeIndex = hit.where === 'column-edge' ? hit.columnIndex : hit.rowIndex;
  beginTableAxisResize(axis, { entity, edgeIndex, container, transformRef, preview, commit });
  return true;
}

/**
 * 🔴 §31.9 — **πού βρίσκεται το χέρι κατά μήκος του άξονα**, σε sheet-mm του πλαισίου.
 *
 * Η σύρση μεγέθους δεν ρωτά «σε ποια στήλη/γραμμή είμαι» αλλά «**πού ακριβώς**» — γι' αυτό δεν
 * ξαναχρησιμοποιεί το `tableAxisTickAtFrame`: εκείνο κβαντίζει σε υποδιαίρεση, δηλαδή θα
 * έδινε μέγεθος που πηδά από κελί σε κελί αντί να ακολουθεί το χέρι.
 *
 * Καμία εγκάρσια συνθήκη: μόλις η σύρση ξεκινήσει, το χέρι επιτρέπεται να ξεφύγει από τη
 * λωρίδα — όπως στο Excel, όπου συνεχίζεις να αλλάζεις μέγεθος με τον δείκτη οπουδήποτε.
 */
function edgeAlongAxisAt(
  event: MouseEvent,
  axis: TableResizeAxis,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
): number | null {
  const world = tableEventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const geometry = computeTableEntityGeometryLive(entity);
  const frame = tableWorldToFrame(entity, world, geometry.mmToWorld);
  return axis === 'column' ? frame.u : frame.v;
}

/**
 * Γράφει την ένδειξη μεγέθους στη θέση του χεριού.
 *
 * Το **μέγεθος του κελιού** (όχι η θέση του ορίου) είναι αυτό που ενδιαφέρει τον χρήστη:
 * `edgeMm` μείον την αρχή της μονάδας που κρατά την αλλαγή. Το ίδιο νούμερο που θα γραφτεί
 * στο μοντέλο — διαβασμένο από την **ίδια** διάταξη, ώστε η ένδειξη να μην μπορεί να πει
 * άλλα από όσα κάνει η σύρση.
 */
interface ResizeReadoutInput {
  readonly axis: TableResizeAxis;
  readonly entity: TableEntity;
  readonly edgeIndex: number;
  readonly edgeMm: number;
  readonly transformRef: RefObject<ViewTransform>;
}

function showResizeReadout(input: ResizeReadoutInput): void {
  const { axis, entity, edgeIndex, edgeMm, transformRef } = input;
  const { layout, mmToWorld } = computeTableEntityGeometryLive(entity);
  const start = axis === 'column'
    ? layout.columns[edgeIndex - 1]?.xMm
    : layout.rows[edgeIndex - 1]?.yMm;
  if (start === undefined) return;

  // Η ΙΔΙΑ ζωντανή προβολή που διαβάζει και η γεωμετρία της σύρσης (ADR-040: ανάγνωση τη
  // στιγμή του συμβάντος — ο χρήστης μπορεί να ζουμάρει με τον τροχό ενώ σέρνει).
  const transform = transformRef.current;
  if (!transform) return;

  showTableResizeReadout(tableResizeReadoutText({
    axis,
    sizeMm: edgeMm - start,
    pxPerMm: tablePxPerMm(mmToWorld, transform.scale),
    mmToWorld,
  }));
}
