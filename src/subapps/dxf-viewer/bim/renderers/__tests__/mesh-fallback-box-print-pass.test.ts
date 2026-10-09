/**
 * ADR-909 Γ1β — το **διακεκομμένο** κουτί «φορτώνει» δεν μπαίνει ποτέ σε λήψη.
 *
 * Το διακεκομμένο περίγραμμα είναι υπόσχεση για το επόμενο frame («το σχήμα έρχεται»). Μια λήψη (print pass)
 * ζωγραφίζει μία φορά: εκεί η υπόσχεση είναι ψέμα, και θα δημοσιευόταν. Η οθόνη μένει όπως ήταν.
 */

import { clearPrintColorPolicy, setPrintColorPolicy } from '../../../config/print-color-policy';
import { drawMeshFallbackBox } from '../mesh-silhouette-draw';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];
const PALETTE = { stroke: '#8b5e34', fill: 'rgba(180, 130, 80, 0.16)', edge: 'rgba(139, 94, 52, 0.55)' };

/** Πλαστός καμβάς: θυμάται το μοτίβο παύλας που ίσχυε σε κάθε `stroke()`. */
function recordingContext(): { ctx: CanvasRenderingContext2D; dashesAtStroke: number[][] } {
  let dash: number[] = [];
  const dashesAtStroke: number[][] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: () => { dashesAtStroke.push([...dash]); },
    setLineDash: (next: number[]) => { dash = [...next]; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, dashesAtStroke };
}

function draw(loading: boolean): number[][] {
  const { ctx, dashesAtStroke } = recordingContext();
  drawMeshFallbackBox({ ctx, worldToScreen: (p) => p, vertices: SQUARE, palette: PALETTE, lineWidth: 2, loading });
  return dashesAtStroke;
}

afterEach(() => clearPrintColorPolicy());

describe('drawMeshFallbackBox — print pass (ADR-909 Γ1β)', () => {
  it('Κ1 οθόνη, όπως πριν: διακεκομμένο όσο φορτώνει, συμπαγές αλλιώς', () => {
    const [loadingDash] = draw(true);
    expect(loadingDash.length).toBeGreaterThan(0);
    expect(draw(false)).toStrictEqual([[]]);
  });

  it('Κ2 🔴 print pass: συμπαγές ΑΚΟΜΗ ΚΑΙ όσο φορτώνει — το «έρχεται» δεν δημοσιεύεται', () => {
    setPrintColorPolicy({ style: 'monochrome', dpi: 300 });
    expect(draw(true)).toStrictEqual([[]]);
    expect(draw(false)).toStrictEqual([[]]);
  });
});
