/**
 * Πλαστός καμβάς για τις άγκυρες των ζωγράφων σώματος (ADR-909 Γ2.3 · Γ2.4): θυμάται τι ίσχυε **τη στιγμή**
 * κάθε `fill()` / `stroke()` — γέμισμα, μελάνι, πάχος, παύλα — και πόσα `save` / `restore` έγιναν.
 *
 * Όχι αρχείο test: βοήθημα που το μοιράζονται οι σουίτες του φακέλου (το jscpd αγνοεί τα `__tests__`, άρα
 * το ίδιο σώμα γραμμένο δύο φορές δεν θα το έπιανε καμία πύλη).
 */

export interface PaintedStroke { ink: string; width: number; dash: number[] }

/** `texts` = το μελάνι κάθε `fillText` — ξεχωριστά από τα `fills`, γιατί το κείμενο είναι μελάνι, όχι γέμισμα. */
export interface Painted { fills: string[]; texts: string[]; strokes: PaintedStroke[]; saves: number; restores: number }

export function recordingContext(): { ctx: CanvasRenderingContext2D; painted: Painted } {
  let dash: number[] = [];
  const painted: Painted = { fills: [], texts: [], strokes: [], saves: 0, restores: 0 };
  const noop = (): void => {};
  const ctx = {
    canvas: { width: 800, height: 600, getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }) },
    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
    shadowBlur: 0, shadowColor: '', globalCompositeOperation: 'source-over',
    font: '', textAlign: 'start', textBaseline: 'alphabetic',
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, arc: noop, clip: noop,
    translate: noop, rotate: noop, scale: noop,
    fillText() { painted.texts.push(this.fillStyle); },
    save: () => { painted.saves += 1; },
    restore: () => { painted.restores += 1; },
    setLineDash: (next: number[]) => { dash = [...next]; },
    fill() { painted.fills.push(this.fillStyle); },
    stroke() { painted.strokes.push({ ink: this.strokeStyle, width: this.lineWidth, dash: [...dash] }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, painted };
}
