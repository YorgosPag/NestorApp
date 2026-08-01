/**
 * ADR-739 Φ.Δ βήμα 3 — **η μία μηχανή μέτρησης** που μοιράζονται ο καμβάς και το DOM του
 * in-cell επεξεργαστή.
 *
 * ## Το ερώτημα που απαντά (§5 του handoff: «μη διπλασιάζεται η μέτρηση κειμένου»)
 * Ο επεξεργαστής είναι ένα `<input>` **ακριβώς πάνω** στο κελί. Δύο πράγματα πρέπει να
 * συμφωνήσουν σε επίπεδο pixel με ό,τι ζωγράφισε ο καμβάς:
 *   1. **πού πέφτει η γραμμή βάσης** — αλλιώς το κείμενο αναπηδά τη στιγμή του διπλού κλικ·
 *   2. **σε ποιο γράμμα πέφτει ο κέρσορας** — αλλιώς το κλικ σε ένα γράμμα βάζει τον
 *      κέρσορα σε άλλο.
 *
 * Η λύση δεν είναι «δεύτερη, καλύτερη μέτρηση». Είναι ότι **δεν υπάρχει δεύτερη μέτρηση**:
 * εδώ μετράμε με `ctx.measureText` και **ακριβώς το ίδιο** αλφαριθμητικό γραμματοσειράς
 * ({@link tableCellFont}) που θέτει ο ζωγράφος στο `ctx.font` και το DOM στο CSS `font`.
 * Ίδια μηχανή του browser, ίδιο μέγεθος, ίδια οικογένεια ⇒ οι δύο μετρήσεις **είναι** η
 * ίδια μέτρηση. Καμία απόκλιση δεν είναι δυνατή εξ ορισμού — όχι «απίθανη».
 *
 * ## Γιατί ΟΧΙ το `rendering/cache/TextMetricsCache`
 * Εκείνο δέχεται `(text, font, fontSize, fontFamily)` αλλά μετρά με
 * `` `${fontSize}px ${fontFamily}` `` — **αγνοεί το βάρος**. Οι κεφαλίδες πίνακα είναι
 * `bold`, άρα θα έδινε συστηματικά **στενότερο** πλάτος από αυτό που ζωγραφίζεται: ο
 * κέρσορας θα έπεφτε όλο και πιο αριστερά όσο προχωρά η λέξη. Δεν είναι SSoT για αυτή την
 * ερώτηση — είναι λάθος απάντηση σε αυτήν. (Η ενοποίηση των δύο είναι ξεχωριστό χρέος.)
 *
 * ## Χωρίς DOM (SSR / jest / worker)
 * Κάθε συνάρτηση επιστρέφει την **ονομαστική** εκτίμηση από το κεντρικό
 * `TEXT_METRICS_RATIOS` — η ίδια δύο-βάθμια πολιτική που ήδη ακολουθεί το
 * `text-vertical-metrics.ts`. Ποτέ `throw`, ποτέ `NaN`.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-text-metrics
 * @see rendering/entities/table/stamp-table-layout.ts — `tableCellFont`, ο ζωγράφος
 */

import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';

/** Η κατακόρυφη ζώνη της γραμματοσειράς γύρω από τη γραμμή βάσης, σε px. */
export interface CellFontBandPx {
  /** Άνοδος πάνω από τη γραμμή βάσης (θετική). */
  readonly ascentPx: number;
  /** Κάθοδος κάτω από τη γραμμή βάσης (θετικό μέτρο). */
  readonly descentPx: number;
}

/**
 * Ο **ένας** καμβάς μέτρησης της εφαρμογής για κείμενο κελιού. Κρατιέται ζωντανός: ένα
 * `document.createElement('canvas')` ανά πάτημα πλήκτρου θα ήταν δουλειά ανάλογη της
 * πληκτρολόγησης, δηλαδή ακριβώς το σχήμα που ο ADR-735 τιμώρησε.
 */
let sharedCtx: CanvasRenderingContext2D | null | undefined;

function measuringContext(): CanvasRenderingContext2D | null {
  if (sharedCtx !== undefined) return sharedCtx;
  sharedCtx =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return sharedCtx;
}

/** Το px-πρόθεμα ενός αλφαριθμητικού γραμματοσειράς (`"bold 24px arial"` → 24). */
function fontSizePx(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 0;
}

/**
 * Μέγεθος αναφοράς για τη **μία** μέτρηση ανά γραμματοσειρά. Μεγάλο επίτηδες: αρκετές
 * μηχανές στρογγυλοποιούν τα μετρικά σε ακέραια px ανά μέγεθος, οπότε μέτρηση στα 200 px
 * και αναγωγή δίνει **καλύτερη** υποδιαιρετική ακρίβεια από μια μέτρηση στο τελικό μέγεθος.
 */
const BAND_REFERENCE_PX = 200;

/** Η ονομαστική ζώνη (÷ μέγεθος) όταν δεν υπάρχει — ή δεν απαντά — καμβάς. */
const NOMINAL_BAND: CellFontBandPx = {
  ascentPx: TEXT_METRICS_RATIOS.ASCENT_RATIO,
  descentPx: TEXT_METRICS_RATIOS.DESCENT_RATIO,
};

/**
 * Η ζώνη ascent/descent, **ανηγμένη στο μέγεθος** (δηλαδή ÷ font-size).
 *
 * 🔴 Γιατί αναλογία και όχι απόλυτα px: σε κάθε καρέ zoom το μέγεθος αλλάζει. Ένα cache με
 * κλειδί το πλήρες αλφαριθμητικό θα αστοχούσε **σε κάθε καρέ** — μια `measureText` ανά
 * καρέ και ένας `Map` που μεγαλώνει όσο κρατά το zoom. Τα μετρικά γραμματοσειράς όμως είναι
 * γραμμικά ως προς το μέγεθος, οπότε **μία** μέτρηση ανά (οικογένεια, βάρος) αρκεί για
 * κάθε κλίμακα: το cache έχει το πολύ δύο εγγραφές.
 *
 * 🔴 Χρησιμοποιεί `fontBoundingBox*` (μετρικά **γραμματοσειράς**) και **όχι**
 * `actualBoundingBox*` (μελάνι **γλύφων**). Η διάκριση δεν είναι λεπτομέρεια: το
 * `text-vertical-metrics.ts` καταγράφει μετρημένο περιστατικό όπου το `actualBoundingBox*`
 * επέστρεψε σκουπίδια στη μηχανή του Giorgio (`cssInkAscent = -17`). Και σημασιολογικά
 * μόνο το `fontBoundingBox*` απαντά στην ερώτηση που κάνουμε: πώς στοιχίζει **το CSS** το
 * κουτί γραμμής, το οποίο ορίζεται από τα μετρικά της γραμματοσειράς — όχι από το ποια
 * γράμματα έτυχε να γραφτούν.
 */
const BAND_CACHE = new Map<string, CellFontBandPx>();

function fontBandRatio(font: string): CellFontBandPx {
  // Το κλειδί είναι η γραμματοσειρά με το μέγεθος **κανονικοποιημένο**: αυτό ακριβώς κάνει
  // το cache πεπερασμένο και το ίδιο το ερώτημα ανεξάρτητο από το zoom.
  const key = font.replace(/\d+(?:\.\d+)?px/, `${BAND_REFERENCE_PX}px`);
  const cached = BAND_CACHE.get(key);
  if (cached) return cached;

  const ctx = measuringContext();
  let ratio = NOMINAL_BAND;
  if (ctx) {
    ctx.font = key;
    // Το «Mg» δεν επηρεάζει τα μετρικά γραμματοσειράς· υπάρχει γιατί το `measureText`
    // απαιτεί κείμενο. Κενό αλφαριθμητικό επιστρέφει μηδενικά σε κάποιες μηχανές.
    const m = ctx.measureText('Mg');
    const ascent = m.fontBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent;
    if (Number.isFinite(ascent) && Number.isFinite(descent) && ascent > 0 && descent >= 0) {
      ratio = { ascentPx: ascent / BAND_REFERENCE_PX, descentPx: descent / BAND_REFERENCE_PX };
    }
  }

  BAND_CACHE.set(key, ratio);
  return ratio;
}

/** Η ζώνη ascent/descent σε **px**, για το συγκεκριμένο μέγεθος του αλφαριθμητικού. */
export function cellFontBandPx(font: string): CellFontBandPx {
  const size = fontSizePx(font);
  const ratio = fontBandRatio(font);
  return { ascentPx: ratio.ascentPx * size, descentPx: ratio.descentPx * size };
}

/** Το πλάτος ενός κειμένου σε px, με τη γραμματοσειρά που θα ζωγραφιστεί. */
export function cellTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  const ctx = measuringContext();
  if (!ctx) return text.length * fontSizePx(font) * TEXT_METRICS_RATIOS.CHAR_WIDTH_PROPORTIONAL;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Ο δείκτης χαρακτήρα στον οποίο πέφτει ένα σημείο, μετρημένο σε px **από την αρχή του
 * κειμένου** — δηλαδή «σε ποιο γράμμα έκανα κλικ» (Excel).
 *
 * Επιλέγεται το **πλησιέστερο όριο χαρακτήρα**, όχι ο χαρακτήρας που περιέχει το σημείο:
 * κλικ στο δεξί μισό ενός γράμματος βάζει τον κέρσορα **μετά** από αυτό. Αυτή είναι η
 * συμπεριφορά κάθε επεξεργαστή κειμένου, και είναι ο λόγος που το κλικ στο τέλος μιας
 * λέξης δεν προσπερνά ποτέ πίσω από το τελευταίο γράμμα.
 *
 * Γραμμική σάρωση προθεμάτων και όχι δυαδική: το κείμενο ενός κελιού είναι δεκάδες
 * χαρακτήρες και η κλήση γίνεται **μία φορά ανά διπλό κλικ**. Δυαδική αναζήτηση εδώ θα
 * ήταν πολυπλοκότητα χωρίς μετρήσιμο όφελος.
 */
export function cellCaretIndexAtPx(text: string, font: string, offsetPx: number): number {
  if (!text) return 0;
  if (offsetPx <= 0) return 0;

  let previous = 0;
  for (let i = 1; i <= text.length; i++) {
    const advance = cellTextWidthPx(text.slice(0, i), font);
    if (offsetPx < (previous + advance) / 2) return i - 1;
    previous = advance;
  }
  return text.length;
}

/** Test helper — μηδενισμός της απομνημόνευσης ανάμεσα σε tests. */
export function __resetTableCellTextMetricsForTests(): void {
  BAND_CACHE.clear();
  sharedCtx = undefined;
}
