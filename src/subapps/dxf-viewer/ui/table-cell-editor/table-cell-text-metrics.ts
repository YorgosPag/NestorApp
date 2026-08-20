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
 * (`tableTextFont(...).css`, ADR-786) που θέτει ο ζωγράφος στο `ctx.font` και το DOM στο CSS `font`.
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
 * @see bim/table/table-text-font.ts — `tableTextFont`, η ΜΙΑ απάντηση (face + em + shorthand)
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
  const key = normalizedFontKey(font);
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

/**
 * Ο ίδιος κανόνας κανονικοποίησης με το {@link fontBandRatio}: το μέγεθος φεύγει από το
 * κλειδί, ώστε η ίδια γραμματοσειρά σε **κάθε** zoom να είναι μία εγγραφή.
 */
function normalizedFontKey(font: string): string {
  return font.replace(/\d+(?:\.\d+)?px/, `${BAND_REFERENCE_PX}px`);
}

/**
 * 🔴 ADR-739 Φ.Δ βήμα 6 — **το πλάτος ως ΑΝΑΛΟΓΙΑ, όχι ως px**: εδώ κρίνεται το §5.2.
 *
 * Ο επεκτεινόμενος επεξεργαστής ρωτά «πόσο πλατύ πρέπει να γίνει το κουτί;» μέσα στο
 * `projectBox()`, που τρέχει **σε κάθε καρέ** (γι' αυτό ο επεξεργαστής ζουμάρει μαζί με τον
 * καμβά). Ένα cache με κλειδί το πλήρες αλφαριθμητικό γραμματοσειράς θα αστοχούσε **σε κάθε
 * καρέ zoom** — μία `measureText` ανά καρέ ανά μετρημένο κείμενο, δηλαδή ακριβώς το σχήμα
 * «δουλειά ανάλογη του χρόνου» που τιμώρησε ο ADR-735.
 *
 * Η απάντηση δεν είναι απομνημόνευση που ελπίζουμε να πετύχει, είναι **αλλαγή της ερώτησης**:
 * η πρόοδος πένας είναι **γραμμική ως προς το μέγεθος**, οπότε μετράμε μία φορά στα
 * {@link BAND_REFERENCE_PX} και πολλαπλασιάζουμε. Το κλειδί χάνει το μέγεθος ⇒ **μηδέν**
 * `measureText` ανά καρέ, δομικά — όχι κατά τύχη. Είναι το ίδιο επιχείρημα που ήδη κάνει το
 * {@link fontBandRatio} για τη ζώνη ascent/descent, εφαρμοσμένο στην άλλη διάσταση.
 *
 * ⚠️ **Φραγμένο επίτηδες.** Κάθε πάτημα πλήκτρου γεννά νέο πρόχειρο ⇒ νέα εγγραφή. Χωρίς
 * φράγμα, μια μεγάλη συνεδρία γραφής είναι διαρροή μνήμης με το πρόσχημα του cache. Το
 * `Map` διατηρεί σειρά εισαγωγής, οπότε η παλαιότερη εγγραφή φεύγει πρώτη (FIFO) — και οι
 * εγγραφές που **όντως** επαναχρησιμοποιούνται ανά καρέ είναι ελάχιστες (το τρέχον πρόχειρο
 * και τα προθέματά του).
 */
const WIDTH_RATIO_CACHE = new Map<string, number>();
const WIDTH_RATIO_CACHE_MAX = 512;

/**
 * Ο διαχωριστής γραμματοσειράς/κειμένου μέσα στο κλειδί.
 *
 * `U+0000` και όχι κενό: το αλφαριθμητικό γραμματοσειράς **περιέχει** κενά (`"bold 200px
 * arial"`), οπότε ένα κενό ως διαχωριστής θα επέτρεπε σε δύο διαφορετικά ζεύγη να παράγουν
 * το ίδιο κλειδί — δηλαδή λάθος πλάτος, σιωπηλά. Ο NUL δεν εμφανίζεται ποτέ σε κανένα από
 * τα δύο.
 */
const CACHE_KEY_SEPARATOR = '\u0000';

/** Πόσες φορές ρωτήθηκε **όντως** ο καμβάς — δες {@link __tableCellMeasureCallsForTests}. */
let measureCalls = 0;

function textWidthRatio(text: string, font: string): number {
  // Ο διαχωριστής είναι γραμμένος ως **δραπέτευση** και όχι ως ωμό byte: ένας χαρακτήρας
  // ελέγχου μέσα σε πηγαίο αρχείο είναι αόρατος στον αναγνώστη και κάνει το `grep` να
  // θεωρήσει ολόκληρο το αρχείο δυαδικό — δηλαδή το βγάζει από κάθε αναζήτηση του repo.
  const key = `${normalizedFontKey(font)}${CACHE_KEY_SEPARATOR}${text}`;
  const cached = WIDTH_RATIO_CACHE.get(key);
  if (cached !== undefined) return cached;

  const ctx = measuringContext();
  let ratio = text.length * TEXT_METRICS_RATIOS.CHAR_WIDTH_PROPORTIONAL;
  if (ctx) {
    ctx.font = normalizedFontKey(font);
    measureCalls++;
    const width = ctx.measureText(text).width;
    if (Number.isFinite(width) && width >= 0) ratio = width / BAND_REFERENCE_PX;
  }

  if (WIDTH_RATIO_CACHE.size >= WIDTH_RATIO_CACHE_MAX) {
    const oldest = WIDTH_RATIO_CACHE.keys().next();
    if (!oldest.done) WIDTH_RATIO_CACHE.delete(oldest.value);
  }
  WIDTH_RATIO_CACHE.set(key, ratio);
  return ratio;
}

/**
 * Το πλάτος ενός κειμένου σε px, με τη γραμματοσειρά που θα ζωγραφιστεί.
 *
 * Χωρίς καμβά (SSR / jest / worker) πέφτει στην **ονομαστική** εκτίμηση του κεντρικού
 * `TEXT_METRICS_RATIOS` — ίδια δύο-βάθμια πολιτική με όλο το υπόλοιπο αρχείο. Ποτέ `NaN`.
 */
export function cellTextWidthPx(text: string, font: string): number {
  if (!text) return 0;
  return textWidthRatio(text, font) * fontSizePx(font);
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
  WIDTH_RATIO_CACHE.clear();
  measureCalls = 0;
  sharedCtx = undefined;
}

/**
 * Test helper — πόσες φορές ρωτήθηκε **όντως** ο καμβάς για πλάτος. Είναι η **μετρήσιμη**
 * μορφή του §5.2 («το `projectBox()` δεν κάνει `measureText` ανά καρέ»): ένα test μπορεί να
 * καλέσει το κουτί N φορές σε διαφορετικά zoom και να απαιτήσει ότι ο μετρητής δεν κουνήθηκε.
 * Ισχυρισμός χωρίς αριθμό δεν είναι απόδειξη.
 */
export function __tableCellMeasureCallsForTests(): number {
  return measureCalls;
}
