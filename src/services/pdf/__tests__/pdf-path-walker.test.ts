/**
 * ADR-941 — `walkPaintedPaths`: ο ΕΝΑΣ αναγνώστης εντολών σχεδίασης PDF (δομή σελίδας ADR-923 + εισαγωγή διανυσμάτων).
 * Και `readPageStructure`, που πλέον είναι καταναλωτής του: ίδιοι κανόνες πινάκων.
 */

import { walkPaintedPaths, type PdfPathOperators } from '../pdf-path-walker';
import { readPageStructure, type PdfjsOperators, type StructurePage } from '../pdf-page-structure';

const OPS: PdfjsOperators = {
  save: 1, restore: 2, transform: 3, constructPath: 4, moveTo: 5, lineTo: 6, curveTo: 7, curveTo2: 8, curveTo3: 9,
  closePath: 10, rectangle: 11, stroke: 12, closeStroke: 13, fill: 14, eoFill: 15, fillStroke: 16, eoFillStroke: 17,
  closeFillStroke: 18, closeEOFillStroke: 19, endPath: 20, paintFormXObjectBegin: 21, paintFormXObjectEnd: 22,
  showText: 23, showSpacedText: 24, nextLineShowText: 25, nextLineSetSpacingShowText: 26,
};
const PATH_OPS: PdfPathOperators = OPS;

type Op = readonly [number, (readonly unknown[] | null)?];
const program = (...ops: Op[]) => ({ fnArray: ops.map(([fn]) => fn), argsArray: ops.map(([, args]) => args ?? null) });
const path = (subOps: number[], coords: number[]): Op => [OPS.constructPath, [subOps, coords, null]];

describe('walkPaintedPaths', () => {
  it('μόνο ό,τι ζωγραφίζεται: clip + endPath δεν είναι γεωμετρία', () => {
    const { fnArray, argsArray } = program(
      path([OPS.rectangle], [0, 0, 10, 10]), [OPS.endPath],
      path([OPS.moveTo, OPS.lineTo], [0, 0, 5, 0]), [OPS.stroke],
    );
    const painted = walkPaintedPaths(PATH_OPS, fnArray, argsArray);
    expect(painted).toHaveLength(1);
    expect(painted[0].subpaths).toEqual([{ kind: 'path', start: [0, 0], segments: [{ kind: 'line', to: [5, 0] }], closed: false }]);
    expect(painted[0]).toMatchObject({ stroke: true, fill: false, closedByPaint: false });
  });

  it('ο πίνακας μετασχηματισμού εφαρμόζεται, και το restore τον επαναφέρει', () => {
    const { fnArray, argsArray } = program(
      [OPS.save], [OPS.transform, [2, 0, 0, 2, 100, 0]], path([OPS.moveTo, OPS.lineTo], [1, 1, 2, 1]), [OPS.stroke], [OPS.restore],
      path([OPS.moveTo, OPS.lineTo], [1, 1, 2, 1]), [OPS.stroke],
    );
    const [scaled, plain] = walkPaintedPaths(PATH_OPS, fnArray, argsArray);
    expect(scaled.subpaths[0]).toMatchObject({ start: [102, 2], segments: [{ kind: 'line', to: [104, 2] }] });
    expect(plain.subpaths[0]).toMatchObject({ start: [1, 1], segments: [{ kind: 'line', to: [2, 1] }] });
  });

  it('closePath κλείνει την υπο-διαδρομή· ορθογώνιο = τέσσερις γωνίες κατά σειρά', () => {
    const { fnArray, argsArray } = program(
      path([OPS.moveTo, OPS.lineTo, OPS.lineTo, OPS.closePath, OPS.rectangle], [0, 0, 4, 0, 4, 3, 10, 10, 2, 1]), [OPS.closeStroke],
    );
    const [painted] = walkPaintedPaths(PATH_OPS, fnArray, argsArray);
    expect(painted.closedByPaint).toBe(true);
    expect(painted.subpaths[0]).toMatchObject({ kind: 'path', closed: true });
    expect(painted.subpaths[1]).toEqual({ kind: 'rect', corners: [[10, 10], [12, 10], [12, 11], [10, 11]] });
  });

  it('οι καμπύλες `v` / `y` παίρνουν το σημείο ελέγχου που λείπει από τον δρομέα / το τέλος', () => {
    const { fnArray, argsArray } = program(
      path([OPS.moveTo, OPS.curveTo2, OPS.curveTo3], [0, 0, 1, 1, 2, 0, 3, 1, 4, 0]), [OPS.fill],
    );
    const [painted] = walkPaintedPaths(PATH_OPS, fnArray, argsArray);
    expect(painted).toMatchObject({ stroke: false, fill: true });
    expect(painted.subpaths[0]).toMatchObject({
      segments: [{ kind: 'curve', c1: [0, 0], c2: [1, 1], to: [2, 0] }, { kind: 'curve', c1: [3, 1], c2: [4, 0], to: [4, 0] }],
    });
  });
});

function structurePage(ops: Op[]): StructurePage {
  const { fnArray, argsArray } = program(...ops);
  return {
    getOperatorList: async () => ({ fnArray, argsArray }),
    getStructTree: async () => null,
    getTextContent: async () => ({ items: [] }),
  };
}
const viewport = { width: 100, height: 100, convertToViewportPoint: (x: number, y: number): [number, number] => [x, 100 - y] };

describe('readPageStructure — καταναλωτής του βαδιστή', () => {
  it('ορθογώνιο ⇒ 4 κανόνες· λοξή γραμμή ⇒ κανένας', async () => {
    const page = structurePage([path([OPS.rectangle, OPS.moveTo, OPS.lineTo], [10, 10, 50, 30, 0, 0, 20, 20]), [OPS.stroke]]);
    const { rules } = await readPageStructure(page, viewport, OPS);
    expect(rules.map((r) => r.axis).sort()).toEqual(['h', 'h', 'v', 'v']);
  });

  it('ευθεία μετά από καμπύλη ξεκινά από το ΤΕΛΟΣ της καμπύλης', async () => {
    // moveTo(0,50) → καμπύλη ως (40,50) → lineTo(90,50): κανόνας 0,40–0,90, όχι 0,00–0,90.
    const page = structurePage([path([OPS.moveTo, OPS.curveTo, OPS.lineTo], [0, 50, 10, 60, 30, 60, 40, 50, 90, 50]), [OPS.stroke]]);
    const { rules } = await readPageStructure(page, viewport, OPS);
    expect(rules).toEqual([{ axis: 'h', at: 0.5, from: 0.4, to: 0.9 }]);
  });
});
