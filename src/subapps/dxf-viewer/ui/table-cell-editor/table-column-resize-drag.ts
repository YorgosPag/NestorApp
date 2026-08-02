'use client';

/**
 * 🔴 ADR-739 §31.9 — **Η ΣΥΡΣΗ ΤΟΥ ΔΙΑΧΩΡΙΣΤΙΚΟΥ**, χωρίς λαβή.
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
 * `document`, ένας ενεργός κύκλος τη φορά, ρητό `endTableColumnResizeDrag` στην αποπροσάρτηση.
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
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-column-resize-drag
 * @see bim/table/table-entity-grips.ts — `resizeTableColumnLeftOfEdge`, η ΜΙΑ αριθμητική
 * @see ui/table-cell-editor/table-cell-drag-session.ts — η αδελφή χειρονομία (επιλογή)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31.9
 */

import {
  computeTableEntityGeometryLive,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
// §31.9 — η ΜΙΑ αριθμητική του «νέο πλάτος», κοινή με τη λαβή (αλλιώς sibling clone, N.18).
import { resizeTableColumnLeftOfEdge } from '../../bim/table/table-entity-grips';
import { tableEventWorldPoint } from './table-cell-pointer-hit';
import type { RefObject } from 'react';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

/** Ό,τι χρειάζεται η χειρονομία για να ζήσει. Καμία γνώση γεωμετρίας — τη δίνει ο καλών. */
export interface TableColumnResizeStart {
  /**
   * «Πόσο πλατιά είναι τώρα η στήλη;» — από συμβάν ποντικιού στη θέση `u` του πλαισίου, σε
   * sheet-mm. Ζει στον καλούντα επειδή **μόνο εκείνος** ξέρει τη ζωντανή προβολή και τη γωνία
   * του πίνακα. `null` όταν η ανάγνωση αποτύχει — η κίνηση αγνοείται, η σύρση **επιζεί**
   * (μια στιγμιαία αποτυχία δεν είναι λόγος να χαθεί η χειρονομία στη μέση).
   */
  readonly resolveEdgeUMm: (event: MouseEvent) => number | null;
  /** Ζωντανή προεπισκόπηση — καλείται σε **κάθε** κίνηση. Καμία καταγραφή αναίρεσης. */
  readonly preview: (edgeUMm: number) => void;
  /**
   * Το τελικό πλάτος, **μία** φορά. `null` όταν το χέρι δεν κουνήθηκε καθόλου (σκέτο πάτημα
   * στο διαχωριστικό ⇒ καμία εντολή, όπως ένα σκέτο κλικ δεν γράφει επιλογή, §27.15).
   */
  readonly commit: (edgeUMm: number | null) => void;
}

/** Οι ακροατές της τρέχουσας σύρσης· `null` όταν δεν σέρνεται τίποτα. */
let activeTeardown: (() => void) | null = null;

/**
 * Ξεκινά σύρση πλάτους στήλης. Ιδεμποτής ως προς την προηγούμενη: μια νέα χειρονομία
 * **κλείνει** την προηγούμενη αντί να προστεθεί — δύο ταυτόχρονες σύρσεις δεν υπάρχουν.
 */
export function startTableColumnResizeDrag(start: TableColumnResizeStart): void {
  if (typeof document === 'undefined') return;
  endTableColumnResizeDrag();

  // Η τελευταία **έγκυρη** θέση. `null` ⇒ το χέρι δεν κουνήθηκε ⇒ καμία εντολή στο τέλος.
  let lastEdgeUMm: number | null = null;

  const onMove = (event: MouseEvent): void => {
    const edgeUMm = start.resolveEdgeUMm(event);
    if (edgeUMm === null) return;
    lastEdgeUMm = edgeUMm;
    start.preview(edgeUMm);
  };

  const onUp = (): void => {
    // Η σειρά είναι το συμβόλαιο: **πρώτα** σβήνουμε τους ακροατές, μετά γράφουμε. Το commit
    // αλλάζει τη σκηνή, δηλαδή μπορεί να παράγει συμβάντα· ένας ακροατής που ζει ακόμα θα
    // τα έβλεπε ως συνέχεια της σύρσης που μόλις τελείωσε.
    const edge = lastEdgeUMm;
    endTableColumnResizeDrag();
    start.commit(edge);
  };

  document.addEventListener('mousemove', onMove, { capture: true });
  document.addEventListener('mouseup', onUp, { capture: true });

  activeTeardown = () => {
    document.removeEventListener('mousemove', onMove, { capture: true });
    document.removeEventListener('mouseup', onUp, { capture: true });
    activeTeardown = null;
  };
}

/**
 * Τερματίζει τη σύρση **χωρίς** commit. Ιδεμποτής — και γι' αυτό μπορεί να κληθεί από το
 * cleanup ενός effect, όπου η συνεδρία μπορεί να έκλεισε με το κουμπί ακόμα κάτω: οι ακροατές
 * ζουν στο `document` και **δεν** θα έφευγαν μόνοι τους.
 */
export function endTableColumnResizeDrag(): void {
  activeTeardown?.();
}

/** Test helper — «σέρνεται κάτι τώρα;», χωρίς να εκτεθεί ο ίδιος ο κύκλος ζωής. */
export function isTableColumnResizeDragging(): boolean {
  return activeTeardown !== null;
}

/** Ό,τι χρειάζεται το {@link beginTableColumnResize} — γεωμετρία **και** οι δύο γραφείς. */
export interface TableColumnResizeParams {
  readonly entity: TableEntity;
  /** Ο δείκτης του **εσωτερικού ορίου** (1..N-1) που πιάστηκε. */
  readonly edgeIndex: number;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
  /** Ζωντανή προεπισκόπηση, σε κάθε καρέ — καμία καταγραφή αναίρεσης. */
  readonly preview: (entity: TableEntity, model: TableEntity['model']) => void;
  /** Το τελικό πλάτος ως **μία** εντολή. */
  readonly commit: (entity: TableEntity, model: TableEntity['model']) => void;
}

/**
 * 🔴 §31.9 — **ολόκληρη η χειρονομία σε μία κλήση**: γεωμετρία → πλάτος → δύο γραφείς.
 *
 * Ζει εδώ και όχι στον `use-table-cell-pointer` επειδή αυτό το module **είναι** η χειρονομία:
 * ο καλών ξέρει μόνο «πιάστηκε το όριο `i`». Ο διαχωρισμός δεν είναι αισθητικός — ο pointer
 * είχε ήδη περάσει το όριο των 500 γραμμών του N.7.1, και η θεραπεία που επιβάλλει ο κανόνας
 * είναι **εξαγωγή σε υπεύθυνο module**, ποτέ ψαλίδισμα σχολίων.
 */
export function beginTableColumnResize(params: TableColumnResizeParams): void {
  const { entity, edgeIndex, container, transformRef, preview, commit } = params;
  const modelAt = (edgeUMm: number): TableEntity['model'] | null =>
    resizeTableColumnLeftOfEdge(entity, edgeIndex, edgeUMm);

  startTableColumnResizeDrag({
    resolveEdgeUMm: (moveEvent) => columnEdgeUAt(moveEvent, entity, container, transformRef),
    preview: (edgeUMm) => {
      const model = modelAt(edgeUMm);
      if (model) preview(entity, model);
    },
    commit: (edgeUMm) => {
      // Σκέτο πάτημα χωρίς κίνηση ⇒ **καμία** εντολή. Ίδια αρχή με το «σκέτο κλικ δεν γράφει
      // επιλογή» (§27.15): χειρονομία που δεν άλλαξε τίποτα δεν γεμίζει τον σωρό αναίρεσης
      // με βήμα που ο χρήστης δεν αναγνωρίζει.
      if (edgeUMm === null) return;
      const model = modelAt(edgeUMm);
      if (model) commit(entity, model);
    },
  });
}

/**
 * 🔴 §31.9 — **πού βρίσκεται το χέρι κατά μήκος του `u`**, σε sheet-mm του πλαισίου.
 *
 * Η σύρση πλάτους δεν ρωτά «σε ποια στήλη είμαι» αλλά «**πού ακριβώς**» — γι' αυτό δεν
 * ξαναχρησιμοποιεί το `tableAxisTickAtFrame`: εκείνο κβαντίζει σε υποδιαίρεση, δηλαδή θα
 * έδινε πλάτος που πηδά από στήλη σε στήλη αντί να ακολουθεί το χέρι.
 *
 * Καμία κατακόρυφη συνθήκη: μόλις η σύρση ξεκινήσει, το χέρι επιτρέπεται να ξεφύγει από τη
 * λωρίδα — όπως στο Excel, όπου συνεχίζεις να αλλάζεις πλάτος με τον δείκτη οπουδήποτε.
 */
function columnEdgeUAt(
  event: MouseEvent,
  entity: TableEntity,
  container: HTMLElement,
  transformRef: RefObject<ViewTransform>,
): number | null {
  const world = tableEventWorldPoint(event, container, transformRef.current);
  if (!world) return null;
  const geometry = computeTableEntityGeometryLive(entity);
  return tableWorldToFrame(entity, world, geometry.mmToWorld).u;
}
