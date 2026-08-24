'use client';

/**
 * 🔴 ADR-739 §48 — **ΤΙ ΒΡΙΣΚΕΤΑΙ ΣΤΟ ΠΡΟΧΕΙΡΟ, ΚΑΙ ΑΠΟ ΠΟΥ ΗΡΘΕ.**
 *
 * Το Excel, μετά από `Ctrl+C`, περιβάλλει την περιοχή που αντιγράφηκε με **κινούμενη
 * διακεκομμένη γραμμή** — τα «marching ants». Δεν είναι διακόσμηση: είναι η **μόνη** απάντηση
 * στο «τι θα επικολληθεί αν πατήσω τώρα `Ctrl+V`», σε μια εφαρμογή όπου το πρόχειρο ζει έξω
 * από το έγγραφο και η επιλογή έχει ήδη προλάβει να μετακινηθεί αλλού.
 *
 * ## Γιατί store και όχι React state
 * Ο καταναλωτής είναι ο **ζωγράφος του καμβά**, που δεν βλέπει React state — ακριβώς το ίδιο
 * επιχείρημα με το `table-cell-cursor-store` και το `table-range-transfer-store`. Διαβάζεται
 * με getter τη στιγμή του καρέ (ADR-040).
 *
 * ## 🔴 ΓΙΑΤΙ ΚΡΑΤΑ ΤΗΝ ΑΝΑΦΟΡΑ ΤΟΥ ΜΟΝΤΕΛΟΥ
 * Στο Excel, το γράψιμο σε κελί **σβήνει** τα μυρμήγκια — και σωστά: το πρόχειρο κρατά ό,τι
 * αντιγράφηκε, αλλά το **περίγραμμα** υπόσχεται «αυτά τα κελιά, όπως τα βλέπεις». Μια
 * διαγραμμένη γραμμή στη μέση της περιοχής κάνει την υπόσχεση ψέμα.
 *
 * Η {@link TableCopyMarqueeState.modelRef} το λύνει **δομικά** αντί με ακυρωτές: το έργο έχει
 * ήδη τεκμηριωμένο δόγμα ότι *η ταυτότητα του μοντέλου ΕΙΝΑΙ η έκδοσή του* — το
 * `buildTableModelCommand` επιστρέφει `null` όταν το μοντέλο γύρισε **ίδιο by-reference**, και
 * το `previewTableModel` βασίζεται στο ίδιο για να ακυρώνει απομνημονεύσεις. Άρα «άλλαξε κάτι;»
 * είναι **μία σύγκριση δείκτη**, και καμία μελλοντική διαδρομή εγγραφής δεν χρειάζεται να
 * μάθει ότι υπάρχουν μυρμήγκια.
 *
 * ⚠️ Το `modelRef` **δεν** είναι αντίγραφο δεδομένων: είναι η ίδια αμετάβλητη αναφορά που ήδη
 * κρατά η σκηνή, κρατημένη ως **σφραγίδα έκδοσης**. Καμία δεύτερη αλήθεια, κανένα βάρος μνήμης.
 *
 * ## Τι ΔΕΝ σβήνει τα μυρμήγκια
 * Το **`Ctrl+V`** — Excel parity, επιβεβαιωμένο από τον ιδιοκτήτη (2026-08-05): επικολλάς όσες
 * φορές θες από την ίδια αντιγραφή. Δεν χρειάζεται γραμμή κώδικα γι' αυτό, χρειάζεται να
 * **μην** γραφτεί· καταγράφεται εδώ ώστε να μην «διορθωθεί» αργότερα ως παράλειψη.
 *
 * @module subapps/dxf-viewer/state/table-copy-marquee-store
 * @see state/table-copy-marquee-pulse.ts — το ρολόι που είναι ταυτόχρονα ο φρουρός ζωής
 * @see rendering/entities/table/stamp-table-copy-marquee.ts — ο ένας ζωγράφος
 */

import { createExternalStore } from '../stores/createExternalStore';
import { markSystemsDirty } from '../rendering/core/frame-scheduler-api';
import { getTableCellCursor } from './table-cell-cursor-store';
import { startMarchingAntsPulse } from './table-copy-marquee-pulse';
import type { TableCellRangeBounds } from '../bim/table/table-cell-range';
import type { TableEntity } from '../types/table-entity';

/**
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΣΚΕΛΟΣ «ΑΠΟΚΟΠΗ»** — και γιατί δεν είναι παράλειψη
 *
 * Στο Excel το `Ctrl+X` δείχνει κι αυτό μυρμήγκια, επειδή εκεί η αποκοπή **δεν αδειάζει
 * τίποτα**: τα κελιά μένουν ως έχουν και σβήνουν τη στιγμή της επικόλλησης. Το marquee
 * υπόσχεται «αυτό το περιεχόμενο θα μετακινηθεί», και η υπόσχεση ισχύει όσο το περιεχόμενο
 * είναι εκεί.
 *
 * Η αποκοπή του Νέστωρ **αδειάζει επί τόπου** (τεκμηριωμένη απόφαση στο `onCut` του
 * `use-table-range-actions`: «αντιγραφή + άδειασμα, με αυτή τη σειρά»). Μυρμήγκια γύρω από
 * **ήδη άδεια** κελιά θα υπόσχονταν περιεχόμενο που δεν υπάρχει πια — δηλαδή θα ήταν parity
 * στο σχήμα και ψέμα στο νόημα.
 *
 * ⚠️ Αν κάποτε η αποκοπή γίνει αναβαλλόμενη (Excel parity σε **συμπεριφορά**), τότε — και
 * **μόνο τότε** — έχει νόημα να γράφει κι αυτή εδώ. Δεν κρατιέται σήμερα `kind` σκέλος για
 * «μελλοντική χρήση»: θα ήταν νεκρός κλάδος που κανένα test δεν μπορεί να δικαιολογήσει.
 */
export interface TableCopyMarqueeState {
  readonly entityId: string;
  readonly bounds: TableCellRangeBounds;
  /** Η **σφραγίδα έκδοσης** του πίνακα τη στιγμή της αντιγραφής — δες την κεφαλίδα. */
  readonly modelRef: TableEntity['model'];
  /** Η αφετηρία της κίνησης, σε `performance.now()`. */
  readonly startedAtMs: number;
}

/** Ο ζωγράφος που πρέπει να μάθει ότι κάτι άλλαξε — ίδιο μοτίβο με τα αδελφά stores. */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const store = createExternalStore<TableCopyMarqueeState | null>(null);

/** Η ρητή διακοπή του τρέχοντος παλμού· `null` όταν δεν τρέχει κανένας. */
let stopPulse: (() => void) | null = null;

function requestFrame(): void {
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
}

/**
 * 🔴 Ο φρουρός ζωής, ως **μία** ερώτηση: «είναι ο χρήστης ακόμα μέσα σε **αυτόν** τον πίνακα;»
 *
 * Απαντά ταυτόχρονα σε τρία σενάρια που αλλιώς θα ήθελαν τρεις ξεχωριστούς ακυρωτές:
 * `Escape` (ο δρομέας πεθαίνει), έξοδο από τη λειτουργία (ίδιο), και μετάβαση σε **άλλον**
 * πίνακα (ο δρομέας αλλάζει `entityId`). Δες την κεφαλίδα του παλμού για το γιατί ζει εκεί.
 *
 * ⚠️ **Δεν** ρωτά για το μοντέλο: εκείνο απαιτεί ανάγνωση σκηνής, την οποία ο ζωγράφος έχει
 * ήδη δωρεάν στο χέρι του κάθε καρέ. Η μπαγιάτικη έκδοση κρίνεται εκεί
 * (`resolveTableCopyMarqueeBounds`), όχι εδώ — κάθε ερώτηση εκεί όπου η απάντηση είναι φθηνή.
 */
function isMarqueeAlive(): boolean {
  const marquee = store.get();
  if (!marquee) return false;
  return getTableCellCursor()?.entityId === marquee.entityId;
}

function commit(next: TableCopyMarqueeState | null): void {
  stopPulse?.();
  stopPulse = null;
  store.set(next);
  requestFrame();
  if (!next) return;
  stopPulse = startMarchingAntsPulse({
    shouldContinue: isMarqueeAlive,
    onTick: requestFrame,
    // `clearTableCopyMarquee` και όχι `store.set(null)`: η λήξη οφείλει να περάσει από την
    // **ίδια** πόρτα με κάθε άλλο σβήσιμο, αλλιώς ο επόμενος που προσθέσει κάτι στο κλείσιμο
    // θα το προσθέσει σε μία από τις δύο.
    onExpire: clearTableCopyMarquee,
  });
}

/** Καθαρή ανάγνωση — ο getter που καλεί ο `TableRenderer` τη στιγμή του καρέ. */
export function getTableCopyMarquee(): TableCopyMarqueeState | null {
  return store.get();
}

/**
 * `Ctrl+C` / `Ctrl+X` — η περιοχή μπήκε στο πρόχειρο.
 *
 * Μια δεύτερη αντιγραφή **αντικαθιστά** την πρώτη (Excel parity): ο παλμός σταματά και
 * ξαναρχίζει, άρα και η φάση της κίνησης ξεκινά από την αρχή — η νέα αντιγραφή διαβάζεται ως
 * νέο γεγονός, όχι ως συνέχεια.
 */
export function setTableCopyMarquee(
  entityId: string,
  bounds: TableCellRangeBounds,
  modelRef: TableEntity['model'],
): void {
  commit({ entityId, bounds, modelRef, startedAtMs: performance.now() });
}

/** Σβήνει το marquee και σταματά τον παλμό. Ιδεμποτής. */
export function clearTableCopyMarquee(): void {
  if (store.get() === null) return;
  commit(null);
}

// ADR-700 §4 (2026-08-24): subscribeTableCopyMarquee + useTableCopyMarquee ΔΙΑΓΡΑΦΗΚΑΝ —
// μηδέν καταναλωτές. Ο μοναδικός πραγματικός αναγνώστης (stamp-table-copy-marquee.ts) παίρνει
// το state ως ΟΡΙΣΜΑ από τον TableRenderer, ο οποίος το διαβάζει με getter τη στιγμή του
// καρέ (ADR-040) — δηλαδή το React binding δεν επρόκειτο ποτέ να χρησιμοποιηθεί εδώ.

/** Test helper — μηδενισμός μεταξύ tests, μαζί με τον παλμό που αλλιώς θα επιζούσε. */
export function __resetTableCopyMarqueeForTests(): void {
  stopPulse?.();
  stopPulse = null;
  store.reset(null);
}
