'use client';

/**
 * 🔴 **Η ζωντανή ένδειξη μεγέθους** (Giorgio 2026-08-04) — ό,τι γράφεται δίπλα στον δείκτη
 * όσο σέρνεται ένα διαχωριστικό, και τίποτα άλλο.
 *
 * ## Γιατί store και όχι prop
 * Ο γραφέας είναι η **χειρονομία** (ακροατές στο `document`, εκτός React), ο αναγνώστης ένα
 * φύλλο του overlay. Δεν υπάρχει κοινός γονιός — και δεν επιτρέπεται να δημιουργηθεί:
 * ο `CanvasSection` είναι orchestrator που ο **ADR-040** απαγορεύει ρητά να αποκτήσει
 * συνδρομή σε κάτι που αλλάζει σε **κάθε κίνηση ποντικιού**. Ένα μικρό store που το διαβάζει
 * **μόνο** το φύλλο κρατά τον κανόνα ακέραιο.
 *
 * ## ⚠️ Το κείμενο έρχεται ΕΤΟΙΜΟ — εδώ δεν μορφοποιείται τίποτα
 * Η μορφοποίηση (μονάδα χρήστη, τοπικός δεκαδικός, pixel) ζει σε καθαρό module
 * (`bim/table/table-resize-readout`), δοκιμάσιμο χωρίς DOM. Αν το store κρατούσε ωμούς
 * αριθμούς, ο μορφοποιητής θα καλούνταν μέσα στο render — δηλαδή θα ξανατρέχαμε i18n lookup
 * και `Intl.NumberFormat` σε κάθε καρέ της σύρσης, για κείμενο που άλλαξε ήδη μία φορά.
 *
 * @module subapps/dxf-viewer/state/table-resize-readout-store
 * @see bim/table/table-resize-readout.ts — η ΜΙΑ μορφοποίηση
 */

import { create } from 'zustand';
// 🔴 Η θέση ΔΕΝ έρχεται από τον καλούντα: ο δρομέας έχει ήδη SSoT σε px οθόνης, και οι δύο
// χειρονομίες (λαβή / λωρίδα) θα τον μετέφραζαν αλλιώς η καθεμιά. Δες `show…` παρακάτω.
import { getClientPosition } from '../systems/cursor/ImmediatePositionStore';

export interface TableResizeReadoutState {
  /** Το έτοιμο κείμενο, ή `null` όταν δεν σέρνεται τίποτα. */
  readonly text: string | null;
  /**
   * Θέση σε **client px** (viewport), όχι σε px δοχείου.
   *
   * ⚠️ Δεν είναι λεπτομέρεια: η πινακίδα ζωγραφίζεται με `position: fixed`, γιατί ο host των
   * επικαλύψεων είναι **fragment** — δεν υπάρχει positioned ancestor να αγκυρωθεί ένα
   * `absolute`, οπότε θα κρεμόταν από όποιο στοιχείο τύχαινε να έχει `position` πιο πάνω.
   * Το `fixed` δεν έχει αυτή την εξάρτηση, και ζητά ακριβώς client συντεταγμένες.
   */
  readonly x: number;
  readonly y: number;
  show(text: string, x: number, y: number): void;
  hide(): void;
}

export const useTableResizeReadoutStore = create<TableResizeReadoutState>((set) => ({
  text: null,
  x: 0,
  y: 0,
  show: (text, x, y) => set({ text, x, y }),
  // Ιδεμποτής **επίτηδες**: την καλεί και το `mouseup` και το cleanup του effect, και η
  // δεύτερη κλήση δεν πρέπει να παράγει νέα κατάσταση (θα ήταν re-render χωρίς αλλαγή).
  hide: () => set((s) => (s.text === null ? s : { ...s, text: null })),
}));

/**
 * Event-time γραφή, χωρίς hook — η χειρονομία ζει έξω από το React.
 *
 * 🔴 **Ο καλών δίνει ΜΟΝΟ κείμενο.** Η θέση διαβάζεται από το SSoT του δρομέα
 * (`getClientPosition`, ήδη σε client px), για δύο λόγους:
 *  - υπάρχουν **δύο** χειρονομίες (σύρση λαβής, σύρση διαχωριστικού) και η μία δεν έχει καν
 *    `MouseEvent` στο σημείο που γεννά την ένδειξη — θα ανάγκαζε τον ένα δρόμο να μεταφέρει
 *    συντεταγμένες μέσα από τρία επίπεδα μόνο για να τις ξαναμεταφράσει·
 *  - η πινακίδα πρέπει να κάθεται εκεί που είναι **το χέρι**, και αυτό το ξέρει ήδη ένα
 *    σημείο στο έργο. Δεύτερη μετάφραση = δεύτερη ευκαιρία να αποκλίνει κατά ένα καρέ.
 *
 * Χωρίς γνωστή θέση δρομέα δεν γράφεται τίποτα: πινακίδα στο `(0,0)` είναι χειρότερη από
 * καμία πινακίδα.
 */
export function showTableResizeReadout(text: string): void {
  const at = getClientPosition();
  if (!at) return;
  useTableResizeReadoutStore.getState().show(text, at.x, at.y);
}

export function hideTableResizeReadout(): void {
  useTableResizeReadoutStore.getState().hide();
}
