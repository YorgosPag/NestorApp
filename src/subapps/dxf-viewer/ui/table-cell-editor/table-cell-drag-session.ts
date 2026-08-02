'use client';

/**
 * 🔴 ADR-739 §27.15 — **η σύρση επιλογής**: πάτα σε ένα κελί, σύρε, άσε — η περιοχή
 * ακολουθεί το χέρι. Η χειρονομία που έλειπε για να λέγεται «όπως στο Excel».
 *
 * ## Γιατί ΔΙΚΟ ΤΟΥ module και όχι άλλες 60 γραμμές στον pointer
 * Ο `use-table-cell-pointer` απαντά σε **μία** ερώτηση: «πού έπεσε αυτό το πάτημα;». Εδώ
 * ζει μια **δεύτερη**, με δικό της κύκλο ζωής: «όσο το κουμπί είναι κάτω, πού βρίσκομαι
 * τώρα;». Δύο ερωτήσεις, δύο αρχεία — και το όριο των 40 γραμμών ανά συνάρτηση (N.7.1)
 * μένει σεβαστό αντί να φουσκώσει ένας ήδη πυκνός χειριστής.
 *
 * ## 🔴 ΔΕΝ είναι τέταρτος drag controller — και αυτό ήταν ρητή απόφαση
 * Το SSoT audit (2026-08-02) μέτρησε **τρεις** ανεξάρτητες κλάσεις με το ίδιο
 * `idle → dragging` σχήμα (`OpeningTagDragController`, `MepWireWaypointDragController`,
 * `bim-3d/WaypointDragController`) και **κανέναν** γενικό `press→move→release` SSoT να
 * καταναλωθεί. Μια τέταρτη κλάση θα ήταν ακριβώς ο structural clone που πιάνει το CHECK
 * 3.28. Εδώ δεν υπάρχει μηχανή καταστάσεων: υπάρχουν **δύο ακροατές που ζουν όσο η
 * χειρονομία** — καμία κλάση, κανένα `getState()`, καμία δεύτερη έννοια «drag».
 *
 * ## Γιατί οι ακροατές ζουν στο `document` και όχι στο δοχείο
 * Το χέρι φεύγει από τον καμβά. Στο Excel η επιλογή συνεχίζει να ακολουθεί και το `mouseup`
 * μετράει **όπου κι αν γίνει** — αλλιώς μένει «κολλημένη» σύρση που κανείς δεν τερμάτισε.
 * Δεν χρησιμοποιείται `setPointerCapture`: **δεν υπάρχει πουθενά** στο subapp (μετρημένο),
 * και θα άλλαζε τη δρομολόγηση συμβάντων για **όλους** τους υπόλοιπους ακροατές του καμβά.
 *
 * ## 🔴 Γιατί γράφει ΜΟΝΟ όταν αλλάζει κελί — ADR-735
 * Το `setTableCellSelection` ζητά καρέ **άνευ όρων** (τεκμηριωμένο στο store: «ένα περιττό
 * repaint ανά **πάτημα πλήκτρου** κοστίζει μηδέν»). Η σύρση όμως δεν είναι πάτημα πλήκτρου:
 * είναι 60-120 συμβάντα το δευτερόλεπτο. Χωρίς αυτόν τον φύλακα, κάθε pixel κίνησης θα
 * ζητούσε επαναβαφή ολόκληρης της σκηνής — το ακριβές σχήμα «δουλειά ανάλογη της κίνησης,
 * όχι της αλλαγής» που ο ADR-735 πλήρωσε σε παραγωγή. Ο φύλακας ζει **εδώ** και όχι στο
 * store, γιατί το συμβόλαιο του store είναι σωστό για τον καλούντα που είχε.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-drag-session
 * @see ui/table-cell-editor/use-table-cell-pointer.ts — ποιος την ξεκινά, και με τι γεωμετρία
 * @see bim/table/table-cell-range.ts — τι σημαίνει η κάθε επιλογή (`TableSelectionKind`)
 */

import { setTableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableCellRef, TableSelectionKind } from '../../bim/table/table-cell-range';

/** Ό,τι χρειάζεται η χειρονομία για να ζήσει. Καμία γνώση γεωμετρίας — τη δίνει ο καλών. */
export interface TableCellDragStart {
  /**
   * Η γωνία που **ΜΕΝΕΙ** — και είναι το κελί εκκίνησης, όχι το κελί απελευθέρωσης.
   * Τεκμηριωμένη συμπεριφορά Excel: μετά τη σύρση `A1→F1`, ενεργό κελί παραμένει το `A1`.
   */
  readonly anchor: TableCellRef;
  /** Τι διαλέγει αυτή η σύρση — κελιά, ολόκληρες στήλες ή ολόκληρες γραμμές. */
  readonly kind: TableSelectionKind;
  /**
   * «Πού βρίσκομαι **τώρα**;» — από σημείο οθόνης σε ταυτότητα κελιού· `null` έξω από το
   * πλέγμα. Ζει στον καλούντα επειδή **μόνο εκείνος** ξέρει τη ζωντανή προβολή, τη γωνία
   * του πίνακα και τη διάταξη. Καλείται **μία φορά ανά κίνηση**.
   */
  readonly resolveAt: (event: MouseEvent) => TableCellRef | null;
}

/** Οι ακροατές της τρέχουσας σύρσης· `null` όταν δεν σέρνεται τίποτα. */
let activeTeardown: (() => void) | null = null;

/**
 * Ξεκινά σύρση επιλογής. Ιδεμποτής ως προς την προηγούμενη: μια νέα χειρονομία **κλείνει**
 * την προηγούμενη αντί να προστεθεί σε αυτήν — δύο ταυτόχρονες σύρσεις δεν υπάρχουν.
 */
export function startTableCellDrag(start: TableCellDragStart): void {
  if (typeof document === 'undefined') return;
  endTableCellDrag();

  // Η αφετηρία: το ίδιο το κελί της άγκυρας. Ο φύλακας «άλλαξε κελί;» ξεκινά από εδώ, ώστε
  // η πρώτη κίνηση **μέσα** στο ίδιο κελί να μη γράψει τίποτα.
  let lastCell: TableCellRef = start.anchor;

  const onMove = (event: MouseEvent): void => {
    // Το κουμπί αφέθηκε εκτός παραθύρου (ή το `mouseup` χάθηκε): τερμάτισε. Χωρίς αυτό, η
    // επιλογή θα ακολουθούσε τον κέρσορα **χωρίς πατημένο κουμπί** — μια σύρση-φάντασμα που
    // ο χρήστης δεν μπορεί να σταματήσει.
    if ((event.buttons & 1) === 0) {
      endTableCellDrag();
      return;
    }
    const cell = start.resolveAt(event);
    // Έξω από το πλέγμα: η επιλογή **μένει** εκεί που έφτασε. Ίδια σύμβαση με το `Shift+βέλος`
    // στην άκρη — ποτέ αναδίπλωση, ποτέ σβήσιμο από παραδρομή του χεριού.
    if (!cell) return;
    if (cell.rowId === lastCell.rowId && cell.colId === lastCell.colId) return;
    lastCell = cell;
    setTableCellSelection({ from: start.anchor, to: cell, kind: start.kind });
  };

  const onUp = (): void => endTableCellDrag();

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  activeTeardown = (): void => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
}

/** Τερματίζει τη σύρση **χωρίς** να αγγίξει την επιλογή. Ιδεμποτής. */
export function endTableCellDrag(): void {
  activeTeardown?.();
  activeTeardown = null;
}

/** Σέρνεται κάτι αυτή τη στιγμή; Μόνο για tests και για τον φύλακα αποπροσάρτησης. */
export function isTableCellDragActive(): boolean {
  return activeTeardown !== null;
}
