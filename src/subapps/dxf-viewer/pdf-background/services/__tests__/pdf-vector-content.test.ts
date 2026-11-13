/**
 * ADR-941 Φ1 — `readVectorContent`: γραμμές με πινελιά → πολυγραμμές σε px της απόδοσης· γεμίσματα μετριούνται· κείμενα με
 * τρία σημεία· καμπύλες ισοπεδώνονται και καταλήγουν ΑΚΡΙΒΩΣ στο τέλος τους.
 */

import type { PdfPathOperators } from '@/services/pdf/pdf-path-walker';
import { flattenCubic, readVectorContent, type VectorSourcePage } from '../pdf-vector-content';

const OPS: PdfPathOperators = {
  save: 1, restore: 2, transform: 3, constructPath: 4, moveTo: 5, lineTo: 6, curveTo: 7, curveTo2: 8, curveTo3: 9,
  closePath: 10, rectangle: 11, stroke: 12, closeStroke: 13, fill: 14, eoFill: 15, fillStroke: 16, eoFillStroke: 17,
  closeFillStroke: 18, closeEOFillStroke: 19, endPath: 20, paintFormXObjectBegin: 21, paintFormXObjectEnd: 22,
};

/** Σελίδα 200 pt ύψους· viewport κλίμακας `scale`: x·s, (200 − y)·s (όπως το pdf.js). */
function page(fnArray: number[], argsArray: (unknown[] | null)[], items: unknown[]): VectorSourcePage {
  return {
    getOperatorList: async () => ({ fnArray, argsArray }),
    getTextContent: async () => ({ items }),
    getViewport: ({ scale }) => ({ convertToViewportPoint: (x: number, y: number) => [x * scale, (200 - y) * scale] }),
  };
}

describe('readVectorContent', () => {
  it('πινελιά ⇒ πολυγραμμή σε px· γέμισμα ⇒ μετριέται, δεν εισάγεται', async () => {
    const content = await readVectorContent(page(
      [OPS.constructPath, OPS.stroke, OPS.constructPath, OPS.fill],
      [[[OPS.moveTo, OPS.lineTo], [10, 20, 30, 20], null], null, [[OPS.rectangle], [0, 0, 5, 5], null], null],
      [],
    ), OPS, 2);
    expect(content.polylines).toEqual([{ points: [[20, 360], [60, 360]], closed: false }]);
    expect(content.skippedFills).toBe(1);
  });

  it('ορθογώνιο με πινελιά ⇒ κλειστή πολυγραμμή 4 κορυφών', async () => {
    const content = await readVectorContent(page([OPS.constructPath, OPS.stroke], [[[OPS.rectangle], [0, 0, 10, 20], null], null], []), OPS, 1);
    expect(content.polylines).toEqual([{ points: [[0, 200], [10, 200], [10, 180], [0, 180]], closed: true }]);
  });

  it('κείμενο: αρχή γραμμής βάσης + ένα em κατά μήκος + ένα em πάνω, σε px· κενά έξω', async () => {
    const content = await readVectorContent(page([], [], [
      { str: '4.12', transform: [10, 0, 0, 10, 50, 100] },
      { str: '   ', transform: [10, 0, 0, 10, 0, 0] },
      { type: 'beginMarkedContent' },
    ]), OPS, 2);
    expect(content.texts).toEqual([{ text: '4.12', origin: [100, 200], along: [120, 200], up: [100, 180] }]);
  });
});

describe('flattenCubic', () => {
  it('καταλήγει ακριβώς στο τέλος, με περισσότερα βήματα σε μεγαλύτερη καμπύλη', () => {
    const short = flattenCubic([0, 0], [1, 1], [2, 1], [3, 0]);
    const long = flattenCubic([0, 0], [100, 100], [200, 100], [300, 0]);
    expect(short[short.length - 1]).toEqual([3, 0]);
    expect(long[long.length - 1]).toEqual([300, 0]);
    expect(long.length).toBeGreaterThan(short.length);
  });
});
