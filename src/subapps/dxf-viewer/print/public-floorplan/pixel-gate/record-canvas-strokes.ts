/**
 * @fileoverview **ΠΟΙΟΣ ΧΑΡΑΞΕ ΤΙ** — καταγραφή κάθε `stroke` του Canvas 2D όσο τρέχει μια λήψη (CHECK 3.101).
 * @related ADR-909 §6.7 · ./measure-public-floorplan-pixels
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/record-canvas-strokes
 *
 * 🔑 **Όργανο μέτρησης, ΜΟΝΟ για τη σελίδα δοκιμής.** Τυλίγει το πρωτότυπο του `CanvasRenderingContext2D`
 * για όση ώρα τρέχει το `run`, και το **επαναφέρει στο `finally`**. Δεν καλείται από κώδικα παραγωγής.
 *
 * Γιατί στο πρωτότυπο και όχι στα pixels: η αντίθεση μιας γραμμής δεν μετριέται αξιόπιστα από την εικόνα —
 * η εξομάλυνση των άκρων δίνει ανοιχτά pixels και σε **μαύρη** γραμμή. Το χρώμα που **ζητήθηκε** είναι ακριβές.
 *
 * Η θέση κάθε γραμμής είναι το **πρώτο σημείο** του μονοπατιού της, σε pixels του καμβά: αρκεί για να βρεθεί
 * σε ποιο κελί του δείγματος ανήκει, χωρίς να διαβαστεί το stack *(που εξαρτάται από τον bundler)*.
 */

/** Μία κλήση `stroke` / `strokeRect` / `strokeText`, όπως τη ζήτησε ο ζωγράφος. */
export interface RecordedStroke {
  readonly canvas: HTMLCanvasElement;
  /** Πρώτο σημείο του μονοπατιού σε pixels του καμβά· `null` όταν δεν είναι γνωστό (π.χ. `Path2D`). */
  readonly at: { readonly x: number; readonly y: number } | null;
  /** `strokeStyle` όταν είναι χρώμα· `null` για μοτίβο ή διαβάθμιση. */
  readonly style: string | null;
  readonly alpha: number;
  /** `lineWidth` × κλίμακα του μετασχηματισμού ⇒ px του καμβά. */
  readonly widthPx: number;
}

type Ctx = CanvasRenderingContext2D;
type CtxMethod = (this: Ctx, ...args: unknown[]) => unknown;
type Point = { readonly x: number; readonly y: number };

/** Μέθοδοι που **προσθέτουν** σημείο στο τρέχον μονοπάτι, με τα `x, y` στις δύο πρώτες θέσεις. */
const PATH_POINT_METHODS = ['moveTo', 'lineTo', 'rect', 'arc', 'ellipse', 'roundRect'] as const;
/** Καμπύλες: το σημείο ελέγχου είναι **μέσα** στο ίδιο κελί με την καμπύλη — αρκεί ως θέση. */
const PATH_CURVE_METHODS = ['quadraticCurveTo', 'bezierCurveTo', 'arcTo'] as const;

function toDevice(ctx: Ctx, x: unknown, y: unknown): Point | null {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  const m = ctx.getTransform();
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function deviceLineWidth(ctx: Ctx): number {
  const m = ctx.getTransform();
  return ctx.lineWidth * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
}

function snapshot(ctx: Ctx, at: Point | null): RecordedStroke {
  return {
    canvas: ctx.canvas,
    at,
    style: typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : null,
    alpha: ctx.globalAlpha,
    widthPx: deviceLineWidth(ctx),
  };
}

/** Τύλιξε μία μέθοδο του πρωτοτύπου· επιστρέφει την **αναίρεση**. */
function wrap(name: string, before: (ctx: Ctx, args: readonly unknown[]) => void): () => void {
  const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, CtxMethod | undefined>;
  const original = proto[name];
  if (original === undefined) return () => undefined;
  proto[name] = function wrapped(this: Ctx, ...args: unknown[]) {
    before(this, args);
    return original.apply(this, args);
  };
  return () => {
    proto[name] = original;
  };
}

function installRecorder(strokes: RecordedStroke[]): Array<() => void> {
  const firstPoint = new WeakMap<Ctx, Point | null>();
  const note = (ctx: Ctx, args: readonly unknown[]) => {
    if (firstPoint.get(ctx)) return;
    firstPoint.set(ctx, toDevice(ctx, args[0], args[1]));
  };

  return [
    wrap('beginPath', (ctx) => firstPoint.set(ctx, null)),
    ...[...PATH_POINT_METHODS, ...PATH_CURVE_METHODS].map((name) => wrap(name, note)),
    // `stroke(path2d)`: το μονοπάτι δεν πέρασε από εδώ — η θέση του είναι άγνωστη, και το λέμε.
    wrap('stroke', (ctx, args) => strokes.push(snapshot(ctx, args.length > 0 ? null : firstPoint.get(ctx) ?? null))),
    wrap('strokeRect', (ctx, args) => strokes.push(snapshot(ctx, toDevice(ctx, args[0], args[1])))),
    wrap('strokeText', (ctx, args) => strokes.push(snapshot(ctx, toDevice(ctx, args[1], args[2])))),
  ];
}

/**
 * **Τρέξε το `run` και γύρνα κάθε γραμμή που χαράχτηκε όσο έτρεχε.**
 *
 * ⚠️ Το πρωτότυπο επανέρχεται **πάντα**, και με αποτυχία: όργανο που αφήνει ίχνη αλλάζει ό,τι μετρά μετά.
 */
export async function recordCanvasStrokes<T>(
  run: () => Promise<T>,
): Promise<{ readonly result: T; readonly strokes: readonly RecordedStroke[] }> {
  const strokes: RecordedStroke[] = [];
  const undo = installRecorder(strokes);
  try {
    return { result: await run(), strokes };
  } finally {
    for (const restore of undo.reverse()) restore();
  }
}
