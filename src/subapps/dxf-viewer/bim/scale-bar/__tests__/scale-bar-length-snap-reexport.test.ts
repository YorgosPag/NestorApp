/**
 * ADR-920 Β4.8 — ΕΝΑ σπίτι: το dxf-viewer επανεξάγει το `snapScaleBarLength` του `@/lib/geometry`.
 * Ζει ΜΕΣΑ στο subapp: η εισαγωγή πηγαίνει προς τα μέσα (subapp → lib), ποτέ lib → subapp (CHECK 3.62).
 */

import { snapScaleBarLength } from '@/lib/geometry/scale-bar-length-snap';
import * as dxfScaleBarLengthSnap from '../scale-bar-length-snap';

describe('scale-bar-length-snap — επανεξαγωγή στο dxf-viewer', () => {
  it('ΕΝΑ σπίτι: το dxf-viewer επανεξάγει την ΙΔΙΑ συνάρτηση, όχι αντίγραφο', () => {
    expect(dxfScaleBarLengthSnap.snapScaleBarLength).toBe(snapScaleBarLength);
  });
});
