/**
 * ADR-941 Φ2α — `pdfDimensionEntities`: δεμένη τιμή → `aligned` διάσταση συσχετισμένη με την ακμή της (Δ13), ζωντανή τιμή
 * όταν συμφωνεί με τη γεωμετρία, γραμμένο κείμενο όταν διαφωνεί (Δ14).
 */

import type { RasterPlacement } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent } from '../../../pdf-background/services/pdf-vector-content';
import type { PdfDimensionBinding } from '../pdf-vector-dimension-binding';
import { pdfDimensionEntities } from '../pdf-vector-dimension-entities';
import { isPdfVectorImportOf } from '../pdf-vector-entities';

/** Εικόνα 3000 px ύψους, ταυτοτική: cad-y-up ⇒ σκηνή (x, 3000 − y)· 1 px = 1 mm σε σκηνή mm. */
const PLACEMENT: RasterPlacement = {
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  naturalBounds: { width: 5000, height: 3000 },
};

/** Ορθογώνιο 2050 × 4120 px. */
const CONTENT: PdfVectorContent = {
  polylines: [{ points: [[0, 0], [2050, 0], [2050, 2900], [0, 2900]], closed: true }],
  texts: [],
  skippedFills: 0,
};

const binding = (patch: Partial<PdfDimensionBinding>): PdfDimensionBinding => ({
  textIndex: 0, raw: '2.05', valueMm: 2050, precisionMm: 10,
  edge: { polylineIndex: 0, from: 0, to: 1 }, baselineMid: [1025, -200], ...patch,
});

let seq = 0;
const entitiesOf = (bindings: readonly PdfDimensionBinding[]) => pdfDimensionEntities({
  bindings, content: CONTENT, geometryIds: ['ent_rect'], placement: PLACEMENT, sceneUnits: 'mm',
  styleId: 'style_1', layerId: 'lyr_dim', sourceKey: 'bg_1', newId: () => `dim_${++seq}`,
});

describe('pdfDimensionEntities', () => {
  it('aligned στα άκρα της ακμής, γραμμή διάστασης από το μέσο της γραμμής βάσης, layer/στυλ του καλούντα', () => {
    const { dimensions: [dim] } = entitiesOf([binding({})]);
    expect(dim).toMatchObject({
      type: 'dimension', dimensionType: 'aligned', layerId: 'lyr_dim', styleId: 'style_1',
      defPoints: [{ x: 0, y: 3000 }, { x: 2050, y: 3000 }, { x: 1025, y: 3200 }],
    });
  });

  it('συσχετισμένη με τις ΚΟΡΥΦΕΣ της ακμής (και η κλείνουσα ακμή 3 → 0) ⇒ ακολουθεί την επεξεργασία', () => {
    const { dimensions: [dim] } = entitiesOf([binding({ edge: { polylineIndex: 0, from: 3, to: 0 }, valueMm: 2900, raw: '2.90' })]);
    expect(dim.associations).toEqual([
      { defPointIndex: 0, geometryId: 'ent_rect', associationType: 'endpoint', subIndex: 3 },
      { defPointIndex: 1, geometryId: 'ent_rect', associationType: 'endpoint', subIndex: 0 },
    ]);
  });

  it('Δ14: συμφωνεί με τη γεωμετρία ⇒ χωρίς userText (η μετρούμενη, όπως η χειροκίνητη)· διαφωνεί ⇒ το γραμμένο, μετρημένο', () => {
    const { dimensions, overridden } = entitiesOf([binding({}), binding({ raw: '3.00', valueMm: 3000 })]);
    expect(dimensions[0].userText).toBeUndefined();
    expect(dimensions[1].userText).toBe('3.00');
    expect(overridden).toBe(1);
  });

  it('η ταυτότητα της πηγής ⇒ η επόμενη εισαγωγή την αντικαθιστά (Δ16)', () => {
    const { dimensions: [dim] } = entitiesOf([binding({})]);
    expect(isPdfVectorImportOf(dim, 'bg_1')).toBe(true);
  });

  it('δέσιμο σε πολυγραμμή που δεν υπάρχει ⇒ παραλείπεται, ποτέ throw', () => {
    expect(entitiesOf([binding({ edge: { polylineIndex: 7, from: 0, to: 1 } })]).dimensions).toEqual([]);
  });
});
