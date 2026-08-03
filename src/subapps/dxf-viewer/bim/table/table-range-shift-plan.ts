/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **Η ΕΙΣΑΓΩΓΗ & ΟΛΙΣΘΗΣΗ (`Shift`) ΩΣ ΜΕΤΑΘΕΣΗ ΘΕΣΕΩΝ.**
 * Καθαρή γεωμετρία — μηδέν React, μηδέν DOM, μηδέν store.
 *
 * Ο άξονας κάθε λωρίδας είναι μια **λίστα θέσεων**. Η πράξη είναι δύο splice:
 *
 * ```
 *   1. αφαίρεσε τις θέσεις της πηγής        (μόνο σε μετακίνηση — η τρύπα ΚΛΕΙΝΕΙ)
 *   2. παρεμβάλε τις θέσεις της περιοχής    στο σημείο απόθεσης
 * ```
 *
 * Όταν τα δύο συμβαίνουν στην **ίδια** λωρίδα, συνθέτουν γνήσια μετάθεση: **τίποτα δεν χάνεται
 * και τίποτα δεν διπλασιάζεται**, γιατί η αφαίρεση ελευθερώνει ακριβώς όσες θέσεις καταναλώνει
 * η παρεμβολή. Είναι η συμπεριφορά του Excel («*Insert Cut Cells*»: η τρύπα της πηγής κλείνει)
 * και βγαίνει **δωρεάν** από τη διατύπωση, αντί να χρειαστεί ξεχωριστός κανόνας «κλείσε την
 * τρύπα» που κάποιος θα ξεχνούσε.
 *
 * ## 🔴 ΤΟ ΚΛΕΙΣΙΜΟ ΤΗΣ ΤΡΥΠΑΣ ΓΙΝΕΤΑΙ **ΜΟΝΟ** ΣΤΗΝ ΙΔΙΑ ΛΩΡΙΔΑ — μετρημένος λόγος
 * Αν η πηγή είναι σε **άλλες** στήλες από τον προορισμό, οι δύο υποσχέσεις **αντιφάσκουν**: το
 * σημείο απόθεσης που είδε ο χρήστης (η γραμμή-Ι του Excel) είναι θέση του **αρχικού** πλέγματος,
 * ενώ το κλείσιμο της τρύπας μετακινεί προς τα πάνω **μόνο** τις στήλες της πηγής. Η περιοχή θα
 * προσγειωνόταν σε **διαφορετική γραμμή ανά στήλη** — δηλαδή θα **σχιζόταν**. Ανάμεσα σε
 * σχισμένη περιοχή και τρύπα που δεν έκλεισε, η τρύπα είναι αυτό που ο χρήστης **βλέπει** και
 * μπορεί να διορθώσει. Άρα: διαφορετική λωρίδα ⇒ η πηγή απλώς **αδειάζει**, όπως στη σκέτη
 * μετακίνηση.
 *
 * ## Ο πίνακας δεν μεγαλώνει μόνος του
 * Η ουρά **κόβεται** στο μήκος του άξονα — ίδιο επιχείρημα με το `table-range-clipboard.ts`. Ό,τι
 * κόπηκε το αναφέρει το `tableRangeTransferOverwrites`, ώστε ο χρήστης να **ρωτηθεί πριν** συμβεί
 * (Φάση 4) αντί να το ανακαλύψει μετά.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-shift-plan
 * @see bim/table/table-range-axis-view.ts — μία υλοποίηση, δύο κατευθύνσεις
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { PersistedTableModel } from '../../types/table';
import type { TableCellRangeBounds } from './table-cell-range';
import type { TableCellFill, TableRangeLanding, TableRangeTransferRequest } from './table-range-transfer-types';
import {
  axisSpanContains,
  axisSpanSize,
  tableAxisView,
  type TableAxisSpanRange,
  type TableAxisView,
} from './table-range-axis-view';

/**
 * Πού προσγειώνεται η περιοχή με `Shift`, και τι γεμίζει κάθε θέση.
 *
 * `null` όταν η περιοχή δεν προσγειώνεται **ακέραιη** μέσα στον άξονα — ίδια στάση με τη σκέτη
 * απόθεση: ακέραιη ή καθόλου, ποτέ σιωπηλά μισή.
 */
export function planTableRangeShift(
  model: PersistedTableModel,
  request: TableRangeTransferRequest,
  dropped: TableCellRangeBounds,
): TableRangeLanding | null {
  const view = tableAxisView(model, request.shiftAxis);
  const srcLines = view.linesOf(request.source);
  const srcTracks = view.tracksOf(request.source);
  const dstTracks = view.tracksOf(dropped);
  const size = axisSpanSize(srcLines);

  const closesGap = closesSourceGap(view, request, dropped);
  const removed = closesGap ? srcLines : null;
  const at = survivorsBefore(removed, view.linesOf(dropped).first);
  if (at + size > view.lineCount) return null;

  const destination = view.rectOf({ first: at, last: at + size - 1 }, dstTracks);
  const fills: TableCellFill[] = [];
  for (let track = dstTracks.first; track <= dstTracks.last; track++) {
    const slots = shiftedSlots(view.lineCount, removed, { at, size });
    collectTrackFills(view, slots, track, srcLines.first, srcTracks.first + (track - dstTracks.first), fills);
  }
  if (!closesGap && !request.intent.copy) collectVacatedFills(view, request.source, destination, fills);

  return { destination, fills };
}

/**
 * **Ποιο κομμάτι του πίνακα αναταράσσεται** — η ζώνη μέσα στην οποία μια συγχώνευση που δεν
 * ταξιδεύει είναι απαγορευτική.
 *
 * Η ολίσθηση σπρώχνει τα πάντα ως το **τέλος του άξονα** μέσα στις λωρίδες που αγγίζει, οπότε η
 * ζώνη δεν είναι ο προορισμός αλλά ολόκληρη η ουρά από το πρώτο σημείο που κουνιέται και κάτω.
 * Μια συγχώνευση εκεί μέσα θα **σχιζόταν** από τη μετάθεση — τα καλυμμένα κελιά της θα
 * κατέληγαν σε άλλη γραμμή από την άγκυρά τους — και το αποτέλεσμα θα ήταν ακόμη ένα **νόμιμο**
 * μοντέλο, δηλαδή σιωπηλή καταστροφή.
 */
export function tableRangeShiftDisturbedBand(
  model: PersistedTableModel,
  request: TableRangeTransferRequest,
  dropped: TableCellRangeBounds,
): TableCellRangeBounds {
  const view = tableAxisView(model, request.shiftAxis);
  const dstLines = view.linesOf(dropped);
  const first = closesSourceGap(view, request, dropped)
    ? Math.min(view.linesOf(request.source).first, dstLines.first)
    : dstLines.first;

  return view.rectOf({ first, last: view.lineCount - 1 }, view.tracksOf(dropped));
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Μία θέση του άξονα μετά την ολίσθηση: κρατά παλιά θέση, δέχεται την περιοχή, ή μένει κενή. */
type ShiftSlot =
  | { readonly kind: 'keep'; readonly line: number }
  | { readonly kind: 'block'; readonly offset: number }
  | { readonly kind: 'empty' };

/** Κλείνει η τρύπα της πηγής; Δες την κεφαλίδα για το γιατί μόνο στην ίδια λωρίδα. */
function closesSourceGap(
  view: TableAxisView,
  request: TableRangeTransferRequest,
  dropped: TableCellRangeBounds,
): boolean {
  if (request.intent.copy) return false;
  const a = view.tracksOf(request.source);
  const b = view.tracksOf(dropped);
  return a.first === b.first && a.last === b.last;
}

/**
 * Οι θέσεις μιας λωρίδας μετά την αφαίρεση και την παρεμβολή.
 *
 * Το `insertion.at` είναι δείκτης **στη λίστα μετά την αφαίρεση** ({@link survivorsBefore}) και
 * όχι στο αρχικό πλέγμα: έτσι η θέση προσγείωσης υπολογίζεται **μία φορά**, έξω από τον βρόχο
 * των λωρίδων, και είναι εξ ορισμού η **ίδια** για όλες — δηλαδή η σχισμένη περιοχή γίνεται μη
 * εκφράσιμη αντί να αποφεύγεται με προσοχή.
 */
function shiftedSlots(
  lineCount: number,
  removed: TableAxisSpanRange | null,
  insertion: { readonly at: number; readonly size: number },
): readonly ShiftSlot[] {
  let slots: ShiftSlot[] = [];
  for (let line = 0; line < lineCount; line++) slots.push({ kind: 'keep', line });

  if (removed !== null) {
    slots = slots.filter((slot) => slot.kind !== 'keep' || !axisSpanContains(removed, slot.line));
  }

  const block: ShiftSlot[] = [];
  for (let offset = 0; offset < insertion.size; offset++) block.push({ kind: 'block', offset });
  slots.splice(insertion.at, 0, ...block);

  slots.length = Math.min(slots.length, lineCount);
  while (slots.length < lineCount) slots.push({ kind: 'empty' });
  return slots;
}

/** Πόσες θέσεις **επιβιώνουν** πριν από τη θέση απόθεσης — αρχικός → μειωμένος δείκτης. */
function survivorsBefore(removed: TableAxisSpanRange | null, dropLine: number): number {
  if (removed === null) return dropLine;
  return dropLine - Math.max(Math.min(removed.last, dropLine - 1) - removed.first + 1, 0);
}

/** Οι θέσεις μιας λωρίδας → γεμίσματα· οι **ακίνητες** θέσεις παραλείπονται. */
function collectTrackFills(
  view: TableAxisView,
  slots: readonly ShiftSlot[],
  track: number,
  sourceFirstLine: number,
  sourceTrack: number,
  into: TableCellFill[],
): void {
  for (let line = 0; line < slots.length; line++) {
    const slot = slots[line];
    if (slot.kind === 'keep' && slot.line === line) continue;
    const from =
      slot.kind === 'keep'
        ? view.cellAt(slot.line, track)
        : slot.kind === 'block'
          ? view.cellAt(sourceFirstLine + slot.offset, sourceTrack)
          : null;
    into.push({ at: view.cellAt(line, track), from });
  }
}

/** Η πηγή που **δεν** έκλεισε (άλλη λωρίδα): αδειάζει, όπως στη σκέτη μετακίνηση. */
function collectVacatedFills(
  view: TableAxisView,
  source: TableCellRangeBounds,
  destination: TableCellRangeBounds,
  into: TableCellFill[],
): void {
  const srcLines = view.linesOf(source);
  const srcTracks = view.tracksOf(source);
  const dstLines = view.linesOf(destination);
  const dstTracks = view.tracksOf(destination);

  for (let track = srcTracks.first; track <= srcTracks.last; track++) {
    for (let line = srcLines.first; line <= srcLines.last; line++) {
      if (axisSpanContains(dstLines, line) && axisSpanContains(dstTracks, track)) continue;
      into.push({ at: view.cellAt(line, track), from: null });
    }
  }
}
