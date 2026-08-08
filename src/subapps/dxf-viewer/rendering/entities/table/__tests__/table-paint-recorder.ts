/**
 * Test helper — **η ΠΙΝΑΚΟ-ειδική όψη** του ενός καταγραφέα ζωγραφικής (ADR-739 §19.8).
 *
 * Δεν είναι σουίτα: το `testMatch` του jest απαιτεί `*.test.ts` μέσα στο `__tests__`, οπότε
 * αυτό το αρχείο φορτώνεται μόνο ως εισαγωγή.
 *
 * ## 🔴 ADR-775 §13 — ΤΙ ΑΛΛΑΞΕ: ο καταγραφέας ΜΕΤΑΚΟΜΙΣΕ, δεν ξαναγράφτηκε
 * Το ψεύτικο `CanvasRenderingContext2D` και τα σχήματα εγγραφών ζουν πλέον στο
 * {@link module:testing/paint-recorder}, γιατί **δεν έχουν τίποτα το πινακικό**: τα
 * χρειάζεται και ο καμβάς DXF, όπου το ίχνος κλήσεων σχεδίασης γίνεται το κύριο δίχτυ
 * (39/39 άκυρα pixel golden, τρεις μήνες, τέσσερα από αυτά πράσινα).
 *
 * Εδώ μένει **μόνο** ό,τι αφορά τον πίνακα: το εργοστάσιο `createRc` (που δένει προβολή ↔
 * γωνία κειμένου μέσω του `createStampTableContext`), οι επιλογές του και η προεπιλεγμένη
 * επιφάνεια. Τα κοινά **επανεξάγονται** ώστε καμία από τις δέκα σουίτες πινάκων να μην
 * αλλάξει ούτε μία γραμμή εισαγωγής.
 *
 * ⚠️ **ΜΗΝ** ξαναγράψεις εδώ context/εγγραφές: δεύτερο αντίγραφο ~250 γραμμών με ταυτόσημα
 * stubs είναι ακριβώς ο structural clone που πιάνει το CHECK 3.28 (jscpd) **ανεξάρτητα
 * ονόματος** (N.18).
 *
 * @module rendering/entities/table/__tests__/table-paint-recorder
 */

import { createStampTableContext, type StampTableContext } from '../stamp-table-layout';
import { createCtx, type PaintLog } from '../../../../testing/paint-recorder';

// 🔑 Επανεξαγωγή των κοινών — ΕΝΑΣ ορισμός, δύο ονόματα εισαγωγής. Οι υπάρχουσες σουίτες
// συνεχίζουν να εισάγουν από εδώ· ο καμβάς DXF εισάγει απευθείας από το `testing/`.
export {
  createCtx,
  createPaintLog,
  paintedInk,
  totalDrawCalls,
  RECORDER_CHAR_PX,
  createRecordingCanvas,
} from '../../../../testing/paint-recorder';
export type {
  PaintLog,
  StrokeRecord,
  TextRecord,
  RectRecord,
  ClipRecord,
  FillPathRecord,
  ArcRecord,
} from '../../../../testing/paint-recorder';

/** Ό,τι μπορεί να παραμετροποιήσει μια σουίτα· ό,τι δεν δηλώσει παίρνει λογική προεπιλογή. */
export interface PaintRecorderOptions {
  readonly phaseColor?: string;
  /**
   * Px οθόνης ανά sheet-mm. Η προεπιλογή είναι αρκετά μεγάλη ώστε το LOD να **μην** κόβει
   * (δες `MIN_CELL_TEXT_SCREEN_PX`)· τα tests του LOD τη μικραίνουν επίτηδες.
   */
  readonly pxPerMm?: number;
  /** Πλαίσιο → οθόνη. Προεπιλογή: ταυτοτική. */
  readonly toScreen?: (u: number, v: number) => { x: number; y: number };
  /**
   * 🔴 ADR-739 §41 — η επιφάνεια κάτω από τον πίνακα. Προεπιλογή: {@link RECORDER_DARK_SURFACE}.
   *
   * **Είναι επιλογή και όχι σταθερά** για τον ίδιο λόγο που το `maxContrastInk` παίρνει το
   * φόντο ως όρισμα: μια σουίτα που δοκιμάζει μόνο τη σκούρα επιφάνεια είναι πράσινη με
   * σπασμένη τη φωτεινή. Τα tests parity με Excel περνούν ρητά `TABLE_PAPER_HEX`.
   */
  readonly surfaceHex?: string;
  /**
   * 🔴 ADR-771 Φ.2 — ζωγραφίζει ο πίνακας ο ίδιος την επιφάνεια; **Προεπιλογή `false`**, που
   * είναι η ιστορική συμπεριφορά (κατάσταση «Καμβάς»): κάθε υπάρχουσα σουίτα βλέπει ό,τι
   * έβλεπε πάντα, χωρίς να αλλάξει γραμμή. Τα tests της Φ.2 το ανεβάζουν ρητά.
   */
  readonly surfacePaint?: boolean;
}

/**
 * Η **προεπιλεγμένη σκούρα** επιφάνεια των tests — το `nestorApp1`, ό,τι βλέπει ο χρήστης
 * χωρίς να αλλάξει θέμα καμβά. Γραμμένη ρητά (και όχι διαβασμένη από το CSS) επειδή στο jsdom
 * το `getComputedStyle` δεν έχει τις μεταβλητές του θέματος και θα επέστρεφε πάντα το ίδιο
 * fallback — δηλαδή μια «ζωντανή» ανάγνωση που δεν είναι ζωντανή.
 */
export const RECORDER_DARK_SURFACE = '#1d283a';

/**
 * Το πλαίσιο ζωγραφικής των tests — **από το ίδιο εργοστάσιο με τον παραγωγικό κώδικα**.
 *
 * 🔴 Η προβολή δίνεται **ως επιλογή** και ποτέ με `{ ...createRc(log), toScreen: … }`: από το
 * βήμα 8 το πλαίσιο κουβαλά και τη **γωνία κειμένου**, παραγόμενη από την προβολή μέσω του
 * {@link createStampTableContext}. Ένα spread-override του `toScreen` θα άφηνε τη γωνία της
 * **ταυτοτικής** προβολής — δηλαδή ένα test που νομίζει ότι δοκιμάζει στραμμένο πίνακα ενώ
 * ζητά οριζόντιο κείμενο, και θα ήταν πράσινο ό,τι κι αν έκανε ο ζωγράφος. Περνώντας από το
 * ίδιο εργοστάσιο, το ζεύγος «προβολή ↔ γωνία» δεν μπορεί να ξεσυγχρονιστεί σε κανένα test.
 */
export function createRc(log: PaintLog, options: PaintRecorderOptions = {}): StampTableContext {
  const {
    phaseColor,
    pxPerMm = 10,
    toScreen = (u, v) => ({ x: u, y: v }),
    surfaceHex = RECORDER_DARK_SURFACE,
    surfacePaint = false,
  } = options;
  return createStampTableContext({
    ctx: createCtx(log),
    toScreen,
    pxPerMm,
    surfaceHex,
    surfacePaint,
    phaseColor,
  });
}
