/**
 * 🔑 **Ο ΕΝΑΣ καταγραφέας ζωγραφικής** — ψεύτικο `CanvasRenderingContext2D` που κρατά **τι
 * χαράχτηκε**, για **οποιονδήποτε** ζωγράφο του viewer (ADR-775 §13).
 *
 * ## Προέλευση — ΕΞΑΓΩΓΗ, όχι νέα γραφή (N.0.2 · N.7.1 · N.18)
 * Το σώμα αυτού του module **ζούσε** στο
 * `rendering/entities/table/__tests__/table-paint-recorder.ts` (ADR-739 §19.8) και είναι
 * δοκιμασμένο σε παραγωγή από **δέκα** σουίτες πινάκων. Δεν ξαναγράφτηκε: **μετακόμισε**.
 * Το αρχείο του πίνακα κρατά πλέον μόνο ό,τι αφορά τον πίνακα (`createRc`, επιφάνειες,
 * `pxPerMm`) και **επανεξάγει** τα κοινά, ώστε καμία από τις δέκα σουίτες να μην αλλάξει
 * γραμμή. Δεύτερος καταγραφέας με άλλο όνομα είναι ακριβώς ο structural clone που πιάνει
 * το CHECK 3.28 (jscpd) **ανεξάρτητα ονόματος**.
 *
 * ## Γιατί ένα ίχνος κλήσεων σχεδίασης είναι ΑΥΣΤΗΡΟΤΕΡΟ από pixel golden
 * Οι μεγάλοι (Skia GM · Chromium) συγκρίνουν **pixels**. Το pixel golden είναι εύθραυστο
 * (γραμματοσειρά, antialiasing, πλατφόρμα, θέμα) και — όπως **μετρήθηκε** εδώ — μπορεί να
 * είναι **κενό χωρίς να το πάρει κανείς είδηση**: 39 από 39 committed golden της σουίτας e2e
 * δεν περιείχαν ούτε μία γραμμή σχεδίου επί τρεις μήνες, με τέσσερα από αυτά **πράσινα**.
 *
 * Ένα ίχνος κλήσεων:
 * - είναι **ανεξάρτητο** πλατφόρμας / θέματος / γραμματοσειράς·
 * - είναι **αναγνώσιμο** σε diff ενός PR (ένας άνθρωπος βλέπει *τι* άλλαξε, όχι *ότι* άλλαξε)·
 * - τρέχει σε **jest, χωρίς browser** — δευτερόλεπτα αντί για 41 λεπτά·
 * - και **ένα κενό ίχνος είναι προφανώς κενό**. Η βλάβη που έζησε τρεις μήνες γίνεται
 *   **δομικά αδύνατη**, γιατί το «τίποτα» παύει να μοιάζει με έγκυρη απάντηση.
 *
 * Τα pixel goldens μένουν **μόνο** για ό,τι το ίχνος δεν πιάνει (σύνθεση, WebGL, στοίβαξη).
 *
 * @module testing/paint-recorder
 */

import type { Point2D } from '../rendering/types/Types';

/** Μία διαδρομή που χαράχτηκε: με τι μολύβι και σε ποια σημεία **οθόνης**. */
interface StrokeRecord {
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
interface TextRecord {
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
 * Ένα συμπαγές ορθογώνιο (`fillRect`) — ADR-739 Φ.Ε: η **υπογράμμιση**.
 *
 * Καταγράφεται με το σημείο **μετά** τον μετασχηματισμό, για τον ίδιο λόγο με το
 * {@link TextRecord}: μέσα στη στροφή του `stampFrameText` τα ορίσματα είναι σχετικά, και
 * ένας καταγραφέας που κοιτά μόνο αυτά θα ήταν πράσινος και για γραμμή που έμεινε οριζόντια
 * κάτω από γερμένο κείμενο.
 */
interface RectRecord {
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
interface ClipRecord {
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
interface FillPathRecord {
  readonly color: string;
  /** Μία εγγραφή ανά `moveTo`, σε px **οθόνης** (μετά τον ενεργό μετασχηματισμό). */
  readonly subpaths: ReadonlyArray<ReadonlyArray<Point2D>>;
  /** Ό,τι ζητήθηκε στο `fill(rule)`· `'nonzero'` όταν δεν δόθηκε, όπως ο καμβάς. */
  readonly rule: CanvasFillRule;
}

/**
 * 🔴 ADR-775 §13 — ένα **τόξο** (`arc`/`ellipse`).
 *
 * Δεν υπήρχε όσο ο καταγραφέας ήταν αποκλειστικά για πίνακες: ένας πίνακας δεν έχει κύκλους.
 * Μόλις όμως το ίχνος γίνει το κύριο δίχτυ **για τον καμβά DXF**, η απουσία του θα σήμαινε ότι
 * ένας κύκλος ή ένα τόξο εξαφανίζονται από το ίχνος **σιωπηλά** — δηλαδή ακριβώς το
 * «κατάπιε-και-προχώρα» stub, σε τρίτη ιδιότητα, μέσα στο όργανο που το κυνηγά.
 */
interface ArcRecord {
  /** Το κέντρο σε px **οθόνης**, μετά τον ενεργό μετασχηματισμό. */
  readonly at: Point2D;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

export interface PaintLog {
  readonly fills: string[];
  readonly fillPaths: FillPathRecord[];
  readonly texts: TextRecord[];
  readonly strokes: StrokeRecord[];
  readonly rects: RectRecord[];
  readonly clips: ClipRecord[];
  readonly arcs: ArcRecord[];
}

/** Καθαρό ημερολόγιο — μία έκφραση, ώστε καμία σουίτα να μην ξεχάσει πεδίο. */
export function createPaintLog(): PaintLog {
  return { fills: [], fillPaths: [], texts: [], strokes: [], rects: [], clips: [], arcs: [] };
}

/**
 * Το **συνολικό** πλήθος κλήσεων σχεδίασης του ημερολογίου.
 *
 * 🔑 Αυτός είναι ο αριθμός που κάνει τη βλάβη του ADR-775 **αδύνατη να περάσει απαρατήρητη**:
 * `0` σημαίνει «ο ζωγράφος δεν χάραξε τίποτα» και **δεν μοιάζει** με έγκυρη απάντηση, ενώ ένα
 * κενό PNG μοιάζει με απολύτως κανονική φωτογραφία.
 */
export function totalDrawCalls(log: PaintLog): number {
  return (
    log.fillPaths.length +
    log.texts.length +
    log.strokes.length +
    log.rects.length +
    log.arcs.length
  );
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

/** Ίδια πράξη με το `CanvasRenderingContext2D.scale`. */
function scaled(m: Affine, sx: number, sy: number): Affine {
  return { ...m, a: m.a * sx, b: m.b * sx, c: m.c * sy, d: m.d * sy };
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
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    canvas: undefined as unknown as HTMLCanvasElement,
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
    scale: (sx: number, sy: number): void => {
      transform = scaled(transform, sx, sy);
    },
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number): void => {
      transform = { a, b, c, d, e, f };
    },
    resetTransform: (): void => {
      transform = IDENTITY;
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
    // ADR-775 §13 — τα τόξα καταγράφονται ΚΑΙ ως συμβάν (`arcs`) ΚΑΙ ως σημείο στην τρέχουσα
    // υποδιαδρομή: ένας κύκλος του DXF είναι `beginPath` + `arc` + `stroke`, οπότε χωρίς το
    // δεύτερο η διαδρομή θα κατέληγε **κενή** και το `stroke` θα κατέγραφε γραμμή χωρίς σημεία.
    arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number): void => {
      const at = applyTransform(transform, x, y);
      log.arcs.push({ at, radiusX: radius, radiusY: radius, startAngle, endAngle });
      const current = subpaths[subpaths.length - 1] ?? (subpaths.push([]), subpaths[subpaths.length - 1]);
      current.push(at);
    },
    ellipse: (
      x: number, y: number, radiusX: number, radiusY: number,
      _rotation: number, startAngle: number, endAngle: number,
    ): void => {
      const at = applyTransform(transform, x, y);
      log.arcs.push({ at, radiusX, radiusY, startAngle, endAngle });
      const current = subpaths[subpaths.length - 1] ?? (subpaths.push([]), subpaths[subpaths.length - 1]);
      current.push(at);
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
    getLineDash: (): number[] => [...dashPx],
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
    strokeText: (text: string, x: number, y: number): void => {
      log.texts.push({
        text,
        color: ctx.strokeStyle,
        font: ctx.font,
        at: applyTransform(transform, x, y),
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
    strokeRect: (x: number, y: number, w: number, h: number): void => {
      log.rects.push({
        color: ctx.strokeStyle,
        at: applyTransform(transform, x, y),
        widthPx: w,
        heightPx: h,
        angleRad: Math.atan2(transform.b, transform.a),
      });
    },
    // ⚠️ Το `clearRect` ΔΕΝ είναι κλήση σχεδίασης — είναι σβήσιμο. Καταγράφεται ως τίποτα
    // επίτηδες: αν μετρούσε ως μελάνι, ένα πέρασμα που **μόνο** καθαρίζει τον καμβά θα
    // απαντούσε «ζωγράφισα» — δηλαδή θα ξαναέλεγε το ψέμα που γέννησε αυτό το module.
    clearRect: (): void => undefined,
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
    createLinearGradient: () => ({ addColorStop: (): void => undefined }),
    drawImage: (): void => undefined,
    getImageData: (): ImageData => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }) as ImageData,
    putImageData: (): void => undefined,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/**
 * Ένας **καμβάς** που παραδίδει τον καταγραφέα αντί για πραγματικό context.
 *
 * 🔑 Αυτό είναι που κάνει το ίχνος εφαρμόσιμο **πέρα από τους πίνακες**: ο `DxfRenderer`
 * (και κάθε ζωγράφος του viewer) δέχεται `HTMLCanvasElement` και καλεί μόνος του
 * `getContext('2d')` — δεν δέχεται context. Χωρίς αυτό το εργοστάσιο, ένα test θα έπρεπε
 * να **παρακάμψει** τον παραγωγικό δρόμο κατασκευής, δηλαδή να δοκιμάσει κάτι άλλο.
 *
 * ⚠️ Το `IRenderContext` / `Canvas2DContext` **δεν** είναι ο δρόμος εδώ, παρότι μοιάζει: ο
 * `DxfRenderer` κρατά `private ctx: CanvasRenderingContext2D` και **δεν** περνά από την
 * αφαίρεση (επαληθεύτηκε 2026-08-08). Ένα recording context καρφωμένο εκεί θα ήταν φρουρός
 * σε μονοπάτι που ο καμβάς DXF δεν διαβαίνει ποτέ.
 */
export function createRecordingCanvas(
  log: PaintLog,
  size: { width: number; height: number } = { width: 1280, height: 800 },
): HTMLCanvasElement {
  const ctx = createCtx(log);

  // 🔴 ΠΡΑΓΜΑΤΙΚΟ `<canvas>` του jsdom, με παρακαμμένο μόνο το `getContext`.
  //
  // Ένα αντικείμενο-σωσίας **δεν αρκεί**, και ο λόγος είναι μετρημένος: το
  // `CanvasBoundsService.getBounds` κάνει `canvas instanceof HTMLCanvasElement` και πετά
  // ρητά — δηλαδή ο παραγωγικός δρόμος **ελέγχει τον τύπο**, και μια δοκιμή που του δίνει
  // ψεύτικο σχήμα δεν δοκιμάζει τον παραγωγικό δρόμο. Παρακάμπτεται **μόνο** το
  // `getContext`, που είναι ακριβώς η ραφή του καταγραφέα· όλα τα υπόλοιπα είναι το
  // κανονικό στοιχείο του DOM.
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: (kind: string) => (kind === '2d' ? ctx : null),
  });
  // Το jsdom δεν κάνει layout ⇒ `getBoundingClientRect()` επιστρέφει 0×0. Ο `DxfRenderer`
  // **έχει** fallback στο viewport του καλούντος γι' αυτή την περίπτωση, αλλά το δηλώνουμε
  // ρητά ώστε το ίχνος να μη γεννιέται από συμπεριφορά που κανείς δεν ζήτησε.
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height,
      width: size.width, height: size.height, toJSON: () => ({}),
    }),
  });
  // Ο καταγραφέας δείχνει πίσω στον καμβά του, όπως κάθε πραγματικό 2D context.
  (ctx as unknown as { canvas: unknown }).canvas = canvas;
  return canvas;
}
