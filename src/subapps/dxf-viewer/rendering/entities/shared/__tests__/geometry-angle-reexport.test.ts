/**
 * ADR-920 Β4.8 — ΕΝΑ σπίτι: το dxf-viewer επανεξάγει τη γωνία κειμένου του `@/lib/geometry/angle`.
 * Ζει ΜΕΣΑ στο subapp: η εισαγωγή πηγαίνει προς τα μέσα (subapp → lib), ποτέ lib → subapp (CHECK 3.62).
 */

import { RIGHT_ANGLE, normalizeTextAngle } from '@/lib/geometry/angle';
import * as dxfAngleUtils from '../geometry-angle-utils';

describe('geometry-angle-utils — επανεξαγωγή της γωνίας κειμένου', () => {
  it('ΕΝΑ σπίτι: το dxf-viewer επανεξάγει τα ΙΔΙΑ σύμβολα, όχι αντίγραφα', () => {
    expect(dxfAngleUtils.normalizeTextAngle).toBe(normalizeTextAngle);
    expect(dxfAngleUtils.RIGHT_ANGLE).toBe(RIGHT_ANGLE);
  });
});
