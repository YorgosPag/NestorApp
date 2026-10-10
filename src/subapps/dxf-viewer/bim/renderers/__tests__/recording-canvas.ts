/**
 * Πλαστός καμβάς για τις άγκυρες των ζωγράφων σώματος (ADR-909 Γ2.3 · Γ2.4): θυμάται τι ίσχυε **τη στιγμή**
 * κάθε `fill()` / `stroke()` — γέμισμα, μελάνι, πάχος, παύλα — και πόσα `save` / `restore` έγιναν.
 *
 * ADR-909 Γ2.6β — το `restore` **επαναφέρει** την κατάσταση, όπως ο πραγματικός καμβάς. Όσο μόνο μετρούσε, ό,τι
 * έθετε ένα μπλοκ `save … restore` διέρρεε στις επόμενες γραμμές, και μια άγκυρα «το πάχος μετά το hover είναι στο
 * δάπεδο» έμενε πράσινη με τον κώδικα χαλασμένο (μεταλλαγμένος `wire-reset`).
 *
 * Όχι αρχείο test: βοήθημα που το μοιράζονται οι σουίτες του φακέλου (το jscpd αγνοεί τα `__tests__`, άρα
 * το ίδιο σώμα γραμμένο δύο φορές δεν θα το έπιανε καμία πύλη).
 */

export interface PaintedStroke { ink: string; width: number; dash: number[] }

/** `texts` = το μελάνι κάθε `fillText` — ξεχωριστά από τα `fills`, γιατί το κείμενο είναι μελάνι, όχι γέμισμα. */
export interface Painted { fills: string[]; texts: string[]; strokes: PaintedStroke[]; saves: number; restores: number }

/** Ό,τι σώζει και επαναφέρει το `save` / `restore` του Canvas 2D από όσα θέτουν οι ζωγράφοι. */
const initialDrawingState = () => ({
  fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
  shadowBlur: 0, shadowColor: '', globalCompositeOperation: 'source-over',
  font: '', textAlign: 'start', textBaseline: 'alphabetic',
});
type DrawingState = ReturnType<typeof initialDrawingState>;
const STATE_KEYS = Object.keys(initialDrawingState()) as ReadonlyArray<keyof DrawingState>;

export function recordingContext(): { ctx: CanvasRenderingContext2D; painted: Painted } {
  let dash: number[] = [];
  const stack: Array<{ state: DrawingState; dash: number[] }> = [];
  const painted: Painted = { fills: [], texts: [], strokes: [], saves: 0, restores: 0 };
  const noop = (): void => {};
  const snapshot = (): DrawingState =>
    Object.fromEntries(STATE_KEYS.map((key) => [key, ctx[key]])) as DrawingState;
  const ctx = {
    canvas: { width: 800, height: 600, getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }) },
    ...initialDrawingState(),
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, arc: noop, clip: noop,
    translate: noop, rotate: noop, scale: noop,
    fillText() { painted.texts.push(this.fillStyle); },
    save: () => {
      painted.saves += 1;
      stack.push({ state: snapshot(), dash: [...dash] });
    },
    restore: () => {
      painted.restores += 1;
      const saved = stack.pop();
      if (saved === undefined) return; // όπως ο πραγματικός καμβάς: `restore` σε άδεια στοίβα δεν κάνει τίποτα
      Object.assign(ctx, saved.state);
      dash = saved.dash;
    },
    setLineDash: (next: number[]) => { dash = [...next]; },
    fill() { painted.fills.push(this.fillStyle); },
    stroke() { painted.strokes.push({ ink: this.strokeStyle, width: this.lineWidth, dash: [...dash] }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, painted };
}
