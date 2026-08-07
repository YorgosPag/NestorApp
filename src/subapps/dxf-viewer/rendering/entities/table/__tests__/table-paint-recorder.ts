/**
 * Test helper — **ο ένας καταγραφέας ζωγραφικής πίνακα** (ADR-739).
 *
 * Δεν είναι σουίτα: το `testMatch` του jest απαιτεί `*.test.ts` μέσα στο `__tests__`, οπότε
 * αυτό το αρχείο φορτώνεται μόνο ως εισαγωγή.
 *
 * ## Γιατί κοινό και όχι ένα αντίγραφο ανά σουίτα (N.0.2 / N.18)
 * Δύο σουίτες χρειάζονται **το ίδιο** ψεύτικο `CanvasRenderingContext2D`: το
 * `stamp-table-layout.test.ts` (μελάνι/σιλουέτα, ADR-739 §19.8) και το
 * `table-cell-clipping.test.ts` (ισοτιμία τεσσάρων backends, Φ.Δ βήμα 5). Ένα δεύτερο
 * αντίγραφο ~35 γραμμών με ταυτόσημα stubs είναι ακριβώς ο structural clone που πιάνει το
 * CHECK 3.28 (jscpd, ADR-584) — **ανεξάρτητα ονόματος**.
 *
 * @module rendering/entities/table/__tests__/table-paint-recorder
 */

import type { Point2D } from '../../../types/Types';
import { createStampTableContext, type StampTableContext } from '../stamp-table-layout';

/** Μία διαδρομή που χαράχτηκε: με τι μολύβι και σε ποια σημεία **οθόνης**. */
export interface StrokeRecord {
  readonly color: string;
  readonly lineWidth: number;
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  /**
   * ADR-750 Φ5 — το μοτίβο διακεκομμένης **σε px**, όπως θα το δεχόταν ο καμβάς.
   *
   * Ήταν `setLineDash: () => undefined`, δηλαδή ο καταγραφέας **κατάπινε** ακριβώς την
   * πληροφορία που κρύβει το ελάττωμα: ένα μοτίβο με αρνητικά μήκη κάνει τον καμβά να αγνοήσει
   * ολόκληρη την κλήση και να ζωγραφίσει συμπαγή γραμμή — **χωρίς σφάλμα πουθενά**. Ένα
   * κατάπιε-και-προχώρα stub δεν είναι ουδέτερο· είναι πράσινο και για τις δύο υλοποιήσεις.
   */
  readonly dashPx: readonly number[];
}

/**
 * Ένα κείμενο που σταμπαρίστηκε — **και πού κατέληξε πραγματικά στην οθόνη**.
 *
 * ## Γιατί δεν αρκεί το ζεύγος (κείμενο, χρώμα) — ADR-739 Φ.Δ βήμα 8
 * Μέχρι το βήμα 8 ο ζωγράφος καλούσε `fillText(t, x, y)` με απόλυτες συντεταγμένες, οπότε
 * το «πού» ήταν τα ορίσματα. Τώρα καλεί `translate` + `rotate` + `fillText(t, 0, 0)`, και
 * τα ορίσματα είναι **πάντα μηδέν**: ένας καταγραφέας που κοιτά μόνο τα ορίσματα θα έβλεπε
 * κάθε κείμενο στο `(0,0)` και θα ήταν **πράσινος και για τη σωστή και για τη λάθος**
 * υλοποίηση. Γι' αυτό ο καταγραφέας κρατά πλέον πραγματική **στοίβα μετασχηματισμού** και
 * καταγράφει το σημείο **μετά** την εφαρμογή της — δηλαδή ό,τι θα έβλεπε το μάτι.
 */
export interface TextRecord {
  readonly text: string;
  readonly color: string;
  /** Το `ctx.font` τη στιγμή της γραφής — έντονο/κανονικό, ύψος, οικογένεια. */
  readonly font: string;
  /** Πού έπεσε η άγκυρα του κειμένου σε px οθόνης, **μετά** τον ενεργό μετασχηματισμό. */
  readonly at: Point2D;
  /** Η στροφή του ενεργού μετασχηματισμού σε ακτίνια (`0` = οριζόντιο κείμενο). */
  readonly angleRad: number;
}

/**
 * Η **προβολή** μόνο του μελανιού — ό,τι χρειάζεται ένα test που ρωτά «με τι χρώμα
 * γράφτηκε;» και τίποτα άλλο. Κρατά την ακρίβεια του `toEqual` (κανένα παραπανίσιο
 * κείμενο δεν περνά απαρατήρητο) χωρίς να απαιτεί από κάθε σουίτα να επαναλάβει γεωμετρία
 * που δεν την αφορά.
 */
export function paintedInk(log: PaintLog): ReadonlyArray<{ text: string; color: string }> {
  return log.texts.map(({ text, color }) => ({ text, color }));
}

/** Καταγράφει κάθε `fillStyle` τη στιγμή που χρησιμοποιείται — όχι στο τέλος. */
/**
 * Ένα συμπαγές ορθογώνιο (`fillRect`) — ADR-739 Φ.Ε: η **υπογράμμιση**.
 *
 * Καταγράφεται με το σημείο **μετά** τον μετασχηματισμό, για τον ίδιο λόγο με το
 * {@link TextRecord}: μέσα στη στροφή του `stampFrameText` τα ορίσματα είναι σχετικά, και
 * ένας καταγραφέας που κοιτά μόνο αυτά θα ήταν πράσινος και για γραμμή που έμεινε οριζόντια
 * κάτω από γερμένο κείμενο.
 */
export interface RectRecord {
  readonly color: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly widthPx: number;
  readonly heightPx: number;
  readonly angleRad: number;
}

/**
 * ADR-751 — μια **λωρίδα αποκοπής** (`rect` + `clip`): το εύρος μέσα στο οποίο επιτρέπεται
 * να βγει το επόμενο μελάνι. Ο σύνδεσμος μέσα σε μικτό κείμενο είναι ο μόνος σημερινός
 * παραγωγός.
 */
export interface ClipRecord {
  readonly at: { readonly x: number; readonly y: number };
  readonly widthPx: number;
  readonly heightPx: number;
  readonly angleRad: number;
}

/**
 * 🔴 ADR-739 §41 — μια **γεμισμένη διαδρομή**: με τι μελάνι, σε ποιες υποδιαδρομές και με
 * ποιον κανόνα περιτύλιξης.
 *
 * ## Γιατί δεν αρκούσε το `fills: string[]`
 * Ο καταγραφέας κρατούσε **μόνο το χρώμα** κάθε `fill()`. Η τρύπα του ενεργού κελιού όμως
 * δεν αλλάζει χρώμα — αλλάζει **γεωμετρία** (δεύτερη υποδιαδρομή) και **κανόνα** (`evenodd`).
 * Ένα test πάνω στο παλιό σχήμα θα ήταν **πράσινο και για τη σωστή και για τη λάθος**
 * υλοποίηση: ακριβώς το «κατάπιε-και-προχώρα» stub που το {@link StrokeRecord.dashPx}
 * τεκμηριώνει ως ελάττωμα — δεύτερη φορά, σε άλλη ιδιότητα.
 *
 * Το `fills` **μένει** και γεμίζει όπως πάντα: πέντε σουίτες το διαβάζουν και δεν έχουν
 * λόγο να μάθουν γεωμετρία που δεν τις αφορά.
 */
export interface FillPathRecord {
  readonly color: string;
  /** Μία εγγραφή ανά `moveTo`, σε px **οθόνης** (μετά τον ενεργό μετασχηματισμό). */
  readonly subpaths: ReadonlyArray<ReadonlyArray<Point2D>>;
  /** Ό,τι ζητήθηκε στο `fill(rule)`· `'nonzero'` όταν δεν δόθηκε, όπως ο καμβάς. */
  readonly rule: CanvasFillRule;
}

export interface PaintLog {
  readonly fills: string[];
  readonly fillPaths: FillPathRecord[];
  readonly texts: TextRecord[];
  readonly strokes: StrokeRecord[];
  readonly rects: RectRecord[];
  readonly clips: ClipRecord[];
}

/** Καθαρό ημερολόγιο — μία έκφραση, ώστε καμία σουίτα να μην ξεχάσει πεδίο. */
export function createPaintLog(): PaintLog {
  return { fills: [], fillPaths: [], texts: [], strokes: [], rects: [], clips: [] };
}

/**
 * Πλάτος χαρακτήρα του ψεύτικου `measureText`, σε px.
 *
 * Σταθερό και **ανεξάρτητο** από τη γραμματοσειρά: το jsdom δεν έχει μηχανή κειμένου, οπότε
 * κάθε «ρεαλιστική» μέτρηση θα ήταν φαντασία με περισσότερα βήματα. Εκτεθειμένο ώστε τα
 * tests να υπολογίζουν το αναμενόμενο πλάτος από τη **μία** πηγή.
 */
export const RECORDER_CHAR_PX = 6;

/**
 * Ο ενεργός affine μετασχηματισμός `[a c e; b d f]`, με τη σύμβαση του καμβά:
 * `X = a·x + c·y + e`, `Y = b·x + d·y + f`.
 */
interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function applyTransform(m: Affine, x: number, y: number): Point2D {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** Ίδια πράξη με το `CanvasRenderingContext2D.translate` — μετάθεση **στο τοπικό σύστημα**. */
function translated(m: Affine, tx: number, ty: number): Affine {
  return { ...m, e: m.e + m.a * tx + m.c * ty, f: m.f + m.b * tx + m.d * ty };
}

/** Ίδια πράξη με το `CanvasRenderingContext2D.rotate` — δεξιόστροφη στους άξονες οθόνης. */
function rotated(m: Affine, angleRad: number): Affine {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    a: m.a * cos + m.c * sin,
    b: m.b * cos + m.d * sin,
    c: m.c * cos - m.a * sin,
    d: m.d * cos - m.b * sin,
    e: m.e,
    f: m.f,
  };
}

export function createCtx(log: PaintLog): CanvasRenderingContext2D {
  let fillStyle = '';
  // 🔴 ADR-739 §41 — **υποδιαδρομές, όχι μία επίπεδη λίστα σημείων.** Ένα `moveTo` ξεκινά νέα:
  // αυτό ακριβώς ξεχωρίζει «ορθογώνιο με τρύπα» από «ορθογώνιο», και ένας καταγραφέας που τα
  // συγχώνευε δεν μπορούσε να δει τη διαφορά.
  let subpaths: Array<Array<{ x: number; y: number }>> = [];
  /** Η λωρίδα που δήλωσε το τελευταίο `rect`, μέχρι να τη ζητήσει ένα `clip`. */
  let pendingRect: Omit<ClipRecord, 'angleRad'> | null = null;
  // Η στοίβα του `save`/`restore`. Χωρίς αυτήν, ένα `restore()` που ξεχάστηκε στον
  // παραγωγικό κώδικα θα ήταν **αόρατο** στα tests — και είναι ακριβώς το είδος διαρροής
  // που βάφει λοξά κάθε επόμενη οντότητα της σκηνής.
  let transform: Affine = IDENTITY;
  let dashPx: readonly number[] = [];
  // Το `setLineDash` επαναφέρεται από το `restore()` όπως κάθε άλλη ιδιότητα σχεδίασης, οπότε
  // ταξιδεύει μαζί με τη μήτρα στη στοίβα — αλλιώς η πρώτη διακεκομμένη θα «έβαφε» και κάθε
  // επόμενη συμπαγή γραμμή του ίδιου περάσματος.
  const stack: Array<{ readonly transform: Affine; readonly dashPx: readonly number[] }> = [];
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    strokeStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineWidth: 1,
    save: (): void => {
      stack.push({ transform, dashPx });
    },
    restore: (): void => {
      const previous = stack.pop();
      transform = previous?.transform ?? IDENTITY;
      dashPx = previous?.dashPx ?? [];
    },
    translate: (tx: number, ty: number): void => {
      transform = translated(transform, tx, ty);
    },
    rotate: (angleRad: number): void => {
      transform = rotated(transform, angleRad);
    },
    beginPath: (): void => {
      subpaths = [];
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      subpaths.push([applyTransform(transform, x, y)]);
    },
    lineTo: (x: number, y: number): void => {
      // `lineTo` χωρίς προηγούμενο `moveTo` ξεκινά διαδρομή στον καμβά· ίδια συμπεριφορά εδώ,
      // ώστε ένα παραλειπόμενο `moveTo` να μη ρίχνει το test με άσχετο σφάλμα.
      const current = subpaths[subpaths.length - 1] ?? (subpaths.push([]), subpaths[0]);
      current.push(applyTransform(transform, x, y));
    },
    stroke: (): void => {
      log.strokes.push({
        color: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        // Επίπεδο, όπως πάντα: κάθε χαραγμένη διαδρομή του πίνακα είναι **μία** υποδιαδρομή,
        // οπότε καμία υπάρχουσα προσδοκία δεν αλλάζει.
        points: subpaths.flat(),
        dashPx: [...dashPx],
      });
    },
    setLineDash: (segments: readonly number[]): void => {
      dashPx = [...segments];
    },
    fill: (rule?: CanvasFillRule): void => {
      log.fills.push(fillStyle);
      log.fillPaths.push({
        color: fillStyle,
        subpaths: subpaths.map((s) => [...s]),
        rule: rule ?? 'nonzero',
      });
    },
    fillText: (text: string, x: number, y: number): void => {
      log.texts.push({
        text,
        color: fillStyle,
        font: ctx.font,
        at: applyTransform(transform, x, y),
        // Η στροφή της ενεργής μήτρας: η διεύθυνση όπου κατέληξε ο άξονας `+x`.
        angleRad: Math.atan2(transform.b, transform.a),
      });
    },
    fillRect: (x: number, y: number, w: number, h: number): void => {
      log.rects.push({
        color: fillStyle,
        at: applyTransform(transform, x, y),
        widthPx: w,
        heightPx: h,
        angleRad: Math.atan2(transform.b, transform.a),
      });
    },
    // ADR-751 — το ζεύγος `rect` + `clip` της ζωγραφικής συνδέσμων. Η αποκοπή **δεν**
    // προσομοιώνεται (ο καταγραφέας δεν έχει καμβά να κόψει· τα `fillText` καταγράφονται
    // ούτως ή άλλως): καταγράφεται η **λωρίδα που ζητήθηκε**, που είναι το πράγμα υπό
    // δοκιμή — αν βγει λάθος εύρος, ο σύνδεσμος βάφεται πάνω σε γράμματα που δεν είναι.
    rect: (x: number, y: number, w: number, h: number): void => {
      pendingRect = { at: applyTransform(transform, x, y), widthPx: w, heightPx: h };
    },
    clip: (): void => {
      if (pendingRect) log.clips.push({ ...pendingRect, angleRad: Math.atan2(transform.b, transform.a) });
      pendingRect = null;
    },
    measureText: (text: string): TextMetrics =>
      ({ width: text.length * RECORDER_CHAR_PX }) as TextMetrics,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** Ό,τι μπορεί να παραμετροποιήσει μια σουίτα· ό,τι δεν δηλώσει παίρνει λογική προεπιλογή. */
export interface PaintRecorderOptions {
  readonly phaseColor?: string;
  /**
   * Px οθόνης ανά sheet-mm. Η προεπιλογή είναι αρκετά μεγάλη ώστε το LOD να **μην** κόβει
   * (δες `MIN_CELL_TEXT_SCREEN_PX`)· τα tests του LOD τη μικραίνουν επίτηδες.
   */
  readonly pxPerMm?: number;
  /** Πλαίσιο → οθόνη. Προεπιλογή: ταυτοτική. */
  readonly toScreen?: (u: number, v: number) => Point2D;
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
